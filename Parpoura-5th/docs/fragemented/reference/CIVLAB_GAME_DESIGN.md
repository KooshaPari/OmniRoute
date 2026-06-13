# CivLab: Game Design Document

**Date:** 2026-02-21
**Status:** ACTIVE
**Owner:** CIV Game Design Team
**Audience:** Game designers, developers, players, modders

---

## Executive Summary

CivLab is a **deep civilization simulation** that functions simultaneously as:

1. **A Research Sandbox**: Deterministic, policy-driven, supports parameterized runs and metrics export for academic/scientific study
2. **A Real-Time Strategy Game**: Playable, engaging, with strategic depth comparable to Victoria 3 + Dwarf Fortress + OpenTTY
3. **A Modding Platform**: Headless core architecture supports multiple client frontends (web, desktop, TUI) and extensible scenario/policy design

This document details the complete game design: core mechanics, economy systems, war/diplomacy, modding API, and victory conditions.

---

## Part 1: Game Concept & Inspiration

### 1.1 Inspirations & Key Differentiators

| Inspiration | Why | CivLab Differentiator |
|---|---|---|
| **Dwarf Fortress** | Emergent depth, rich simulation, failure modes | Clean protocol interface; detailed Joule energy economy adds physics realism |
| **Victoria 3** | Political economy, pop simulation, ideology | Per-citizen lifecycle tracking; shadow networks for covert ops |
| **Crusader Kings 3** | Actor AI, dynasty mechanics, intrigue | Institutional memory persists across rulers; institutional allegiance > personal loyalty |
| **Factorio** | Production graphs, optimization puzzles | Applied to energy/resource networks; climate disruption introduces chaos |
| **Terra Nil** | Ecosystem restoration, environmental care | Full climate cycle (carbon budget, renewable energy shifts, disasters) |
| **OpenTTY** | Colony sim, emergent stories, replayability | Determinism guarantees replayability; Joule economy ties logistics to physics |
| **Influence** | Covert operations, information control | Institutional espionage; policy misdirection; selective information release |

### 1.2 Core Design Pillars

**Pillar 1: Determinism & Replay**
- Every simulation run is fully reproducible from seed + policy bundle
- Event log captures all stochastic decisions (RNG rolls pinned to event IDs)
- Supports "research mode" (run same scenario 1000x, export statistics)
- Enables "replay debugging": watch the exact sequence of events that led to collapse

**Pillar 2: Energy Physics**
- All resource flows denominated in Joules (CIV-0102)
- Climate system tied directly to carbon production (energy mix determines GHG)
- Renewable generation variability creates demand-matching challenges
- Conservation law: energy_in = energy_consumed + energy_stored + energy_wasted

**Pillar 3: Emergent Complexity from Simple Rules**
- No scripted events or predetermined disaster scenarios
- Complex behaviors (civil war, famine, tech breakthroughs) emerge from policy decisions × economic reality
- Population dynamics (birth/death/migration) driven by happiness, healthcare, living space
- Institutional competition creates natural alliance networks without explicit diplomacy scripting

**Pillar 4: Multi-Layer Play**
- **Strategic layer (zoom 1)**: Nation-scale; diplomatic, resource allocation, war declaration
- **Tactical layer (zoom 2)**: City/province scale; production chains, military units, city planning
- **Simulation layer (zoom 3, research mode)**: Individual citizen; watch happiness flow through families; trace information spread through social networks

**Pillar 5: Modding & Extensibility**
- Headless core publishes all state as deterministic events
- Clients attach via standardized protocol (WebSocket + JSON schema)
- Scenarios defined as YAML bundles: map seed, starting institutions, policy packs, victory conditions
- Extensibility points: custom resource types, custom policies, custom objectives

---

## Part 2: Core Gameplay Loop

### 2.1 The Three-Zoom Architecture

**Zoom 1: Strategic (Nation Level)**

```
Time horizon: Quarters (25 ticks = 1 year, 1 tick ≈ 2 weeks)

Player actions per quarter:
  - Declare war / sign treaties
  - Adjust nation-level tax/tariff rates
  - Hire/fire government officials
  - Allocate research budget to tech tree
  - Set immigration policy
  - Manage treasury reserves
  - Establish/dissolve institutions

Key metrics visible:
  - Total GDP, per-capita wealth
  - Stability index (0-100, collapse at <10)
  - Ideological alignment (democracy, autocracy, theocracy)
  - Military strength (army composition, readiness)
  - Population (total, by class/ethnicity/religion)
  - Energy reserves (current, days-of-supply)
  - Treasury (cash, debt, credit rating)

Victory conditions measured at this level.
```

**Zoom 2: Tactical (City/Region Level)**

```
Time horizon: Months (5-10 ticks = 1 month decision)

Player actions per month (per city):
  - Assign population to work (farms, factories, mines, services)
  - Build/destroy buildings (housing, factories, barracks, temples)
  - Levy taxes locally
  - Manage local security (militia recruitment, crime suppression)
  - Negotiate local peace (if city under siege)

Key metrics visible (per city):
  - Population (by class, employment, happiness)
  - Production chains (food, clothes, weapons, luxury goods)
  - Energy production/consumption
  - Health, education, crime rates
  - Housing shortage / overcrowding
  - Trade partners (what goods in/out)

Automated sub-loop (each tick):
  - Citizens work in assigned jobs (producing goods)
  - Consumption happens (happiness gained/lost based on consumption)
  - Births/deaths based on happiness, healthcare
  - Migration (unhappy citizens flee to happier cities)
  - Crime/unrest if stability < threshold
```

**Zoom 3: Simulation (Individual Citizen)**

