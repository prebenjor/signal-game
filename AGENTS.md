# Stellar Command Framework (Refined Manifesto)

**Core Purpose:** This document enforces deliberate pacing, meaningful progression, and interface clarity. All development must align with these principles.

---

## DESIGN PILLARS (ENFORCE THESE)

### 1. Deliberate Pacing - NO RUSHING
- **0-3 hours:** Learn one system at a time, master basics
- **3-12 hours:** Gradual expansion with clear milestones  
- **12-50 hours:** Optimization, faction engagement, prestige prep
- **Each tier must feel substantial** - 5-10 hours minimum per major tier

### 2. Meaningful Upgrades - QUALITY OVER QUANTITY
- **Every 5 levels:** Unlock new capability or significant bonus
- **Tier gates (10/20/30):** Transform gameplay, not just bigger numbers
- **Cost scaling enforces patience:** 1.15-1.20 growth rates minimum
- **Avoid incremental busywork:** Each upgrade should excite players

### 3. Interface Clarity - PROGRESSIVE DISCLOSURE
- **Start minimal:** Show only 2-3 buildings initially
- **Unlock organically:** New tabs/features appear when needed
- **Visual hierarchy:** Guide attention to current priorities
- **No overwhelming:** Hide complexity until player is ready

---

## RESOURCE HIERARCHY (STRICTLY ENFORCE)

### Tier 0: Foundation (Never Negative)
```
Power    → Drives conversions, auto-throttles to 10% reserve
Signal   → Enables range, costs increase with distance  
Morale   → 50-150% efficiency multiplier from conditions
```

### Tier 1: Primary (Can Go Negative)
```
Metal     → Construction, throttles converters if negative
Organics  → Life support, emergency food conversion at 50:1
Food      → Population sustenance, emergency reserves prevent collapse
Habitat   → Population cap, spent to unlock base zones (investment)
```

### Tier 2: Processed (Conversion Required)
```
Fuel      → 1 fuel = 2 Metal + 1 Organic + 5 Power
Research  → 1 research = 100M OR 50O OR 10F (any combo)
Rare      → Tier 3 unlock only, exotic planet processing
```

### Tier 3: Strategic (Meta-Progression)
```
Fragments → Prestige currency, 1,000 threshold + Nexus 60
Intel     → System discovery, blueprint unlocks
```

---

## UI PROGRESSION (ENFORCE STAGES)

### Stage 1: Tutorial (Nexus 1-5) - 30-60 minutes

**Screen Layout:**
```
┌─────────────────────────────────────┐
│ Resources (Top):                    │
│ 🔩 Metal: 450  🍎 Food: 230        │
│ ⚡ Power: 800  😊 Morale: 100%     │
├─────────────────────────────────────┤
│ COMMAND NEXUS - Level 1             │
│ [Upgrade to Level 2: 500 Metal]     │
├─────────────────────────────────────┤
│ Available Buildings (2):            │
│                                     │
│ ┌──────────┐  ┌──────────┐         │
│ │ Metal    │  │ Food     │         │
│ │ Extract  │  │ Synth    │         │
│ │ +50/tick │  │ +40/tick │         │
│ │ [Build]  │  │ [Build]  │         │
│ └──────────┘  └──────────┘         │
│                                     │
│ 🔒 More unlock at Nexus Level 3    │
└─────────────────────────────────────┘
```

**Enforced Rules:**
- Only Command Nexus + 2 production buildings visible
- Single "Upgrade" button on Nexus (no confusion)
- No tabs, no expeditions, no research yet
- Clear messaging about future unlocks
- Tutorial forces: Build Extractor → Build Synthesizer → Upgrade Nexus

---

### Stage 2: Foundation (Nexus 6-15) - 1-3 hours

**New Elements:**
```
Resources add: 🌿 Organics: 340
Buildings unlock: Power Generator, Organic Cultivator
Nexus Level 10 unlocks: EXPEDITIONS tab
```

