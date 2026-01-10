
import { useEffect, useMemo, useReducer, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";

const STORAGE_KEY = "signalFrontierReact";
const TICK_MS = 500;
const TAB_ORDER = ["hub", "missions", "bases", "crew", "tech", "log"];

const BODIES = [
  { id: "debris", name: "Debris Field", type: "asteroid", travel: 30, hazard: 0.05, unlock: 0, resources: { metal: 40, fuel: 10, research: 8 } },
  { id: "ice", name: "Ice Moon", type: "ice", travel: 60, hazard: 0.12, unlock: 400, resources: { organics: 30, fuel: 16, research: 12 } },
  { id: "lava", name: "Lava Rock", type: "warm", travel: 90, hazard: 0.2, unlock: 1200, resources: { metal: 80, rare: 6, research: 20 } },
  { id: "cradle", name: "Cradle Station", type: "asteroid", travel: 120, hazard: 0.18, unlock: 2400, requireTech: "deep_scan", resources: { fuel: 30, research: 36, rare: 10 } },
  { id: "ruins", name: "Fallen Relay", type: "warm", travel: 140, hazard: 0.22, unlock: 3800, requireTech: "shielding", resources: { metal: 120, research: 48, rare: 14 } },
  { id: "rift", name: "Rift Beacon", type: "unknown", travel: 180, hazard: 0.3, unlock: 6200, requireTech: "rift_mapping", resources: { fuel: 50, research: 80, rare: 24 } },
];

const HUB_UPGRADES = [
  { id: "launch_bay", name: "Launch Bay", desc: "+1 concurrent mission slot", cost: { metal: 80, fuel: 20 } },
  { id: "fuel_farm", name: "Fuel Farm", desc: "+2 fuel/tick", cost: { metal: 120, organics: 30 } },
  { id: "scan_array", name: "Scan Array", desc: "+3 signal/tick", cost: { metal: 140, fuel: 10 } },
  { id: "drone_bay", name: "Drone Bay", desc: "+10% mission cargo", cost: { metal: 160, rare: 6 } },
];

const HUB_BUILDINGS = [
  { id: "reactor", name: "Reactor", desc: "+4 power/tick, -1 fuel", cost: { metal: 100, fuel: 25 }, prod: { power: 4 }, cons: { fuel: 1 } },
  { id: "hab", name: "Hab Module", desc: "+4 habitat", cost: { metal: 80, organics: 20 }, prod: { habitat: 4 }, cons: {} },
  { id: "rec", name: "Rec Dome", desc: "Boosts morale", cost: { metal: 60, organics: 40 }, prod: { morale: 0.03 }, cons: { power: 1 } },
  { id: "array", name: "Comms Array", desc: "+4 signal/tick", cost: { metal: 120, fuel: 10 }, prod: { signal: 4 }, cons: { power: 1 } },
];
const BIOME_BUILDINGS = {
  asteroid: [
    { id: "ore_rig", name: "Ore Rig", desc: "+4 metal/tick", cost: { metal: 80 }, prod: { metal: 4 }, cons: { power: 1 } },
    { id: "solar_sail", name: "Solar Sail", desc: "+2 power/tick", cost: { metal: 40 }, prod: { power: 2 }, cons: {} },
  ],
  ice: [
    { id: "thermal_pump", name: "Thermal Pump", desc: "+3 fuel/tick", cost: { metal: 70, fuel: 10 }, prod: { fuel: 3 }, cons: { power: 1 } },
    { id: "algae_farm", name: "Algae Farm", desc: "+3 food/tick", cost: { metal: 50, organics: 25 }, prod: { food: 3 }, cons: { power: 1 } },
  ],
  warm: [
    { id: "shield_dome", name: "Shield Dome", desc: "-20% hazard on missions from this base", cost: { metal: 90, fuel: 12 }, prod: {}, cons: { power: 1 } },
    { id: "vapor_trap", name: "Vapor Trap", desc: "+2 organics/tick", cost: { metal: 60, fuel: 8 }, prod: { organics: 2 }, cons: {} },
  ],
  unknown: [
    { id: "anomaly_lab", name: "Anomaly Lab", desc: "+1 rare/tick", cost: { metal: 110, rare: 4 }, prod: { rare: 1 }, cons: { power: 1 } },
  ],
};

const TECH = [
  { id: "fuel_synth", name: "Fuel Synthesis", desc: "+1 fuel/tick", cost: { signal: 320, research: 12 }, unlock: 300 },
  { id: "hazard_gear", name: "Hazard Gear", desc: "-25% mission hazard", cost: { signal: 780, research: 30 }, unlock: 700 },
  { id: "drone_log", name: "Logistics Drones", desc: "+20% mission cargo", cost: { signal: 1200, research: 60 }, unlock: 1200 },
  { id: "deep_scan", name: "Deep Scan Arrays", desc: "+1 research/tick and reveals deep targets", cost: { signal: 1500, research: 120 }, unlock: 1200 },
  { id: "shielding", name: "Thermal Shielding", desc: "-40% hazard on hot zones; unlocks fallen relay", cost: { signal: 2100, research: 180 }, unlock: 2000 },
  { id: "rift_mapping", name: "Rift Mapping", desc: "Unlocks anomalous missions and +20% rare cargo", cost: { signal: 3600, research: 260, rare: 8 }, unlock: 3500 },
];

const STARTER_TOUR = [
  { title: "Signal & Scans", body: "Collect Signal (Space) to reveal nearby targets. Pulse Scans convert signal into random loot.", anchor: "hub" },
  { title: "Hub Status", body: "Power, food, habitat, and morale drive sustainability. Keep power = 0 and food above upkeep.", anchor: "hub" },
  { title: "Missions", body: "Launch expeditions based on biome hazards. Fuel spend scales with distance.", anchor: "missions" },
  { title: "Bases", body: "Each biome unlocks unique structures and events. Build per-body upgrades on-site.", anchor: "bases" },
  { title: "Crew & Recruits", body: "Hire specialists with role bonuses. Assign crew to boost production.", anchor: "crew" },
];

const initialState = {
  tab: "hub",
  resources: { signal: 0, research: 2, metal: 0, organics: 0, fuel: 12, power: 0, food: 0, habitat: 0, morale: 0, rare: 0 },
  rates: { signal: 0, research: 0, metal: 0, organics: 0, fuel: 0, power: 0, food: 0, morale: 0 },
  workers: { total: 3, assigned: { miner: 1, botanist: 1, engineer: 1 }, bonus: { miner: 0, botanist: 0, engineer: 0 }, satisfaction: 1 },
  hubBuildings: {},
  hubUpgrades: {},
  bases: {},
  tech: {},
  missions: { active: [] },
  selectedBody: "debris",
  recruits: [],
  lastRecruitRoll: 0,
  log: [],
  milestones: {},
  tourStep: 0,
  tourSeen: false,
};

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function reducer(state, action) {
  switch (action.type) {
    case "LOAD":
      return { ...state, ...action.payload };
    case "SET_TAB":
      return { ...state, tab: action.tab };
    case "SET_SELECTED_BODY":
      return { ...state, selectedBody: action.id };
    case "LOG":
      return { ...state, log: [...state.log.slice(-50), { text: action.text, time: Date.now() }] };
    case "SET_RECRUITS":
      return { ...state, recruits: action.recruits, lastRecruitRoll: Date.now() };
    case "UPDATE":
      return { ...state, ...action.patch };
    case "TOUR_STEP":
      return { ...state, tourStep: action.step, tourSeen: action.seen ?? state.tourSeen };
    default:
      return state;
  }
}
export default function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [tick, setTick] = useState(0);
  const currentBase = useMemo(() => state.bases[state.selectedBody] || { buildings: {}, events: [] }, [state.bases, state.selectedBody]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { dispatch({ type: "LOAD", payload: { ...initialState, ...JSON.parse(raw) } }); } catch (e) { console.warn("Failed to load state", e); }
    }
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [state]);

  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), TICK_MS); return () => clearInterval(id); }, []);
  useEffect(() => { applyProduction(); resolveMissions(); }, [tick]);

  useEffect(() => {
    const onKey = (e) => {
      if (["INPUT","TEXTAREA"].includes(e.target.tagName) || e.target.isContentEditable) return;
      if (e.code === "Space" || e.key === " ") { e.preventDefault(); collectSignal(); }
      else if (e.code.startsWith("Digit")) { const idx = Number(e.key) - 1; if (idx >= 0 && idx < TAB_ORDER.length) dispatch({ type: "SET_TAB", tab: TAB_ORDER[idx] }); }
      else if (e.code === "ArrowRight") cycleTab(1);
      else if (e.code === "ArrowLeft") cycleTab(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function cycleTab(delta) { const idx = TAB_ORDER.indexOf(state.tab); const next = (idx + delta + TAB_ORDER.length) % TAB_ORDER.length; dispatch({ type: "SET_TAB", tab: TAB_ORDER[next] }); }

  function collectSignal() { bumpResources({ signal: 1 }); log("Manual signal calibration."); }

  function pulseScan() {
    const cost = 25;
    if (state.resources.signal < cost) { log("Not enough signal for pulse scan."); return; }
    bumpResources({ signal: -cost });
    const rewardPool = ["metal","fuel","research"];
    const type = rewardPool[Math.floor(Math.random() * rewardPool.length)];
    const amount = type === "research" ? 8 : 24;
    bumpResources({ [type]: amount });
    log(`Pulse scan recovered ${amount} ${type}.`);
  }

  function bumpResources(delta) {
    dispatch({ type: "UPDATE", patch: { resources: Object.keys(delta).reduce((acc, key) => { acc[key] = Math.max(0, (state.resources[key] || 0) + delta[key]); return acc; }, { ...state.resources }) } });
  }

  function log(text) { dispatch({ type: "LOG", text }); }

  function applyProduction() {
    const r = { ...state.resources };
    const rates = { signal: 0, research: 0, metal: 0, organics: 0, fuel: 0, power: 0, food: 0, morale: 0 };

    Object.entries(state.hubBuildings).forEach(([id, lvl]) => {
      const def = HUB_BUILDINGS.find((b) => b.id === id); if (!def) return; const mult = workerMult(def.id);
      for (const [k,v] of Object.entries(def.prod || {})) rates[k] += v * lvl * mult;
      for (const [k,v] of Object.entries(def.cons || {})) rates[k] -= v * lvl;
    });
    if (state.hubUpgrades.fuel_farm) rates.fuel += 2 * state.hubUpgrades.fuel_farm;
    if (state.hubUpgrades.scan_array) rates.signal += 3 * state.hubUpgrades.scan_array;
    if (state.tech.fuel_synth) rates.fuel += 1 * state.tech.fuel_synth;
    if (state.tech.deep_scan) rates.research += 1 * state.tech.deep_scan;

    Object.entries(currentBase.buildings || {}).forEach(([id, lvl]) => {
      const def = biomeBuildingById(id); if (!def) return;
      for (const [k,v] of Object.entries(def.prod || {})) rates[k] += v * lvl * workerMult(id);
      for (const [k,v] of Object.entries(def.cons || {})) rates[k] -= v * lvl;
    });

    Object.keys(rates).forEach((k) => { r[k] = Math.max(0, r[k] + rates[k]); });
    const foodUpkeep = state.workers.total * 0.2; r.food = Math.max(0, r.food - foodUpkeep);

    const foodOk = r.food >= state.workers.total * 0.5; const powerOk = r.power >= 0;
    const satisfaction = clamp((foodOk ? 1 : 0.6) * (powerOk ? 1 : 0.8) + (rates.morale || 0), 0.4, 1.2);

    dispatch({ type: "UPDATE", patch: { resources: r, rates, workers: { ...state.workers, satisfaction } } });
  }

  function workerMult(buildingId) {
    const bonus = state.workers.bonus || {};
    if (buildingId === "extractor" || buildingId === "ore_rig") return 1 + (state.workers.assigned.miner || 0) * 0.1 + (bonus.miner || 0);
    if (buildingId === "hydro" || buildingId === "algae_farm") return 1 + (state.workers.assigned.botanist || 0) * 0.1 + (bonus.botanist || 0);
    return 1 + (state.workers.assigned.engineer || 0) * 0.05 + (bonus.engineer || 0);
  }

  function resolveMissions() {
    const active = state.missions.active || [];
    if (!active.length) return;
    const now = Date.now(); const remaining = [];
    active.forEach((m) => {
      if (now < m.endsAt) { remaining.push(m); return; }
      const body = BODIES.find((b) => b.id === m.bodyId); if (!body) return;
      const cargo = missionYield(body); bumpResources(cargo); log(`Mission from ${body.name} returned with cargo.`);
    });
    dispatch({ type: "UPDATE", patch: { missions: { active: remaining } } });
  }

  function startMission(bodyId, fuelBoost = 0) {
    const body = BODIES.find((b) => b.id === bodyId && isUnlocked(b));
    if (!body) { log("Target locked."); return; }
    const slots = 1 + (state.hubUpgrades.launch_bay || 0);
    if ((state.missions.active || []).length >= slots) { log("All mission slots busy."); return; }
    let fuelCost = Math.max(5, Math.floor(body.travel / 3)) + fuelBoost;
    if (!state.milestones?.firstLaunch) fuelCost = 0;
    if (state.resources.fuel < fuelCost) { log("Not enough fuel."); return; }
    bumpResources({ fuel: -fuelCost });
    const hazard = body.hazard - (state.tech.hazard_gear ? 0.25 : 0) - (state.tech.shielding ? 0.2 : 0);
    const duration = Math.max(15000, (body.travel * 1000) - fuelBoost * 3000);
    const mission = { bodyId: body.id, endsAt: Date.now() + duration, hazard: Math.max(0, hazard) };
    dispatch({ type: "UPDATE", patch: { missions: { active: [...(state.missions.active || []), mission] } } });
    log(`Launched mission to ${body.name}. ETA ${formatDuration(duration)}.`);
    dispatch({ type: "UPDATE", patch: { milestones: { ...state.milestones, firstLaunch: true } } });
  }

  function missionYield(body) {
    const base = body.resources || {}; const drone = state.tech.drone_log ? 0.2 : 0; const rareBonus = state.tech.rift_mapping ? 0.2 : 0; const mult = 1 + drone + rareBonus;
    const cargo = {}; Object.entries(base).forEach(([k, v]) => (cargo[k] = Math.floor(v * mult))); return cargo;
  }

  function isUnlocked(body) { if (body.requireTech && !state.tech[body.requireTech]) return false; return state.resources.signal >= (body.unlock || 0); }

  function bodyEvents(body) {
    const tables = {
      asteroid: ["Micrometeor shower: minor hazard spike", "Ore cache detected: bonus metal", "Radiation pocket: power drain"],
      ice: ["Ice quake: structural stress", "Steam vent: bonus organics", "Coolant leak: fuel loss"],
      warm: ["Dust storm: hazard up", "Thermal updraft: faster travel", "Shield strain: morale down"],
      unknown: ["Anomalous echo: rare sample", "Temporal glitch: double cargo", "Spatial shear: risk spike"],
    };
    const events = tables[body.type] || tables.asteroid; return events.slice(0, 2 + Math.floor(Math.random() * 2));
  }

  function buildHub(id) {
    const def = HUB_BUILDINGS.find((b) => b.id === id); if (!def) return;
    if (!canAfford(def.cost)) { log("Not enough resources."); return; }
    spend(def.cost);
    dispatch({ type: "UPDATE", patch: { hubBuildings: { ...state.hubBuildings, [id]: (state.hubBuildings[id] || 0) + 1 } } });
    log(`Constructed ${def.name}.`);
  }

  function buyHubUpgrade(id) {
    const def = HUB_UPGRADES.find((u) => u.id === id); if (!def) return;
    if (!canAfford(def.cost)) { log("Not enough resources."); return; }
    spend(def.cost);
    dispatch({ type: "UPDATE", patch: { hubUpgrades: { ...state.hubUpgrades, [id]: (state.hubUpgrades[id] || 0) + 1 } } });
    log(`Upgraded ${def.name}.`);
  }

  function buildBase(id) {
    const def = biomeBuildingById(id); if (!def) return;
    if (!canAfford(def.cost)) { log("Not enough resources."); return; }
    spend(def.cost);
    const base = state.bases[state.selectedBody] || { buildings: {}, events: bodyEvents(selectedBody()) };
    const newBase = { ...base, buildings: { ...base.buildings, [id]: (base.buildings[id] || 0) + 1 } };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [state.selectedBody]: newBase } } });
    log(`Built ${def.name} on ${selectedBody().name}.`);
  }

  function selectedBody() { return BODIES.find((b) => b.id === state.selectedBody) || BODIES[0]; }

  function canAfford(cost) { return Object.entries(cost).every(([k, v]) => (state.resources[k] || 0) >= v); }

  function spend(cost) { const r = { ...state.resources }; Object.entries(cost).forEach(([k, v]) => { r[k] = Math.max(0, r[k] - v); }); dispatch({ type: "UPDATE", patch: { resources: r } }); }

  function buyTech(id) {
    const def = TECH.find((t) => t.id === id); if (!def || state.tech[id]) return;
    if (!canAfford(def.cost)) { log("Not enough resources."); return; }
    spend(def.cost); dispatch({ type: "UPDATE", patch: { tech: { ...state.tech, [id]: 1 } } });
    log(`Tech unlocked: ${def.name}.`);
  }

  function rollRecruits(force) {
    const now = Date.now();
    if (!force && now - state.lastRecruitRoll < 45000 && state.recruits.length) return;
    const candidates = Array.from({ length: 3 }, (_, i) => makeCandidate(i));
    dispatch({ type: "SET_RECRUITS", recruits: candidates });
  }

  function makeCandidate(seed) {
    const roles = ["miner","botanist","engineer"];
    const role = roles[Math.floor(Math.random() * roles.length)];
    const tier = 1 + (seed % 3);
    const bonus = tier === 1 ? 0.05 : tier === 2 ? 0.12 : 0.2;
    const names = ["Nyx","Orion","Vega","Rin","Tala","Kade","Mira","Ash"];
    const name = names[Math.floor(Math.random() * names.length)];
    return { id: `${Date.now()}-${seed}-${Math.random().toString(16).slice(2,6)}`, name, role, trait: `+${Math.round(bonus * 100)}% to ${role}`, bonus, cost: { food: 4 * tier, metal: 12 * tier } };
  }

  function hire(id) {
    const cand = state.recruits.find((c) => c.id === id); if (!cand) return;
    if (state.resources.habitat <= state.workers.total) { log("Need spare habitat to house new crew."); return; }
    if (!canAfford(cand.cost)) { log("Not enough resources to hire."); return; }
    spend(cand.cost);
    const workers = { ...state.workers, total: state.workers.total + 1, assigned: { ...state.workers.assigned, [cand.role]: (state.workers.assigned[cand.role] || 0) + 1 }, bonus: { ...state.workers.bonus, [cand.role]: (state.workers.bonus[cand.role] || 0) + cand.bonus } };
    const recruits = state.recruits.filter((c) => c.id !== id);
    dispatch({ type: "UPDATE", patch: { workers, recruits } });
    log(`Hired ${cand.name} (${cand.role}).`);
  }

  function changeCrew(role, delta) {
    const current = state.workers.assigned[role] || 0; const target = current + delta; if (target < 0) return;
    const totalAssigned = Object.values(state.workers.assigned).reduce((a, b) => a + b, 0); if (delta > 0 && totalAssigned >= state.workers.total) return;
    const assigned = { ...state.workers.assigned, [role]: target };
    dispatch({ type: "UPDATE", patch: { workers: { ...state.workers, assigned } } });
  }

  function format(n) {
    if (!Number.isFinite(n)) return "0";
    const abs = Math.abs(n); if (abs < 1000) return n.toFixed(0);
    const units = ["K","M","B","T"]; let u = -1; let val = abs;
    while (val >= 1000 && u < units.length - 1) { val /= 1000; u++; }
    return `${n < 0 ? "-" : ""}${val.toFixed(val < 10 ? 2 : 1)}${units[u]}`;
  }

  function formatDuration(ms) { const sec = Math.max(0, Math.ceil(ms / 1000)); const m = Math.floor(sec / 60); const s = sec % 60; return m > 0 ? `${m}m ${s}s` : `${s}s`; }
  function biomeBuildingById(id) { return Object.values(BIOME_BUILDINGS).flat().find((b) => b.id === id); }
  return (
    <div className="min-h-screen pb-16">
      <div className="max-w-5xl mx-auto px-4 pt-6 flex flex-col gap-4">
        <header className="panel flex flex-col gap-3">
          <div>
            <div className="inline-flex px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs tracking-[0.1em] font-semibold">Signal Frontier</div>
            <div className="text-muted text-sm mt-1">Scan, settle, and build outposts across the void.</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['hub','missions','bases','crew','tech','log'].map((tab) => (
              <button key={tab} className={`tab ${state.tab === tab ? 'active' : ''}`} onClick={() => dispatch({ type: 'SET_TAB', tab })}>{tab[0].toUpperCase() + tab.slice(1)}</button>
            ))}
          </div>
          <ResourceBar resources={state.resources} rates={state.rates} format={format} />
        </header>

        <main className="flex flex-col gap-4">
          {state.tab === 'hub' && (
            <HubView state={state} selectedBody={selectedBody()} onCollect={collectSignal} onPulse={pulseScan} buildHub={buildHub} buyHubUpgrade={buyHubUpgrade} format={format} />
          )}
          {state.tab === 'missions' && (
            <MissionsView state={state} startMission={startMission} setSelected={(id) => dispatch({ type: 'SET_SELECTED_BODY', id })} format={format} />
          )}
          {state.tab === 'bases' && (
            <BasesView state={state} setSelected={(id) => dispatch({ type: 'SET_SELECTED_BODY', id })} buildBase={buildBase} format={format} bodyEvents={bodyEvents} />
          )}
          {state.tab === 'crew' && (
            <CrewView state={state} hire={hire} rollRecruits={() => rollRecruits(true)} changeCrew={changeCrew} format={format} />
          )}
          {state.tab === 'tech' && <TechView state={state} buyTech={buyTech} format={format} />}
          {state.tab === 'log' && <LogView log={state.log} />}
        </main>
      </div>
      <StarterTour tourStep={state.tourStep} seen={state.tourSeen} onStep={(step, seen) => dispatch({ type: 'TOUR_STEP', step, seen })} />
    </div>
  );
}

