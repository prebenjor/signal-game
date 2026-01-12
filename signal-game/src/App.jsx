
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./App.css";
import MissionsView from "./views/Missions";
import BasesView from "./views/Bases";
import CrewView from "./views/Crew";
import TechView from "./views/Tech";

const STORAGE_KEY = "signalFrontierReact";
const LEGACY_KEY = "signalFrontierState";
const TICK_MS = 500;
const SAVE_MS = 5000;
const TAB_ORDER = ["hub", "missions", "bases", "crew", "tech", "log", "profile"];
const EVENT_COOLDOWN_MS = [45000, 90000];
const COST_EXP = { hub: 1.12, base: 1.14 };

const BODIES = [
  { id: "debris", name: "Debris Field", type: "asteroid", travel: 30, hazard: 0.05, unlock: 0, resources: { metal: 18, fuel: 4, research: 3 } },
  { id: "ice", name: "Ice Moon", type: "ice", travel: 60, hazard: 0.12, unlock: 400, resources: { organics: 25, fuel: 10, research: 5 } },
  { id: "lava", name: "Lava Rock", type: "warm", travel: 90, hazard: 0.2, unlock: 1200, resources: { metal: 50, rare: 3, research: 10 } },
  { id: "cradle", name: "Cradle Station", type: "asteroid", travel: 120, hazard: 0.18, unlock: 2400, requireTech: "deep_scan", resources: { fuel: 26, research: 22, rare: 8 } },
  { id: "ruins", name: "Fallen Relay", type: "warm", travel: 140, hazard: 0.22, unlock: 3800, requireTech: "shielding", resources: { metal: 160, research: 80, rare: 18 } },
  { id: "rift", name: "Rift Beacon", type: "unknown", travel: 180, hazard: 0.3, unlock: 6200, requireTech: "rift_mapping", resources: { fuel: 90, research: 140, rare: 30 } },
  { id: "spire", name: "Veil Spire", type: "unknown", travel: 210, hazard: 0.35, unlock: 8200, requireTech: "rift_mapping", requireMissions: 5, resources: { research: 200, rare: 40, fuel: 120 } },
];

const HUB_UPGRADES = [
  { id: "launch_bay", name: "Launch Bay", desc: "+1 concurrent mission slot", cost: { metal: 140, fuel: 40 } },
  { id: "fuel_farm", name: "Fuel Farm", desc: "+2 fuel/tick", cost: { metal: 180, organics: 60 } },
  { id: "scan_array", name: "Scan Array", desc: "+3 signal/tick", cost: { metal: 220, fuel: 20 } },
  { id: "drone_bay", name: "Drone Bay", desc: "+10% mission cargo", cost: { metal: 260, rare: 10 } },
];

const HUB_BUILDINGS = [
  { id: "refinery", name: "Fuel Refinery", desc: "+2 fuel/tick", cost: { metal: 90, organics: 16 }, prod: { fuel: 2 }, cons: { power: 1 } },
  { id: "reactor", name: "Reactor", desc: "+4 power/tick, -1 fuel", cost: { metal: 140, fuel: 35 }, prod: { power: 4 }, cons: { fuel: 1 } },
  { id: "hab", name: "Hab Module", desc: "+4 habitat", cost: { metal: 120, organics: 40 }, prod: { habitat: 4 }, cons: {} },
  { id: "rec", name: "Rec Dome", desc: "Boosts morale", cost: { metal: 90, organics: 60 }, prod: { morale: 0.03 }, cons: { power: 1 } },
  { id: "array", name: "Comms Array", desc: "+4 signal/tick", cost: { metal: 180, fuel: 16 }, prod: { signal: 4 }, cons: { power: 1 } },
];
const BIOME_BUILDINGS = {
  asteroid: [
    { id: "fuel_cracker", name: "Fuel Cracker", desc: "+2 fuel/tick", cost: { metal: 90 }, prod: { fuel: 2 }, cons: { power: 1 } },
    { id: "ore_rig", name: "Ore Rig", desc: "+4 metal/tick", cost: { metal: 120 }, prod: { metal: 4 }, cons: { power: 1 } },
    { id: "solar_sail", name: "Solar Sail", desc: "+2 power/tick", cost: { metal: 70 }, prod: { power: 2 }, cons: {} },
  ],
  ice: [
    { id: "thermal_pump", name: "Thermal Pump", desc: "+3 fuel/tick", cost: { metal: 110, fuel: 16 }, prod: { fuel: 3 }, cons: { power: 1 } },
    { id: "algae_farm", name: "Algae Farm", desc: "+3 food/tick", cost: { metal: 90, organics: 40 }, prod: { food: 3 }, cons: { power: 1 } },
  ],
  warm: [
    { id: "shield_dome", name: "Shield Dome", desc: "-20% hazard on missions from this base", cost: { metal: 140, fuel: 20 }, prod: {}, cons: { power: 1 } },
    { id: "vapor_trap", name: "Vapor Trap", desc: "+2 organics/tick", cost: { metal: 90, fuel: 12 }, prod: { organics: 2 }, cons: {} },
  ],
  unknown: [
    { id: "anomaly_lab", name: "Anomaly Lab", desc: "+1 rare/tick", cost: { metal: 160, rare: 8 }, prod: { rare: 1 }, cons: { power: 1 } },
  ],
};