**First Tab Appears:**
```
[🏠 Hub] [🚀 Expeditions - NEW!]
```

**Expedition Introduction (Level 10):**
```
┌─────────────────────────────────────┐
│ EXPEDITION COMMAND - Tutorial       │
│                                     │
│ New systems detected in range!      │
│                                     │
│ ┌─────────────────────────────┐    │
│ │ Debris Field Alpha          │    │
│ │ Distance: Close (30s)       │    │
│ │ Resources: Metal-rich       │    │
│ │ Cost: 200 Metal, 50 Fuel    │    │
│ │                             │    │
│ │ [Launch Survey Mission]     │    │
│ └─────────────────────────────┘    │
│                                     │
│ Complete this to unlock outposts!   │
└─────────────────────────────────────┘
```

**Enforced Rules:**
- Maximum 5 buildings in Hub tab
- Expeditions unlocked ONLY after tutorial trigger
- First mission is guided, shows basic mechanics
- No research tree yet (too early)

---

### Stage 3: Expansion (Nexus 16-30) - 4-10 hours

**Resource Bar Expands:**
```
🔩 Metal: 12.3K (+450/t)   ⛽ Fuel: 234 (-12/t)
🌿 Org: 5.6K (+280/t)      ⚡ Power: 18K (60% used)
🍎 Food: 8.9K (+120/t)     😊 Morale: 95%
🏠 Pop: 145/300
```

**Tab Structure:**
```
[🏠 Hub] [🚀 Expeditions] [🔬 Research - NEW!]
```

**Hub Organization (Filters Appear):**
```
┌─────────────────────────────────────┐
│ HUB COMMAND                         │
│                                     │
│ [Production] [Conversion] [All ▼]   │
│                                     │
│ ┌────────────────────────────┐     │
│ │ Metal Extractor - Level 8  │     │
│ │ Output: +400 metal/tick    │     │
│ │ Cost: 1,245 Metal          │     │
│ │ [Upgrade to Level 9]       │     │
│ │ Next: +450 metal/tick      │     │
│ └────────────────────────────┘     │
│                                     │
│ ┌────────────────────────────┐     │
│ │ Fuel Refinery - Level 3    │     │
│ │ Output: +3 fuel/tick       │     │
│ │ Cost: -6M, -3O, -15P       │     │
│ │ [Upgrade: 875M, 220O]      │     │
│ │ Next: +4 fuel/tick         │     │
│ └────────────────────────────┘     │
│                                     │
│ (8 total buildings)                 │
└─────────────────────────────────────┘
```

**Research Tree (Simplified Start):**
```
┌─────────────────────────────────────┐
│ RESEARCH COMMAND                    │
│ Available: 450 Research             │
│                                     │
│ Core Track:                         │
│ ✓ Fuel Synthesis (Completed)       │
│ ➤ Advanced Refining [500 R]        │
│   Unlocks: Hydrogen Cracker         │
│   Status: 90% affordable            │
│   [Research Now - 50R short]        │
│                                     │
│ 🔒 Fusion Cores [2,500 R]          │
│    Requires: Advanced Refining      │
│                                     │
│ Expansion Track:                    │
│ ✓ Planetary Survey (Completed)     │
│ 🔒 Deep Scan Arrays [800 R]        │
│    Unlocks: Range Tier 2 systems    │
│                                     │
│ [Show All Tracks]                   │
└─────────────────────────────────────┘
```

**Outpost Dashboard:**
```
┌─────────────────────────────────────┐
│ ACTIVE OUTPOSTS (2/4 slots)         │
│                                     │
│ Debris Field Alpha                  │
│ 🔩 +280 Metal/tick  [Manage]       │
│                                     │
│ Ice Moon Beta                       │
│ 🌿 +160 Organics/tick  [Manage]    │
│                                     │
│ [Establish New Outpost]             │
│ 🔒 More slots at Nexus 25           │
└─────────────────────────────────────┘
```