```
Time horizon: Ticks (1 tick ≈ 2 weeks real-time)

Observer mode (research):
  - Watch individual citizen's happiness trajectory
  - Track which events caused happiness change
  - View citizen's information network (what rumors they've heard)
  - See education progression (apprentice → journeyman → master)
  - Observe family relations (spouse, children, parents)
  - Track wealth accumulation (job income, inheritance, taxes paid)

NOT player-controlled (citizens have agency):
  - Citizens choose jobs based on happiness, skill, location
  - Citizens migrate if better opportunity elsewhere
  - Citizens marry/have children autonomously
  - Citizens may rebel if sufficiently unhappy
  - Citizens spread rumors/information through social networks

Metrics visible:
  - Individual happiness (baseline 50, range 0-100)
  - Skills (farming, combat, trade, governance)
  - Information state (what rumors they believe)
  - Family tree (ancestry, descendants)
  - Wealth (personal savings, property, debt)
  - Allegiance (to nation, to faction, to institution)
```

### 2.2 The Main Game Loop (Per Tick)

```
TICK EXECUTION (happens every ~2 real-time weeks OR every decision round in strategy mode)

Phase 1: Demographics (O(population) cost)
──────────────────────────────────────────
For each city:
  For each citizen:
    - Decide birth/death based on happiness, healthcare, food access
    - Decide migration to other cities (if happiness too low)
  Update city population, age distribution

Event: citizen.born.v1, citizen.died.v1, citizen.migrated.v1


Phase 2: Production (O(buildings) cost)
───────────────────────────────────────
For each city:
  For each production building (farm, factory, mine):
    - Apply assigned workers
    - Consume energy and raw materials
    - Produce output (food, goods, weapons)
    - Generate pollution (CO2, waste)

Event: production.completed.v1, resource.produced.v1


Phase 3: Trade & Logistics (O(trade_routes) cost)
──────────────────────────────────────────────────
For each trade route between cities:
  - Execute pending trades (if both sides have goods)
  - Update prices based on supply/demand
  - Move goods via logistical network (costs energy)

Event: trade.executed.v1, price.updated.v1


Phase 4: Consumption & Happiness (O(population) cost)
──────────────────────────────────────────────────────
For each city:
  For each citizen:
    - Determine consumption basket (food, clothing, luxury)
    - Update happiness based on:
      * Consumption levels (rich diet +20, poor diet -20)
      * Job satisfaction (10 to -30 depending on role)
      * Crime (victim? -50; criminal? +20)
      * Health (sick? -30; healthy? +5)
      * Ideology match (if nation ideology matches personal: +10, else -5)
      * Social status (slave/serf: -50, merchant: +10, noble: +20)

Event: citizen.consumption.v1, citizen.happiness_updated.v1


Phase 5: Policy Evaluation (O(population * policies) cost)
──────────────────────────────────────────────────────────
For each active policy in government:
  - Check if conditions are met (e.g., "if stability < 50 and unrest > 20%")
  - Execute policy effects (e.g., "increase tax by 5%", "recruit army", "suppress unrest")
  - Record policy application and citizen reactions

Example policies:
  - Tax increase → happiness -5, treasury +income
  - Military draft → happiness -20 for drafted, +military strength
  - Trade embargo → happiness -10, trade revenue -50%
  - Revolution: if stability < 10 and rebellious_pop > 50%, trigger war

Event: policy.evaluated.v1, policy.applied.v1


Phase 6: Diplomacy & Conflict (O(nations) cost)
────────────────────────────────────────────────
For each pair of neighboring nations:
  - Evaluate casus belli (territorial dispute, resource conflict, ideological)
  - If war declared: start combat phase (resolve battles)
  - If peace treaty up for renewal: renegotiate

Event: war.declared.v1, battle.started.v1, treaty.signed.v1


Phase 7: Energy Accounting (O(cities) cost)
────────────────────────────────────────────
Global energy balance check:
  total_produced = sum of (solar, wind, coal, nuclear per city)
  total_consumed = sum of (production, transport, home heating per city)
  net_balance = total_produced - total_consumed

If net_balance < 0:
  → energy shortage (10% performance penalty per 1M joules short)
  → unhappiness (+10 per citizen if shortage > 20%)

If total_CO2 > carbon_budget (set by climate policy):
  → climate event triggered in next phase

Event: energy.balanced.v1, energy_shortage.v1


Phase 8: Climate & Disaster Events (probabilistic)
───────────────────────────────────────────────────
If CO2_budget exceeded:
  → roll for climate event (higher CO2 = higher chance)
  - Drought (reduce farm output 50% for 2-4 ticks)
  - Flood (destroy buildings in flood zone)
  - Heat wave (kill elderly, trigger migration)
  - Cold snap (reduce energy availability)
  - Hurricane (destroy buildings, trigger migration)

Probability curve:
  If CO2_ppm < 350: no events
  If CO2_ppm 350-450: 1% per tick
  If CO2_ppm 450-550: 10% per tick
  If CO2_ppm > 550: 50% per tick (catastrophe mode)

Event: climate.event_occurred.v1


Phase 9: Information Spread & Rumors (O(citizens * social_distance) cost)
─────────────────────────────────────────────────────────────────────────
For each rumor/news event in tick:
  - Propagate through social network (citizens tell neighbors)
  - Distortion probability (60% -> 80% -> 50% accuracy as spreads)
  - Track which beliefs citizens hold

Example: "King is corrupt" starts with 1 person, spreads to 10% of population
  → Ideological unhappiness increases for believers
  → If powerful enough, can trigger coup

Event: information.spread.v1, belief.updated.v1


Phase 10: Insurgency & Internal Conflict (probabilistic)
──────────────────────────────────────────────────────────
If unrest > 50% or stability < 30:
  - Roll for insurgent activity
  - Insurgents sabotage production (-5% output)
  - Security forces attempt suppression (captures some insurgents, possible collateral)
  - If insurgency large enough, triggers civil war

Event: insurgency.activity.v1, civil_war.triggered.v1


Phase 11: Shadow Networks & Espionage (hidden, event-triggered)
────────────────────────────────────────────────────────────────
Background: each nation has "shadow ops budget" (hidden from normal view)
  - If budget available:
    - Attempt sabotage on enemy tech tree (roll success chance)
    - Attempt intelligence gathering (learn about enemy troop positions)
    - Attempt assassination of enemy leader (very rare, high risk)

Player only sees results: "Enemy tech tree slowed by 10 ticks" or "Our leader assassinated!"

Event: shadow.operation_attempted.v1, shadow.operation_result.v1


Phase 12: End-of-Tick Reporting
────────────────────────────────
Aggregate all events from tick into daily/weekly report:
  - Revenue/expenses summary
  - Population changes (births, deaths, migration)
  - Production changes
  - Unrest/stability changes
  - Diplomatic actions
  - Military movements

Update metrics dashboards (visible in UI).

Event: tick.completed.v1
```

