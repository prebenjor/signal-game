# Stellar Command Framework (Manifesto)

This document is the core framework for future work. Always consult this first when adding features, balancing, or integrating new systems. Changes should reinforce the resource hierarchy, tier gating, and long-term progression defined here.

## 1. Resource Hierarchy and Dependencies

### Tier 0: Foundation Resources (Always Positive)
- **Power**: Base generation, never consumed below maintenance level
- **Signal**: Communication range, enables distant operations
- **Crew Morale**: Affects efficiency multipliers (50%-150%)

### Tier 1: Primary Resources (Can go negative with consequences)
- **Metal**: Construction, upgrades
- **Organics**: Life support, advanced materials
- **Food**: Population sustenance, crew maintenance
- **Habitat**: Population capacity, unlocks base expansion zones

### Tier 2: Processed Resources (Conversion-based)
- **Fuel**: Refined from Metal + Organics + Power
- **Research**: Generated from excess resources + Signal
- **Rare Materials**: Extracted from specific planet types

### Tier 3: Strategic Resources (Long-term)
- **Fragments**: Meta-currency from faction contributions, gates prestige
- **Intel**: Unlocks new systems and building blueprints

---

## 2. Hub Building Hierarchy

### Command Nexus (Central Building)
**Purpose**: Unlocks tier gates, provides global bonuses

**Tier Gates**:
- **Tier 1** (Nexus Lv 1-10): Local operations, basic buildings
- **Tier 2** (Nexus Lv 11-30): System expansion, fuel economy
- **Tier 3** (Nexus Lv 31-60): Multi-system operations, automation
- **Tier 4** (Nexus Lv 61-100): Advanced logistics, prestige loops

**Cost Scaling**: Base × (1.15^level) with tier multipliers

---

### Production Buildings (Per-Tick Generation)

#### Metal Extractor
- **Base Output**: 50 metal/tick
- **Cost Formula**: 100M × 1.12^level
- **Unlock**: Tier 1 (Nexus Lv 1)
- **Caps**: Soft cap at level 50 (diminishing returns)

#### Organic Cultivator
- **Base Output**: 30 organics/tick
- **Cost Formula**: 80M, 20O × 1.12^level
- **Unlock**: Tier 1 (Nexus Lv 3)
- **Special**: Requires 5 Food/tick per level (creates feedback loop)

#### Food Synthesizer
- **Base Output**: 40 food/tick
- **Cost Formula**: 60M, 40O × 1.11^level
- **Unlock**: Tier 1 (Nexus Lv 1)
- **Special**: Has emergency reserves (prevents population collapse)

#### Power Generator
- **Base Output**: 200 power/tick
- **Cost Formula**: 150M, 10O × 1.13^level
- **Unlock**: Tier 1 (Nexus Lv 1)
- **Special**: Cannot go below maintenance level (automatic throttling)

#### Habitat Module
- **Base Output**: 50 habitat per level
- **Cost Formula**: 1K M, 500O × 1.13^level
- **Unlock**: Tier 1 (Nexus Lv 1)
- **Purpose**: Increases population cap and enables base zone unlocks

#### Hydroponics Bay
- **Base Output**: 20 food/tick, 10 habitat per level
- **Cost Formula**: 800M, 600O × 1.12^level
- **Unlock**: Tier 1 (Nexus Lv 8)
- **Synergy**: Dual resource for population growth and capacity

---

### Conversion Buildings (Transform Resources)

#### Fuel Refinery
- **Base Output**: +1 fuel/tick per level
- **Cost Scaling**:
  - Levels 1-20: 800M, 200O × 1.10^level
  - Levels 21-50: 500M, 150O, 50F × 1.08^level (self-sustaining)
  - Levels 51+: Prestige-gated alternatives unlock
- **Consumption**: 5 Power, 2 Metal, 1 Organic per fuel generated
- **Unlock**: Tier 1 (Nexus Lv 5)

#### Research Lab
- **Output**: Converts excess resources into research
- **Formula**: 1 Research = 100M + 50O + 10F (any combination)
- **Cost**: 5K M, 2K O × 1.15^level
- **Unlock**: Tier 2 (Nexus Lv 15)

#### Rare Material Processor
- **Output**: Processes planetary exports into rare materials
- **Cost**: 10K M, 5K O, 2K Research × 1.12^level
- **Unlock**: Tier 3 (Nexus Lv 35)

---

### Logistics Buildings (Quality of Life)

#### Catalyst Cracker
- **Purpose**: Emergency fuel boosts via resource burn
- **Cost**: 320M, 40F, 60O per use (not per level)
- **Cooldown**: 30 seconds (reduced by upgrades)
- **Special**: Cooldown removed when fuel < 0

#### Logistics Hub
- **Purpose**: Reduces travel time for all expeditions and supply runs
- **Effect**: Each level applies globally to all outposts
- **Cost**: 520M, 160F, 80O × 1.14^level

#### Auto-Balancer
- **Purpose**: Prevents negative resource states
- **Mechanics**:
  - Monitors all resources every tick
  - Predicts resource depletion 30 seconds ahead
  - Auto-throttles producers/converters to prevent negatives
  - Sends player notifications
- **Cost**: 2K M, 1K O, 500 Research
- **Unlock**: Tier 2 (Nexus Lv 20)
- **Upgrades**: Faster prediction, smarter throttling

#### Priority Manager
- **Purpose**: Player sets resource production priorities
- **UI**: Slider system (Example: Fuel 40% | Metal 30% | Organics 20% | Food 10%)
- **Effect**: Buildings adjust output/input ratios within ±25% based on priority
- **Cost**: 5K M, 2K O, 1K Research
- **Unlock**: Tier 2 (Nexus Lv 25)

#### Granary
- **Purpose**: Increases food reserve capacity
- **Base Storage**: 1,000 food
- **Per Level**: +500 food storage
- **Cost**: 500M, 200O × 1.11^level
- **Unlock**: Tier 1 (Nexus Lv 5)

#### Recruitment Bay
- **Purpose**: Converts population into specialists
- **Cost per Specialist**: 100 population + 50 research + 500 food
- **Training Time**: 5 minutes
- **Training Slots**: Increases with building level
- **Unlock**: Tier 2 (Nexus Lv 20)

---

## 3. Population System

### Core Mechanics
- **Habitat** = Maximum population capacity
- **Food** = Population sustenance and growth fuel
- **Population** = Active resource pool for crew assignment

### Population Growth
- **Base Rate**: +1 population per 30 seconds
- **Growth Modifiers**:
  - Food abundant (>2× consumption): +50% growth rate
  - Food stable (1-2× consumption): Normal growth
  - Food scarce (<1× consumption): -50% growth, morale penalty
  - Food negative: Growth stops, population declines -1 per 60 seconds
- **Habitat Cap**: Growth slows at 90% capacity, stops at 100%

### Food Consumption Tiers
- **0-100 population**: 0.1 food/tick
- **101-500 population**: 0.5 food/tick
- **501-1,000 population**: 1.0 food/tick
- **1,001-2,500 population**: 2.5 food/tick
- **2,501-5,000 population**: 5.0 food/tick

### Food States and Consequences
- **Abundant** (>1 hour stockpile): +10% crew efficiency, +50% growth, "Well-fed" morale (+5% production)
- **Stable** (10min-1hr stockpile): Normal operations, "Content" morale
- **Low** (<10min stockpile): Warning notification, -50% growth, "Hungry" morale (-10% production)
- **Negative**: Emergency reserves activate, "Starving" morale (-25% production, -1 pop/60s after reserves depleted)
- **Safety Net**: Each Food Synthesizer level = 100 food emergency reserve

---

## 4. Crew System

### Crew Types

#### Hub Specialists (3 slots)
- **Miners**: Boost Ore Rig, Fuel Cracker, metal/rare output (+10-35% based on tier)
- **Botanists**: Boost Algae Farm, food chains (+10-35% based on tier)
- **Engineers**: Boost structures, hazard control (+10-35% based on tier)

#### Base Workers (Population-based)
- **Assignment**: Allocated from population pool to individual bases
- **Distribution Types**:
  - Production workers: Boost resource output
  - Maintenance workers: Reduce incident frequency, faster field ops
  - Research workers: Generate bonus research
- **Efficiency Formula**:
  - +5% per worker (workers 1-20)
  - +2% per worker (workers 21-50)
  - Maximum 50 workers per base (requires Residential Zone)
- **Upkeep**: 0.01 food/tick per worker

### Specialist Tiers
- **Tier 1**: +10% bonus (basic training)
- **Tier 2**: +20% bonus + secondary ability (advanced training)
- **Tier 3**: +35% bonus + faction-specific unique abilities (elite training)

### Base Efficiency by Workforce
- **0-5 workers**: 50% base efficiency (emergency skeleton crew)
- **6-15 workers**: 75% base efficiency (understaffed)
- **16-25 workers**: 100% base efficiency (optimal staffing)
- **26-50 workers**: 125% base efficiency (overstaffed bonus)

### Auto-Balance Presets
- **Production Focus**: 70% production, 20% maintenance, 10% research
- **Efficiency Focus**: 40% production, 50% maintenance, 10% research
- **Research Focus**: 30% production, 20% maintenance, 50% research
- **Custom**: Player-controlled sliders

### Crew-Incident Integration
- **No engineer assigned**: Incidents take 2× longer to resolve
- **Engineer assigned**: Normal resolution time
- **Engineer + 5 maintenance workers**: Incidents auto-resolve 50% faster

### Crew-Field Ops Integration
- **Base cooldown**: 20 seconds
- **Per maintenance worker**: -0.5s cooldown (max -10s at 20 workers)
- **Engineer assigned**: Additional -5s cooldown

---

## 5. Base System

### Base Development Zones

Each base has tiered expansion zones unlocked via **one-time habitat investment**:

