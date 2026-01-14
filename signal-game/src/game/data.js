// Game data and balance constants.
export const STORAGE_KEY = "signalFrontierReact";
export const LEGACY_KEY = "signalFrontierState";
export const TICK_MS = 500;
export const SAVE_MS = 5000;
export const MAX_EVENTS_PER_BASE = 4;
export const SAVE_VERSION = 10;
export const TAB_ORDER = ["hub", "missions", "bases", "crew", "tech", "systems", "faction", "codex", "log", "profile"];
export const EVENT_COOLDOWN_MS = [45000, 90000];
export const PACE = {
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
export const CREW_FATIGUE = { gain: 0.00006, recovery: 0.0001 };
export const CONTRACT_REFRESH_MS = 180000;
export const COST_EXP = PACE.costExp;
export const SYSTEM_EVENT_COOLDOWN_MS = [90000, 180000];
export const MAX_SYSTEM_EVENTS = 3;

export const BODIES = [
  { id: "debris", name: "Debris Field", type: "asteroid", tier: 1, travel: 30, hazard: 0.05, unlock: 0, resources: { metal: 18, fuel: 4, research: 3 } },
  { id: "ice", name: "Ice Moon", type: "ice", tier: 2, travel: 60, hazard: 0.12, unlock: 400, resources: { organics: 25, fuel: 10, research: 5 } },
  { id: "lava", name: "Lava Rock", type: "warm", tier: 3, travel: 90, hazard: 0.2, unlock: 1200, resources: { metal: 50, rare: 3, research: 10 } },
  { id: "cradle", name: "Cradle Station", type: "asteroid", tier: 4, travel: 120, hazard: 0.18, unlock: 2400, requireTech: "deep_scan", resources: { fuel: 26, research: 22, rare: 8 } },
  { id: "ruins", name: "Fallen Relay", type: "warm", tier: 5, travel: 140, hazard: 0.22, unlock: 3800, requireTech: "shielding", resources: { metal: 160, research: 80, rare: 18 } },
  { id: "rift", name: "Rift Beacon", type: "unknown", tier: 6, travel: 180, hazard: 0.3, unlock: 6200, requireTech: "rift_mapping", resources: { fuel: 90, research: 140, rare: 30 } },
  { id: "spire", name: "Veil Spire", type: "unknown", tier: 7, travel: 210, hazard: 0.35, unlock: 8200, requireTech: "rift_mapping", requireMissions: 5, resources: { research: 200, rare: 40, fuel: 120 } },
];

export const HUB_UPGRADES = [
  { id: "launch_bay", name: "Launch Bay", desc: "+1 concurrent mission slot", cost: { metal: 140, fuel: 40 } },
  { id: "fuel_farm", name: "Fuel Farm", desc: "+2 fuel/tick", cost: { metal: 180, organics: 60 } },
  { id: "scan_array", name: "Scan Array", desc: "+3 signal/tick, +1 range tier", cost: { metal: 220, fuel: 20 } },
  { id: "drone_bay", name: "Drone Bay", desc: "+10% mission cargo", cost: { metal: 260, rare: 10 } },
];

export const HUB_BUILDINGS = [
  { id: "refinery", name: "Fuel Refinery", desc: "+2 fuel/tick", cost: { metal: 90, organics: 16 }, prod: { fuel: 2 }, cons: { power: 1 } },
  { id: "reactor", name: "Reactor", desc: "+4 power/tick, -1 fuel", cost: { metal: 140, fuel: 35 }, prod: { power: 4 }, cons: { fuel: 1 } },
  { id: "hab", name: "Hab Module", desc: "+4 habitat", cost: { metal: 120, organics: 40 }, prod: { habitat: 4 }, cons: {} },
  { id: "rec", name: "Rec Dome", desc: "Boosts morale", cost: { metal: 90, organics: 60 }, prod: { morale: 0.03 }, cons: { power: 1 } },
  { id: "array", name: "Comms Array", desc: "+4 signal/tick", cost: { metal: 180, fuel: 16 }, prod: { signal: 4 }, cons: { power: 1 } },
];
export const BIOME_BUILDINGS = {
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

export const BASE_TRAITS = {
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

export const TECH = [
  { id: "fuel_synth", tier: 1, name: "Fuel Synthesis", desc: "+1 fuel/tick", cost: { signal: 320, research: 12 }, unlock: 300, requires: [] },
  { id: "hazard_gear", tier: 2, name: "Hazard Gear", desc: "-25% mission hazard", cost: { signal: 1200, research: 60 }, unlock: 900, requires: ["fuel_synth"] },
  { id: "drone_log", tier: 2, name: "Logistics Drones", desc: "+20% mission cargo", cost: { signal: 1600, research: 90 }, unlock: 1400, requires: ["fuel_synth"] },
  { id: "deep_scan", tier: 2, name: "Deep Scan Arrays", desc: "+1 research/tick, +1 range tier, reveals deep targets", cost: { signal: 2000, research: 160 }, unlock: 1600, requires: ["fuel_synth"] },
  { id: "shielding", tier: 3, name: "Thermal Shielding", desc: "-40% hazard on hot zones; unlocks fallen relay", cost: { signal: 2800, research: 260 }, unlock: 2400, requires: ["deep_scan"] },
  { id: "rift_mapping", tier: 4, name: "Rift Mapping", desc: "Unlocks anomalous missions, +20% rare cargo, +1 range tier", cost: { signal: 4800, research: 360, rare: 12 }, unlock: 4200, requires: ["shielding","drone_log"] },
  { id: "auto_pilots", tier: 3, name: "Autonomous Pilots", desc: "+1 mission slot, -10% travel time", cost: { signal: 5600, research: 520, fuel: 80 }, unlock: 5200, requires: ["drone_log"] },
  { id: "bio_domes", tier: 3, name: "Bio-Domes", desc: "+2 food/tick and +2 habitat passive", cost: { signal: 6000, research: 540, organics: 120 }, unlock: 5200, requires: ["fuel_synth"] },
];

export const BASE_OPS = {
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

export const STARTER_TOUR = [
  { title: "Signal & Scans", body: "Collect Signal (Space) to reveal nearby targets. Pulse Scans convert signal into random loot.", anchor: "hub" },
  { title: "Hub Status", body: "Power, food, habitat, and morale drive sustainability. Keep power = 0 and food above upkeep.", anchor: "hub" },
  { title: "Missions", body: "Launch expeditions based on biome hazards. Fuel spend scales with distance.", anchor: "missions" },
  { title: "Bases", body: "Each biome unlocks unique structures and events. Build per-body upgrades on-site.", anchor: "bases" },
  { title: "Crew & Recruits", body: "Hire specialists with role bonuses. Assign crew to boost production.", anchor: "crew" },
];

export const CODEX_ENTRIES = [
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

export const MILESTONES = [
  { id: "M0_FOUNDATIONS", title: "Foundations Online", codexEntryId: "foundations", condition: (state) => true },
  { id: "M1_LOCAL_OPS", title: "Local Operations", codexEntryId: "local_ops", condition: (state) => (state.milestones?.missionsDone || 0) >= 1 || !!state.milestones?.firstLaunch },
  { id: "M2_SYSTEMS_DISCOVERED", title: "Systems Unlocked", codexEntryId: "systems_light", condition: (state) => hubRange(state) >= 3 },
  { id: "M2_FIRST_COLONY", title: "First Colony", codexEntryId: "colonies_anchor", condition: (state) => (state.colonies || []).length >= 1 },
  { id: "M3_INTEGRATION_UNLOCK", title: "Integration Projects", codexEntryId: "integration_projects", condition: (state) => (state.systems || []).some((s) => s.integratedAt) },
  { id: "M4_GALAXY_CHARTED", title: "Galaxy Charted", codexEntryId: "galaxy_ops", condition: (state) => galaxyDepth(state) >= 2 },
  { id: "M5_DOCTRINE_SELECTED", title: "Doctrine Selected", codexEntryId: "doctrine_ops", condition: (state) => !!state.doctrine },
  { id: "M4_PRESTIGE_UNLOCK", title: "Prestige Ready", codexEntryId: "prestige_recalibration", condition: (state) => galaxyDepth(state) >= 2 && (state.systems || []).filter((s) => s.integratedAt).length >= 2 && signalSaturation(state).penalty >= 0.25 },
];

export const MISSION_MODES = [
  { id: "balanced", name: "Balanced", desc: "Standard risk and rewards.", hazard: 0, durationMs: 0, reward: {} },
  { id: "survey", name: "Survey", desc: "+60% research, slower travel, lower cargo", hazard: 0.04, durationMs: 8000, reward: { research: 1.6, all: 0.9 } },
  { id: "salvage", name: "Salvage", desc: "+30% metal/organics cargo, small hazard bump", hazard: 0.06, durationMs: 0, reward: { metal: 1.3, organics: 1.3 } },
  { id: "secure", name: "Secure", desc: "-35% hazard, longer flight, -10% cargo", hazard: -0.35, durationMs: 6000, reward: { all: 0.9 } },
  { id: "relay", name: "Relay", desc: "+25% fuel & signal cargo, modest hazard", hazard: 0.08, durationMs: -2000, reward: { fuel: 1.25, signal: 1.25 } },
];
export const SYSTEM_NAME_PARTS = {
  prefix: ["Astra", "Helix", "Orion", "Vanta", "Nyx", "Vega", "Argo", "Lumen", "Cinder", "Atlas"],
  suffix: ["Reach", "Drift", "Nexus", "Vale", "Crown", "Ridge", "Spur", "Gate", "Span", "Haven"],
};
export const SYSTEM_TRAITS = [
  { id: "rich_metal", name: "Rich Metal", desc: "Dense ore belts and higher extraction yields." },
  { id: "high_resonance", name: "High Resonance", desc: "Scan returns trend higher, but surveys are slower." },
  { id: "quiet_orbit", name: "Quiet Orbit", desc: "Lower event frequency; stability holds longer." },
  { id: "debris_field", name: "Debris Field", desc: "Salvage opportunities increase mission cargo." },
  { id: "ion_storms", name: "Ion Storms", desc: "Hazards spike on aggressive runs." },
  { id: "ancient_relay", name: "Ancient Relay", desc: "Legacy infrastructure boosts travel efficiency." },
];
export const SYSTEM_SURVEY_STEPS = {
  scan: { id: "scan", name: "Deep Scan", cost: { signal: 160 }, duration: 20000 },
  probe: { id: "probe", name: "Probe Drop", cost: { metal: 60, fuel: 18 }, duration: 30000 },
  survey: { id: "survey", name: "Full Survey", cost: { research: 30, fuel: 30 }, duration: 42000 },
};
export const SURVEY_SEQUENCE = ["scan", "probe", "survey", "colonize", "colonized"];
export const COLONY_ROLES = [
  { id: "relay", name: "Relay Anchor", desc: "Extends hub range and trims travel times." },
  { id: "survey", name: "Survey Anchor", desc: "Improves scan yield and survey throughput." },
  { id: "logistics", name: "Logistics Anchor", desc: "Improves mission throughput and travel efficiency." },
];
export const COLONY_COST = { metal: 180, fuel: 60, food: 20, organics: 12 };
export const CREW_PROGRAMS = [
  { id: "mission_corps", name: "Mission Corps", desc: "Standardized mission playbooks: higher cargo, more objectives, lower hazard.", unlock: { milestone: "M1_LOCAL_OPS" }, cost: { research: 20, metal: 60, food: 10 } },
  { id: "base_command", name: "Base Command", desc: "Outpost command training reduces event frequency and steadies recovery.", unlock: { milestone: "M2_FIRST_COLONY" }, cost: { research: 30, metal: 80, organics: 20 } },
  { id: "science_guild", name: "Science Guild", desc: "Research mentorship improves scans and mission research yields.", unlock: { tech: "deep_scan" }, cost: { research: 35, signal: 120, organics: 24 } },
  { id: "logistics_wing", name: "Logistics Wing", desc: "Improves travel efficiency and lowers fuel overhead.", unlock: { milestone: "M2_SYSTEMS_DISCOVERED" }, cost: { metal: 90, fuel: 30, food: 12 } },
  { id: "morale_office", name: "Morale Office", desc: "Crew counseling boosts morale stability across hubs and outposts.", unlock: { milestone: "M3_INTEGRATION_UNLOCK" }, cost: { food: 30, organics: 30, research: 20 } },
];
export const CREW_CONTRACTS = [
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
export const SYSTEM_EVENTS = [
  { id: "supply_shortage", name: "Supply Shortage", desc: "Cargo throughput reduced until resupplied.", effect: { cargoMult: 0.85 }, cost: { food: 12, fuel: 10 } },
  { id: "crew_friction", name: "Crew Friction", desc: "Survey pace slowed; scans feel noisy.", effect: { surveySpeed: 1.1, scanMult: 0.9 }, cost: { food: 8, organics: 8 } },
  { id: "interference_spike", name: "Interference Spike", desc: "Travel time rises; hazards intensify.", effect: { travelMult: 1.12, hazardMult: 1.08 }, cost: { signal: 120, metal: 20 } },
  { id: "anomaly_bloom", name: "Anomaly Bloom", desc: "Strange pulses unsettle crews but enrich data.", effect: { cargoMult: 1.05, stabilityDrain: 0.02 }, cost: { research: 20, fuel: 12 } },
];
export const INTEGRATION_PROJECTS = [
  { id: "stabilize_system", name: "Stabilize System", desc: "Reduce event rates and restore stability.", duration: 180000, cost: { metal: 160, fuel: 40, research: 40 }, effect: { eventRateMult: 0.85, stability: 15 } },
  { id: "build_gate", name: "Build Gate", desc: "Reduces travel penalties across the frontier.", duration: 240000, cost: { metal: 220, fuel: 80, rare: 4 }, effect: { travelMult: 0.9 } },
  { id: "harmonize_signal", name: "Harmonize Signal", desc: "Reduces signal saturation penalties.", duration: 300000, cost: { signal: 400, research: 80, rare: 6 }, effect: { saturationRelief: 0.15, signalCapBonus: 200 } },
];
export const GALAXY_RULESETS = [
  { id: "dense", name: "Dense Galaxy", desc: "More systems, higher upkeep pressure, stronger industry.", mods: { eventRateMult: 1.08, cargoMult: 1.06, commandCapBonus: 1, systemCountBonus: 1 } },
  { id: "chaotic", name: "Chaotic Galaxy", desc: "Volatile events and hazards with spiky returns.", mods: { eventRateMult: 1.2, hazardMult: 1.12, cargoMult: 1.04, systemCountBonus: 0 } },
  { id: "silent", name: "Silent Galaxy", desc: "Signal is capped; research and scans are more efficient.", mods: { signalCapMult: 0.9, scanMult: 1.12, saturationRelief: 0.2, systemCountBonus: -1 } },
];
export const DOCTRINES = [
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