**Enforced Rules:**
- Research unlocks at Nexus 15 with gentle tutorial
- Maximum 10 buildings visible in Hub
- Outposts limited to 2-4 until Nexus 25
- No faction content yet (too early)
- Building filters appear when >6 buildings owned

---

### Stage 4: Optimization (Nexus 31-50) - 12-30 hours

**Full Feature Set Emerges:**
```
[🏠 Hub] [🚀 Expeditions] [🔬 Research] [👥 Faction - NEW!] [⚙️ Settings]
```

**Advanced Resource Bar:**
```
Primary:  🔩 142K (+850/t)  🌿 56K (+420/t)  🍎 89K (+120/t)
Convert:  ⛽ 2.3K (-45/t)   🔬 1.2K          ⚡ 200K (85%)
Strategic: 💎 34 Rare       ✨ 487/1000 Fragments
People:   🏠 450/600 pop    😊 95% morale
```

**Hub View (Full Complexity):**
```
┌─────────────────────────────────────┐
│ HUB COMMAND - 18 Buildings          │
│                                     │
│ [Production ▼] [Sort: Level ▼]      │
│ [Quick: Upgradeable Only ☑]        │
│                                     │
│ ⬆️ READY TO UPGRADE (3):            │
│                                     │
│ Metal Extractor Lv 15 → 16          │
│ Cost: 15.4K Metal  [UPGRADE]        │
│ +750 → +800 /tick                   │
│                                     │
│ Fuel Refinery Lv 10 → 11            │
│ Cost: 6.2K M, 1.6K O  [UPGRADE]     │
│ MILESTONE: Unlocks Efficiency Mode  │
│                                     │
│ Hydroponics Bay Lv 5 → 6            │
│ Cost: 1.4K M, 1.0K O  [UPGRADE]     │
│ +100 → +120 food/tick               │
│                                     │
│ ───────────────────────────────     │
│                                     │
│ 📋 ALL BUILDINGS (collapsed):       │
│ [Expand List ▼]                     │
└─────────────────────────────────────┘
```

**Faction Integration:**
```
┌─────────────────────────────────────┐
│ FACTION: Shepherds of Silence       │
│ "Contain, Isolate, Endure"          │
│                                     │
│ Active Project: Stability Lattice   │
│ Progress: ▓▓▓▓▓▓▓░░░░░ 494K/1.28M  │
│                                     │
│ Your Stats:                         │
│ • Contributed: 12.5K Metal          │
│ • Fragments Earned: 187             │
│ • Rank: #42 of 156                  │
│                                     │
│ Next Tier (50%): +10% production    │
│ Your Impact: 146K more needed       │
│                                     │
│ [Contribute] [Leaderboard] [Info]   │
└─────────────────────────────────────┘
```

**Outpost Network:**
```
┌─────────────────────────────────────┐
│ OUTPOST NETWORK (5/8 slots)         │
│                                     │
│ [Overview] [Individual] [Analytics] │
│                                     │
│ Total Output Summary:               │
│ 🔩 +1,240 Metal/tick               │
│ 🌿 +680 Organics/tick              │
│ ⛽ +145 Fuel/tick                   │
│ 💎 +18 Rare/tick                    │
│                                     │
│ Top Producers:                      │
│ 1. Lava Rock Delta    (+480M)      │
│ 2. Gas Giant Eps      (+95F)       │
│ 3. Ice Moon Beta      (+340O)      │
│                                     │
│ [Manage All] [Establish New]        │
└─────────────────────────────────────┘
```

**Enforced Rules:**
- Faction tab unlocks at Nexus 30
- Hub shows "Ready to Upgrade" section prominently
- Filters become essential (20+ buildings possible)
- Outpost analytics help optimize network
- Settings tab provides auto-management tools

---

### Stage 5: Prestige (Nexus 60+)