function ResourceBar({ resources, rates, format }) {
  const entries = [
    { label: 'Signal', key: 'signal' }, { label: 'Research', key: 'research' }, { label: 'Metal', key: 'metal' },
    { label: 'Organics', key: 'organics' }, { label: 'Fuel', key: 'fuel' }, { label: 'Power', key: 'power' },
    { label: 'Food', key: 'food' }, { label: 'Habitat', key: 'habitat' }, { label: 'Rare', key: 'rare' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
      {entries.map((e) => (
        <div key={e.key} className="stat-box">
          <span className="text-muted text-xs">{e.label}</span>
          <strong>{format(resources[e.key] || 0)}</strong>
          <span className="text-[11px] text-muted">{`${format(rates[e.key] || 0)}/tick`}</span>
        </div>
      ))}
    </div>
  );
}

function HubView({ state, onCollect, onPulse, buildHub, buyHubUpgrade, format }) {
  return (
    <section className="panel space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Main Hub</div>
          <div className="text-muted text-sm">Launch expeditions, manage power, and scale signal.</div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={onCollect}>Collect Signal (Space)</button>
          <button className="btn" onClick={onPulse}>Pulse Scan</button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="card">
          <div className="font-semibold mb-1">Hub Buildings</div>
          <div className="list">
            {HUB_BUILDINGS.map((b) => {
              const level = state.hubBuildings[b.id] || 0;
              const can = canAffordUI(state.resources, b.cost);
              return (
                <div key={b.id} className="row-item">
                  <div className="row-details">
                    <div className="row-title">{b.name} <span className="tag">Lv {level}</span></div>
                    <div className="row-meta">{b.desc}</div>
                  </div>
                  <button className="btn" disabled={!can} onClick={() => buildHub(b.id)}>Build ({costText(b.cost, format)})</button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="font-semibold mb-1">Hub Upgrades</div>
          <div className="list">
            {HUB_UPGRADES.map((u) => {
              const level = state.hubUpgrades[u.id] || 0;
              return (
                <div key={u.id} className="row-item">
                  <div className="row-details">
                    <div className="row-title">{u.name} <span className="tag">Lv {level}</span></div>
                    <div className="row-meta">{u.desc}</div>
                  </div>
                  <button className="btn" disabled={!canAffordUI(state.resources, u.cost)} onClick={() => buyHubUpgrade(u.id)}>Upgrade ({costText(u.cost, format)})</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
function MissionsView({ state, startMission, setSelected, format }) {
  return (
    <section className="panel space-y-3">
      <div>
        <div className="text-lg font-semibold">Missions</div>
        <div className="text-muted text-sm">Biome-specific hazards and loot. Boost fuel to cut travel time.</div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="card">
          <div className="font-semibold mb-1">Targets</div>
          <div className="list">
            {BODIES.map((b) => {
              const locked = !isUnlockedUI(state, b);
              return (
                <div key={b.id} className="row-item">
                  <div className="row-details">
                    <div className="row-title">
                      {b.name} {!locked && state.selectedBody === b.id && <span className="tag">Selected</span>} {locked && <span className="tag">Locked</span>}
                    </div>
                    <div className="row-meta">{b.type.toUpperCase()} - Travel {formatDuration(b.travel * 1000)} - Hazard {(b.hazard * 100).toFixed(0)}%</div>
                  </div>
                  <button className="btn" disabled={locked} onClick={() => setSelected(b.id)}>Target</button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="font-semibold mb-1">Launch</div>
          <MissionLaunch state={state} startMission={startMission} format={format} />
        </div>
      </div>
    </section>
  );
}

function MissionLaunch({ state, startMission, format }) {
  const [fuelBoost, setFuelBoost] = useState(0);
  const body = BODIES.find((b) => b.id === state.selectedBody) || BODIES[0];
  const slots = 1 + (state.hubUpgrades.launch_bay || 0);
  const active = state.missions.active || [];
  const hazard = Math.max(0, body.hazard - (state.tech.hazard_gear ? 0.25 : 0) - (state.tech.shielding ? 0.2 : 0));
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted">Slots {active.length}/{slots}</div>
      <div className="row">
        <input type="range" min="0" max="10" value={fuelBoost} onChange={(e) => setFuelBoost(Number(e.target.value))} />
        <span className="text-sm text-muted">Fuel boost: {fuelBoost}</span>
      </div>
      <div className="row-item">
        <div className="row-details">
          <div className="row-title">Cargo Forecast</div>
          <div className="row-meta">{Object.entries(body.resources).map(([k, v]) => `${format(v)} ${k}`).join(" - ")}</div>
          <div className="row-meta">Hazard {Math.round(hazard * 100)}% - Travel {formatDuration(Math.max(15000, body.travel * 1000 - fuelBoost * 3000))}</div>
        </div>
        <button className="btn btn-primary" onClick={() => startMission(body.id, fuelBoost)}>Launch</button>
      </div>
      <div className="list">
        {active.map((m, i) => {
          const b = BODIES.find((x) => x.id === m.bodyId);
          const remaining = Math.max(0, m.endsAt - Date.now());
          return (
            <div key={i} className="row-item">
              <div className="row-details">
                <div className="row-title">En route to {b?.name || "target"}</div>
                <div className="row-meta">{formatDuration(remaining)} remaining</div>
              </div>
            </div>
          );
        })}
        {!active.length && <div className="text-muted text-sm">No active missions.</div>}
      </div>
    </div>
  );
}
function BasesView({ state, setSelected, buildBase, format, bodyEvents }) {
  const body = BODIES.find((b) => b.id === state.selectedBody) || BODIES[0];
  const buildings = BIOME_BUILDINGS[body.type] || [];
  const base = state.bases[body.id] || { buildings: {}, events: bodyEvents(body) };
  return (
    <section className="panel space-y-3">
      <div>
        <div className="text-lg font-semibold">Bases</div>
        <div className="text-muted text-sm">Each biome has unique structures and procedural events.</div>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="card">
          <div className="font-semibold mb-1">Sites</div>
          <div className="list">
            {BODIES.map((b) => (
              <div key={b.id} className="row-item">
                <div className="row-details">
                  <div className="row-title">{b.name} {state.selectedBody === b.id && <span className="tag">Active</span>}</div>
                  <div className="row-meta">{b.type.toUpperCase()} - Travel {formatDuration(b.travel * 1000)}</div>
                </div>
                <button className="btn" onClick={() => setSelected(b.id)}>Focus</button>
              </div>
            ))}
          </div>
        </div>
        <div className="card space-y-2">
          <div className="font-semibold">Build on {body.name}</div>
          <div className="list">
            {buildings.map((b) => (
              <div key={b.id} className="row-item">
                <div className="row-details">
                  <div className="row-title">{b.name} <span className="tag">Lv {base.buildings[b.id] || 0}</span></div>
                  <div className="row-meta">{b.desc}</div>
                </div>
                <button className="btn" disabled={!canAffordUI(state.resources, b.cost)} onClick={() => buildBase(b.id)}>Build ({costText(b.cost, format)})</button>
              </div>
            ))}
          </div>
          <div className="font-semibold mt-2">Local Events</div>
          <div className="list">
            {(base.events || []).map((e, i) => (
              <div key={i} className="row-item">
                <div className="row-details">
                  <div className="row-title">{e}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CrewView({ state, hire, rollRecruits, changeCrew, format }) {
  const unassigned = state.workers.total - Object.values(state.workers.assigned).reduce((a, b) => a + b, 0);
  return (
    <section className="panel space-y-3">
      <div className="text-lg font-semibold">Crew & Recruits</div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="card">
          <div className="row-title mb-1">Assignments</div>
          <div className="list">
            {["miner","botanist","engineer"].map((r) => (
              <div key={r} className="row-item">
                <div className="row-details">
                  <div className="row-title">{r.toUpperCase()} ({state.workers.assigned[r] || 0})</div>
                  <div className="row-meta">Bonus {Math.round((state.workers.bonus[r] || 0) * 100)}%</div>
                </div>
                <div className="row">
                  <button className="btn" onClick={() => changeCrew(r, -1)}>-</button>
                  <button className="btn" disabled={unassigned <= 0} onClick={() => changeCrew(r, 1)}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="text-sm text-muted mt-2">Unassigned: {unassigned}</div>
        </div>
        <div className="card">
          <div className="row row-between mb-1">
            <div className="row-title">Recruitment Hub</div>
            <button className="btn" onClick={rollRecruits}>Refresh</button>
          </div>
          <div className="list">
            {state.recruits.map((c) => (
              <div key={c.id} className="row-item">
                <div className="row-details">
                  <div className="row-title">{c.name} - {c.role}</div>
                  <div className="row-meta">{c.trait}</div>
                  <div className="row-meta">Cost {costText(c.cost, format)}</div>
                </div>
                <button className="btn" onClick={() => hire(c.id)}>Hire</button>
              </div>
            ))}
            {!state.recruits.length && <div className="text-muted text-sm">No candidates. Refresh to roll new crew.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
function TechView({ state, buyTech, format }) {
  return (
    <section className="panel space-y-3">
      <div className="text-lg font-semibold">Tech & Milestones</div>
      <div className="list">
        {TECH.map((t) => {
          const visible = state.resources.signal >= t.unlock; if (!visible) return null;
          const owned = state.tech[t.id];
          return (
            <div key={t.id} className="row-item">
              <div className="row-details">
                <div className="row-title">{t.name} {owned ? <span className="tag">Owned</span> : null}</div>
                <div className="row-meta">{t.desc}</div>
              </div>
              <button className="btn" disabled={owned || !canAffordUI(state.resources, t.cost)} onClick={() => buyTech(t.id)}>Research ({costText(t.cost, format)})</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LogView({ log }) {
  return (
    <section className="panel space-y-2">
      <div className="text-lg font-semibold">Log</div>
      <div className="list">
        {[...log].reverse().map((e, i) => (
          <div key={i} className="row-item">
            <div className="row-details">
              <div className="row-title">{e.text}</div>
              <div className="row-meta">{new Date(e.time).toLocaleTimeString()}</div>
            </div>
          </div>
        ))}
        {!log.length && <div className="text-muted text-sm">No events yet.</div>}
      </div>
    </section>
  );
}

function StarterTour({ tourStep, seen, onStep }) {
  const step = STARTER_TOUR[tourStep];
  return (
    <AnimatePresence>
      {!seen && step && (
        <div className="modal-backdrop" key="tour">
          <motion.div className="modal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <div className="text-lg font-semibold mb-2">{step.title}</div>
            <div className="text-muted text-sm mb-4">{step.body}</div>
            <div className="flex gap-2 justify-end">
              <button className="btn" onClick={() => onStep(tourStep + 1, tourStep + 1 >= STARTER_TOUR.length)}>{tourStep + 1 >= STARTER_TOUR.length ? 'Finish' : 'Next'}</button>
              <button className="btn" onClick={() => onStep(tourStep, true)}>Skip</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function canAffordUI(resources, cost) { return Object.entries(cost).every(([k, v]) => (resources[k] || 0) >= v); }
function costText(cost, format) { return Object.entries(cost).map(([k, v]) => `${format(v)} ${k}`).join(', '); }
function formatDuration(ms) { const sec = Math.max(0, Math.ceil(ms / 1000)); const m = Math.floor(sec / 60); const s = sec % 60; return m > 0 ? `${m}m ${s}s` : `${s}s`; }
function isUnlockedUI(state, body) { if (body.requireTech && !state.tech[body.requireTech]) return false; return (state.resources.signal || 0) >= (body.unlock || 0); }
