
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
const SAVE_VERSION = 10;
const TAB_ORDER = ["hub", "missions", "bases", "crew", "tech", "systems", "codex", "log", "profile"];
const EVENT_COOLDOWN_MS = [45000, 90000];
const PACE = {
  costExp: { hub: 1.18, base: 1.22, crew: 1.25 },
  techCostMult: 1.4,
  techUnlockMult: 1.5,
  bodyUnlockMult: 1.5,
  missionDurationMult: 1.6,
  missionYieldMult: 0.85,
  pulseCostBase: 100,
  pulseCostStep: 25,
  pulseCostCap: 300,
  pulseCooldownMs: 12000,
  pulseYieldMult: 0.75,
  labCooldownMs: 30000,
  labCostMult: 1.4,
  labYieldMult: 0.85,
  manualSignalCooldownMs: 350,
  surveyDurationMult: 1.5,
  integrationDurationMult: 1.6,
};
const CREW_FATIGUE = { gain: 0.00006, recovery: 0.0001 };
const CONTRACT_REFRESH_MS = 180000;
const COST_EXP = PACE.costExp;
const SYSTEM_EVENT_COOLDOWN_MS = [90000, 180000];
const MAX_SYSTEM_EVENTS = 3;

const BODIES = [
  { id: "debris", name: "Debris Field", type: "asteroid", tier: 1, travel: 30, hazard: 0.05, unlock: 0, resources: { metal: 18, fuel: 4, research: 3 } },
  { id: "ice", name: "Ice Moon", type: "ice", tier: 2, travel: 60, hazard: 0.12, unlock: 400, resources: { organics: 25, fuel: 10, research: 5 } },
  { id: "lava", name: "Lava Rock", type: "warm", tier: 3, travel: 90, hazard: 0.2, unlock: 1200, resources: { metal: 50, rare: 3, research: 10 } },
  { id: "cradle", name: "Cradle Station", type: "asteroid", tier: 4, travel: 120, hazard: 0.18, unlock: 2400, requireTech: "deep_scan", resources: { fuel: 26, research: 22, rare: 8 } },
  { id: "ruins", name: "Fallen Relay", type: "warm", tier: 5, travel: 140, hazard: 0.22, unlock: 3800, requireTech: "shielding", resources: { metal: 160, research: 80, rare: 18 } },
  { id: "rift", name: "Rift Beacon", type: "unknown", tier: 6, travel: 180, hazard: 0.3, unlock: 6200, requireTech: "rift_mapping", resources: { fuel: 90, research: 140, rare: 30 } },
  { id: "spire", name: "Veil Spire", type: "unknown", tier: 7, travel: 210, hazard: 0.35, unlock: 8200, requireTech: "rift_mapping", requireMissions: 5, resources: { research: 200, rare: 40, fuel: 120 } },
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

const CODEX_ENTRIES = [
  { id: "foundations", title: "Baseline Foundations", body: "Save versioning, capability gating, and milestone triggers keep the loop stable as the frontier expands." },
  { id: "scan_ops", title: "Signal Scans", body: "Manual signal collection and pulse scans are your early lifeline for fuel, metal, and research." },
  { id: "mission_ops", title: "Mission Ops", body: "Targets have depletion curves. Expect diminishing returns as you farm the same body." },
  { id: "hub_ops", title: "Hub Operations", body: "Hub upgrades expand range and slot capacity, unlocking higher-tier targets." },
  { id: "tech_ops", title: "Research Tracks", body: "Tech branches unlock new targets and efficiency tools." },
  { id: "local_ops", title: "Local Signal Operations", body: "Early missions and range upgrades push you toward the first system discovery threshold." },
  { id: "systems_light", title: "System Discovery", body: "Systems are persistent entities with traits and distance. Survey chains unlock colonisable worlds." },
  { id: "colonies_anchor", title: "First Colony Anchors", body: "Colonies add hub modifiers and consume command capacity, forcing trade-offs." },
  { id: "integration_projects", title: "Integration Projects", body: "Multi-day projects stabilize systems and change global rules like travel penalties and event rates." },
  { id: "galaxy_ops", title: "Galaxy Operations", body: "Galaxies reshape the rules. Chart new ones once integrations are stable to unlock new modifiers." },
  { id: "doctrine_ops", title: "Doctrine Shifts", body: "Prestige unlocks doctrines. Each doctrine changes core efficiencies and constraints." },
  { id: "prestige_recalibration", title: "Signal Recalibration", body: "Prestige resets the frontier for legacy perks and faster early cycles." },
];

const MILESTONES = [
  { id: "M0_FOUNDATIONS", title: "Foundations Online", codexEntryId: "foundations", condition: (state) => true },
  { id: "M1_LOCAL_OPS", title: "Local Operations", codexEntryId: "local_ops", condition: (state) => (state.milestones?.missionsDone || 0) >= 1 || !!state.milestones?.firstLaunch },
  { id: "M2_SYSTEMS_DISCOVERED", title: "Systems Unlocked", codexEntryId: "systems_light", condition: (state) => hubRange(state) >= 3 },
  { id: "M2_FIRST_COLONY", title: "First Colony", codexEntryId: "colonies_anchor", condition: (state) => (state.colonies || []).length >= 1 },
  { id: "M3_INTEGRATION_UNLOCK", title: "Integration Projects", codexEntryId: "integration_projects", condition: (state) => (state.systems || []).some((s) => s.integratedAt) },
  { id: "M4_GALAXY_CHARTED", title: "Galaxy Charted", codexEntryId: "galaxy_ops", condition: (state) => galaxyDepth(state) >= 2 },
  { id: "M5_DOCTRINE_SELECTED", title: "Doctrine Selected", codexEntryId: "doctrine_ops", condition: (state) => !!state.doctrine },
  { id: "M4_PRESTIGE_UNLOCK", title: "Prestige Ready", codexEntryId: "prestige_recalibration", condition: (state) => galaxyDepth(state) >= 2 && (state.systems || []).filter((s) => s.integratedAt).length >= 2 && signalSaturation(state).penalty >= 0.25 },
];

const MISSION_MODES = [
  { id: "balanced", name: "Balanced", desc: "Standard risk and rewards.", hazard: 0, durationMs: 0, reward: {} },
  { id: "survey", name: "Survey", desc: "+60% research, slower travel, lower cargo", hazard: 0.04, durationMs: 8000, reward: { research: 1.6, all: 0.9 } },
  { id: "salvage", name: "Salvage", desc: "+30% metal/organics cargo, small hazard bump", hazard: 0.06, durationMs: 0, reward: { metal: 1.3, organics: 1.3 } },
  { id: "secure", name: "Secure", desc: "-35% hazard, longer flight, -10% cargo", hazard: -0.35, durationMs: 6000, reward: { all: 0.9 } },
  { id: "relay", name: "Relay", desc: "+25% fuel & signal cargo, modest hazard", hazard: 0.08, durationMs: -2000, reward: { fuel: 1.25, signal: 1.25 } },
];
const SYSTEM_NAME_PARTS = {
  prefix: ["Astra", "Helix", "Orion", "Vanta", "Nyx", "Vega", "Argo", "Lumen", "Cinder", "Atlas"],
  suffix: ["Reach", "Drift", "Nexus", "Vale", "Crown", "Ridge", "Spur", "Gate", "Span", "Haven"],
};
const SYSTEM_TRAITS = [
  { id: "rich_metal", name: "Rich Metal", desc: "Dense ore belts and higher extraction yields." },
  { id: "high_resonance", name: "High Resonance", desc: "Scan returns trend higher, but surveys are slower." },
  { id: "quiet_orbit", name: "Quiet Orbit", desc: "Lower event frequency; stability holds longer." },
  { id: "debris_field", name: "Debris Field", desc: "Salvage opportunities increase mission cargo." },
  { id: "ion_storms", name: "Ion Storms", desc: "Hazards spike on aggressive runs." },
  { id: "ancient_relay", name: "Ancient Relay", desc: "Legacy infrastructure boosts travel efficiency." },
];
const SYSTEM_SURVEY_STEPS = {
  scan: { id: "scan", name: "Deep Scan", cost: { signal: 160 }, duration: 20000 },
  probe: { id: "probe", name: "Probe Drop", cost: { metal: 60, fuel: 18 }, duration: 30000 },
  survey: { id: "survey", name: "Full Survey", cost: { research: 30, fuel: 30 }, duration: 42000 },
};
const SURVEY_SEQUENCE = ["scan", "probe", "survey", "colonize", "colonized"];
const COLONY_ROLES = [
  { id: "relay", name: "Relay Anchor", desc: "Extends hub range and trims travel times." },
  { id: "survey", name: "Survey Anchor", desc: "Improves scan yield and survey throughput." },
  { id: "logistics", name: "Logistics Anchor", desc: "Improves mission throughput and travel efficiency." },
];
const COLONY_COST = { metal: 180, fuel: 60, food: 20, organics: 12 };
const CREW_PROGRAMS = [
  { id: "mission_corps", name: "Mission Corps", desc: "Standardized mission playbooks: higher cargo, more objectives, lower hazard.", unlock: { milestone: "M1_LOCAL_OPS" }, cost: { research: 20, metal: 60, food: 10 } },
  { id: "base_command", name: "Base Command", desc: "Outpost command training reduces event frequency and steadies recovery.", unlock: { milestone: "M2_FIRST_COLONY" }, cost: { research: 30, metal: 80, organics: 20 } },
  { id: "science_guild", name: "Science Guild", desc: "Research mentorship improves scans and mission research yields.", unlock: { tech: "deep_scan" }, cost: { research: 35, signal: 120, organics: 24 } },
  { id: "logistics_wing", name: "Logistics Wing", desc: "Improves travel efficiency and lowers fuel overhead.", unlock: { milestone: "M2_SYSTEMS_DISCOVERED" }, cost: { metal: 90, fuel: 30, food: 12 } },
  { id: "morale_office", name: "Morale Office", desc: "Crew counseling boosts morale stability across hubs and outposts.", unlock: { milestone: "M3_INTEGRATION_UNLOCK" }, cost: { food: 30, organics: 30, research: 20 } },
];
const CREW_CONTRACTS = [
  {
    id: "salvage_ace",
    name: "Salvage Ace",
    role: "miner",
    trait: "+20% to miner output",
    perk: "Improves metal/rare salvage from missions.",
    bonus: 0.2,
    durationMs: 21600000,
    cost: { metal: 120, fuel: 18, food: 10 },
    mods: { cargoMult: 1.06, missionMult: { metal: 1.08, rare: 1.06 } },
  },
  {
    id: "hydro_grower",
    name: "Hydroponics Grower",
    role: "botanist",
    trait: "+18% to botanist output",
    perk: "Food and organics output improved.",
    bonus: 0.18,
    durationMs: 21600000,
    cost: { organics: 40, food: 20, metal: 60 },
    mods: { prodMult: { food: 1.12, organics: 1.08 }, moraleBonus: 0.01 },
  },
  {
    id: "systems_artisan",
    name: "Systems Artisan",
    role: "engineer",
    trait: "+22% to engineer output",
    perk: "Base incidents slow down and hazards ease.",
    bonus: 0.22,
    durationMs: 21600000,
    cost: { metal: 140, fuel: 24, research: 14 },
    mods: { baseEventRateMult: 0.9, systemEventRateMult: 0.92, hazardMult: 0.95 },
  },
  {
    id: "relay_tactician",
    name: "Relay Tactician",
    role: "engineer",
    trait: "+16% engineer output, mission hazard eased",
    perk: "Travel improves and scans get sharper.",
    bonus: 0.16,
    durationMs: 18000000,
    cost: { metal: 110, fuel: 20, research: 10 },
    mods: { travelMult: 0.92, hazardMult: 0.94, scanMult: 1.05 },
  },
];
const SYSTEM_EVENTS = [
  { id: "supply_shortage", name: "Supply Shortage", desc: "Cargo throughput reduced until resupplied.", effect: { cargoMult: 0.85 }, cost: { food: 12, fuel: 10 } },
  { id: "crew_friction", name: "Crew Friction", desc: "Survey pace slowed; scans feel noisy.", effect: { surveySpeed: 1.1, scanMult: 0.9 }, cost: { food: 8, organics: 8 } },
  { id: "interference_spike", name: "Interference Spike", desc: "Travel time rises; hazards intensify.", effect: { travelMult: 1.12, hazardMult: 1.08 }, cost: { signal: 120, metal: 20 } },
  { id: "anomaly_bloom", name: "Anomaly Bloom", desc: "Strange pulses unsettle crews but enrich data.", effect: { cargoMult: 1.05, stabilityDrain: 0.02 }, cost: { research: 20, fuel: 12 } },
];
const INTEGRATION_PROJECTS = [
  { id: "stabilize_system", name: "Stabilize System", desc: "Reduce event rates and restore stability.", duration: 180000, cost: { metal: 160, fuel: 40, research: 40 }, effect: { eventRateMult: 0.85, stability: 15 } },
  { id: "build_gate", name: "Build Gate", desc: "Reduces travel penalties across the frontier.", duration: 240000, cost: { metal: 220, fuel: 80, rare: 4 }, effect: { travelMult: 0.9 } },
  { id: "harmonize_signal", name: "Harmonize Signal", desc: "Reduces signal saturation penalties.", duration: 300000, cost: { signal: 400, research: 80, rare: 6 }, effect: { saturationRelief: 0.15, signalCapBonus: 200 } },
];
const GALAXY_RULESETS = [
  { id: "dense", name: "Dense Galaxy", desc: "More systems, higher upkeep pressure, stronger industry.", mods: { eventRateMult: 1.08, cargoMult: 1.06, commandCapBonus: 1, systemCountBonus: 1 } },
  { id: "chaotic", name: "Chaotic Galaxy", desc: "Volatile events and hazards with spiky returns.", mods: { eventRateMult: 1.2, hazardMult: 1.12, cargoMult: 1.04, systemCountBonus: 0 } },
  { id: "silent", name: "Silent Galaxy", desc: "Signal is capped; research and scans are more efficient.", mods: { signalCapMult: 0.9, scanMult: 1.12, saturationRelief: 0.2, systemCountBonus: -1 } },
];
const DOCTRINES = [
  { id: "expansion", name: "Expansion Doctrine", desc: "Higher command capacity but more volatile events.", mods: { commandCapBonus: 1, eventRateMult: 1.06 } },
  { id: "stability", name: "Stability Doctrine", desc: "Lower event rates with slower expansion.", mods: { eventRateMult: 0.9, travelMult: 1.06 } },
  { id: "automation", name: "Automation Doctrine", desc: "Stronger throughput but higher hazard exposure.", mods: { cargoMult: 1.06, hazardMult: 1.06 } },
  { id: "research", name: "Research Doctrine", desc: "Higher scan efficiency at the cost of slower travel.", mods: { scanMult: 1.12, travelMult: 1.06 } },
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

function seedCrewRoster(workers) {
  const assigned = workers?.assigned || { miner: 0, botanist: 0, engineer: 0 };
  const names = ["Kade", "Mira", "Orion", "Tala", "Nyx", "Rin", "Vega", "Ash"];
  const roles = [
    ...Array.from({ length: assigned.miner || 0 }, () => "miner"),
    ...Array.from({ length: assigned.botanist || 0 }, () => "botanist"),
    ...Array.from({ length: assigned.engineer || 0 }, () => "engineer"),
  ];
  while (roles.length < (workers?.total || 0)) roles.push("engineer");
  return roles.map((role, idx) => {
    const bonus = 0.05;
    const name = names[idx % names.length];
    return {
      id: `core-${role}-${idx}`,
      name,
      role,
      trait: `+${Math.round(bonus * 100)}% to ${role}`,
      bonus,
      focus: "production",
      fatigue: 0,
      temp: false,
      hiredAt: 0,
    };
  });
}

const initialState = {
  saveVersion: SAVE_VERSION,
  tab: "hub",
  resources: { signal: 0, research: 2, metal: 0, organics: 0, fuel: 12, power: 0, food: 0, habitat: 0, morale: 0, rare: 0 },
  rates: { signal: 0, research: 0, metal: 0, organics: 0, fuel: 0, power: 0, food: 0, morale: 0 },
  workers: { total: 3, assigned: { miner: 1, botanist: 1, engineer: 1 }, bonus: { miner: 0, botanist: 0, engineer: 0 }, satisfaction: 1 },
  hubBuildings: {},
  hubUpgrades: {},
  systems: [],
  colonies: [],
  galaxies: [],
  activeGalaxyId: null,
  doctrine: null,
  bases: {},
  tech: {},
  missions: { active: [] },
  targetDepletion: {},
  systemEvents: [],
  integration: { eventRateMult: 1, travelMult: 1, saturationRelief: 0, signalCapBonus: 0 },
  crewPrograms: {},
  crewRoster: seedCrewRoster({ total: 3, assigned: { miner: 1, botanist: 1, engineer: 1 } }),
  crewContracts: [],
  nextContractAt: 0,
  hubOps: { autoPulse: false, autoPulseMinSignal: 150, autoLab: false, autoLabMinSignal: 120, autoLabMinMetal: 40, reserveSignal: 70, reserveMetal: 0 },
  hubOpsLog: [],
  autoLaunch: { enabled: false, bodyId: null, mode: "balanced", specialist: "none" },
  selectedBody: "debris",
  recruits: [],
  crewRoster: [],
  lastRecruitRoll: 0,
  log: [],
  milestones: {},
  milestonesUnlocked: [],
  codexUnlocked: [],
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
  const manualSignalRef = useRef(0);
  const currentBody = selectedBody();
  const currentBase = useMemo(() => ensureBaseState(state.bases[state.selectedBody], currentBody), [state.bases, state.selectedBody]);
  const currentTraits = baseTraitList(currentBase);
  const currentMaintenance = baseMaintenanceStats(currentBase);
  const capabilities = deriveCapabilities(state);
  const missionMods = colonyModifiers(state);

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
  useEffect(() => { applyProduction(); resolveMissions(); processSystems(); processEvents(); processCrew(); processHubOps(); processMilestones(); ensureSystems(); }, [tick]);
  useEffect(() => { ensureGalaxy(); }, [state.systems.length, state.milestonesUnlocked]);

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
  function collectSignal() {
    const now = Date.now();
    if (now - manualSignalRef.current < PACE.manualSignalCooldownMs) return;
    manualSignalRef.current = now;
    bumpResources({ signal: 1 });
    unlockCodex("scan_ops");
    log("Manual signal calibration.");
  }

  function pulseScan(silent = false) {
    const cost = pulseCost(state);
    const cdMs = PACE.pulseCooldownMs;
    if (Date.now() < (state.pulseReadyAt || 0)) { if (!silent) log("Pulse scanner cooling down."); return { ok: false, reason: "cooldown" }; }
    if (state.resources.signal < cost) { if (!silent) log("Not enough signal for pulse scan."); return { ok: false, reason: "signal" }; }
    bumpResources({ signal: -cost });
    unlockCodex("scan_ops");
    const rewardPool = ["metal","fuel","research"];
    const type = rewardPool[Math.floor(Math.random() * rewardPool.length)];
    const baseAmount = type === "research" ? 5 : type === "fuel" ? 12 : 18;
    const crewMods = crewProgramModifiers(state);
    const focusMods = crewFocusModifiers(state);
    const contractMods = crewContractModifiers(state);
    const scanMult = (colonyModifiers(state).scanMult || 1) * (crewMods.scanMult || 1) * (focusMods.scanMult || 1) * (contractMods.scanMult || 1);
    const amount = Math.floor(baseAmount * scanMult * PACE.pulseYieldMult);
    bumpResources({ [type]: amount });
    dispatch({ type: "UPDATE", patch: { pulseReadyAt: Date.now() + cdMs, pulseCount: (state.pulseCount || 0) + 1 } });
    if (!silent) log(`Pulse scan recovered ${amount} ${type} (cost ${cost}).`);
    return { ok: true, type, amount, cost };
  }

  // Apply resource delta; used across economy adjustments.
  function bumpResources(delta) {
    dispatch({ type: "UPDATE", patch: { resources: Object.keys(delta).reduce((acc, key) => { acc[key] = Math.max(0, (state.resources[key] || 0) + delta[key]); return acc; }, { ...state.resources }) } });
  }

  function log(text) { dispatch({ type: "LOG", text }); }

  function unlockCodex(id, message) {
    const unlocked = new Set(state.codexUnlocked || []);
    if (unlocked.has(id)) return;
    unlocked.add(id);
    dispatch({ type: "UPDATE", patch: { codexUnlocked: Array.from(unlocked) } });
    if (message) log(message);
  }

  // Per-tick production: aggregates hub/base output, morale, focus, hazards, and power gating.
  function applyProduction() {
    const r = { ...state.resources };
    const contributions = [];
    const eventMods = aggregateEventMods(currentBase);
    const traitMods = traitEffects(currentBase.traits);
    const maintenance = baseMaintenanceStats(currentBase);
    const focusMods = crewFocusModifiers(state);
    const contractMods = crewContractModifiers(state);

    const addContribution = (prod, cons, requiresPower) => contributions.push({ prod, cons, requiresPower });

    Object.entries(state.hubBuildings).forEach(([id, lvl]) => {
      const def = HUB_BUILDINGS.find((b) => b.id === id); if (!def) return; const mult = workerMult(def.id);
      const prod = {}; Object.entries(def.prod || {}).forEach(([k, v]) => prod[k] = v * lvl * mult);
      addContribution(applyProdMult(prod, focusMods, contractMods), scaleCons(def.cons, lvl), !!def.cons?.power);
    });
    if (state.hubUpgrades.fuel_farm) addContribution(applyProdMult({ fuel: 2 * state.hubUpgrades.fuel_farm }, focusMods, contractMods), {}, false);
    if (state.hubUpgrades.scan_array) addContribution(applyProdMult({ signal: 3 * state.hubUpgrades.scan_array }, focusMods, contractMods), {}, false);
    if (state.tech.fuel_synth) addContribution(applyProdMult({ fuel: 1 * state.tech.fuel_synth }, focusMods, contractMods), {}, false);
    if (state.tech.deep_scan) addContribution(applyProdMult({ research: 1 * state.tech.deep_scan }, focusMods, contractMods), {}, false);
    if (state.tech.bio_domes) addContribution(applyProdMult({ food: 2 * state.tech.bio_domes, habitat: 2 * state.tech.bio_domes }, focusMods, contractMods), {}, false);

    const focus = currentBase.focus || "balanced";
    Object.entries(currentBase.buildings || {}).forEach(([id, lvl]) => {
      const def = biomeBuildingById(id); if (!def) return;
      const prod = {};
      Object.entries(def.prod || {}).forEach(([k, v]) => {
        const traitMult = traitMods.prod[k] || 1;
        prod[k] = v * lvl * workerMult(id) * focusBoost(focus, k) * (eventMods.mult[k] || 1) * traitMult * (maintenance.factor || 1);
      });
      addContribution(applyProdMult(prod, focusMods, contractMods), scaleCons(def.cons, lvl), !!def.cons?.power);
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
    const saturation = signalSaturation(state);
    if (rates.signal > 0 && saturation.factor < 1) rates.signal *= saturation.factor;

    Object.keys(rates).forEach((k) => { r[k] = Math.max(0, r[k] + rates[k] * (k === "power" ? 1 : prodBoost)); });
    const foodUpkeep = state.workers.total * 0.2; r.food = Math.max(0, r.food - foodUpkeep);

    const morale = computeMorale(r, rates, state, currentBase, eventMods, powerGate);
    dispatch({ type: "UPDATE", patch: { resources: r, rates, workers: { ...state.workers, satisfaction: morale } } });
  }

  function workerMult(buildingId) {
    const bonus = state.workers.bonus || {};
    const moraleBoost = 0.6 + (state.workers.satisfaction || 1) * 0.6;
    const fatigueStats = crewFatigueStats(state);
    const focusMods = crewFocusModifiers(state);
    if (["ore_rig","fuel_cracker","core_rig","core_tap"].includes(buildingId)) {
      const fatigueMult = 1 - (fatigueStats.byRole.miner || 0) * 0.2;
      const focusBonus = focusMods.roleProdBonus.miner || 0;
      const oreFocus = (["ore_rig","core_rig","core_tap"].includes(buildingId)) ? (focusMods.minerOreMult || 1) : 1;
      return (1 + (state.workers.assigned.miner || 0) * 0.1 + (bonus.miner || 0)) * (1 + focusBonus) * oreFocus * fatigueMult * moraleBoost;
    }
    if (["algae_farm","protein_farm","bio_reactor"].includes(buildingId)) {
      const fatigueMult = 1 - (fatigueStats.byRole.botanist || 0) * 0.2;
      const focusBonus = focusMods.roleProdBonus.botanist || 0;
      const nutritionFocus = focusMods.botanistNutritionMult || 1;
      return (1 + (state.workers.assigned.botanist || 0) * 0.1 + (bonus.botanist || 0)) * (1 + focusBonus) * nutritionFocus * fatigueMult * moraleBoost;
    }
    const fatigueMult = 1 - (fatigueStats.byRole.engineer || 0) * 0.2;
    const focusBonus = focusMods.roleProdBonus.engineer || 0;
    return (1 + (state.workers.assigned.engineer || 0) * 0.05 + (bonus.engineer || 0)) * (1 + focusBonus) * fatigueMult * moraleBoost;
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
    const depletion = { ...(state.targetDepletion || {}) };
    const depletionWarned = { ...(state.milestones?.depletionWarned || {}) };
    let depletionChanged = false;
    active.forEach((m) => {
      if (now < m.endsAt) { remaining.push(m); return; }
      const body = BODIES.find((b) => b.id === m.bodyId); if (!body) return;
      const efficiency = m.efficiency || depletionFactor(state, body.id);
      let cargo = missionYield(state, body, m.mode, m.specialist, efficiency);
      if (m.variance && m.variance !== 1) cargo = scaleCargo(cargo, m.variance);
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
      if ((state.colonies || []).length && m.hazard >= 0.2) {
        const colonySystems = (state.colonies || []).map((c) => c.systemId);
        const systemId = colonySystems[Math.floor(Math.random() * colonySystems.length)];
        if (systemId) adjustSystemStability(systemId, -Math.round(m.hazard * 6), "Mission strain detected.");
      }
      const current = depletion[body.id] || 0;
      const next = clamp(current + depletionRate(body), 0, 0.85);
      if (next !== current) {
        depletion[body.id] = next;
        depletionChanged = true;
        if (next >= 0.55 && !depletionWarned[body.id]) {
          depletionWarned[body.id] = true;
          log(`${body.name} yields are thinning. Extend range to access stronger targets.`);
        }
      }
    });
    const missionsDone = (state.milestones.missionsDone || 0) + (active.length - remaining.length);
    dispatch({
      type: "UPDATE",
      patch: {
        missions: { active: remaining },
        milestones: { ...state.milestones, missionsDone, depletionWarned },
        ...(depletionChanged ? { targetDepletion: depletion } : {}),
      },
    });

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
    const crewMods = crewProgramModifiers(state);
    const focusMods = crewFocusModifiers(state);
    const contractMods = crewContractModifiers(state);
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
        const eventMult = (traitMods.eventMult || 1) * (maintenance.over ? 0.7 : 1) * (crewMods.baseEventRateMult || 1) * (focusMods.baseEventRateMult || 1) * (contractMods.baseEventRateMult || 1);
        base.nextEventAt = now + randomBetween(...EVENT_COOLDOWN_MS) * eventMult;
        bases[body.id] = base; changed = true;
      }
    });
    if (changed) dispatch({ type: "UPDATE", patch: { bases } });
  }

  function processCrew() {
    const now = Date.now();
    let crewRoster = state.crewRoster || [];
    let workers = state.workers;
    let changed = false;
    const expired = [];

    if (!crewRoster.length && workers?.total) {
      crewRoster = seedCrewRoster(workers);
      changed = true;
    }

    crewRoster = crewRoster.filter((crew) => {
      if (crew.temp && crew.expiresAt && now >= crew.expiresAt) {
        expired.push(crew);
        return false;
      }
      return true;
    });

    const assignedRoster = assignCrewRoster({ ...state, crewRoster });
    const assignedIds = new Set(assignedRoster.filter((c) => c.assigned).map((c) => c.id));
    const focusMods = crewFocusModifiers({ ...state, crewRoster });
    const gainBase = CREW_FATIGUE.gain * (focusMods.fatigueGainMult || 1);
    const recoveryBase = CREW_FATIGUE.recovery * (focusMods.fatigueRecoveryMult || 1);

    crewRoster = crewRoster.map((crew) => {
      const assigned = assignedIds.has(crew.id);
      const focus = crew.focus || "production";
      let delta = assigned ? gainBase : -recoveryBase;
      if (focus === "recovery") delta *= assigned ? 0.7 : 1.4;
      const nextFatigue = clamp((crew.fatigue || 0) + delta, 0, 1);
      if (nextFatigue !== crew.fatigue || crew.focus !== focus) changed = true;
      return nextFatigue !== crew.fatigue || crew.focus !== focus ? { ...crew, fatigue: nextFatigue, focus } : crew;
    });

    if (expired.length) {
      const assigned = { ...workers.assigned };
      const bonus = { ...workers.bonus };
      expired.forEach((crew) => {
        assigned[crew.role] = Math.max(0, (assigned[crew.role] || 0) - 1);
        bonus[crew.role] = Math.max(0, (bonus[crew.role] || 0) - (crew.bonus || 0));
      });
      const assignedSum = Object.values(assigned).reduce((sum, v) => sum + v, 0);
      const total = Math.max(assignedSum, Math.max(0, workers.total - expired.length));
      workers = { ...workers, total, assigned, bonus };
      changed = true;
      log("Contract crew rotated out.");
    }

    let crewContracts = state.crewContracts || [];
    let nextContractAt = state.nextContractAt || 0;
    if (now >= nextContractAt && crewContracts.length === 0) {
      const pool = [...CREW_CONTRACTS].sort(() => Math.random() - 0.5).slice(0, 2);
      crewContracts = pool.map((c) => ({ ...c, offerId: `${c.id}-${now}-${Math.random().toString(16).slice(2, 6)}` }));
      const refreshMs = Math.floor(CONTRACT_REFRESH_MS * (crewTrainingTier(state) >= 3 ? 0.7 : 1));
      nextContractAt = now + refreshMs;
      changed = true;
      log("Specialist contracts posted.");
    }

    if (changed) dispatch({ type: "UPDATE", patch: { crewRoster, workers, crewContracts, nextContractAt } });
  }

  function processHubOps() {
    const ops = state.hubOps || {};
    if (ops.autoPulse) {
      const cost = pulseCost(state);
      const reserve = ops.reserveSignal || 0;
      const minSignal = Math.max(cost, ops.autoPulseMinSignal || 0, reserve + cost);
      if (Date.now() >= (state.pulseReadyAt || 0) && (state.resources.signal || 0) >= minSignal) {
        const result = pulseScan(true);
        if (result?.ok) logOps(`Auto Pulse Scan: +${result.amount} ${result.type} (cost ${result.cost})`);
      }
    }
    if (ops.autoLab) {
      const reserveSignal = ops.reserveSignal || 0;
      const reserveMetal = ops.reserveMetal || 0;
      const labCostValue = labCost();
      const minSignal = Math.max(labCostValue.signal || 0, ops.autoLabMinSignal || 0, reserveSignal + (labCostValue.signal || 0));
      const minMetal = Math.max(labCostValue.metal || 0, ops.autoLabMinMetal || 0, reserveMetal + (labCostValue.metal || 0));
      if (Date.now() >= (state.labReadyAt || 0) && (state.resources.signal || 0) >= minSignal && (state.resources.metal || 0) >= minMetal) {
        const result = runLabPulse(true);
        if (result?.ok) logOps(`Auto Research Pulse: +${result.research} research`);
      }
    }
  }

  function processSystems() {
    const systems = state.systems || [];
    if (!systems.length) return;
    const now = Date.now();
    let updated = systems;
    let changed = false;
    const modifiers = colonyModifiers(state);
    const crewMods = crewProgramModifiers(state);
    const systemEvents = [...(state.systemEvents || [])];
    let eventsChanged = false;
    let integrationPatch = null;
    updated = systems.map((system) => {
      if (!system.op || now < system.op.endsAt) return system;
      const nextStage = nextSurveyStage(system.stage);
      const stepName = SYSTEM_SURVEY_STEPS[system.stage]?.name || "Survey step";
      log(`${stepName} complete for ${system.name}.`);
      changed = true;
      return { ...system, stage: nextStage, op: null, surveyedAt: nextStage === "colonize" ? now : system.surveyedAt };
    });
    updated = updated.map((system) => {
      if (system.project && now >= system.project.endsAt) {
        const project = INTEGRATION_PROJECTS.find((p) => p.id === system.project.id);
        const integrationBase = integrationPatch || state.integration || { eventRateMult: 1, travelMult: 1, saturationRelief: 0, signalCapBonus: 0 };
        const integration = { ...integrationBase };
        if (project?.effect) {
          if (project.effect.eventRateMult) integration.eventRateMult = (integration.eventRateMult || 1) * project.effect.eventRateMult;
          if (project.effect.travelMult) integration.travelMult = (integration.travelMult || 1) * project.effect.travelMult;
          if (project.effect.saturationRelief) integration.saturationRelief = clamp((integration.saturationRelief || 0) + project.effect.saturationRelief, 0, 0.6);
          if (project.effect.signalCapBonus) integration.signalCapBonus = (integration.signalCapBonus || 0) + project.effect.signalCapBonus;
        }
        if (project?.effect?.stability) {
          system.stability = clamp((system.stability ?? 100) + project.effect.stability, 35, 100);
        }
        integrationPatch = integration;
        log(`Integration complete in ${system.name}: ${project?.name || "Project"}.`);
        changed = true;
        return { ...system, project: null, integratedAt: system.integratedAt || now };
      }
      return system;
    });

    updated = updated.map((system) => {
      const isColonized = (state.colonies || []).some((c) => c.systemId === system.id);
      if (!isColonized) return system;
      const relatedEvents = systemEvents.filter((e) => e.systemId === system.id);
      const regen = (relatedEvents.length ? 0 : 0.005) + (crewMods.stabilityRecovery || 0);
      const nextStability = clamp((system.stability ?? 100) + regen, 35, 100);
      if (nextStability !== system.stability) {
        changed = true;
        system = { ...system, stability: nextStability };
      }
      if (!system.nextEventAt) system.nextEventAt = now + randomBetween(...SYSTEM_EVENT_COOLDOWN_MS);
      if (now >= system.nextEventAt && relatedEvents.length < MAX_SYSTEM_EVENTS) {
        const pick = SYSTEM_EVENTS[Math.floor(Math.random() * SYSTEM_EVENTS.length)];
        systemEvents.push({ ...pick, id: `${system.id}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, systemId: system.id });
        eventsChanged = true;
        log(`System event at ${system.name}: ${pick.name}.`);
        const stabilityFactor = clamp((system.stability ?? 100) / 100, 0.6, 1.2);
        const eventRate = modifiers.eventRateMult || 1;
        system.nextEventAt = now + randomBetween(...SYSTEM_EVENT_COOLDOWN_MS) * stabilityFactor * eventRate;
        changed = true;
      } else if (now >= system.nextEventAt && relatedEvents.length >= MAX_SYSTEM_EVENTS) {
        const stabilityFactor = clamp((system.stability ?? 100) / 100, 0.6, 1.2);
        const eventRate = modifiers.eventRateMult || 1;
        system.nextEventAt = now + randomBetween(...SYSTEM_EVENT_COOLDOWN_MS) * stabilityFactor * eventRate;
        changed = true;
      }
      return system;
    });
    if (modifiers.stabilityDrain > 0) {
      updated = updated.map((system) => {
        if (!(state.colonies || []).some((c) => c.systemId === system.id)) return system;
        const next = clamp((system.stability ?? 100) - modifiers.stabilityDrain, 35, 100);
        if (next === system.stability) return system;
        changed = true;
        return { ...system, stability: next };
      });
    }
    const patch = {};
    if (changed) patch.systems = updated;
    if (eventsChanged) patch.systemEvents = systemEvents;
    if (modifiers.command.over > 0 && !state.milestones?.commandOverCap) {
      patch.milestones = { ...state.milestones, commandOverCap: true };
      log("Command capacity exceeded. Colony efficiency slipping.");
    }
    if (integrationPatch) patch.integration = integrationPatch;
    if (Object.keys(patch).length) dispatch({ type: "UPDATE", patch });
  }

  function ensureGalaxy() {
    if (!capabilities.systems) return;
    if ((state.galaxies || []).length) {
      if (!state.activeGalaxyId) {
        dispatch({ type: "UPDATE", patch: { activeGalaxyId: state.galaxies[0].id } });
      }
      return;
    }
    const starter = { id: `gal-${Date.now()}`, name: "Origin Galaxy", rulesetId: "dense", depth: 1, discoveredAt: Date.now() };
    dispatch({ type: "UPDATE", patch: { galaxies: [starter], activeGalaxyId: starter.id } });
    log("Galaxy layer initialized: Origin Galaxy.");
  }

  function chartNewGalaxy(rulesetId) {
    const integratedSystems = (state.systems || []).filter((s) => s.integratedAt).length;
    if (integratedSystems < 2) {
      log("Integrate at least two systems before charting a new galaxy.");
      return;
    }
    const ruleset = galaxyById(rulesetId);
    const galaxies = state.galaxies || [];
    const depth = galaxies.length + 1;
    const newGalaxy = { id: `gal-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, name: `${ruleset.name} ${depth}`, rulesetId: ruleset.id, depth, discoveredAt: Date.now() };
    dispatch({
      type: "UPDATE",
      patch: {
        galaxies: [...galaxies, newGalaxy],
        activeGalaxyId: newGalaxy.id,
        systems: [],
        colonies: [],
        systemEvents: [],
        integration: { eventRateMult: 1, travelMult: 1, saturationRelief: 0, signalCapBonus: 0 },
        missions: { active: [] },
      },
    });
    log(`Charted new galaxy: ${ruleset.name}. Systems reinitialized.`);
  }

  function chooseDoctrine(id) {
    if (state.doctrine) { log("Doctrine already selected."); return; }
    if ((state.prestige?.runs || 0) < 1) { log("Prestige once to unlock doctrines."); return; }
    const def = doctrineById(id);
    if (!def) return;
    dispatch({ type: "UPDATE", patch: { doctrine: def.id } });
    log(`Doctrine adopted: ${def.name}.`);
  }

  function ensureSystems() {
    const desired = targetSystemCount(state);
    if (!desired) return;
    const existing = state.systems || [];
    if (existing.length >= desired) return;
    const extra = generateSystems(desired - existing.length, existing);
    dispatch({ type: "UPDATE", patch: { systems: [...existing, ...extra] } });
    log("Signal echoes reveal nearby systems. Survey chains are now available.");
  }

  function startSystemOp(systemId) {
    const system = (state.systems || []).find((s) => s.id === systemId);
    if (!system) return;
    if (system.op) { log("Survey already running for this system."); return; }
    if (!["scan", "probe", "survey"].includes(system.stage)) { log("No survey operations available."); return; }
    const step = SYSTEM_SURVEY_STEPS[system.stage];
    if (!step) return;
    if (!canAfford(step.cost)) { log("Not enough resources for that survey operation."); return; }
    spend(step.cost);
    const speed = colonyModifiers(state).surveySpeed || 1;
    const endsAt = Date.now() + Math.floor(step.duration * speed * PACE.surveyDurationMult);
    const systems = (state.systems || []).map((s) => s.id === systemId ? { ...s, op: { type: step.id, endsAt } } : s);
    dispatch({ type: "UPDATE", patch: { systems } });
    log(`${step.name} started in ${system.name}.`);
  }

  function colonizeSystem(systemId, roleId) {
    const system = (state.systems || []).find((s) => s.id === systemId);
    if (!system) return;
    if (system.stage !== "colonize") { log("Complete the survey chain before colonizing."); return; }
    if ((state.colonies || []).some((c) => c.systemId === systemId)) { log("Colony already established here."); return; }
    const role = colonyRoleById(roleId);
    if (!canAfford(COLONY_COST)) { log("Not enough resources to establish a colony."); return; }
    spend(COLONY_COST);
    const colony = {
      id: `col-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      systemId,
      role: role.id,
      distance: system.distance,
      createdAt: Date.now(),
    };
    const systems = (state.systems || []).map((s) => s.id === systemId ? { ...s, stage: "colonized", colonizedAt: Date.now() } : s);
    dispatch({ type: "UPDATE", patch: { colonies: [...(state.colonies || []), colony], systems } });
    unlockCodex("colonies_anchor", `Colony established at ${system.name}.`);
  }

  function startIntegrationProject(systemId, projectId) {
    const system = (state.systems || []).find((s) => s.id === systemId);
    if (!system) return;
    if (system.project) { log("Integration project already running here."); return; }
    if (!(state.colonies || []).some((c) => c.systemId === systemId)) { log("Establish a colony before starting integration."); return; }
    const project = INTEGRATION_PROJECTS.find((p) => p.id === projectId);
    if (!project) return;
    const activeProjects = (state.systems || []).filter((s) => s.project).length;
    const capacity = Math.max(1, Math.floor(commandCapacity(state) / 2) + 1);
    if (activeProjects >= capacity) { log("Hub attention maxed. Finish an active integration project first."); return; }
    if (!canAfford(project.cost)) { log("Not enough resources to start this project."); return; }
    spend(project.cost);
    const systems = (state.systems || []).map((s) => s.id === systemId ? { ...s, project: { id: project.id, endsAt: Date.now() + Math.floor(project.duration * PACE.integrationDurationMult) } } : s);
    dispatch({ type: "UPDATE", patch: { systems } });
    log(`Integration project started in ${system.name}: ${project.name}.`);
  }

  function resolveSystemEvent(systemId, eventId) {
    const event = (state.systemEvents || []).find((e) => e.id === eventId && e.systemId === systemId);
    if (!event) return;
    if (!canAfford(event.cost)) { log("Not enough resources to resolve event."); return; }
    spend(event.cost);
    const systemEvents = (state.systemEvents || []).filter((e) => e.id !== eventId);
    dispatch({ type: "UPDATE", patch: { systemEvents } });
    adjustSystemStability(systemId, 4, "Stability improved after resolving the incident.");
    log(`Resolved ${event.name} at ${systemNameById(systemId)}.`);
  }

  function systemNameById(id) {
    return (state.systems || []).find((s) => s.id === id)?.name || "system";
  }

  function adjustSystemStability(systemId, delta, message) {
    const systems = (state.systems || []).map((system) => {
      if (system.id !== systemId) return system;
      const next = clamp((system.stability ?? 100) + delta, 35, 100);
      return { ...system, stability: next };
    });
    dispatch({ type: "UPDATE", patch: { systems } });
    if (message) log(message);
  }

  // Launch mission with stance/specialist; charges fuel logistics and schedules resolution.
  function startMission(bodyId, fuelBoost = 0, modeId = "balanced", specialist = "none", silent = false) {
    const body = BODIES.find((b) => b.id === bodyId && isUnlocked(b));
    if (!body) { log("Target locked."); return; }
    const slots = 1 + (state.hubUpgrades.launch_bay || 0) + (state.tech.auto_pilots ? 1 : 0);
    if ((state.missions.active || []).length >= slots) { log("All mission slots busy."); return; }
    const crewMods = crewProgramModifiers(state);
    const missionMods = colonyModifiers(state);
    let fuelCost = Math.max(5, Math.floor(body.travel / 3)) + fuelBoost;
    fuelCost = Math.ceil(fuelCost * (missionMods.fuelMult || 1) * (crewMods.fuelMult || 1));
    if (!state.milestones?.firstLaunch) fuelCost = 0;
    if (state.resources.fuel < fuelCost) { log("Not enough fuel."); return; }
    bumpResources({ fuel: -fuelCost });
    const mode = missionModeById(modeId);
    const bonuses = baseBonuses(state, body.id);
    const hazardBase = body.hazard - (state.tech.hazard_gear ? 0.25 : 0) - (state.tech.shielding ? 0.2 : 0) + (mode?.hazard || 0) + (specialist === "engineer" ? -0.1 : 0);
    const hazard = Math.max(0, hazardBase * (bonuses.hazard || 1) * (missionMods.hazardMult || 1) * (crewMods.hazardMult || 1));
    const duration = Math.max(15000, ((body.travel * 1000 * (bonuses.travel || 1) * (missionMods.travelMult || 1) * (crewMods.travelMult || 1)) - fuelBoost * 3000 + (mode?.durationMs || 0)) * (state.tech.auto_pilots ? 0.9 : 1) * PACE.missionDurationMult);
    const objectiveChance = Math.min(0.55, 0.3 + (missionMods.objectiveBonus || 0) + (crewMods.objectiveBonus || 0));
    const objective = Math.random() < objectiveChance ? makeObjective(body) : null;
    const efficiency = depletionFactor(state, body.id);
    const variance = Number(randomBetween(0.9, 1.1).toFixed(2));
    const mission = { bodyId: body.id, endsAt: Date.now() + duration, hazard, mode: modeId, specialist, objective, efficiency, variance };
    dispatch({ type: "UPDATE", patch: { missions: { active: [...(state.missions.active || []), mission] } } });
    unlockCodex("mission_ops");
    unlockCodex("local_ops");
    if (!silent) log(`Launched ${mode?.name || "mission"} to ${body.name}. ETA ${formatDuration(duration)}.`);
    dispatch({ type: "UPDATE", patch: { milestones: { ...state.milestones, firstLaunch: true } } });
  }

  function setAutoLaunch(payload) {
    dispatch({ type: "UPDATE", patch: { autoLaunch: payload } });
    log(payload.enabled ? `Auto-launch enabled for ${BODIES.find((b) => b.id === payload.bodyId)?.name || "target"}.` : "Auto-launch disabled.");
  }

  function setHubOps(patch) {
    dispatch({ type: "UPDATE", patch: { hubOps: { ...state.hubOps, ...patch } } });
  }

  function logOps(text) {
    const next = [...(state.hubOpsLog || []), { text, time: Date.now() }].slice(-8);
    dispatch({ type: "UPDATE", patch: { hubOpsLog: next } });
  }

  function processMilestones() {
    const unlocked = new Set(state.milestonesUnlocked || []);
    const codexUnlocked = new Set(state.codexUnlocked || []);
    let changed = false;
    MILESTONES.forEach((m) => {
      if (unlocked.has(m.id)) return;
      if (m.condition(state)) {
        unlocked.add(m.id);
        if (m.codexEntryId) codexUnlocked.add(m.codexEntryId);
        log(`Milestone unlocked: ${m.title}.`);
        changed = true;
      }
    });
    if (changed) {
      dispatch({ type: "UPDATE", patch: { milestonesUnlocked: Array.from(unlocked), codexUnlocked: Array.from(codexUnlocked) } });
    }
  }


  function isUnlocked(body) {
    if ((body.tier || 1) > hubRange(state)) return false;
    if (body.requireTech && !state.tech[body.requireTech]) return false;
    if (body.requireMissions && (state.milestones.missionsDone || 0) < body.requireMissions) return false;
    return state.resources.signal >= Math.ceil((body.unlock || 0) * PACE.bodyUnlockMult);
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
    unlockCodex("hub_ops");
    log(`Constructed ${def.name}.`);
  }

  function buyHubUpgrade(id) {
    const def = HUB_UPGRADES.find((u) => u.id === id); if (!def) return;
    if (!canAfford(def.cost)) { log("Not enough resources."); return; }
    spend(def.cost);
    dispatch({ type: "UPDATE", patch: { hubUpgrades: { ...state.hubUpgrades, [id]: (state.hubUpgrades[id] || 0) + 1 } } });
    unlockCodex("hub_ops");
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
    const unlockSignal = Math.ceil(def.unlock * PACE.techUnlockMult);
    const cost = scaleCost(def.cost, PACE.techCostMult);
    if (state.resources.signal < unlockSignal) { log("Need more signal to access this tech."); return; }
    if (!canAfford(cost)) { log("Not enough resources."); return; }
    spend(cost); dispatch({ type: "UPDATE", patch: { tech: { ...state.tech, [id]: 1 } } });
    unlockCodex("tech_ops");
    log(`Tech unlocked: ${def.name}.`);
  }

  function runLabPulse(silent = false) {
    const cooldownMs = PACE.labCooldownMs;
    if (Date.now() < (state.labReadyAt || 0)) { if (!silent) log("Research lab recalibrating."); return { ok: false, reason: "cooldown" }; }
    const cost = labCost();
    if (!canAfford(cost)) { if (!silent) log("Need signal + metal for research pulse."); return { ok: false, reason: "resources" }; }
    spend(cost);
    const crewMods = crewProgramModifiers(state);
    const focusMods = crewFocusModifiers(state);
    const contractMods = crewContractModifiers(state);
    const gain = Math.floor(6 * (crewMods.researchMult || 1) * (focusMods.researchMult || 1) * (contractMods.researchMult || 1) * PACE.labYieldMult);
    bumpResources({ research: gain });
    dispatch({ type: "UPDATE", patch: { labReadyAt: Date.now() + cooldownMs } });
    if (!silent) log("Research pulse completed. New data archived.");
    return { ok: true, cost, research: gain };
  }

  // Prestige/reset with boost based on total value.
  function ascend() {
    if (!(state.milestonesUnlocked || []).includes("M4_PRESTIGE_UNLOCK")) {
      log("Prestige is locked. Reach galaxy depth 2 and integrate systems first.");
      return;
    }
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

  function maxRecruitTier(stateObj) {
    const unlocked = new Set(stateObj.milestonesUnlocked || []);
    if (unlocked.has("M3_INTEGRATION_UNLOCK")) return 3;
    if (unlocked.has("M2_SYSTEMS_DISCOVERED")) return 2;
    return 1;
  }

  function isCrewProgramUnlocked(stateObj, program) {
    const unlock = program?.unlock || {};
    if (unlock.milestone && !(stateObj.milestonesUnlocked || []).includes(unlock.milestone)) return false;
    if (unlock.tech && !stateObj.tech?.[unlock.tech]) return false;
    return true;
  }

  function buyCrewProgram(id) {
    const def = CREW_PROGRAMS.find((p) => p.id === id);
    if (!def) return;
    if (!isCrewProgramUnlocked(state, def)) { log("Training program is still locked."); return; }
    const level = state.crewPrograms?.[id] || 0;
    const cost = scaledCost(def.cost, level, COST_EXP.crew);
    if (!canAfford(cost)) { log("Not enough resources for training."); return; }
    spend(cost);
    dispatch({ type: "UPDATE", patch: { crewPrograms: { ...state.crewPrograms, [id]: level + 1 } } });
    log(`Crew program advanced: ${def.name} Lv ${level + 1}.`);
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
    const tierCap = maxRecruitTier(state);
    const tier = 1 + Math.floor(Math.random() * tierCap);
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
    const crewRoster = [...(state.crewRoster || []), { id: cand.id, name: cand.name, role: cand.role, trait: cand.trait, bonus: cand.bonus, focus: "production", fatigue: 0, temp: false, hiredAt: Date.now() }];
    const recruits = state.recruits.filter((c) => c.id !== id);
    dispatch({ type: "UPDATE", patch: { workers, recruits, crewRoster } });
    log(`Hired ${cand.name} (${cand.role}).`);
  }

  function changeCrew(role, delta) {
    const current = state.workers.assigned[role] || 0; const target = current + delta; if (target < 0) return;
    const totalAssigned = Object.values(state.workers.assigned).reduce((a, b) => a + b, 0); if (delta > 0 && totalAssigned >= state.workers.total) return;
    const assigned = { ...state.workers.assigned, [role]: target };
    dispatch({ type: "UPDATE", patch: { workers: { ...state.workers, assigned } } });
  }

  function setCrewFocus(id, focus) {
    const roster = (state.crewRoster || []).map((crew) => crew.id === id ? { ...crew, focus } : crew);
    dispatch({ type: "UPDATE", patch: { crewRoster: roster } });
  }

  function setAllFocus(focus) {
    const roster = (state.crewRoster || []).map((crew) => ({ ...crew, focus }));
    dispatch({ type: "UPDATE", patch: { crewRoster: roster } });
    log(`Crew focus shifted to ${focus}.`);
  }

  function quickAssign() {
    const total = state.workers.total || 0;
    const base = Math.floor(total / 3);
    const remainder = total % 3;
    const assigned = { miner: base, botanist: base, engineer: base };
    if (remainder > 0) assigned.miner += 1;
    if (remainder > 1) assigned.engineer += 1;
    dispatch({ type: "UPDATE", patch: { workers: { ...state.workers, assigned } } });
    log("Crew assignments balanced.");
  }

  function rollContracts(force) {
    const now = Date.now();
    if (!force && now < (state.nextContractAt || 0) && (state.crewContracts || []).length) return;
    const pool = [...CREW_CONTRACTS].sort(() => Math.random() - 0.5).slice(0, 2);
    const offers = pool.map((c) => ({ ...c, offerId: `${c.id}-${now}-${Math.random().toString(16).slice(2, 6)}` }));
    const refreshMs = Math.floor(CONTRACT_REFRESH_MS * (crewTrainingTier(state) >= 3 ? 0.7 : 1));
    dispatch({ type: "UPDATE", patch: { crewContracts: offers, nextContractAt: now + refreshMs } });
    log("New specialist contracts available.");
  }

  function acceptContract(offerId) {
    const offer = (state.crewContracts || []).find((c) => c.offerId === offerId);
    if (!offer) return;
    if (state.resources.habitat <= state.workers.total) { log("Need spare habitat for contract crew."); return; }
    if (!canAfford(offer.cost)) { log("Not enough resources for this contract."); return; }
    spend(offer.cost);
    const contract = {
      id: `contract-${offer.id}-${Date.now()}`,
      contractId: offer.id,
      name: offer.name,
      role: offer.role,
      trait: offer.trait,
      perk: offer.perk,
      bonus: offer.bonus,
      mods: offer.mods,
      focus: "production",
      fatigue: 0,
      temp: true,
      hiredAt: Date.now(),
      expiresAt: Date.now() + offer.durationMs,
    };
    const crewRoster = [...(state.crewRoster || []), contract];
    const workers = {
      ...state.workers,
      total: state.workers.total + 1,
      assigned: { ...state.workers.assigned, [offer.role]: (state.workers.assigned[offer.role] || 0) + 1 },
      bonus: { ...state.workers.bonus, [offer.role]: (state.workers.bonus[offer.role] || 0) + offer.bonus },
    };
    const crewContracts = (state.crewContracts || []).filter((c) => c.offerId !== offerId);
    dispatch({ type: "UPDATE", patch: { crewRoster, crewContracts, workers } });
    log(`Contract accepted: ${offer.name}.`);
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
          </div>
          <ResourceBar resources={state.resources} rates={state.rates} format={format} />
        </header>
        <ActionBar state={state} onCollect={collectSignal} onPulse={pulseScan} onLab={runLabPulse} format={format} formatDuration={formatDuration} />

        <div className="flex flex-col md:flex-row gap-4">
          <nav className="md:w-48 w-full flex md:flex-col flex-wrap gap-2 overflow-x-auto pb-1">
            {[
              { id: "hub", label: "Hub" },
              { id: "missions", label: "Missions" },
              { id: "bases", label: "Bases" },
              { id: "crew", label: "Crew" },
              { id: "tech", label: "Tech" },
              { id: "systems", label: "Systems", locked: !capabilities.systems },
              { id: "codex", label: "Codex" },
              { id: "log", label: "Log" },
              { id: "profile", label: "Profile" },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`tab w-full md:w-full text-left whitespace-nowrap ${state.tab === tab.id ? 'active' : ''} ${tab.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => !tab.locked && dispatch({ type: 'SET_TAB', tab: tab.id })}
                disabled={tab.locked}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <main className="flex-1 flex flex-col gap-3">
            {state.tab === 'hub' && (
              <HubView
                state={state}
                buildHub={buildHub}
                buyHubUpgrade={buyHubUpgrade}
                crewBonusText={crewBonusText}
                ascend={ascend}
                format={format}
                setHubOps={setHubOps}
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
                hubRange={hubRange(state)}
                depletionFactor={(id) => depletionFactor(state, id)}
                missionMods={missionMods}
                baseBonuses={(id) => baseBonuses(state, id)}
                missionDurationMult={PACE.missionDurationMult}
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
                crewProgramDefs={CREW_PROGRAMS}
                buyCrewProgram={buyCrewProgram}
                isCrewProgramUnlocked={isCrewProgramUnlocked}
                scaledCost={scaledCost}
                canAffordUI={canAffordUI}
                costExpCrew={COST_EXP.crew}
                milestones={MILESTONES}
                techDefs={TECH}
                setCrewFocus={setCrewFocus}
                setAllFocus={setAllFocus}
                quickAssign={quickAssign}
                crewContracts={state.crewContracts || []}
                acceptContract={acceptContract}
                rollContracts={() => rollContracts(true)}
                formatDuration={formatDuration}
                nextContractAt={state.nextContractAt || 0}
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
                techUnlockMult={PACE.techUnlockMult}
                techCostMult={PACE.techCostMult}
              />
            )}
            {state.tab === 'systems' && (
              <SystemsView
                state={state}
                capabilities={capabilities}
                format={format}
                formatDuration={formatDuration}
                startSystemOp={startSystemOp}
                colonizeSystem={colonizeSystem}
                startIntegrationProject={startIntegrationProject}
                resolveSystemEvent={resolveSystemEvent}
                chartNewGalaxy={chartNewGalaxy}
                colonyRoles={COLONY_ROLES}
              />
            )}
            {state.tab === 'codex' && <CodexView state={state} />}
            {state.tab === 'log' && <LogView log={state.log} />}
            {state.tab === 'profile' && (
              <ProfileView state={state} ascend={ascend} exportProfile={exportProfile} importProfile={importProfile} compact={compact} setCompact={setCompact} manualSave={manualSave} lastSaved={lastSaved} chooseDoctrine={chooseDoctrine} />
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

function ActionBar({ state, onCollect, onPulse, onLab, format, formatDuration }) {
  const pulseCostValue = pulseCost(state);
  const labCostValue = labCost();
  const pulseCd = Math.max(0, (state.pulseReadyAt || 0) - Date.now());
  const labCd = Math.max(0, (state.labReadyAt || 0) - Date.now());
  return (
    <div className="panel sticky top-3 z-20 flex flex-wrap items-center gap-2 justify-between py-2">
      <div className="flex flex-wrap gap-2 items-center">
        <button className="btn btn-primary" onClick={onCollect} title="Collect Signal (Space)">Collect</button>
        <button className="btn" disabled={state.resources.signal < pulseCostValue || pulseCd > 0} onClick={onPulse} title="Pulse Scan">
          Scan {pulseCd > 0 ? `(${formatDuration(pulseCd)})` : ""}
        </button>
        <button className="btn" onClick={onLab} disabled={labCd > 0} title="Pulse Lab">
          Lab {labCd > 0 ? `(${formatDuration(labCd)})` : ""}
        </button>
      </div>
      <div className="text-xs text-muted flex flex-wrap gap-3">
        <span>Pulse cost {format(pulseCostValue)} signal</span>
        <span>Lab cost {costText(labCostValue, format)}</span>
        <span>Space: collect</span>
      </div>
    </div>
  );
}

function ProfileView({ state, ascend, exportProfile, importProfile, compact, setCompact, manualSave, lastSaved, chooseDoctrine }) {
  const doctrine = doctrineById(state.doctrine);
  const canPrestige = (state.milestonesUnlocked || []).includes("M4_PRESTIGE_UNLOCK");
  return (
    <section className="panel space-y-3">
      <div className="text-lg font-semibold">Profile</div>
      <div className="grid md:grid-cols-3 gap-3">
        <div className="card space-y-2">
          <div className="font-semibold">Prestige</div>
          <div className="text-sm text-muted">Reset for a global production boost. Current boost: {Math.round(((state.prestige?.boost || 1) - 1) * 100)}% · Points: {state.prestige?.points || 0}</div>
          <button className="btn" disabled={!canPrestige} onClick={ascend}>Ascend & Reset</button>
          <div className="text-xs text-muted">
            {canPrestige ? "Grants prestige based on total value. Progress auto-saves locally; refresh won't wipe." : "Prestige unlocks after galaxy depth 2, two integrations, and saturation pressure."}
          </div>
        </div>
        <div className="card space-y-2">
          <div className="font-semibold">Doctrine</div>
          <div className="text-sm text-muted">Choose a doctrine after your first prestige to define long-term strategy.</div>
          {state.prestige?.runs > 0 && !doctrine && (
            <div className="space-y-2">
              {DOCTRINES.map((doc) => (
                <div key={doc.id} className="row-item">
                  <div className="row-details">
                    <div className="row-title">{doc.name}</div>
                    <div className="row-meta">{doc.desc}</div>
                  </div>
                  <button className="btn" onClick={() => chooseDoctrine(doc.id)}>Adopt</button>
                </div>
              ))}
            </div>
          )}
          {doctrine && (
            <div className="text-sm text-muted">Active doctrine: {doctrine.name}</div>
          )}
          {!state.prestige?.runs && (
            <div className="text-xs text-muted">Prestige once to unlock doctrine selection.</div>
          )}
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

function HubView({ state, buildHub, buyHubUpgrade, crewBonusText, ascend, format, setHubOps }) {
  const ops = state.hubOps || { autoPulse: false, autoPulseMinSignal: 150, autoLab: false, autoLabMinSignal: 120, autoLabMinMetal: 40, reserveSignal: 70, reserveMetal: 0 };
  const [pane, setPane] = useState("build");
  const command = commandUsage(state);
  const briefing = [
    "Collect Signal then run a Pulse Scan (ramping signal cost + longer cooldown) to convert signal into metal/fuel/research.",
    "First launch is fuel-free; Debris missions return early research + fuel.",
    "Build a Fuel Refinery or Fuel Cracker early to keep missions flowing.",
    "Keep power >= 0 and food positive to avoid morale drops.",
    "Use Research Console if fuel is low to bootstrap research.",
  ];

  const setOps = (patch) => {
    if (setHubOps) setHubOps(patch);
  };

  return (
    <section className="panel space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div>
          <div className="text-lg font-semibold">Main Hub</div>
          <div className="text-muted text-sm">Command core for operations, automation, and expansion.</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[340px,1fr] gap-3">
        <div className="space-y-3">
          <div className="card space-y-2">
            <div className="font-semibold">Automation</div>
            <div className="row-item">
              <div className="row-details">
                <div className="row-title">Auto Pulse Scan</div>
                <div className="row-meta">Run when cooldown ready and signal above threshold.</div>
              </div>
              <div className="row gap-2">
                <input
                  type="number"
                  className="w-20 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white"
                  value={ops.autoPulseMinSignal}
                  min={0}
                  onChange={(e) => setOps({ autoPulseMinSignal: Number(e.target.value) })}
                />
                <label className="row">
                  <span className="text-xs">On</span>
                  <input type="checkbox" checked={!!ops.autoPulse} onChange={(e) => setOps({ autoPulse: e.target.checked })} />
                </label>
              </div>
            </div>
            <div className="row-item">
              <div className="row-details">
                <div className="row-title">Auto Research Pulse</div>
                <div className="row-meta">Runs when lab ready and resources exceed thresholds.</div>
              </div>
              <div className="row gap-2">
                <input
                  type="number"
                  className="w-20 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white"
                  value={ops.autoLabMinSignal}
                  min={0}
                  onChange={(e) => setOps({ autoLabMinSignal: Number(e.target.value) })}
                />
                <input
                  type="number"
                  className="w-20 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white"
                  value={ops.autoLabMinMetal}
                  min={0}
                  onChange={(e) => setOps({ autoLabMinMetal: Number(e.target.value) })}
                />
                <label className="row">
                  <span className="text-xs">On</span>
                  <input type="checkbox" checked={!!ops.autoLab} onChange={(e) => setOps({ autoLab: e.target.checked })} />
                </label>
              </div>
            </div>
            <div className="row-item">
              <div className="row-details">
                <div className="row-title">Safety Reserves</div>
                <div className="row-meta">Automation keeps these minimums in storage.</div>
              </div>
              <div className="row gap-2">
                <input
                  type="number"
                  className="w-20 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white"
                  value={ops.reserveSignal}
                  min={0}
                  onChange={(e) => setOps({ reserveSignal: Number(e.target.value) })}
                />
                <input
                  type="number"
                  className="w-20 rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-white"
                  value={ops.reserveMetal}
                  min={0}
                  onChange={(e) => setOps({ reserveMetal: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="text-xs text-muted">Thresholds are signal | metal for lab, signal for pulse.</div>
          </div>

          <div className="card space-y-2">
            <div className="font-semibold">Hub Status</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="stat-box">
                <span className="text-muted text-xs">Power</span>
                <strong>{format(state.resources.power)}</strong>
              </div>
              <div className="stat-box">
                <span className="text-muted text-xs">Food</span>
                <strong>{format(state.resources.food)}</strong>
              </div>
              <div className="stat-box">
                <span className="text-muted text-xs">Habitat</span>
                <strong>{format(state.resources.habitat)}</strong>
              </div>
              <div className="stat-box">
                <span className="text-muted text-xs">Morale</span>
                <strong>{Math.round((state.workers.satisfaction || 1) * 100)}%</strong>
              </div>
              <div className="stat-box">
                <span className="text-muted text-xs">Range</span>
                <strong>{hubRange(state)}</strong>
              </div>
              <div className="stat-box">
                <span className="text-muted text-xs">Command Cap</span>
                <strong>{command.used}/{command.capacity}</strong>
              </div>
              <div className="stat-box">
                <span className="text-muted text-xs">Signal Cap</span>
                <strong>{format(signalSaturation(state).cap)}</strong>
              </div>
              <div className="stat-box">
                <span className="text-muted text-xs">Saturation</span>
                <strong>{Math.round(signalSaturation(state).penalty * 100)}%</strong>
              </div>
            </div>
            {command.over > 0 && (
              <div className="text-xs text-muted">Over capacity: mission efficiency reduced, stability drifting.</div>
            )}
            <div className="text-xs text-muted">Keep power non-negative and food above upkeep ({(state.workers.total * 0.2).toFixed(1)}/tick).</div>
            <div className="text-xs text-muted">{bottleneckReport(state, state.rates).join(" ")}</div>
            <div className="text-xs text-muted">
              Prestige: {(state.milestonesUnlocked || []).includes("M4_PRESTIGE_UNLOCK") ? "Ready" : "Locked"} (Depth 2, 2 integrations, saturation 25%).
            </div>
          </div>

          <div className="card space-y-2">
            <div className="font-semibold">Ops Feed</div>
            <div className="list max-h-[180px] overflow-y-auto pr-1">
              {(state.hubOpsLog || []).slice().reverse().map((e, i) => (
                <div key={i} className="row-item">
                  <div className="row-details">
                    <div className="row-title">{e.text}</div>
                    <div className="row-meta">{new Date(e.time).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
              {!state.hubOpsLog?.length && <div className="text-muted text-sm">No automated actions yet.</div>}
            </div>
          </div>
        </div>

        <div className="card space-y-3">
          <div className="row row-between">
            <div className="font-semibold">Hub Workspace</div>
            <div className="flex flex-wrap gap-2">
              {['build', 'upgrades', 'briefing'].map((key) => (
                <button key={key} className={`tab ${pane === key ? 'active' : ''}`} onClick={() => setPane(key)}>
                  {key[0].toUpperCase() + key.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {pane === "build" && (
            <div className="list max-h-[520px] overflow-y-auto pr-1">
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

          {pane === "upgrades" && (
            <div className="list max-h-[520px] overflow-y-auto pr-1">
              {HUB_UPGRADES.map((u) => {
                const level = state.hubUpgrades[u.id] || 0;
                return (
                  <div key={u.id} className="row-item">
                    <div className="row-details">
                      <div className="row-title">{u.name} <span className="tag">Lv {level}</span></div>
                      <div className="row-meta">{u.desc}</div>
                    </div>
                    <button className="btn" disabled={!canAffordUI(state.resources, scaledCost(u.cost, level, COST_EXP.hub))} onClick={() => buyHubUpgrade(u.id)}>
                      Upgrade ({costText(scaledCost(u.cost, level, COST_EXP.hub), format)})
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {pane === "briefing" && (
            <div className="space-y-3">
              <div className="font-semibold">Briefing & Controls</div>
              <ul className="text-sm text-muted list-disc list-inside space-y-1">
                {briefing.map((b, i) => <li key={i}>{b}</li>)}
              </ul>
              <div className="text-xs text-muted">Space: Collect | 1-7: Tabs | Arrow keys: cycle tabs</div>
            </div>
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

function SystemsView({ state, capabilities, format, formatDuration, startSystemOp, colonizeSystem, startIntegrationProject, resolveSystemEvent, chartNewGalaxy, colonyRoles }) {
  const [rolePick, setRolePick] = useState({});
  const [nextGalaxy, setNextGalaxy] = useState("dense");
  if (!capabilities.systems) {
    return (
      <section className="panel space-y-2">
        <div className="text-lg font-semibold">Systems</div>
        <div className="text-muted text-sm">Unlock by extending hub range or researching Deep Scan arrays.</div>
      </section>
    );
  }
  const systems = state.systems || [];
  const colonies = state.colonies || [];
  const command = commandUsage(state);
  const surveySpeed = colonyModifiers(state).surveySpeed || 1;
  const integration = state.integration || { eventRateMult: 1, travelMult: 1, saturationRelief: 0, signalCapBonus: 0 };
  const galaxy = activeGalaxy(state);
  const galaxyRule = galaxyById(galaxy?.rulesetId);
  const integratedSystems = systems.filter((s) => s.integratedAt).length;
  const canChartGalaxy = integratedSystems >= 2;
  const traitName = (id) => SYSTEM_TRAITS.find((t) => t.id === id)?.name || id;
  return (
    <section className="panel space-y-3">
      <div>
        <div className="text-lg font-semibold">Systems</div>
        <div className="text-muted text-sm">Run scan -> probe -> survey chains to unlock colonies.</div>
      </div>
      <div className="card space-y-2">
        <div className="row row-between">
          <div className="font-semibold">Galaxy Overview</div>
          <div className="text-sm">{galaxy?.name || "Uncharted"}</div>
        </div>
          <div className="text-xs text-muted">Ruleset: {galaxyRule?.name || "Unknown"} | Depth {galaxy?.depth || 0} | Integrations {integratedSystems}</div>
          <div className="text-xs text-muted">Effects: cargo {Math.round((galaxyRule?.mods?.cargoMult || 1) * 100)}% | hazards {Math.round((galaxyRule?.mods?.hazardMult || 1) * 100)}%</div>
        <div className="text-xs text-muted">{galaxyRule?.desc || "Reach systems to unlock galaxy options."}</div>
        <div className="row gap-2">
          <select className="select bg-slate-800 text-white" value={nextGalaxy} onChange={(e) => setNextGalaxy(e.target.value)}>
            {GALAXY_RULESETS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <button className="btn" disabled={!canChartGalaxy} onClick={() => chartNewGalaxy(nextGalaxy)}>
            {canChartGalaxy ? "Chart New Galaxy" : "Integrate 2 systems"}
          </button>
        </div>
      </div>
      <div className="card space-y-1">
        <div className="row row-between">
          <div className="font-semibold">Command Capacity</div>
          <div className="text-sm">{command.used}/{command.capacity} used</div>
        </div>
        <div className="text-xs text-muted">Over-capacity reduces mission efficiency and slowly destabilizes colonies.</div>
        <div className="text-xs text-muted">Integration effects: travel {Math.round((integration.travelMult || 1) * 100)}% | event rate {Math.round((integration.eventRateMult || 1) * 100)}%</div>
      </div>
      <div className="list">
        {systems.map((system) => {
          const colony = colonies.find((c) => c.systemId === system.id);
          const events = (state.systemEvents || []).filter((e) => e.systemId === system.id);
          const traits = (system.traits || []).map(traitName).join(", ") || "Unstable signals";
          const stage = system.stage || "scan";
          const stageLabel = stage === "colonized" ? "Anchored" : stage[0].toUpperCase() + stage.slice(1);
          const opRemaining = system.op ? Math.max(0, system.op.endsAt - Date.now()) : 0;
          const step = SYSTEM_SURVEY_STEPS[stage];
          const roleChoice = rolePick[system.id] || "relay";
          const roleDef = colony ? colonyRoleById(colony.role) : colonyRoleById(roleChoice);
          const project = system.project ? INTEGRATION_PROJECTS.find((p) => p.id === system.project.id) : null;
          const projectRemaining = system.project ? Math.max(0, system.project.endsAt - Date.now()) : 0;
          const trend = events.length ? "Declining" : "Stable";
          const activeProjects = systems.filter((s) => s.project).length;
          const projectCap = Math.max(1, Math.floor(commandCapacity(state) / 2) + 1);
          const canStartProject = !system.project && activeProjects < projectCap;
          return (
            <div key={system.id} className="row-item">
              <div className="row-details">
                <div className="row-title">
                  {system.name} <span className="tag">{stageLabel}</span> {system.integratedAt && <span className="tag">Integrated</span>}
                </div>
                <div className="row-meta">Distance {format(system.distance || 0)} AU | Traits {traits}</div>
                <div className="row-meta text-xs text-muted">Stability {Math.round(system.stability ?? 100)}% | Trend {trend}</div>
                {system.op && <div className="row-meta text-xs text-muted">{step?.name} running: {formatDuration(opRemaining)} remaining</div>}
                {!system.op && ["scan", "probe", "survey"].includes(stage) && (
                  <div className="row-meta text-xs text-muted">
                    {step?.name} cost: {step ? costText(step.cost, format) : "n/a"} | Duration {step ? formatDuration(step.duration * surveySpeed * PACE.surveyDurationMult) : "n/a"}
                  </div>
                )}
                {colony && (
                  <div className="row-meta text-xs text-muted">Colony: {roleDef.name} | Command cost {colonyCapacityCost(colony)} | Events {events.length}/{MAX_SYSTEM_EVENTS}</div>
                )}
                {!colony && stage === "colonize" && (
                  <div className="row-meta text-xs text-muted">Colony cost: {costText(COLONY_COST, format)}</div>
                )}
                {!colony && stage === "colonize" && (
                  <div className="row-meta text-xs text-muted">{roleDef.desc}</div>
                )}
                {project && (
                  <div className="row-meta text-xs text-muted">Project: {project.name} | {formatDuration(projectRemaining)} remaining</div>
                )}
                {!project && colony && (
                  <div className="row-meta text-xs text-muted">Integration slots {activeProjects}/{projectCap}</div>
                )}
              </div>
              <div className="flex flex-col gap-2 items-end">
                {["scan", "probe", "survey"].includes(stage) && !system.op && (
                  <button className="btn" onClick={() => startSystemOp(system.id)}>{step?.name || "Start Survey"}</button>
                )}
                {["scan", "probe", "survey"].includes(stage) && system.op && (
                  <button className="btn" disabled>In Progress</button>
                )}
                {stage === "colonize" && !colony && (
                  <>
                    <select className="select bg-slate-800 text-white" value={roleChoice} onChange={(e) => setRolePick({ ...rolePick, [system.id]: e.target.value })}>
                      {colonyRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                    <button className="btn btn-primary" onClick={() => colonizeSystem(system.id, roleChoice)}>Establish Colony</button>
                  </>
                )}
                {colony && <span className="tag">Anchored</span>}
              </div>
              {colony && (
                <div className="mt-3 w-full space-y-2">
                  <div className="text-xs text-muted">Integration Projects</div>
                  <div className="grid md:grid-cols-3 gap-2">
                    {INTEGRATION_PROJECTS.map((proj) => (
                      <div key={proj.id} className="card space-y-1">
                        <div className="font-semibold text-sm">{proj.name}</div>
                        <div className="text-xs text-muted">{proj.desc}</div>
                        <div className="text-xs text-muted">Cost: {costText(proj.cost, format)}</div>
                        <button className="btn" disabled={!canStartProject} onClick={() => startIntegrationProject(system.id, proj.id)}>
                          {canStartProject ? "Start" : "Busy"}
                        </button>
                      </div>
                    ))}
                  </div>
                  {!!events.length && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted">System Events</div>
                      <div className="list">
                        {events.map((ev) => (
                          <div key={ev.id} className="row-item">
                            <div className="row-details">
                              <div className="row-title">{ev.name}</div>
                              <div className="row-meta">{ev.desc}</div>
                              <div className="row-meta text-xs text-muted">Resolve cost: {costText(ev.cost, format)}</div>
                            </div>
                            <button className="btn" onClick={() => resolveSystemEvent(system.id, ev.id)}>Resolve</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!systems.length && <div className="text-muted text-sm">No systems detected yet. Raise hub range to reveal new targets.</div>}
      </div>
    </section>
  );
}

function CodexView({ state }) {
  const unlocked = new Set(state.codexUnlocked || []);
  return (
    <section className="panel space-y-2">
      <div className="text-lg font-semibold">Codex</div>
      <div className="text-muted text-sm">Operational knowledge unlocks as milestones are reached.</div>
      <div className="list">
        {CODEX_ENTRIES.map((entry) => (
          <div key={entry.id} className="row-item">
            <div className="row-details">
              <div className="row-title">{entry.title}</div>
              <div className="row-meta">{unlocked.has(entry.id) ? entry.body : "Locked. Reach the relevant milestone to reveal."}</div>
            </div>
            {unlocked.has(entry.id) && <span className="tag">Unlocked</span>}
          </div>
        ))}
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
      const migrated = migrateSave(parsed);
      return { ...initialState, ...migrated };
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
function scaleCost(baseCost, mult = 1) {
  const out = {};
  Object.entries(baseCost || {}).forEach(([k, v]) => {
    out[k] = Math.ceil(v * (mult || 1));
  });
  return out;
}
function pulseCost(stateObj) {
  return Math.min(PACE.pulseCostCap, PACE.pulseCostBase + (stateObj.pulseCount || 0) * PACE.pulseCostStep);
}
function labCost() {
  return scaleCost({ signal: 60, metal: 20 }, PACE.labCostMult);
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
function applyProdMult(prod = {}, focusMods = {}, contractMods = {}) {
  const out = { ...prod };
  Object.keys(out).forEach((k) => {
    let mult = 1;
    if (k === "food" && focusMods.botanistNutritionMult) mult *= focusMods.botanistNutritionMult;
    if (k === "fuel" && focusMods.fuelProdMult) mult *= focusMods.fuelProdMult;
    if (contractMods.prodMult?.[k]) mult *= contractMods.prodMult[k];
    out[k] = out[k] * mult;
  });
  return out;
}
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
  const fatiguePenalty = (crewFatigueStats(state).avgAssigned || 0) * 0.08;
  const crewMods = crewProgramModifiers(state);
  const contractMods = crewContractModifiers(state);
  const crewBonus = (crewMods.moraleBonus || 0) + (contractMods.moraleBonus || 0);
  const baseMorale = (foodFactor * 0.4) + (habitatFactor * 0.2) + (powerFactor * 0.15) + (restFactor * 0.15) - hazardPenalty - eventPenalty - fatiguePenalty;
  return clamp(baseMorale + (rates.morale || 0) + crewBonus, 0.35, 1.3);
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
function migrateSave(save) {
  let out = { ...save };
  const version = Number.isFinite(out.saveVersion) ? out.saveVersion : 0;
  if (version < 1) {
    out.hubOps = out.hubOps || { autoPulse: false, autoPulseMinSignal: 150, autoLab: false, autoLabMinSignal: 120, autoLabMinMetal: 40, reserveSignal: 70, reserveMetal: 0 };
    out.hubOpsLog = out.hubOpsLog || [];
    out.milestonesUnlocked = out.milestonesUnlocked || [];
    out.codexUnlocked = out.codexUnlocked || [];
    out.systems = out.systems || [];
    out.colonies = out.colonies || [];
    out.galaxies = out.galaxies || [];
  }
  if (version < 4) {
    out.targetDepletion = out.targetDepletion || {};
    out.milestones = { ...(out.milestones || {}), depletionWarned: out.milestones?.depletionWarned || {} };
  }
  if (version < 5) {
    out.systems = (out.systems || []).map((system) => normalizeSystem(system));
    out.colonies = (out.colonies || []).map((colony) => ({
      ...colony,
      role: colony.role || "relay",
      distance: Number.isFinite(colony.distance) ? colony.distance : 4,
      createdAt: colony.createdAt || Date.now(),
    }));
  }
  if (version < 6) {
    out.systemEvents = out.systemEvents || [];
    out.integration = out.integration || { eventRateMult: 1, travelMult: 1, saturationRelief: 0, signalCapBonus: 0 };
    out.systems = (out.systems || []).map((system) => ({
      ...normalizeSystem(system),
      nextEventAt: system.nextEventAt || Date.now() + randomBetween(...SYSTEM_EVENT_COOLDOWN_MS),
      project: system.project || null,
    }));
  }
  if (version < 7) {
    out.galaxies = out.galaxies || [];
    out.activeGalaxyId = out.activeGalaxyId || (out.galaxies[0]?.id ?? null);
    out.doctrine = out.doctrine || null;
  }
  if (version < 8) {
    out.crewPrograms = out.crewPrograms || {};
  }
  if (version < 9) {
    out.crewRoster = out.crewRoster || [];
  }
  if (version < 10) {
    out.crewContracts = out.crewContracts || [];
    out.nextContractAt = out.nextContractAt || 0;
  }
  if (!out.crewRoster?.length && out.workers?.total) {
    out.crewRoster = seedCrewRoster(out.workers);
  }
  out.crewRoster = (out.crewRoster || []).map((crew, idx) => ({
    ...crew,
    id: crew.id || `crew-${idx}-${Date.now()}`,
    focus: crew.focus || "production",
    fatigue: Number.isFinite(crew.fatigue) ? crew.fatigue : 0,
    temp: !!crew.temp,
    hiredAt: crew.hiredAt || 0,
  }));
  out.saveVersion = SAVE_VERSION;
  return out;
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
function scaleCargo(cargo, factor) {
  const out = {};
  Object.entries(cargo).forEach(([k, v]) => { out[k] = Math.max(0, Math.floor(v * factor)); });
  return out;
}
function signalSaturation(stateObj) {
  const galaxyMods = galaxyModifiers(stateObj);
  const doctrineMods = doctrineModifiers(stateObj);
  const baseCap = 300 + (stateObj.hubUpgrades.scan_array || 0) * 140 + (stateObj.tech.deep_scan ? 220 : 0) + (stateObj.tech.rift_mapping ? 240 : 0);
  const integrationBonus = stateObj.integration?.signalCapBonus || 0;
  const capMult = galaxyMods.signalCapMult || 1;
  const cap = Math.max(150, Math.floor(baseCap * capMult) + integrationBonus + (doctrineMods.signalCapBonus || 0));
  const current = stateObj.resources.signal || 0;
  if (current <= cap) return { factor: 1, cap, penalty: 0 };
  const relief = clamp((stateObj.integration?.saturationRelief || 0) + (galaxyMods.saturationRelief || 0) + (doctrineMods.saturationRelief || 0), 0, 0.6);
  const over = (current - cap) / cap;
  const penalty = clamp(over * 0.45 * (1 - relief), 0, 0.7);
  return { factor: 1 - penalty, cap, penalty };
}
function galaxyDepth(stateObj) {
  const galaxies = stateObj.galaxies || [];
  if (!galaxies.length) return 0;
  return Math.max(...galaxies.map((g) => g.depth || 0));
}
function bottleneckReport(stateObj, rates) {
  const alerts = [];
  if ((stateObj.resources.power || 0) <= 0 && (rates.power || 0) < 0) alerts.push("Power deficit is gating production.");
  if ((stateObj.resources.food || 0) <= 0 && (rates.food || 0) <= 0) alerts.push("Food is below upkeep, morale will drop.");
  if ((stateObj.resources.fuel || 0) <= 0 && (rates.fuel || 0) <= 0) alerts.push("Fuel is scarce, missions and projects may stall.");
  if (alerts.length) return alerts;
  const drains = Object.entries(rates || {}).filter(([, v]) => v < 0);
  if (!drains.length) return ["No immediate bottlenecks detected."];
  drains.sort((a, b) => a[1] - b[1]);
  const [key, val] = drains[0];
  return [`${key} is the tightest drain (${val.toFixed(1)}/tick).`];
}
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
function missionYield(state, body, modeId, specialist = "none", efficiency = 1) {
  const base = body.resources || {};
  const drone = state.tech?.drone_log ? 0.2 : 0;
  const rareBonus = state.tech?.rift_mapping ? 0.2 : 0;
  const mult = 1 + drone + rareBonus;
  const bonuses = baseBonuses(state, body.id);
  const crewMods = crewProgramModifiers(state);
  const focusMods = crewFocusModifiers(state);
  const contractMods = crewContractModifiers(state);
  const colonyMods = colonyModifiers(state);
  const mode = missionModeById(modeId);
  const cargo = {};
  Object.entries(base).forEach(([k, v]) => {
    const modeBoost = mode?.reward?.[k] ?? mode?.reward?.all ?? 1;
    let specBoost = 1;
    if (specialist === "miner" && (k === "metal" || k === "rare")) specBoost = 1.15;
    if (specialist === "botanist" && (k === "organics" || k === "fuel")) specBoost = 1.15;
    if (specialist === "engineer" && (k === "research")) specBoost = 1.1;
    const crewMult = k === "research" ? (crewMods.researchMult || 1) * (focusMods.researchMult || 1) : 1;
    const focusMission = focusMods.missionMult?.[k] || 1;
    const contractMission = contractMods.missionMult?.[k] || 1;
    const contractCargo = contractMods.cargoMult || 1;
    cargo[k] = Math.floor(v * mult * modeBoost * specBoost * (bonuses.cargo || 1) * (colonyMods.cargoMult || 1) * contractCargo * crewMult * focusMission * contractMission * efficiency * PACE.missionYieldMult);
  });
  return cargo;
}
function targetDepletion(stateObj, bodyId) {
  return clamp(stateObj.targetDepletion?.[bodyId] || 0, 0, 0.85);
}
function depletionFactor(stateObj, bodyId) {
  return clamp(1 - targetDepletion(stateObj, bodyId), 0.25, 1);
}
function depletionRate(body) {
  const tier = body.tier || 1;
  const base = 0.06 - (Math.max(0, tier - 1) * 0.005);
  return Math.max(0.02, base);
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
function randomSystemName(existing = []) {
  const taken = new Set(existing.map((s) => s.name));
  let name = "";
  let tries = 0;
  while (!name || taken.has(name)) {
    const prefix = SYSTEM_NAME_PARTS.prefix[Math.floor(Math.random() * SYSTEM_NAME_PARTS.prefix.length)];
    const suffix = SYSTEM_NAME_PARTS.suffix[Math.floor(Math.random() * SYSTEM_NAME_PARTS.suffix.length)];
    name = `${prefix} ${suffix}`;
    tries += 1;
    if (tries > 12) break;
  }
  return name;
}
function pickSystemTraits() {
  const picks = [];
  const pool = [...SYSTEM_TRAITS];
  const count = 2;
  while (picks.length < count && pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    const [trait] = pool.splice(idx, 1);
    if (trait) picks.push(trait.id);
  }
  return picks;
}
function normalizeSystem(system) {
  const distance = Number.isFinite(system.distance) ? system.distance : Math.floor(randomBetween(3, 10));
  const traits = Array.isArray(system.traits) && system.traits.length ? system.traits : pickSystemTraits();
  const stage = system.stage || (system.colonizedAt ? "colonized" : "scan");
  return {
    ...system,
    id: system.id || `sys-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    name: system.name || randomSystemName([]),
    distance,
    traits,
    stage,
    stability: Number.isFinite(system.stability) ? system.stability : 100,
    op: system.op || null,
    project: system.project || null,
    nextEventAt: system.nextEventAt || Date.now() + randomBetween(...SYSTEM_EVENT_COOLDOWN_MS),
    discoveredAt: system.discoveredAt || Date.now(),
  };
}
function generateSystems(count, existing = []) {
  const list = [];
  for (let i = 0; i < count; i += 1) {
    list.push(normalizeSystem({ name: randomSystemName(existing.concat(list)) }));
  }
  return list;
}
function targetSystemCount(stateObj) {
  const range = hubRange(stateObj);
  if (range < 3) return 0;
  const extra = Math.max(0, Math.floor(range - 3));
  const galaxyBonus = galaxyModifiers(stateObj).systemCountBonus || 0;
  return Math.min(6, Math.max(1, 3 + extra + galaxyBonus));
}
function nextSurveyStage(stage) {
  const idx = SURVEY_SEQUENCE.indexOf(stage);
  if (idx === -1 || idx >= SURVEY_SEQUENCE.length - 1) return stage;
  return SURVEY_SEQUENCE[idx + 1];
}
function colonyRoleById(id) { return COLONY_ROLES.find((r) => r.id === id) || COLONY_ROLES[0]; }
function colonyRoleCounts(stateObj) {
  return (stateObj.colonies || []).reduce((acc, colony) => {
    acc[colony.role] = (acc[colony.role] || 0) + 1;
    return acc;
  }, { relay: 0, survey: 0, logistics: 0 });
}
function systemEventModifiers(stateObj) {
  const mods = { cargoMult: 1, travelMult: 1, scanMult: 1, surveySpeed: 1, hazardMult: 1, stabilityDrain: 0 };
  (stateObj.systemEvents || []).forEach((ev) => {
    const effect = ev.effect || {};
    if (effect.cargoMult) mods.cargoMult *= effect.cargoMult;
    if (effect.travelMult) mods.travelMult *= effect.travelMult;
    if (effect.scanMult) mods.scanMult *= effect.scanMult;
    if (effect.surveySpeed) mods.surveySpeed *= effect.surveySpeed;
    if (effect.hazardMult) mods.hazardMult *= effect.hazardMult;
    if (effect.stabilityDrain) mods.stabilityDrain += effect.stabilityDrain;
  });
  return mods;
}
function crewProgramModifiers(stateObj) {
  const levels = stateObj.crewPrograms || {};
  const mods = {
    cargoMult: 1,
    objectiveBonus: 0,
    hazardMult: 1,
    travelMult: 1,
    fuelMult: 1,
    scanMult: 1,
    researchMult: 1,
    baseEventRateMult: 1,
    systemEventRateMult: 1,
    moraleBonus: 0,
    stabilityRecovery: 0,
  };
  const missionLvl = levels.mission_corps || 0;
  if (missionLvl) {
    mods.cargoMult *= 1 + missionLvl * 0.03;
    mods.objectiveBonus += missionLvl * 0.02;
    mods.hazardMult *= Math.max(0.88, 1 - missionLvl * 0.01);
  }
  const baseLvl = levels.base_command || 0;
  if (baseLvl) {
    mods.baseEventRateMult *= 1 + baseLvl * 0.08;
    mods.systemEventRateMult *= 1 + baseLvl * 0.06;
    mods.stabilityRecovery += baseLvl * 0.0015;
  }
  const scienceLvl = levels.science_guild || 0;
  if (scienceLvl) {
    mods.scanMult *= 1 + scienceLvl * 0.06;
    mods.researchMult *= 1 + scienceLvl * 0.05;
  }
  const logisticsLvl = levels.logistics_wing || 0;
  if (logisticsLvl) {
    mods.travelMult *= Math.max(0.84, 1 - logisticsLvl * 0.03);
    mods.fuelMult *= Math.max(0.82, 1 - logisticsLvl * 0.03);
  }
  const moraleLvl = levels.morale_office || 0;
  if (moraleLvl) {
    mods.moraleBonus += moraleLvl * 0.02;
  }
  return mods;
}
function assignCrewRoster(stateObj) {
  const roster = [...(stateObj.crewRoster || [])].sort((a, b) => (a.hiredAt || 0) - (b.hiredAt || 0));
  const assignedLeft = {
    miner: stateObj.workers?.assigned?.miner || 0,
    botanist: stateObj.workers?.assigned?.botanist || 0,
    engineer: stateObj.workers?.assigned?.engineer || 0,
  };
  return roster.map((crew) => {
    const assigned = (assignedLeft[crew.role] || 0) > 0;
    if (assigned) assignedLeft[crew.role] -= 1;
    return { ...crew, assigned };
  });
}
function crewFatigueStats(stateObj) {
  const assigned = assignCrewRoster(stateObj);
  const totals = { miner: 0, botanist: 0, engineer: 0 };
  const counts = { miner: 0, botanist: 0, engineer: 0 };
  let allFatigue = 0;
  let allCount = 0;
  assigned.forEach((crew) => {
    if (!crew.assigned) return;
    const fatigue = Number.isFinite(crew.fatigue) ? crew.fatigue : 0;
    totals[crew.role] += fatigue;
    counts[crew.role] += 1;
    allFatigue += fatigue;
    allCount += 1;
  });
  const byRole = {
    miner: counts.miner ? totals.miner / counts.miner : 0,
    botanist: counts.botanist ? totals.botanist / counts.botanist : 0,
    engineer: counts.engineer ? totals.engineer / counts.engineer : 0,
  };
  const avgAssigned = allCount ? allFatigue / allCount : 0;
  return { byRole, avgAssigned };
}
function crewFocusModifiers(stateObj) {
  const assigned = assignCrewRoster(stateObj);
  const prodCounts = { miner: 0, botanist: 0, engineer: 0 };
  let researchCount = 0;
  let recoveryCount = 0;
  let minerOre = 0;
  let minerSalvage = 0;
  let botanistNutrition = 0;
  let botanistBiofuel = 0;
  let engineerStability = 0;
  let engineerAutomation = 0;
  assigned.forEach((crew) => {
    if (!crew.assigned) return;
    const focus = crew.focus || "production";
    if (focus === "production") prodCounts[crew.role] += 1;
    if (focus === "research") researchCount += 1;
    if (focus === "recovery") recoveryCount += 1;
    if (crew.role === "miner" && focus === "ore") minerOre += 1;
    if (crew.role === "miner" && focus === "salvage") minerSalvage += 1;
    if (crew.role === "botanist" && focus === "nutrition") botanistNutrition += 1;
    if (crew.role === "botanist" && focus === "biofuel") botanistBiofuel += 1;
    if (crew.role === "engineer" && focus === "stability") engineerStability += 1;
    if (crew.role === "engineer" && focus === "automation") engineerAutomation += 1;
  });
  return {
    roleProdBonus: {
      miner: Math.min(0.12, prodCounts.miner * 0.02),
      botanist: Math.min(0.12, prodCounts.botanist * 0.02),
      engineer: Math.min(0.12, prodCounts.engineer * 0.02),
    },
    minerOreMult: 1 + Math.min(0.18, minerOre * 0.03),
    missionMult: {
      metal: 1 + Math.min(0.12, minerOre * 0.02),
      rare: 1 + Math.min(0.08, minerOre * 0.02),
    },
    cargoMult: 1 + Math.min(0.12, minerSalvage * 0.02),
    botanistNutritionMult: 1 + Math.min(0.15, botanistNutrition * 0.03),
    fuelProdMult: 1 + Math.min(0.15, botanistBiofuel * 0.03),
    hazardMult: Math.max(0.85, 1 - engineerStability * 0.02),
    baseEventRateMult: Math.max(0.85, 1 - engineerStability * 0.03),
    systemEventRateMult: Math.max(0.85, 1 - engineerStability * 0.03),
    travelMult: Math.max(0.85, 1 - engineerAutomation * 0.02),
    scanMult: 1 + Math.min(0.2, researchCount * 0.02),
    researchMult: 1 + Math.min(0.2, researchCount * 0.02),
    fatigueGainMult: Math.max(0.7, 1 - recoveryCount * 0.05),
    fatigueRecoveryMult: 1 + Math.min(0.5, recoveryCount * 0.05),
  };
}
function crewContractModifiers(stateObj) {
  const mods = {
    cargoMult: 1,
    travelMult: 1,
    hazardMult: 1,
    scanMult: 1,
    researchMult: 1,
    baseEventRateMult: 1,
    systemEventRateMult: 1,
    moraleBonus: 0,
    prodMult: {},
    missionMult: {},
  };
  (stateObj.crewRoster || []).forEach((crew) => {
    if (!crew.temp || !crew.mods) return;
    const m = crew.mods || {};
    if (m.cargoMult) mods.cargoMult *= m.cargoMult;
    if (m.travelMult) mods.travelMult *= m.travelMult;
    if (m.hazardMult) mods.hazardMult *= m.hazardMult;
    if (m.scanMult) mods.scanMult *= m.scanMult;
    if (m.researchMult) mods.researchMult *= m.researchMult;
    if (m.baseEventRateMult) mods.baseEventRateMult *= m.baseEventRateMult;
    if (m.systemEventRateMult) mods.systemEventRateMult *= m.systemEventRateMult;
    if (m.moraleBonus) mods.moraleBonus += m.moraleBonus;
    Object.entries(m.prodMult || {}).forEach(([k, v]) => {
      mods.prodMult[k] = (mods.prodMult[k] || 1) * v;
    });
    Object.entries(m.missionMult || {}).forEach(([k, v]) => {
      mods.missionMult[k] = (mods.missionMult[k] || 1) * v;
    });
  });
  return mods;
}
function crewTrainingTier(stateObj) {
  const levels = Object.values(stateObj.crewPrograms || {}).reduce((sum, level) => sum + level, 0);
  if (levels >= 9) return 3;
  if (levels >= 6) return 2;
  if (levels >= 3) return 1;
  return 0;
}
function galaxyById(id) { return GALAXY_RULESETS.find((g) => g.id === id) || GALAXY_RULESETS[0]; }
function activeGalaxy(stateObj) {
  const galaxies = stateObj.galaxies || [];
  if (!galaxies.length) return null;
  return galaxies.find((g) => g.id === stateObj.activeGalaxyId) || galaxies[0];
}
function doctrineById(id) { return DOCTRINES.find((d) => d.id === id); }
function doctrineModifiers(stateObj) {
  if (!stateObj.doctrine) return {};
  return doctrineById(stateObj.doctrine)?.mods || {};
}
function galaxyModifiers(stateObj) {
  const galaxy = activeGalaxy(stateObj);
  const ruleset = galaxyById(galaxy?.rulesetId);
  return ruleset?.mods || {};
}
function colonyCapacityCost(colony) {
  const distance = Number.isFinite(colony.distance) ? colony.distance : 4;
  return 1 + Math.floor(distance / 4);
}
function commandUsage(stateObj) {
  const capacity = commandCapacity(stateObj);
  const used = (stateObj.colonies || []).reduce((sum, colony) => sum + colonyCapacityCost(colony), 0);
  const over = Math.max(0, used - capacity);
  return { used, capacity, over };
}
function colonyModifiers(stateObj) {
  const counts = colonyRoleCounts(stateObj);
  const systemMods = systemEventModifiers(stateObj);
  const integration = stateObj.integration || { eventRateMult: 1, travelMult: 1, saturationRelief: 0, signalCapBonus: 0 };
  const galaxyMods = galaxyModifiers(stateObj);
  const doctrineMods = doctrineModifiers(stateObj);
  const crewMods = crewProgramModifiers(stateObj);
  const focusMods = crewFocusModifiers(stateObj);
  const contractMods = crewContractModifiers(stateObj);
  const relayRange = counts.relay || 0;
  const scanMult = (1 + Math.min(0.3, counts.survey * 0.1)) * (systemMods.scanMult || 1) * (galaxyMods.scanMult || 1) * (doctrineMods.scanMult || 1) * (crewMods.scanMult || 1) * (focusMods.scanMult || 1) * (contractMods.scanMult || 1);
  const surveySpeed = Math.max(0.75, 1 - counts.survey * 0.05) * (systemMods.surveySpeed || 1);
  const objectiveBonus = Math.min(0.2, counts.survey * 0.05);
  const travelMult = Math.max(0.8, 1 - counts.logistics * 0.05) * (integration.travelMult || 1) * (systemMods.travelMult || 1) * (galaxyMods.travelMult || 1) * (doctrineMods.travelMult || 1) * (crewMods.travelMult || 1) * (focusMods.travelMult || 1) * (contractMods.travelMult || 1);
  const fuelMult = Math.max(0.8, 1 - counts.logistics * 0.04);
  const cargoMult = (1 + Math.min(0.2, counts.logistics * 0.04)) * (systemMods.cargoMult || 1) * (galaxyMods.cargoMult || 1) * (doctrineMods.cargoMult || 1) * (crewMods.cargoMult || 1) * (focusMods.cargoMult || 1) * (contractMods.cargoMult || 1);
  const command = commandUsage(stateObj);
  const overCargo = Math.max(0.7, 1 - command.over * 0.07);
  const overTravel = 1 + command.over * 0.08;
  const stabilityDrain = command.over > 0 ? command.over * 0.01 : 0;
  return {
    relayRange,
    scanMult,
    surveySpeed,
    objectiveBonus,
    travelMult: travelMult * overTravel,
    fuelMult: fuelMult * (crewMods.fuelMult || 1),
    cargoMult: cargoMult * overCargo,
    command,
    stabilityDrain: stabilityDrain + (systemMods.stabilityDrain || 0),
    hazardMult: (systemMods.hazardMult || 1) * (galaxyMods.hazardMult || 1) * (doctrineMods.hazardMult || 1) * (focusMods.hazardMult || 1) * (contractMods.hazardMult || 1),
    eventRateMult: (integration.eventRateMult || 1) * (galaxyMods.eventRateMult || 1) * (doctrineMods.eventRateMult || 1) * (crewMods.systemEventRateMult || 1) * (focusMods.systemEventRateMult || 1) * (contractMods.systemEventRateMult || 1),
    integration,
    galaxyMods,
    doctrineMods,
    crewMods,
    focusMods,
    contractMods,
  };
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
  if ((body.tier || 1) > hubRange(state)) return false;
  if (body.requireTech && !state.tech[body.requireTech]) return false;
  if (body.requireMissions && (state.milestones?.missionsDone || 0) < body.requireMissions) return false;
  return (state.resources.signal || 0) >= Math.ceil((body.unlock || 0) * PACE.bodyUnlockMult);
}
function hubRange(state) {
  const relayBonus = colonyRoleCounts(state).relay || 0;
  return 1 + (state.hubUpgrades.scan_array || 0) + (state.tech.deep_scan ? 1 : 0) + (state.tech.rift_mapping ? 1 : 0) + relayBonus;
}
function commandCapacity(state) {
  const galaxyBonus = galaxyModifiers(state).commandCapBonus || 0;
  const doctrineBonus = doctrineModifiers(state).commandCapBonus || 0;
  return 1 + (state.hubUpgrades.launch_bay || 0) + (state.tech.auto_pilots ? 1 : 0) + galaxyBonus + doctrineBonus;
}
function deriveCapabilities(state) {
  const unlocked = new Set(state.milestonesUnlocked || []);
  const systemsUnlocked = unlocked.has("M2_SYSTEMS_DISCOVERED") || unlocked.has("M1_SYSTEMS_DISCOVERED");
  return {
    systems: systemsUnlocked,
    colonies: unlocked.has("M2_FIRST_COLONY"),
    integration: unlocked.has("M3_INTEGRATION_UNLOCK"),
    prestige: unlocked.has("M4_PRESTIGE_UNLOCK"),
  };
}