const TECH = [
  { id: "fuel_synth", tier: 1, name: "Fuel Synthesis", desc: "+1 fuel/tick", cost: { signal: 320, research: 12 }, unlock: 300, requires: [] },
  { id: "hazard_gear", tier: 2, name: "Hazard Gear", desc: "-25% mission hazard", cost: { signal: 1200, research: 60 }, unlock: 900, requires: ["fuel_synth"] },
  { id: "drone_log", tier: 2, name: "Logistics Drones", desc: "+20% mission cargo", cost: { signal: 1600, research: 90 }, unlock: 1400, requires: ["fuel_synth"] },
  { id: "deep_scan", tier: 2, name: "Deep Scan Arrays", desc: "+1 research/tick and reveals deep targets", cost: { signal: 2000, research: 160 }, unlock: 1600, requires: ["fuel_synth"] },
  { id: "shielding", tier: 3, name: "Thermal Shielding", desc: "-40% hazard on hot zones; unlocks fallen relay", cost: { signal: 2800, research: 260 }, unlock: 2400, requires: ["deep_scan"] },
  { id: "rift_mapping", tier: 4, name: "Rift Mapping", desc: "Unlocks anomalous missions and +20% rare cargo", cost: { signal: 4800, research: 360, rare: 12 }, unlock: 4200, requires: ["shielding","drone_log"] },
  { id: "auto_pilots", tier: 3, name: "Autonomous Pilots", desc: "+1 mission slot, -10% travel time", cost: { signal: 5600, research: 520, fuel: 80 }, unlock: 5200, requires: ["drone_log"] },
  { id: "bio_domes", tier: 3, name: "Bio-Domes", desc: "+2 food/tick and +2 habitat passive", cost: { signal: 6000, research: 540, organics: 120 }, unlock: 5200, requires: ["fuel_synth"] },
];

const BASE_OPS = {
  asteroid: [
    { id: "stabilize_grid", name: "Stabilize Grid", desc: "Patch power relays; reduce power gating risk for a while.", cost: { metal: 25 }, reward: { power: 4 }, cooldown: 20000 },
    { id: "deep_bore", name: "Deep Bore", desc: "Drill deeper veins; yields metal + fuel.", cost: { fuel: 8 }, reward: { metal: 35, fuel: 8 }, cooldown: 25000 },
  ],
  ice: [
    { id: "heat_melt", name: "Heat Melt", desc: "Melt and refreeze; yields organics + fuel.", cost: { power: 2, fuel: 6 }, reward: { organics: 24, fuel: 10 }, cooldown: 25000 },
    { id: "glacier_scan", name: "Glacier Scan", desc: "Scan crevasses; small research burst.", cost: { fuel: 4, signal: 60 }, reward: { research: 10 }, cooldown: 20000 },
  ],
  warm: [
    { id: "shield_tune", name: "Shield Tune", desc: "Tune domes; reduce hazard and improve morale.", cost: { fuel: 10, metal: 20 }, reward: { morale: 0.05 }, cooldown: 22000 },
    { id: "slag_skim", name: "Slag Skim", desc: "Skim molten flows; yields metal and rare traces.", cost: { power: 2 }, reward: { metal: 40, rare: 2 }, cooldown: 28000 },
  ],
  unknown: [
    { id: "anomaly_probe", name: "Anomaly Probe", desc: "Probe strange signals; yields research/rare.", cost: { fuel: 12, signal: 120 }, reward: { research: 18, rare: 3 }, cooldown: 30000 },
  ],
};

const STARTER_TOUR = [
  { title: "Signal & Scans", body: "Collect Signal (Space) to reveal nearby targets. Pulse Scans convert signal into random loot.", anchor: "hub" },
  { title: "Hub Status", body: "Power, food, habitat, and morale drive sustainability. Keep power = 0 and food above upkeep.", anchor: "hub" },
  { title: "Missions", body: "Launch expeditions based on biome hazards. Fuel spend scales with distance.", anchor: "missions" },
  { title: "Bases", body: "Each biome unlocks unique structures and events. Build per-body upgrades on-site.", anchor: "bases" },
  { title: "Crew & Recruits", body: "Hire specialists with role bonuses. Assign crew to boost production.", anchor: "crew" },
];