**Performance Budget:**

```
Total tick execution target: < 1 second wall-clock time (for fast-forward)

Complexity Analysis:
  Population size (N): typically 500K-5M
  Cities (C): typically 10-50
  Nations (K): typically 5-10
  Total actors (A): N + C + K ≈ mostly N

Phase 1 (Demographics): O(N) → ~500ms for 5M pop
Phase 2 (Production): O(C) → ~10ms
Phase 3 (Trade): O(C^2) → ~100ms for 50 cities
Phase 4 (Consumption & Happiness): O(N) → ~500ms
Phase 5 (Policy eval): O(P * C) where P=policies → ~50ms for 10 policies × 50 cities
Phase 6 (Diplomacy): O(K^2) → ~1ms for 10 nations
Phase 7 (Energy): O(C) → ~20ms
Phase 8-12: O(events logged) → ~50ms

Total: ~1.2 seconds per tick (acceptable)

Optimization: run phases 1-4 asynchronously if tick frequency > 2/sec
```

---

## Part 3: Economy Systems

### 3.1 The Three Allocator Regimes (CIV-0100)

CivLab supports three distinct economic systems; player chooses one (or blends) at nation founding.

#### **Regime A: Market Economy**

**Core Mechanism**: Price signals drive production and consumption.

**Price Discovery**:
```
For each good type (food, cloth, weapon, luxury):
  supply_this_tick = produced_units - consumed_units
  price_change = supply_this_tick / baseline_supply_quantity

  price_t+1 = price_t * (1 + price_change)

Example:
  Food production: 10,000 units/tick
  Food consumption: 12,000 units/tick
  Supply: -2,000 (shortage)
  Price change: -2,000 / 10,000 = -0.2 → price_t+1 = 1.2 * price_t (20% increase)
```

**Production Decisions** (worker autonomy):
```
For each citizen with "worker" status:
  Evaluate each production job available in city:
    expected_wages = base_wage[job] * (1 + skill_bonus)
    cost_of_living = current_prices[food] + current_prices[clothing]
    profit = expected_wages - cost_of_living
    happiness_boost = happiness_bonus[job] - unhappiness[job_conditions]

  Choose job with highest (profit + 0.5 * happiness_boost)

  If no job profitable: migrate to other city or become unemployed (unhappy)
```

**Merchant Networks**:
```
Each city has "merchants" (specialized class)
  - They buy low, sell high (arbitrage)
  - They maintain trade routes
  - They negotiate contracts with other cities

Profit motive: merchants keep 10% of trade profit (incentive to trade)
Social cost: if merchants hoard, can trigger regulation → taxes on trade

Dynamic: free market with price controls available as policy tool
```

**Key Properties**:
- ✓ Efficient: prices converge to equilibrium quickly
- ✓ Emergent: trade networks form without scripting
- ✗ Unstable: boom/bust cycles, unemployment
- ✗ Unequal: wealth concentrates, gini coefficient rises

**Player Levers**:
- Tax production/consumption (raise revenue, distort prices)
- Tariffs on imports (protect local industry, reduce trade)
- Wage controls (help poor, reduce merchant profit)
- Price caps (prevent gouging, create shortages)

---

#### **Regime B: Planned Economy**

**Core Mechanism**: Central planner sets production quotas and consumption allocations.

**Central Plan** (updated annually):
```
Planner specifies target allocation for each good:
  target_food_production = 12,000 units/year
  target_cloth_production = 5,000 units/year
  target_weapon_production = 500 units/year
  target_luxury_production = 200 units/year

Planner also specifies consumption ration (per citizen class):
  food_ration[farmer] = 8 units/month (subsistence)
  food_ration[merchant] = 12 units/month (comfortable)
  food_ration[noble] = 20 units/month (luxury)

Workers are assigned to production jobs to hit targets.
Consumers receive rations regardless of job/wealth.
```

**Central Coordination Cost**:
```
Coordination overhead per citizen per year:
  base_cost = 0.001 (0.1% of production)
  + inefficiency = 5% if plan targets > actual capacity
  + corruption = 2% (black market reduces observed production)

Total efficiency penalty: 7-10% (planned economy produces 90-93% of potential)

Example: if planned economy is implemented, total GDP reduced by ~7%
But: wealth is more equitably distributed (gini coefficient lower)
```

**Information Problem**:
```
Planner cannot perfectly observe:
  - Actual production capacity per city
  - Worker true preferences
  - Hidden consumption (black market)

Solution: set targets conservatively (80% of theoretical max)
         monitor via audit (catches 50% of black market)
         adjust targets yearly based on feedback

Failure mode: if planner targets too high, shortages trigger unrest
```

**Worker Motivation**:
```
Workers in planned economy don't earn wages (assigned jobs).
Instead, they receive:
  - Basic rations (guaranteed)
  - Ideological reward (if they believe in communism)
  - Status (if promoted to planner role)

Happiness formula for planned economy workers:
  happiness = 50 + ration_level - job_difficulty - ideology_mismatch

So: a farmer believing in communism can be happy even with low rations
But: a merchant in communism is unhappy (forced to give up profit)
```