#### Core Zone
- **Cost**: Free (always available)
- **Slots**: 10 structure slots
- **Unlocks**: Basic production structures (Ore Rig, Fuel Cracker)

#### Industrial Zone
- **Cost**: 50 habitat (one-time per base)
- **Slots**: +15 structure slots
- **Unlocks**: Advanced production structures (Algae Farm, Solar Sail)

#### Research Zone
- **Cost**: 150 habitat (one-time per base)
- **Slots**: +10 structure slots
- **Unlocks**: Research structures (Lab Module, Signal Relay)

#### Residential Zone
- **Cost**: 300 habitat (one-time per base)
- **Slots**: +20 structure slots
- **Effect**: +50 population capacity at this specific base
- **Unlocks**: Crew housing, population growth structures

#### Deep Sector
- **Cost**: 500 habitat (one-time per base)
- **Slots**: +15 structure slots
- **Unlocks**: Rare/exotic structures only (Quantum Forge, Rare Processor)

### Habitat Investment Strategy
- Habitat is **spent** to unlock zones (permanent per base)
- Remaining habitat stays available for future bases or zone unlocks
- **Strategic Choice**: Deep zones on existing bases vs. saving for new bases

---

### Base Structures (Built via Fabrication Bay)

#### Production Structures
- **Ore Rig**: +5 metal/tick per level
- **Fuel Cracker**: +1 fuel/tick per level
- **Solar Sail**: +2 power/tick per level
- **Algae Farm**: +3 organics/tick, +2 food/tick per level

#### Infrastructure Structures
- **Maintenance Bay**: Reduces incident frequency, increases base stability
- **Residential Complex**: +100 habitat (global), +25 worker capacity (this base only)
- **Mess Hall**: -50% food consumption for workers at this base
- **Lab Module**: +1 research/tick per level
- **Signal Relay**: Reduces signal upkeep cost for this base

### Base Outpost Types (Planet-Based)

#### Mining Outpost (Metal-Rich Planets)
- **Primary Output**: 500-2K metal/tick (based on planet quality)
- **Establishment Cost**: 10K M, 5K O, 200F
- **Upkeep**: 50 Food/tick, 20 Fuel/tick (supply runs)

#### Agricultural Outpost (Organic-Rich Planets)
- **Primary Output**: 300-1.5K organics/tick + 200-800 food/tick
- **Establishment Cost**: 8K M, 15K O, 200F
- **Upkeep**: 30 Food/tick, 15 Fuel/tick

#### Research Station (Rare/Exotic Planets)
- **Primary Output**: 50-200 research/tick + rare materials
- **Establishment Cost**: 20K M, 10K O, 5K Research, 500F
- **Upkeep**: 100 Food/tick, 50 Fuel/tick, 10 Rare/tick

#### Fuel Depot (Gas Giants)
- **Primary Output**: 100-500 fuel/tick (alternative fuel source)
- **Establishment Cost**: 50K M, 5K O, 10K Research, 1K F
- **Upkeep**: 200 Power (via Signal network), 50 Rare/tick
- **Unlock**: Tier 3 (Nexus Lv 40)

### Base Upgrade Tiers
Each base can be upgraded through 5 tiers:
1. **Efficiency**: +20% output, -10% upkeep
2. **Automation**: Reduces signal requirement, enables offline production
3. **Expansion**: +50% output, +30% upkeep
4. **Specialization**: Unlocks secondary resource generation
5. **Hub Connection**: Base becomes mini-hub, can support nearby outposts

---

## 6. Expedition Command (Mission + Base Integration)

### Core Structure
Missions and Bases are unified into **Expedition Command** with four integrated components:
- **System Map**: Visual galaxy view showing explored and unexplored systems
- **Active Expeditions**: Missions currently in progress
- **Established Outposts**: Permanent bases (your base management)
- **Expedition Planning**: Configure and launch new expeditions

---

### Player Progression Flow

#### Phase 1: Discovery (Early Game)
1. System Map shows partially revealed sectors with "signal echoes"
2. Player selects unexplored system → Launches **Survey Expedition**
3. **Survey Cost**: Metal + Fuel + Signal range
4. Mission completes → System reveals planet types, resource richness, hazards, traits
5. **Result**: System marked "Surveyed" and available for colonization

#### Phase 2: Colonization (Mid Game)
1. Player selects surveyed system → Views discovered planet list
2. Clicks "Establish Outpost" → One-time **Construction Expedition**
3. **Construction Cost**: Metal + Organics + Fuel + Crew specialist assignment
4. Mission completes → **Base becomes permanent**, appears in Established Outposts
5. **Result**: Base generates passive resources via production structures

#### Phase 3: Operations (Ongoing)
**Established Outposts** tab manages all permanent bases:
- **Fabrication Bay**: Build production structures (Ore Rig, Fuel Cracker, Solar Sail, etc.)
- **Incident Queue**: Random events requiring crew/resources to resolve
- **Field Ops**: Active abilities with cooldowns (Stabilize Grid, Deep Bore)
- **Focus Protocols**: Adjust resource priorities per base
- **Workforce Management**: Assign workers from population pool
- **Supply Runs**: Automatic expeditions costing fuel to maintain base upkeep

---

### Range Tier System (Discovery Gating)

#### Tier 1 (Nexus 1-15): Local Asteroid Belt
- **Accessible Systems**: Debris Field only
- **Example Base Output**: 28 metal, 1 fuel, 1 research/tick
- **No Research Required**: Available from start

#### Tier 2 (Nexus 16-30): Inner System
- **Research Required**: Deep Scan Arrays
- **Accessible Systems**: Ice Moon, Rocky Planet
- **Example Outputs**:
  - Ice Moon: 16 organics, 14 fuel, 8 food/tick
  - Rocky Planet: Balanced resource mix

#### Tier 3 (Nexus 31-50): Outer System
- **Research Required**: Quantum Mapping
- **Accessible Systems**: Lava Rock, Gas Giant
- **Example Outputs**:
  - Lava Rock: 20 metal, 18 organics, 6 research, 4 rare/tick
  - Gas Giant: Fuel Depot (100-500 fuel/tick alternative source)

#### Tier 4 (Nexus 51-60): Distant Systems
- **Research Required**: Wormhole Navigation
- **Infrastructure Required**: Relay Anchors (expensive logistics buildings)
- **Accessible Systems**: Exotic planets with unique resources
- **Special**: Prestige materials, faction-specific bonuses

---

### System Discovery Mechanics

#### Hidden Until Explored
- Galaxy map shows "signal echoes" at range boundaries
- **Survey Requirement**: Signal range + research investment
- Example: "Unknown Signal (Range Tier 2) - Requires: 100 research, 50 fuel"

#### Survey Results (Variable Quality)
- **High-Value Systems**: Multiple planets, rare resources, low hazards
- **Low-Value Systems**: Single planet, common resources, high hazards
- **Mystery Systems**: Anomalies unlocking special research or prestige bonuses
- **Player Choice**: Survey everything (expensive) or focus on high-signal targets

#### System Traits (Randomly Generated)
- **"Metal-Rich Belt"**: +50% metal output from bases here
- **"Geothermal Activity"**: +30% power generation, +10% hazard
- **"Abandoned Relay"**: -50% signal upkeep, bonus research unlock
- **"Contested Space"**: Random raid events (late-game threat)

---

### Expedition Launch Flow

#### Step 1: Select Destination
- System Map → Click unexplored system → "Survey Expedition" queued

#### Step 2: Configure Expedition
- **Distance**: Displays range tier and estimated travel time
- **Operational Stance**:
  - Cautious: -20% speed, -50% hazard
  - Balanced: Standard risk/reward
  - Aggressive: +30% speed, +100% hazard
- **Assign Specialist**: Miner (+metal/rare), Engineer (-hazard), Botanist (+organics)
- **Fuel Boost Slider**: Spend extra fuel to reduce travel time up to 50%
- **Cost Display**: Shows total resource cost before launch

#### Step 3: Track Progress
- **Active Expeditions** (limited slots):
  - Survey: Kepler 7B | 23s remaining | ████████░░ 80%
  - Supply Run: Debris Field | 8s remaining | ███████░░░ 70%
  - Empty slot (unlock with Logistics Hub upgrades)

#### Step 4: Results
- **Survey Complete**: Displays discovered planets + system traits
- **Option**: Establish Outpost at discovered location (triggers construction expedition)

---

### Integration with Existing Systems

#### Missions → Expeditions
- "Debris Field mission" becomes "Debris Field Outpost" (permanent base)
- "Target Locks" becomes "Expedition Queue" (plan multiple missions)
- "Launch Bay" becomes "Expedition Planning" (clearer purpose)
- Operational Stance system (Cautious/Balanced/Aggressive) carries over

#### Bases → Outpost Network
- Fabrication Bay remains (production structure building)
- Incident Queue remains (dynamic events)
- Field Ops remains (active cooldown abilities)
- Site Overview becomes "Outpost Dashboard" (all bases overview)

#### Signal + Range Tiers → Discovery Gates
- **Range Tier** determines which systems are visible on map
- **Signal** resource determines survey expedition cost
- **Deep Scan Arrays** (research) unlocks Range Tier 2
- **Relay Anchors** (late-game building) extends signal to Tier 4 systems

---

## 7. Research Command (Tech Tree)

### Core Principle
- **Hub** = Direct production and conversion (build and upgrade buildings)
- **Tech/Research** = Unlocks capabilities, gates content, provides multipliers

---

### Research Track Organization

#### Core Track (Foundation)
- **Fuel Synthesis** → Unlocks Fuel Refinery building in Hub
- **Advanced Refining** → Unlocks Hydrogen Cracker (alternative fuel path)
- **Fusion Cores** → Unlocks Fusion Refinery (Tier 3 fuel generation)
- **Habitat Protocols** → Unlocks Habitat Module building
- **Life Support Systems** → Unlocks Hydroponics Bay
- **Cryo Storage** → Advanced population management features

