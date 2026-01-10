(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  const TICK_MS = 500;
  const STORAGE_KEY = "signalFrontierState";

  const BODIES = [
    { id: "debris", name: "Debris Field", type: "Asteroid Belt", unlock: 0, travel: 30, hazard: 0.05, resources: { metal: 40, fuel: 8 } },
    { id: "ice", name: "Ice Moon", type: "Frozen Moon", unlock: 500, travel: 60, hazard: 0.12, resources: { organics: 25, fuel: 12 } },
    { id: "lava", name: "Lava Rock", type: "Volcanic Planetoid", unlock: 1500, travel: 90, hazard: 0.2, resources: { metal: 70, rare: 4 } }
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
    { id: "fuel_synth", name: "Fuel Synthesis", desc: "+1 fuel/tick", cost: { signal: 600, research: 40 }, unlock: 500 },
    { id: "hazard_gear", name: "Hazard Gear", desc: "-25% mission hazard", cost: { signal: 900, research: 60 }, unlock: 900 },
    { id: "drone_log", name: "Logistics Drones", desc: "+20% mission cargo", cost: { signal: 1200, research: 80 }, unlock: 1200 }
  ];

  const state = {
    resources: {
      signal: 0,
      research: 0,
      metal: 0,
      organics: 0,
      fuel: 0,
      power: 0,
      food: 0,
      habitat: 0,
      morale: 0,
      rare: 0
    },
    rates: { signal: 0, research: 0, metal: 0, organics: 0, fuel: 0, power: 0, food: 0, morale: 0 },
    workers: { total: 3, assigned: { miner: 1, botanist: 1, engineer: 1 }, satisfaction: 1 },
    buildings: {},
    tech: {},
    missions: { active: null },
    selectedBody: "debris",
    milestones: {},
    log: []
  };

  const ui = {};
  let toastTimer = null;
  let tickTimer = null;

  window.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheUi();
    bindUi();
    load();
    render();
    tickTimer = setInterval(tick, TICK_MS);
  }

  function cacheUi() {
    ui.tabs = $$(".tab");
    ui.panels = $$(".panel");
    ui.resourceStats = $("#resourceStats");
    ui.bodyList = $("#bodyList");
    ui.collectSignal = $("#collectSignal");
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
  }

  function bindUi() {
    ui.tabs.forEach((tab) => {
      tab.addEventListener("click", () => setTab(tab.dataset.tab));
    });
    if (ui.collectSignal) ui.collectSignal.addEventListener("click", collectSignal);
    if (ui.launchMission) ui.launchMission.addEventListener("click", startMission);
    if (ui.missionTarget) ui.missionTarget.addEventListener("change", (e) => (state.selectedBody = e.target.value));
  }

  function setTab(tab) {
    ui.tabs.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tab));
    ui.panels.forEach((panel) => panel.classList.toggle("hidden", panel.dataset.panel !== tab));
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      Object.assign(state, data);
    } catch {}
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
    state.resources.signal += 5;
    log("Manual signal calibration.");
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
    const fuelCost = Math.max(5, Math.floor(body.travel / 3));
    if (state.resources.fuel < fuelCost) {
      toast("Not enough fuel.");
      return;
    }
    state.resources.fuel -= fuelCost;
    const duration = body.travel * 1000;
    state.missions.active = { bodyId: body.id, endsAt: Date.now() + duration };
    log(`Launched mission to ${body.name}. ETA ${formatDuration(duration)}.`);
    render();
  }

  function calcMissionYield(body) {
    const base = body.resources;
    const hazardGear = state.tech.hazard_gear ? 0.25 : 0;
    const drone = state.tech.drone_log ? 0.2 : 0;
    const hazardFail = Math.random() < Math.max(0, body.hazard - hazardGear);
    if (hazardFail) {
      log(`Hazard on ${body.name} reduced cargo.`);
      return multiplyResources(base, 0.4);
    }
    return multiplyResources(base, 1 + drone);
  }

  function render() {
    renderResources();
    renderBodies();
    renderMissions();
    renderBuildings();
    renderRates();
    renderCrew();
    renderTech();
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

  function renderBodies() {
    ui.bodyList.innerHTML = BODIES.map((b) => {
      const locked = !unlocked(b);
      const eta = formatDuration(b.travel * 1000);
      return `<div class="rowItem">
        <div class="rowDetails">
          <div class="rowTitle">${b.name} ${locked ? "<span class='tag'>Locked</span>" : ""}</div>
          <div class="rowMeta">${b.type} • Travel ${eta} • Hazard ${(b.hazard * 100).toFixed(0)}%</div>
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
    ui.missionStatus.textContent = `En route to ${body.name} • ${formatDuration(remaining)}`;
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
      .map(([k, v]) => `<div class="rowItem"><div class="rowDetails"><div class="rowTitle">${k}</div><div class="rowMeta">${formatNumber(v)}/tick</div></div></div>`)
      .join("");
  }

  function renderCrew() {
    const w = state.workers;
    ui.crewStatus.textContent = `Crew ${w.total} | Miner ${w.assigned.miner} • Botanist ${w.assigned.botanist} • Engineer ${w.assigned.engineer}`;
    ui.crewList.innerHTML = "";
    ui.needStatus.textContent = `Morale ${Math.round(state.workers.satisfaction * 100)}% | Upkeep food ${formatNumber(w.total * 0.2)}`;
    ui.needList.innerHTML = "";
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

  function renderLog() {
    const entries = state.log.slice(-12).reverse();
    ui.logList.innerHTML = entries
      .map((e) => `<div class="rowItem"><div class="rowDetails"><div class="rowTitle">${e.text}</div><div class="rowMeta">${new Date(e.time).toLocaleTimeString()}</div></div></div>`)
      .join("");
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
    return state.resources.signal >= (obj.unlock || 0);
  }

  function multiplyResources(base, mult) {
    const out = {};
    Object.entries(base).forEach(([k, v]) => (out[k] = Math.floor(v * mult)));
    return out;
  }

  function workerMultFor(buildingId) {
    if (buildingId === "extractor") return 1 + (state.workers.assigned.miner || 0) * 0.1;
    if (buildingId === "hydro") return 1 + (state.workers.assigned.botanist || 0) * 0.1;
    return 1 + (state.workers.assigned.engineer || 0) * 0.05;
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
