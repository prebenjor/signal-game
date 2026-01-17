# Stellar Command Framework (Manifesto)

This document is the core framework for future work. Always consult this first when adding features, balancing, or integrating new systems. Changes should reinforce the resource hierarchy, tier gating, and long-term progression defined here.

## 1. Resource Hierarchy and Dependencies
Tier 0: Foundation Resources (Always Positive)
- Power: Base generation, never consumed below maintenance level
- Signal: Communication range, enables distant operations
- Crew Morale: Affects efficiency multipliers (50%-150%)

Tier 1: Primary Resources (Can go negative with consequences)
- Metal: Construction, upgrades
- Organics: Life support, advanced materials
- Food: Crew maintenance

Tier 2: Processed Resources (Conversion-based)
- Fuel: Refined from Metal + Organics + Power
- Research: Generated from excess resources + Signal
- Rare Materials: Extracted from specific planet types

Tier 3: Strategic Resources (Long-term)
- Prestige: Meta-currency from completing nexus tiers
- Intel: Unlocks new systems and building blueprints

## 2. Hub Building Hierarchy
Command Nexus (Central Building)
- Purpose: Unlocks tier gates, provides global bonuses
- Tier Gates:
  - Tier 1 (Nexus Lv 1-10): Local operations, basic buildings
  - Tier 2 (Nexus Lv 11-30): System expansion, fuel economy
  - Tier 3 (Nexus Lv 31-60): Multi-system operations, automation
  - Tier 4 (Nexus Lv 61-100): Advanced logistics, prestige loops

Cost Scaling: Base x (1.15^level) with tier multipliers

Production Buildings (Per-Tick Generation)
- Metal Extractor
  - Base Output: 50 metal/tick
  - Cost Formula: 100M x 1.12^level
  - Unlock: Tier 1 (Nexus Lv 1)
  - Caps: Soft cap at level 50 (diminishing returns)

- Organic Cultivator
  - Base Output: 30 organics/tick
  - Cost Formula: 80M, 20O x 1.12^level
  - Unlock: Tier 1 (Nexus Lv 3)
  - Special: Requires 5 Food/tick per level (creates feedback loop)

- Food Synthesizer
  - Base Output: 40 food/tick
  - Cost Formula: 60M, 40O x 1.11^level
  - Unlock: Tier 1 (Nexus Lv 1)
  - Special: Has emergency reserves (prevents crew death)

- Power Generator
  - Base Output: 200 power/tick
  - Cost Formula: 150M, 10O x 1.13^level
  - Unlock: Tier 1 (Nexus Lv 1)
  - Special: Cannot go below maintenance level (automatic throttling)

Conversion Buildings (Transform Resources)
- Fuel Refinery (Your current pain point)
  - Redesigned Formula:
    - Base Output: +1 fuel/tick per level
    - Cost:
      - Levels 1-20: 800M, 200O x 1.10^level
      - Levels 21-50: 500M, 150O, 50F x 1.08^level (uses own output)
      - Levels 51+: Prestige-gated, researched alternatives
  - Consumption: 5 Power, 2 Metal, 1 Organic per fuel generated
  - Unlock: Tier 1 (Nexus Lv 5)
  - Why this works:
    - Early game: Expensive but achievable
    - Mid game: Self-sustaining through fuel consumption
    - Late game: Alternative fuel sources unlock (Hydrogen Cracker, Solar Sails)

- Research Lab
  - Output: Converts excess resources into research
  - Formula: 1 Research = 100M + 50O + 10F (any combination)
  - Cost: 5K M, 2K O x 1.15^level
  - Unlock: Tier 2 (Nexus Lv 15)

- Rare Material Processor
  - Output: Processes planetary exports into rare materials
  - Cost: 10K M, 5K O, 2K Research x 1.12^level
  - Unlock: Tier 3 (Nexus Lv 35)