#### Safety Track (Risk Mitigation)
- **Hazard Gear** → -25% mission hazard exposure
- **Environmental Suits** → -40% hazard exposure, work in higher hazard zones
- **Containment Fields** → Buildings operate at 110% efficiency in hazard zones
- **Emergency Protocols** → Unlocks Auto-Balancer building
- **Auto-Stabilizers** → Improved Auto-Balancer response time
- **Crisis Management** → Prevents catastrophic resource collapse

#### Logistics Track (Efficiency)
- **Logistics Drones** → +20% mission cargo capacity
- **Cargo Automation** → +40% cargo, reduced supply run costs
- **Quantum Shipping** → Instant resource delivery between bases
- **Signal Relays** → Extends base signal range
- **Deep Scan Arrays** → +1 research/tick, +1 range tier, reveals deep targets
- **Quantum Mapping** → Reveals rare planet types, unlocks Range Tier 3

#### Expansion Track (Content Gates)
- **Planetary Survey** → Unlocks basic outpost establishment
- **Biome Adaptation** → Unlocks Ice Moon and Rocky Planet biomes (Tier 2)
- **Exotic Habitats** → Unlocks Lava Rock and Gas Giant biomes (Tier 3)
- **Basic Outposts** → Core Zone structures available
- **Advanced Colonies** → Industrial and Research Zone structures
- **Megastructures** → Deep Sector structures, prestige content
- **Wormhole Navigation** → Unlocks Range Tier 4 (distant systems)

---

### UI Integration (Hub ↔ Tech Cross-Reference)

#### In Hub Building Cards
```
Hydrogen Cracker [LOCKED]
Requires Research: Advanced Refining (Tier 2)
Cost: 256 research
[View in Research Command →]
```

#### In Tech Tree Nodes
```
Advanced Refining
Cost: 500 research
Track: Core Track | Tier 2

Unlocks:
→ Hydrogen Cracker (Hub building)
→ Alternative fuel conversion path
[Research] [Details]
```

#### In Locked Hub Buildings
- Show required tech with quick jump to Research Command
- Display research cost and progress toward unlock
- Highlight when research becomes available

---

## 8. Consequence and Safety Systems

### Negative Resource States

#### Metal < 0
- **Effect**: Construction halts, all upgrades paused
- **Recovery**: Auto-throttle Fuel Refinery first, then Research Lab
- **No Permanent Loss**: Systems resume when positive

#### Organics < 0
- **Effect**: Organic Cultivators stop producing, crew morale -1%/second
- **Recovery**: Emergency Food → Organics conversion (50:1 ratio)
- **Warning**: Notification at 30 seconds until zero

#### Food < 0
- **Effect**: Crew morale -5%/second, outpost production -50%, population growth stops
- **Emergency Reserve**: 100 food per Food Synthesizer level (prevents immediate collapse)
- **Recovery**: Auto-converts Organics → Food (3:1 ratio)
- **Population Impact**: After reserves depleted, population declines -1 per 60 seconds
- **Never Fatal**: Crew cannot die, only become severely inefficient

#### Fuel < 0
- **Effect**: Outpost production stops, all logistics halted, expeditions paused
- **Recovery**: Catalyst Cracker cooldown removed (emergency use)
- **Warning**: Notification at 60 seconds until zero

#### Power < 0 (CANNOT HAPPEN)
- **System**: Power automatically throttles to maintenance level
- **Maintenance Pool**: Always reserves 10% of max power generation
- **Protection**: Prevents total power failure

#### Habitat (Cannot Go Negative)
- Habitat is spent (invested) to unlock base zones
- Remaining habitat determines population cap
- Cannot be consumed below zero (only allocated)

---

### Auto-Balance Strategies (AI-Driven)

When Auto-Balancer is enabled, system uses these strategies:

#### Conservative Mode
- Maintains 20% buffer on all resources
- Throttles production when resource drops below 20% buffer
- Boosts production when resource exceeds 40% buffer
- **Best For**: Stability-focused players, AFKing

#### Focused Mode
- Player selects priority resource (e.g., "Focus: Fuel")
- Maximizes chosen resource production
- Maintains minimum viable levels on other resources
- **Best For**: Resource-specific goals, bottleneck breaking

#### Growth Mode
- Prioritizes buildings that unlock next Nexus tier
- Calculates optimal upgrade paths automatically
- Suggests next building to upgrade via notification
- **Best For**: Fast progression, new players

#### Balanced Mode
- Maintains resource ratios based on consumption patterns
- Uses 10-minute rolling average to predict needs
- Adapts dynamically to player's building choices
- **Best For**: General gameplay, experienced players

---

## 9. Progression Curve

### Early Game (Nexus 1-10): Learning Phase
- **Focus**: Build one of each production building, understand resource loops
- **Challenge**: Achieve positive fuel production
- **Goal**: Establish first outpost (Debris Field)
- **Time**: 30-60 minutes
- **Key Unlock**: Food Synthesizer, Metal Extractor, Fuel Refinery basics

### Mid Game (Nexus 11-30): Expansion Phase
- **Focus**: First outposts in multiple systems, alternative fuel sources
- **Challenge**: Balance hub investment vs. outpost expansion
- **Goal**: Build 3-5 outposts, unlock Auto-Balancer
- **Time**: 3-8 hours
- **Key Unlocks**: Deep Scan Arrays (Range Tier 2), Hydrogen Cracker, Auto-Balancer, Priority Manager

### Late Game (Nexus 31-60): Optimization Phase
- **Focus**: Prestige preparation, rare materials, faction milestones
- **Challenge**: Maximize efficiency across entire network, complete faction projects
- **Goal**: All Tier 3 buildings to level 10+, unlock Range Tier 4
- **Time**: 15-30 hours
- **Key Unlocks**: Gas Giant Fuel Depots, Quantum Mapping, Wormhole Navigation, prestige preview

### Prestige (Nexus 61+): Meta-Progression
- **Focus**: Permanent bonuses, faction specialization, exotic systems
- **Challenge**: Choose prestige faction, optimize fragment collection
- **Goal**: Multiple prestige loops with different factions
- **Time**: Ongoing
- **Prestige Gate**: Nexus 60 + 1,000 fragments from faction contributions

---

## 10. Building Cost Scaling Framework

### Formula Template
```
Total Cost = Base Cost × (Growth Rate ^ Level) × Tier Multiplier × Resource Type Modifier
```

### Growth Rates by Building Purpose
- **Basic Production**: 1.10-1.12 (slow, always relevant, long-term scaling)
- **Conversion/Processing**: 1.12-1.15 (moderate, tier-gated relief via alternatives)
- **Logistics/QoL**: 1.14-1.18 (expensive, high impact on gameplay experience)
- **Strategic/Research**: 1.15-1.20 (very expensive, unlock-based progression)

### Tier Multipliers (Applied at Tier Gates)
- **Tier 1 → Tier 2**: ×5 cost increase, but new resource types become available
- **Tier 2 → Tier 3**: ×10 cost increase, prestige mechanics introduced
- **Tier 3 → Tier 4**: ×25 cost increase, endgame content unlocked

### Resource Type Modifiers (Multi-Resource Costs)
- **Primary Resource**: 1.0× multiplier (Metal, Organics, Food)
- **Processed Resource**: 0.3× multiplier (Fuel, Research) - cheaper per unit value
- **Strategic Resource**: 0.1× multiplier (Rare, Fragments) - very cheap per unit but scarce

---

## 11. Faction System and Prestige

### Faction-Linked Prestige Bonuses

#### Shepherds of Silence
- **Prestige Bonus**: -8% hazard exposure (stacks with research)
- **Unique Unlock**: "Containment Protocols" - buildings operate at 110% efficiency in hazardous zones
- **Starting Bonus**: +15% research generation
- **Crew Perk**: Crew can work in hazard zones without morale penalty
- **Philosophy**: Contain, Isolate, Endure

#### Broker's Consortium
- **Prestige Bonus**: +10% cargo capacity across all outposts
- **Unique Unlock**: "Trade Routes" - passive resource exchange between player outposts
- **Starting Bonus**: +20% metal/organics from missions
- **Crew Perk**: -30% food consumption (efficient logistics)
- **Philosophy**: Trade, Profit, Expand

#### Archive Keepers
- **Prestige Bonus**: Research persists through prestige (keep 25% of spent research)
- **Unique Unlock**: "Blueprint Library" - reduced construction costs (-15%)
- **Starting Bonus**: All Tier 1 research pre-unlocked
- **Crew Perk**: Specialists train 50% faster (knowledge preservation)
- **Philosophy**: Preserve, Document, Remember

---

### Multi-Week Progression Timeline

#### Week 1 (Nexus 1-30, Tier 1-2)
- Unlock all basic buildings
- Establish 3-5 outposts in local systems
- Complete first faction milestone (e.g., Stability Lattice project)
- **Fragment Collection**: ~200-400 fragments

#### Week 2 (Nexus 31-50, Tier 3 Unlock)
- Alternative fuel paths unlock (Hydrogen Cracker, Gas Giant Fuel Depots)
- Second faction milestone unlocks shared faction projects
- Access Tier 2 mission biomes (Ice Moon, Lava Rock)
- **Fragment Collection**: ~400-700 fragments

#### Week 3+ (Nexus 51-60, Prestige Preparation)
- Unlock prestige preview: "If you prestige now, you'll gain X points"
- Final faction milestone: Choose prestige faction (locks specialization)
- "Ascension Countdown" UI shows estimated prestige readiness
- **Fragment Collection**: 700-1,000 fragments (prestige threshold)

---

### Fragment Ledger System (Prestige Currency)

#### Fragment Sources
- **Surveying new systems**: +10-50 fragments (based on system rarity)
- **Establishing outposts**: +25-100 fragments (based on planet type)
- **Faction project contributions**: +50-200 fragments (based on contribution tier)
- **Milestone completion**: +100-500 fragments (major achievements)
- **Competitive rewards**: Top contributors earn bonus fragments weekly

