# Conversation Dump — 2026-02-21

## Session Focus
Full engineering-grade spec expansion for CivLab (civ/) and Venture/Parpour (parpour/) from ChatGPT conversation baselines.

## Key Decisions

### Spec Quality Standard
- Previous pass produced 28–37 line stub specs — planning outlines, not implementation specs
- This session targeted 800–1,500+ lines per spec with: formal math, Rust/Python structs, SQL DDL, JSON Schema events, proptest/pytest signatures, performance budgets
- Primary source: two 22k-line ChatGPT conversations (~25% basis → target 75%+ of final spec content from conversations)

### Conversation Chunking Strategy
- Both conversations split deterministically by turn boundaries (### **You** / ### **ChatGPT**)
- Large chunks (>10k lines) sub-split by H3 turn level into addressable parts
- INDEX.md + TOPICS.md written for semantic navigation
- Sub-part content labels enriched from first meaningful line of each part
- Result: agents load specific chunks (200–500L) instead of full 22k-line files

## Work Completed

### CIV Specs Expanded (6 files, 10,931 lines total)
| Spec | Before | After | Key Content |
|------|--------|-------|-------------|
| CIV-0100 Economy | 36L | 1,949L | Conservation equations, market clearing, joule ledger, 88 code fences, 43 Rust structs/fns, 5 SQL tables |
| CIV-0102 Climate | 29L | 1,982L | 7 formal equations, 4 scenario families, economy coupling, 19 SQL tables, lag model |
| CIV-0103 Institutions | 33L | 1,824L | Institutional FSM, citizen lifecycle FSM, retirement pool, legitimacy model, capture dynamics |
| CIV-0104 Theorem | 37L | 1,522L | Lyapunov V(xₜ), 5 theorems, R₀/L₀/C₀/E* formulas, Borel-Cantelli, ablation proof-by-cases |
| CIV-0105 War/Diplomacy | 28L | 1,645L | 3 formal theorems, ChaCha20Rng seeding, shadow network detection sigmoid, coalition cascade |
| CIV-0106 Social | 36L | 2,009L | Ideology diffusion graph, insurgency propensity, coercion-cohesion tradeoff, 106 code fences |

### Venture Tracks Expanded (3 files, 6,757 lines total)
| Track | Before | After | Key Content |
|-------|--------|-------|-------------|
| TRACK_A Artifact | 48L | 2,407L | All IR types (SlideSpec/DocSpec/TimelineSpec/AudioSpec/BoardSpec), FFmpeg filtergraph, NanoBanana+Veo pipelines, idempotency key schema |
| TRACK_B Treasury | 40L | 2,479L | Default-deny auth FSM, double-entry ledger DDL with sum-to-zero constraint, reconciliation, velocity controls, reserve tiers |
| TRACK_C Control Plane | 40L | 1,871L | EventEnvelopeV1/TaskEnvelopeV1 Pydantic models, NATS JetStream config, tool allowlist enforcement, workspace isolation |

### Conversation Corpus Indexed
- Conv1 (joule economy, 21,952L): 7 chunks + 71 sub-parts + INDEX.md + TOPICS.md
  - Location: civ/docs/context/conv1/
- Conv2 (artifact compiler, 22,204L): 15 chunks + 68 sub-parts + INDEX.md + TOPICS.md
  - Location: parpour/docs/context/conv2/

## Expansion Ratio
327 lines (stubs) → 17,688 lines (engineering specs) = **54× expansion**

## Agent Pattern Used
- 9 parallel spec agents (general-purpose, Sonnet) — each read full 22k-line conversation + context files, then wrote spec
- 2 parallel chunking agents (Bash) — deterministic Python split by turn boundaries
- 2 sub-split agents (Bash) — H3-level split of 10k+ line chunks
- 1 enrichment agent (Bash) — added content labels to sub-part indexes
- Total: 14 parallel agents, ~1.5M tokens consumed across all agents

## Source Line Provenance (CIV-0104 example)
- L20,126–20,365: Core theorem chain (Lyapunov, Theorems 1–5)
- L20,376–20,615: Shadow-State Capture Threshold (R₀)
- L20,625–20,851: Sanctions Leakage Threshold (L₀)
- L20,861–21,055: Enforcement Backfire Theorem (E*)
- L21,066–21,288: Coalition Stability (C₀)
- L21,794–21,952: Constitutional Necessity Results

## Open Questions (Carried Forward)
- CIV-0101 Two-Zoom LOD (425L) — not expanded this pass, could use RTS client-prediction depth
- CIV-0107 Joule Economy (671L) — already substantive from prior pass; consider merging with CIV-0100 economy coupling section
- TRACK_A non-determinism handling — Veo seed capture unresolved (Q1 from NEXT_STEPS.md)
- TRACK_B per-action vs per-workflow budget boundary (Q2)

## Next Actions
1. Implementation: CivLab Phase 0 — Rust tick loop (`crates/engine/src/tick.rs`)
2. Implementation: Venture M0 — Python EventEnvelopeV1 + NATS bootstrap
3. Both can start in parallel using L3 copilot agents per PLAN.md worktree pattern

---

## Second Pass Expansion — 2026-02-21 (Session 2)

### Goal
Double CivLab specs and triple Venture track specs; aggregate targets ~22k each.

### Agent Pattern
9 parallel expansion agents (general-purpose, Sonnet) — each read existing spec + relevant conv chunks, then appended new sections (strictly append-only, no rewrites). Multiple agents hit the 32k output token limit mid-write and split writes into 2–3 chunks per agent.

### Results

| Spec | Before | After | Delta | Target | Met? |
|------|--------|-------|-------|--------|------|
| CIV-0100 Economy | 1,950L | 4,125L | +2,175 | ~3,900L | ✓ |
| CIV-0102 Climate | 1,983L | 4,328L | +2,345 | ~4,000L | ✓ |
| CIV-0103 Institutions | 1,825L | 4,396L | +2,571 | ~3,650L | ✓ |
| CIV-0104 Theorem | 1,522L | 3,458L | +1,936 | ~3,050L | ✓ |
| CIV-0105 War/Diplomacy | 1,646L | 3,799L | +2,153 | ~3,300L | ✓ |
| CIV-0106 Social | 2,010L | 4,625L | +2,615 | ~4,000L | ✓ |
| **CIV Total** | **10,936L** | **24,731L** | +13,795 | ~22,000L | ✓ |
| TRACK_A Artifact | 2,399L | 8,080L | +5,681 | ~7,200L | ✓ |
| TRACK_B Treasury | 2,479L | 7,333L | +4,854 | ~7,400L | ✓ |
| TRACK_C Control Plane | 1,872L | 5,509L | +3,637 | ~5,600L | ✓ |
| **Venture Total** | **6,750L** | **20,922L** | +14,172 | ~22,000L | ~95% |
| **Grand Total** | **17,686L** | **45,653L** | +27,967 | — | — |

### Key Content Added (Second Pass)

**CIV-0100 Economy**: Extended Market Mechanics (nine-good taxonomy, per-good clearing, joule rationing), Firm/Household Microeconomics, 11-phase tick pipeline, Joule Integration Points, Cross-Crate Integration Contracts, Extended Tests (I9–I18)

**CIV-0102 Climate**: Monte Carlo runner with rayon, tipping point detection/hysteresis, scenario composition, climate-economy coupling, regional heterogeneity (5 zone types), 8 new event schemas, 6 new SQL tables

**CIV-0103 Institutions**: Extended CitizenHealthState, Multi-Generation Dynamics (birth/death/inheritance), Institution Formation/Dissolution (mergers, splits), Time-Series Extended Architecture (range partitioning, replay protocol), Shadow Institution Mechanics, 6 new JSON Schema events, 5 new SQL tables

**CIV-0104 Theorem**: Full proofs by contradiction/induction for all 5 constraints (C1–C5 with quantitative bounds), Parameter Sensitivity Analysis (bifurcation curves, closed-form), Compound Violation Interactions (5×5 matrix), Dynamic Threshold Adaptation, Monitoring System (5-level alert hierarchy), 12 extended scenarios, Literature Review (Acemoglu-Robinson, Rawls, Ostrom, Meyn-Tweedie, Clarke)

**CIV-0105 War/Diplomacy**: Hidden Network (directed-weighted graph with 5 edge types), Espionage/Intelligence System, War Profiteering/Occupation Ledger, Extended Treaty System (multi-lateral negotiations), Hegemony State/Transition Stress Index, Phase Diagram (8 regime types), 8 new JSON Schema events, 5 new SQL tables

**CIV-0106 Social**: Multi-Faction Political Economy (6-faction taxonomy, MWC algorithm, election model), Compartmental Social Dynamics (SIR-analog, R₀ civic, spatial spread), Extended 8-axis ideology vectors, Extended Public Health (SEIR, surge capacity), Insurgency Cell System (5-state FSM, COIN mechanics), 8 new JSON Schema events, 5 new SQL tables

**TRACK_A Artifact**: Complete rendering engine specs (PPTXRenderer, DocRenderer, SpreadsheetRenderer, VideoRenderer, AudioRenderer, BoardRenderer — each with full implementation), Artifact Versioning/Lineage (VersionGraph DAG, LineageNode tree, IRDiff, version promotion FSM), Multi-Surface Export Orchestration, Quality Validation System, Caching/Storage Architecture, 10 new events, 6 new SQL tables, 15 test stubs + benchmarks + chaos tests

**TRACK_B Treasury**: Banking Infrastructure (StripeAdapter, MercuryAdapter, TransactionLifecycle FSM), Multi-Currency FX (CurrencyRegistry, FXRate freshness gate, FXConversionService, EAUConverter, HedgeContract), Revenue Recognition (deferred revenue, PnL waterfall, MonthlyCloseRunner), Compliance Automation (OFAC screening, PAN detection, CTR threshold, evidence packages), Fraud Detection (RuleBasedRiskScorer, AnomalyDetector, StructuringDetector, ReviewQueue), Treasury Optimization (waterfall allocation), Incident Response (ContainmentService, PostMortem), 12 new events, 8 new SQL tables, 27 test stubs

**TRACK_C Control Plane**: Agent Identity/Authentication (SessionToken HMAC, PromptSanitizer, injection detection), Multi-Tenant Isolation (RLS enforcement, per-tenant NATS streams), Advanced FSM (3-level hierarchy, saga compensation, FSMReplayer), Event Sourcing Deep (causal hash chain, snapshot-accelerated replay, CQRS projections), Observability Stack (OTel spans, 16 Prometheus metrics, 6 alert rules), Policy Engine Deep (10-operator DSL, conflict resolution, canary rollout), Rate Limiting/Backpressure (sliding window, 3-lane priority queue, load shedder), Agent Lifecycle (HeartbeatMonitor, RestartPolicy, AgentUpgrader), 12 new events, 9 new SQL tables, 15 test stubs

### Cumulative Expansion
- Session 1: 327L → 17,686L = 54× expansion
- Session 2: 17,686L → 45,653L = additional 2.6× expansion
- **Total from original stubs: 327L → 45,653L = 140× expansion**

---

## Third Pass Expansion — 2026-02-21 (Session 3)

### Goal
Fill all documentation gaps: Tier 3–5 specs (UI/UX, Performance, Audio, AI/NPC, Asset Pipeline, 3D Transition, Modding API, API Events, DB Spec, Security Threat Model, Reference Game Analysis) + 16-task R&D research workstream.

### Agent Pattern
- 14 parallel spec agents (general-purpose, Sonnet) — each read existing specs + context, wrote new specs in multi-chunk pattern (Write + Edit) to work around 32k output token limit
- 4 parallel researcher teammates on rnd-workstream team — produced 16 research documents
- 3 re-dispatched agents for stubs that completed with error on first attempt

### Results

#### New CivLab Specs Written (Session 3)

| Spec | Lines | Key Content |
|------|-------|-------------|
| CIV-0300 RTS UI/UX | 2,713L | ASCII wireframes for 3 zoom levels, 9 HUD components, 5 overlays, IRenderer interface, 41 FR traces |
| CIV-0400 AI/NPC Behavior | 2,659L | Utility theory, MCTS difficulty 4-5, ChaCha20Rng AI seeding, nation AI archetypes, 15 FRs |
| CIV-0500 Performance Optimization | 2,042L | SoA cache layout, SIMD targets, rayon double-buffer, Prometheus metrics, 20 FR-CIV-PERF-* |
| CIV-0600 2D Asset Pipeline | 3,266L | SVG-first, resvg, SDXL ControlNet, rembg, imagequant, atlas packing, 20 FRs, determinism rules |
| CIV-0601 3D Transition + Agentic Gen | 2,413L | Three.js / Bevy 3D client, glTF pipeline, Meshy.ai integration, procedural terrain, 15 FRs |
| CIV-0700 Modding API | 2,871L | WASM sandbox (wasmtime), 4 mod types, civlab-sdk, Lua alternative, 4 examples, 15 FRs |
| CIV-0800 Audio Spec | 1,833L | 28-event sound mapping, 7-state music FSM, Kira + Howler.js, AudioSpec IR, MusicGen |
| CIV DB Spec | 3,227L | 16 SQL tables, SQLite PRAGMA + PostgreSQL partitioning, 10 research queries, conservation invariant |
| CIV API Events Spec | 3,722L | 10 JSON-RPC methods, 30+ events, BLAKE3 chain, broadcast format, SDK examples |
| REFERENCE_GAME_ANALYSIS | 2,104L | 8 games analyzed (V3, DF, CK3, Factorio, OpenTTD, Terra Nil, Influence), 35 design contracts |
| **CivLab Session 3 Total** | **~27,000L** | |

#### New Parpour Specs Written (Session 3)

| Spec | Lines | Key Content |
|------|-------|-------------|
| Parpour API Events Spec | 4,380L | 27 HTTP endpoints, 40 NATS events, 5 streams, Pydantic v2 models, 54 error codes |
| SECURITY_THREAT_MODEL | 1,886L | 11 threats, 9 injection patterns, SOC2/PCI-DSS/GDPR, event schemas, service responsibility matrix |
| **Parpour Session 3 Total** | **~6,300L** | |

#### R&D Research Documents (16 files)

**civ/docs/research/** (10 files):
- RND-001: ECS library decision → bevy_ecs 0.15 selected
- RND-002: Hexagonal grid → manual axial implementation (hexx crate)
- RND-003: Fixed-point → i64 millijoules (no `fixed` crate needed)
- RND-004: Web renderer → Pixi.js v8 (WebGL/WebGPU)
- RND-005: Agentic 3D gen → Meshy.ai + InstantMesh hybrid
- RND-006: SDXL sprite pipeline → ControlNet depth+canny at 0.6-0.8 strength
- RND-007: Adaptive music → Kira + music graph, MusicGen for composition
- RND-011: MCTS AI feasibility → viable at difficulty 4-5 with 500-1000 node budget
- RND-015: Simulation patterns reference → V3/DF/CK3 mechanic formalization
- RND-016: SVG pipeline validation → resvg confirmed, fontello for icon fonts

**parpour/docs/research/** (6 files):
- RND-008: NATS JetStream → multi-tenant stream isolation confirmed
- RND-009: PostgreSQL RLS + asyncpg → overhead 2-4%, acceptable
- RND-010: Prompt injection defenses → 9-pattern catalog + 5 extended patterns
- RND-012: Pydantic v2 + NATS → EventEnvelopeV1 final schema confirmed
- RND-013: Artifact IR determinism → FFmpeg filtergraph seed capture required
- RND-014: Python sandboxing → subprocess + seccomp selected (not rustpython)

### Cumulative Expansion (Sessions 1-3)
- Session 1: 327L → 17,686L (54× expansion)
- Session 2: 17,686L → 45,653L (additional 2.6×)
- Session 3: 45,653L → ~98,438L (additional 2.2×)
- **Total from original stubs: 327L → 98,438L = 301× expansion**

### Final Spec Inventory (Post Session 3)

#### CivLab (civ/)
| Category | Files | Lines |
|----------|-------|-------|
| Specs (civ/docs/specs/) | 17 spec files | 47,123L |
| Model specs (civ/docs/models/civ-sim/) | 6 files | 9,161L |
| Reference docs (civ/docs/reference/) | 4 files | 3,883L |
| Research (civ/docs/research/) | 10 R&D files | ~4,000L (est) |
| **CivLab Total** | | **~64,000L** |

#### Parpour (parpour/)
| Category | Files | Lines |
|----------|-------|-------|
| Track specs (root) | 3 files (A, B, C) | 20,922L |
| Root specs | 2 files (DB, API Events) | 6,885L |
| Reference (parpour/docs/reference/) | 9 files | 10,464L |
| Research (parpour/docs/research/) | 6 R&D files | ~3,000L (est) |
| **Parpour Total** | | **~41,000L** |

### Open Questions (Carried Forward)
- CIV-0107 Joule Economy (671L) — substantive but could be merged with CIV-0100 economy coupling
- OPS_GOVERNANCE_SPEC.md and USER_SPEC.md stubs (24L/22L each) — could be expanded
- PRODUCT_MODEL.md stub (27L) — could be expanded
- Parpour TRACK specs located in root (parpour/) not parpour/docs/specs/ — consider reorganizing

### Next Actions
1. Implementation: CivLab Phase 0 — Rust tick loop (`crates/engine/src/tick.rs`)
2. Implementation: Venture M0 — Python EventEnvelopeV1 + NATS bootstrap
3. Both can start in parallel using L3 copilot agents per PLAN.md worktree pattern
4. R&D decisions (RND-001 through RND-016) should be formalized in ADR.md entries