Logistics Buildings (Quality of Life)
- Catalyst Cracker (Keep this)
  - Purpose: Short-term fuel boosts at resource cost
  - Redesign: Add a cooldown, make it a "burst" option
  - New Cost: 320M, 40F, 60O per use (not per level)
  - Cooldown: 30 seconds, reduced by upgrades

- Logistics Hub (Keep this)
  - Purpose: Reduce travel time = faster outpost production delivery
  - Special: Each level applies to ALL outposts
  - Cost: 520M, 160F, 80O x 1.14^level

- Auto-Balancer (NEW)
  - Purpose: Prevents negative resource states
  - Mechanics:
    - Monitors all resources every tick
    - If resource < 0 predicted in 30 seconds:
      - Throttles least efficient producers
      - Boosts relevant converters
      - Sends player notification
  - Cost: 2K M, 1K O, 500 Research
  - Unlock: Tier 2 (Nexus Lv 20)
  - Upgrades: Faster response time, better predictions

- Priority Manager (NEW)
  - Purpose: Player sets resource priorities
  - UI: Slider system (Focus: Fuel 40% | Metal 30% | Organics 20% | Food 10%)
  - Effect: Buildings adjust output/input ratios within +/-25% based on priority
  - Cost: 5K M, 2K O, 1K Research
  - Unlock: Tier 2 (Nexus Lv 25)

## 3. Outpost System
Outpost Types (Planet-Based)
- Mining Outpost (Metal-Rich Planets)
  - Output: 500-2K metal/tick (based on planet quality)
  - Cost: 10K M, 5K O, 200F (to build and transport)
  - Upkeep: 50 Food/tick, 20 Fuel/tick (supply runs)

- Agricultural Outpost (Organic-Rich Planets)
  - Output: 300-1.5K organics/tick + 200-800 food/tick
  - Cost: 8K M, 15K O, 200F
  - Upkeep: 30 Food/tick, 15 Fuel/tick

- Research Station (Rare/Exotic Planets)
  - Output: 50-200 research/tick + rare materials
  - Cost: 20K M, 10K O, 5K Research, 500F
  - Upkeep: 100 Food/tick, 50 Fuel/tick, 10 Rare/tick

- Fuel Depot (Gas Giants)
  - Output: 100-500 fuel/tick (alternative fuel source)
  - Cost: 50K M, 5K O, 10K Research, 1K F (bootstrap problem solved at Tier 3)
  - Upkeep: 200 Power (delivered via Signal network), 50 Rare/tick
  - Unlock: Tier 3 (Nexus Lv 40)

Outpost Upgrade System
Each outpost has 5 upgrade levels:
- Efficiency: +20% output, -10% upkeep
- Automation: Reduces signal requirement, runs during offline
- Expansion: +50% output, +30% upkeep
- Specialization: Unlocks secondary resource generation
- Hub Connection: Outpost becomes mini-hub, can support other outposts

## 4. Consequence and Safety Systems
Negative Resource States
- Metal < 0
  - Effect: Construction halts, upgrades paused
  - Recovery: Auto-throttle Fuel Refinery first, then Research Lab
  - No permanent loss

- Organics < 0
  - Effect: Organic Cultivators stop, crew morale -1%/second
  - Recovery: EmergencyFood -> Organics conversion (50:1 ratio)
  - Warning at: 30 seconds until zero

- Food < 0
  - Effect: Crew morale -5%/second, outpost production -50%
  - Emergency Reserve: 100 Food per Synthesizer level (prevents death)
  - Recovery: Auto-converts Organics -> Food (3:1 ratio)
  - Never kills crew, just severely hampers production

- Fuel < 0
  - Effect: Outpost production stops, logistics halted
  - Recovery: Catalyst Cracker becomes available with no cooldown
  - Warning at: 60 seconds until zero

- Power < 0 (CANNOT HAPPEN)
  - System: Power automatically throttles to maintenance level
  - Maintenance Pool: Always keeps 10% of max power reserved