const MISSION_MODES = [
  { id: "balanced", name: "Balanced", desc: "Standard risk and rewards.", hazard: 0, durationMs: 0, reward: {} },
  { id: "survey", name: "Survey", desc: "+60% research, slower travel, lower cargo", hazard: 0.04, durationMs: 8000, reward: { research: 1.6, all: 0.9 } },
  { id: "salvage", name: "Salvage", desc: "+30% metal/organics cargo, small hazard bump", hazard: 0.06, durationMs: 0, reward: { metal: 1.3, organics: 1.3 } },
  { id: "secure", name: "Secure", desc: "-35% hazard, longer flight, -10% cargo", hazard: -0.35, durationMs: 6000, reward: { all: 0.9 } },
  { id: "relay", name: "Relay", desc: "+25% fuel & signal cargo, modest hazard", hazard: 0.08, durationMs: -2000, reward: { fuel: 1.25, signal: 1.25 } },
];
function defaultBaseState() {
  return { buildings: {}, events: [], focus: "balanced", nextEventAt: Date.now() + randomBetween(...EVENT_COOLDOWN_MS), opsReadyAt: 0 };
}

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
  autoLaunch: { enabled: false, bodyId: null, mode: "balanced", specialist: "none" },
  selectedBody: "debris",
  recruits: [],
  lastRecruitRoll: 0,
  log: [],
  milestones: {},
  tourStep: 0,
  tourSeen: false,
  labReadyAt: 0,
  pulseCount: 0,
  pulseReadyAt: 0,
  prestige: { points: 0, runs: 0, boost: 1 },
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
  const initState = useMemo(() => loadSavedState(), []);
  const [state, dispatch] = useReducer(reducer, initState);
  const [tick, setTick] = useState(0);
  const [compact, setCompact] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const stateRef = useRef(state);
  const currentBase = useMemo(() => state.bases[state.selectedBody] || defaultBaseState(), [state.bases, state.selectedBody]);

  useEffect(() => { stateRef.current = state; }, [state]);

  const persistState = () => {
    try {
      const payload = JSON.stringify(stateRef.current);
      localStorage.setItem(STORAGE_KEY, payload);
      document.cookie = `signalFrontier=${encodeURIComponent(btoa(payload))};path=/;max-age=31536000`;
      setLastSaved(Date.now());
    } catch (e) {
      console.warn("Save failed", e);
    }
  };

  const manualSave = () => {
    persistState();
  };

  useEffect(() => {
    persistState(); // initial save to normalize keys
    const id = setInterval(persistState, SAVE_MS);
    const onVis = () => { if (document.visibilityState === "hidden") persistState(); };
    const onBeforeUnload = () => persistState();
    window.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      clearInterval(id);
      window.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), TICK_MS); return () => clearInterval(id); }, []);
  useEffect(() => { applyProduction(); resolveMissions(); processEvents(); }, [tick]);

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
    const cost = Math.min(180, 60 + (state.pulseCount || 0) * 15);
    const cdMs = 8000;
    if (Date.now() < (state.pulseReadyAt || 0)) { log("Pulse scanner cooling down."); return; }
    if (state.resources.signal < cost) { log("Not enough signal for pulse scan."); return; }
    bumpResources({ signal: -cost });
    const rewardPool = ["metal","fuel","research"];
    const type = rewardPool[Math.floor(Math.random() * rewardPool.length)];
    const amount = type === "research" ? 5 : type === "fuel" ? 12 : 18;
    bumpResources({ [type]: amount });
    dispatch({ type: "UPDATE", patch: { pulseReadyAt: Date.now() + cdMs, pulseCount: (state.pulseCount || 0) + 1 } });
    log(`Pulse scan recovered ${amount} ${type} (cost ${cost}).`);
  }

  function bumpResources(delta) {
    dispatch({ type: "UPDATE", patch: { resources: Object.keys(delta).reduce((acc, key) => { acc[key] = Math.max(0, (state.resources[key] || 0) + delta[key]); return acc; }, { ...state.resources }) } });
  }

  function log(text) { dispatch({ type: "LOG", text }); }

  function applyProduction() {
    const r = { ...state.resources };
    const contributions = [];
    const eventMods = aggregateEventMods(currentBase);

    const addContribution = (prod, cons, requiresPower) => contributions.push({ prod, cons, requiresPower });

    Object.entries(state.hubBuildings).forEach(([id, lvl]) => {
      const def = HUB_BUILDINGS.find((b) => b.id === id); if (!def) return; const mult = workerMult(def.id);
      const prod = {}; Object.entries(def.prod || {}).forEach(([k, v]) => prod[k] = v * lvl * mult);
      addContribution(prod, scaleCons(def.cons, lvl), !!def.cons?.power);
    });
    if (state.hubUpgrades.fuel_farm) addContribution({ fuel: 2 * state.hubUpgrades.fuel_farm }, {}, false);
    if (state.hubUpgrades.scan_array) addContribution({ signal: 3 * state.hubUpgrades.scan_array }, {}, false);
    if (state.tech.fuel_synth) addContribution({ fuel: 1 * state.tech.fuel_synth }, {}, false);
    if (state.tech.deep_scan) addContribution({ research: 1 * state.tech.deep_scan }, {}, false);
    if (state.tech.bio_domes) addContribution({ food: 2 * state.tech.bio_domes, habitat: 2 * state.tech.bio_domes }, {}, false);

    const focus = currentBase.focus || "balanced";
    Object.entries(currentBase.buildings || {}).forEach(([id, lvl]) => {
      const def = biomeBuildingById(id); if (!def) return;
      const prod = {}; Object.entries(def.prod || {}).forEach(([k, v]) => prod[k] = v * lvl * workerMult(id) * focusBoost(focus, k) * (eventMods.mult[k] || 1));
      addContribution(prod, scaleCons(def.cons, lvl), !!def.cons?.power);
    });

    const sumRates = (powerGate) => {
      const rates = { signal: 0, research: 0, metal: 0, organics: 0, fuel: 0, power: 0, food: 0, morale: 0, habitat: 0, rare: 0 };
      contributions.forEach(({ prod, cons, requiresPower }) => {
        const scale = powerGate && requiresPower ? 0 : 1;
        Object.entries(prod).forEach(([k, v]) => rates[k] = (rates[k] || 0) + v * scale);
        Object.entries(cons || {}).forEach(([k, v]) => rates[k] = (rates[k] || 0) - v);
      });
      return rates;
    };

    const prodBoost = 1 + ((state.prestige?.boost || 1) - 1);
    const projected = sumRates(false);
    const projectedPower = (state.resources.power || 0) + projected.power;
    const powerGate = projectedPower <= 0;
    const rates = sumRates(powerGate);

    Object.keys(rates).forEach((k) => { r[k] = Math.max(0, r[k] + rates[k] * (k === "power" ? 1 : prodBoost)); });
    const foodUpkeep = state.workers.total * 0.2; r.food = Math.max(0, r.food - foodUpkeep);

    const morale = computeMorale(r, rates, state, currentBase, eventMods, powerGate);
    dispatch({ type: "UPDATE", patch: { resources: r, rates, workers: { ...state.workers, satisfaction: morale } } });
  }

  function workerMult(buildingId) {
    const bonus = state.workers.bonus || {};
    const moraleBoost = 0.6 + (state.workers.satisfaction || 1) * 0.6;
    if (["ore_rig","fuel_cracker"].includes(buildingId)) return (1 + (state.workers.assigned.miner || 0) * 0.1 + (bonus.miner || 0)) * moraleBoost;
    if (["algae_farm"].includes(buildingId)) return (1 + (state.workers.assigned.botanist || 0) * 0.1 + (bonus.botanist || 0)) * moraleBoost;
    return (1 + (state.workers.assigned.engineer || 0) * 0.05 + (bonus.engineer || 0)) * moraleBoost;
  }

  const crewBonusText = (buildingId) => {
    const mult = workerMult(buildingId);
    const pct = Math.max(0, (mult - 1) * 100);
    return `${pct.toFixed(0)}%`;
  };

