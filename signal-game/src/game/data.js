// Game data and balance constants.
export const STORAGE_KEY = "signalFrontierReact";
export const LEGACY_KEY = "signalFrontierState";
export const GAME_TITLE = "Beyond The Veil";
export const TICK_MS = 500;
export const SAVE_MS = 5000;
export const MAX_EVENTS_PER_BASE = 4;
export const SAVE_VERSION = 11;
export const TAB_ORDER = ["hub", "expeditions", "crew", "tech", "systems", "faction", "codex", "wiki", "log", "profile"];
export const EVENT_COOLDOWN_MS = [45000, 90000];
export const FRAGMENT_TOTAL = 1000;
export const FRAGMENT_THRESHOLDS = [
  { id: "FRAG_25", percent: 0.25, title: "The First Whisper", codexEntryId: "veil_whisper", message: "A shared transmission cuts through every relay: \"Remember. Restore. Return.\"" },
  { id: "FRAG_50", percent: 0.5, title: "The Awakening of Limbs", codexEntryId: "veil_awakening", message: "Crew reports synchronized movement across distant outposts. The fragments are shifting." },
  { id: "FRAG_75", percent: 0.75, title: "Dreams Become Instructions", codexEntryId: "veil_instructions", message: "Blueprints arrive in the sleep cycle. They describe machines no one understands." },
  { id: "FRAG_90", percent: 0.9, title: "Partial Reconstruction", codexEntryId: "veil_partial", message: "The Veil speaks from every repository at once. It is almost whole." },
  { id: "FRAG_95", percent: 0.95, title: "The Choice Point", codexEntryId: "veil_choice", message: "The network must decide: complete the entity, hold the line, or shatter the fragments." },
  { id: "FRAG_100", percent: 1, title: "The Reconstruction", codexEntryId: "veil_reconstruction", message: "Fragments converge. The Veil is complete." },
];
export const PACE = {
  costExp: { hub: 1.16, base: 1.2, crew: 1.22 },
  techCostMult: 1.6,
  techUnlockMult: 1.7,
  bodyUnlockMult: 1.7,
  missionDurationMult: 2.0,
  missionYieldMult: 0.6,
  surveyDurationMult: 1.8,
  integrationDurationMult: 1.9,
};
export const CREW_FATIGUE = { gain: 0.00006, recovery: 0.0001 };
export const CONTRACT_REFRESH_MS = 180000;
export const COST_EXP = PACE.costExp;
export const HUB_TIER_STEP = 25;
export const HUB_TIER_COST_MULT = 2.5;
export const HUB_UPGRADE_TIER_MULT = 3.0;
export const SYSTEM_EVENT_COOLDOWN_MS = [90000, 180000];
export const MAX_SYSTEM_EVENTS = 3;

export const BODIES = [
  { id: "debris", name: "Debris Field", type: "asteroid", tier: 1, travel: 30, hazard: 0.05, unlock: 0, focus: ["Metal", "Salvage"], reason: "Best early metal salvage for hub fabrication.", resources: { metal: 28, fuel: 1, research: 1 } },
  { id: "ice", name: "Ice Moon", type: "ice", tier: 2, travel: 60, hazard: 0.12, unlock: 400, focus: ["Fuel", "Food"], reason: "Fuel and sustenance caches keep long routes running.", resources: { organics: 16, fuel: 14, food: 8, research: 3 } },
  { id: "lava", name: "Lava Rock", type: "warm", tier: 3, travel: 90, hazard: 0.2, unlock: 1200, focus: ["Power", "Organics"], reason: "Thermal veins feed power cores and organics pipelines.", resources: { metal: 20, organics: 18, rare: 4, research: 6 } },
  { id: "cradle", name: "Cradle Station", type: "asteroid", tier: 4, travel: 120, hazard: 0.18, unlock: 2400, requireTech: "deep_scan", focus: ["Research", "Fuel"], reason: "Mid-tier research caches and fuel reservoirs.", resources: { metal: 70, fuel: 18, research: 18, rare: 8 } },
  { id: "ruins", name: "Fallen Relay", type: "warm", tier: 5, travel: 140, hazard: 0.22, unlock: 3800, requireTech: "shielding", focus: ["Research", "Rare"], reason: "Ancient relay cores yield rare alloys and deep research.", resources: { metal: 120, organics: 50, research: 140, rare: 24 } },
  { id: "rift", name: "Rift Beacon", type: "unknown", tier: 6, travel: 180, hazard: 0.3, unlock: 6200, requireTech: "rift_mapping", focus: ["Rare", "Signal"], reason: "Anomalous vaults spike rare yields and signal flow.", resources: { fuel: 80, research: 180, rare: 40, signal: 120 } },
  { id: "spire", name: "Veil Spire", type: "unknown", tier: 7, travel: 210, hazard: 0.35, unlock: 8200, requireTech: "rift_mapping", requireMissions: 5, focus: ["Signal", "Fragments"], reason: "Endgame signal surges and fragment-rich salvage.", resources: { research: 260, rare: 70, fuel: 120, signal: 200 } },
];