Auto-Balance Strategies (AI-Driven)
When enabled, system chooses from:
- Conservative: Maintains 20% buffer on all resources
  - Throttles production 10% under buffer
  - Boosts production 20% over buffer

- Focused (Player chooses resource):
  - Maximizes chosen resource production
  - Maintains minimum viable levels on others

- Growth: Prioritizes buildings that unlock next tier
  - Calculates optimal upgrade paths
  - Suggests next building to player

- Balanced: Maintains ratios based on consumption patterns
  - Uses 10-minute rolling average
  - Adapts to player's building choices

## 5. Progression Curve
Early Game (Nexus 1-10): Learning Phase
- Focus: Build one of each production building
- Challenge: Understand resource loops
- Goal: Reach positive Fuel production
- Time: 30-60 minutes

Mid Game (Nexus 11-30): Expansion Phase
- Focus: First outposts, multiple systems
- Challenge: Balance hub vs outpost investment
- Goal: Build 5 outposts, unlock auto-balancer
- Time: 3-8 hours

Late Game (Nexus 31-60): Optimization Phase
- Focus: Prestige preparation, rare materials
- Challenge: Maximize efficiency, unlock all building types
- Goal: All Tier 3 buildings to level 10+
- Time: 15-30 hours

Prestige (Nexus 61+): Meta-Progression
- Focus: Permanent bonuses, new building types
- Challenge: Choose prestige specializations
- Goal: Multiple prestige loops
- Time: Ongoing

## 6. Building Cost Scaling Framework
Formula Template
Base Cost x (Growth Rate ^ Level) x Tier Multiplier x Resource Type Modifier

Growth Rates by Building Purpose
- Basic Production: 1.10-1.12 (slow, always relevant)
- Conversion/Processing: 1.12-1.15 (moderate, tier-gated relief)
- Logistics/QoL: 1.14-1.18 (expensive, high impact)
- Strategic/Research: 1.15-1.20 (very expensive, unlock-based)

Tier Multipliers (Applied at tier gates)
- Tier 1 -> Tier 2: x5 cost, but new resource types available
- Tier 2 -> Tier 3: x10 cost, prestige mechanics introduced
- Tier 3 -> Tier 4: x25 cost, "endgame" content

Resource Type Modifiers (Multi-Resource Costs)
- Primary Resource: 1.0x (Metal, Organics)
- Processed Resource: 0.3x (Fuel, Research) - cheaper per unit value
- Strategic Resource: 0.1x (Rare, Prestige) - very cheap per unit, but scarce

## 7. Specific Rebalancing for Fuel Refinery
Current State Analysis
- Level 43: 162.6K metal, 29.6K organics
- Growth: Appears to be ~1.15^level
- Problem: No alternative fuel sources, feels mandatory but punishing

Proposed Fix
Option A: Reduce Scaling + Add Alternatives
- New Formula: 800M, 200O x 1.10^level (much gentler)
- Level 43 New Cost: ~34K metal, 8.5K organics (1/5 current cost)
- Tradeoff: Add Fuel Depot outposts (Tier 3) as alternative

Option B: Tier-Gated Refinery Types
- Basic Refinery (Tier 1, Lv 1-25): Current costs, +1 fuel/tick per level
- Advanced Refinery (Tier 2, Lv 1-25): 2K M, 500O x 1.12^level, +3 fuel/tick per level
- Fusion Refinery (Tier 3, Lv 1-25): 10K M, 2K O, 500R x 1.10^level, +10 fuel/tick per level

Option C: Dual-Path System (RECOMMENDED)
- Keep Fuel Refinery as-is, but add:
  - Hydrogen Cracker (Tier 2, Nexus 25): Converts Water (new resource from ice planets) -> Fuel at 2:1 ratio, cheaper upgrades
  - Solar Sail Array (Tier 3, Nexus 40): Generates fuel from Power at 100:1 ratio, no organics needed, scales with power production