function resolveMissions() {
    const active = state.missions.active || [];
    if (!active.length) return;
    const now = Date.now(); const remaining = [];
    active.forEach((m) => {
      if (now < m.endsAt) { remaining.push(m); return; }
      const body = BODIES.find((b) => b.id === m.bodyId); if (!body) return;
      let cargo = missionYield(state, body, m.mode, m.specialist);
      if (m.objective) {
        const choice = window.confirm(`Side Objective: ${m.objective.desc}.\nTake the risk for ${m.objective.rewardText}?`);
        if (choice) {
          cargo = combineCargo(cargo, m.objective.reward);
          if (Math.random() < m.objective.failRisk) {
            cargo = reduceCargo(cargo, 0.5);
            log("Side objective mishap reduced cargo.");
          } else {
            log("Side objective succeeded. Bonus cargo added.");
          }
        }
      }
      const risk = Math.min(0.8, Math.max(0.05, (m.hazard || 0) * 0.6 + 0.05));
      const partial = Math.min(0.95, risk + 0.25);
      const roll = Math.random();
      if (roll < risk) {
        const salvage = reduceCargo(cargo, 0.2); bumpResources(salvage); log(`Mission to ${body.name} failed. Salvaged ${Object.keys(salvage).length ? "scrap" : "nothing"}.`);
      } else if (roll < partial) {
        const haul = reduceCargo(cargo, 0.65); bumpResources(haul); log(`Mission to ${body.name} returned partially due to hazard.`);
      } else {
        bumpResources(cargo); log(`Mission from ${body.name} returned with cargo.`);
      }
    });
    const missionsDone = (state.milestones.missionsDone || 0) + (active.length - remaining.length);
    dispatch({ type: "UPDATE", patch: { missions: { active: remaining }, milestones: { ...state.milestones, missionsDone } } });

    // Auto-launch if enabled and slots free
    const slots = 1 + (state.hubUpgrades.launch_bay || 0) + (state.tech.auto_pilots ? 1 : 0);
    if (state.autoLaunch?.enabled && (remaining.length < slots)) {
      const target = state.autoLaunch.bodyId || state.selectedBody;
      const modeId = state.autoLaunch.mode || "balanced";
      const specialist = state.autoLaunch.specialist || "none";
      startMission(target, 0, modeId, specialist, true);
    }
  }

  function processEvents() {
    const now = Date.now();
    const bases = { ...state.bases };
    let changed = false;
    BODIES.forEach((body) => {
      if (!isUnlocked(body)) return;
      const base = bases[body.id] || defaultBaseState();
      if (!base.nextEventAt) base.nextEventAt = now + randomBetween(...EVENT_COOLDOWN_MS);
      if (now >= base.nextEventAt) {
        base.events = [...(base.events || []), createEvent(body)];
        base.nextEventAt = now + randomBetween(...EVENT_COOLDOWN_MS);
        bases[body.id] = base; changed = true;
        log(`Event at ${body.name}: ${base.events[base.events.length - 1].name}`);
      } else if (!bases[body.id]) {
        bases[body.id] = base; changed = true;
      }
    });
    if (changed) dispatch({ type: "UPDATE", patch: { bases } });
  }

function startMission(bodyId, fuelBoost = 0, modeId = "balanced", specialist = "none", silent = false) {
    const body = BODIES.find((b) => b.id === bodyId && isUnlocked(b));
    if (!body) { log("Target locked."); return; }
    const slots = 1 + (state.hubUpgrades.launch_bay || 0) + (state.tech.auto_pilots ? 1 : 0);
    if ((state.missions.active || []).length >= slots) { log("All mission slots busy."); return; }
    let fuelCost = Math.max(5, Math.floor(body.travel / 3)) + fuelBoost;
    if (!state.milestones?.firstLaunch) fuelCost = 0;
    if (state.resources.fuel < fuelCost) { log("Not enough fuel."); return; }
    bumpResources({ fuel: -fuelCost });
    const mode = missionModeById(modeId);
    const hazard = body.hazard - (state.tech.hazard_gear ? 0.25 : 0) - (state.tech.shielding ? 0.2 : 0) + (mode?.hazard || 0) + (specialist === "engineer" ? -0.1 : 0);
    const duration = Math.max(15000, ((body.travel * 1000) - fuelBoost * 3000 + (mode?.durationMs || 0)) * (state.tech.auto_pilots ? 0.9 : 1));
    const objective = Math.random() < 0.3 ? makeObjective(body) : null;
    const mission = { bodyId: body.id, endsAt: Date.now() + duration, hazard: Math.max(0, hazard), mode: modeId, specialist, objective };
    dispatch({ type: "UPDATE", patch: { missions: { active: [...(state.missions.active || []), mission] } } });
    if (!silent) log(`Launched ${mode?.name || "mission"} to ${body.name}. ETA ${formatDuration(duration)}.`);
    dispatch({ type: "UPDATE", patch: { milestones: { ...state.milestones, firstLaunch: true } } });
  }

  function setAutoLaunch(payload) {
    dispatch({ type: "UPDATE", patch: { autoLaunch: payload } });
    log(payload.enabled ? `Auto-launch enabled for ${BODIES.find((b) => b.id === payload.bodyId)?.name || "target"}.` : "Auto-launch disabled.");
  }