**Prestige Preview Panel:**
```
┌─────────────────────────────────────┐
│ ✨ ASCENSION AVAILABLE              │
│                                     │
│ Requirements:                       │
│ ✓ Nexus Level 60                   │
│ ✓ 1,000 Fragments (1,247/1000)     │
│ ✓ Faction Contributions (3/3)      │
│                                     │
│ Prestige Calculation:               │
│ • Nexus: 63 levels → 3 pts         │
│ • Outposts: Avg Lv 14 → 2 pts      │
│ • Discovery: 12 systems → 1 pt     │
│ • Faction: Top 50 → +2 pts         │
│ ─────────────────────               │
│ TOTAL: 8 Prestige Points            │
│                                     │
│ Shepherds Bonus:                    │
│ • -8% hazard (permanent)            │
│ • +15% research start               │
│ • Containment Protocols             │
│                                     │
│ [View Upgrades] [PRESTIGE NOW]      │
│                                     │
│ ⚠️ This resets progress but grants  │
│    permanent bonuses for next run   │
└─────────────────────────────────────┘
```

---

## BUILDING PROGRESSION (ENFORCE MILESTONES)

### Command Nexus - Central Hub

**Philosophy:** Gates all progression, unlocks occur every 10 levels

**Cost Scaling:**
```
Base: 500 Metal
Growth: 1.18 per level (expensive by design)

Level 1→2:    590 Metal
Level 5→6:    1,144 Metal
Level 10→11:  2,558 Metal (TIER GATE)
Level 15→16:  5,858 Metal
Level 20→21:  13,411 Metal (TIER GATE)
Level 30→31:  68,717 Metal (TIER GATE)
```

**Tier Unlocks (ENFORCE THESE GATES):**

| Level | Tier | Major Unlock | Time Gate |
|-------|------|--------------|-----------|
| 1-10 | Foundation | Basic production buildings | 1-2 hrs |
| 11-20 | Expansion | Fuel Refinery, Expeditions | 2-4 hrs |
| 21-30 | Automation | Auto-Balancer, Faction | 4-8 hrs |
| 31-40 | Deep Space | Rare Materials, Gas Giants | 8-15 hrs |
| 41-50 | Mastery | Multi-base commands | 15-25 hrs |
| 51-60 | Ascension | Prestige preview, exotics | 25-40 hrs |

**Level Milestone Rewards:**
- **Level 10:** +5 structure slots, unlock Expeditions
- **Level 20:** +5 structure slots, unlock Research Command
- **Level 30:** +5 structure slots, unlock Faction tab
- **Level 40:** +5 structure slots, unlock Rare Materials
- **Level 50:** +5 structure slots, advanced automation
- **Level 60:** +5 structure slots, prestige eligibility

**ENFORCE:** Players cannot rush Nexus levels. Cost scaling prevents skipping tiers.

---

### Production Buildings - Meaningful Upgrades

**Core Rule:** Every 5 levels unlocks new capability, not just +X output

---

#### Metal Extractor

**Cost:** 100 Metal × 1.15^level (slow growth, always relevant)

**Milestone Unlocks:**

| Level | Output/tick | Special Unlock |
|-------|-------------|----------------|
| 1 | +50 | Basic extraction |
| 5 | +250 | **Efficiency:** -20% power cost |
| 10 | +500 | **Deep Mining:** 10% chance +100 bonus |
| 15 | +750 | **Auto-Survey:** Passive +1 metal/tick/level |
| 20 | +1,000 | **Rare Chance:** 50% chance for rare materials |
| 25 | +1,250 | **Network Sync:** +5% per other extractor level |
| 30 | +1,500 | **Mastery:** Alternative metal sources in missions |

**Visual Changes:**
- Levels 1-9: Small drill platform
- Levels 10-19: Expanded rig with multiple drills
- Levels 20-29: Industrial complex
- Level 30+: Massive operation with conveyors