Why this works best:
- Respects existing player progress
- Creates meaningful choice (efficient vs cheap vs alternative)
- Late-game players escape the bottleneck
- Early/mid players still have progression path

## 8. UI/UX Recommendations
Resource Dashboard
[Power: 5.44M] <-> [+254/tick]
[Metal: 252.0K] <-> [+84/tick]
[Organics: 820.1K] <-> [+59/tick]
[Food: 168.3K] <-> [+8/tick]
[Fuel: 0] <-> [-65/tick] WARN

Time until zero: 0s (CRITICAL)
Auto-Balance: [ON] - Throttling: Organic Cultivator (-20%)

Building Card Enhancement
Fuel Refinery Lv 43 [Tier 1]
Output: +43 fuel/tick
Consumes: 86 metal, 43 organic/tick
Next Level: +1 fuel/tick
Cost: 162.6K metal, 29.6K organics
Buttons: [Upgrade] [Info] [Throttle: 100%]
Hint: Consider Hydrogen Cracker (Unlocks Nexus Lv 25)

Priority Manager UI
Resource Priority (Total: 100%)
Metal: 30%
Organics: 20%
Food: 10%
Fuel: 40%
[Apply] [Reset to Balanced]

## 9. Prestige System
Prestige Points Formula
Points = (Nexus Level - 60) x Average Outpost Level x Unique Planets Discovered / 10

Prestige Upgrades (Permanent)
- Production Boost: +5% to chosen resource per point
- Cost Reduction: -3% building costs per point
- Starting Resources: Begin new run with 10% of prestiged resources
- Unlock Persistence: Keep Tier 2 building unlocks
- Auto-Features: Start with Auto-Balancer, Priority Manager unlocked

Prestige Tiers
- Tier 1 Prestige (Nexus 60): Basic bonuses, 1-5 points
- Tier 2 Prestige (Nexus 80): Advanced bonuses, 5-15 points
- Tier 3 Prestige (Nexus 100): Meta bonuses, 15-50 points

## 10. Future Expansion Hooks
New Building Types (Post-Launch)
- Quantum Forge: Converts Rare -> any basic resource at high efficiency
- Habitat Dome: Increases crew capacity, unlocks new crew abilities
- Signal Amplifier: Extends range, reduces outpost upkeep
- Defense Platform: Protects outposts from random events/enemy raids

New Mechanics
- Fleet Management: Ships that explore, fight, trade
- Crew Skills: Specialists that boost specific buildings
- Planet Events: Random modifiers (storms, discoveries, threats)
- Multiplayer Hubs: Shared space stations, trading between players

Summary: Solving Current Fuel Crisis
Immediate Action for Fuel:
- Reduce Fuel Refinery cost scaling from 1.15 to 1.10
- Add Catalyst Cracker as emergency fuel option with cooldown
- Introduce Hydrogen Cracker (Tier 2) as cheaper alternative path
- Add Fuel Depot outposts on gas giants (Tier 3)

Long-Term Framework:
- Buildings scale at 1.10-1.12 for production, 1.14-1.18 for logistics
- Every expensive building has a cheaper alternative unlocked 1-2 tiers later
- Auto-Balance prevents catastrophic failure but encourages optimization
- Prestige system rewards deep progression without making early game tedious

## 11. Nexus Tiering + Faction Integration
Faction-Linked Prestige
- Shepherds of Silence:
  - Prestige Bonus: -8% hazard exposure
  - Unlock: Containment Protocols (buildings operate at 110% efficiency in hazardous zones)
  - Starting Bonus: +15% research generation

- Broker's Consortium:
  - Prestige Bonus: +10% cargo capacity across all outposts
  - Unlock: Trade Routes (passive resource exchange between player outposts)
  - Starting Bonus: +20% metal/organics from missions

- Archive Keepers:
  - Prestige Bonus: Research persists through prestige (keep 25% of spent research)
  - Unlock: Blueprint Library (reduced construction costs -15%)
  - Starting Bonus: All Tier 1 research pre-unlocked