export const HUB_UPGRADES = [
  { id: "launch_bay", name: "Launch Bay", desc: "+1 concurrent expedition slot", cost: { metal: 220, fuel: 70, research: 20 }, requires: [{ id: "nav_console", level: 1 }] },
  { id: "fuel_farm", name: "Fuel Farm", desc: "+1 fuel/tick", cost: { metal: 200, organics: 80, fuel: 20 }, requires: [{ id: "refinery", level: 2 }] },
  { id: "scan_array", name: "Scan Array", desc: "+2 signal/tick, +1 range tier", cost: { metal: 240, fuel: 60, research: 40 }, requires: [{ id: "signal_uplink", level: 2 }] },
  { id: "drone_bay", name: "Drone Bay", desc: "+8% expedition cargo", cost: { metal: 300, rare: 16, fuel: 40 }, requires: [{ id: "alloy_foundry", level: 1 }] },
  { id: "command_uplink", name: "Command Uplink", desc: "+1 command capacity", cost: { metal: 320, fuel: 120, research: 60 }, requires: [{ id: "nav_console", level: 2 }] },
  { id: "survey_lab", name: "Survey Lab", desc: "+8% expedition research yield", cost: { metal: 260, research: 120, organics: 40 }, requires: [{ id: "signal_uplink", level: 2 }, { id: "bioforge", level: 1 }] },
  { id: "mission_control", name: "Expedition Control", desc: "-4% expedition hazard", cost: { metal: 260, fuel: 90, research: 80 }, requires: [{ id: "launch_bay", level: 1 }, { id: "reactor", level: 2 }] },
  { id: "supply_depot", name: "Supply Depot", desc: "-5% expedition fuel cost", cost: { metal: 240, fuel: 120, organics: 60 }, requires: [{ id: "refinery", level: 2 }] },
  { id: "signal_vault", name: "Signal Vault", desc: "+120 signal cap", cost: { metal: 240, research: 80, rare: 8 }, requires: [{ id: "signal_uplink", level: 3 }, { id: "signal_amplifier", level: 1 }] },
  { id: "habitat_wing", name: "Habitat Wing", desc: "+2 habitat/tick, +0.01 morale/tick", cost: { metal: 220, organics: 110, food: 30 }, requires: [{ id: "hab", level: 2 }] },
];