#### Prestige Requirements
- **Threshold**: Nexus Level 60 + 1,000 fragments collected
- **Timing Control**: Player chooses when to prestige (can delay for optimization)
- **Fragment Checkpoints**: Global thresholds (e.g., "First Whisper at 25%") create shared milestones

#### Prestige Point Calculation
```
Prestige Points = (Nexus Level - 60) × Average Outpost Level × Unique Systems Discovered / 10
```

---

### Prestige Upgrades (Permanent Bonuses)

#### Production Category
- **Resource Boost**: +5% to chosen resource per point (stackable)
- **Worker Efficiency**: Workers provide +7% per worker instead of +5% (15 points)
- **Population Growth**: +50% growth rate (5 points)

#### Economic Category
- **Cost Reduction**: -3% all building costs per point (stackable)
- **Habitat Efficiency**: Zone unlocks cost -25% habitat (10 points)
- **Starting Resources**: Begin new run with 10% of prestiged resources (8 points)

#### Progression Category
- **Unlock Persistence**: Keep Tier 2 building unlocks (12 points)
- **Research Persistence**: Keep 25% of spent research (faction-specific)
- **Auto-Features**: Start with Auto-Balancer and Priority Manager unlocked (10 points)

#### Content Category
- **Zone Persistence**: Unlocked base zones persist through prestige (one-time investment feel)
- **Blueprint Access**: Reduced construction costs via Blueprint Library (faction-specific)
- **Exotic Discovery**: New systems unlock at higher prestige tiers

---

### Prestige Tiers
- **Tier 1 Prestige** (Nexus 60-79): Basic bonuses, 1-5 prestige points
- **Tier 2 Prestige** (Nexus 80-99): Advanced bonuses, 5-15 prestige points
- **Tier 3 Prestige** (Nexus 100+): Meta bonuses, 15-50 prestige points

#### Faction Project Prestige Bonuses
- **Projects Completed Pre-Prestige**: Each Tier 4 project completion grants +1 prestige point
- **Leaderboard History**: Top 10 finishes in any season grant +2 prestige points
- **Veteran Bonus**: Players prestiging with 5+ project contributions start with +5% fragment generation

---

## 12. Shared Faction Projects and Competitive Systems

### Frontier Projects (Shared Construction)

#### Core Concept
Faction-wide construction projects that require collective contributions from all members. Projects unlock powerful faction-wide buffs, events, and progression milestones.

#### Project Structure

**Stability Lattice** (Current Example)
- **Description**: Live project progress across the faction
- **Total Goal**: 1.28M resources (tiered: Fuel 200K, Metal 900K, Research 180K)
- **Current Progress**: 494.6K / 1.28M (39%)
- **Contribution Method**: Players donate resources via "Contribute" interface
- **Rewards**: Faction-wide buffs when tier thresholds reached

---

### Frontier Project Tiers

Each project has multiple tiers with escalating requirements and rewards:

#### Tier 1/4 (0-25% completion)
- **Threshold**: 320K resources
- **Unlock**: Minor faction buff (e.g., +5% production globally)
- **Fragment Reward**: 50 fragments per contributor
- **Event**: "First Whisper" - narrative checkpoint

#### Tier 2/4 (25-50% completion)
- **Threshold**: 640K resources
- **Unlock**: Moderate faction buff (e.g., +10% production, -5% hazard)
- **Fragment Reward**: 100 fragments per contributor
- **Event**: Unlocks next faction construction project

#### Tier 3/4 (50-75% completion)
- **Threshold**: 960K resources
- **Unlock**: Major faction buff (e.g., +15% production, new building blueprint)
- **Fragment Reward**: 150 fragments per contributor
- **Event**: Faction-specific special research unlocked

#### Tier 4/4 (75-100% completion)
- **Threshold**: 1.28M resources
- **Unlock**: Elite faction buff (e.g., +25% production, prestige bonus multiplier)
- **Fragment Reward**: 250 fragments per contributor + prestige eligibility
- **Event**: Project completion, next mega-project unlocked

---

### Faction Construction Projects (Rotating Pool)

#### **Containment Core** (Shepherds of Silence)
- **Focus**: Metal + Organics + Research
- **Theme**: Reinforces suppression shields and quarantine protocols
- **Tier 1 Unlock**: "Shield Harmonization" event (-8% hazard faction-wide)
- **Tier 4 Unlock**: "Containment Protocols" (buildings operate at 110% efficiency in hazard zones)
- **Scale**: ×1.90 per tier (steeply increasing contributions needed)

#### **Quietus Arc** (Shepherds of Silence)
- **Focus**: Metal + Organics + Research
- **Theme**: Improves crew recovery under quarantine strain
- **Tier 1 Unlock**: "Crew Uplift" event (+6% morale stability)
- **Tier 4 Unlock**: "Care Cadence" directive (+8% morale stability permanently)
- **Scale**: ×1.85 per tier

#### **Silence Grid** (Shepherds of Silence)
- **Focus**: Metal + Fuel + Research
- **Theme**: Suppresses fragment interference and reduces event spikes
- **Tier 1 Unlock**: "Calm Window" event (-10% incident rate)
- **Tier 4 Unlock**: "Stability Clamp" directive (-12% incident rate permanently)
- **Scale**: ×1.90 per tier

#### **Trade Nexus** (Broker's Consortium)
- **Focus**: Metal + Organics + Fuel
- **Theme**: Establishes trade routes between player outposts
- **Tier 1 Unlock**: +5% cargo capacity
- **Tier 4 Unlock**: "Trade Routes" system (passive resource exchange)
- **Scale**: ×1.85 per tier

#### **Archive Vault** (Archive Keepers)
- **Focus**: Research + Rare + Metal
- **Theme**: Preserves knowledge and blueprints
- **Tier 1 Unlock**: +10% research generation
- **Tier 4 Unlock**: "Blueprint Library" (-15% construction costs)
- **Scale**: ×2.00 per tier (knowledge is expensive)

---

### Contribution Mechanics

#### Individual Contributions
- **Resource Selection**: Players choose Metal, Organics, Fuel, or Research from dropdown
- **Amount**: Enter custom amount or use quick-select buttons (100, 1K, 10K, All)
- **Confirmation**: "Donate X resource" button with confirmation dialog
- **Receipt**: Instant feedback showing contribution recorded + fragments earned

#### Contribution Rewards (Individual)
- **Fragment Payout Formula**: `Fragments = (Resource Value / 1000) × Tier Multiplier`
  - Tier 1: ×1.0 multiplier
  - Tier 2: ×1.5 multiplier
  - Tier 3: ×2.0 multiplier
  - Tier 4: ×3.0 multiplier
- **Leaderboard Position**: Top contributors gain additional fragment bonuses
- **Milestones**: Personal contribution milestones (1K, 10K, 100K, 1M donated) grant titles + fragments

#### Smart Contribution Suggestions
- **UI Helper**: "Your surplus: 429.6K Metal, 820.1K Organics - Consider donating excess!"
- **Auto-Donate Option**: Enable auto-donate X% of production above stockpile threshold
- **Faction Alert**: Notifications when project enters new tier or nears completion

---

### Leaderboard System

#### Top Contributors (Per Project)
Displayed in Faction tab and Relay Network interface:

```
Top Contributors - Stability Lattice
1. AlphaOmega         429.6K metal
2. XXX-Booblicker     65.0K fuel
3. Blocker            [contribution amount]
4. Test               0
5. [Player Name]      [contribution amount]
```

#### Leaderboard Rewards (Weekly Reset)

**Rank 1 (Top Contributor)**
- **Fragments**: +500 bonus fragments
- **Title**: "Faction Champion" (displayed in profile, chat)
- **Buff**: +10% production for 7 days
- **Prestige Bonus**: 2× fragment earnings for next prestige

**Rank 2-5**
- **Fragments**: +250 bonus fragments
- **Title**: "Faction Elite"
- **Buff**: +5% production for 7 days

**Rank 6-20**
- **Fragments**: +100 bonus fragments
- **Title**: "Faction Supporter"
- **Buff**: +3% production for 3 days

**All Contributors**
- **Fragments**: Base contribution rewards (as earned)
- **Title**: "Faction Member"
- **Participation Badge**: Displayed in profile

---

### Competitive Seasons

#### Season Structure (4-Week Cycles)

**Week 1: Construction Focus**
- Active Project: New faction construction unlocked
- Bonus: 2× fragments for construction contributions
- Goal: Complete Tier 1-2 before Week 2

**Week 2: Expansion Focus**
- Active Project: Continues from Week 1
- Bonus: 2× fragments for surveying new systems + establishing outposts
- Leaderboard: Top explorers gain bonus fragments
- Goal: Complete Tier 2-3 before Week 3

**Week 3: Optimization Focus**
- Active Project: Final push toward Tier 4
- Bonus: 2× fragments for research generation
- Leaderboard: Top researchers gain bonus fragments
- Goal: Complete Tier 4 before Week 4

**Week 4: Prestige Preparation**
- Active Project: Completion celebration, rewards distributed
- Bonus: Prestige preview available, 1.5× fragment earnings
- New Project Teaser: Next season's construction revealed
- Goal: Players evaluate prestige timing

---

### Faction Project Integration with Prestige

#### Prestige Eligibility Gates
To unlock prestige, players must:
1. Reach Nexus Level 60
2. Collect 1,000 fragments (via contributions + other sources)
3. **Contribute to at least 3 faction projects** (any tier)

This ensures players engage with multiplayer systems before prestiging.

#### Prestige Timing Strategy
- **Early Prestigers**: Rush fragments, may miss late-tier project buffs
- **Late Prestigers**: Maximize project buffs before reset, delay 1-2 weeks
- **Optimal Window**: Week 3-4 of season after Tier 4 completion