Smooth Multi-Week Progression
- Week 1 (Nexus 1-30): Unlock basic buildings, establish 3-5 outposts, complete first faction milestone.
- Week 2 (Nexus 31-50): Alternative fuel paths unlock, shared faction projects open, Tier 2 biomes appear.
- Week 3+ (Nexus 51-60): Prestige preview + ascension countdown, final faction milestone gates prestige choice.

The Faction Twist (Fragments as prestige currency)
- Prestige threshold (Nexus 60) requires 1,000 fragments collected via faction contributions.
- Players choose: keep grinding or contribute to faction goals for prestige timing.
- Fragment thresholds (ex: First Whisper at 25%) act as global checkpoints.

## 12. Tech Tab Integration Strategy
Principle
- Hub = direct production and conversion
- Tech = unlocks capabilities, content gates, and multipliers

Tier 1 Tech (Core Track)
- Fuel Synthesis -> unlocks Fuel Refinery building
- Habitat Protocols -> unlocks Habitat buildings
- Resource Scanning -> reveals resource deposits
- Basic Automation -> enables offline production at 50%

Tier 2 Tech (Safety/Logistics Track)
- Hazard Gear -> -25% mission hazard
- Logistics Drones -> +20% cargo
- Emergency Protocols -> prevents resource negatives (auto-balance tie-in)
- Signal Amplification -> +1 range tier

Tier 3 Tech (Scan/Expansion Track)
- Deep Scan Arrays -> +1 research/tick, +1 range tier, reveals deep targets
- Quantum Mapping -> reveals rare planet types
- Wormhole Navigation -> unlocks Tier 4 distant systems

UI Integration (Hub <-> Tech cross-reference)
- Hub building cards show research requirements with a "View in Tech" link.
- Tech nodes show "Unlocks:" list for Hub buildings/features.
- Locked hub building cards show required tech with quick jump.

Tracks (reorganize tech tree)
- Core (Foundation): Fuel Synthesis -> Advanced Refining -> Fusion Cores; Habitat Protocols -> Life Support -> Cryo Storage
- Safety (Risk Mitigation): Hazard Gear -> Environmental Suits -> Containment Fields; Emergency Protocols -> Auto-Stabilizers -> Crisis Mgmt
- Logistics (Efficiency): Logistics Drones -> Cargo Automation -> Quantum Shipping; Signal Relays -> Deep Scan -> Quantum Mapping
- Expansion (Content Gates): Planetary Survey -> Biome Adaptation -> Exotic Habitats; Outposts -> Advanced Colonies -> Megastructures

Rename
- Prefer "Research Command" for the Tech tab.

## 13. Mission and Base Integration (Expedition Command)
Problem
- Missions and bases feel separate; they should be a unified exploration -> colonization flow.

Solution: Merge into "Expedition Command"
Single unified tab structure:
- System Map (visual galaxy view)
- Active Expeditions (missions in progress)
- Established Outposts (your bases)
- Expedition Planning (launch new missions)

Player Flow
Phase 1: Discovery (Early Game)
- System map shows partially revealed sectors.
- Player selects unexplored system -> launches Survey Mission.
- Survey costs: Metal + Fuel + Signal range.
- Mission completes -> system reveals planet types, resource richness, hazards.
- Result: System marked "Surveyed" and becomes colonizable.

Phase 2: Colonization (Mid Game)
- Player selects surveyed system -> views planet list.
- "Establish Outpost" triggers a one-time construction expedition.
- Cost: Metal + Organics + Fuel + Crew specialist.
- Mission completes -> base becomes permanent and appears in Established Outposts.
- Result: Base generates passive resources (existing production structures).