**ENFORCE:** Players must hit level 10 before Deep Mining unlocks. This creates meaningful progression.

---

#### Fuel Refinery

**Cost:** 800 Metal, 200 Organics × 1.14^level

**Consumption:** 1 fuel/tick = 2 Metal + 1 Organic + 5 Power (per level)

**Milestone Unlocks:**

| Level | Output/tick | Special Unlock |
|-------|-------------|----------------|
| 1 | +1 | Basic refining (-2M, -1O, -5P/tick) |
| 5 | +5 | **Efficiency:** Costs become -1.5M, -0.8O, -4P |
| 10 | +10 | **Catalyst Mode:** Toggle 2x speed, 3x cost |
| 15 | +15 | **Recycling:** Returns 10% of metal/organics |
| 20 | +20 | **Self-Sustaining:** Can use fuel to boost itself |
| 25 | +25 | **Network:** -10% cost if Hydrogen Cracker exists |
| 30 | +30 | **Mastery:** Unlocks Fusion Refinery research |

**ENFORCE:** Level 20 is game-changing. Players who reach it can create positive feedback loops.

---

#### Hydroponics Bay

**Cost:** 800 Metal, 600 Organics × 1.14^level

**Dual Output:** Food + Habitat

**Milestone Unlocks:**

| Level | Food/tick | Habitat/level | Special Unlock |
|-------|-----------|---------------|----------------|
| 1 | +20 | +10 | Basic cultivation |
| 5 | +100 | +50 | **Bio-Synergy:** +25% if adjacent to Cultivator |
| 10 | +200 | +100 | **Growth Boost:** +50% population growth |
| 15 | +300 | +150 | **Purification:** +10% crew morale |
| 20 | +400 | +200 | **Vertical Farming:** Double habitat output |
| 25 | +500 | +250 | **Ecosystem:** Generates +5 organics/tick |
| 30 | +600 | +300 | **Mastery:** Food costs reduced 30% globally |

**ENFORCE:** Hydroponics becomes centerpiece of mid-game strategy at level 10+

---

## EXPEDITION SYSTEM (ENFORCE DISCOVERY GATES)

### Range Tier Gating (STRICTLY ENFORCE)

**Tier 1: Local Belt (Nexus 1-15)**
- **Systems:** Debris Field only
- **Research:** None required
- **Example Output:** 280 Metal, 15 Fuel/tick
- **Purpose:** Learn expedition mechanics

**Tier 2: Inner System (Nexus 16-30)**
- **Systems:** Ice Moon, Rocky Planet
- **Research Required:** Deep Scan Arrays (800 research)
- **Example Output:** Ice Moon (340 Organics, 95 Fuel/tick)
- **Purpose:** Expand resource diversity

**Tier 3: Outer System (Nexus 31-50)**
- **Systems:** Lava Rock, Gas Giant
- **Research Required:** Quantum Mapping (2,500 research)
- **Example Output:** Gas Giant (450 Fuel/tick alternative source)
- **Purpose:** Unlock alternative production paths

**Tier 4: Distant Systems (Nexus 51-60)**
- **Systems:** Exotic planets with unique bonuses
- **Research Required:** Wormhole Navigation (8,000 research)
- **Infrastructure:** Relay Anchors (expensive building)
- **Example Output:** Prestige materials, faction bonuses
- **Purpose:** Prepare for prestige

**ENFORCE:** Players cannot access Tier 2 systems until:
1. Nexus Level 16+
2. Deep Scan Arrays researched
3. Sufficient fuel reserves

No exceptions. This prevents rushing.

---

## PROGRESSION PACING (TIME GATES)

### Early Game (0-3 hours) - LEARNING
**Nexus 1-10**