function isUnlocked(body) {
    if (body.requireTech && !state.tech[body.requireTech]) return false;
    if (body.requireMissions && (state.milestones.missionsDone || 0) < body.requireMissions) return false;
    return state.resources.signal >= (body.unlock || 0);
  }

  function bodyEvents(body) { return [createEvent(body)]; }

  function buildHub(id) {
    const def = HUB_BUILDINGS.find((b) => b.id === id); if (!def) return;
    const level = state.hubBuildings[id] || 0;
    const cost = scaledCost(def.cost, level, COST_EXP.hub);
    if (!canAfford(cost)) { log("Not enough resources."); return; }
    spend(cost);
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
    const level = (state.bases[state.selectedBody]?.buildings?.[id] || 0);
    const cost = withLogisticsCost(scaledCost(def.cost, level, COST_EXP.base), selectedBody());
    if (!canAfford(cost)) { log("Not enough resources (includes logistics fuel)."); return; }
    spend(cost);
    const base = state.bases[state.selectedBody] || defaultBaseState();
    const newBase = { ...base, buildings: { ...base.buildings, [id]: (base.buildings[id] || 0) + 1 } };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [state.selectedBody]: newBase } } });
    log(`Built ${def.name} on ${selectedBody().name} (logistics fuel included).`);
  }

  function setBaseFocus(focus) {
    const base = state.bases[state.selectedBody] || defaultBaseState();
    const updated = { ...base, focus };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [state.selectedBody]: updated } } });
    log(`Outpost focus set to ${focus}.`);
  }

  function refreshEvents() {
    const base = state.bases[state.selectedBody] || defaultBaseState();
    const updated = { ...base, events: bodyEvents(selectedBody()) };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [state.selectedBody]: updated } } });
    log("Local events refreshed.");
  }

  function selectedBody() { return BODIES.find((b) => b.id === state.selectedBody) || BODIES[0]; }

  function canAfford(cost) { return Object.entries(cost).every(([k, v]) => (state.resources[k] || 0) >= v); }

  function spend(cost) { const r = { ...state.resources }; Object.entries(cost).forEach(([k, v]) => { r[k] = Math.max(0, r[k] - v); }); dispatch({ type: "UPDATE", patch: { resources: r } }); }

  function buyTech(id) {
    const def = TECH.find((t) => t.id === id); if (!def || state.tech[id]) return;
    if (!hasPrereqs(state, def)) { log("Complete prerequisite tech first."); return; }
    if (state.resources.signal < def.unlock) { log("Need more signal to access this tech."); return; }
    if (!canAfford(def.cost)) { log("Not enough resources."); return; }
    spend(def.cost); dispatch({ type: "UPDATE", patch: { tech: { ...state.tech, [id]: 1 } } });
    log(`Tech unlocked: ${def.name}.`);
  }

  function runLabPulse() {
    const cooldownMs = 20000;
    if (Date.now() < (state.labReadyAt || 0)) { log("Research lab recalibrating."); return; }
    const cost = { signal: 60, metal: 20 };
    if (!canAfford(cost)) { log("Need signal + metal for research pulse."); return; }
    spend(cost);
    bumpResources({ research: 6 });
    dispatch({ type: "UPDATE", patch: { labReadyAt: Date.now() + cooldownMs } });
    log("Research pulse completed. New data archived.");
  }

  function ascend() {
    const totalValue = (state.resources.signal || 0) + (state.resources.metal || 0) + (state.resources.research || 0) * 5 + (state.resources.rare || 0) * 20;
    const points = Math.max(1, Math.floor(totalValue / 5000));
    const prestige = { points: (state.prestige?.points || 0) + points, runs: (state.prestige?.runs || 0) + 1, boost: 1 + ((state.prestige?.points || 0) + points) * 0.02 };
    const resetState = { ...initialState, prestige };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resetState));
    dispatch({ type: "LOAD", payload: resetState });
    log(`Ascended for ${points} prestige. Global production boost now ${Math.round((prestige.boost - 1) * 100)}%.`);
  }

  function exportProfile() {
    try {
      const raw = JSON.stringify(state);
      const hash = hashStr(raw);
      const salted = xorString(raw, "signal-salt");
      const encoded = btoa(salted);
      const bundle = `${hash}.${encoded}`;
      const copyPromise = navigator.clipboard?.writeText ? navigator.clipboard.writeText(bundle) : Promise.reject();
      copyPromise
        .then(() => {
          log("Profile exported. Copied to clipboard; keep the string safe.");
          window.alert("Export copied to clipboard. Keep it safe.");
        })
        .catch(() => {
          log("Profile exported. Copy the shown string to import elsewhere.");
          window.prompt("Copy your export string", bundle);
        });
    } catch (e) {
      console.error(e);
      alert("Failed to export profile.");
    }
  }

  function importProfile() {
    const data = window.prompt("Paste exported profile string");
    if (!data) return;
    try {
      const [hash, payload] = data.trim().split(".");
      if (!hash || !payload) throw new Error("Malformed bundle");
      const salted = atob(payload);
      const raw = xorString(salted, "signal-salt");
      if (hashStr(raw) !== hash) throw new Error("Checksum mismatch");
      const parsed = JSON.parse(raw);
      dispatch({ type: "LOAD", payload: { ...initialState, ...parsed } });
      log("Profile imported.");
      alert("Profile import successful.");
    } catch (e) {
      console.error(e);
      alert("Import failed: invalid string.");
    }
  }

  function rollRecruits(force) {
    const now = Date.now();
    if (!force && now - state.lastRecruitRoll < 45000 && state.recruits.length) return;
    const candidates = Array.from({ length: 3 }, (_, i) => makeCandidate(i));
    dispatch({ type: "SET_RECRUITS", recruits: candidates });
  }

  function resolveEvent(bodyId, eventId) {
    const base = state.bases[bodyId] || defaultBaseState();
    const ev = (base.events || []).find((e) => e.id === eventId);
    if (!ev) return;
    if (ev.requiresRole && (state.workers.assigned[ev.requiresRole] || 0) <= 0) { log(`Need an active ${ev.requiresRole} to resolve.`); return; }
    if (ev.cost && !canAfford(ev.cost)) { log("Not enough resources to resolve event."); return; }
    if (ev.cost) spend(ev.cost);
    const events = (base.events || []).filter((e) => e.id !== eventId);
    const updated = { ...base, events };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [bodyId]: updated } } });
    log(`Resolved event: ${ev.name}.`);
  }

  function runBaseOp(bodyId, opId) {
    const body = BODIES.find((b) => b.id === bodyId); if (!body) return;
    const ops = BASE_OPS[body.type] || [];
    const op = ops.find((o) => o.id === opId); if (!op) return;
    const base = state.bases[bodyId] || defaultBaseState();
    if (Date.now() < (base.opsReadyAt || 0)) { log("Base ops cooling down."); return; }
    if (!canAfford(op.cost)) { log("Not enough resources for this op."); return; }
    spend(op.cost);
    bumpResources(op.reward);
    const updated = { ...base, opsReadyAt: Date.now() + op.cooldown };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [bodyId]: updated } } });
    log(`Ran ${op.name} on ${body.name}.`);
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
      <div className="max-w-6xl xl:max-w-7xl w-[96vw] mx-auto px-4 pt-6 flex flex-col gap-4">
        <header className="panel flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="inline-flex px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs tracking-[0.1em] font-semibold">Signal Frontier</div>
              <div className="text-muted text-sm mt-1">Scan, settle, and build outposts across the void.</div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={collectSignal}>Collect Signal (Space)</button>
              <button className="btn" disabled={state.resources.signal < Math.min(180, 60 + (state.pulseCount || 0) * 15) || state.pulseReadyAt > Date.now()} onClick={pulseScan}>Pulse Scan</button>
            </div>
          </div>
          <ResourceBar resources={state.resources} rates={state.rates} format={format} />
        </header>

        <div className="flex flex-col md:flex-row gap-4">
          <nav className="md:w-48 w-full flex md:flex-col flex-wrap gap-2 overflow-x-auto pb-1">
            {['hub','missions','bases','crew','tech','log','profile'].map((tab) => (
              <button
                key={tab}
                className={`tab w-full md:w-full text-left whitespace-nowrap ${state.tab === tab ? 'active' : ''}`}
                onClick={() => dispatch({ type: 'SET_TAB', tab })}
              >
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
          <main className="flex-1 flex flex-col gap-3">
            {state.tab === 'hub' && (
              <HubView
                state={state}
                selectedBody={selectedBody()}
                onCollect={collectSignal}
                onPulse={pulseScan}
                runLabPulse={runLabPulse}
                buildHub={buildHub}
                buyHubUpgrade={buyHubUpgrade}
                crewBonusText={crewBonusText}
                ascend={ascend}
                format={format}
              />
            )}
            {state.tab === 'missions' && (
              <MissionsView
                state={state}
                startMission={startMission}
                setAutoLaunch={setAutoLaunch}
                setSelected={(id) => dispatch({ type: 'SET_SELECTED_BODY', id })}
                format={format}
                missionModeById={missionModeById}
                missionYield={missionYield}
                formatDuration={formatDuration}
                bodies={BODIES}
                missionModes={MISSION_MODES}
                isUnlockedUI={isUnlockedUI}
              />
            )}
            {state.tab === 'bases' && (
              <BasesView
                state={state}
                bodies={BODIES}
                biomeBuildings={BIOME_BUILDINGS}
                baseOps={BASE_OPS}
                setSelected={(id) => dispatch({ type: 'SET_SELECTED_BODY', id })}
                buildBase={buildBase}
                setBaseFocus={setBaseFocus}
                refreshEvents={refreshEvents}
                resolveEvent={resolveEvent}
                runBaseOp={runBaseOp}
                crewBonusText={crewBonusText}
                format={format}
                bodyEvents={bodyEvents}
                formatDuration={formatDuration}
                isUnlockedUI={isUnlockedUI}
                scaledCost={scaledCost}
                withLogisticsCost={withLogisticsCost}
                costText={costText}
                canAffordUI={canAffordUI}
                costExpBase={COST_EXP.base}
              />
            )}
            {state.tab === 'crew' && (
              <CrewView
                state={state}
                hire={hire}
                rollRecruits={() => rollRecruits(true)}
                changeCrew={changeCrew}
                format={format}
                costText={costText}
              />
            )}
            {state.tab === 'tech' && (
              <TechView
                state={state}
                buyTech={buyTech}
                format={format}
                techDefs={TECH}
                hasPrereqs={hasPrereqs}
                canAffordUI={canAffordUI}
                costText={costText}
              />
            )}
            {state.tab === 'log' && <LogView log={state.log} />}
            {state.tab === 'profile' && (
              <ProfileView state={state} ascend={ascend} exportProfile={exportProfile} importProfile={importProfile} compact={compact} setCompact={setCompact} manualSave={manualSave} lastSaved={lastSaved} />
            )}
          </main>
        </div>
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

function ProfileView({ state, ascend, exportProfile, importProfile, compact, setCompact, manualSave, lastSaved }) {
  return (
    <section className="panel space-y-3">
      <div className="text-lg font-semibold">Profile</div>
      <div className="grid md:grid-cols-3 gap-3">
        <div className="card space-y-2">
          <div className="font-semibold">Prestige</div>
          <div className="text-sm text-muted">Reset for a global production boost. Current boost: {Math.round(((state.prestige?.boost || 1) - 1) * 100)}% · Points: {state.prestige?.points || 0}</div>
          <button className="btn" onClick={ascend}>Ascend & Reset</button>
          <div className="text-xs text-muted">Grants prestige based on total value. Progress auto-saves locally; refresh won't wipe.</div>
        </div>
        <div className="card space-y-2">
          <div className="font-semibold">Save / Import</div>
          <div className="text-sm text-muted">Profiles save locally (storage + cookie). Export/import to move between browsers.</div>
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={exportProfile}>Export</button>
            <button className="btn" onClick={importProfile}>Import</button>
            <button className="btn" onClick={manualSave}>Save now</button>
          </div>
          <div className="text-xs text-muted">Export copies a base64 string; import pastes it here. Last saved: {lastSaved ? new Date(lastSaved).toLocaleTimeString() : "never"}</div>
        </div>
        <div className="card space-y-2">
          <div className="font-semibold">Layout</div>
          <div className="text-sm text-muted">Toggle compact mode to reduce padding and tighten cards.</div>
          <label className="row">
            <span className="text-sm">Compact mode</span>
            <input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} />
          </label>
        </div>
      </div>
    </section>
  );
}

function HubView({ state, onCollect, onPulse, runLabPulse, buildHub, buyHubUpgrade, crewBonusText, ascend, format }) {
  const labCd = Math.max(0, (state.labReadyAt || 0) - Date.now());
  const pulseCost = Math.min(180, 60 + (state.pulseCount || 0) * 15);
  const briefing = [
    "Collect Signal then run a Pulse Scan (ramps 60+ signal, 8s CD) to convert signal into metal/fuel/research.",
    "First launch is fuel-free; Debris missions return early research + fuel.",
    "Build a Fuel Refinery or Fuel Cracker early to keep missions flowing.",
    "Keep power >= 0 and food positive to avoid morale drops.",
    "Use Research Console if fuel is low to bootstrap research.",
  ];
  const [showBuilds, setShowBuilds] = useState(true);
  const [showUpgrades, setShowUpgrades] = useState(true);
  const [showBrief, setShowBrief] = useState(false);
  return (
    <section className="panel space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Main Hub</div>
          <div className="text-muted text-sm">Launch expeditions, manage power, and scale signal.</div>
        </div>
      </div>
      <div className="text-xs text-muted">Pulse Scan ramps in cost each use and has an 8s cooldown. Spend signal for a small metal/fuel/research bump when you can’t launch yet.</div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="card">
          <div className="row row-between mb-1">
            <div className="font-semibold">Hub Buildings</div>
            <button className="btn" onClick={() => setShowBuilds((v) => !v)}>{showBuilds ? "Collapse" : "Expand"}</button>
          </div>
          {showBuilds && (
            <div className="list">
              {HUB_BUILDINGS.map((b) => {
                const level = state.hubBuildings[b.id] || 0;
                const can = canAffordUI(state.resources, scaledCost(b.cost, level, COST_EXP.hub));
                return (
                  <div key={b.id} className="row-item">
                    <div className="row-details">
                      <div className="row-title">{b.name} <span className="tag">Lv {level}</span></div>
                      <div className="row-meta">{b.desc}</div>
                      <div className="row-meta text-xs text-muted">Crew bonus: {crewBonusText(b.id)}</div>
                      <div className="row-meta text-xs text-muted">Next cost: {costText(scaledCost(b.cost, level, COST_EXP.hub), format)}</div>
                    </div>
                    <button className="btn" disabled={!can} onClick={() => buildHub(b.id)}>Build ({costText(scaledCost(b.cost, level, COST_EXP.hub), format)})</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="row row-between mb-1">
            <div className="font-semibold">Hub Upgrades</div>
            <button className="btn" onClick={() => setShowUpgrades((v) => !v)}>{showUpgrades ? "Collapse" : "Expand"}</button>
          </div>
          {showUpgrades && (
            <div className="list">
              {HUB_UPGRADES.map((u) => {
                const level = state.hubUpgrades[u.id] || 0;
                return (
                  <div key={u.id} className="row-item">
                    <div className="row-details">
                      <div className="row-title">{u.name} <span className="tag">Lv {level}</span></div>
                      <div className="row-meta">{u.desc}</div>
                    </div>
                    <button className="btn" disabled={!canAffordUI(state.resources, scaledCost(u.cost, level, COST_EXP.hub))} onClick={() => buyHubUpgrade(u.id)}>Upgrade ({costText(scaledCost(u.cost, level, COST_EXP.hub), format)})</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <div className="card space-y-2">
          <div className="font-semibold">Research Console</div>
          <div className="text-muted text-sm">Convert signal + metal into early research. Great when fuel is tight.</div>
          <button className="btn btn-primary w-full" onClick={runLabPulse} disabled={labCd > 0}>Pulse Lab {labCd > 0 ? `(${formatDuration(labCd)})` : ""}</button>
          <div className="text-muted text-xs">Cost: 60 signal, 20 metal · Yields 6 research · 20s cooldown</div>
        </div>
        <div className="card space-y-2">
          <div className="font-semibold">Hub Status</div>
          <div className="text-sm text-muted">Power {format(state.resources.power)} · Food {format(state.resources.food)} · Habitat {format(state.resources.habitat)}</div>
          <div className="text-sm text-muted">Morale {Math.round((state.workers.satisfaction || 1) * 100)}% · Workers {state.workers.total}</div>
          <div className="text-xs text-muted">Keep power non-negative and food above upkeep ({(state.workers.total * 0.2).toFixed(1)}/tick).</div>
        </div>
        <div className="card space-y-2">
          <div className="row row-between">
            <div className="font-semibold">Briefing & Controls</div>
            <button className="btn" onClick={() => setShowBrief((v) => !v)}>{showBrief ? "Hide" : "Show"}</button>
          </div>
          {showBrief && (
            <>
              <ul className="text-sm text-muted list-disc list-inside space-y-1">
                {briefing.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
              <div className="text-xs text-muted">Space: Collect · 1-7: Tabs · Arrow keys: cycle tabs</div>
            </>
          )}
        </div>
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

function focusBoost(focus, resourceKey) {
  if (focus === "production" && ["metal","organics","fuel","signal","rare"].includes(resourceKey)) return 1.2;
  if (focus === "sustain" && ["food","habitat","power"].includes(resourceKey)) return 1.2;
  if (focus === "morale" && resourceKey === "morale") return 1.25;
  return 1;
}

function missionModeById(id) { return MISSION_MODES.find((m) => m.id === id) || MISSION_MODES[0]; }
function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_KEY);
    const cookie = document.cookie.split("; ").find((c) => c.startsWith("signalFrontier="));
    const cookieData = cookie ? decodeURIComponent(cookie.split("=")[1]) : null;
    const data = raw || (cookieData ? atob(cookieData) : null);
    if (data) {
      const parsed = JSON.parse(data);
      return { ...initialState, ...parsed };
    }
  } catch (e) {
    console.warn("Failed to load state, starting fresh", e);
  }
  return initialState;
}
function scaledCost(baseCost, level, exp) {
  const out = {};
  Object.entries(baseCost || {}).forEach(([k, v]) => {
    out[k] = Math.ceil(v * Math.pow(exp || 1.1, level || 0));
  });
  return out;
}
function scaleCons(cons = {}, lvl = 1) { const out = {}; Object.entries(cons || {}).forEach(([k, v]) => out[k] = v * lvl); return out; }
function aggregateEventMods(base) {
  const mult = {};
  let moralePenalty = 0;
  (base?.events || []).forEach((ev) => {
    if (ev.status === "resolved") return;
    Object.entries(ev.effect?.mult || {}).forEach(([k, v]) => { mult[k] = (mult[k] || 1) * v; });
    moralePenalty += ev.effect?.moralePenalty || 0;
  });
  return { mult, moralePenalty };
}
function computeMorale(resources, rates, state, currentBase, eventMods, powerGate) {
  const foodUpkeep = state.workers.total * 0.2;
  const foodFactor = clamp((resources.food / Math.max(1, foodUpkeep)) * 0.9, 0.4, 1.25);
  const habitatFactor = clamp((resources.habitat || 0) / Math.max(1, state.workers.total), 0.5, 1.2);
  const powerFactor = powerGate ? 0.5 : 1;
  const unassigned = state.workers.total - Object.values(state.workers.assigned).reduce((a, b) => a + b, 0);
  const restFactor = clamp(0.9 + unassigned * 0.04, 0.85, 1.15);
  const missionHazard = (state.missions.active || []).reduce((acc, m) => acc + (m.hazard || 0), 0) / Math.max(1, (state.missions.active || []).length);
  const hazardPenalty = missionHazard * 0.3;
  const eventPenalty = (currentBase.events || []).length * 0.04 + (eventMods.moralePenalty || 0);
  const baseMorale = (foodFactor * 0.4) + (habitatFactor * 0.2) + (powerFactor * 0.15) + (restFactor * 0.15) - hazardPenalty - eventPenalty;
  return clamp(baseMorale + (rates.morale || 0), 0.35, 1.25);
}
function randomBetween(min, max) { return min + Math.random() * (max - min); }
function withLogisticsCost(cost, body) {
  const logisticsFuel = Math.max(2, Math.floor((body?.travel || 0) / 25));
  return { ...cost, fuel: (cost.fuel || 0) + logisticsFuel };
}
function reduceCargo(cargo, factor) { const out = {}; Object.entries(cargo).forEach(([k, v]) => out[k] = Math.floor(v * factor)); return out; }
function createEvent(body) {
  const pool = {
    asteroid: [
      { name: "Hull Breach", desc: "Power loss and morale drop until patched.", effect: { mult: { metal: 0.7 }, moralePenalty: 0.08 }, cost: { metal: 20 }, requiresRole: "engineer" },
      { name: "Dust Clog", desc: "Signal arrays sluggish.", effect: { mult: { signal: 0.6 } }, cost: { fuel: 6 }, requiresRole: "engineer" },
    ],
    ice: [
      { name: "Cryo Leak", desc: "Fuel bleeding off.", effect: { mult: { fuel: 0.5 } }, cost: { metal: 14, fuel: 6 }, requiresRole: "engineer" },
      { name: "Frostbite", desc: "Crew morale falling in the cold.", effect: { moralePenalty: 0.1 }, cost: { food: 8 }, requiresRole: "botanist" },
    ],
    warm: [
      { name: "Heat Stress", desc: "Systems throttled to avoid melt.", effect: { mult: { fuel: 0.7, metal: 0.8 } }, cost: { metal: 18 }, requiresRole: "engineer" },
      { name: "Dust Storm", desc: "Visibility down, morale slipping.", effect: { mult: { signal: 0.7 }, moralePenalty: 0.06 }, cost: { food: 6 }, requiresRole: "miner" },
    ],
    unknown: [
      { name: "Anomaly Surge", desc: "Strange readings disrupt output.", effect: { mult: { rare: 0.5, metal: 0.8 }, moralePenalty: 0.08 }, cost: { rare: 2, metal: 20 }, requiresRole: "engineer" },
    ],
  };
  const list = pool[body.type] || pool.asteroid;
  const pick = list[Math.floor(Math.random() * list.length)];
  return { id: `${body.id}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, bodyId: body.id, ...pick, status: "active" };
}
function missionYield(state, body, modeId, specialist = "none") {
  const base = body.resources || {};
  const drone = state.tech?.drone_log ? 0.2 : 0;
  const rareBonus = state.tech?.rift_mapping ? 0.2 : 0;
  const mult = 1 + drone + rareBonus;
  const mode = missionModeById(modeId);
  const cargo = {};
  Object.entries(base).forEach(([k, v]) => {
    const modeBoost = mode?.reward?.[k] ?? mode?.reward?.all ?? 1;
    let specBoost = 1;
    if (specialist === "miner" && (k === "metal" || k === "rare")) specBoost = 1.15;
    if (specialist === "botanist" && (k === "organics" || k === "fuel")) specBoost = 1.15;
    if (specialist === "engineer" && (k === "research")) specBoost = 1.1;
    cargo[k] = Math.floor(v * mult * modeBoost * specBoost);
  });
  return cargo;
}
function makeObjective(body) {
  const tables = {
    asteroid: [
      { desc: "Scan derelict hull for data cores", reward: { research: 10, metal: 15 }, rewardText: "+10 research +15 metal", failRisk: 0.25 },
      { desc: "Detour to salvage pods", reward: { fuel: 8, metal: 12 }, rewardText: "+8 fuel +12 metal", failRisk: 0.2 },
    ],
    ice: [
      { desc: "Sample cryo vents", reward: { organics: 12, fuel: 6 }, rewardText: "+12 organics +6 fuel", failRisk: 0.25 },
      { desc: "Deep crevasse scan", reward: { research: 14 }, rewardText: "+14 research", failRisk: 0.3 },
    ],
    warm: [
      { desc: "Investigate thermal plumes", reward: { rare: 3, metal: 18 }, rewardText: "+3 rare +18 metal", failRisk: 0.35 },
      { desc: "Shield calibration drill", reward: { fuel: 10, research: 10 }, rewardText: "+10 fuel +10 research", failRisk: 0.25 },
    ],
    unknown: [
      { desc: "Probe anomaly rift", reward: { rare: 5, research: 25 }, rewardText: "+5 rare +25 research", failRisk: 0.4 },
      { desc: "Anchor relay node", reward: { fuel: 16, signal: 40 }, rewardText: "+16 fuel +40 signal", failRisk: 0.3 },
    ],
  };
  const list = tables[body.type] || tables.asteroid;
  const pick = list[Math.floor(Math.random() * list.length)];
  return pick;
}
function combineCargo(base, bonus) {
  const out = { ...base };
  Object.entries(bonus || {}).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; });
  return out;
}
function hashStr(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 131 + str.charCodeAt(i)) >>> 0; }
  return h.toString(16);
}
function xorString(str, salt) {
  let out = "";
  for (let i = 0; i < str.length; i++) {
    out += String.fromCharCode(str.charCodeAt(i) ^ salt.charCodeAt(i % salt.length));
  }
  return out;
}
function hasPrereqs(state, tech) { return (tech.requires || []).every((id) => state.tech[id]); }
function canAffordUI(resources, cost) { return Object.entries(cost).every(([k, v]) => (resources[k] || 0) >= v); }
function costText(cost, format) { return Object.entries(cost).map(([k, v]) => `${format(v)} ${k}`).join(', '); }
function formatDuration(ms) { const sec = Math.max(0, Math.ceil(ms / 1000)); const m = Math.floor(sec / 60); const s = sec % 60; return m > 0 ? `${m}m ${s}s` : `${s}s`; }
function isUnlockedUI(state, body) {
  if (body.requireTech && !state.tech[body.requireTech]) return false;
  if (body.requireMissions && (state.milestones?.missionsDone || 0) < body.requireMissions) return false;
  return (state.resources.signal || 0) >= (body.unlock || 0);
}
