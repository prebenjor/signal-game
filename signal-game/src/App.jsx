
/**
 * Core app shell and game loop.
 * - State lives in a single reducer; see initialState and reducer cases.
 * - Auto-saves via persistState() to localStorage + cookie (key: signalFrontierReact), with export/import in Profile tab.
 * - Tick loop applies production, resolves missions/events, and keeps UI in sync.
 * - Tabs render via view components in src/views/ (Missions, Bases, Crew, Tech); pass helpers as props to keep logic centralized here.
 * Extend flow:
 *   * Add new resources/rates in initialState and bump compute loops in applyProduction().
 *   * Add new buildings/tech/targets by extending constants (HUB_BUILDINGS, TECH, BODIES, BIOME_BUILDINGS) and any unlock rules.
 *   * Use log() for player feedback; use bumpResources/spend to modify economy.
 */
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
const MAX_EVENTS_PER_BASE = 4;
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
    { id: "maintenance_bay", name: "Maintenance Bay", desc: "+2 maintenance cap", cost: { metal: 110, fuel: 10 }, prod: {}, cons: { power: 1 }, maintenanceCap: 2 },
    { id: "fuel_cracker", name: "Fuel Cracker", desc: "+2 fuel/tick", cost: { metal: 90 }, prod: { fuel: 2 }, cons: { power: 1 } },
    { id: "ore_rig", name: "Ore Rig", desc: "+4 metal/tick", cost: { metal: 120 }, prod: { metal: 4 }, cons: { power: 1 } },
    { id: "solar_sail", name: "Solar Sail", desc: "+2 power/tick", cost: { metal: 70 }, prod: { power: 2 }, cons: {} },
    { id: "cargo_rig", name: "Cargo Rig", desc: "Rig branch: +12% mission cargo from this base", cost: { metal: 220, fuel: 30 }, prod: {}, cons: { power: 1 }, requires: [{ id: "ore_rig", level: 3 }], cargoMult: 1.12, group: "rig_branch" },
    { id: "core_rig", name: "Core Rig", desc: "Rig branch: +3 rare/tick, +4 metal/tick", cost: { metal: 260, fuel: 40 }, prod: { rare: 3, metal: 4 }, cons: { power: 2 }, requires: [{ id: "ore_rig", level: 3 }], group: "rig_branch" },
    { id: "logistics_depot", name: "Logistics Depot", desc: "+5% cargo, -5% travel time", cost: { metal: 180, fuel: 20 }, prod: {}, cons: { power: 1 }, cargoMult: 1.05, travelMult: 0.95 },
    { id: "core_tap", name: "Core Tap", desc: "+6 metal/tick, +1 rare/tick", cost: { metal: 260, fuel: 50 }, prod: { metal: 6, rare: 1 }, cons: { power: 2 }, requires: [{ id: "ore_rig", level: 2 }] },
    { id: "orbital_foundry", name: "Orbital Foundry", desc: "+3 rare/tick, +10% mission cargo from this base (applied in cargo calc)", cost: { metal: 320, rare: 12 }, prod: { rare: 3 }, cons: { power: 2 }, requires: [{ id: "core_tap", level: 1 }], cargoMult: 1.1 },
  ],
  ice: [
    { id: "maintenance_bay", name: "Maintenance Bay", desc: "+2 maintenance cap", cost: { metal: 110, fuel: 10 }, prod: {}, cons: { power: 1 }, maintenanceCap: 2 },
    { id: "thermal_pump", name: "Thermal Pump", desc: "+3 fuel/tick", cost: { metal: 110, fuel: 16 }, prod: { fuel: 3 }, cons: { power: 1 } },
    { id: "algae_farm", name: "Algae Farm", desc: "+3 food/tick", cost: { metal: 90, organics: 40 }, prod: { food: 3 }, cons: { power: 1 } },
    { id: "protein_farm", name: "Protein Farm", desc: "Algae branch: +5 food/tick, +2% morale", cost: { metal: 180, organics: 70 }, prod: { food: 5, morale: 0.02 }, cons: { power: 1 }, requires: [{ id: "algae_farm", level: 3 }], group: "algae_branch" },
    { id: "bio_reactor", name: "Bio-Reactor", desc: "Algae branch: food -> power/fuel", cost: { metal: 200, organics: 80, fuel: 20 }, prod: { power: 2, fuel: 2 }, cons: { food: 1 }, requires: [{ id: "algae_farm", level: 3 }], group: "algae_branch" },
    { id: "logistics_depot", name: "Logistics Depot", desc: "+5% cargo, -5% travel time", cost: { metal: 180, fuel: 20 }, prod: {}, cons: { power: 1 }, cargoMult: 1.05, travelMult: 0.95 },
    { id: "cryo_distillery", name: "Cryo Distillery", desc: "Converts organics to fuel (+3 fuel/tick, -1 organics/tick)", cost: { metal: 200, organics: 80 }, prod: { fuel: 3 }, cons: { organics: 1, power: 1 }, requires: [{ id: "thermal_pump", level: 2 }] },
    { id: "glacier_observatory", name: "Glacier Observatory", desc: "+3 research/tick", cost: { metal: 260, fuel: 40 }, prod: { research: 3 }, cons: { power: 2 }, requires: [{ id: "cryo_distillery", level: 1 }] },
  ],
  warm: [
    { id: "maintenance_bay", name: "Maintenance Bay", desc: "+2 maintenance cap", cost: { metal: 110, fuel: 10 }, prod: {}, cons: { power: 1 }, maintenanceCap: 2 },
    { id: "shield_dome", name: "Shield Dome", desc: "-20% hazard on missions from this base", cost: { metal: 140, fuel: 20 }, prod: {}, cons: { power: 1 }, hazardMult: 0.8 },
    { id: "vapor_trap", name: "Vapor Trap", desc: "+2 organics/tick", cost: { metal: 90, fuel: 12 }, prod: { organics: 2 }, cons: {} },
    { id: "interceptor_net", name: "Interceptor Net", desc: "Shield branch: -35% hazard, -10% travel time", cost: { metal: 220, fuel: 50 }, prod: {}, cons: { power: 2 }, requires: [{ id: "shield_dome", level: 2 }], hazardMult: 0.65, travelMult: 0.9, group: "shield_branch" },
    { id: "comfort_dome", name: "Comfort Dome", desc: "Shield branch: +6% morale, events less severe", cost: { metal: 200, organics: 90 }, prod: { morale: 0.06 }, cons: { power: 1 }, requires: [{ id: "shield_dome", level: 2 }], group: "shield_branch" },
    { id: "logistics_depot", name: "Logistics Depot", desc: "+5% cargo, -5% travel time", cost: { metal: 180, fuel: 20 }, prod: {}, cons: { power: 1 }, cargoMult: 1.05, travelMult: 0.95 },
    { id: "plasma_furnace", name: "Plasma Furnace", desc: "+6 power/tick, +4 metal/tick", cost: { metal: 240, fuel: 60 }, prod: { power: 6, metal: 4 }, cons: { fuel: 2 } },
    { id: "shield_spire", name: "Shield Spire", desc: "Greatly reduces hazard; boosts morale", cost: { metal: 280, fuel: 80 }, prod: { morale: 0.08 }, cons: { power: 2 }, requires: [{ id: "shield_dome", level: 1 }], hazardMult: 0.7 },
  ],
  unknown: [
    { id: "maintenance_bay", name: "Maintenance Bay", desc: "+2 maintenance cap", cost: { metal: 110, fuel: 10 }, prod: {}, cons: { power: 1 }, maintenanceCap: 2 },
    { id: "anomaly_lab", name: "Anomaly Lab", desc: "+1 rare/tick", cost: { metal: 160, rare: 8 }, prod: { rare: 1 }, cons: { power: 1 } },
    { id: "relay_spire", name: "Relay Spire", desc: "Lab branch: +8% cargo, -8% travel time", cost: { metal: 240, rare: 10, fuel: 40 }, prod: {}, cons: { power: 2 }, requires: [{ id: "anomaly_lab", level: 2 }], cargoMult: 1.08, travelMult: 0.92, group: "lab_branch" },
    { id: "ward_matrix", name: "Ward Matrix", desc: "Lab branch: -40% hazard, +2 rare/tick", cost: { metal: 260, rare: 12 }, prod: { rare: 2 }, cons: { power: 2 }, requires: [{ id: "anomaly_lab", level: 2 }], hazardMult: 0.6, group: "lab_branch" },
    { id: "logistics_depot", name: "Logistics Depot", desc: "+5% cargo, -5% travel time", cost: { metal: 180, fuel: 20 }, prod: {}, cons: { power: 1 }, cargoMult: 1.05, travelMult: 0.95 },
    { id: "phase_relay", name: "Phase Relay", desc: "+4 signal/tick, -travel time for missions", cost: { metal: 240, rare: 10, fuel: 40 }, prod: { signal: 4 }, cons: { power: 2 }, travelMult: 0.85 },
    { id: "anomaly_vault", name: "Anomaly Vault", desc: "+4 rare/tick, +4 research/tick", cost: { metal: 320, rare: 16 }, prod: { rare: 4, research: 4 }, cons: { power: 2 }, requires: [{ id: "anomaly_lab", level: 2 }] },
  ],
};