Phase 3: Operations (Ongoing)
Established Outposts tab shows all bases (current Site Overview):
- Fabrication Bay: build production structures (Ore Rig, Fuel Cracker, Solar Sail).
- Incident Queue: events require crew/resources to resolve.
- Field Ops: active abilities with cooldowns.
- Focus Protocols: adjust resource priorities.
- Supply Runs: auto-missions that cost fuel to maintain base upkeep.

Tier-Gated Exploration (Range Tiers)
- Tier 1 (Nexus 1-15): Local asteroid belt only (Debris Field).
  - Unlock: Debris Field base (28 metal, 1 fuel, 1 research/tick).
- Tier 2 (Nexus 16-30): Inner system (Ice Moon, Rocky Planet).
  - Research: Deep Scan Arrays.
  - Unlock: Ice Moon base (16 organics, 14 fuel, 8 food/tick).
  - Unlock: Rocky Planet base (balanced resources).
- Tier 3 (Nexus 31-50): Outer system (Lava Rock, Gas Giant).
  - Research: Quantum Mapping.
  - Unlock: Lava Rock base (20 metal, 18 organics, 6 research, 4 rare/tick).
  - Unlock: Gas Giant base (Fuel Depot - alternative fuel source).
- Tier 4 (Nexus 51-60): Distant systems via Relay Anchors.
  - Research: Wormhole Navigation.
  - Unlock: Exotic planets (unique resources, prestige materials).
  - Signal network: build Relay Anchors to maintain connection.

System Discovery Mechanics
- Hidden until explored: map shows "signal echoes" at range boundaries.
- Survey requirement: Signal range + research investment.
- Survey results vary:
  - High value: multiple planets, rare resources, low hazards.
  - Low value: single planet, common resources, high hazards.
  - Mystery: anomalies that unlock special research or prestige bonuses.

System Traits (Random)
- Metal-Rich Belt: +50% metal output from bases.
- Geothermal Activity: +30% power, +10% hazard.
- Abandoned Relay: -50% signal upkeep, unlocks bonus research.
- Contested Space: random raid events (late-game threat).

Expedition Launch Revamp
Step 1: Select Destination
- System Map -> click unexplored system -> "Survey Expedition" appears in planning.
Step 2: Configure Expedition
- Distance, travel time, stance (Cautious/Balanced/Aggressive).
- Assign specialist (ties to crew system).
- Fuel boost slider (reduces travel time).
- Cost shown before launch.
Step 3: Track Progress
- Active Expeditions list with progress and slot count.
Step 4: Results
- Survey complete -> discovered planets + traits -> optional outpost establish.

Integration with Existing Systems
Missions -> Expeditions
- "Debris Field" mission becomes "Debris Field Outpost" (permanent base).
- "Target Locks" becomes "Expedition Queue".
- "Launch Bay" becomes "Expedition Planning".
- Operational stance carries over as-is.

Bases -> Outpost Network
- Fabrication Bay remains.
- Incident Queue remains.
- Field Ops remains.
- Site Overview becomes "Outpost Dashboard".

Signal + Range -> Discovery Gates
- Range tier determines system visibility.
- Signal determines survey cost.
- Deep Scan Arrays unlock Range Tier 2.
- Relay Anchors extend signal to distant systems.

Prestige Integration (Fragments)
- Surveying new systems grants fragments.
- Establishing outposts grants fragments.
- Faction projects require specific discoveries.
Example: "Survey 3 high-hazard systems (0/3)" -> 200 fragments + hazard reduction research.

System Persistence Across Prestige
- Surveyed systems remain discovered after prestige.
- Outpost locations persist but must be re-established (costs reduced).
- Traits randomize on prestige for replayability.
- New exotic systems unlock at higher prestige tiers.

TL;DR Summary
- Merge Missions + Bases into "Expedition Command".
- Survey missions reveal systems and traits.
- Outpost establishment is a construction expedition.
- Outpost operations remain as current base management.
- Range tiers gate discovery; signal + research gate surveys.
- Traits create strategic choices; fragments tie to faction prestige.