**Key Properties**:
- ✓ Stable: no unemployment, no boom/bust
- ✓ Equitable: gini coefficient stays low
- ✗ Inefficient: 7-10% production penalty
- ✗ Brittle: if plan overestimated, cascading shortage

**Player Levers**:
- Adjust production targets (reallocation between goods)
- Adjust consumption rations (redistribute wealth)
- Promote/demote planners (affects corruption rate)
- Black market legalization (trade off efficiency vs. freedom)

---

#### **Regime C: Joule Economy (Energy-Backed)**

**Core Mechanism**: All value ultimately derived from energy (Joules).

**Currency Backing**:
```
1 unit of money ≡ 1 Joule of energy storage capacity
  (i.e., money is a claim on the energy reserve)

Energy reserve = all stored energy (batteries, reserves, coal, oil)
Money supply = total currency in circulation

Requirement: Money_supply <= Energy_reserve * 2
            (2x backing allows economic growth)

If Energy_reserve drops:
  → Money supply must contract (deflation)
  → Central bank withdraws currency via taxation
  → Unhappiness due to deflation (people feel poorer)
```

**Energy as Lifeblood**:
```
Every production activity costs energy:
  - Farm output per worker: F joules → produces 10 food units
  - Factory output per worker: 2F joules → produces 1 weapon
  - Service output per worker: 0.5F joules → 1 happiness unit

Trade also costs energy (transport).

If energy shortage:
  → production halts (no power)
  → all economic activity stops
  → civilization enters "emergency mode"

Emergency mode triggers:
  - Ration consumption to survivable minimum
  - Suspend non-essential production
  - Accept any peace terms (can't sustain war)
```

**Carbon Budget & Climate Integration**:
```
Joule economy explicitly ties energy source to climate impact:
  - Coal: 100 Joules energy, 0.5 kg CO2/Joule
  - Oil: 100 Joules energy, 0.4 kg CO2/Joule
  - Gas: 100 Joules energy, 0.25 kg CO2/Joule
  - Nuclear: 100 Joules energy, 0.01 kg CO2/Joule (waste storage cost)
  - Solar: 100 Joules energy, 0.0 kg CO2/Joule
  - Wind: 100 Joules energy, 0.0 kg CO2/Joule
  - Hydro: 100 Joules energy, 0.0 kg CO2/Joule

Nation's total CO2 = sum of (energy_from_source * emission_factor)

If national_CO2 > global_carbon_budget:
  → climate event probability increases
  → other nations pressure for climate action
  → may trigger "climate war" (carbon trading disputes)
```

**Key Properties**:
- ✓ Physically realistic: energy is the fundamental constraint
- ✓ Tight integration with climate system
- ✗ Complex: players must manage energy mix AND economic policy
- ✗ Can be brittle: energy crisis → instant collapse

**Player Levers**:
- Energy source selection (coal = cheap but dirty; solar = expensive but clean)
- Investment in renewable infrastructure
- Trade energy with neighbors (import oil, export excess solar)
- Manage currency supply relative to energy reserve
- Negotiate international carbon budget allocation

---

### 3.2 Trade Mechanics & Global Economy

**Trade Routes**:

```
Each city can maintain up to (pop_size / 100K) active trade routes.
Trade route = bilateral agreement to exchange goods regularly.

Example:
  Northern City (wheat surplus) ↔ Southern City (metals surplus)
  Quarterly trade: 500 wheat ← 100 metals

Trade contract terms:
  - Exchange ratio (5 wheat per 1 metal)
  - Duration (1-10 years)
  - Price adjustments (fixed vs. floating)
  - Penalties for breach (lose reputation, war risk)
```

**Trade Network Topology**:

```
Graph structure: cities are nodes, trade routes are edges
Emergent properties:
  - Hub cities (connected to 20+ others) become wealthy
  - Peripheral cities depend on hub merchants
  - Disruption of hub (war, blockade) cascades through network

Strategic implication:
  - Control trade hubs → control economy
  - Embargo a hub → damage 10+ downstream cities
```

**Merchant Behavior** (AI):

```
Each city has 1-3 "merchant" NPCs (if market economy).
Merchants are profit-seeking:
  - Seek arbitrage opportunities (buy cheap → sell expensive)
  - Establish new trade routes if profitable
  - Maintain reputation (breach contracts damages future deals)

Merchant effectiveness = base_skill + experience
  - New merchant: 50% success on new route
  - Experienced merchant: 90% success

Player can:
  - Hire merchant (cost: 100g/year salary)
  - Send merchant to foreign city to establish trade
  - Recall merchant if underperforming
```

---

### 3.3 Money & Banking System

**Currency System**:

```
Default currency name = "Drachma" (player can rename)

Denominations:
  - 1 copper penny (base unit)
  - 10 pennies = 1 silver drachma
  - 100 drachmas = 1 gold piece

Inflation/deflation:
  - If money_supply grows faster than GDP: inflation (prices rise)
  - If money_supply shrinks: deflation (prices fall, unhappiness)
  - Target inflation rate: 2% per year (allows growth)
```

**Banking & Lending**:

```
Banks are institutions that:
  - Accept deposits (pay interest, currently 1% per year)
  - Make loans (charge interest, currently 5% per year)
  - Facilitate trade credit (short-term loans for merchants)

Bank capital requirement: 10% of outstanding loans
If capital falls below requirement: bank fails → financial crisis

Player decisions:
  - Regulate interest rates (cap lending rates → cheaper loans but fewer available)
  - Reserve requirements (higher reserves → safer but slower growth)
  - Bail out failing banks (costs treasury but prevents crisis) vs. let fail (reset, crisis)

Banking stability is automatic unless player intervenes with regulations.
```

**National Debt & Credit Rating**:

