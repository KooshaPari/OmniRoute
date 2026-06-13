import{_ as a,o as n,c as i,ag as e}from"./chunks/framework.CmQHR1bQ.js";const k=JSON.parse('{"title":"CivLab: Game Design Document","description":"","frontmatter":{},"headers":[],"relativePath":"reference/CIVLAB_GAME_DESIGN.md","filePath":"reference/CIVLAB_GAME_DESIGN.md"}'),p={name:"reference/CIVLAB_GAME_DESIGN.md"};function t(l,s,r,o,c,h){return n(),i("div",null,[...s[0]||(s[0]=[e(`<h1 id="civlab-game-design-document" tabindex="-1">CivLab: Game Design Document <a class="header-anchor" href="#civlab-game-design-document" aria-label="Permalink to &quot;CivLab: Game Design Document&quot;">​</a></h1><p><strong>Date:</strong> 2026-02-21 <strong>Status:</strong> ACTIVE <strong>Owner:</strong> CIV Game Design Team <strong>Audience:</strong> Game designers, developers, players, modders</p><hr><h2 id="executive-summary" tabindex="-1">Executive Summary <a class="header-anchor" href="#executive-summary" aria-label="Permalink to &quot;Executive Summary&quot;">​</a></h2><p>CivLab is a <strong>deep civilization simulation</strong> that functions simultaneously as:</p><ol><li><strong>A Research Sandbox</strong>: Deterministic, policy-driven, supports parameterized runs and metrics export for academic/scientific study</li><li><strong>A Real-Time Strategy Game</strong>: Playable, engaging, with strategic depth comparable to Victoria 3 + Dwarf Fortress + OpenTTY</li><li><strong>A Modding Platform</strong>: Headless core architecture supports multiple client frontends (web, desktop, TUI) and extensible scenario/policy design</li></ol><p>This document details the complete game design: core mechanics, economy systems, war/diplomacy, modding API, and victory conditions.</p><hr><h2 id="part-1-game-concept-inspiration" tabindex="-1">Part 1: Game Concept &amp; Inspiration <a class="header-anchor" href="#part-1-game-concept-inspiration" aria-label="Permalink to &quot;Part 1: Game Concept &amp; Inspiration&quot;">​</a></h2><h3 id="_1-1-inspirations-key-differentiators" tabindex="-1">1.1 Inspirations &amp; Key Differentiators <a class="header-anchor" href="#_1-1-inspirations-key-differentiators" aria-label="Permalink to &quot;1.1 Inspirations &amp; Key Differentiators&quot;">​</a></h3><table tabindex="0"><thead><tr><th>Inspiration</th><th>Why</th><th>CivLab Differentiator</th></tr></thead><tbody><tr><td><strong>Dwarf Fortress</strong></td><td>Emergent depth, rich simulation, failure modes</td><td>Clean protocol interface; detailed Joule energy economy adds physics realism</td></tr><tr><td><strong>Victoria 3</strong></td><td>Political economy, pop simulation, ideology</td><td>Per-citizen lifecycle tracking; shadow networks for covert ops</td></tr><tr><td><strong>Crusader Kings 3</strong></td><td>Actor AI, dynasty mechanics, intrigue</td><td>Institutional memory persists across rulers; institutional allegiance &gt; personal loyalty</td></tr><tr><td><strong>Factorio</strong></td><td>Production graphs, optimization puzzles</td><td>Applied to energy/resource networks; climate disruption introduces chaos</td></tr><tr><td><strong>Terra Nil</strong></td><td>Ecosystem restoration, environmental care</td><td>Full climate cycle (carbon budget, renewable energy shifts, disasters)</td></tr><tr><td><strong>OpenTTY</strong></td><td>Colony sim, emergent stories, replayability</td><td>Determinism guarantees replayability; Joule economy ties logistics to physics</td></tr><tr><td><strong>Influence</strong></td><td>Covert operations, information control</td><td>Institutional espionage; policy misdirection; selective information release</td></tr></tbody></table><h3 id="_1-2-core-design-pillars" tabindex="-1">1.2 Core Design Pillars <a class="header-anchor" href="#_1-2-core-design-pillars" aria-label="Permalink to &quot;1.2 Core Design Pillars&quot;">​</a></h3><p><strong>Pillar 1: Determinism &amp; Replay</strong></p><ul><li>Every simulation run is fully reproducible from seed + policy bundle</li><li>Event log captures all stochastic decisions (RNG rolls pinned to event IDs)</li><li>Supports &quot;research mode&quot; (run same scenario 1000x, export statistics)</li><li>Enables &quot;replay debugging&quot;: watch the exact sequence of events that led to collapse</li></ul><p><strong>Pillar 2: Energy Physics</strong></p><ul><li>All resource flows denominated in Joules (CIV-0102)</li><li>Climate system tied directly to carbon production (energy mix determines GHG)</li><li>Renewable generation variability creates demand-matching challenges</li><li>Conservation law: energy_in = energy_consumed + energy_stored + energy_wasted</li></ul><p><strong>Pillar 3: Emergent Complexity from Simple Rules</strong></p><ul><li>No scripted events or predetermined disaster scenarios</li><li>Complex behaviors (civil war, famine, tech breakthroughs) emerge from policy decisions × economic reality</li><li>Population dynamics (birth/death/migration) driven by happiness, healthcare, living space</li><li>Institutional competition creates natural alliance networks without explicit diplomacy scripting</li></ul><p><strong>Pillar 4: Multi-Layer Play</strong></p><ul><li><strong>Strategic layer (zoom 1)</strong>: Nation-scale; diplomatic, resource allocation, war declaration</li><li><strong>Tactical layer (zoom 2)</strong>: City/province scale; production chains, military units, city planning</li><li><strong>Simulation layer (zoom 3, research mode)</strong>: Individual citizen; watch happiness flow through families; trace information spread through social networks</li></ul><p><strong>Pillar 5: Modding &amp; Extensibility</strong></p><ul><li>Headless core publishes all state as deterministic events</li><li>Clients attach via standardized protocol (WebSocket + JSON schema)</li><li>Scenarios defined as YAML bundles: map seed, starting institutions, policy packs, victory conditions</li><li>Extensibility points: custom resource types, custom policies, custom objectives</li></ul><hr><h2 id="part-2-core-gameplay-loop" tabindex="-1">Part 2: Core Gameplay Loop <a class="header-anchor" href="#part-2-core-gameplay-loop" aria-label="Permalink to &quot;Part 2: Core Gameplay Loop&quot;">​</a></h2><h3 id="_2-1-the-three-zoom-architecture" tabindex="-1">2.1 The Three-Zoom Architecture <a class="header-anchor" href="#_2-1-the-three-zoom-architecture" aria-label="Permalink to &quot;2.1 The Three-Zoom Architecture&quot;">​</a></h3><p><strong>Zoom 1: Strategic (Nation Level)</strong></p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Time horizon: Quarters (25 ticks = 1 year, 1 tick ≈ 2 weeks)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Player actions per quarter:</span></span>
<span class="line"><span>  - Declare war / sign treaties</span></span>
<span class="line"><span>  - Adjust nation-level tax/tariff rates</span></span>
<span class="line"><span>  - Hire/fire government officials</span></span>
<span class="line"><span>  - Allocate research budget to tech tree</span></span>
<span class="line"><span>  - Set immigration policy</span></span>
<span class="line"><span>  - Manage treasury reserves</span></span>
<span class="line"><span>  - Establish/dissolve institutions</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Key metrics visible:</span></span>
<span class="line"><span>  - Total GDP, per-capita wealth</span></span>
<span class="line"><span>  - Stability index (0-100, collapse at &lt;10)</span></span>
<span class="line"><span>  - Ideological alignment (democracy, autocracy, theocracy)</span></span>
<span class="line"><span>  - Military strength (army composition, readiness)</span></span>
<span class="line"><span>  - Population (total, by class/ethnicity/religion)</span></span>
<span class="line"><span>  - Energy reserves (current, days-of-supply)</span></span>
<span class="line"><span>  - Treasury (cash, debt, credit rating)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Victory conditions measured at this level.</span></span></code></pre></div><p><strong>Zoom 2: Tactical (City/Region Level)</strong></p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Time horizon: Months (5-10 ticks = 1 month decision)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Player actions per month (per city):</span></span>
<span class="line"><span>  - Assign population to work (farms, factories, mines, services)</span></span>
<span class="line"><span>  - Build/destroy buildings (housing, factories, barracks, temples)</span></span>
<span class="line"><span>  - Levy taxes locally</span></span>
<span class="line"><span>  - Manage local security (militia recruitment, crime suppression)</span></span>
<span class="line"><span>  - Negotiate local peace (if city under siege)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Key metrics visible (per city):</span></span>
<span class="line"><span>  - Population (by class, employment, happiness)</span></span>
<span class="line"><span>  - Production chains (food, clothes, weapons, luxury goods)</span></span>
<span class="line"><span>  - Energy production/consumption</span></span>
<span class="line"><span>  - Health, education, crime rates</span></span>
<span class="line"><span>  - Housing shortage / overcrowding</span></span>
<span class="line"><span>  - Trade partners (what goods in/out)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Automated sub-loop (each tick):</span></span>
<span class="line"><span>  - Citizens work in assigned jobs (producing goods)</span></span>
<span class="line"><span>  - Consumption happens (happiness gained/lost based on consumption)</span></span>
<span class="line"><span>  - Births/deaths based on happiness, healthcare</span></span>
<span class="line"><span>  - Migration (unhappy citizens flee to happier cities)</span></span>
<span class="line"><span>  - Crime/unrest if stability &lt; threshold</span></span></code></pre></div><p><strong>Zoom 3: Simulation (Individual Citizen)</strong></p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Time horizon: Ticks (1 tick ≈ 2 weeks real-time)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Observer mode (research):</span></span>
<span class="line"><span>  - Watch individual citizen&#39;s happiness trajectory</span></span>
<span class="line"><span>  - Track which events caused happiness change</span></span>
<span class="line"><span>  - View citizen&#39;s information network (what rumors they&#39;ve heard)</span></span>
<span class="line"><span>  - See education progression (apprentice → journeyman → master)</span></span>
<span class="line"><span>  - Observe family relations (spouse, children, parents)</span></span>
<span class="line"><span>  - Track wealth accumulation (job income, inheritance, taxes paid)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>NOT player-controlled (citizens have agency):</span></span>
<span class="line"><span>  - Citizens choose jobs based on happiness, skill, location</span></span>
<span class="line"><span>  - Citizens migrate if better opportunity elsewhere</span></span>
<span class="line"><span>  - Citizens marry/have children autonomously</span></span>
<span class="line"><span>  - Citizens may rebel if sufficiently unhappy</span></span>
<span class="line"><span>  - Citizens spread rumors/information through social networks</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Metrics visible:</span></span>
<span class="line"><span>  - Individual happiness (baseline 50, range 0-100)</span></span>
<span class="line"><span>  - Skills (farming, combat, trade, governance)</span></span>
<span class="line"><span>  - Information state (what rumors they believe)</span></span>
<span class="line"><span>  - Family tree (ancestry, descendants)</span></span>
<span class="line"><span>  - Wealth (personal savings, property, debt)</span></span>
<span class="line"><span>  - Allegiance (to nation, to faction, to institution)</span></span></code></pre></div><h3 id="_2-2-the-main-game-loop-per-tick" tabindex="-1">2.2 The Main Game Loop (Per Tick) <a class="header-anchor" href="#_2-2-the-main-game-loop-per-tick" aria-label="Permalink to &quot;2.2 The Main Game Loop (Per Tick)&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>TICK EXECUTION (happens every ~2 real-time weeks OR every decision round in strategy mode)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Phase 1: Demographics (O(population) cost)</span></span>
<span class="line"><span>──────────────────────────────────────────</span></span>
<span class="line"><span>For each city:</span></span>
<span class="line"><span>  For each citizen:</span></span>
<span class="line"><span>    - Decide birth/death based on happiness, healthcare, food access</span></span>
<span class="line"><span>    - Decide migration to other cities (if happiness too low)</span></span>
<span class="line"><span>  Update city population, age distribution</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Event: citizen.born.v1, citizen.died.v1, citizen.migrated.v1</span></span>
<span class="line"><span></span></span>
<span class="line"><span></span></span>
<span class="line"><span>Phase 2: Production (O(buildings) cost)</span></span>
<span class="line"><span>───────────────────────────────────────</span></span>
<span class="line"><span>For each city:</span></span>
<span class="line"><span>  For each production building (farm, factory, mine):</span></span>
<span class="line"><span>    - Apply assigned workers</span></span>
<span class="line"><span>    - Consume energy and raw materials</span></span>
<span class="line"><span>    - Produce output (food, goods, weapons)</span></span>
<span class="line"><span>    - Generate pollution (CO2, waste)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Event: production.completed.v1, resource.produced.v1</span></span>
<span class="line"><span></span></span>
<span class="line"><span></span></span>
<span class="line"><span>Phase 3: Trade &amp; Logistics (O(trade_routes) cost)</span></span>
<span class="line"><span>──────────────────────────────────────────────────</span></span>
<span class="line"><span>For each trade route between cities:</span></span>
<span class="line"><span>  - Execute pending trades (if both sides have goods)</span></span>
<span class="line"><span>  - Update prices based on supply/demand</span></span>
<span class="line"><span>  - Move goods via logistical network (costs energy)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Event: trade.executed.v1, price.updated.v1</span></span>
<span class="line"><span></span></span>
<span class="line"><span></span></span>
<span class="line"><span>Phase 4: Consumption &amp; Happiness (O(population) cost)</span></span>
<span class="line"><span>──────────────────────────────────────────────────────</span></span>
<span class="line"><span>For each city:</span></span>
<span class="line"><span>  For each citizen:</span></span>
<span class="line"><span>    - Determine consumption basket (food, clothing, luxury)</span></span>
<span class="line"><span>    - Update happiness based on:</span></span>
<span class="line"><span>      * Consumption levels (rich diet +20, poor diet -20)</span></span>
<span class="line"><span>      * Job satisfaction (10 to -30 depending on role)</span></span>
<span class="line"><span>      * Crime (victim? -50; criminal? +20)</span></span>
<span class="line"><span>      * Health (sick? -30; healthy? +5)</span></span>
<span class="line"><span>      * Ideology match (if nation ideology matches personal: +10, else -5)</span></span>
<span class="line"><span>      * Social status (slave/serf: -50, merchant: +10, noble: +20)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Event: citizen.consumption.v1, citizen.happiness_updated.v1</span></span>
<span class="line"><span></span></span>
<span class="line"><span></span></span>
<span class="line"><span>Phase 5: Policy Evaluation (O(population * policies) cost)</span></span>
<span class="line"><span>──────────────────────────────────────────────────────────</span></span>
<span class="line"><span>For each active policy in government:</span></span>
<span class="line"><span>  - Check if conditions are met (e.g., &quot;if stability &lt; 50 and unrest &gt; 20%&quot;)</span></span>
<span class="line"><span>  - Execute policy effects (e.g., &quot;increase tax by 5%&quot;, &quot;recruit army&quot;, &quot;suppress unrest&quot;)</span></span>
<span class="line"><span>  - Record policy application and citizen reactions</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Example policies:</span></span>
<span class="line"><span>  - Tax increase → happiness -5, treasury +income</span></span>
<span class="line"><span>  - Military draft → happiness -20 for drafted, +military strength</span></span>
<span class="line"><span>  - Trade embargo → happiness -10, trade revenue -50%</span></span>
<span class="line"><span>  - Revolution: if stability &lt; 10 and rebellious_pop &gt; 50%, trigger war</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Event: policy.evaluated.v1, policy.applied.v1</span></span>
<span class="line"><span></span></span>
<span class="line"><span></span></span>
<span class="line"><span>Phase 6: Diplomacy &amp; Conflict (O(nations) cost)</span></span>
<span class="line"><span>────────────────────────────────────────────────</span></span>
<span class="line"><span>For each pair of neighboring nations:</span></span>
<span class="line"><span>  - Evaluate casus belli (territorial dispute, resource conflict, ideological)</span></span>
<span class="line"><span>  - If war declared: start combat phase (resolve battles)</span></span>
<span class="line"><span>  - If peace treaty up for renewal: renegotiate</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Event: war.declared.v1, battle.started.v1, treaty.signed.v1</span></span>
<span class="line"><span></span></span>
<span class="line"><span></span></span>
<span class="line"><span>Phase 7: Energy Accounting (O(cities) cost)</span></span>
<span class="line"><span>────────────────────────────────────────────</span></span>
<span class="line"><span>Global energy balance check:</span></span>
<span class="line"><span>  total_produced = sum of (solar, wind, coal, nuclear per city)</span></span>
<span class="line"><span>  total_consumed = sum of (production, transport, home heating per city)</span></span>
<span class="line"><span>  net_balance = total_produced - total_consumed</span></span>
<span class="line"><span></span></span>
<span class="line"><span>If net_balance &lt; 0:</span></span>
<span class="line"><span>  → energy shortage (10% performance penalty per 1M joules short)</span></span>
<span class="line"><span>  → unhappiness (+10 per citizen if shortage &gt; 20%)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>If total_CO2 &gt; carbon_budget (set by climate policy):</span></span>
<span class="line"><span>  → climate event triggered in next phase</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Event: energy.balanced.v1, energy_shortage.v1</span></span>
<span class="line"><span></span></span>
<span class="line"><span></span></span>
<span class="line"><span>Phase 8: Climate &amp; Disaster Events (probabilistic)</span></span>
<span class="line"><span>───────────────────────────────────────────────────</span></span>
<span class="line"><span>If CO2_budget exceeded:</span></span>
<span class="line"><span>  → roll for climate event (higher CO2 = higher chance)</span></span>
<span class="line"><span>  - Drought (reduce farm output 50% for 2-4 ticks)</span></span>
<span class="line"><span>  - Flood (destroy buildings in flood zone)</span></span>
<span class="line"><span>  - Heat wave (kill elderly, trigger migration)</span></span>
<span class="line"><span>  - Cold snap (reduce energy availability)</span></span>
<span class="line"><span>  - Hurricane (destroy buildings, trigger migration)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Probability curve:</span></span>
<span class="line"><span>  If CO2_ppm &lt; 350: no events</span></span>
<span class="line"><span>  If CO2_ppm 350-450: 1% per tick</span></span>
<span class="line"><span>  If CO2_ppm 450-550: 10% per tick</span></span>
<span class="line"><span>  If CO2_ppm &gt; 550: 50% per tick (catastrophe mode)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Event: climate.event_occurred.v1</span></span>
<span class="line"><span></span></span>
<span class="line"><span></span></span>
<span class="line"><span>Phase 9: Information Spread &amp; Rumors (O(citizens * social_distance) cost)</span></span>
<span class="line"><span>─────────────────────────────────────────────────────────────────────────</span></span>
<span class="line"><span>For each rumor/news event in tick:</span></span>
<span class="line"><span>  - Propagate through social network (citizens tell neighbors)</span></span>
<span class="line"><span>  - Distortion probability (60% -&gt; 80% -&gt; 50% accuracy as spreads)</span></span>
<span class="line"><span>  - Track which beliefs citizens hold</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Example: &quot;King is corrupt&quot; starts with 1 person, spreads to 10% of population</span></span>
<span class="line"><span>  → Ideological unhappiness increases for believers</span></span>
<span class="line"><span>  → If powerful enough, can trigger coup</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Event: information.spread.v1, belief.updated.v1</span></span>
<span class="line"><span></span></span>
<span class="line"><span></span></span>
<span class="line"><span>Phase 10: Insurgency &amp; Internal Conflict (probabilistic)</span></span>
<span class="line"><span>──────────────────────────────────────────────────────────</span></span>
<span class="line"><span>If unrest &gt; 50% or stability &lt; 30:</span></span>
<span class="line"><span>  - Roll for insurgent activity</span></span>
<span class="line"><span>  - Insurgents sabotage production (-5% output)</span></span>
<span class="line"><span>  - Security forces attempt suppression (captures some insurgents, possible collateral)</span></span>
<span class="line"><span>  - If insurgency large enough, triggers civil war</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Event: insurgency.activity.v1, civil_war.triggered.v1</span></span>
<span class="line"><span></span></span>
<span class="line"><span></span></span>
<span class="line"><span>Phase 11: Shadow Networks &amp; Espionage (hidden, event-triggered)</span></span>
<span class="line"><span>────────────────────────────────────────────────────────────────</span></span>
<span class="line"><span>Background: each nation has &quot;shadow ops budget&quot; (hidden from normal view)</span></span>
<span class="line"><span>  - If budget available:</span></span>
<span class="line"><span>    - Attempt sabotage on enemy tech tree (roll success chance)</span></span>
<span class="line"><span>    - Attempt intelligence gathering (learn about enemy troop positions)</span></span>
<span class="line"><span>    - Attempt assassination of enemy leader (very rare, high risk)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Player only sees results: &quot;Enemy tech tree slowed by 10 ticks&quot; or &quot;Our leader assassinated!&quot;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Event: shadow.operation_attempted.v1, shadow.operation_result.v1</span></span>
<span class="line"><span></span></span>
<span class="line"><span></span></span>
<span class="line"><span>Phase 12: End-of-Tick Reporting</span></span>
<span class="line"><span>────────────────────────────────</span></span>
<span class="line"><span>Aggregate all events from tick into daily/weekly report:</span></span>
<span class="line"><span>  - Revenue/expenses summary</span></span>
<span class="line"><span>  - Population changes (births, deaths, migration)</span></span>
<span class="line"><span>  - Production changes</span></span>
<span class="line"><span>  - Unrest/stability changes</span></span>
<span class="line"><span>  - Diplomatic actions</span></span>
<span class="line"><span>  - Military movements</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Update metrics dashboards (visible in UI).</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Event: tick.completed.v1</span></span></code></pre></div><p><strong>Performance Budget:</strong></p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Total tick execution target: &lt; 1 second wall-clock time (for fast-forward)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Complexity Analysis:</span></span>
<span class="line"><span>  Population size (N): typically 500K-5M</span></span>
<span class="line"><span>  Cities (C): typically 10-50</span></span>
<span class="line"><span>  Nations (K): typically 5-10</span></span>
<span class="line"><span>  Total actors (A): N + C + K ≈ mostly N</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Phase 1 (Demographics): O(N) → ~500ms for 5M pop</span></span>
<span class="line"><span>Phase 2 (Production): O(C) → ~10ms</span></span>
<span class="line"><span>Phase 3 (Trade): O(C^2) → ~100ms for 50 cities</span></span>
<span class="line"><span>Phase 4 (Consumption &amp; Happiness): O(N) → ~500ms</span></span>
<span class="line"><span>Phase 5 (Policy eval): O(P * C) where P=policies → ~50ms for 10 policies × 50 cities</span></span>
<span class="line"><span>Phase 6 (Diplomacy): O(K^2) → ~1ms for 10 nations</span></span>
<span class="line"><span>Phase 7 (Energy): O(C) → ~20ms</span></span>
<span class="line"><span>Phase 8-12: O(events logged) → ~50ms</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Total: ~1.2 seconds per tick (acceptable)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Optimization: run phases 1-4 asynchronously if tick frequency &gt; 2/sec</span></span></code></pre></div><hr><h2 id="part-3-economy-systems" tabindex="-1">Part 3: Economy Systems <a class="header-anchor" href="#part-3-economy-systems" aria-label="Permalink to &quot;Part 3: Economy Systems&quot;">​</a></h2><h3 id="_3-1-the-three-allocator-regimes-civ-0100" tabindex="-1">3.1 The Three Allocator Regimes (CIV-0100) <a class="header-anchor" href="#_3-1-the-three-allocator-regimes-civ-0100" aria-label="Permalink to &quot;3.1 The Three Allocator Regimes (CIV-0100)&quot;">​</a></h3><p>CivLab supports three distinct economic systems; player chooses one (or blends) at nation founding.</p><h4 id="regime-a-market-economy" tabindex="-1"><strong>Regime A: Market Economy</strong> <a class="header-anchor" href="#regime-a-market-economy" aria-label="Permalink to &quot;**Regime A: Market Economy**&quot;">​</a></h4><p><strong>Core Mechanism</strong>: Price signals drive production and consumption.</p><p><strong>Price Discovery</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>For each good type (food, cloth, weapon, luxury):</span></span>
<span class="line"><span>  supply_this_tick = produced_units - consumed_units</span></span>
<span class="line"><span>  price_change = supply_this_tick / baseline_supply_quantity</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  price_t+1 = price_t * (1 + price_change)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Example:</span></span>
<span class="line"><span>  Food production: 10,000 units/tick</span></span>
<span class="line"><span>  Food consumption: 12,000 units/tick</span></span>
<span class="line"><span>  Supply: -2,000 (shortage)</span></span>
<span class="line"><span>  Price change: -2,000 / 10,000 = -0.2 → price_t+1 = 1.2 * price_t (20% increase)</span></span></code></pre></div><p><strong>Production Decisions</strong> (worker autonomy):</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>For each citizen with &quot;worker&quot; status:</span></span>
<span class="line"><span>  Evaluate each production job available in city:</span></span>
<span class="line"><span>    expected_wages = base_wage[job] * (1 + skill_bonus)</span></span>
<span class="line"><span>    cost_of_living = current_prices[food] + current_prices[clothing]</span></span>
<span class="line"><span>    profit = expected_wages - cost_of_living</span></span>
<span class="line"><span>    happiness_boost = happiness_bonus[job] - unhappiness[job_conditions]</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  Choose job with highest (profit + 0.5 * happiness_boost)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>  If no job profitable: migrate to other city or become unemployed (unhappy)</span></span></code></pre></div><p><strong>Merchant Networks</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Each city has &quot;merchants&quot; (specialized class)</span></span>
<span class="line"><span>  - They buy low, sell high (arbitrage)</span></span>
<span class="line"><span>  - They maintain trade routes</span></span>
<span class="line"><span>  - They negotiate contracts with other cities</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Profit motive: merchants keep 10% of trade profit (incentive to trade)</span></span>
<span class="line"><span>Social cost: if merchants hoard, can trigger regulation → taxes on trade</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Dynamic: free market with price controls available as policy tool</span></span></code></pre></div><p><strong>Key Properties</strong>:</p><ul><li>✓ Efficient: prices converge to equilibrium quickly</li><li>✓ Emergent: trade networks form without scripting</li><li>✗ Unstable: boom/bust cycles, unemployment</li><li>✗ Unequal: wealth concentrates, gini coefficient rises</li></ul><p><strong>Player Levers</strong>:</p><ul><li>Tax production/consumption (raise revenue, distort prices)</li><li>Tariffs on imports (protect local industry, reduce trade)</li><li>Wage controls (help poor, reduce merchant profit)</li><li>Price caps (prevent gouging, create shortages)</li></ul><hr><h4 id="regime-b-planned-economy" tabindex="-1"><strong>Regime B: Planned Economy</strong> <a class="header-anchor" href="#regime-b-planned-economy" aria-label="Permalink to &quot;**Regime B: Planned Economy**&quot;">​</a></h4><p><strong>Core Mechanism</strong>: Central planner sets production quotas and consumption allocations.</p><p><strong>Central Plan</strong> (updated annually):</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Planner specifies target allocation for each good:</span></span>
<span class="line"><span>  target_food_production = 12,000 units/year</span></span>
<span class="line"><span>  target_cloth_production = 5,000 units/year</span></span>
<span class="line"><span>  target_weapon_production = 500 units/year</span></span>
<span class="line"><span>  target_luxury_production = 200 units/year</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Planner also specifies consumption ration (per citizen class):</span></span>
<span class="line"><span>  food_ration[farmer] = 8 units/month (subsistence)</span></span>
<span class="line"><span>  food_ration[merchant] = 12 units/month (comfortable)</span></span>
<span class="line"><span>  food_ration[noble] = 20 units/month (luxury)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Workers are assigned to production jobs to hit targets.</span></span>
<span class="line"><span>Consumers receive rations regardless of job/wealth.</span></span></code></pre></div><p><strong>Central Coordination Cost</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Coordination overhead per citizen per year:</span></span>
<span class="line"><span>  base_cost = 0.001 (0.1% of production)</span></span>
<span class="line"><span>  + inefficiency = 5% if plan targets &gt; actual capacity</span></span>
<span class="line"><span>  + corruption = 2% (black market reduces observed production)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Total efficiency penalty: 7-10% (planned economy produces 90-93% of potential)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Example: if planned economy is implemented, total GDP reduced by ~7%</span></span>
<span class="line"><span>But: wealth is more equitably distributed (gini coefficient lower)</span></span></code></pre></div><p><strong>Information Problem</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Planner cannot perfectly observe:</span></span>
<span class="line"><span>  - Actual production capacity per city</span></span>
<span class="line"><span>  - Worker true preferences</span></span>
<span class="line"><span>  - Hidden consumption (black market)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Solution: set targets conservatively (80% of theoretical max)</span></span>
<span class="line"><span>         monitor via audit (catches 50% of black market)</span></span>
<span class="line"><span>         adjust targets yearly based on feedback</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Failure mode: if planner targets too high, shortages trigger unrest</span></span></code></pre></div><p><strong>Worker Motivation</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Workers in planned economy don&#39;t earn wages (assigned jobs).</span></span>
<span class="line"><span>Instead, they receive:</span></span>
<span class="line"><span>  - Basic rations (guaranteed)</span></span>
<span class="line"><span>  - Ideological reward (if they believe in communism)</span></span>
<span class="line"><span>  - Status (if promoted to planner role)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Happiness formula for planned economy workers:</span></span>
<span class="line"><span>  happiness = 50 + ration_level - job_difficulty - ideology_mismatch</span></span>
<span class="line"><span></span></span>
<span class="line"><span>So: a farmer believing in communism can be happy even with low rations</span></span>
<span class="line"><span>But: a merchant in communism is unhappy (forced to give up profit)</span></span></code></pre></div><p><strong>Key Properties</strong>:</p><ul><li>✓ Stable: no unemployment, no boom/bust</li><li>✓ Equitable: gini coefficient stays low</li><li>✗ Inefficient: 7-10% production penalty</li><li>✗ Brittle: if plan overestimated, cascading shortage</li></ul><p><strong>Player Levers</strong>:</p><ul><li>Adjust production targets (reallocation between goods)</li><li>Adjust consumption rations (redistribute wealth)</li><li>Promote/demote planners (affects corruption rate)</li><li>Black market legalization (trade off efficiency vs. freedom)</li></ul><hr><h4 id="regime-c-joule-economy-energy-backed" tabindex="-1"><strong>Regime C: Joule Economy (Energy-Backed)</strong> <a class="header-anchor" href="#regime-c-joule-economy-energy-backed" aria-label="Permalink to &quot;**Regime C: Joule Economy (Energy-Backed)**&quot;">​</a></h4><p><strong>Core Mechanism</strong>: All value ultimately derived from energy (Joules).</p><p><strong>Currency Backing</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>1 unit of money ≡ 1 Joule of energy storage capacity</span></span>
<span class="line"><span>  (i.e., money is a claim on the energy reserve)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Energy reserve = all stored energy (batteries, reserves, coal, oil)</span></span>
<span class="line"><span>Money supply = total currency in circulation</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Requirement: Money_supply &lt;= Energy_reserve * 2</span></span>
<span class="line"><span>            (2x backing allows economic growth)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>If Energy_reserve drops:</span></span>
<span class="line"><span>  → Money supply must contract (deflation)</span></span>
<span class="line"><span>  → Central bank withdraws currency via taxation</span></span>
<span class="line"><span>  → Unhappiness due to deflation (people feel poorer)</span></span></code></pre></div><p><strong>Energy as Lifeblood</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Every production activity costs energy:</span></span>
<span class="line"><span>  - Farm output per worker: F joules → produces 10 food units</span></span>
<span class="line"><span>  - Factory output per worker: 2F joules → produces 1 weapon</span></span>
<span class="line"><span>  - Service output per worker: 0.5F joules → 1 happiness unit</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Trade also costs energy (transport).</span></span>
<span class="line"><span></span></span>
<span class="line"><span>If energy shortage:</span></span>
<span class="line"><span>  → production halts (no power)</span></span>
<span class="line"><span>  → all economic activity stops</span></span>
<span class="line"><span>  → civilization enters &quot;emergency mode&quot;</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Emergency mode triggers:</span></span>
<span class="line"><span>  - Ration consumption to survivable minimum</span></span>
<span class="line"><span>  - Suspend non-essential production</span></span>
<span class="line"><span>  - Accept any peace terms (can&#39;t sustain war)</span></span></code></pre></div><p><strong>Carbon Budget &amp; Climate Integration</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Joule economy explicitly ties energy source to climate impact:</span></span>
<span class="line"><span>  - Coal: 100 Joules energy, 0.5 kg CO2/Joule</span></span>
<span class="line"><span>  - Oil: 100 Joules energy, 0.4 kg CO2/Joule</span></span>
<span class="line"><span>  - Gas: 100 Joules energy, 0.25 kg CO2/Joule</span></span>
<span class="line"><span>  - Nuclear: 100 Joules energy, 0.01 kg CO2/Joule (waste storage cost)</span></span>
<span class="line"><span>  - Solar: 100 Joules energy, 0.0 kg CO2/Joule</span></span>
<span class="line"><span>  - Wind: 100 Joules energy, 0.0 kg CO2/Joule</span></span>
<span class="line"><span>  - Hydro: 100 Joules energy, 0.0 kg CO2/Joule</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Nation&#39;s total CO2 = sum of (energy_from_source * emission_factor)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>If national_CO2 &gt; global_carbon_budget:</span></span>
<span class="line"><span>  → climate event probability increases</span></span>
<span class="line"><span>  → other nations pressure for climate action</span></span>
<span class="line"><span>  → may trigger &quot;climate war&quot; (carbon trading disputes)</span></span></code></pre></div><p><strong>Key Properties</strong>:</p><ul><li>✓ Physically realistic: energy is the fundamental constraint</li><li>✓ Tight integration with climate system</li><li>✗ Complex: players must manage energy mix AND economic policy</li><li>✗ Can be brittle: energy crisis → instant collapse</li></ul><p><strong>Player Levers</strong>:</p><ul><li>Energy source selection (coal = cheap but dirty; solar = expensive but clean)</li><li>Investment in renewable infrastructure</li><li>Trade energy with neighbors (import oil, export excess solar)</li><li>Manage currency supply relative to energy reserve</li><li>Negotiate international carbon budget allocation</li></ul><hr><h3 id="_3-2-trade-mechanics-global-economy" tabindex="-1">3.2 Trade Mechanics &amp; Global Economy <a class="header-anchor" href="#_3-2-trade-mechanics-global-economy" aria-label="Permalink to &quot;3.2 Trade Mechanics &amp; Global Economy&quot;">​</a></h3><p><strong>Trade Routes</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Each city can maintain up to (pop_size / 100K) active trade routes.</span></span>
<span class="line"><span>Trade route = bilateral agreement to exchange goods regularly.</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Example:</span></span>
<span class="line"><span>  Northern City (wheat surplus) ↔ Southern City (metals surplus)</span></span>
<span class="line"><span>  Quarterly trade: 500 wheat ← 100 metals</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Trade contract terms:</span></span>
<span class="line"><span>  - Exchange ratio (5 wheat per 1 metal)</span></span>
<span class="line"><span>  - Duration (1-10 years)</span></span>
<span class="line"><span>  - Price adjustments (fixed vs. floating)</span></span>
<span class="line"><span>  - Penalties for breach (lose reputation, war risk)</span></span></code></pre></div><p><strong>Trade Network Topology</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Graph structure: cities are nodes, trade routes are edges</span></span>
<span class="line"><span>Emergent properties:</span></span>
<span class="line"><span>  - Hub cities (connected to 20+ others) become wealthy</span></span>
<span class="line"><span>  - Peripheral cities depend on hub merchants</span></span>
<span class="line"><span>  - Disruption of hub (war, blockade) cascades through network</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Strategic implication:</span></span>
<span class="line"><span>  - Control trade hubs → control economy</span></span>
<span class="line"><span>  - Embargo a hub → damage 10+ downstream cities</span></span></code></pre></div><p><strong>Merchant Behavior</strong> (AI):</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Each city has 1-3 &quot;merchant&quot; NPCs (if market economy).</span></span>
<span class="line"><span>Merchants are profit-seeking:</span></span>
<span class="line"><span>  - Seek arbitrage opportunities (buy cheap → sell expensive)</span></span>
<span class="line"><span>  - Establish new trade routes if profitable</span></span>
<span class="line"><span>  - Maintain reputation (breach contracts damages future deals)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Merchant effectiveness = base_skill + experience</span></span>
<span class="line"><span>  - New merchant: 50% success on new route</span></span>
<span class="line"><span>  - Experienced merchant: 90% success</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Player can:</span></span>
<span class="line"><span>  - Hire merchant (cost: 100g/year salary)</span></span>
<span class="line"><span>  - Send merchant to foreign city to establish trade</span></span>
<span class="line"><span>  - Recall merchant if underperforming</span></span></code></pre></div><hr><h3 id="_3-3-money-banking-system" tabindex="-1">3.3 Money &amp; Banking System <a class="header-anchor" href="#_3-3-money-banking-system" aria-label="Permalink to &quot;3.3 Money &amp; Banking System&quot;">​</a></h3><p><strong>Currency System</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Default currency name = &quot;Drachma&quot; (player can rename)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Denominations:</span></span>
<span class="line"><span>  - 1 copper penny (base unit)</span></span>
<span class="line"><span>  - 10 pennies = 1 silver drachma</span></span>
<span class="line"><span>  - 100 drachmas = 1 gold piece</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Inflation/deflation:</span></span>
<span class="line"><span>  - If money_supply grows faster than GDP: inflation (prices rise)</span></span>
<span class="line"><span>  - If money_supply shrinks: deflation (prices fall, unhappiness)</span></span>
<span class="line"><span>  - Target inflation rate: 2% per year (allows growth)</span></span></code></pre></div><p><strong>Banking &amp; Lending</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Banks are institutions that:</span></span>
<span class="line"><span>  - Accept deposits (pay interest, currently 1% per year)</span></span>
<span class="line"><span>  - Make loans (charge interest, currently 5% per year)</span></span>
<span class="line"><span>  - Facilitate trade credit (short-term loans for merchants)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Bank capital requirement: 10% of outstanding loans</span></span>
<span class="line"><span>If capital falls below requirement: bank fails → financial crisis</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Player decisions:</span></span>
<span class="line"><span>  - Regulate interest rates (cap lending rates → cheaper loans but fewer available)</span></span>
<span class="line"><span>  - Reserve requirements (higher reserves → safer but slower growth)</span></span>
<span class="line"><span>  - Bail out failing banks (costs treasury but prevents crisis) vs. let fail (reset, crisis)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Banking stability is automatic unless player intervenes with regulations.</span></span></code></pre></div><p><strong>National Debt &amp; Credit Rating</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>National credit rating (AAA to D):</span></span>
<span class="line"><span>  - Based on: debt/GDP ratio, payment history, political stability</span></span>
<span class="line"><span>  - Affects: interest rates on future borrowing, trade reputation</span></span>
<span class="line"><span></span></span>
<span class="line"><span>If nation defaults on debt:</span></span>
<span class="line"><span>  - Immediate: interest rates spike, trade partners demand payment</span></span>
<span class="line"><span>  - Long-term: 10-year reputation penalty, harder to borrow</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Debt management:</span></span>
<span class="line"><span>  - Borrow cheap early, pay back later (if revenues grow)</span></span>
<span class="line"><span>  - Risk: if revenues drop, debt becomes unsustainable</span></span>
<span class="line"><span>  - Military solution (controversial): wage war to seize creditor&#39;s assets</span></span></code></pre></div><hr><h2 id="part-4-war-diplomacy-shadow-networks" tabindex="-1">Part 4: War, Diplomacy &amp; Shadow Networks <a class="header-anchor" href="#part-4-war-diplomacy-shadow-networks" aria-label="Permalink to &quot;Part 4: War, Diplomacy &amp; Shadow Networks&quot;">​</a></h2><h3 id="_4-1-casus-belli-reasons-for-war" tabindex="-1">4.1 Casus Belli (Reasons for War) <a class="header-anchor" href="#_4-1-casus-belli-reasons-for-war" aria-label="Permalink to &quot;4.1 Casus Belli (Reasons for War)&quot;">​</a></h3><p>War is not automatic; player must declare with a valid reason:</p><p><strong>Standard Casus Belli Types:</strong></p><table tabindex="0"><thead><tr><th>Type</th><th>Trigger</th><th>Stability Cost</th><th>War Support %</th></tr></thead><tbody><tr><td>Territorial Dispute</td><td>Border conflict or expansion claim</td><td>Low</td><td>60%</td></tr><tr><td>Religious Conflict</td><td>Different state religion, inquisition</td><td>Low-Med</td><td>50%</td></tr><tr><td>Trade War</td><td>Economic embargo or unfair tariffs</td><td>Low</td><td>40%</td></tr><tr><td>Succession</td><td>Rival claim on enemy throne</td><td>Med</td><td>70% (if popular)</td></tr><tr><td>Ideological War</td><td>Incompatible ideologies (monarchy vs. democracy)</td><td>Med</td><td>50%</td></tr><tr><td>Imperial Expansion</td><td>&quot;Civilizing mission&quot; (colonialism)</td><td>High</td><td>30%</td></tr><tr><td>Defensive War</td><td>Enemy declared on you (provoked)</td><td>Negative</td><td>85%</td></tr><tr><td>Tributary War</td><td>Subjugate enemy as vassal</td><td>High</td><td>20%</td></tr></tbody></table><p><strong>War Support Mechanic</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Player declares war, but support from population matters:</span></span>
<span class="line"><span>  national_support = base_support[casus_belli]</span></span>
<span class="line"><span>                   + 10 * ideology_match_with_war_type</span></span>
<span class="line"><span>                   - 20 * if_population_scared_of_enemy_army</span></span>
<span class="line"><span>                   - 15 * if_ongoing_internal_conflict</span></span>
<span class="line"><span></span></span>
<span class="line"><span>If support &lt; 30%:</span></span>
<span class="line"><span>  → War is unpopular; unrest increases 20%/month</span></span>
<span class="line"><span>  → Can trigger civil war if support &lt; 10%</span></span>
<span class="line"><span></span></span>
<span class="line"><span>If support &gt; 70%:</span></span>
<span class="line"><span>  → War is popular; morale bonus to army; production efficiency +10%</span></span></code></pre></div><h3 id="_4-2-military-battles" tabindex="-1">4.2 Military &amp; Battles <a class="header-anchor" href="#_4-2-military-battles" aria-label="Permalink to &quot;4.2 Military &amp; Battles&quot;">​</a></h3><p><strong>Army Composition</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Each nation maintains multiple armies (1-10 depending on size).</span></span>
<span class="line"><span>Each army consists of:</span></span>
<span class="line"><span>  - Infantry (sword/spear units)</span></span>
<span class="line"><span>  - Cavalry (mounted units, fast but weak)</span></span>
<span class="line"><span>  - Archers (ranged, weak in melee)</span></span>
<span class="line"><span>  - Siege equipment (for assaults on forts)</span></span>
<span class="line"><span>  - Supply train (carries food, logistics)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Example army: 5,000 infantry + 1,000 cavalry + 500 archers + supply</span></span>
<span class="line"><span>  - Cost to maintain: 50g/month (food, weapons, wages)</span></span>
<span class="line"><span>  - Morale: 50-100 (affected by recent victories, supply levels)</span></span>
<span class="line"><span>  - Readiness: 0-100 (affected by training, rest, discipline)</span></span></code></pre></div><p><strong>Battle Resolution</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>When armies meet:</span></span>
<span class="line"><span>  1. Terrain check: modifier to both sides (-10 to +20)</span></span>
<span class="line"><span>  2. Morale check: armies with low morale rout/flee</span></span>
<span class="line"><span>  3. Combat calculation:</span></span>
<span class="line"><span>       attacker_strength = size * morale * discipline * 0.01</span></span>
<span class="line"><span>       defender_strength = size * morale * terrain_bonus * 0.01</span></span>
<span class="line"><span>       roll = d100 (deterministic from RNG seed)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>       if roll &lt; attacker_strength / (attacker + defender):</span></span>
<span class="line"><span>         attacker wins → defender routs</span></span>
<span class="line"><span>       else:</span></span>
<span class="line"><span>         defender holds or routs (damage to both sides)</span></span>
<span class="line"><span>  4. Casualty calculation: 5-20% of losing side dies, rest routs/captured</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Outcome: victor gains territory, loser loses army strength</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Siege (special case):</span></span>
<span class="line"><span>  - Attacking army must reduce castle fortifications</span></span>
<span class="line"><span>  - Takes weeks; supply becomes critical (attacker vulnerable)</span></span>
<span class="line"><span>  - Defender can attempt breakout or negotiated surrender</span></span></code></pre></div><p><strong>War Costs</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Monthly war expenses:</span></span>
<span class="line"><span>  - Army maintenance: 50g per 1000 troops</span></span>
<span class="line"><span>  - Logistics: additional 20% of maintenance cost (transport)</span></span>
<span class="line"><span>  - Fortification repairs: 10g per fortified city</span></span>
<span class="line"><span>  - Morale maintenance: 5g per army (if morale dropping)</span></span>
<span class="line"><span>  - War loans: if budget insufficient, borrow at 8% interest</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Total: a 10,000-person army costs 500g + 100g logistics + extras = 700g/month</span></span>
<span class="line"><span>       This quickly bankrupts small nations in long wars</span></span></code></pre></div><hr><h3 id="_4-3-diplomacy-alliances" tabindex="-1">4.3 Diplomacy &amp; Alliances <a class="header-anchor" href="#_4-3-diplomacy-alliances" aria-label="Permalink to &quot;4.3 Diplomacy &amp; Alliances&quot;">​</a></h3><p><strong>Alliance Formation</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Nations can form alliances (mutual defense pacts).</span></span>
<span class="line"><span>Each alliance requires:</span></span>
<span class="line"><span>  - Shared ideological interest (within 20 points)</span></span>
<span class="line"><span>  - Trust level (gained by trade, shared enemies, time)</span></span>
<span class="line"><span>  - Alliance fee (each member contributes % of national budget)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Benefits:</span></span>
<span class="line"><span>  - Mutual defense obligation (must join war if ally attacked)</span></span>
<span class="line"><span>  - Trade benefits (reduced tariffs between members)</span></span>
<span class="line"><span>  - Intelligence sharing (learn about threats)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Costs:</span></span>
<span class="line"><span>  - Loss of independence (constrained by alliance votes)</span></span>
<span class="line"><span>  - War participation (may be dragged into wars you don&#39;t want)</span></span>
<span class="line"><span>  - Fee (1-5% of national budget)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Alliance breaks if:</span></span>
<span class="line"><span>  - Members sign contradictory alliances</span></span>
<span class="line"><span>  - One member attacks another</span></span>
<span class="line"><span>  - Trust drops below threshold</span></span>
<span class="line"><span>  - Voted to dissolve (unanimous vote)</span></span></code></pre></div><p><strong>Reputation &amp; Trust</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Each pair of nations has bilateral trust level (0-100):</span></span>
<span class="line"><span>  50 = neutral</span></span>
<span class="line"><span>  &gt; 70 = friendly</span></span>
<span class="line"><span>  &lt; 30 = hostile</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Trust changes due to:</span></span>
<span class="line"><span>  + Trade: +1 trust per 100g annual trade</span></span>
<span class="line"><span>  + Shared enemy: +5 per enemy in common</span></span>
<span class="line"><span>  + Alliance membership: +2 per year</span></span>
<span class="line"><span>  - War: -20 immediate, -10 per year of war</span></span>
<span class="line"><span>  - Broken promises: -50 (very severe)</span></span>
<span class="line"><span>  - Espionage caught: -30</span></span>
<span class="line"><span></span></span>
<span class="line"><span>High trust nations offer better trade deals and cooperate.</span></span>
<span class="line"><span>Low trust nations refuse trade, may embargo, support insurgency.</span></span></code></pre></div><p><strong>Treaties &amp; Negotiation</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Negotiated treaties (peace, trade, research sharing):</span></span>
<span class="line"><span>  - Peace treaty: ends war, defines new borders, reparations</span></span>
<span class="line"><span>  - Trade agreement: specifies goods, prices, duration</span></span>
<span class="line"><span>  - Non-aggression pact: &quot;won&#39;t attack for X years&quot;</span></span>
<span class="line"><span>  - Research sharing: pooled tech tree progress (costs 10% eff, +20% progress)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Negotiation mechanics:</span></span>
<span class="line"><span>  - Proposer: offers terms to counterparty</span></span>
<span class="line"><span>  - Counterparty: accepts, rejects, or counters</span></span>
<span class="line"><span>  - AI evaluation: uses diplomacy algorithm to decide</span></span>
<span class="line"><span>    * Is peace/deal beneficial to us?</span></span>
<span class="line"><span>    * Do we trust this nation?</span></span>
<span class="line"><span>    * Better to hold out for better terms?</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Example peace after war:</span></span>
<span class="line"><span>  Loser offers: 100g reparation + 1 trade route to winner</span></span>
<span class="line"><span>  Winner counters: 200g reparation + 2 trade routes + territorial concession</span></span>
<span class="line"><span>  Loser accepts or rejects (affects future trust)</span></span></code></pre></div><hr><h3 id="_4-4-shadow-networks-covert-operations" tabindex="-1">4.4 Shadow Networks &amp; Covert Operations <a class="header-anchor" href="#_4-4-shadow-networks-covert-operations" aria-label="Permalink to &quot;4.4 Shadow Networks &amp; Covert Operations&quot;">​</a></h3><p><strong>Shadow Network Organization</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Each nation has a hidden network of spies/saboteurs.</span></span>
<span class="line"><span>Network size depends on:</span></span>
<span class="line"><span>  - Government size (larger govt = more resources)</span></span>
<span class="line"><span>  - Corruption level (higher corruption = more spies)</span></span>
<span class="line"><span>  - Budget allocation (player can increase spy budget)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Spy budget (default 2% of national budget):</span></span>
<span class="line"><span>  - Low budget: 10 agents, success rate 30%</span></span>
<span class="line"><span>  - Medium budget (5%): 30 agents, success rate 60%</span></span>
<span class="line"><span>  - High budget (10%): 100 agents, success rate 80%</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Agents specialize in:</span></span>
<span class="line"><span>  - Intelligence: learn about enemy plans, troop positions</span></span>
<span class="line"><span>  - Sabotage: damage enemy production, slow tech research</span></span>
<span class="line"><span>  - Assassination: kill enemy leader (very risky, very expensive)</span></span>
<span class="line"><span>  - Propaganda: spread rumors, lower enemy morale</span></span>
<span class="line"><span>  - Counter-intelligence: detect enemy spies</span></span></code></pre></div><p><strong>Covert Operation Examples</strong>:</p><p><strong>Operation: Intelligence Gathering</strong></p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Goal: Learn about enemy army composition</span></span>
<span class="line"><span>Cost: 10g (one-time)</span></span>
<span class="line"><span>Time: 1-5 weeks (random)</span></span>
<span class="line"><span>Success chance: 60% (if spy budget medium)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>If success:</span></span>
<span class="line"><span>  → Gain &quot;enemy army disposition&quot; intelligence</span></span>
<span class="line"><span>  → See approximate troop numbers, morale</span></span>
<span class="line"><span>  → Useful for planning battles</span></span>
<span class="line"><span></span></span>
<span class="line"><span>If failure:</span></span>
<span class="line"><span>  → Enemy catches spy</span></span>
<span class="line"><span>  → They gain +30 trust with you (think you&#39;re friendly)</span></span>
<span class="line"><span>  → Or -50 trust if they realize it&#39;s espionage</span></span>
<span class="line"><span>  → Spy is lost (no future use)</span></span></code></pre></div><p><strong>Operation: Technological Sabotage</strong></p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Goal: Slow enemy research progress</span></span>
<span class="line"><span>Cost: 50g</span></span>
<span class="line"><span>Time: 2-8 weeks</span></span>
<span class="line"><span>Success chance: 50% (risky)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>If success:</span></span>
<span class="line"><span>  → Enemy&#39;s current tech research slows by 50% for 10 ticks</span></span>
<span class="line"><span>  → Enemy doesn&#39;t know why (hidden effect)</span></span>
<span class="line"><span>  → They eventually discover sabotage if they check logs</span></span>
<span class="line"><span></span></span>
<span class="line"><span>If failure:</span></span>
<span class="line"><span>  → Enemy catches your spy</span></span>
<span class="line"><span>  → They declare this an act of war (war casus belli!)</span></span>
<span class="line"><span>  → Relationship -50</span></span>
<span class="line"><span>  → Possible retaliation</span></span></code></pre></div><p><strong>Operation: Assassination</strong></p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Goal: Kill enemy leader (triggers succession crisis)</span></span>
<span class="line"><span>Cost: 500g (very expensive!)</span></span>
<span class="line"><span>Time: 4-12 weeks (takes longest)</span></span>
<span class="line"><span>Success chance: 20% (very risky)</span></span>
<span class="line"><span>Consequences if caught: -100 relationship, war declaration</span></span>
<span class="line"><span></span></span>
<span class="line"><span>If success:</span></span>
<span class="line"><span>  → Enemy leader dies</span></span>
<span class="line"><span>  → Succession crisis: random heir takes over</span></span>
<span class="line"><span>  → New heir may have different personality, policies, alliances</span></span>
<span class="line"><span>  → Potential civil war in enemy state (chaos, opportunity)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>If failure:</span></span>
<span class="line"><span>  → Enemy catches assassination plot</span></span>
<span class="line"><span>  → Usually automatic war declaration</span></span>
<span class="line"><span>  → Severe diplomatic damage with other nations</span></span>
<span class="line"><span>  → 10-year reputation penalty (very difficult to recover)</span></span></code></pre></div><p><strong>Operation: Propaganda &amp; Rumor-Spreading</strong></p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Goal: Lower enemy morale / trigger rebellion</span></span>
<span class="line"><span>Cost: 20g</span></span>
<span class="line"><span>Time: Ongoing (3+ ticks to take effect)</span></span>
<span class="line"><span>Success chance: 60%</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Operation mechanics:</span></span>
<span class="line"><span>  1. Spread rumor (e.g., &quot;King is corrupt&quot;)</span></span>
<span class="line"><span>  2. Rumor spreads through enemy population (info network)</span></span>
<span class="line"><span>  3. If rumor believed by &gt;20% of population: -5 stability for enemy</span></span>
<span class="line"><span>  4. If believed by &gt;50%: potential coup/civil war</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Player can counter-rumor (cost 10g, spread opposite message)</span></span>
<span class="line"><span>Whichever rumor spreads further wins</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Risks:</span></span>
<span class="line"><span>  - Enemy may discover your propaganda campaign</span></span>
<span class="line"><span>  - Backfires: if seen as foreign meddling, unites population against you</span></span></code></pre></div><hr><h2 id="part-5-modding-extension-api" tabindex="-1">Part 5: Modding &amp; Extension API <a class="header-anchor" href="#part-5-modding-extension-api" aria-label="Permalink to &quot;Part 5: Modding &amp; Extension API&quot;">​</a></h2><h3 id="_5-1-headless-core-architecture" tabindex="-1">5.1 Headless Core Architecture <a class="header-anchor" href="#_5-1-headless-core-architecture" aria-label="Permalink to &quot;5.1 Headless Core Architecture&quot;">​</a></h3><p>CivLab&#39;s core engine is <strong>headless</strong> (no UI), publishing all state and events via a standardized protocol.</p><p><strong>Client Architecture</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────┐</span></span>
<span class="line"><span>│  CIV Headless Core (Rust)               │</span></span>
<span class="line"><span>│  - Simulation engine                    │</span></span>
<span class="line"><span>│  - Event emission                       │</span></span>
<span class="line"><span>│  - State persistence                    │</span></span>
<span class="line"><span>│  - Policy evaluation                    │</span></span>
<span class="line"><span>└────────────────┬────────────────────────┘</span></span>
<span class="line"><span>                 │ [WebSocket JSON Events]</span></span>
<span class="line"><span>      ┌──────────┴──────────┬─────────────┐</span></span>
<span class="line"><span>      │                     │             │</span></span>
<span class="line"><span>   ┌──▼──┐            ┌────▼───┐    ┌───▼──┐</span></span>
<span class="line"><span>   │ Web │            │ Desktop│    │ TUI  │</span></span>
<span class="line"><span>   │ UI  │            │ Client │    │      │</span></span>
<span class="line"><span>   │     │            │        │    │      │</span></span>
<span class="line"><span>   └─────┘            └────────┘    └──────┘</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Clients connect to core via WebSocket.</span></span>
<span class="line"><span>Core emits events; clients render UI locally.</span></span>
<span class="line"><span>Client sends player actions back to core (deterministic execution).</span></span></code></pre></div><p><strong>Event-Driven Protocol</strong>:</p><div class="language-json vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">json</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">Event from core to client:</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">{</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;event_id&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;e-2026-02-21-00123&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;event_type&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;tick.completed.v1&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;timestamp&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;2026-02-21T14:30:00Z&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;tick_number&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">1050</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;payload&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: {</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    &quot;tick_duration_ms&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">750</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    &quot;population_total&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">2500000</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    &quot;gdp_estimate&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">150000000</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    &quot;stability_index&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">72.5</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    &quot;energy_balance&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">45000000</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    &quot;co2_ppm&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">425</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    &quot;events_this_tick&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: [</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      {</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">        &quot;category&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;economy&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">        &quot;summary&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Market cleared: wheat 50g -&gt; 55g&quot;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      {</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">        &quot;category&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;demographics&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">        &quot;summary&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Population: 2.45M -&gt; 2.50M (+55K births, -4K deaths)&quot;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    ]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">Player action (client to core):</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">{</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;action_type&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;declare_war&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;player_nation_id&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;great_britain&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;target_nation_id&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;france&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;casus_belli&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;trade_war&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;timestamp&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;2026-02-21T14:32:15Z&quot;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">Core processes action, emits event confirming war declaration.</span></span></code></pre></div><h3 id="_5-2-scenario-mod-format-yaml" tabindex="-1">5.2 Scenario &amp; Mod Format (YAML) <a class="header-anchor" href="#_5-2-scenario-mod-format-yaml" aria-label="Permalink to &quot;5.2 Scenario &amp; Mod Format (YAML)&quot;">​</a></h3><p><strong>Scenario Bundle</strong>:</p><div class="language-yaml vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">yaml</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># scenarios/historical/napoleonic_wars_1812.yaml</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">name</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Napoleonic Wars: 1812&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">description</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Europe in 1812, at height of Napoleonic Wars&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">version</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;1.0&quot;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Map seed (deterministic map generation)</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">map</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  seed</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">0x1812ABCD</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  size</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;1024x768&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  climate_zone</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;temperate&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  continents</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">2</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Nations &amp; starting state</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">nations</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  france</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    name</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;France&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    color</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;#4169E1&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    leader_name</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Napoleon Bonaparte&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    leader_personality</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;aggressive&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    starting_capital</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: [</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">512</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">400</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    starting_population</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">30000000</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    starting_treasury</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">5000000</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    government_type</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;monarchy&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    ideology</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">75</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # Very monarchist</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    starting_technology</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;iron_working&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;steam_engine&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;military_theory&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  britain</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    name</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Great Britain&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    color</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;#FF0000&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    leader_name</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;King George III&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    starting_capital</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: [</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">200</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">150</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    starting_population</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">12000000</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    starting_treasury</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">3000000</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    government_type</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;constitutional_monarchy&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    ideology</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">60</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    starting_technology</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;iron_working&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;steam_engine&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;naval_dominance&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # ... 5-10 more nations ...</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Global policies (climate, rules)</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">global_policies</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  carbon_budget_limit</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">500</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # ppm CO2 equivalent</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  renewable_adoption_rate</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">0.02</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 2% per year tech drift to renewables</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  natural_disaster_frequency</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;normal&quot;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Initial wars &amp; alliances</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">initial_wars</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  - </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">attacker</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">france</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    defender</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">russia</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    start_tick</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">0</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">initial_alliances</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  - </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">members</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">britain</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">austria</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">russia</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    name</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Coalition Against France&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    duration</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">50</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # ticks</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Victory conditions</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">victory_conditions</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  stability_victory</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    stability_threshold</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">85</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    duration_ticks</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">100</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    description</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Maintain high stability for 4 years&quot;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  territorial_victory</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    min_percentage_controlled</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">60</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    description</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Control 60% of European territory&quot;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  economic_victory</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    gdp_threshold</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">200000000</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">    description</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Achieve GDP of 200M&quot;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Scenario options</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">options</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  game_speed</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;normal&quot;</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # normal, fast, historical_accurate</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  ai_difficulty</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;hard&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  weather_variability</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;high&quot;</span></span></code></pre></div><p><strong>Mod Structure</strong>:</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>my_mod/</span></span>
<span class="line"><span>├── mod.yaml                          # Metadata</span></span>
<span class="line"><span>├── policies/                         # Custom policy definitions</span></span>
<span class="line"><span>│   ├── climate_emergency.yaml</span></span>
<span class="line"><span>│   └── tech_race.yaml</span></span>
<span class="line"><span>├── institutions/                     # Custom institution templates</span></span>
<span class="line"><span>│   ├── revolutionary_committee.yaml</span></span>
<span class="line"><span>│   └── merchant_guild.yaml</span></span>
<span class="line"><span>├── buildings/                        # Custom building definitions</span></span>
<span class="line"><span>│   └── wind_turbine.yaml</span></span>
<span class="line"><span>├── tech_tree/                        # Custom technology definitions</span></span>
<span class="line"><span>│   └── quantum_computing.yaml</span></span>
<span class="line"><span>└── resources/                        # Custom resource types</span></span>
<span class="line"><span>    └── synthetic_fuel.yaml</span></span></code></pre></div><p><strong>Custom Policy Example</strong>:</p><div class="language-yaml vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">yaml</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># my_mod/policies/climate_emergency.yaml</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">name</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Climate Emergency Declaration&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">category</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;governance&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">author</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;player_username&quot;</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">version</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;1.0&quot;</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">preconditions</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  - </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">co2_ppm</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: { </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">min</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">450</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  - </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">stability</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: { </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">min</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">20</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> }  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Can declare even in crisis</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">effects</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  on_enactment</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    - </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">set_global_policy</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;carbon_price_$100_per_ton&quot;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    - </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">research_speed_multiplier</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">1.5</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # Green tech research 50% faster</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    - </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">happiness_change</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">+5</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # Population likes climate action</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    - </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">treasury_cost</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">-100000</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # One-time cost to implement</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  on_tick</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    - </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">coal_production</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: { </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">factor</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">0.8</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> }  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Coal output reduced 20%</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    - </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">renewable_growth</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: { </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">rate</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">0.05</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> }  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Renewable adoption +5%/year</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    - </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">industrial_pollution</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: { </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">factor</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">0.9</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> }  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Pollution down 10%</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">duration</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  min_ticks</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">50</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">  max_ticks</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">1000</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">cancelable</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">true</span></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">cancel_effects</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">:</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  - </span><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">happiness_change</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">-10</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # People upset if you cancel</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#22863A;--shiki-dark:#85E89D;">description</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Declare climate emergency; boost green tech; reduce emissions&quot;</span></span></code></pre></div><hr><h2 id="part-6-game-modes-victory-conditions" tabindex="-1">Part 6: Game Modes &amp; Victory Conditions <a class="header-anchor" href="#part-6-game-modes-victory-conditions" aria-label="Permalink to &quot;Part 6: Game Modes &amp; Victory Conditions&quot;">​</a></h2><h3 id="_6-1-campaign-mode-single-nation" tabindex="-1">6.1 Campaign Mode (Single Nation) <a class="header-anchor" href="#_6-1-campaign-mode-single-nation" aria-label="Permalink to &quot;6.1 Campaign Mode (Single Nation)&quot;">​</a></h3><p><strong>Player Goal</strong>: Achieve one of the victory conditions as a single nation.</p><p><strong>Setup</strong>:</p><ol><li>Choose scenario (historical or generated)</li><li>Choose nation to play</li><li>Set difficulty (AI difficulty, game speed, weather)</li><li>Confirm victory condition</li></ol><p><strong>Gameplay</strong>:</p><ul><li>Play 1-50 years (250-1000 ticks)</li><li>Make strategic decisions (policies, wars, diplomacy)</li><li>Watch emergent events (unrest, disasters, tech breakthroughs)</li><li>Achieve victory or suffer defeat/game-over</li></ul><p><strong>Victory Conditions</strong> (pick one at start):</p><table tabindex="0"><thead><tr><th>Condition</th><th>Parameters</th><th>Typical Duration</th></tr></thead><tbody><tr><td><strong>Stability Victory</strong></td><td>Stability &gt; 80 for 100 ticks</td><td>10-20 years</td></tr><tr><td><strong>Prosperity Victory</strong></td><td>Top-quartile GDP per capita for 50 ticks</td><td>15-25 years</td></tr><tr><td><strong>Territorial Victory</strong></td><td>Control 60% of map</td><td>20-40 years</td></tr><tr><td><strong>Hegemony Victory</strong></td><td>Control 60% of global energy production</td><td>15-30 years</td></tr><tr><td><strong>Diplomatic Victory</strong></td><td>Form alliance with &gt;50% of nations</td><td>10-20 years</td></tr><tr><td><strong>Ideological Victory</strong></td><td>Spread your ideology to &gt;50% of world population</td><td>25-50 years</td></tr><tr><td><strong>Scientific Victory</strong></td><td>Discover final tech (e.g., &quot;Post-Scarcity&quot;)</td><td>30-50 years</td></tr><tr><td><strong>Custom Victory</strong></td><td>Player-defined (scenario dependent)</td><td>Varies</td></tr></tbody></table><p><strong>Defeat Conditions</strong>:</p><ul><li>Population drops below 10,000 (extinction)</li><li>Stability drops below 5 for 50 ticks (collapse)</li><li>Treasury bankruptcy + no allies willing to bailout (economic failure)</li><li>All armies defeated + capital captured (military defeat)</li></ul><hr><h3 id="_6-2-sandbox-mode" tabindex="-1">6.2 Sandbox Mode <a class="header-anchor" href="#_6-2-sandbox-mode" aria-label="Permalink to &quot;6.2 Sandbox Mode&quot;">​</a></h3><p><strong>Player Goal</strong>: Experiment, build, explore without win/lose condition.</p><p><strong>No victory conditions.</strong> Play indefinitely.</p><p><strong>Use Cases</strong>:</p><ul><li>Learn game mechanics</li><li>Build a &quot;perfect&quot; civilization</li><li>Create fantasy scenarios</li><li>Test mods and custom policies</li><li>Relaxed, creative play</li></ul><p><strong>Features</strong>:</p><ul><li>Can save/load at any time</li><li>Can pause and unpause freely</li><li>Can rewind 10 ticks and try again</li><li>Cheat commands available (add resources, adjust policies instantly)</li></ul><hr><h3 id="_6-3-research-mode-headless" tabindex="-1">6.3 Research Mode (Headless) <a class="header-anchor" href="#_6-3-research-mode-headless" aria-label="Permalink to &quot;6.3 Research Mode (Headless)&quot;">​</a></h3><p><strong>Player Goal</strong>: Run scientific/statistical simulations.</p><p><strong>Differences from Campaign</strong>:</p><ul><li>No UI (headless core only)</li><li>Metrics-export to CSV/JSON</li><li>Batch runs (run same scenario 100 times, vary parameters, export results)</li><li>Deterministic replay (rerun with same seed = same result)</li></ul><p><strong>Use Cases</strong>:</p><ul><li>Academic research (&quot;How does ideology affect GDP?&quot;)</li><li>Parameter sweeps (&quot;Test carbon budget from 300-600ppm&quot;)</li><li>Benchmarking (&quot;Can you win on Harder difficulty?&quot;)</li><li>Debugging (&quot;Reproduce exact sequence of events that caused collapse&quot;)</li></ul><p><strong>Example Research Script</strong> (pseudocode):</p><div class="language-python vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">python</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">import</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> civlab</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Run scenario &quot;Modern Era&quot; 10 times, vary carbon budget</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">scenario </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> civlab.load_scenario(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;scenarios/modern_era.yaml&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">)</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">for</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> carbon_budget </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">in</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> [</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">300</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">400</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">500</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">600</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]:</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    results </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> []</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">    for</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> run </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">in</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> range</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">10</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">):</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        game </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> civlab.Game(</span></span>
<span class="line"><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">            scenario</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">scenario,</span></span>
<span class="line"><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">            carbon_budget_limit</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">carbon_budget,</span></span>
<span class="line"><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">            seed</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">run  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Vary seed for different maps</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        )</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        game.run_until_victory()</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        results.append({</span></span>
<span class="line"><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">            &quot;carbon_budget&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: carbon_budget,</span></span>
<span class="line"><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">            &quot;run&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: run,</span></span>
<span class="line"><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">            &quot;final_stability&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: game.stability(),</span></span>
<span class="line"><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">            &quot;final_gdp&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: game.gdp(),</span></span>
<span class="line"><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">            &quot;ticks_to_victory&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: game.ticks(),</span></span>
<span class="line"><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">            &quot;events&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: game.event_log(),  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># Full event log</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        })</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    # Export results</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    civlab.export_csv(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;results_carbon_budget_</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">{}</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">.csv&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">.format(carbon_budget), results)</span></span></code></pre></div><hr><h2 id="part-7-technical-architecture-headless-core" tabindex="-1">Part 7: Technical Architecture (Headless Core) <a class="header-anchor" href="#part-7-technical-architecture-headless-core" aria-label="Permalink to &quot;Part 7: Technical Architecture (Headless Core)&quot;">​</a></h2><h3 id="_7-1-core-subsystems" tabindex="-1">7.1 Core Subsystems <a class="header-anchor" href="#_7-1-core-subsystems" aria-label="Permalink to &quot;7.1 Core Subsystems&quot;">​</a></h3><table tabindex="0"><thead><tr><th>Subsystem</th><th>Responsibility</th><th>Complexity</th></tr></thead><tbody><tr><td><strong>Simulation Engine</strong></td><td>Tick execution, state transitions</td><td>High</td></tr><tr><td><strong>Economy</strong></td><td>Market clearing, production, trade</td><td>High</td></tr><tr><td><strong>Demographics</strong></td><td>Birth, death, migration</td><td>Medium</td></tr><tr><td><strong>Policy Engine</strong></td><td>Policy evaluation, effect application</td><td>High</td></tr><tr><td><strong>Diplomacy AI</strong></td><td>Relationship tracking, negotiations</td><td>Medium</td></tr><tr><td><strong>Military</strong></td><td>Army movement, battle resolution</td><td>Medium</td></tr><tr><td><strong>Climate</strong></td><td>CO2 tracking, disaster events</td><td>Medium</td></tr><tr><td><strong>Event Bus</strong></td><td>Event emission, logging, validation</td><td>Medium</td></tr><tr><td><strong>State Persistence</strong></td><td>Serialization, save/load, replay</td><td>Low-Med</td></tr><tr><td><strong>Metrics &amp; Analytics</strong></td><td>Performance tracking, reporting</td><td>Low</td></tr></tbody></table><h3 id="_7-2-determinism-guarantees" tabindex="-1">7.2 Determinism Guarantees <a class="header-anchor" href="#_7-2-determinism-guarantees" aria-label="Permalink to &quot;7.2 Determinism Guarantees&quot;">​</a></h3><p><strong>Requirement</strong>: Given seed + policy bundle, same map and event sequence always generated.</p><p><strong>Implementation</strong>:</p><div class="language-rust vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">rust</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// Pseudocode</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">fn</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> run_deterministic_tick</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(seed</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> u64</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, tick</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> u32</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">) {</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">    let</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> mut</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> rng </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> DeterministicRNG</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">::</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">from_seed</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">hash</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(seed, tick));</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // Phase 1: Demographics</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">    for</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> city </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">in</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> cities {</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">        for</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> citizen </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">in</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> city</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">citizens {</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">            let</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> birth_roll </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> rng</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">next</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">();  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// Pinned to this tick</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">            if</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> birth_roll </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">&lt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> birth_probability {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">                citizen</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">give_birth</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">();</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">            }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    }</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // Phase 2: Production</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // ...</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // Store event log</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">    log_tick_events</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(tick);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// Replay: run same ticks with same seed → same events</span></span></code></pre></div><p><strong>Verification</strong>:</p><ol><li>Run scenario twice with same seed</li><li>Compare event logs (must be identical)</li><li>Compare final state (must be identical)</li><li>If any difference → determinism broken → investigate RNG usage</li></ol><hr><h2 id="part-8-client-integration-websocket-protocol" tabindex="-1">Part 8: Client Integration &amp; WebSocket Protocol <a class="header-anchor" href="#part-8-client-integration-websocket-protocol" aria-label="Permalink to &quot;Part 8: Client Integration &amp; WebSocket Protocol&quot;">​</a></h2><h3 id="_8-1-client-connection-flow" tabindex="-1">8.1 Client Connection Flow <a class="header-anchor" href="#_8-1-client-connection-flow" aria-label="Permalink to &quot;8.1 Client Connection Flow&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>1. Client connects to core WebSocket (ws://localhost:8000)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>2. Client sends auth:</span></span>
<span class="line"><span>   { &quot;action&quot;: &quot;authenticate&quot;, &quot;token&quot;: &quot;...&quot; }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>3. Server responds with game state:</span></span>
<span class="line"><span>   { &quot;scenario&quot;: {...}, &quot;nations&quot;: {...}, &quot;tick&quot;: 0 }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>4. Client renders initial UI</span></span>
<span class="line"><span></span></span>
<span class="line"><span>5. Game starts ticking (core sends event stream)</span></span>
<span class="line"><span></span></span>
<span class="line"><span>6. Client sends player action:</span></span>
<span class="line"><span>   { &quot;action&quot;: &quot;declare_war&quot;, &quot;target&quot;: &quot;france&quot; }</span></span>
<span class="line"><span></span></span>
<span class="line"><span>7. Core processes action, applies to game state, emits event</span></span>
<span class="line"><span></span></span>
<span class="line"><span>8. Client receives event, updates UI</span></span>
<span class="line"><span></span></span>
<span class="line"><span>9. Repeat 5-8 indefinitely</span></span></code></pre></div><h3 id="_8-2-api-contracts-deterministic" tabindex="-1">8.2 API Contracts (Deterministic) <a class="header-anchor" href="#_8-2-api-contracts-deterministic" aria-label="Permalink to &quot;8.2 API Contracts (Deterministic)&quot;">​</a></h3><p>All API responses include:</p><ul><li><code>event_id</code>: UUID (unique per event)</li><li><code>tick_number</code>: Sequence number</li><li><code>timestamp</code>: When event was generated</li><li><code>payload</code>: Event-specific data</li><li><code>hash</code>: SHA256(state_after_event) for verification</li></ul><hr><h2 id="part-9-modding-ecosystem" tabindex="-1">Part 9: Modding Ecosystem <a class="header-anchor" href="#part-9-modding-ecosystem" aria-label="Permalink to &quot;Part 9: Modding Ecosystem&quot;">​</a></h2><h3 id="_9-1-community-mod-distribution" tabindex="-1">9.1 Community Mod Distribution <a class="header-anchor" href="#_9-1-community-mod-distribution" aria-label="Permalink to &quot;9.1 Community Mod Distribution&quot;">​</a></h3><p>Mods hosted on community registry (like Steam Workshop):</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>CivLab Mod Registry (civlab-mods.org)</span></span>
<span class="line"><span>├── Scenario Collections</span></span>
<span class="line"><span>│   ├── &quot;Historical Scenarios Pack&quot;</span></span>
<span class="line"><span>│   ├── &quot;Fantasy World Scenarios&quot;</span></span>
<span class="line"><span>│   └── &quot;Hard Mode Challenge Scenarios&quot;</span></span>
<span class="line"><span>├── Gameplay Mods</span></span>
<span class="line"><span>│   ├── &quot;Better AI Diplomacy&quot;</span></span>
<span class="line"><span>│   ├── &quot;Climate Catastrophe&quot;</span></span>
<span class="line"><span>│   └── &quot;Tech Tree Rebalance&quot;</span></span>
<span class="line"><span>├── UI Mods (visual enhancements)</span></span>
<span class="line"><span>│   ├── &quot;Dark Mode UI&quot;</span></span>
<span class="line"><span>│   └── &quot;Minimalist HUD&quot;</span></span>
<span class="line"><span>└── Conversion Mods (Civ 6 → CivLab)</span></span>
<span class="line"><span>    ├── &quot;Ancient Egypt Conversion&quot;</span></span>
<span class="line"><span>    └── &quot;Industrial Revolution Conversion&quot;</span></span></code></pre></div><h3 id="_9-2-modding-best-practices" tabindex="-1">9.2 Modding Best Practices <a class="header-anchor" href="#_9-2-modding-best-practices" aria-label="Permalink to &quot;9.2 Modding Best Practices&quot;">​</a></h3><ol><li><strong>Versioning</strong>: Always version mods; mark compatibility with core versions</li><li><strong>Testing</strong>: Provide test scenario to verify mod works</li><li><strong>Documentation</strong>: Include README explaining features and balance implications</li><li><strong>Balance</strong>: Submit balance-changing mods for community vote before inclusion</li><li><strong>Performance</strong>: Profile mods; flag if they increase tick time &gt;10%</li></ol><hr><h2 id="summary-table-inspirations-distinctions" tabindex="-1">Summary Table: Inspirations &amp; Distinctions <a class="header-anchor" href="#summary-table-inspirations-distinctions" aria-label="Permalink to &quot;Summary Table: Inspirations &amp; Distinctions&quot;">​</a></h2><table tabindex="0"><thead><tr><th>Game</th><th>Inspiration</th><th>CivLab Distinction</th></tr></thead><tbody><tr><td>Dwarf Fortress</td><td>Emergent complexity</td><td>Clean headless protocol + Joule economy</td></tr><tr><td>Victoria 3</td><td>Political economy</td><td>Institutional persistence + shadow networks</td></tr><tr><td>Crusader Kings 3</td><td>Dynasty mechanics</td><td>Institutional memory independent of leader</td></tr><tr><td>Factorio</td><td>Production optimization</td><td>Energy-backed currency + climate system</td></tr><tr><td>Terra Nil</td><td>Environmental restoration</td><td>Full climate simulation with carbon budget</td></tr><tr><td>OpenTTY</td><td>Colony simulation</td><td>Determinism + replay + research mode</td></tr><tr><td>Influence</td><td>Covert operations</td><td>Espionage integrated into core diplomacy</td></tr></tbody></table><hr><h2 id="full-game-features-checklist-v1" tabindex="-1">Full Game Features Checklist (v1) <a class="header-anchor" href="#full-game-features-checklist-v1" aria-label="Permalink to &quot;Full Game Features Checklist (v1)&quot;">​</a></h2><ul><li>✅ Deterministic simulation engine</li><li>✅ Three economy systems (market, planned, Joule)</li><li>✅ Population dynamics (birth, death, migration, happiness)</li><li>✅ Production chains and trade networks</li><li>✅ War and diplomacy system</li><li>✅ Shadow networks and espionage</li><li>✅ Climate system (CO2, disasters)</li><li>✅ Tech tree with research</li><li>✅ Institutions and ideology</li><li>✅ Headless core architecture</li><li>✅ WebSocket API for clients</li><li>✅ YAML scenario and mod format</li><li>✅ Campaign, Sandbox, and Research modes</li><li>✅ Multiple victory conditions</li><li>✅ Detailed metrics and analytics</li><li>✅ Player agency and emergent gameplay</li></ul>`,205)])])}const g=a(p,[["render",t]]);export{k as __pageData,g as default};