#### Faction Loyalty Bonus
- **Same Faction Prestige**: +10% fragment retention if prestiging with same faction
- **Faction Switch Penalty**: Lose faction-specific buffs, restart from Tier 0 projects
- **Recommendation**: System suggests best prestige faction based on playstyle

---

### Cross-Faction Mechanics

#### Faction Rivalry Events (Special Seasons)
- **Competitive Construction**: All three factions build same project type simultaneously
- **Winner Determination**: First faction to complete Tier 4 wins
- **Winner Rewards**: 2× prestige multiplier for all members, unique cosmetic unlocks
- **Runner-Up Rewards**: 1.5× prestige multiplier
- **Participation Rewards**: All contributors get fragments

#### Shared Galactic Events
- **"The Convergence"**: All factions must cooperate to reach combined goal
- **Pooled Resources**: Contributions count toward single mega-project (10M+ resources)
- **Global Unlock**: New range tier, exotic system access, or game-wide feature
- **Fragment Flood**: Massive fragment payout (500-2K per contributor)

---

### UI/UX Integration

#### Faction Tab Enhancements

**Project Overview Section**
```
Frontier Project: Stability Lattice
Live project progress across the faction

Progress: 494.6K / 1.28M (39%)
├─ Fuel:     65.0K / 200.0K  ████████░░░░░░░
├─ Metal:    429.6K / 900.0K ████████████░░░
└─ Research: 0 / 180.0K      ░░░░░░░░░░░░░░░

Next Milestone: Tier 2/4 at 640K (50%)
Unlocks: +10% production + "Shield Watch" directive

Your Total Contributions: 12.5K metal, 3.2K fuel
Fragments Earned: 187

[Contribute Resources] [View Rewards] [Leaderboard]
```

**Contribution Interface**
```
Contribute to Stability Lattice

Resource: [Metal ▼]
Amount:  [_____] 
         [100] [1K] [10K] [Max: 429.6K]

Fragments Expected: ~429 (Tier 2 multiplier: ×1.5)

[Donate 100 metal] [Cancel]
```

**Leaderboard Display**
```
Top Contributors (This Project)
Rank  Player            Contribution
1.    AlphaOmega        429.6K metal     ⭐
2.    XXX-Booblicker    65.0K fuel       
3.    Blocker           45.3K organics   
...   ...               ...
42.   You               12.5K metal      

Weekly Reset: 3 days, 14 hours

[View Season Rankings] [View All-Time]
```

---

### Progression Hooks

#### Early Game Integration (Nexus 1-20)
- **Introduction**: Tutorial mission introduces Relay Network at Nexus 10
- **First Contribution**: Guided contribution of 100 metal to active project
- **Reward**: 10 fragments + "First Contact" achievement
- **Goal**: Familiarize players with faction cooperation

#### Mid Game Integration (Nexus 21-50)
- **Project Selection**: Players choose which project to support (if multiple active)
- **Auto-Donate Feature**: Unlock at Nexus 25 via Priority Manager
- **Milestone Focus**: Contribute toward personal 10K milestone
- **Goal**: Establish regular contribution habits

#### Late Game Integration (Nexus 51-60)
- **Prestige Preparation**: Maximize contributions for fragment collection
- **Competitive Push**: Aim for top 20 leaderboard position
- **Faction Choice**: Evaluate which faction's completed projects align with playstyle
- **Goal**: Collect final fragments needed for prestige threshold

#### Post-Prestige Integration (Nexus 61+)
- **Veteran Status**: Prestiged players have "Prestige ★" badge in leaderboards
- **Multiplier Bonus**: Prestiged players earn 1.5× fragments from contributions
- **Mentorship**: High prestige players can sponsor lower-level faction members (+10% shared rewards)
- **Goal**: Create veteran community that supports newer players

---

### Faction Construction Scaling

#### Project Difficulty Curve
- **First Project** (Nexus 1-30 avg): 1.28M total resources (achievable in 1-2 weeks)
- **Second Project** (Nexus 31-50 avg): 5.0M total resources (2-3 weeks)
- **Third Project** (Nexus 51-60 avg): 15.0M total resources (3-4 weeks)
- **Prestige Projects** (Nexus 61+): 50M+ total resources (ongoing, seasonal)

#### Scale Multipliers by Faction Size
- **Small Faction** (<50 active players): ×0.5 requirements
- **Medium Faction** (50-200 players): ×1.0 requirements (baseline)
- **Large Faction** (200-500 players): ×2.0 requirements
- **Mega Faction** (500+ players): ×5.0 requirements

This ensures projects remain challenging regardless of faction population.

---

### Anti-Abuse Systems

#### Contribution Limits
- **Daily Cap**: 100K resources per player per day (prevents single-player dominance)
- **Cooldown**: 5-minute cooldown between contributions (prevents spam)
- **Verification**: Contributions logged with timestamp + player ID (audit trail)

#### Bot Detection
- **Pattern Analysis**: Flag accounts contributing exact amounts at precise intervals
- **Human Verification**: Suspicious accounts require CAPTCHA before large donations
- **Rate Limiting**: Throttle contributions from flagged accounts

#### Fair Play Enforcement
- **Alt Account Rules**: Limit 2 accounts per player, both must be disclosed
- **Resource Trading Limits**: Cannot directly trade resources between players (prevents RMT)
- **Leaderboard Integrity**: Verified accounts only, cheaters removed + fragments revoked

---

## 1. Resource Hierarchy and Dependencies

### Tier 0: Foundation Resources (Always Positive)
- **Power**: Base generation, never consumed below maintenance level
- **Signal**: Communication range, enables distant operations
- **Crew Morale**: Affects efficiency multipliers (50%-150%)

### Tier 1: Primary Resources (Can go negative with consequences)
- **Metal**: Construction, upgrades
- **Organics**: Life support, advanced materials
- **Food**: Population sustenance, crew maintenance
- **Habitat**: Population capacity, unlocks base expansion zones

### Tier 2: Processed Resources (Conversion-based)
- **Fuel**: Refined from Metal + Organics + Power
- **Research**: Generated from excess resources + Signal
- **Rare Materials**: Extracted from specific planet types

### Tier 3: Strategic Resources (Long-term)
- **Fragments**: Meta-currency from faction contributions, gates prestige
- **Intel**: Unlocks new systems and building blueprints

---

## 2. Hub Building Hierarchy

### Command Nexus (Central Building)
**Purpose**: Unlocks tier gates, provides global bonuses

**Tier Gates**:
- **Tier 1** (Nexus Lv 1-10): Local operations, basic buildings
- **Tier 2** (Nexus Lv 11-30): System expansion, fuel economy
- **Tier 3** (Nexus Lv 31-60): Multi-system operations, automation
- **Tier 4** (Nexus Lv 61-100): Advanced logistics, prestige loops

**Cost Scaling**: Base × (1.15^level) with tier multipliers

---

### Production Buildings (Per-Tick Generation)

#### Metal Extractor
- **Base Output**: 50 metal/tick
- **Cost Formula**: 100M × 1.12^level
- **Unlock**: Tier 1 (Nexus Lv 1)
- **Caps**: Soft cap at level 50 (diminishing returns)

#### Organic Cultivator
- **Base Output**: 30 organics/tick
- **Cost Formula**: 80M, 20O × 1.12^level
- **Unlock**: Tier 1 (Nexus Lv 3)
- **Special**: Requires 5 Food/tick per level (creates feedback loop)

#### Food Synthesizer
- **Base Output**: 40 food/tick
- **Cost Formula**: 60M, 40O × 1.11^level
- **Unlock**: Tier 1 (Nexus Lv 1)
- **Special**: Has emergency reserves (prevents population collapse)

#### Power Generator
- **Base Output**: 200 power/tick
- **Cost Formula**: 150M, 10O × 1.13^level
- **Unlock**: Tier 1 (Nexus Lv 1)
- **Special**: Cannot go below maintenance level (automatic throttling)

#### Habitat Module
- **Base Output**: 50 habitat per level
- **Cost Formula**: 1K M, 500O × 1.13^level
- **Unlock**: Tier 1 (Nexus Lv 1)
- **Purpose**: Increases population cap and enables base zone unlocks

#### Hydroponics Bay
- **Base Output**: 20 food/tick, 10 habitat per level
- **Cost Formula**: 800M, 600O × 1.12^level
- **Unlock**: Tier 1 (Nexus Lv 8)
- **Synergy**: Dual resource for population growth and capacity

---

### Conversion Buildings (Transform Resources)

#### Fuel Refinery
- **Base Output**: +1 fuel/tick per level
- **Cost Scaling**:
  - Levels 1-20: 800M, 200O × 1.10^level
  - Levels 21-50: 500M, 150O, 50F × 1.08^level (self-sustaining)
  - Levels 51+: Prestige-gated alternatives unlock
- **Consumption**: 5 Power, 2 Metal, 1 Organic per fuel generated
- **Unlock**: Tier 1 (Nexus Lv 5)

#### Research Lab
- **Output**: Converts excess resources into research
- **Formula**: 1 Research = 100M + 50O + 10F (any combination)
- **Cost**: 5K M, 2K O × 1.15^level
- **Unlock**: Tier 2 (Nexus Lv 15)

#### Rare Material Processor
- **Output**: Processes planetary exports into rare materials
- **Cost**: 10K M, 5K O, 2K Research × 1.12^level
- **Unlock**: Tier 3 (Nexus Lv 35)

---

### Logistics Buildings (Quality of Life)

#### Catalyst Cracker
- **Purpose**: Emergency fuel boosts via resource burn
- **Cost**: 320M, 40F, 60O per use (not per level)
- **Cooldown**: 30 seconds (reduced by upgrades)
- **Special**: Cooldown removed when fuel < 0

#### Logistics Hub
- **Purpose**: Reduces travel time for all expeditions and supply runs
- **Effect**: Each level applies globally to all outposts
- **Cost**: 520M, 160F, 80O × 1.14^level