const BASE_TRAITS = {
  asteroid: [
    { id: "rich_veins", name: "Rich Veins", desc: "Metal output +15%, events slightly more frequent.", effects: { prod: { metal: 1.15 }, eventMult: 0.9 } },
    { id: "brittle_shell", name: "Brittle Shell", desc: "Hazards +8%, maintenance cap +1.", effects: { hazardMult: 1.08, maintenanceCap: 1 } },
    { id: "stable_orbit", name: "Stable Orbit", desc: "Travel time -6%.", effects: { travelMult: 0.94 } },
  ],
  ice: [
    { id: "cryo_core", name: "Cryo Core", desc: "Fuel output +12%, events less frequent.", effects: { prod: { fuel: 1.12 }, eventMult: 1.1 } },
    { id: "algae_bloom", name: "Algae Bloom", desc: "Food output +15%, morale +2%.", effects: { prod: { food: 1.15 }, morale: 0.02 } },
    { id: "thin_ice", name: "Thin Ice", desc: "Hazards +10%, travel -4%.", effects: { hazardMult: 1.1, travelMult: 0.96 } },
  ],
  warm: [
    { id: "thermal_plumes", name: "Thermal Plumes", desc: "Power output +12%, hazards +6%.", effects: { prod: { power: 1.12 }, hazardMult: 1.06 } },
    { id: "stable_crust", name: "Stable Crust", desc: "Hazards -10%, maintenance cap +1.", effects: { hazardMult: 0.9, maintenanceCap: 1 } },
    { id: "dense_atmos", name: "Dense Atmosphere", desc: "Organics output +12%, travel +6%.", effects: { prod: { organics: 1.12 }, travelMult: 1.06 } },
  ],
  unknown: [
    { id: "echo_rift", name: "Echo Rift", desc: "Research +15%, events slightly more frequent.", effects: { prod: { research: 1.15 }, eventMult: 0.9 } },
    { id: "phase_static", name: "Phase Static", desc: "Travel -8%, hazards +6%.", effects: { travelMult: 0.92, hazardMult: 1.06 } },
    { id: "ancient_signal", name: "Ancient Signal", desc: "Signal +15%, cargo +6%.", effects: { prod: { signal: 1.15 }, cargoMult: 1.06 } },
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
function defaultBaseState(body) {
  return {
    buildings: {},
    events: [],
    focus: "balanced",
    nextEventAt: Date.now() + randomBetween(...EVENT_COOLDOWN_MS),
    opsReadyAt: 0,
    traits: body ? rollTraits(body) : [],
  };
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
  const currentBody = selectedBody();
  const currentBase = useMemo(() => ensureBaseState(state.bases[state.selectedBody], currentBody), [state.bases, state.selectedBody]);
  const currentTraits = baseTraitList(currentBase);
  const currentMaintenance = baseMaintenanceStats(currentBase);

  useEffect(() => {
    if (!state.bases[state.selectedBody]) {
      const base = defaultBaseState(currentBody);
      dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [currentBody.id]: base } } });
    }
  }, [state.selectedBody, state.bases]);

  useEffect(() => { stateRef.current = state; }, [state]);

  // Persist current in-memory state to storage (localStorage + cookie).
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

  // Manual save trigger used by Profile tab.
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

  // Primary click action; scales later via upgrades/bonuses.
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

  // Apply resource delta; used across economy adjustments.
  function bumpResources(delta) {
    dispatch({ type: "UPDATE", patch: { resources: Object.keys(delta).reduce((acc, key) => { acc[key] = Math.max(0, (state.resources[key] || 0) + delta[key]); return acc; }, { ...state.resources }) } });
  }

  function log(text) { dispatch({ type: "LOG", text }); }

  // Per-tick production: aggregates hub/base output, morale, focus, hazards, and power gating.
  function applyProduction() {
    const r = { ...state.resources };
    const contributions = [];
    const eventMods = aggregateEventMods(currentBase);
    const traitMods = traitEffects(currentBase.traits);
    const maintenance = baseMaintenanceStats(currentBase);

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
      const prod = {};
      Object.entries(def.prod || {}).forEach(([k, v]) => {
        const traitMult = traitMods.prod[k] || 1;
        prod[k] = v * lvl * workerMult(id) * focusBoost(focus, k) * (eventMods.mult[k] || 1) * traitMult * (maintenance.factor || 1);
      });
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
    rates.morale = (rates.morale || 0) + (traitMods.morale || 0);

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

  // Settle completed missions; applies cargo, objectives, failure risk, and logs.
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

  // Rolls base events and keeps per-body event timers moving.
  function processEvents() {
    const now = Date.now();
    const bases = { ...state.bases };
    let changed = false;
    BODIES.forEach((body) => {
      if (!isUnlocked(body)) return;
      const base = ensureBaseState(bases[body.id], body);
      if (!bases[body.id]) { bases[body.id] = base; changed = true; }
      const maintenance = baseMaintenanceStats(base);
      const traitMods = traitEffects(base.traits);
      if (!base.nextEventAt) base.nextEventAt = now + randomBetween(...EVENT_COOLDOWN_MS);
      if (now >= base.nextEventAt) {
        if ((base.events || []).length < MAX_EVENTS_PER_BASE) {
          base.events = [...(base.events || []), createEvent(body)];
          log(`Event at ${body.name}: ${base.events[base.events.length - 1].name}`);
        }
        const eventMult = (traitMods.eventMult || 1) * (maintenance.over ? 0.7 : 1);
        base.nextEventAt = now + randomBetween(...EVENT_COOLDOWN_MS) * eventMult;
        bases[body.id] = base; changed = true;
      }
    });
    if (changed) dispatch({ type: "UPDATE", patch: { bases } });
  }

  // Launch mission with stance/specialist; charges fuel logistics and schedules resolution.
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
    const bonuses = baseBonuses(state, body.id);
    const hazardBase = body.hazard - (state.tech.hazard_gear ? 0.25 : 0) - (state.tech.shielding ? 0.2 : 0) + (mode?.hazard || 0) + (specialist === "engineer" ? -0.1 : 0);
    const hazard = Math.max(0, hazardBase * (bonuses.hazard || 1));
    const duration = Math.max(15000, ((body.travel * 1000 * (bonuses.travel || 1)) - fuelBoost * 3000 + (mode?.durationMs || 0)) * (state.tech.auto_pilots ? 0.9 : 1));
    const objective = Math.random() < 0.3 ? makeObjective(body) : null;
    const mission = { bodyId: body.id, endsAt: Date.now() + duration, hazard, mode: modeId, specialist, objective };
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

  // Build/level hub structures; scales cost by COST_EXP.hub.
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

  // Build/level biome structures on the focused base; includes logistics fuel cost.
  function buildBase(id) {
    const def = biomeBuildingById(id); if (!def) return;
    const level = (state.bases[state.selectedBody]?.buildings?.[id] || 0);
    const base = ensureBaseState(state.bases[state.selectedBody], selectedBody());
    if (!requirementsMet(base, def)) { log("Requirements not met for this structure."); return; }
    const cost = withLogisticsCost(scaledCost(def.cost, level, COST_EXP.base), selectedBody());
    if (!canAfford(cost)) { log("Not enough resources (includes logistics fuel)."); return; }
    spend(cost);
    const newBase = { ...base, buildings: { ...base.buildings, [id]: (base.buildings[id] || 0) + 1 } };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [state.selectedBody]: newBase } } });
    log(`Built ${def.name} on ${selectedBody().name} (logistics fuel included).`);
  }

  function setBaseFocus(focus) {
    const base = ensureBaseState(state.bases[state.selectedBody], selectedBody());
    const updated = { ...base, focus };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [state.selectedBody]: updated } } });
    log(`Outpost focus set to ${focus}.`);
  }

  function refreshEvents() {
    const base = ensureBaseState(state.bases[state.selectedBody], selectedBody());
    const updated = { ...base, events: bodyEvents(selectedBody()) };
    dispatch({ type: "UPDATE", patch: { bases: { ...state.bases, [state.selectedBody]: updated } } });
    log("Local events refreshed.");
  }

  function selectedBody() { return BODIES.find((b) => b.id === state.selectedBody) || BODIES[0]; }

  function canAfford(cost) { return Object.entries(cost).every(([k, v]) => (state.resources[k] || 0) >= v); }

  // Spend helper; clamps to zero and updates state in one place.
  function spend(cost) { const r = { ...state.resources }; Object.entries(cost).forEach(([k, v]) => { r[k] = Math.max(0, r[k] - v); }); dispatch({ type: "UPDATE", patch: { resources: r } }); }

  // Research tech; enforces prereqs and reveals gated targets.
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

  // Prestige/reset with boost based on total value.
  function ascend() {
    const totalValue = (state.resources.signal || 0) + (state.resources.metal || 0) + (state.resources.research || 0) * 5 + (state.resources.rare || 0) * 20;
    const points = Math.max(1, Math.floor(totalValue / 5000));
    const prestige = { points: (state.prestige?.points || 0) + points, runs: (state.prestige?.runs || 0) + 1, boost: 1 + ((state.prestige?.points || 0) + points) * 0.02 };
    const resetState = { ...initialState, prestige };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resetState));
    dispatch({ type: "LOAD", payload: resetState });
    log(`Ascended for ${points} prestige. Global production boost now ${Math.round((prestige.boost - 1) * 100)}%.`);
  }

  // Export obfuscated profile blob for cross-browser transfer.
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

  // Import profile blob (base64+xor) and overwrite current state.
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
    const base = ensureBaseState(state.bases[bodyId], bodyById(bodyId));
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
    const base = ensureBaseState(state.bases[bodyId], bodyById(bodyId));
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
      <div className="w-full max-w-screen-2xl mx-auto px-3 sm:px-5 lg:px-8 pt-6 flex flex-col gap-4">
        <header className="panel flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <div className="inline-flex px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs tracking-[0.1em] font-semibold">Signal Frontier</div>
              <div className="text-muted text-sm mt-1">Scan, settle, and build outposts across the void.</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary w-full sm:w-auto" onClick={collectSignal}>Collect Signal (Space)</button>
              <button className="btn w-full sm:w-auto" disabled={state.resources.signal < Math.min(180, 60 + (state.pulseCount || 0) * 15) || state.pulseReadyAt > Date.now()} onClick={pulseScan}>Pulse Scan</button>
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
                baseBonuses={(id) => baseBonuses(state, id)}
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
                requirementsMet={requirementsMet}
                baseTraits={currentTraits}
                maintenanceStats={currentMaintenance}
                baseBonuses={(id) => baseBonuses(state, id)}
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
function requirementsMet(base, building) {
  const prereqs = building.requires ? building.requires.every((req) => (base.buildings?.[req.id] || 0) >= (req.level || 1)) : true;
  const groupOk = building.group ? !Object.entries(base.buildings || {}).some(([id, lvl]) => {
    if (lvl <= 0) return false;
    const def = Object.values(BIOME_BUILDINGS).flat().find((b) => b.id === id);
    return def?.group && def.group === building.group && id !== building.id;
  }) : true;
  return prereqs && groupOk;
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
function traitById(id) {
  return Object.values(BASE_TRAITS).flat().find((t) => t.id === id);
}
function rollTraits(body) {
  const pool = BASE_TRAITS[body.type] || [];
  const count = pool.length >= 2 ? 2 : 1;
  const picks = [];
  while (picks.length < count && pool.length) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!picks.includes(pick.id)) picks.push(pick.id);
  }
  return picks;
}
function traitEffects(traitIds = []) {
  const out = { prod: {}, hazardMult: 1, travelMult: 1, cargoMult: 1, eventMult: 1, maintenanceCap: 0, morale: 0 };
  traitIds.forEach((id) => {
    const trait = traitById(id);
    if (!trait?.effects) return;
    Object.entries(trait.effects.prod || {}).forEach(([k, v]) => {
      out.prod[k] = (out.prod[k] || 1) * v;
    });
    if (trait.effects.hazardMult) out.hazardMult *= trait.effects.hazardMult;
    if (trait.effects.travelMult) out.travelMult *= trait.effects.travelMult;
    if (trait.effects.cargoMult) out.cargoMult *= trait.effects.cargoMult;
    if (trait.effects.eventMult) out.eventMult *= trait.effects.eventMult;
    if (trait.effects.maintenanceCap) out.maintenanceCap += trait.effects.maintenanceCap;
    if (trait.effects.morale) out.morale += trait.effects.morale;
  });
  return out;
}
function baseMaintenanceStats(base) {
  const used = Object.values(base.buildings || {}).reduce((sum, lvl) => sum + (lvl || 0), 0);
  const cap = 4 + ((base.buildings?.maintenance_bay || 0) * 2) + (traitEffects(base.traits).maintenanceCap || 0);
  const over = used > cap;
  const factor = over ? Math.max(0.6, 1 - (used - cap) * 0.08) : 1;
  return { used, cap, over, factor };
}
function ensureBaseState(base, body) {
  if (base) {
    if (!base.traits?.length) return { ...base, traits: rollTraits(body) };
    return base;
  }
  return defaultBaseState(body);
}
function baseTraitList(base) {
  return (base.traits || []).map(traitById).filter(Boolean);
}
function baseBonuses(stateObj, bodyId) {
  const body = BODIES.find((b) => b.id === bodyId);
  const defs = body ? BIOME_BUILDINGS[body.type] || [] : [];
  const base = ensureBaseState(stateObj?.bases?.[bodyId], body || BODIES[0]);
  const traits = traitEffects(base.traits);
  let cargo = traits.cargoMult || 1;
  let travel = traits.travelMult || 1;
  let hazard = traits.hazardMult || 1;
  Object.entries(base.buildings || {}).forEach(([id, lvl]) => {
    const def = defs.find((d) => d.id === id);
    if (!def) return;
    if (def.cargoMult) cargo *= Math.pow(def.cargoMult, lvl || 0);
    if (def.travelMult) travel *= Math.pow(def.travelMult, lvl || 0);
    if (def.hazardMult) hazard *= Math.pow(def.hazardMult, lvl || 0);
  });
  return { cargo, travel, hazard };
}
function bodyById(id) { return BODIES.find((b) => b.id === id) || BODIES[0]; }
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
  const bonuses = baseBonuses(state, body.id);
  const mode = missionModeById(modeId);
  const cargo = {};
  Object.entries(base).forEach(([k, v]) => {
    const modeBoost = mode?.reward?.[k] ?? mode?.reward?.all ?? 1;
    let specBoost = 1;
    if (specialist === "miner" && (k === "metal" || k === "rare")) specBoost = 1.15;
    if (specialist === "botanist" && (k === "organics" || k === "fuel")) specBoost = 1.15;
    if (specialist === "engineer" && (k === "research")) specBoost = 1.1;
    cargo[k] = Math.floor(v * mult * modeBoost * specBoost * (bonuses.cargo || 1));
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