**Enforced Flow:**
1. Build Metal Extractor (learn production)
2. Build Food Synthesizer (learn sustenance)
3. Upgrade Nexus to 5 (gated by costs)
4. Build Power Generator (learn energy)
5. Unlock Expeditions at Nexus 10
6. Complete first Survey mission (tutorial)
7. Establish first outpost (Debris Field)

**Resource Gates:**
- Metal bottleneck forces upgrades, not new buildings
- Food becomes concern around 100 population
- Power limits fuel production initially

**Time:** 2-3 hours if played actively

---

### Mid Game (3-12 hours) - EXPANSION
**Nexus 11-30**

**Enforced Flow:**
1. Build Fuel Refinery (learn conversion)
2. Establish 2-3 outposts (learn management)
3. Unlock Research at Nexus 15
4. Research Deep Scan Arrays (Tier 2 access)
5. Build Auto-Balancer at Nexus 20
6. Establish Tier 2 outposts (Ice Moon, Rocky Planet)
7. Unlock Faction at Nexus 30

**Resource Gates:**
- Fuel becomes primary constraint (forces refinery upgrades)
- Research accumulation is slow (limits tech rushing)
- Habitat investment creates strategic choices

**Time:** 8-10 hours of active play

---

### Late Game (12-50 hours) - OPTIMIZATION
**Nexus 31-60**

**Enforced Flow:**
1. Research Quantum Mapping (unlock Tier 3)
2. Establish Gas Giant fuel depot (alternative source)
3. Build Rare Material Processor
4. Contribute to faction projects (fragment collection)
5. Optimize outpost network (workforce distribution)
6. Research Wormhole Navigation (unlock Tier 4)
7. Collect 1,000 fragments for prestige

**Resource Gates:**
- Rare materials gate Deep Sector structures
- Fragments require sustained faction engagement
- Research costs become substantial (8K+ per tech)

**Time:** 30-40 hours to reach prestige readiness

---

## COST SCALING ENFORCEMENT

### Building Cost Formula
```
Total Cost = Base × (Growth Rate ^ Level) × Tier Multiplier
```

### Growth Rates (MINIMUM VALUES)
- **Basic Production:** 1.15 (slow, steady progression)
- **Conversion Buildings:** 1.14 (moderate scaling)
- **Logistics/QoL:** 1.16 (expensive, high impact)
- **Strategic Buildings:** 1.18 (very expensive gates)

### Tier Multipliers (Applied at Gates)
- **Tier 1 → Tier 2 (Nexus 20):** ×5 cost increase
- **Tier 2 → Tier 3 (Nexus 30):** ×10 cost increase
- **Tier 3 → Tier 4 (Nexus 40):** ×25 cost increase

**ENFORCE:** Never reduce growth rates below these minimums. Slower pacing is intentional.

---

## FACTION SYSTEM (ENFORCE ENGAGEMENT)

### Fragment Collection (Prestige Currency)

**Sources (ONLY THESE):**
- Survey new system: +10-50 fragments (based on rarity)
- Establish outpost: +25-100 fragments (based on planet type)
- Faction project contribution: +50-200 fragments (based on tier)
- Milestone achievements: +100-500 fragments (major accomplishments)
- Leaderboard rewards: +250-500 fragments (top contributors weekly)

**Prestige Requirements (ENFORCE ALL THREE):**
1. Nexus Level 60+
2. 1,000 Fragments collected
3. Contributed to 3+ faction projects

**ENFORCE:** Players must engage with multiplayer systems to prestige. No solo-only route.

---

### Faction Project Structure

**Tier Gates (Applied to All Projects):**

| Tier | Progress | Threshold | Reward | Time |
|------|----------|-----------|--------|------|
| 1/4 | 0-25% | 320K resources | +5% production faction-wide | 1 week |
| 2/4 | 25-50% | 640K resources | +10% production, next project unlocks | 1 week |
| 3/4 | 50-75% | 960K resources | +15% production, special research | 1 week |
| 4/4 | 75-100% | 1.28M resources | +25% production, prestige boost | 1 week |