#### Auto-Balancer
- **Purpose**: Prevents negative resource states
- **Mechanics**:
  - Monitors all resources every tick
  - Predicts resource depletion 30 seconds ahead
  - Auto-throttles producers/converters to prevent negatives
  - Sends player notifications
- **Cost**: 2K M, 1K O, 500 Research
- **Unlock**: Tier 2 (Nexus Lv 20)
- **Upgrades**: Faster prediction, smarter throttling

#### Priority Manager
- **Purpose**: Player sets resource production priorities
- **UI**: Slider system (Example: Fuel 40% | Metal 30% | Organics 20% | Food 10%)
- **Effect**: Buildings adjust output/input ratios within ±25% based on priority
- **Cost**: 5K M, 2K O, 1K Research
- **Unlock**: Tier 2 (Nexus Lv 25)

#### Granary
- **Purpose**: Increases food reserve capacity
- **Base Storage**: 1,000 food
- **Per Level**: +500 food storage
- **Cost**: 500M, 200O × 1.11^level
- **Unlock**: Tier 1 (Nexus Lv 5)

#### Recruitment Bay
- **Purpose**: Converts population into specialists
- **Cost per Specialist**: 100 population + 50 research + 500 food
- **Training Time**: 5 minutes
- **Training Slots**: Increases with building level
- **Unlock**: Tier 2 (Nexus Lv 20)

---

## 3. Population System

### Core Mechanics
- **Habitat** = Maximum population capacity
- **Food** = Population sustenance and growth fuel
- **Population** = Active resource pool for crew assignment

### Population Growth
- **Base Rate**: +1 population per 30 seconds
- **Growth Modifiers**:
  - Food abundant (>2× consumption): +50% growth rate
  - Food stable (1-2× consumption): Normal growth
  - Food scarce (<1× consumption): -50% growth, morale penalty
  - Food negative: Growth stops, population declines -1 per 60 seconds
- **Habitat Cap**: Growth slows at 90% capacity, stops at 100%

### Food Consumption Tiers
- **0-100 population**: 0.1 food/tick
- **101-500 population**: 0.5 food/tick
- **501-1,000 population**: 1.0 food/tick
- **1,001-2,500 population**: 2.5 food/tick
- **2,501-5,000 population**: 5.0 food/tick

### Food States and Consequences
- **Abundant** (>1 hour stockpile): +10% crew efficiency, +50% growth, "Well-fed" morale (+5% production)
- **Stable** (10min-1hr stockpile): Normal operations, "Content" morale
- **Low** (<10min stockpile): Warning notification, -50% growth, "Hungry" morale (-10% production)
- **Negative**: Emergency reserves activate, "Starving" morale (-25% production, -1 pop/60s after reserves depleted)
- **Safety Net**: Each Food Synthesizer level = 100 food emergency reserve

---

## 4. Crew System

### Crew Types

#### Hub Specialists (3 slots)
- **Miners**: Boost Ore Rig, Fuel Cracker, metal/rare output (+10-35% based on tier)
- **Botanists**: Boost Algae Farm, food chains (+10-35% based on tier)
- **Engineers**: Boost structures, hazard control (+10-35% based on tier)

#### Base Workers (Population-based)
- **Assignment**: Allocated from population pool to individual bases
- **Distribution Types**:
  - Production workers: Boost resource output
  - Maintenance workers: Reduce incident frequency, faster field ops
  - Research workers: Generate bonus research
- **Efficiency Formula**:
  - +5% per worker (workers 1-20)
  - +2% per worker (workers 21-50)
  - Maximum 50 workers per base (requires Residential Zone)
- **Upkeep**: 0.01 food/tick per worker

### Specialist Tiers
- **Tier 1**: +10% bonus (basic training)
- **Tier 2**: +20% bonus + secondary ability (advanced training)
- **Tier 3**: +35% bonus + faction-specific unique abilities (elite training)

### Base Efficiency by Workforce
- **0-5 workers**: 50% base efficiency (emergency skeleton crew)
- **6-15 workers**: 75% base efficiency (understaffed)
- **16-25 workers**: 100% base efficiency (optimal staffing)
- **26-50 workers**: 125% base efficiency (overstaffed bonus)

### Auto-Balance Presets
- **Production Focus**: 70% production, 20% maintenance, 10% research
- **Efficiency Focus**: 40% production, 50% maintenance, 10% research
- **Research Focus**: 30% production, 20% maintenance, 50% research
- **Custom**: Player-controlled sliders

### Crew-Incident Integration
- **No engineer assigned**: Incidents take 2× longer to resolve
- **Engineer assigned**: Normal resolution time
- **Engineer + 5 maintenance workers**: Incidents auto-resolve 50% faster

### Crew-Field Ops Integration
- **Base cooldown**: 20 seconds
- **Per maintenance worker**: -0.5s cooldown (max -10s at 20 workers)
- **Engineer assigned**: Additional -5s cooldown

---

## 5. Base System

### Base Development Zones

Each base has tiered expansion zones unlocked via **one-time habitat investment**:

#### Core Zone
- **Cost**: Free (always available)
- **Slots**: 10 structure slots
- **Unlocks**: Basic production structures (Ore Rig, Fuel Cracker)

#### Industrial Zone
- **Cost**: 50 habitat (one-time per base)
- **Slots**: +15 structure slots
- **Unlocks**: Advanced production structures (Algae Farm, Solar Sail)

#### Research Zone
- **Cost**: 150 habitat (one-time per base)
- **Slots**: +10 structure slots
- **Unlocks**: Research structures (Lab Module, Signal Relay)

#### Residential Zone
- **Cost**: 300 habitat (one-time per base)
- **Slots**: +20 structure slots
- **Effect**: +50 population capacity at this specific base
- **Unlocks**: Crew housing, population growth structures

#### Deep Sector
- **Cost**: 500 habitat (one-time per base)
- **Slots**: +15 structure slots
- **Unlocks**: Rare/exotic structures only (Quantum Forge, Rare Processor)

### Habitat Investment Strategy
- Habitat is **spent** to unlock zones (permanent per base)
- Remaining habitat stays available for future bases or zone unlocks
- **Strategic Choice**: Deep zones on existing bases vs. saving for new bases

---

### Base Structures (Built via Fabrication Bay)

#### Production Structures
- **Ore Rig**: +5 metal/tick per level
- **Fuel Cracker**: +1 fuel/tick per level
- **Solar Sail**: +2 power/tick per level
- **Algae Farm**: +3 organics/tick, +2 food/tick per level

#### Infrastructure Structures
- **Maintenance Bay**: Reduces incident frequency, increases base stability
- **Residential Complex**: +100 habitat (global), +25 worker capacity (this base only)
- **Mess Hall**: -50% food consumption for workers at this base
- **Lab Module**: +1 research/tick per level
- **Signal Relay**: Reduces signal upkeep cost for this base

### Base Outpost Types (Planet-Based)

#### Mining Outpost (Metal-Rich Planets)
- **Primary Output**: 500-2K metal/tick (based on planet quality)
- **Establishment Cost**: 10K M, 5K O, 200F
- **Upkeep**: 50 Food/tick, 20 Fuel/tick (supply runs)

#### Agricultural Outpost (Organic-Rich Planets)
- **Primary Output**: 300-1.5K organics/tick + 200-800 food/tick
- **Establishment Cost**: 8K M, 15K O, 200F
- **Upkeep**: 30 Food/tick, 15 Fuel/tick

#### Research Station (Rare/Exotic Planets)
- **Primary Output**: 50-200 research/tick + rare materials
- **Establishment Cost**: 20K M, 10K O, 5K Research, 500F
- **Upkeep**: 100 Food/tick, 50 Fuel/tick, 10 Rare/tick

#### Fuel Depot (Gas Giants)
- **Primary Output**: 100-500 fuel/tick (alternative fuel source)
- **Establishment Cost**: 50K M, 5K O, 10K Research, 1K F
- **Upkeep**: 200 Power (via Signal network), 50 Rare/tick
- **Unlock**: Tier 3 (Nexus Lv 40)

### Base Upgrade Tiers
Each base can be upgraded through 5 tiers:
1. **Efficiency**: +20% output, -10% upkeep
2. **Automation**: Reduces signal requirement, enables offline production
3. **Expansion**: +50% output, +30% upkeep
4. **Specialization**: Unlocks secondary resource generation
5. **Hub Connection**: Base becomes mini-hub, can support nearby outposts

---

## 6. Expedition Command (Mission + Base Integration)

### Core Structure
Missions and Bases are unified into **Expedition Command** with four integrated components:
- **System Map**: Visual galaxy view showing explored and unexplored systems
- **Active Expeditions**: Missions currently in progress
- **Established Outposts**: Permanent bases (your base management)
- **Expedition Planning**: Configure and launch new expeditions

---

### Player Progression Flow

#### Phase 1: Discovery (Early Game)
1. System Map shows partially revealed sectors with "signal echoes"
2. Player selects unexplored system → Launches **Survey Expedition**
3. **Survey Cost**: Metal + Fuel + Signal range
4. Mission completes → System reveals planet types, resource richness, hazards, traits
5. **Result**: System marked "Surveyed" and available for colonization

#### Phase 2: Colonization (Mid Game)
1. Player selects surveyed system → Views discovered planet list
2. Clicks "Establish Outpost" → One-time **Construction Expedition**
3. **Construction Cost**: Metal + Organics + Fuel + Crew specialist assignment
4. Mission completes → **Base becomes permanent**, appears in Established Outposts
5. **Result**: Base generates passive resources via production structures

#### Phase 3: Operations (Ongoing)
**Established Outposts** tab manages all permanent bases:
- **Fabrication Bay**: Build production structures (Ore Rig, Fuel Cracker, Solar Sail, etc.)
- **Incident Queue**: Random events requiring crew/resources to resolve
- **Field Ops**: Active abilities with cooldowns (Stabilize Grid, Deep Bore)
- **Focus Protocols**: Adjust resource priorities per base
- **Workforce Management**: Assign workers from population pool
- **Supply Runs**: Automatic expeditions costing fuel to maintain base upkeep