export const HUB_BUILDING_TIERS = {
  0: { signal: 0, hubLevel: 0 },
  1: { signal: 60, hubLevel: 4 },
  2: { signal: 180, hubLevel: 10, missions: 3 },
  3: { signal: 360, hubLevel: 20, missions: 6 },
};
export const HUB_BUILDINGS = [
  { id: "salvage_dock", name: "Salvage Dock", desc: "+2 metal/tick", cost: { fuel: 8 }, prod: { metal: 2 }, cons: {}, tier: 0, category: "materials" },
  { id: "biofilter_vats", name: "Biofilter Vats", desc: "+2 organics/tick", cost: { metal: 25 }, prod: { organics: 2 }, cons: {}, tier: 0, category: "life" },
  { id: "reactor", name: "Micro Reactor", desc: "+3 power/tick", cost: { metal: 70, organics: 10 }, prod: { power: 3 }, cons: {}, tier: 0, category: "power", costExp: 1.14, unlock: { requires: [{ id: "salvage_dock", level: 1 }] } },
  { id: "signal_uplink", name: "Signal Uplink", desc: "+2 signal/tick", cost: { metal: 40, organics: 12 }, prod: { signal: 2 }, cons: { power: 1 }, tier: 0, category: "signal", unlock: { requires: [{ id: "reactor", level: 1 }] } },
  { id: "refinery", name: "Fuel Refinery", desc: "+1 fuel/tick", cost: { metal: 110, organics: 20 }, prod: { fuel: 1 }, cons: { power: 1 }, tier: 1, category: "logistics", costExp: 1.1, unlock: { tech: "fuel_synth", requires: [{ id: "biofilter_vats", level: 2 }] } },
  { id: "hab", name: "Hab Module", desc: "+3 habitat", cost: { metal: 140, organics: 50 }, prod: { habitat: 3 }, cons: { power: 1 }, tier: 1, category: "life", unlock: { requires: [{ id: "biofilter_vats", level: 1 }] } },
  { id: "hydroponics", name: "Hydroponics Bay", desc: "+2 food/tick, +1 habitat", cost: { metal: 130, organics: 45 }, prod: { food: 2, habitat: 1 }, cons: { power: 1 }, tier: 1, category: "life", unlock: { requires: [{ id: "hab", level: 1 }] } },
  { id: "rec", name: "Rec Dome", desc: "Boosts morale", cost: { metal: 120, organics: 80 }, prod: { morale: 0.02 }, cons: { power: 1 }, tier: 1, category: "life", unlock: { requires: [{ id: "hydroponics", level: 1 }] } },
  { id: "array", name: "Comms Array", desc: "+3 signal/tick", cost: { metal: 200, fuel: 20 }, prod: { signal: 3 }, cons: { power: 1 }, tier: 1, category: "signal", unlock: { requires: [{ id: "signal_uplink", level: 2 }] } },
  { id: "nav_console", name: "Nav Console", desc: "-1% expedition travel time per level", cost: { metal: 180, fuel: 30, research: 22 }, prod: {}, cons: { power: 1 }, travelMult: 0.99, tier: 1, category: "logistics", unlock: { requires: [{ id: "refinery", level: 1 }] } },
  { id: "alloy_foundry", name: "Alloy Foundry", desc: "+5 metal/tick", cost: { metal: 320, fuel: 60 }, prod: { metal: 5 }, cons: { power: 2 }, tier: 2, category: "materials", unlock: { requires: [{ id: "salvage_dock", level: 3 }] } },
  { id: "bioforge", name: "Bioforge", desc: "+3 organics/tick, +1 food/tick", cost: { metal: 280, organics: 100 }, prod: { organics: 3, food: 1 }, cons: { power: 2 }, tier: 2, category: "life", unlock: { requires: [{ id: "biofilter_vats", level: 3 }] } },
  { id: "power_core", name: "Power Core", desc: "+10 power/tick", cost: { metal: 320, organics: 160, research: 40 }, prod: { power: 10 }, cons: {}, tier: 2, category: "power", unlock: { requires: [{ id: "reactor", level: 3 }] } },
  { id: "signal_amplifier", name: "Signal Amplifier", desc: "+5 signal/tick", cost: { metal: 300, organics: 80, fuel: 40 }, prod: { signal: 5 }, cons: { power: 2 }, tier: 2, category: "signal", unlock: { requires: [{ id: "signal_uplink", level: 3 }] } },
  { id: "catalyst_cracker", name: "Catalyst Cracker", desc: "+2 fuel/tick, -1 organics", cost: { metal: 320, fuel: 40, organics: 60 }, prod: { fuel: 2 }, cons: { power: 1, organics: 1 }, tier: 2, category: "logistics", costExp: 1.13, unlock: { requires: [{ id: "refinery", level: 2 }] } },
  { id: "hydrogen_cracker", name: "Hydrogen Cracker", desc: "+3 fuel/tick, -1 organics", cost: { metal: 420, organics: 120, research: 60 }, prod: { fuel: 3 }, cons: { power: 2, organics: 1 }, tier: 2, category: "logistics", costExp: 1.12, unlock: { tech: "advanced_refining", requires: [{ id: "refinery", level: 3 }] } },
  { id: "auto_balancer", name: "Auto-Balancer", desc: "Throttles conversion to prevent resource collapse.", cost: { metal: 2000, organics: 1000, research: 500 }, prod: {}, cons: { power: 1 }, tier: 2, category: "logistics", costExp: 1.16, unlock: { hubLevel: 20, requires: [{ id: "refinery", level: 2 }] } },
  { id: "priority_manager", name: "Priority Manager", desc: "Allocate output focus across critical resources.", cost: { metal: 3200, organics: 1400, research: 1000 }, prod: {}, cons: { power: 1 }, tier: 2, category: "logistics", costExp: 1.18, unlock: { hubLevel: 25, requires: [{ id: "auto_balancer", level: 1 }] } },
  { id: "logistics_hub", name: "Logistics Hub", desc: "+3 fuel/tick, -3% travel time", cost: { metal: 520, fuel: 160, organics: 80 }, prod: { fuel: 3 }, cons: { power: 2 }, travelMult: 0.97, tier: 3, category: "logistics", unlock: { requires: [{ id: "refinery", level: 3 }] } },
  { id: "synthesis_stack", name: "Synthesis Stack", desc: "+5 fuel/tick, -2 organics", cost: { metal: 640, fuel: 140, organics: 180, research: 80 }, prod: { fuel: 5 }, cons: { power: 2, organics: 2 }, tier: 3, category: "logistics", unlock: { requires: [{ id: "catalyst_cracker", level: 2 }] } },
  { id: "hab_ring", name: "Habitat Ring", desc: "+10 habitat, +0.05 morale/tick", cost: { metal: 520, organics: 200, fuel: 100 }, prod: { habitat: 10, morale: 0.05 }, cons: { power: 2 }, tier: 3, category: "life", unlock: { requires: [{ id: "hab", level: 3 }] } },
  { id: "fusion_core", name: "Fusion Core", desc: "+18 power/tick", cost: { metal: 700, organics: 220, research: 110 }, prod: { power: 18 }, cons: {}, tier: 3, category: "power", unlock: { requires: [{ id: "power_core", level: 2 }] } },
  { id: "deep_array", name: "Deep Array", desc: "+8 signal/tick, +0.2 research/tick", cost: { metal: 600, fuel: 160, research: 140 }, prod: { signal: 8, research: 0.2 }, cons: { power: 3 }, tier: 3, category: "signal", unlock: { requires: [{ id: "signal_amplifier", level: 2 }] } },
];
export const BASE_ZONES = [
  { id: "core", name: "Core Zone", cost: 0, desc: "Baseline fabrication and upkeep." },
  { id: "industrial", name: "Industrial Zone", cost: 60, desc: "Advanced production rigs and logistics." },
  { id: "research", name: "Research Zone", cost: 180, desc: "Specialized labs and signal arrays." },
  { id: "residential", name: "Residential Zone", cost: 360, desc: "Worker housing and expanded workforce." },
  { id: "deep", name: "Deep Sector", cost: 600, desc: "Rare/exotic structures and endgame systems." },
];
export const BIOME_BUILDINGS = {
  asteroid: [
    { id: "maintenance_bay", name: "Maintenance Bay", desc: "+2 maintenance cap", cost: { metal: 110, fuel: 10 }, prod: {}, cons: { power: 1 }, maintenanceCap: 2 },
    { id: "fuel_cracker", name: "Fuel Cracker", desc: "+1 fuel/tick", cost: { metal: 90 }, prod: { fuel: 1 }, cons: { power: 1 } },
    { id: "ore_rig", name: "Ore Rig", desc: "+5 metal/tick", cost: { metal: 120 }, prod: { metal: 5 }, cons: { power: 1 } },
    { id: "solar_sail", name: "Solar Sail", desc: "+2 power/tick", cost: { metal: 70 }, prod: { power: 2 }, cons: {} },
    { id: "cargo_rig", name: "Cargo Rig", desc: "Rig branch: +12% expedition cargo from this outpost", cost: { metal: 220, fuel: 30 }, prod: {}, cons: { power: 1 }, requires: [{ id: "ore_rig", level: 3 }], cargoMult: 1.12, group: "rig_branch", zone: "industrial" },
    { id: "core_rig", name: "Core Rig", desc: "Rig branch: +4 rare/tick, +4 metal/tick", cost: { metal: 260, fuel: 40 }, prod: { rare: 4, metal: 4 }, cons: { power: 2 }, requires: [{ id: "ore_rig", level: 3 }], group: "rig_branch", zone: "research" },
    { id: "logistics_depot", name: "Logistics Depot", desc: "+5% cargo, -5% travel time", cost: { metal: 180, fuel: 20 }, prod: {}, cons: { power: 1 }, cargoMult: 1.05, travelMult: 0.95, zone: "industrial" },
    { id: "core_tap", name: "Core Tap", desc: "+6 metal/tick, +2 rare/tick", cost: { metal: 260, fuel: 50 }, prod: { metal: 6, rare: 2 }, cons: { power: 2 }, requires: [{ id: "ore_rig", level: 2 }], zone: "research" },
    { id: "orbital_foundry", name: "Orbital Foundry", desc: "+3 rare/tick, +10% expedition cargo from this outpost (applied in cargo calc)", cost: { metal: 320, rare: 12 }, prod: { rare: 3 }, cons: { power: 2 }, requires: [{ id: "core_tap", level: 1 }], cargoMult: 1.1, zone: "deep" },
  ],
  ice: [
    { id: "maintenance_bay", name: "Maintenance Bay", desc: "+2 maintenance cap", cost: { metal: 110, fuel: 10 }, prod: {}, cons: { power: 1 }, maintenanceCap: 2 },
    { id: "thermal_pump", name: "Thermal Pump", desc: "+4 fuel/tick", cost: { metal: 110, fuel: 16 }, prod: { fuel: 4 }, cons: { power: 1 } },
    { id: "algae_farm", name: "Algae Farm", desc: "+4 food/tick", cost: { metal: 90, organics: 40 }, prod: { food: 4 }, cons: { power: 1 } },
    { id: "protein_farm", name: "Protein Farm", desc: "Algae branch: +6 food/tick, +3% morale", cost: { metal: 180, organics: 70 }, prod: { food: 6, morale: 0.03 }, cons: { power: 1 }, requires: [{ id: "algae_farm", level: 3 }], group: "algae_branch", zone: "industrial" },
    { id: "bio_reactor", name: "Bio-Reactor", desc: "Algae branch: food -> power/fuel", cost: { metal: 200, organics: 80, fuel: 20 }, prod: { power: 3, fuel: 2 }, cons: { food: 1 }, requires: [{ id: "algae_farm", level: 3 }], group: "algae_branch", zone: "industrial" },
    { id: "logistics_depot", name: "Logistics Depot", desc: "+5% cargo, -5% travel time", cost: { metal: 180, fuel: 20 }, prod: {}, cons: { power: 1 }, cargoMult: 1.05, travelMult: 0.95, zone: "industrial" },
    { id: "cryo_distillery", name: "Cryo Distillery", desc: "Converts organics to fuel (+4 fuel/tick, -1 organics/tick)", cost: { metal: 200, organics: 80 }, prod: { fuel: 4 }, cons: { organics: 1, power: 1 }, requires: [{ id: "thermal_pump", level: 2 }], zone: "research" },
    { id: "glacier_observatory", name: "Glacier Observatory", desc: "+4 research/tick", cost: { metal: 260, fuel: 40 }, prod: { research: 4 }, cons: { power: 2 }, requires: [{ id: "cryo_distillery", level: 1 }], zone: "research" },
  ],
  warm: [
    { id: "maintenance_bay", name: "Maintenance Bay", desc: "+2 maintenance cap", cost: { metal: 110, fuel: 10 }, prod: {}, cons: { power: 1 }, maintenanceCap: 2 },
    { id: "shield_dome", name: "Shield Dome", desc: "-20% hazard on expeditions from this outpost", cost: { metal: 140, fuel: 20 }, prod: {}, cons: { power: 1 }, hazardMult: 0.8 },
    { id: "vapor_trap", name: "Vapor Trap", desc: "+3 organics/tick", cost: { metal: 90, fuel: 12 }, prod: { organics: 3 }, cons: {} },
    { id: "interceptor_net", name: "Interceptor Net", desc: "Shield branch: -35% hazard, -10% travel time", cost: { metal: 220, fuel: 50 }, prod: {}, cons: { power: 2 }, requires: [{ id: "shield_dome", level: 2 }], hazardMult: 0.65, travelMult: 0.9, group: "shield_branch", zone: "industrial" },
    { id: "comfort_dome", name: "Comfort Dome", desc: "Shield branch: +6% morale, events less severe", cost: { metal: 200, organics: 90 }, prod: { morale: 0.06 }, cons: { power: 1 }, requires: [{ id: "shield_dome", level: 2 }], group: "shield_branch", zone: "industrial" },
    { id: "logistics_depot", name: "Logistics Depot", desc: "+5% cargo, -5% travel time", cost: { metal: 180, fuel: 20 }, prod: {}, cons: { power: 1 }, cargoMult: 1.05, travelMult: 0.95, zone: "industrial" },
    { id: "plasma_furnace", name: "Plasma Furnace", desc: "+8 power/tick, +5 metal/tick", cost: { metal: 240, fuel: 60 }, prod: { power: 8, metal: 5 }, cons: { fuel: 2 }, zone: "industrial" },
    { id: "shield_spire", name: "Shield Spire", desc: "Greatly reduces hazard; boosts morale", cost: { metal: 280, fuel: 80 }, prod: { morale: 0.08 }, cons: { power: 2 }, requires: [{ id: "shield_dome", level: 1 }], hazardMult: 0.7, zone: "research" },
  ],
  unknown: [
    { id: "maintenance_bay", name: "Maintenance Bay", desc: "+2 maintenance cap", cost: { metal: 110, fuel: 10 }, prod: {}, cons: { power: 1 }, maintenanceCap: 2 },
    { id: "anomaly_lab", name: "Anomaly Lab", desc: "+2 rare/tick", cost: { metal: 160, rare: 8 }, prod: { rare: 2 }, cons: { power: 1 } },
    { id: "relay_spire", name: "Relay Spire", desc: "Lab branch: +8% cargo, -8% travel time", cost: { metal: 240, rare: 10, fuel: 40 }, prod: {}, cons: { power: 2 }, requires: [{ id: "anomaly_lab", level: 2 }], cargoMult: 1.08, travelMult: 0.92, group: "lab_branch", zone: "research" },
    { id: "ward_matrix", name: "Ward Matrix", desc: "Lab branch: -40% hazard, +3 rare/tick", cost: { metal: 260, rare: 12 }, prod: { rare: 3 }, cons: { power: 2 }, requires: [{ id: "anomaly_lab", level: 2 }], hazardMult: 0.6, group: "lab_branch", zone: "research" },
    { id: "logistics_depot", name: "Logistics Depot", desc: "+5% cargo, -5% travel time", cost: { metal: 180, fuel: 20 }, prod: {}, cons: { power: 1 }, cargoMult: 1.05, travelMult: 0.95, zone: "industrial" },
    { id: "phase_relay", name: "Phase Relay", desc: "+5 signal/tick, -travel time for expeditions", cost: { metal: 240, rare: 10, fuel: 40 }, prod: { signal: 5 }, cons: { power: 2 }, travelMult: 0.85, zone: "research" },
    { id: "anomaly_vault", name: "Anomaly Vault", desc: "+6 rare/tick, +6 research/tick", cost: { metal: 320, rare: 16 }, prod: { rare: 6, research: 6 }, cons: { power: 2 }, requires: [{ id: "anomaly_lab", level: 2 }], zone: "deep" },
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
  { id: "fuel_synth", tier: 1, name: "Fuel Synthesis", desc: "Unlocks Fuel Refinery building.", cost: { research: 12 }, unlock: 300, requires: [] },
  { id: "advanced_refining", tier: 2, name: "Advanced Refining", desc: "Unlocks Hydrogen Cracker fuel bays.", cost: { research: 140 }, unlock: 1200, requires: ["fuel_synth"] },
  { id: "hazard_gear", tier: 2, name: "Hazard Gear", desc: "-25% expedition hazard", cost: { research: 60 }, unlock: 900, requires: ["fuel_synth"] },
  { id: "drone_log", tier: 2, name: "Logistics Drones", desc: "+20% expedition cargo", cost: { research: 90 }, unlock: 1400, requires: ["fuel_synth"] },
  { id: "deep_scan", tier: 2, name: "Deep Scan Arrays", desc: "+1 research/tick, +1 range tier, reveals deep targets", cost: { research: 160 }, unlock: 1600, requires: ["fuel_synth"] },
  { id: "shielding", tier: 3, name: "Thermal Shielding", desc: "-40% hazard on hot zones; unlocks fallen relay", cost: { research: 260 }, unlock: 2400, requires: ["deep_scan"] },
  { id: "rift_mapping", tier: 4, name: "Rift Mapping", desc: "Unlocks anomalous expeditions, +20% rare cargo, +1 range tier", cost: { research: 360, rare: 12 }, unlock: 4200, requires: ["shielding","drone_log"] },
  { id: "auto_pilots", tier: 3, name: "Autonomous Pilots", desc: "+1 expedition slot, -10% travel time", cost: { research: 520, fuel: 80 }, unlock: 5200, requires: ["drone_log"] },
  { id: "bio_domes", tier: 3, name: "Bio-Domes", desc: "+2 food/tick and +2 habitat passive", cost: { research: 540, organics: 120 }, unlock: 5200, requires: ["fuel_synth"] },
];

export const BASE_OPS = {
  asteroid: [
    { id: "stabilize_grid", name: "Stabilize Grid", desc: "Patch power relays; reduce power gating risk for a while.", cost: { metal: 25 }, reward: { power: 4 }, cooldown: 20000 },
    { id: "deep_bore", name: "Deep Bore", desc: "Drill deeper veins; yields metal + fuel.", cost: { fuel: 8 }, reward: { metal: 35, fuel: 8 }, cooldown: 25000 },
  ],
  ice: [
    { id: "heat_melt", name: "Heat Melt", desc: "Melt and refreeze; yields organics + fuel.", cost: { power: 2, fuel: 6 }, reward: { organics: 24, fuel: 10 }, cooldown: 25000 },
    { id: "glacier_scan", name: "Glacier Scan", desc: "Scan crevasses; small research burst.", cost: { fuel: 4, research: 4 }, reward: { research: 10 }, cooldown: 20000 },
  ],
  warm: [
    { id: "shield_tune", name: "Shield Tune", desc: "Tune domes; reduce hazard and improve morale.", cost: { fuel: 10, metal: 20 }, reward: { morale: 0.05 }, cooldown: 22000 },
    { id: "slag_skim", name: "Slag Skim", desc: "Skim molten flows; yields metal and rare traces.", cost: { power: 2 }, reward: { metal: 40, rare: 2 }, cooldown: 28000 },
  ],
  unknown: [
    { id: "anomaly_probe", name: "Anomaly Probe", desc: "Probe strange signals; yields research/rare.", cost: { fuel: 12, research: 8 }, reward: { research: 18, rare: 3 }, cooldown: 30000 },
  ],
};

export const STARTER_TOUR = [
  { title: "Signal Uplink", body: "Signal is a progress meter. Build uplinks to raise it and unlock new systems.", anchor: "hub" },
  { title: "Hub Status", body: "Power, food, habitat, and morale drive sustainability. Keep power >= 0 and food above upkeep.", anchor: "hub" },
  { title: "Expeditions", body: "Plan expeditions based on biome hazards. Fuel spend scales with distance.", anchor: "expeditions" },
  { title: "Outposts", body: "Each biome unlocks unique structures and events. Build per-body upgrades on-site.", anchor: "expeditions" },
  { title: "Crew & Recruits", body: "Hire specialists with role bonuses. Assign crew to boost production.", anchor: "crew" },
  { title: "Fragments", body: "Some expeditions recover strange fragments. Global reassembly milestones unlock new codex entries.", anchor: "hub" },
];

export const CODEX_ENTRIES = [
  { id: "veil_premise", title: "Beyond The Veil", body: "Humanity is not exploring; we are excavating fragments of a shattered entity. Every recovery brings the Veil closer." },
  { id: "veil_fragments", title: "The Fragments", body: "Biological, geometric, void, resonance, and temporal fragments distort reality. Proximity brings dreams, synchronicity, and the Calling." },
  { id: "veil_whisper", title: "The First Whisper", body: "At 25% reassembly, the fragments speak in a shared voice: \"Remember. Restore. Return.\"" },
  { id: "veil_awakening", title: "The Awakening of Limbs", body: "At 50%, contamination spikes and coordinated behavior spreads. The fragments begin moving toward each other." },
  { id: "veil_instructions", title: "Dreams Become Instructions", body: "At 75%, the dreams turn to blueprints. Some crews build devices they do not understand." },
  { id: "veil_partial", title: "Partial Reconstruction", body: "At 90%, the entity speaks through every repository at once. It is grateful. It is almost whole." },
  { id: "veil_choice", title: "The Choice Point", body: "At 95%, the network will choose: complete the entity, hold the line, or attempt shattering." },
  { id: "veil_reconstruction", title: "The Reconstruction", body: "At 100%, the fragments converge. What remains depends on which doctrine holds the most." },
  { id: "foundations", title: "Baseline Foundations", body: "Save versioning, capability gating, and milestone triggers keep the loop stable as the frontier expands." },
  { id: "scan_ops", title: "Signal Uplink", body: "Signal rises through uplink infrastructure and unlocks new systems, tech tiers, and story milestones." },
  { id: "mission_ops", title: "Expedition Ops", body: "Expedition targets have depletion curves. Expect diminishing returns as you farm the same body." },
  { id: "hub_ops", title: "Hub Operations", body: "Hub upgrades expand range and slot capacity, unlocking higher-tier targets." },
  { id: "base_ops", title: "Outpost Operations", body: "Outposts open unique structures, events, and ops per biome. Expand once expeditions stabilize." },
  { id: "crew_ops", title: "Crew Command", body: "Crew roles and fatigue impact production, travel, and hazard tolerance." },
  { id: "tech_ops", title: "Research Tracks", body: "Tech branches unlock new targets and efficiency tools." },
  { id: "local_ops", title: "Local Signal Operations", body: "Early expeditions and range upgrades push you toward the first system discovery threshold." },
  { id: "systems_light", title: "System Discovery", body: "Systems are persistent entities with traits and distance. Survey chains unlock colonisable worlds." },
  { id: "colonies_anchor", title: "First Colony Anchors", body: "Colonies add hub modifiers and consume command capacity, forcing trade-offs." },
  { id: "integration_projects", title: "Integration Projects", body: "Multi-day projects stabilize systems and change global rules like travel penalties and event rates." },
  { id: "galaxy_ops", title: "Galaxy Operations", body: "Galaxies reshape the rules. Chart new ones once integrations are stable to unlock new modifiers." },
  { id: "doctrine_ops", title: "Doctrine Shifts", body: "Prestige unlocks doctrines. Each doctrine changes core efficiencies and constraints." },
  { id: "prestige_recalibration", title: "Signal Recalibration", body: "Prestige resets the frontier for legacy perks and faster early cycles." },
];

export const WIKI_ENTRIES = [
  { id: "signal_meter", title: "Signal Meter", body: "Signal is not spent. It rises from uplink infrastructure and unlocks stages, targets, and story milestones." },
  { id: "signal_cap", title: "Signal Cap & Saturation", body: "When signal rises above the cap, saturation reduces further signal gain. Raise caps via upgrades, integrations, and tech." },
  { id: "power_gate", title: "Power Gating", body: "If projected power is <= 0, power-dependent production stalls. Build reactors before scaling heavy industry." },
  { id: "depletion", title: "Target Depletion", body: "Running the same expedition target lowers yields. Rotate targets and extend range to recover efficiency." },
  { id: "command", title: "Command Capacity", body: "Colonies and expeditions consume command capacity. Over-capacity reduces cargo and slows travel." },
  { id: "maintenance", title: "Maintenance Caps", body: "Each base has a maintenance cap. Exceeding it lowers output until you build maintenance bays." },
  { id: "fragments", title: "Fragment Recovery", body: "Fragment shards can appear in expedition cargo. Higher tiers and side objectives improve odds." },
];

export const MISSION_MODES = [
  { id: "balanced", name: "Balanced", desc: "Standard risk and rewards.", hazard: 0, durationMs: 0, reward: {} },
  { id: "survey", name: "Survey", desc: "+60% research, slower travel, lower cargo", hazard: 0.04, durationMs: 8000, reward: { research: 1.6, all: 0.9 }, unlock: { missions: 2 } },
  { id: "salvage", name: "Salvage", desc: "+30% metal/organics cargo, small hazard bump", hazard: 0.06, durationMs: 0, reward: { metal: 1.3, organics: 1.3 }, unlock: { missions: 4 } },
  { id: "secure", name: "Secure", desc: "-35% hazard, longer flight, -10% cargo", hazard: -0.35, durationMs: 6000, reward: { all: 0.9 }, unlock: { missions: 6 } },
  { id: "relay", name: "Relay", desc: "+25% fuel & signal cargo, modest hazard", hazard: 0.08, durationMs: -2000, reward: { fuel: 1.25, signal: 1.25 }, unlock: { missions: 8, signal: 240 } },
];
export const SYSTEM_NAME_PARTS = {
  prefix: ["Astra", "Helix", "Orion", "Vanta", "Nyx", "Vega", "Argo", "Lumen", "Cinder", "Atlas"],
  suffix: ["Reach", "Drift", "Nexus", "Vale", "Crown", "Ridge", "Spur", "Gate", "Span", "Haven"],
};
export const SYSTEM_TRAITS = [
  { id: "rich_metal", name: "Rich Metal", desc: "Dense ore belts and higher extraction yields." },
  { id: "high_resonance", name: "High Resonance", desc: "Scan returns trend higher, but surveys are slower." },
  { id: "quiet_orbit", name: "Quiet Orbit", desc: "Lower event frequency; stability holds longer." },
  { id: "debris_field", name: "Debris Field", desc: "Salvage opportunities increase expedition cargo." },
  { id: "ion_storms", name: "Ion Storms", desc: "Hazards spike on aggressive runs." },
  { id: "ancient_relay", name: "Ancient Relay", desc: "Legacy infrastructure boosts travel efficiency." },
];
export const SYSTEM_SURVEY_STEPS = {
  scan: { id: "scan", name: "Deep Scan", cost: { metal: 80, fuel: 12 }, duration: 20000 },
  probe: { id: "probe", name: "Probe Drop", cost: { metal: 60, fuel: 18 }, duration: 30000 },
  survey: { id: "survey", name: "Full Survey", cost: { research: 30, fuel: 30 }, duration: 42000 },
};
export const SURVEY_SEQUENCE = ["scan", "probe", "survey", "colonize", "colonized"];
export const COLONY_ROLES = [
  { id: "relay", name: "Relay Anchor", desc: "Extends hub range and trims travel times." },
  { id: "survey", name: "Survey Anchor", desc: "Improves scan yield and survey throughput." },
  { id: "logistics", name: "Logistics Anchor", desc: "Improves expedition throughput and travel efficiency." },
];
export const COLONY_COST = { metal: 180, fuel: 60, food: 20, organics: 12 };
export const CREW_PROGRAMS = [
  { id: "mission_corps", name: "Expedition Corps", desc: "Standardized expedition playbooks: higher cargo, more objectives, lower hazard.", unlock: { milestone: "M1_LOCAL_OPS" }, cost: { research: 20, metal: 60, food: 10 } },
  { id: "base_command", name: "Base Command", desc: "Outpost command training reduces event frequency and steadies recovery.", unlock: { milestone: "M2_FIRST_COLONY" }, cost: { research: 30, metal: 80, organics: 20 } },
  { id: "science_guild", name: "Science Guild", desc: "Research mentorship improves scans and expedition research yields.", unlock: { tech: "deep_scan" }, cost: { research: 35, organics: 24 } },
  { id: "logistics_wing", name: "Logistics Wing", desc: "Improves travel efficiency and lowers fuel overhead.", unlock: { milestone: "M2_SYSTEMS_DISCOVERED" }, cost: { metal: 90, fuel: 30, food: 12 } },
  { id: "morale_office", name: "Morale Office", desc: "Crew counseling boosts morale stability across hubs and outposts.", unlock: { milestone: "M3_INTEGRATION_UNLOCK" }, cost: { food: 30, organics: 30, research: 20 } },
];
export const CREW_CONTRACTS = [
  {
    id: "salvage_ace",
    name: "Salvage Ace",
    role: "miner",
    trait: "+20% to miner output",
    perk: "Improves metal/rare salvage from expeditions.",
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
    trait: "+16% engineer output, expedition hazard eased",
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
  { id: "interference_spike", name: "Interference Spike", desc: "Travel time rises; hazards intensify.", effect: { travelMult: 1.12, hazardMult: 1.08 }, cost: { metal: 20, fuel: 10 } },
  { id: "anomaly_bloom", name: "Anomaly Bloom", desc: "Strange pulses unsettle crews but enrich data.", effect: { cargoMult: 1.05, stabilityDrain: 0.02 }, cost: { research: 20, fuel: 12 } },
];
export const INTEGRATION_PROJECTS = [
  { id: "stabilize_system", name: "Stabilize System", desc: "Reduce event rates and restore stability.", duration: 180000, cost: { metal: 160, fuel: 40, research: 40 }, effect: { eventRateMult: 0.85, stability: 15 } },
  { id: "build_gate", name: "Build Gate", desc: "Reduces travel penalties across the frontier.", duration: 240000, cost: { metal: 220, fuel: 80, rare: 4 }, effect: { travelMult: 0.9 } },
  { id: "harmonize_signal", name: "Harmonize Signal", desc: "Reduces signal saturation penalties.", duration: 300000, cost: { metal: 220, research: 100, rare: 6 }, effect: { saturationRelief: 0.15, signalCapBonus: 200 } },
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

export const FACTION_OVERRIDES = {
  vanguard: {
    name: "Archive Keepers",
    tagline: "Preserve. Catalog. Control.",
    brief: "A scholastic order that archives fragments to decipher the entity and contain its return.",
  },
  aegis: {
    name: "Shepherds of Silence",
    tagline: "Contain. Isolate. Endure.",
    brief: "A quarantine coalition that suppresses fragment influence at any cost.",
  },
  relay: {
    name: "Broker's Consortium",
    tagline: "Profit from the apocalypse.",
    brief: "A trading bloc that treats fragments as assets and sells to every side.",
  },
  communion: {
    name: "Communion of Fragments",
    tagline: "Listen. Accept. Become.",
    brief: "A resonance cult that embraces integration and accelerates reassembly.",
  },
};

export const FACTION_BUILDINGS = {
  vanguard: [
    {
      id: "signal_spire",
      name: "Archive Spire",
      desc: "Amplifies fragment catalog fidelity across the network.",
      baseGoal: { metal: 65000, research: 28000, fuel: 8000 },
      tierScale: 1.9,
      maxTier: 4,
      unlocks: {
        1: ["Event: Resonance Surge", "Buff: +5% scan yield"],
        2: ["Directive: Deep Listening", "Buff: +8% scan yield"],
        3: ["Event: Deep Pulse", "Buff: +1 range tier"],
        4: ["Network: Long-Range Cartography"],
      },
    },
    {
      id: "deep_listen_array",
      name: "Deep Listen Array",
      desc: "Focuses long-range fragment sweeps into stable corridors.",
      baseGoal: { metal: 90000, fuel: 32000, research: 36000 },
      tierScale: 1.9,
      maxTier: 4,
      unlocks: {
        1: ["Event: Signal Wake", "Buff: +6% scan yield"],
        2: ["Directive: Outer Reach", "Buff: +1 range tier (directive)"],
        3: ["Event: Deep Pulse", "Buff: +1 range tier"],
        4: ["Network: Corridor Stabilizers"],
      },
    },
    {
      id: "catalog_node",
      name: "Catalog Node",
      desc: "Indexes fragment finds for faster expedition planning.",
      baseGoal: { metal: 80000, organics: 25000, research: 30000 },
      tierScale: 1.85,
      maxTier: 4,
      unlocks: {
        1: ["Event: Signal Cache", "Buff: +6% expedition cargo"],
        2: ["Directive: Relay Archive", "Buff: +8% expedition cargo"],
        3: ["Event: Archive Surge", "Buff: -8% travel time"],
        4: ["Network: Mission Ledger"],
      },
    },
  ],
  relay: [
    {
      id: "cargo_spine",
      name: "Trade Spine",
      desc: "Standardizes brokered logistics to reduce transit losses.",
      baseGoal: { metal: 85000, fuel: 35000, organics: 12000 },
      tierScale: 1.9,
      maxTier: 4,
      unlocks: {
        1: ["Event: Convoy Surge", "Buff: -6% travel time"],
        2: ["Directive: Fleetline", "Buff: -8% travel time"],
        3: ["Event: Fleet Overwatch", "Buff: +10% cargo"],
        4: ["Network: Convoy Scheduler"],
      },
    },
    {
      id: "dock_web",
      name: "Broker Dock Web",
      desc: "Distributed docking reduces turnaround delays for fragment convoys.",
      baseGoal: { metal: 110000, fuel: 45000, organics: 20000 },
      tierScale: 1.9,
      maxTier: 4,
      unlocks: {
        1: ["Event: Dock Surge", "Buff: +6% cargo"],
        2: ["Directive: Convoy Protocol", "Buff: +8% cargo"],
        3: ["Event: Fleet Overwatch", "Buff: +12% cargo"],
        4: ["Network: Dock Authority"],
      },
    },
    {
      id: "supply_foundry",
      name: "Salvage Exchange",
      desc: "Turns salvage into usable parts for operations and trade.",
      baseGoal: { metal: 120000, fuel: 25000, research: 20000 },
      tierScale: 1.85,
      maxTier: 4,
      unlocks: {
        1: ["Event: Salvage Windfall", "Buff: -8% fuel overhead"],
        2: ["Directive: Fleetline", "Buff: +6% cargo"],
        3: ["Event: Supply Pulse", "Buff: -10% fuel overhead"],
        4: ["Network: Salvage Exchange"],
      },
    },
  ],
  aegis: [
    {
      id: "stability_core",
      name: "Containment Core",
      desc: "Reinforces suppression shields and quarantine protocols.",
      baseGoal: { metal: 70000, organics: 35000, research: 25000 },
      tierScale: 1.9,
      maxTier: 4,
      unlocks: {
        1: ["Event: Shield Harmonization", "Buff: -8% hazard"],
        2: ["Directive: Shield Watch", "Buff: -10% hazard"],
        3: ["Event: Ward Pulse", "Buff: -12% hazard"],
        4: ["Network: Hazard Command"],
      },
    },
    {
      id: "morale_arc",
      name: "Quietus Arc",
      desc: "Improves crew recovery under quarantine strain.",
      baseGoal: { metal: 90000, organics: 40000, research: 20000 },
      tierScale: 1.85,
      maxTier: 4,
      unlocks: {
        1: ["Event: Crew Uplift", "Buff: +6% morale stability"],
        2: ["Directive: Care Cadence", "Buff: +8% morale stability"],
        3: ["Event: Cohesion Wave", "Buff: +10% morale stability"],
        4: ["Network: Crew Wellness Grid"],
      },
    },
    {
      id: "containment_grid",
      name: "Silence Grid",
      desc: "Suppresses fragment interference and reduces event spikes.",
      baseGoal: { metal: 110000, fuel: 50000, research: 30000 },
      tierScale: 1.9,
      maxTier: 4,
      unlocks: {
        1: ["Event: Calm Window", "Buff: -10% event rate"],
        2: ["Directive: Stability Clamp", "Buff: -12% event rate"],
        3: ["Event: Quiet Orbit", "Buff: -14% event rate"],
        4: ["Network: System Stabilizers"],
      },
    },
  ],
  communion: [
    {
      id: "resonance_choir",
      name: "Resonance Choir",
      desc: "Amplifies fragment resonance across the network.",
      baseGoal: { metal: 80000, research: 32000, fuel: 12000 },
      tierScale: 1.9,
      maxTier: 4,
      unlocks: {
        1: ["Event: Chorus Pulse", "Buff: +8% scan yield"],
        2: ["Directive: Communion Rite", "Buff: +6% cargo"],
        3: ["Event: Veil Harmony", "Buff: +10% research yield"],
        4: ["Network: Resonance Choir"],
      },
    },
    {
      id: "unity_crucible",
      name: "Unity Crucible",
      desc: "Integrates fragment shards into adaptive technology.",
      baseGoal: { metal: 100000, organics: 30000, research: 36000 },
      tierScale: 1.85,
      maxTier: 4,
      unlocks: {
        1: ["Event: Insight Bloom", "Buff: +6% research"],
        2: ["Directive: Merge Protocol", "Buff: +8% scan yield"],
        3: ["Event: Echo Surge", "Buff: +1 range tier"],
        4: ["Network: Veil Synthesis"],
      },
    },
    {
      id: "veil_conduit",
      name: "Veil Conduit",
      desc: "Turns resonance into drive stability and travel efficiency.",
      baseGoal: { metal: 120000, fuel: 50000, rare: 20 },
      tierScale: 1.9,
      maxTier: 4,
      unlocks: {
        1: ["Event: Drift Lull", "Buff: -6% travel time"],
        2: ["Directive: Harmonic Drift", "Buff: -8% travel time"],
        3: ["Event: Veil Convergence", "Buff: +10% cargo"],
        4: ["Network: Convergence Loom"],
      },
    },
  ],
};

export const FACTION_DIRECTIVES = {
  vanguard: [
    { id: "directive_scan", name: "Archive Listening", desc: "Prioritize fragment scan throughput and research yields.", requires: { building: "signal_spire", tier: 2 }, effect: "Scan yields +4% while active." },
    { id: "directive_range", name: "Outer Reach", desc: "Extend range to unlock higher-tier targets sooner.", requires: { building: "deep_listen_array", tier: 2 }, effect: "Range tier +1 while active." },
  ],
  relay: [
    { id: "directive_logistics", name: "Broker Line", desc: "Reduce travel time and improve cargo throughput.", requires: { building: "cargo_spine", tier: 2 }, effect: "Travel time -4% while active." },
    { id: "directive_convoy", name: "Convoy Protocol", desc: "Stabilize cargo flows during hazardous runs.", requires: { building: "dock_web", tier: 2 }, effect: "Cargo +5% while active." },
  ],
  aegis: [
    { id: "directive_shield", name: "Silence Watch", desc: "Reduce hazard spikes during expeditions.", requires: { building: "stability_core", tier: 2 }, effect: "Hazard -5% while active." },
    { id: "directive_morale", name: "Care Cadence", desc: "Boost morale stability and recovery.", requires: { building: "morale_arc", tier: 2 }, effect: "Morale stability +4% while active." },
  ],
  communion: [
    { id: "directive_unity", name: "Communion Rite", desc: "Amplify fragment resonance and scan yield.", requires: { building: "resonance_choir", tier: 2 }, effect: "Scan yields +5% while active." },
    { id: "directive_merge", name: "Merge Protocol", desc: "Increase research throughput while stabilizing exposure.", requires: { building: "unity_crucible", tier: 2 }, effect: "Research yield +6% while active." },
  ],
};
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