```
National credit rating (AAA to D):
  - Based on: debt/GDP ratio, payment history, political stability
  - Affects: interest rates on future borrowing, trade reputation

If nation defaults on debt:
  - Immediate: interest rates spike, trade partners demand payment
  - Long-term: 10-year reputation penalty, harder to borrow

Debt management:
  - Borrow cheap early, pay back later (if revenues grow)
  - Risk: if revenues drop, debt becomes unsustainable
  - Military solution (controversial): wage war to seize creditor's assets
```

---

## Part 4: War, Diplomacy & Shadow Networks

### 4.1 Casus Belli (Reasons for War)

War is not automatic; player must declare with a valid reason:

**Standard Casus Belli Types:**

| Type | Trigger | Stability Cost | War Support % |
|---|---|---|---|
| Territorial Dispute | Border conflict or expansion claim | Low | 60% |
| Religious Conflict | Different state religion, inquisition | Low-Med | 50% |
| Trade War | Economic embargo or unfair tariffs | Low | 40% |
| Succession | Rival claim on enemy throne | Med | 70% (if popular) |
| Ideological War | Incompatible ideologies (monarchy vs. democracy) | Med | 50% |
| Imperial Expansion | "Civilizing mission" (colonialism) | High | 30% |
| Defensive War | Enemy declared on you (provoked) | Negative | 85% |
| Tributary War | Subjugate enemy as vassal | High | 20% |

**War Support Mechanic**:

```
Player declares war, but support from population matters:
  national_support = base_support[casus_belli]
                   + 10 * ideology_match_with_war_type
                   - 20 * if_population_scared_of_enemy_army
                   - 15 * if_ongoing_internal_conflict

If support < 30%:
  → War is unpopular; unrest increases 20%/month
  → Can trigger civil war if support < 10%

If support > 70%:
  → War is popular; morale bonus to army; production efficiency +10%
```

### 4.2 Military & Battles

**Army Composition**:

```
Each nation maintains multiple armies (1-10 depending on size).
Each army consists of:
  - Infantry (sword/spear units)
  - Cavalry (mounted units, fast but weak)
  - Archers (ranged, weak in melee)
  - Siege equipment (for assaults on forts)
  - Supply train (carries food, logistics)

Example army: 5,000 infantry + 1,000 cavalry + 500 archers + supply
  - Cost to maintain: 50g/month (food, weapons, wages)
  - Morale: 50-100 (affected by recent victories, supply levels)
  - Readiness: 0-100 (affected by training, rest, discipline)
```

**Battle Resolution**:

```
When armies meet:
  1. Terrain check: modifier to both sides (-10 to +20)
  2. Morale check: armies with low morale rout/flee
  3. Combat calculation:
       attacker_strength = size * morale * discipline * 0.01
       defender_strength = size * morale * terrain_bonus * 0.01
       roll = d100 (deterministic from RNG seed)

       if roll < attacker_strength / (attacker + defender):
         attacker wins → defender routs
       else:
         defender holds or routs (damage to both sides)
  4. Casualty calculation: 5-20% of losing side dies, rest routs/captured

Outcome: victor gains territory, loser loses army strength

Siege (special case):
  - Attacking army must reduce castle fortifications
  - Takes weeks; supply becomes critical (attacker vulnerable)
  - Defender can attempt breakout or negotiated surrender
```

**War Costs**:

```
Monthly war expenses:
  - Army maintenance: 50g per 1000 troops
  - Logistics: additional 20% of maintenance cost (transport)
  - Fortification repairs: 10g per fortified city
  - Morale maintenance: 5g per army (if morale dropping)
  - War loans: if budget insufficient, borrow at 8% interest

Total: a 10,000-person army costs 500g + 100g logistics + extras = 700g/month
       This quickly bankrupts small nations in long wars
```

---

### 4.3 Diplomacy & Alliances

**Alliance Formation**:

```
Nations can form alliances (mutual defense pacts).
Each alliance requires:
  - Shared ideological interest (within 20 points)
  - Trust level (gained by trade, shared enemies, time)
  - Alliance fee (each member contributes % of national budget)

Benefits:
  - Mutual defense obligation (must join war if ally attacked)
  - Trade benefits (reduced tariffs between members)
  - Intelligence sharing (learn about threats)

Costs:
  - Loss of independence (constrained by alliance votes)
  - War participation (may be dragged into wars you don't want)
  - Fee (1-5% of national budget)

Alliance breaks if:
  - Members sign contradictory alliances
  - One member attacks another
  - Trust drops below threshold
  - Voted to dissolve (unanimous vote)
```

**Reputation & Trust**:

```
Each pair of nations has bilateral trust level (0-100):
  50 = neutral
  > 70 = friendly
  < 30 = hostile

Trust changes due to:
  + Trade: +1 trust per 100g annual trade
  + Shared enemy: +5 per enemy in common
  + Alliance membership: +2 per year
  - War: -20 immediate, -10 per year of war
  - Broken promises: -50 (very severe)
  - Espionage caught: -30

High trust nations offer better trade deals and cooperate.
Low trust nations refuse trade, may embargo, support insurgency.
```

**Treaties & Negotiation**:

```
Negotiated treaties (peace, trade, research sharing):
  - Peace treaty: ends war, defines new borders, reparations
  - Trade agreement: specifies goods, prices, duration
  - Non-aggression pact: "won't attack for X years"
  - Research sharing: pooled tech tree progress (costs 10% eff, +20% progress)

Negotiation mechanics:
  - Proposer: offers terms to counterparty
  - Counterparty: accepts, rejects, or counters
  - AI evaluation: uses diplomacy algorithm to decide
    * Is peace/deal beneficial to us?
    * Do we trust this nation?
    * Better to hold out for better terms?

Example peace after war:
  Loser offers: 100g reparation + 1 trade route to winner
  Winner counters: 200g reparation + 2 trade routes + territorial concession
  Loser accepts or rejects (affects future trust)
```