---

### Range Tier System (Discovery Gating)

#### Tier 1 (Nexus 1-15): Local Asteroid Belt
- **Accessible Systems**: Debris Field only
- **Example Base Output**: 28 metal, 1 fuel, 1 research/tick
- **No Research Required**: Available from start

#### Tier 2 (Nexus 16-30): Inner System
- **Research Required**: Deep Scan Arrays
- **Accessible Systems**: Ice Moon, Rocky Planet
- **Example Outputs**:
  - Ice Moon: 16 organics, 14 fuel, 8 food/tick
  - Rocky Planet: Balanced resource mix

#### Tier 3 (Nexus 31-50): Outer System
- **Research Required**: Quantum Mapping
- **Accessible Systems**: Lava Rock, Gas Giant
- **Example Outputs**:
  - Lava Rock: 20 metal, 18 organics, 6 research, 4 rare/tick
  - Gas Giant: Fuel Depot (100-500 fuel/tick alternative source)

#### Tier 4 (Nexus 51-60): Distant Systems
- **Research Required**: Wormhole Navigation
- **Infrastructure Required**: Relay Anchors (expensive logistics buildings)
- **Accessible Systems**: Exotic planets with unique resources
- **Special**: Prestige materials, faction-specific bonuses

---

### System Discovery Mechanics

#### Hidden Until Explored
- Galaxy map shows "signal echoes" at range boundaries
- **Survey Requirement**: Signal range + research investment
- Example: "Unknown Signal (Range Tier 2) - Requires: 100 research, 50 fuel"

#### Survey Results (Variable Quality)
- **High-Value Systems**: Multiple planets, rare resources, low hazards
- **Low-Value Systems**: Single planet, common resources, high hazards
- **Mystery Systems**: Anomalies unlocking special research or prestige bonuses
- **Player Choice**: Survey everything (expensive) or focus on high-signal targets

#### System Traits (Randomly Generated)
- **"Metal-Rich Belt"**: +50% metal output from bases here
- **"Geothermal Activity"**: +30% power generation, +10% hazard
- **"Abandoned Relay"**: -50% signal upkeep, bonus research unlock
- **"Contested Space"**: Random raid events (late-game threat)

---

### Expedition Launch Flow

#### Step 1: Select Destination
- System Map → Click unexplored system → "Survey Expedition" queued

#### Step 2: Configure Expedition
- **Distance**: Displays range tier and estimated travel time
- **Operational Stance**:
  - Cautious: -20% speed, -50% hazard
  - Balanced: Standard risk/reward
  - Aggressive: +30% speed, +100% hazard
- **Assign Specialist**: Miner (+metal/rare), Engineer (-hazard), Botanist (+organics)
- **Fuel Boost Slider**: Spend extra fuel to reduce travel time up to 50%
- **Cost Display**: Shows total resource cost before launch

#### Step 3: Track Progress
- **Active Expeditions** (limited slots):
  - Survey: Kepler 7B | 23s remaining | ████████░░ 80%
  - Supply Run: Debris Field | 8s remaining | ███████░░░ 70%
  - Empty slot (unlock with Logistics Hub upgrades)

#### Step 4: Results
- **Survey Complete**: Displays discovered planets + system traits
- **Option**: Establish Outpost at discovered location (triggers construction expedition)

---

### Integration with Existing Systems

#### Missions → Expeditions
- "Debris Field mission" becomes "Debris Field Outpost" (permanent base)
- "Target Locks" becomes "Expedition Queue" (plan multiple missions)
- "Launch Bay" becomes "Expedition Planning" (clearer purpose)
- Operational Stance system (Cautious/Balanced/Aggressive) carries over

#### Bases → Outpost Network
- Fabrication Bay remains (production structure building)
- Incident Queue remains (dynamic events)
- Field Ops remains (active cooldown abilities)
- Site Overview becomes "Outpost Dashboard" (all bases overview)

#### Signal + Range Tiers → Discovery Gates
- **Range Tier** determines which systems are visible on map
- **Signal** resource determines survey expedition cost
- **Deep Scan Arrays** (research) unlocks Range Tier 2
- **Relay Anchors** (late-game building) extends signal to Tier 4 systems

---

## 7. Research Command (Tech Tree)

### Core Principle
- **Hub** = Direct production and conversion (build and upgrade buildings)
- **Tech/Research** = Unlocks capabilities, gates content, provides multipliers

---

### Research Track Organization

#### Core Track (Foundation)
- **Fuel Synthesis** → Unlocks Fuel Refinery building in Hub
- **Advanced Refining** → Unlocks Hydrogen Cracker (alternative fuel path)
- **Fusion Cores** → Unlocks Fusion Refinery (Tier 3 fuel generation)
- **Habitat Protocols** → Unlocks Habitat Module building
- **Life Support Systems** → Unlocks Hydroponics Bay
- **Cryo Storage** → Advanced population management features

#### Safety Track (Risk Mitigation)
- **Hazard Gear** → -25% mission hazard exposure
- **Environmental Suits** → -40% hazard exposure, work in higher hazard zones
- **Containment Fields** → Buildings operate at 110% efficiency in hazard zones
- **Emergency Protocols** → Unlocks Auto-Balancer building
- **Auto-Stabilizers** → Improved Auto-Balancer response time
- **Crisis Management** → Prevents catastrophic resource collapse

#### Logistics Track (Efficiency)
- **Logistics Drones** → +20% mission cargo capacity
- **Cargo Automation** → +40% cargo, reduced supply run costs
- **Quantum Shipping** → Instant resource delivery between bases
- **Signal Relays** → Extends base signal range
- **Deep Scan Arrays** → +1 research/tick, +1 range tier, reveals deep targets
- **Quantum Mapping** → Reveals rare planet types, unlocks Range Tier 3

#### Expansion Track (Content Gates)
- **Planetary Survey** → Unlocks basic outpost establishment
- **Biome Adaptation** → Unlocks Ice Moon and Rocky Planet biomes (Tier 2)
- **Exotic Habitats** → Unlocks Lava Rock and Gas Giant biomes (Tier 3)
- **Basic Outposts** → Core Zone structures available
- **Advanced Colonies** → Industrial and Research Zone structures
- **Megastructures** → Deep Sector structures, prestige content
- **Wormhole Navigation** → Unlocks Range Tier 4 (distant systems)

---

### UI Integration (Hub ↔ Tech Cross-Reference)

#### In Hub Building Cards
```
Hydrogen Cracker [LOCKED]
Requires Research: Advanced Refining (Tier 2)
Cost: 256 research
[View in Research Command →]
```

#### In Tech Tree Nodes
```
Advanced Refining
Cost: 500 research
Track: Core Track | Tier 2

Unlocks:
→ Hydrogen Cracker (Hub building)
→ Alternative fuel conversion path
[Research] [Details]
```

#### In Locked Hub Buildings
- Show required tech with quick jump to Research Command
- Display research cost and progress toward unlock
- Highlight when research becomes available

---

## 8. Consequence and Safety Systems

### Negative Resource States

#### Metal < 0
- **Effect**: Construction halts, all upgrades paused
- **Recovery**: Auto-throttle Fuel Refinery first, then Research Lab
- **No Permanent Loss**: Systems resume when positive

#### Organics < 0
- **Effect**: Organic Cultivators stop producing, crew morale -1%/second
- **Recovery**: Emergency Food → Organics conversion (50:1 ratio)
- **Warning**: Notification at 30 seconds until zero

#### Food < 0
- **Effect**: Crew morale -5%/second, outpost production -50%, population growth stops
- **Emergency Reserve**: 100 food per Food Synthesizer level (prevents immediate collapse)
- **Recovery**: Auto-converts Organics → Food (3:1 ratio)
- **Population Impact**: After reserves depleted, population declines -1 per 60 seconds
- **Never Fatal**: Crew cannot die, only become severely inefficient

#### Fuel < 0
- **Effect**: Outpost production stops, all logistics halted, expeditions paused
- **Recovery**: Catalyst Cracker cooldown removed (emergency use)
- **Warning**: Notification at 60 seconds until zero

#### Power < 0 (CANNOT HAPPEN)
- **System**: Power automatically throttles to maintenance level
- **Maintenance Pool**: Always reserves 10% of max power generation
- **Protection**: Prevents total power failure

#### Habitat (Cannot Go Negative)
- Habitat is spent (invested) to unlock base zones
- Remaining habitat determines population cap
- Cannot be consumed below zero (only allocated)

---

### Auto-Balance Strategies (AI-Driven)

When Auto-Balancer is enabled, system uses these strategies:

#### Conservative Mode
- Maintains 20% buffer on all resources
- Throttles production when resource drops below 20% buffer
- Boosts production when resource exceeds 40% buffer
- **Best For**: Stability-focused players, AFKing

#### Focused Mode
- Player selects priority resource (e.g., "Focus: Fuel")
- Maximizes chosen resource production
- Maintains minimum viable levels on other resources
- **Best For**: Resource-specific goals, bottleneck breaking

#### Growth Mode
- Prioritizes buildings that unlock next Nexus tier
- Calculates optimal upgrade paths automatically
- Suggests next building to upgrade via notification
- **Best For**: Fast progression, new players

#### Balanced Mode
- Maintains resource ratios based on consumption patterns
- Uses 10-minute rolling average to predict needs
- Adapts dynamically to player's building choices
- **Best For**: General gameplay, experienced players

---

## 9. Progression Curve

### Early Game (Nexus 1-10): Learning Phase
- **Focus**: Build one of each production building, understand resource loops
- **Challenge**: Achieve positive fuel production
- **Goal**: Establish first outpost (Debris Field)
- **Time**: 30-60 minutes
- **Key Unlock**: Food Synthesizer, Metal Extractor, Fuel Refinery basics