**ENFORCE:** Projects scale with faction size:
- Small faction (<50 players): ×0.5 requirements
- Medium (50-200): ×1.0 requirements
- Large (200-500): ×2.0 requirements
- Mega (500+): ×5.0 requirements

---

## SAFETY SYSTEMS (PREVENT CATASTROPHIC FAILURE)

### Negative Resource Handling

**Metal < 0:**
- Effect: Construction paused, throttle Fuel Refinery first
- Recovery: Auto-resumes when positive
- No permanent damage

**Organics < 0:**
- Effect: Cultivators stop, morale -1%/sec
- Recovery: Emergency Food→Organics conversion (50:1)
- Warning: 30 seconds before zero

**Food < 0:**
- Effect: Morale -5%/sec, production -50%, population decline
- Safety Net: 100 food reserve per Food Synthesizer level
- Recovery: Auto-converts Organics→Food (3:1)
- After reserves: Population -1 per 60 seconds (slow death)

**Fuel < 0:**
- Effect: All expeditions halt, outposts stop producing
- Recovery: Catalyst Cracker cooldown removed (emergency use)
- Warning: 60 seconds before zero

**Power < 0 (CANNOT HAPPEN):**
- System: Auto-throttles to 10% maintenance reserve
- Protection: Prevents total blackout

**ENFORCE:** Negative states are recoverable. No game-over scenarios.

---

## IMPLEMENTATION CHECKLIST

### Phase 1: UI Stages (MUST IMPLEMENT)
- [ ] Tutorial screen with only 2 buildings
- [ ] Expeditions tab unlocks at Nexus 10 (not before)
- [ ] Research tab unlocks at Nexus 15 (not before)
- [ ] Faction tab unlocks at Nexus 30 (not before)
- [ ] Progressive resource bar (adds elements as unlocked)
- [ ] Filters appear when >6 buildings owned
- [ ] "Ready to Upgrade" section highlights affordable upgrades

### Phase 2: Building Milestones (MUST IMPLEMENT)
- [ ] Every building has 5-level milestone unlocks
- [ ] Visual model changes at levels 10, 20, 30
- [ ] Tier gates provide meaningful bonuses, not just scaling
- [ ] Cost formula enforces 1.15+ growth rates minimum
- [ ] Tooltips explain what unlocks at next milestone

### Phase 3: Pacing Gates (MUST IMPLEMENT)
- [ ] Nexus level gates strictly enforce tier unlocks
- [ ] Research requirements block Tier 2+ systems
- [ ] Fragment collection requires 3+ faction contributions
- [ ] Time gates prevent rushing (estimated play times enforced)
- [ ] Alternative paths unlock at higher tiers (Gas Giant fuel at Tier 3)

### Phase 4: Safety Systems (MUST IMPLEMENT)
- [ ] Emergency reserves prevent instant population collapse
- [ ] Auto-throttling on power prevents total blackout
- [ ] Recovery mechanisms for all negative states
- [ ] Warning notifications 30-60s before zero
- [ ] Auto-Balancer (optional building) manages resources

---

## FINAL ENFORCEMENT RULES

### DO NOT:
- ❌ Allow players to skip tier gates
- ❌ Reduce cost scaling below 1.15 growth
- ❌ Show all features at once in UI
- ❌ Make every upgrade feel incremental
- ❌ Allow prestige without faction engagement
- ❌ Create instant game-over scenarios

### ALWAYS:
- ✅ Enforce Nexus level gates for unlocks
- ✅ Make milestones (5, 10, 15, 20 levels) transformative
- ✅ Hide UI complexity until organically needed
- ✅ Provide recovery options for mistakes
- ✅ Scale difficulty to maintain 40+ hour journey
- ✅ Create meaningful choices between upgrade paths

---

**END OF MANIFESTO**

This framework is non-negotiable. All features must align with deliberate pacing, meaningful progression, and interface clarity.