---

### 4.4 Shadow Networks & Covert Operations

**Shadow Network Organization**:

```
Each nation has a hidden network of spies/saboteurs.
Network size depends on:
  - Government size (larger govt = more resources)
  - Corruption level (higher corruption = more spies)
  - Budget allocation (player can increase spy budget)

Spy budget (default 2% of national budget):
  - Low budget: 10 agents, success rate 30%
  - Medium budget (5%): 30 agents, success rate 60%
  - High budget (10%): 100 agents, success rate 80%

Agents specialize in:
  - Intelligence: learn about enemy plans, troop positions
  - Sabotage: damage enemy production, slow tech research
  - Assassination: kill enemy leader (very risky, very expensive)
  - Propaganda: spread rumors, lower enemy morale
  - Counter-intelligence: detect enemy spies
```

**Covert Operation Examples**:

**Operation: Intelligence Gathering**

```
Goal: Learn about enemy army composition
Cost: 10g (one-time)
Time: 1-5 weeks (random)
Success chance: 60% (if spy budget medium)

If success:
  → Gain "enemy army disposition" intelligence
  → See approximate troop numbers, morale
  → Useful for planning battles

If failure:
  → Enemy catches spy
  → They gain +30 trust with you (think you're friendly)
  → Or -50 trust if they realize it's espionage
  → Spy is lost (no future use)
```

**Operation: Technological Sabotage**

```
Goal: Slow enemy research progress
Cost: 50g
Time: 2-8 weeks
Success chance: 50% (risky)

If success:
  → Enemy's current tech research slows by 50% for 10 ticks
  → Enemy doesn't know why (hidden effect)
  → They eventually discover sabotage if they check logs

If failure:
  → Enemy catches your spy
  → They declare this an act of war (war casus belli!)
  → Relationship -50
  → Possible retaliation
```

**Operation: Assassination**

```
Goal: Kill enemy leader (triggers succession crisis)
Cost: 500g (very expensive!)
Time: 4-12 weeks (takes longest)
Success chance: 20% (very risky)
Consequences if caught: -100 relationship, war declaration

If success:
  → Enemy leader dies
  → Succession crisis: random heir takes over
  → New heir may have different personality, policies, alliances
  → Potential civil war in enemy state (chaos, opportunity)

If failure:
  → Enemy catches assassination plot
  → Usually automatic war declaration
  → Severe diplomatic damage with other nations
  → 10-year reputation penalty (very difficult to recover)
```

**Operation: Propaganda & Rumor-Spreading**

```
Goal: Lower enemy morale / trigger rebellion
Cost: 20g
Time: Ongoing (3+ ticks to take effect)
Success chance: 60%

Operation mechanics:
  1. Spread rumor (e.g., "King is corrupt")
  2. Rumor spreads through enemy population (info network)
  3. If rumor believed by >20% of population: -5 stability for enemy
  4. If believed by >50%: potential coup/civil war

Player can counter-rumor (cost 10g, spread opposite message)
Whichever rumor spreads further wins

Risks:
  - Enemy may discover your propaganda campaign
  - Backfires: if seen as foreign meddling, unites population against you
```

---

## Part 5: Modding & Extension API

### 5.1 Headless Core Architecture

CivLab's core engine is **headless** (no UI), publishing all state and events via a standardized protocol.

**Client Architecture**:

```
┌─────────────────────────────────────────┐
│  CIV Headless Core (Rust)               │
│  - Simulation engine                    │
│  - Event emission                       │
│  - State persistence                    │
│  - Policy evaluation                    │
└────────────────┬────────────────────────┘
                 │ [WebSocket JSON Events]
      ┌──────────┴──────────┬─────────────┐
      │                     │             │
   ┌──▼──┐            ┌────▼───┐    ┌───▼──┐
   │ Web │            │ Desktop│    │ TUI  │
   │ UI  │            │ Client │    │      │
   │     │            │        │    │      │
   └─────┘            └────────┘    └──────┘

Clients connect to core via WebSocket.
Core emits events; clients render UI locally.
Client sends player actions back to core (deterministic execution).
```

**Event-Driven Protocol**:

```json
Event from core to client:

{
  "event_id": "e-2026-02-21-00123",
  "event_type": "tick.completed.v1",
  "timestamp": "2026-02-21T14:30:00Z",
  "tick_number": 1050,
  "payload": {
    "tick_duration_ms": 750,
    "population_total": 2500000,
    "gdp_estimate": 150000000,
    "stability_index": 72.5,
    "energy_balance": 45000000,
    "co2_ppm": 425,
    "events_this_tick": [
      {
        "category": "economy",
        "summary": "Market cleared: wheat 50g -> 55g"
      },
      {
        "category": "demographics",
        "summary": "Population: 2.45M -> 2.50M (+55K births, -4K deaths)"
      }
    ]
  }
}

Player action (client to core):

{
  "action_type": "declare_war",
  "player_nation_id": "great_britain",
  "target_nation_id": "france",
  "casus_belli": "trade_war",
  "timestamp": "2026-02-21T14:32:15Z"
}

Core processes action, emits event confirming war declaration.
```

### 5.2 Scenario & Mod Format (YAML)

**Scenario Bundle**:

