(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const TICK_MS = 500;
  const STORAGE_KEY = "signalFrontierState";
  const TAB_ORDER = ["scan", "missions", "base", "crew", "tech", "settings", "log"];
  const RECRUIT_COOLDOWN = 45000;

  const BODIES = [
    { id: "debris", name: "Debris Field", type: "Asteroid Belt", unlock: 0, travel: 30, hazard: 0.05, resources: { metal: 40, fuel: 8, research: 6 } },
    { id: "ice", name: "Ice Moon", type: "Frozen Moon", unlock: 500, travel: 60, hazard: 0.12, resources: { organics: 25, fuel: 14, research: 10 } },
    { id: "lava", name: "Lava Rock", type: "Volcanic Planetoid", unlock: 1500, travel: 90, hazard: 0.2, resources: { metal: 70, rare: 4, research: 18 } },
    { id: "cradle", name: "Cradle Station", type: "Derelict Orbital", unlock: 2600, travel: 120, hazard: 0.18, requireTech: "deep_scan", resources: { fuel: 20, research: 32, rare: 8 } },
    { id: "ruins", name: "Fallen Relay", type: "Ancient Relay", unlock: 4000, travel: 140, hazard: 0.22, requireTech: "shielding", resources: { metal: 110, research: 48, rare: 12 } },
    { id: "rift", name: "Rift Beacon", type: "Unknown Signal", unlock: 6500, travel: 180, hazard: 0.3, requireTech: "rift_mapping", resources: { fuel: 40, research: 80, rare: 20 } }
  ];

  const BUILDINGS = [
    { id: "extractor", name: "Extractor", desc: "+3 metal/tick, -1 power", cost: { metal: 60 }, prod: { metal: 3 }, cons: { power: 1 }, unlock: 0 },
    { id: "hydro", name: "Hydroponics", desc: "+2 food/tick, -1 power", cost: { metal: 40, organics: 20 }, prod: { food: 2 }, cons: { power: 1 }, unlock: 200 },
    { id: "reactor", name: "Reactor", desc: "+4 power/tick, -1 fuel", cost: { metal: 100, fuel: 25 }, prod: { power: 4 }, cons: { fuel: 1 }, unlock: 300 },
    { id: "hab", name: "Hab Module", desc: "+3 habitat", cost: { metal: 80, organics: 20 }, prod: { habitat: 3 }, cons: {}, unlock: 0 },
    { id: "rec", name: "Rec Center", desc: "Boosts morale", cost: { metal: 60, organics: 40 }, prod: { morale: 0.02 }, cons: { power: 1 }, unlock: 500 },
    { id: "array", name: "Comms Array", desc: "+4 signal/tick", cost: { metal: 120, fuel: 10 }, prod: { signal: 4 }, cons: { power: 1 }, unlock: 800 }
  ];

  const TECH = [
    { id: "fuel_synth", name: "Fuel Synthesis", desc: "+1 fuel/tick", cost: { signal: 320, research: 12 }, unlock: 300 },
    { id: "hazard_gear", name: "Hazard Gear", desc: "-25% mission hazard", cost: { signal: 780, research: 30 }, unlock: 700 },
    { id: "drone_log", name: "Logistics Drones", desc: "+20% mission cargo", cost: { signal: 1200, research: 60 }, unlock: 1200 },
    { id: "deep_scan", name: "Deep Scan Arrays", desc: "+1 research/tick and reveals deep targets", cost: { signal: 1500, research: 120 }, unlock: 1200 },
    { id: "shielding", name: "Thermal Shielding", desc: "-40% hazard on hot zones; unlocks fallen relay", cost: { signal: 2100, research: 180 }, unlock: 2000 },
    { id: "rift_mapping", name: "Rift Mapping", desc: "Unlocks anomalous missions and +20% rare cargo", cost: { signal: 3600, research: 260, rare: 8 }, unlock: 3500 }
  ];

  const CREW_ROLES = [
    { id: "miner", name: "Miner", desc: "Boosts extractors and cargo mining." },
    { id: "botanist", name: "Botanist", desc: "Boosts food and organics yields." },
    { id: "engineer", name: "Engineer", desc: "Boosts power and general maintenance." }
  ];
  const ROLE_ICON = { miner: "[MIN]", botanist: "[BOT]", engineer: "[ENG]" };

  const SHORTCUTS = [
    { keys: "Space", action: "Collect signal at the hub" },
    { keys: "1-7", action: "Switch tabs (Scan, Missions, Base, Crew, Tech, Settings, Log)" },
    { keys: "M", action: "Jump to Missions" },
    { keys: "L / Enter", action: "Launch selected mission" },
    { keys: "B", action: "Jump to Base builder" },
    { keys: "Arrow Left/Right", action: "Cycle tabs" }
  ];

  function createDefaultState() {
    return {
      resources: {
        signal: 0,
        research: 2,
        metal: 0,
        organics: 0,
        fuel: 12,
        power: 0,
        food: 0,
        habitat: 0,
        morale: 0,
        rare: 0
      },
      rates: { signal: 0, research: 0, metal: 0, organics: 0, fuel: 0, power: 0, food: 0, morale: 0 },
      workers: { total: 3, assigned: { miner: 1, botanist: 1, engineer: 1 }, bonus: { miner: 0, botanist: 0, engineer: 0 }, satisfaction: 1 },
      buildings: {},
      tech: {},
      missions: { active: null },
      selectedBody: "debris",
      milestones: {},
      log: [],
      recruits: [],
      lastRecruitRoll: 0
    };
  }

  const state = createDefaultState();

  const ui = {};
  let toastTimer = null;
  let tickTimer = null;

  window.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheUi();
    bindUi();
    load();
    rollRecruits(false);
    render();
    tickTimer = setInterval(tick, TICK_MS);
  }

  function cacheUi() {
    ui.tabs = $$(".tab");
    ui.panels = $$(".panel");
    ui.resourceStats = $("#resourceStats");
    ui.bodyList = $("#bodyList");
    ui.collectSignal = $("#collectSignal");
    ui.pulseScan = $("#pulseScan");
    ui.missionStatus = $("#missionStatus");
    ui.missionTarget = $("#missionTarget");
    ui.launchMission = $("#launchMission");
    ui.missionPreview = $("#missionPreview");
    ui.buildingList = $("#buildingList");
    ui.rateList = $("#rateList");
    ui.crewStatus = $("#crewStatus");
    ui.crewList = $("#crewList");
    ui.needStatus = $("#needStatus");
    ui.needList = $("#needList");
    ui.techList = $("#techList");
    ui.logList = $("#logList");
    ui.toast = $("#toast");
    ui.satisfaction = $("#satisfaction");
    ui.hubStatus = $("#hubStatus");
    ui.starterGuide = $("#starterGuide");
    ui.controlsList = $("#controlsList");
    ui.exportBtn = $("#exportProfile");
    ui.importBtn = $("#importProfile");
    ui.profileOutput = $("#profileOutput");
    ui.recruitList = $("#recruitList");
    ui.recruitCooldown = $("#recruitCooldown");
    ui.refreshRecruits = $("#refreshRecruits");
  }

  function bindUi() {
    ui.tabs.forEach((tab) => {
      tab.addEventListener("click", () => setTab(tab.dataset.tab));
    });
    if (ui.collectSignal) ui.collectSignal.addEventListener("click", collectSignal);
    if (ui.pulseScan) ui.pulseScan.addEventListener("click", pulseScan);
    if (ui.launchMission) ui.launchMission.addEventListener("click", startMission);
    if (ui.missionTarget) ui.missionTarget.addEventListener("change", (e) => (state.selectedBody = e.target.value));
    if (ui.exportBtn) ui.exportBtn.addEventListener("click", exportProfile);
    if (ui.importBtn) ui.importBtn.addEventListener("click", importProfile);
    if (ui.refreshRecruits) ui.refreshRecruits.addEventListener("click", () => rollRecruits(true));
    window.addEventListener("keydown", handleKeydown);
  }

  function setTab(tab) {
    ui.tabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tab));
    ui.panels.forEach((panel) => panel.classList.toggle("hidden", panel.dataset.panel !== tab));
  }

  function handleKeydown(e) {
    if (isTyping(e)) return;
    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      collectSignal();
      return;
    }
    if (e.code === "ArrowRight") {
      cycleTab(1);
      return;
    }
    if (e.code === "ArrowLeft") {
      cycleTab(-1);
      return;
    }
    if (e.code.startsWith("Digit")) {
      const idx = Number(e.key);
      if (idx >= 1 && idx <= TAB_ORDER.length) setTab(TAB_ORDER[idx - 1]);
      return;
    }
    if (e.code === "KeyM") {
      setTab("missions");
      return;
    }
    if (e.code === "KeyB") {
      setTab("base");
      return;
    }
    if (e.code === "KeyL" || e.code === "Enter") {
      if (currentTab() === "missions") startMission();
      return;
    }
  }

  function currentTab() {
    const active = ui.tabs.find((t) => t.classList.contains("active"));
    return active?.dataset.tab || TAB_ORDER[0];
  }

  function cycleTab(delta) {
    const idx = TAB_ORDER.indexOf(currentTab());
    const next = (idx + delta + TAB_ORDER.length) % TAB_ORDER.length;
    setTab(TAB_ORDER[next]);
  }

  function isTyping(e) {
    const el = e.target;
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      applyState(data);
    } catch {}
  }

  function applyState(data) {
    const fresh = createDefaultState();
    if (data.resources) Object.assign(fresh.resources, data.resources);
    if (data.rates) Object.assign(fresh.rates, data.rates);
    if (data.workers) {
      fresh.workers.total = data.workers.total ?? fresh.workers.total;
      fresh.workers.satisfaction = data.workers.satisfaction ?? fresh.workers.satisfaction;
      if (data.workers.assigned) Object.assign(fresh.workers.assigned, data.workers.assigned);
      if (data.workers.bonus) Object.assign(fresh.workers.bonus, data.workers.bonus);
    }
    if (data.buildings) fresh.buildings = { ...data.buildings };
    if (data.tech) fresh.tech = { ...data.tech };
    if (data.missions) fresh.missions = { active: data.missions.active || null };
    if (data.selectedBody) fresh.selectedBody = data.selectedBody;
    if (data.milestones) fresh.milestones = { ...data.milestones };
    if (Array.isArray(data.log)) fresh.log = data.log.slice(-80);
    if (Array.isArray(data.recruits)) fresh.recruits = data.recruits;
    if (data.lastRecruitRoll) fresh.lastRecruitRoll = data.lastRecruitRoll;
    Object.assign(state, fresh);
  }

  function snapshot() {
    return JSON.parse(JSON.stringify(state));
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }

  function tick() {
    applyProduction();
    updateMission();
    applyMilestones();
    render();
    save();
  }

  function applyProduction() {
    const r = state.resources;
    const rates = { signal: 0, research: 0, metal: 0, organics: 0, fuel: 0, power: 0, food: 0, morale: 0 };

    Object.entries(state.buildings).forEach(([id, level]) => {
      const def = BUILDINGS.find((b) => b.id === id);
      if (!def) return;
      const prodMult = workerMultFor(def.id) * moraleMult();
      rates.signal += (def.prod.signal || 0) * level;
      rates.metal += (def.prod.metal || 0) * level * prodMult;
      rates.organics += (def.prod.organics || 0) * level * prodMult;
      rates.fuel += (def.prod.fuel || 0) * level * prodMult;
      rates.power += (def.prod.power || 0) * level;
      rates.food += (def.prod.food || 0) * level * prodMult;
      rates.morale += (def.prod.morale || 0) * level;
      // consumption as negative
      rates.power -= (def.cons.power || 0) * level;
      rates.fuel -= (def.cons.fuel || 0) * level;
    });

    // tech passive
    if (state.tech.fuel_synth) rates.fuel += 1 * state.tech.fuel_synth;
    if (state.tech.deep_scan) rates.research += 1 * state.tech.deep_scan;

    // apply rates per tick
    Object.keys(rates).forEach((key) => {
      r[key] = Math.max(0, r[key] + rates[key]);
    });

    state.rates = rates;

    // upkeep: food per worker
    const upkeepFood = state.workers.total * 0.2;
    r.food = Math.max(0, r.food - upkeepFood);

    // satisfaction
    const foodOk = r.food >= state.workers.total * 0.5;
    const powerOk = r.power >= 0;
    state.workers.satisfaction = clamp((foodOk ? 1 : 0.6) * (powerOk ? 1 : 0.8) + state.rates.morale, 0.4, 1.2);
  }

  function updateMission() {
    const m = state.missions.active;
    if (!m) return;
    if (Date.now() < m.endsAt) return;
    const body = BODIES.find((b) => b.id === m.bodyId);
    if (!body) {
      state.missions.active = null;
      return;
    }
    const cargo = calcMissionYield(body);
    Object.entries(cargo).forEach(([k, v]) => {
      state.resources[k] = Math.max(0, state.resources[k] + v);
    });
    log(`Mission from ${body.name} returned cargo.`);
    state.missions.active = null;
  }

  function collectSignal() {
    state.resources.signal += 1;
    log("Manual signal calibration.");
    render();
    save();
  }

  function pulseScan() {
    const cost = 25;
    if (state.resources.signal < cost) {
      toast("Not enough signal for a pulse scan.");
      return;
    }
    state.resources.signal -= cost;
    const rewardPool = ["metal", "fuel", "research"];
    const type = rewardPool[Math.floor(Math.random() * rewardPool.length)];
    const amount = type === "research" ? 6 : 20;
    state.resources[type] += amount;
    log(`Pulse scan recovered ${formatNumber(amount)} ${type}.`);
    render();
    save();
  }

  function startMission() {
    const target = state.selectedBody;
    const body = BODIES.find((b) => b.id === target && unlocked(b));
    if (!body) {
      toast("Target not unlocked.");
      return;
    }
    if (state.missions.active) {
      toast("Mission already active.");
      return;
    }
    let fuelCost = Math.max(5, Math.floor(body.travel / 3));
    if (!state.milestones.firstLaunch) fuelCost = 0;
    if (state.resources.fuel < fuelCost) {
      toast("Not enough fuel.");
      return;
    }
    state.resources.fuel -= fuelCost;
    const duration = body.travel * 1000;
    state.missions.active = { bodyId: body.id, endsAt: Date.now() + duration };
    log(`Launched mission to ${body.name}. ETA ${formatDuration(duration)}.`);
    if (!state.milestones.firstLaunch) state.milestones.firstLaunch = true;
    render();
  }

  function exportProfile() {
    const json = JSON.stringify(snapshot());
    if (ui.profileOutput) {
      ui.profileOutput.value = json;
      ui.profileOutput.focus();
      ui.profileOutput.select();
    }
    if (navigator.clipboard) navigator.clipboard.writeText(json).catch(() => {});
    toast("Profile exported to text.");
  }

  function importProfile() {
    if (!ui.profileOutput) return;
    const raw = ui.profileOutput.value.trim();
    if (!raw) {
      toast("Paste a profile JSON first.");
      return;
    }
    try {
      const data = JSON.parse(raw);
      applyState(data);
      render();
      save();
      toast("Profile imported.");
    } catch (err) {
      toast("Invalid profile JSON.");
    }
  }

  function calcMissionYield(body) {
    const base = body.resources;
    const hazardGear = state.tech.hazard_gear ? 0.25 : 0;
    const shield = state.tech.shielding ? 0.15 : 0;
    const drone = state.tech.drone_log ? 0.2 : 0;
    const hazardFail = Math.random() < Math.max(0, body.hazard - hazardGear - shield);
    if (hazardFail) {
      log(`Hazard on ${body.name} reduced cargo.`);
      return multiplyResources(base, 0.4);
    }
    const rareBonus = state.tech.rift_mapping ? 0.2 : 0;
    return multiplyResources(base, 1 + drone + rareBonus);
  }

  function render() {
    renderResources();
    renderHub();
    renderStarterGuide();
    renderBodies();
    renderMissions();
    renderBuildings();
    renderRates();
    renderCrew();
    renderTech();
    renderControls();
    renderLog();
  }

  function renderResources() {
    const r = state.resources;
    const entries = [
      { label: "Signal", val: r.signal },
      { label: "Research", val: r.research },
      { label: "Metal", val: r.metal },
      { label: "Organics", val: r.organics },
      { label: "Fuel", val: r.fuel },
      { label: "Power", val: r.power },
      { label: "Food", val: r.food },
      { label: "Habitat", val: r.habitat },
      { label: "Morale", val: r.morale }
    ];
    ui.resourceStats.innerHTML = entries
      .map((e) => `<div class="statBox"><span>${e.label}</span><strong>${formatNumber(e.val)}</strong></div>`)
      .join("");
    ui.satisfaction.textContent = `Satisfaction ${Math.round(state.workers.satisfaction * 100)}%`;
  }

  function renderHub() {
    if (!ui.hubStatus) return;
    const r = state.resources;
    const upkeepFood = state.workers.total * 0.2;
    const mission = state.missions.active;
    const body = mission ? BODIES.find((b) => b.id === mission.bodyId) : null;
    const remaining = mission ? Math.max(0, mission.endsAt - Date.now()) : 0;
    const lines = [
      { title: "Power balance", meta: `${formatNumber(state.rates.power)}/tick | Stored ${formatNumber(r.power)}` },
      { title: "Food & upkeep", meta: `${formatNumber(r.food)} stored | Upkeep ${formatNumber(upkeepFood)} per tick` },
      { title: "Crew & habitat", meta: `${state.workers.total} crew | Habitat ${formatNumber(r.habitat)}` },
      { title: "Morale", meta: `${Math.round(state.workers.satisfaction * 100)}% satisfaction | Needs food + power` },
      { title: "Research", meta: `Recovered from missions, milestones, and deep scans | ${formatNumber(r.research)} stored` },
      { title: "Signal flow", meta: `${formatNumber(state.rates.signal)}/tick plus manual collection` },
      { title: "Mission ops", meta: mission ? `En route to ${body?.name || "target"} | ${formatDuration(remaining)}` : "No active mission" }
    ];
    ui.hubStatus.innerHTML = lines
      .map((l) => `<div class="rowItem"><div class="rowDetails"><div class="rowTitle">${l.title}</div><div class="rowMeta">${l.meta}</div></div></div>`)
      .join("");
  }

  function renderStarterGuide() {
    if (!ui.starterGuide) return;
    const steps = [
      "1) Tap Collect Signal to unlock the Debris Field. Your first mission is fuel-free and brings back metal, fuel, and early research.",
      "2) Build a Reactor and Extractor to stabilize power and metal. Add Hydroponics to keep food positive.",
      "3) Research Fuel Synthesis once you have 320 signal and 12 research. Research comes from missions and milestones.",
      "4) Recruit a specialist crew when you have spare habitat and food to boost production roles."
    ];
    ui.starterGuide.innerHTML = steps
      .map((s) => `<div class="rowItem"><div class="rowDetails"><div class="rowTitle">${s}</div></div></div>`)
      .join("");
  }

  function renderBodies() {
    ui.bodyList.innerHTML = BODIES.map((b) => {
      const locked = !unlocked(b);
      const eta = formatDuration(b.travel * 1000);
      return `<div class="rowItem">
        <div class="rowDetails">
          <div class="rowTitle">${b.name} ${locked ? "<span class='tag'>Locked</span>" : ""}</div>
          <div class="rowMeta">${b.type} | Travel ${eta} | Hazard ${(b.hazard * 100).toFixed(0)}%</div>
        </div>
        <button class="btn" data-body="${b.id}" ${locked ? "disabled" : ""} onclick="window.selectBody && window.selectBody('${b.id}')">Select</button>
      </div>`;
    }).join("");
    if (ui.missionTarget) {
      ui.missionTarget.innerHTML = BODIES.filter(unlocked)
        .map((b) => `<option value="${b.id}">${b.name}</option>`)
        .join("");
      ui.missionTarget.value = state.selectedBody;
    }
    window.selectBody = (id) => {
      state.selectedBody = id;
      renderMissions();
    };
  }

  function renderMissions() {
    const m = state.missions.active;
    if (!m) {
      ui.missionStatus.textContent = "No active mission.";
      ui.missionPreview.innerHTML = bodyPreview(state.selectedBody);
      return;
    }
    const body = BODIES.find((b) => b.id === m.bodyId);
    const remaining = Math.max(0, m.endsAt - Date.now());
    ui.missionStatus.textContent = `En route to ${body.name} | ${formatDuration(remaining)}`;
    ui.missionPreview.innerHTML = bodyPreview(m.bodyId);
  }

  function bodyPreview(id) {
    const body = BODIES.find((b) => b.id === id);
    if (!body) return "";
    return `<div class="status">Expected cargo: ${Object.entries(body.resources)
      .map(([k, v]) => `${formatNumber(v)} ${k}`)
      .join(", ")}</div>`;
  }

  function renderBuildings() {
    ui.buildingList.innerHTML = BUILDINGS.filter(unlocked).map((b) => {
      const level = state.buildings[b.id] || 0;
      const can = canAfford(b.cost);
      return `<div class="rowItem">
        <div class="rowDetails">
          <div class="rowTitle">${b.name} <span class="tag">Lv ${level}</span></div>
          <div class="rowMeta">${b.desc}</div>
        </div>
        <button class="btn" ${can ? "" : "disabled"} onclick="window.build('${b.id}')">Build (${costText(b.cost)})</button>
      </div>`;
    }).join("");
    window.build = (id) => build(id);
  }

  function renderRates() {
    const rates = state.rates;
    ui.rateList.innerHTML = Object.entries(rates)
      .map(([k, v]) => `<div class="rowItem"><div class="rowDetails"><div class="rowTitle">${k.charAt(0).toUpperCase() + k.slice(1)}</div><div class="rowMeta">${formatNumber(v)}/tick</div></div></div>`)
      .join("");
  }

  function renderCrew() {
    const w = state.workers;
    const unassigned = w.total - totalAssigned();
    ui.crewStatus.textContent = `Crew ${w.total} | Unassigned ${unassigned}`;
    ui.crewList.innerHTML = CREW_ROLES.map((role) => {
      const count = w.assigned[role.id] || 0;
      return `<div class="rowItem">
        <div class="rowDetails">
          <div class="rowTitle">${ROLE_ICON[role.id] || ""} ${role.name} (${count})</div>
          <div class="rowMeta">${role.desc}</div>
        </div>
        <div class="row">
          <button class="btn" onclick="window.changeCrew && window.changeCrew('${role.id}', -1)" ${count <= 0 ? "disabled" : ""}>-</button>
          <button class="btn" onclick="window.changeCrew && window.changeCrew('${role.id}', 1)" ${unassigned <= 0 ? "disabled" : ""}>+</button>
          <button class="btn" onclick="window.recruitCrew && window.recruitCrew('${role.id}')">Recruit</button>
        </div>
      </div>`;
    }).join("");
    ui.needStatus.textContent = `Morale ${Math.round(state.workers.satisfaction * 100)}% | Upkeep food ${formatNumber(w.total * 0.2)} | Habitat ${formatNumber(state.resources.habitat)}`;
    ui.needList.innerHTML = `<div class="rowItem"><div class="rowDetails"><div class="rowTitle">How to grow crew</div><div class="rowMeta">Gain early volunteers after building 3 structures. Recruit specialists when you have spare habitat and food.</div></div></div>`;
    renderRecruits();
    window.changeCrew = changeCrew;
    window.recruitCrew = recruitCrew;
  }

  function rollRecruits(force) {
    const now = Date.now();
    if (!force && now - state.lastRecruitRoll < RECRUIT_COOLDOWN && state.recruits.length) return;
    if (force && now - state.lastRecruitRoll < RECRUIT_COOLDOWN) {
      toast("Recruitment hub is still sourcing candidates.");
      return;
    }
    const candidates = Array.from({ length: 3 }, (_, i) => makeCandidate(i));
    state.recruits = candidates;
    state.lastRecruitRoll = now;
    renderRecruits();
    save();
  }

  function makeCandidate(seed) {
    const role = CREW_ROLES[Math.floor(Math.random() * CREW_ROLES.length)];
    const tier = 1 + (seed % 3);
    const bonus = tier === 1 ? 0.05 : tier === 2 ? 0.12 : 0.2;
    const names = ["Nyx", "Orion", "Vega", "Rin", "Tala", "Kade", "Mira", "Ash"];
    const name = names[Math.floor(Math.random() * names.length)];
    return {
      id: `${Date.now()}-${seed}-${Math.random().toString(16).slice(2, 6)}`,
      name,
      role: role.id,
      roleLabel: role.name,
      trait: `+${Math.round(bonus * 100)}% to ${role.name} output`,
      bonus,
      cost: { food: 4 * tier, metal: 12 * tier }
    };
  }

  function hireRecruit(id) {
    const cand = (state.recruits || []).find((c) => c.id === id);
    if (!cand) return;
    if (state.resources.habitat <= state.workers.total) {
      toast("Need spare habitat to house new crew.");
      return;
    }
    if (!canAfford(cand.cost)) {
      toast("Not enough resources to hire.");
      return;
    }
    spend(cand.cost);
    state.workers.total += 1;
    state.workers.assigned[cand.role] = (state.workers.assigned[cand.role] || 0) + 1;
    state.workers.bonus[cand.role] = (state.workers.bonus[cand.role] || 0) + (cand.bonus || 0);
    log(`Hired ${cand.roleLabel}.`);
    state.recruits = state.recruits.filter((c) => c.id !== id);
    render();
    save();
  }

  function renderRecruits() {
    if (!ui.recruitList || !ui.recruitCooldown) return;
    const now = Date.now();
    const readyIn = Math.max(0, state.lastRecruitRoll + RECRUIT_COOLDOWN - now);
    ui.recruitCooldown.textContent = readyIn > 0 ? `New candidates in ${formatDuration(readyIn)}` : "Candidates refreshed";
    ui.recruitList.innerHTML = (state.recruits || []).map((c) => {
      return `<div class="rowItem">
        <div class="rowDetails">
          <div class="rowTitle">${ROLE_ICON[c.role] || ""} ${c.name} (${c.roleLabel})</div>
          <div class="rowMeta">Bonus: ${c.trait} | Cost ${costText(c.cost)}</div>
        </div>
        <button class="btn" ${canAfford(c.cost) && state.resources.habitat > state.workers.total ? "" : "disabled"} onclick="window.hire && window.hire('${c.id}')">Hire</button>
      </div>`;
    }).join("");
    window.hire = hireRecruit;
  }

  function renderTech() {
    ui.techList.innerHTML = TECH.map((t) => {
      const visible = state.resources.signal >= t.unlock;
      if (!visible) return "";
      const owned = state.tech[t.id] || 0;
      const can = canAfford(t.cost) && owned === 0;
      return `<div class="rowItem">
        <div class="rowDetails">
          <div class="rowTitle">${t.name} ${owned ? "<span class='tag'>Owned</span>" : ""}</div>
          <div class="rowMeta">${t.desc}</div>
        </div>
        <button class="btn" ${can ? "" : "disabled"} onclick="window.buyTech('${t.id}')">Research (${costText(t.cost)})</button>
      </div>`;
    }).join("");
    window.buyTech = (id) => buyTech(id);
  }

  function renderControls() {
    if (!ui.controlsList) return;
    ui.controlsList.innerHTML = SHORTCUTS.map((s) => {
      return `<div class="rowItem"><div class="rowDetails"><div class="rowTitle">${s.keys}</div><div class="rowMeta">${s.action}</div></div></div>`;
    }).join("");
  }

  function renderLog() {
    const entries = state.log.slice(-12).reverse();
    ui.logList.innerHTML = entries
      .map((e) => `<div class="rowItem"><div class="rowDetails"><div class="rowTitle">${e.text}</div><div class="rowMeta">${new Date(e.time).toLocaleTimeString()}</div></div></div>`)
      .join("");
  }

  function changeCrew(roleId, delta) {
    const w = state.workers;
    const current = w.assigned[roleId] || 0;
    const target = current + delta;
    if (target < 0) return;
    const afterTotal = totalAssigned() + delta;
    if (afterTotal > w.total) {
      toast("No unassigned crew available.");
      return;
    }
    w.assigned[roleId] = target;
    log(`Adjusted ${roleId} crew to ${target}.`);
    render();
    save();
  }

  function recruitCrew(roleId) {
    const w = state.workers;
    const r = state.resources;
    if (r.habitat <= w.total) {
      toast("Build habitat first.");
      return;
    }
    const foodCost = 5;
    if (r.food < foodCost) {
      toast("Need more food to sustain crew.");
      return;
    }
    r.food -= foodCost;
    w.total += 1;
    w.assigned[roleId] = (w.assigned[roleId] || 0) + 1;
    log(`Recruited a ${roleId}.`);
    render();
    save();
  }

  function totalAssigned() {
    return Object.values(state.workers.assigned).reduce((a, b) => a + (b || 0), 0);
  }

  function build(id) {
    const def = BUILDINGS.find((b) => b.id === id);
    if (!def || !unlocked(def)) return;
    if (!canAfford(def.cost)) {
      toast("Not enough resources.");
      return;
    }
    spend(def.cost);
    state.buildings[id] = (state.buildings[id] || 0) + 1;
    if (def.prod.habitat) state.resources.habitat += def.prod.habitat;
    log(`Constructed ${def.name}.`);
    render();
    save();
  }

  function buyTech(id) {
    const def = TECH.find((t) => t.id === id);
    if (!def) return;
    if (state.tech[id]) return;
    if (!canAfford(def.cost)) {
      toast("Not enough resources.");
      return;
    }
    spend(def.cost);
    state.tech[id] = 1;
    if (id === "deep_scan") {
      state.rates.research += 1;
      log("Deep scan arrays online; new targets detected.");
    }
    log(`Tech unlocked: ${def.name}.`);
    render();
    save();
  }

  function canAfford(cost) {
    return Object.entries(cost).every(([k, v]) => state.resources[k] >= v);
  }

  function spend(cost) {
    Object.entries(cost).forEach(([k, v]) => {
      state.resources[k] -= v;
    });
  }

  function unlocked(obj) {
    if (obj.requireTech && !state.tech[obj.requireTech]) return false;
    return state.resources.signal >= (obj.unlock || 0);
  }

  function multiplyResources(base, mult) {
    const out = {};
    Object.entries(base).forEach(([k, v]) => (out[k] = Math.floor(v * mult)));
    return out;
  }

  function workerMultFor(buildingId) {
    const b = state.workers.bonus || {};
    if (buildingId === "extractor") return 1 + (state.workers.assigned.miner || 0) * 0.1 + (b.miner || 0);
    if (buildingId === "hydro") return 1 + (state.workers.assigned.botanist || 0) * 0.1 + (b.botanist || 0);
    return 1 + (state.workers.assigned.engineer || 0) * 0.05 + (b.engineer || 0);
  }

  function moraleMult() {
    return clamp(state.workers.satisfaction, 0.6, 1.4);
  }

  function applyMilestones() {
    if (state.resources.signal >= 300 && !state.milestones.firstResearch) {
      state.resources.research += 20;
      state.milestones.firstResearch = true;
      log("Research packets recovered from deep space.");
    }
    if (state.resources.signal >= 50 && !state.milestones.bootCache) {
      state.resources.research += 6;
      state.resources.fuel += 6;
      state.milestones.bootCache = true;
      log("Recovered starter cache: research + fuel.");
    }
    if (Object.keys(state.buildings).length >= 3 && !state.milestones.crewBonus) {
      state.workers.total += 2;
      state.milestones.crewBonus = true;
      log("New volunteers arrived at the hub.");
    }
  }

  function log(text) {
    state.log.push({ time: Date.now(), text });
    if (state.log.length > 80) state.log.shift();
  }

  function toast(msg) {
    if (!ui.toast) return;
    ui.toast.textContent = msg;
    ui.toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ui.toast.classList.remove("show"), 1800);
  }

  function costText(cost) {
    return Object.entries(cost)
      .map(([k, v]) => `${formatNumber(v)} ${k}`)
      .join(", ");
  }

  function formatNumber(val) {
    if (!Number.isFinite(val)) return "0";
    const abs = Math.abs(val);
    if (abs < 10) return val.toFixed(1);
    if (abs < 1000) return val.toFixed(0);
    const units = ["K", "M", "B", "T"]; let u = -1; let n = abs;
    while (n >= 1000 && u < units.length - 1) { n /= 1000; u++; }
    return `${val < 0 ? "-" : ""}${n.toFixed(n < 10 ? 2 : 1)}${units[u]}`;
  }

  function formatDuration(ms) {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
  }
})();