### Mid Game (Nexus 11-30): Expansion Phase
- **Focus**: First outposts in multiple systems, alternative fuel sources
- **Challenge**: Balance hub investment vs. outpost expansion
- **Goal**: Build 3-5 outposts, unlock Auto-Balancer
- **Time**: 3-8 hours
- **Key Unlocks**: Deep Scan Arrays (Range Tier 2), Hydrogen Cracker, Auto-Balancer, Priority Manager

### Late Game (Nexus 31-60): Optimization Phase
- **Focus**: Prestige preparation, rare materials, faction milestones
- **Challenge**: Maximize efficiency across entire network, complete faction projects
- **Goal**: All Tier 3 buildings to level 10+, unlock Range Tier 4
- **Time**: 15-30 hours
- **Key Unlocks**: Gas Giant Fuel Depots, Quantum Mapping, Wormhole Navigation, prestige preview

### Prestige (Nexus 61+): Meta-Progression
- **Focus**: Permanent bonuses, faction specialization, exotic systems
- **Challenge**: Choose prestige faction, optimize fragment collection
- **Goal**: Multiple prestige loops with different factions
- **Time**: Ongoing
- **Prestige Gate**: Nexus 60 + 1,000 fragments from faction contributions

---

## 10. Building Cost Scaling Framework

### Formula Template
```
Total Cost = Base Cost × (Growth Rate ^ Level) × Tier Multiplier × Resource Type Modifier
```

### Growth Rates by Building Purpose
- **Basic Production**: 1.10-1.12 (slow, always relevant, long-term scaling)
- **Conversion/Processing**: 1.12-1.15 (moderate, tier-gated relief via alternatives)
- **Logistics/QoL**: 1.14-1.18 (expensive, high impact on gameplay experience)
- **Strategic/Research**: 1.15-1.20 (very expensive, unlock-based progression)

### Tier Multipliers (Applied at Tier Gates)
- **Tier 1 → Tier 2**: ×5 cost increase, but new resource types become available
- **Tier 2 → Tier 3**: ×10 cost increase, prestige mechanics introduced
- **Tier 3 → Tier 4**: ×25 cost increase, endgame content unlocked

### Resource Type Modifiers (Multi-Resource Costs)
- **Primary Resource**: 1.0× multiplier (Metal, Organics, Food)
- **Processed Resource**: 0.3× multiplier (Fuel, Research) - cheaper per unit value
- **Strategic Resource**: 0.1× multiplier (Rare, Fragments) - very cheap per unit but scarce

---

## 11. Faction System and Prestige

### Faction-Linked Prestige Bonuses

#### Shepherds of Silence
- **Prestige Bonus**: -8% hazard exposure (stacks with research)
- **Unique Unlock**: "Containment Protocols" - buildings operate at 110% efficiency in hazardous zones
- **Starting Bonus**: +15% research generation
- **Crew Perk**: Crew can work in hazard zones without morale penalty
- **Philosophy**: Contain, Isolate, Endure

#### Broker's Consortium
- **Prestige Bonus**: +10% cargo capacity across all outposts
- **Unique Unlock**: "Trade Routes" - passive resource exchange between player outposts
- **Starting Bonus**: +20% metal/organics from missions
- **Crew Perk**: -30% food consumption (efficient logistics)
- **Philosophy**: Trade, Profit, Expand

#### Archive Keepers
- **Prestige Bonus**: Research persists through prestige (keep 25% of spent research)
- **Unique Unlock**: "Blueprint Library" - reduced construction costs (-15%)
- **Starting Bonus**: All Tier 1 research pre-unlocked
- **Crew Perk**: Specialists train 50% faster (knowledge preservation)
- **Philosophy**: Preserve, Document, Remember

---

### Multi-Week Progression Timeline

#### Week 1 (Nexus 1-30, Tier 1-2)
- Unlock all basic buildings
- Establish 3-5 outposts in local systems
- Complete first faction milestone (e.g., Stability Lattice project)
- **Fragment Collection**: ~200-400 fragments

#### Week 2 (Nexus 31-50, Tier 3 Unlock)
- Alternative fuel paths unlock (Hydrogen Cracker, Gas Giant Fuel Depots)
- Second faction milestone unlocks shared faction projects
- Access Tier 2 mission biomes (Ice Moon, Lava Rock)
- **Fragment Collection**: ~400-700 fragments

#### Week 3+ (Nexus 51-60, Prestige Preparation)
- Unlock prestige preview: "If you prestige now, you'll gain X points"
- Final faction milestone: Choose prestige faction (locks specialization)
- "Ascension Countdown" UI shows estimated prestige readiness
- **Fragment Collection**: 700-1,000 fragments (prestige threshold)

---

### Fragment Ledger System (Prestige Currency)

#### Fragment Sources
- **Surveying new systems**: +10-50 fragments (based on system rarity)
- **Establishing outposts**: +25-100 fragments (based on planet type)
- **Faction project contributions**: +50-200 fragments (based on contribution tier)
- **Milestone completion**: +100-500 fragments (major achievements)
- **Competitive rewards**: Top contributors earn bonus fragments weekly

#### Prestige Requirements
- **Threshold**: Nexus Level 60 + 1,000 fragments collected
- **Timing Control**: Player chooses when to prestige (can delay for optimization)
- **Fragment Checkpoints**: Global thresholds (e.g., "First Whisper at 25%") create shared milestones

#### Prestige Point Calculation
```
Prestige Points = (Nexus Level - 60) × Average Outpost Level × Unique Systems Discovered / 10
```

---

### Prestige Upgrades (Permanent Bonuses)

#### Production Category
- **Resource Boost**: +5% to chosen resource per point (stackable)
- **Worker Efficiency**: Workers provide +7% per worker instead of +5% (15 points)
- **Population Growth**: +50% growth rate (5 points)

#### Economic Category
- **Cost Reduction**: -3% all building costs per point (stackable)
- **Habitat Efficiency**: Zone unlocks cost -25% habitat (10 points)
- **Starting Resources**: Begin new run with 10% of prestiged resources (8 points)

#### Progression Category
- **Unlock Persistence**: Keep Tier 2 building unlocks (12 points)
- **Research Persistence**: Keep 25% of spent research (faction-specific)
- **Auto-Features**: Start with Auto-Balancer and Priority Manager unlocked (10 points)

#### Content Category
- **Zone Persistence**: Unlocked base zones persist through prestige (one-time investment feel)
- **Blueprint Access**: Reduced construction costs via Blueprint Library (faction-specific)
- **Exotic Discovery**: New systems unlock at higher prestige tiers

---

### Prestige Tiers
- **Tier 1 Prestige** (Nexus 60-79): Basic bonuses, 1-5 prestige points
- **Tier 2 Prestige** (Nexus 80-99): Advanced bonuses, 5-15 prestige points
- **Tier 3 Prestige** (Nexus 100+): Meta bonuses, 15-50 prestige points

#### Faction Project Prestige Bonuses
- **Projects Completed Pre-Prestige**: Each Tier 4 project completion grants +1 prestige point
- **Leaderboard History**: Top 10 finishes in any season grant +2 prestige points
- **Veteran Bonus**: Players prestiging with 5+ project contributions start with +5% fragment generation

---

## 12. Future Expansion Hooks

### New Building Types (Post-Launch Content)
- **Quantum Forge**: Converts Rare Materials → any basic resource at high efficiency
- **Signal Amplifier**: Extends range, reduces outpost signal upkeep
- **Defense Platform**: Protects outposts from random events, raid mechanics
- **Trade Hub**: Enables resource trading with other players (multiplayer feature)

### New Mechanics (Long-Term Development)
- **Fleet Management**: Ships that explore, defend, and trade autonomously
- **Advanced Crew Skills**: Specialists unlock unique abilities via training paths
- **Dynamic Planet Events**: Random modifiers (ion storms, discoveries, alien encounters)
- **Multiplayer Integration**: Shared faction projects, competitive leaderboards, resource trading
- **Raid System**: Defend outposts from NPC or player threats
- **Galactic Market**: Dynamic resource pricing, supply/demand economy

### Quality of Life Features
- **Resource Forecast Overlay**: Shows time-to-zero per resource with Auto-Balancer predictions
- **Expedition Queue Scheduler**: Chain survey → construction expeditions with fuel budgeting
- **Research Alerts**: Highlight Hub buildings unlocked by pending research (one-click jump)
- **Blueprint Favorites**: Save building upgrade paths for quick access
- **Multi-Base Commands**: Apply workforce or focus changes to multiple bases simultaneously
- **Faction Contribution Tracker**: Widget showing your contribution rank + progress toward personal milestones
- **Seasonal Event Calendar**: View upcoming faction events, project deadlines, prestige windows

---

## Design Philosophy Summary

This framework creates:

1. **Meaningful Choices**: Every resource has multiple paths, no single "correct" strategy
2. **Recovery Options**: Negative states are recoverable, never permanently punishing
3. **Long-Term Goals**: Clear progression from local → system → galaxy → prestige
4. **Strategic Depth**: Population, crew, habitat, and bases interconnect meaningfully
5. **Respectful Difficulty**: Challenging without being frustrating, safety nets prevent catastrophe
6. **Faction Identity**: Prestige tied to faction creates replayability and community engagement
7. **Unified Systems**: Missions/bases, tech/hub, crew/population all reinforce each other

**Core Loop**: Explore systems → Establish outposts → Assign crew → Optimize production → Research upgrades → Contribute to faction → Collect fragments → Prestige with bonuses → Repeat with new strategy

**Multiplayer Loop**: Contribute resources → Climb leaderboards → Complete faction projects → Earn competitive rewards → Unlock faction-wide buffs → Prestige with faction bonuses → Join seasonal events → Build faction legacy

---

**End of Manifesto**