```yaml
# scenarios/historical/napoleonic_wars_1812.yaml

name: "Napoleonic Wars: 1812"
description: "Europe in 1812, at height of Napoleonic Wars"
version: "1.0"

# Map seed (deterministic map generation)
map:
  seed: 0x1812ABCD
  size: "1024x768"
  climate_zone: "temperate"
  continents: 2

# Nations & starting state
nations:
  france:
    name: "France"
    color: "#4169E1"
    leader_name: "Napoleon Bonaparte"
    leader_personality: "aggressive"
    starting_capital: [512, 400]
    starting_population: 30000000
    starting_treasury: 5000000
    government_type: "monarchy"
    ideology: 75  # Very monarchist
    starting_technology: ["iron_working", "steam_engine", "military_theory"]

  britain:
    name: "Great Britain"
    color: "#FF0000"
    leader_name: "King George III"
    starting_capital: [200, 150]
    starting_population: 12000000
    starting_treasury: 3000000
    government_type: "constitutional_monarchy"
    ideology: 60
    starting_technology: ["iron_working", "steam_engine", "naval_dominance"]

  # ... 5-10 more nations ...

# Global policies (climate, rules)
global_policies:
  carbon_budget_limit: 500  # ppm CO2 equivalent
  renewable_adoption_rate: 0.02  # 2% per year tech drift to renewables
  natural_disaster_frequency: "normal"

# Initial wars & alliances
initial_wars:
  - attacker: france
    defender: russia
    start_tick: 0

initial_alliances:
  - members: [britain, austria, russia]
    name: "Coalition Against France"
    duration: 50  # ticks

# Victory conditions
victory_conditions:
  stability_victory:
    stability_threshold: 85
    duration_ticks: 100
    description: "Maintain high stability for 4 years"

  territorial_victory:
    min_percentage_controlled: 60
    description: "Control 60% of European territory"

  economic_victory:
    gdp_threshold: 200000000
    description: "Achieve GDP of 200M"

# Scenario options
options:
  game_speed: "normal"  # normal, fast, historical_accurate
  ai_difficulty: "hard"
  weather_variability: "high"
```

**Mod Structure**:

```
my_mod/
├── mod.yaml                          # Metadata
├── policies/                         # Custom policy definitions
│   ├── climate_emergency.yaml
│   └── tech_race.yaml
├── institutions/                     # Custom institution templates
│   ├── revolutionary_committee.yaml
│   └── merchant_guild.yaml
├── buildings/                        # Custom building definitions
│   └── wind_turbine.yaml
├── tech_tree/                        # Custom technology definitions
│   └── quantum_computing.yaml
└── resources/                        # Custom resource types
    └── synthetic_fuel.yaml
```

**Custom Policy Example**:

```yaml
# my_mod/policies/climate_emergency.yaml

name: "Climate Emergency Declaration"
category: "governance"
author: "player_username"
version: "1.0"

preconditions:
  - co2_ppm: { min: 450 }
  - stability: { min: 20 }  # Can declare even in crisis

effects:
  on_enactment:
    - set_global_policy: "carbon_price_$100_per_ton"
    - research_speed_multiplier: 1.5  # Green tech research 50% faster
    - happiness_change: +5  # Population likes climate action
    - treasury_cost: -100000  # One-time cost to implement

  on_tick:
    - coal_production: { factor: 0.8 }  # Coal output reduced 20%
    - renewable_growth: { rate: 0.05 }  # Renewable adoption +5%/year
    - industrial_pollution: { factor: 0.9 }  # Pollution down 10%

duration:
  min_ticks: 50
  max_ticks: 1000

cancelable: true
cancel_effects:
  - happiness_change: -10  # People upset if you cancel

description: "Declare climate emergency; boost green tech; reduce emissions"
```

---

## Part 6: Game Modes & Victory Conditions

### 6.1 Campaign Mode (Single Nation)

**Player Goal**: Achieve one of the victory conditions as a single nation.

**Setup**:
1. Choose scenario (historical or generated)
2. Choose nation to play
3. Set difficulty (AI difficulty, game speed, weather)
4. Confirm victory condition

**Gameplay**:
- Play 1-50 years (250-1000 ticks)
- Make strategic decisions (policies, wars, diplomacy)
- Watch emergent events (unrest, disasters, tech breakthroughs)
- Achieve victory or suffer defeat/game-over

**Victory Conditions** (pick one at start):

| Condition | Parameters | Typical Duration |
|---|---|---|
| **Stability Victory** | Stability > 80 for 100 ticks | 10-20 years |
| **Prosperity Victory** | Top-quartile GDP per capita for 50 ticks | 15-25 years |
| **Territorial Victory** | Control 60% of map | 20-40 years |
| **Hegemony Victory** | Control 60% of global energy production | 15-30 years |
| **Diplomatic Victory** | Form alliance with >50% of nations | 10-20 years |
| **Ideological Victory** | Spread your ideology to >50% of world population | 25-50 years |
| **Scientific Victory** | Discover final tech (e.g., "Post-Scarcity") | 30-50 years |
| **Custom Victory** | Player-defined (scenario dependent) | Varies |

**Defeat Conditions**:
- Population drops below 10,000 (extinction)
- Stability drops below 5 for 50 ticks (collapse)
- Treasury bankruptcy + no allies willing to bailout (economic failure)
- All armies defeated + capital captured (military defeat)

---

### 6.2 Sandbox Mode

**Player Goal**: Experiment, build, explore without win/lose condition.

**No victory conditions.** Play indefinitely.

**Use Cases**:
- Learn game mechanics
- Build a "perfect" civilization
- Create fantasy scenarios
- Test mods and custom policies
- Relaxed, creative play

**Features**:
- Can save/load at any time
- Can pause and unpause freely
- Can rewind 10 ticks and try again
- Cheat commands available (add resources, adjust policies instantly)

---

### 6.3 Research Mode (Headless)

**Player Goal**: Run scientific/statistical simulations.

**Differences from Campaign**:
- No UI (headless core only)
- Metrics-export to CSV/JSON
- Batch runs (run same scenario 100 times, vary parameters, export results)
- Deterministic replay (rerun with same seed = same result)

**Use Cases**:
- Academic research ("How does ideology affect GDP?")
- Parameter sweeps ("Test carbon budget from 300-600ppm")
- Benchmarking ("Can you win on Harder difficulty?")
- Debugging ("Reproduce exact sequence of events that caused collapse")

**Example Research Script** (pseudocode):

```python
import civlab

# Run scenario "Modern Era" 10 times, vary carbon budget
scenario = civlab.load_scenario("scenarios/modern_era.yaml")

for carbon_budget in [300, 400, 500, 600]:
    results = []

    for run in range(10):
        game = civlab.Game(
            scenario=scenario,
            carbon_budget_limit=carbon_budget,
            seed=run  # Vary seed for different maps
        )

        game.run_until_victory()

        results.append({
            "carbon_budget": carbon_budget,
            "run": run,
            "final_stability": game.stability(),
            "final_gdp": game.gdp(),
            "ticks_to_victory": game.ticks(),
            "events": game.event_log(),  # Full event log
        })

    # Export results
    civlab.export_csv("results_carbon_budget_{}.csv".format(carbon_budget), results)
```

---

## Part 7: Technical Architecture (Headless Core)

### 7.1 Core Subsystems

| Subsystem | Responsibility | Complexity |
|---|---|---|
| **Simulation Engine** | Tick execution, state transitions | High |
| **Economy** | Market clearing, production, trade | High |
| **Demographics** | Birth, death, migration | Medium |
| **Policy Engine** | Policy evaluation, effect application | High |
| **Diplomacy AI** | Relationship tracking, negotiations | Medium |
| **Military** | Army movement, battle resolution | Medium |
| **Climate** | CO2 tracking, disaster events | Medium |
| **Event Bus** | Event emission, logging, validation | Medium |
| **State Persistence** | Serialization, save/load, replay | Low-Med |
| **Metrics & Analytics** | Performance tracking, reporting | Low |

### 7.2 Determinism Guarantees

**Requirement**: Given seed + policy bundle, same map and event sequence always generated.

**Implementation**:
```rust
// Pseudocode

fn run_deterministic_tick(seed: u64, tick: u32) {
    let mut rng = DeterministicRNG::from_seed(hash(seed, tick));

    // Phase 1: Demographics
    for city in cities {
        for citizen in city.citizens {
            let birth_roll = rng.next();  // Pinned to this tick
            if birth_roll < birth_probability {
                citizen.give_birth();
            }
        }
    }

    // Phase 2: Production
    // ...

    // Store event log
    log_tick_events(tick);
}

// Replay: run same ticks with same seed → same events
```

**Verification**:
1. Run scenario twice with same seed
2. Compare event logs (must be identical)
3. Compare final state (must be identical)
4. If any difference → determinism broken → investigate RNG usage

---

## Part 8: Client Integration & WebSocket Protocol

### 8.1 Client Connection Flow

```
1. Client connects to core WebSocket (ws://localhost:8000)

2. Client sends auth:
   { "action": "authenticate", "token": "..." }

3. Server responds with game state:
   { "scenario": {...}, "nations": {...}, "tick": 0 }

4. Client renders initial UI

5. Game starts ticking (core sends event stream)

6. Client sends player action:
   { "action": "declare_war", "target": "france" }

7. Core processes action, applies to game state, emits event

8. Client receives event, updates UI

9. Repeat 5-8 indefinitely
```

### 8.2 API Contracts (Deterministic)

All API responses include:
- `event_id`: UUID (unique per event)
- `tick_number`: Sequence number
- `timestamp`: When event was generated
- `payload`: Event-specific data
- `hash`: SHA256(state_after_event) for verification

---

## Part 9: Modding Ecosystem

### 9.1 Community Mod Distribution

Mods hosted on community registry (like Steam Workshop):

```
CivLab Mod Registry (civlab-mods.org)
├── Scenario Collections
│   ├── "Historical Scenarios Pack"
│   ├── "Fantasy World Scenarios"
│   └── "Hard Mode Challenge Scenarios"
├── Gameplay Mods
│   ├── "Better AI Diplomacy"
│   ├── "Climate Catastrophe"
│   └── "Tech Tree Rebalance"
├── UI Mods (visual enhancements)
│   ├── "Dark Mode UI"
│   └── "Minimalist HUD"
└── Conversion Mods (Civ 6 → CivLab)
    ├── "Ancient Egypt Conversion"
    └── "Industrial Revolution Conversion"
```

### 9.2 Modding Best Practices

1. **Versioning**: Always version mods; mark compatibility with core versions
2. **Testing**: Provide test scenario to verify mod works
3. **Documentation**: Include README explaining features and balance implications
4. **Balance**: Submit balance-changing mods for community vote before inclusion
5. **Performance**: Profile mods; flag if they increase tick time >10%

---

## Summary Table: Inspirations & Distinctions

| Game | Inspiration | CivLab Distinction |
|---|---|---|
| Dwarf Fortress | Emergent complexity | Clean headless protocol + Joule economy |
| Victoria 3 | Political economy | Institutional persistence + shadow networks |
| Crusader Kings 3 | Dynasty mechanics | Institutional memory independent of leader |
| Factorio | Production optimization | Energy-backed currency + climate system |
| Terra Nil | Environmental restoration | Full climate simulation with carbon budget |
| OpenTTY | Colony simulation | Determinism + replay + research mode |
| Influence | Covert operations | Espionage integrated into core diplomacy |

---

## Full Game Features Checklist (v1)

- ✅ Deterministic simulation engine
- ✅ Three economy systems (market, planned, Joule)
- ✅ Population dynamics (birth, death, migration, happiness)
- ✅ Production chains and trade networks
- ✅ War and diplomacy system
- ✅ Shadow networks and espionage
- ✅ Climate system (CO2, disasters)
- ✅ Tech tree with research
- ✅ Institutions and ideology
- ✅ Headless core architecture
- ✅ WebSocket API for clients
- ✅ YAML scenario and mod format
- ✅ Campaign, Sandbox, and Research modes
- ✅ Multiple victory conditions
- ✅ Detailed metrics and analytics
- ✅ Player agency and emergent gameplay
