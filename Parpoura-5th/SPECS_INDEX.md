# Master Spec Index

**date:** 2026-02-21

This document provides a consolidated view of all specification artifacts across the CIV (city simulation) and Venture (autonomous agent platform) tracks, their completion status, and identified cross-track dependencies and integration points.

---

## CIV Track Specs

| ID | File | Title | Status | Key Dependencies |
|---|---|---|---|---|
| CIV-0001 | CIV-0001-core-simulation-loop.md | Core Simulation Loop | CLOSED | Foundation for all CIV specs |
| CIV-0100 | CIV-0100-economy-v1.md | Economy Spec v1 | CLOSED | CIV-0001; defines ledger model, market clearing, double-entry accounting |
| CIV-0101 | CIV-0101-two-zoom-lod-v1.md | Two-Zoom LOD Spec v1 | CLOSED | CIV-0001, CIV-0100; spatial representation and level-of-detail |
| CIV-0102 | CIV-0102-climate-followup-v1.md | Climate Follow-up Spec v1 | CLOSED | CIV-0001, CIV-0100; energy accounting integration |
| CIV-0103 | CIV-0103-institutions-timeseries-citizen-lifecycle-v1.md | Institutions, Time-Series, and Citizen Lifecycle v1 | CLOSED | CIV-0001, CIV-0100; actor lifecycle and institutional change |
| CIV-0104 | CIV-0104-minimal-constraint-set-theorem.md | Minimal Constraint Set Theorem | CLOSED | Mathematical foundations; applies to all CIV modules |
| CIV-0105 | CIV-0105-war-diplomacy-shadow-v1.md | War, Diplomacy, and Shadow Networks Spec v1 | CLOSED | CIV-0001, CIV-0103; geopolitical and institutional dynamics |
| CIV-0106 | CIV-0106-social-ideology-health-insurgency-v1.md | Social, Ideology, Health, and Insurgency Spec v1 | CLOSED | CIV-0001, CIV-0103, CIV-0105; citizen agency and emergent conflict |

---

## Venture Track Specs

| ID | File | Title | Status | Key Dependencies |
|---|---|---|---|---|
| TECH | TECHNICAL_SPEC.md | Venture-Autonomy Technical Spec (v1) | CLOSED | Foundation; defines control-plane architecture, runtime model, security posture |
| TRACK-A | TRACK_A_ARTIFACT_DETERMINISM_SPEC.md | Artifact IR and Determinism Closure | CLOSED | TECH; artifact schema family (SlideSpec, DocSpec, TimelineSpec, AudioSpec, BoardSpec), deterministic build/replay contracts |
| TRACK-B | TRACK_B_TREASURY_COMPLIANCE_SPEC.md | Treasury, Ledger, and Compliance Closure | CLOSED | TECH; money control subsystem, spend policies, event ledger, compliance machine |
| TRACK-C | TRACK_C_CONTROL_PLANE.md | Control-Plane Closure | CLOSED | TECH, TRACK-A, TRACK-B; workflow orchestrator, agent runtime, tool permission engine, event bus, FSM, schema registry |
| API | API_EVENTS_SPEC.md | API & Event Spec | CLOSED | TECH, TRACK-C; event schema contracts, FSM transitions, strict event validation |
| DATA | DATA_MODEL_DB_SPEC.md | Data/DB Spec | CLOSED | TECH, TRACK-A, TRACK-B; artifact IR tables, ledger tables, workflow tables, audit log schema |
| OPS | OPS_COMPLIANCE_SPEC.md | Ops/Compliance Spec | CLOSED | TECH, TRACK-B, TRACK-C; compliance machine policy packs, audit toolchain, observability requirements |
| USER | USER_SPEC.md | User Spec | CLOSED | TECH; user roles, capabilities, onboarding, multi-tenant isolation |
| PRODUCT | PRODUCT_MODEL.md | Product Model | CLOSED | TECH, USER; feature roadmap, monetization, tier/plan structure |
| SCHEMA | SCHEMA_PACK.md | Core Schema Pack | CLOSED | TRACK-A, TRACK-B, TRACK-C, API; consolidated schema definitions for all subsystems |
| ROLE-MATRIX | ROLE_TOOL_ALLOWLIST_MATRIX.md | Role Tool Allowlist Matrix | CLOSED | TECH, USER, TRACK-C; per-role capability model and tool allowlists |
| ROADMAP | IMPLEMENTATION_ROADMAP.md | Implementation Roadmap | CLOSED | All Venture specs; phased rollout plan |

---

## Cross-Track Connections

### CIV → Venture Integration Points

1. **Economy Ledger Model (CIV-0100) ↔ Treasury Ledger (TRACK-B)**
   - CIV's double-entry accounting and conservation invariants → directly applicable to Venture's spend ledger
   - Market clearing logic (CIV-0100) can inform Venture's service pricing/cost allocation
   - Both require deterministic event recording and replay capability

2. **Simulation State Management (CIV-0001, CIV-0100) ↔ Workflow Orchestration (TRACK-C)**
   - CIV's tick-based state transitions → parallels Venture's workflow DAG execution model
   - Both require audit-ready event logs and replay/determinism guarantees
   - Policy evaluation pattern in CIV (policy.evaluate → control) mirrors Venture's policy engine

3. **Citizen Lifecycle & Institutions (CIV-0103) ↔ User Management & Compliance (USER, OPS)**
   - CIV's actor lifecycle model (birth, education, career, retirement, death) → metadata for Venture user journeys
   - CIV's institutional change tracking → informs Venture's audit trail and compliance evidence chains
   - Time-series citizen metrics (CIV-0103) → can populate Venture user activity signals

4. **Energy Accounting (CIV-0102, CIV-0100) ↔ Resource Quota/Cost Control (TRACK-B, TRACK-C)**
   - CIV's conservation equation and supply-stress metrics → model for Venture's API rate-limiting and cost budgets
   - Peak-shaving and demand-response mechanics → applicable to Venture's spend velocity controls

5. **Determinism & Constraint Theorems (CIV-0104) ↔ Deterministic Artifact Build (TRACK-A)**
   - CIV's minimal constraint set theorem → provides mathematical foundation for Venture's deterministic build contracts
   - Replay and idempotency patterns cross-apply

### Venture → CIV Integration Points

1. **Artifact IR Specs (TRACK-A) → Civ Visualization Export**
   - Venture's SlideSpec, TimelineSpec, BoardSpec → can model CIV simulation outputs (e.g., city timeline deck, economic dashboard, institutional org chart)
   - Deterministic build contract → guarantees reproducible CIV visualization artifacts across runs

2. **Event/Ledger Architecture (API, TRACK-B) → CIV Event Streaming**
   - Venture's strict event validation and schema registry → can federate CIV's own economy.market_cleared.v1 and policy.applied.v1 events
   - Ledger determinism patterns → applicable to CIV's double-entry transfers

3. **Compliance Machine (OPS, TRACK-B) → CIV Policy Audit Trail**
   - Venture's policy-evaluator and audit machinery → can audit CIV's fiscal policy decisions and institutional changes
   - Human-readable policy evidence chains → improve CIV simulation transparency and debuggability

---

## Open Planning Gaps (All Now Closed)

**Status:** All 13 planning gaps identified in the previous planning sessions have been successfully closed.

### Civ-Sim Gaps (All Closed)
- ✅ Tech stack decision and rationale → closed by Track-C governance docs
- ✅ Economy Spec v1 → CIV-0100
- ✅ Two-Zoom LOD Spec v1 → CIV-0101
- ✅ War/Diplomacy/Shadow cleanup → CIV-0105
- ✅ Climate follow-up package → CIV-0102
- ✅ Institutional/time-series/citizen-lifecycle package → CIV-0103
- ✅ Minimal constraint theorem closure → CIV-0104

### Venture Gaps (All Closed)
- ✅ Canonical runtime profile and architecture → TECHNICAL_SPEC.md
- ✅ Artifact IR schema family freeze → TRACK_A_ARTIFACT_DETERMINISM_SPEC.md
- ✅ Deterministic compiler MVP contract → TRACK_A_ARTIFACT_DETERMINISM_SPEC.md
- ✅ Treasury control-plane MVP → TRACK_B_TREASURY_COMPLIANCE_SPEC.md
- ✅ Compliance machine policy pack → OPS_COMPLIANCE_SPEC.md
- ✅ Event bus + FSM + schema registry → API_EVENTS_SPEC.md + TRACK_C_CONTROL_PLANE.md

---

## Key Metrics

| Category | Count | Notes |
|----------|-------|-------|
| CIV Track Specs | 8 | CIV-0001, CIV-0100 through CIV-0106 |
| Venture Track Specs | 12 | Core platform specs + supporting docs |
| **Total Spec Artifacts** | **20** | All marked CLOSED |
| Cross-Track Integration Points | 5 major connections identified | See Cross-Track Connections section |
| Open Planning Gaps | 0 | All closed |

---

## Cross-Project Integration Documentation (NEW)

A unified cross-project traceability layer has been created to formalize the 5 integration points and establish detailed interface contracts:

### New Traceability Documents

| Document | Location | Purpose |
|----------|----------|---------|
| **Cross-Project Traceability Matrix** | `docs/traceability/CROSS_PROJECT_TRACEABILITY.md` | Formal 1:1 mapping of CIV specs → Venture specs with integration contracts, interface specifications, and implementation status |
| **Unified Event Taxonomy** | `docs/traceability/EVENT_TAXONOMY.md` | Complete catalog of 58 events (32 CIV + 26 Venture) with cross-track event flows, schema definitions, and determinism guarantees |
| **Formal Interface Contracts** | `docs/reference/INTERFACE_CONTRACTS.md` | 5 detailed contracts with data schemas, sync protocols, validation rules, determinism guarantees, and implementation checklists |
| **Ecosystem Map** | `docs/reference/ECOSYSTEM_MAP.md` | One-page architecture overview of all 3 projects (Parpour, Venture, CIV) with governance, module breakdown, and project ownership |

### The 5 Formal Interface Contracts

| # | Contract ID | CIV Component | Venture Component | Purpose | Documentation |
|---|---|---|---|---|---|
| 1 | INT-001-LEDGER-ALIGNMENT | CIV-0100 (Economy) | TRACK-B (Treasury) | Double-entry ledger sync, conservation invariants | `INTERFACE_CONTRACTS.md` § 1 |
| 2 | INT-002-FSM-STATE-SYNC | CIV-0001 (Core Loop) | TRACK-C (Control Plane) | Tick ↔ task state synchronization, FSM alignment | `INTERFACE_CONTRACTS.md` § 2 |
| 3 | INT-003-INSTITUTION-COMPLIANCE | CIV-0103 (Institutions) | OPS_COMPLIANCE_SPEC | Institutional audit trails, evidence chains, causal provenance | `INTERFACE_CONTRACTS.md` § 3 |
| 4 | INT-004-ENERGY-QUOTA | CIV-0102, CIV-0100 (Energy) | TRACK-B, TRACK-C (Budget) | Energy conservation ↔ budget model, peak-shaving alignment | `INTERFACE_CONTRACTS.md` § 4 |
| 5 | INT-005-DETERMINISM-THEOREM | CIV-0104 (Constraints) | TRACK-A (Artifacts) | Minimal constraint set proof alignment, determinism verification | `INTERFACE_CONTRACTS.md` § 5 |

### Unified Event Taxonomy Summary

**CIV Event Domains** (32 event types):
- Simulation Lifecycle (5): run.started, run.completed, run.failed, tick.started, tick.completed
- Policy Evaluation (3): policy.evaluated, policy.applied, constraint.violation
- Economy (5): market.cleared, transfer.booked, balance.updated, supply.stress, price.changed
- Energy (5): energy.consumed, energy.generated, energy.stored, energy.balance, renewable.variability
- Citizens (6): citizen.born, citizen.education_updated, citizen.career_changed, citizen.retired, citizen.died, citizen.metrics_updated
- Institutions (6): institution.created, institution.state_changed, institution.merged, institution.split, institution.dissolved, institution.metrics_updated
- Geopolitics (4): war.declared, treaty.signed, territorial.control_changed, shadow.network_activated
- Social (3): health.crisis, unrest.escalated, ideology.shift, cultural.event

**Venture Event Domains** (26 event types):
- Workflow Orchestration (7): workflow.started/completed/failed, task.scheduled/started/completed/failed
- Artifact Compilation (6): artifact.ir_created, artifact.build.started/completed/failed, artifact.provenance_attested, artifact.cache_hit
- Money & Treasury (6): money.intent_created, money.authorization_decided, ledger.entry_created, budget.allocation_approved, budget.exceeded, reconciliation.run
- Compliance & Audit (6): compliance.case_opened/evidence_added/closed, compliance.violation_detected, audit.log_entry, policy.drift
- Policy & Governance (4): policy.bundle_published, policy.evaluation_started, policy.decision_made, policy.rollback_initiated
- User & Multi-Tenancy (4): user.onboarded, user.capability_changed, user.activity_signal, user.offboarded
- Privacy (3): privacy.request_received, privacy.request_processed, data.retention_policy_applied, pii.detected

**Cross-Track Event Flows** (5 major patterns):
- CIV Economy → Venture Ledger: `civ.economy.transfer_booked.v1` → `venture.ledger.entry_created.v1`
- CIV Policy → Venture Audit: `civ.policy.evaluated.v1` → compliance case evidence
- CIV Citizens → Venture Signals: `civ.citizen.lifecycle.event.v1` → `venture.user.activity_signal.v1`
- CIV Energy → Venture Quota: `civ.energy.consumed.v1` → budget consumption with conversion function
- CIV Institutions → Venture Compliance: `civ.institution.*.v1` → compliance case evidence chain

### How to Use These Documents

**For Spec Readers**:
1. Read `SPECS_INDEX.md` (you are here) for overview of all 20 specs
2. Read `docs/reference/ECOSYSTEM_MAP.md` for system architecture and project ownership
3. Read `docs/traceability/CROSS_PROJECT_TRACEABILITY.md` for formal mapping of integration points
4. Refer to `docs/reference/INTERFACE_CONTRACTS.md` for detailed data schemas and protocols

**For Implementation Teams**:
1. Identify your integration point from the 5 contracts above
2. Read the corresponding section in `INTERFACE_CONTRACTS.md` (full data schemas, validation rules, determinism guarantees)
3. Check `docs/traceability/EVENT_TAXONOMY.md` for event definitions and cross-track flows
4. Implement per the interface contract checklist; validate with provided test harnesses

**For Compliance & Audit**:
1. Read `docs/reference/INTERFACE_CONTRACTS.md` § 3 (Institutions ↔ Compliance) for audit trail procedures
2. Check `docs/traceability/EVENT_TAXONOMY.md` for compliance event types
3. Review `docs/reference/ECOSYSTEM_MAP.md` for governance layer and data flow architecture
4. Implement determinism verification per § 5 (Determinism Theorem proof alignment)

---

## Next Steps

1. **Integration Workstreams**: Prioritize CIV-0100 ↔ TRACK-B and CIV-0001 ↔ TRACK-C integration tasks
   - Detailed interface contracts available in `docs/reference/INTERFACE_CONTRACTS.md`

2. **Implementation Priority**: TRACK-C control-plane foundation must be in place before CIV simulation can be integrated
   - P0 timeline and task breakdown in `NEXT_STEPS.md`

3. **Determinism Contracts**: Leverage CIV-0104 (Minimal Constraint Set Theorem) to inform TRACK-A artifact determinism guarantees
   - Formal proof alignment specified in `docs/reference/INTERFACE_CONTRACTS.md` § 5

4. **Audit Integration**: Design how CIV's policy.applied.v1 events flow through Venture's compliance machine (OPS spec)
   - Event taxonomy and compliance integration in `docs/traceability/EVENT_TAXONOMY.md`
   - Institutional audit trail procedures in `docs/reference/INTERFACE_CONTRACTS.md` § 3

5. **Schema Alignment**: Reconcile CIV's ledger_transfers event with Venture's spend ledger schema (DATA spec)
   - Complete data schema mapping in `docs/reference/INTERFACE_CONTRACTS.md` § 1 (Ledger Alignment Contract)

---

---

## Newly Added Specs & Game Design Docs (2026-02-21 Expansion)

### Master Integration & Economics Documentation

| Document | Location | Purpose | Lines |
|----------|----------|---------|-------|
| **Master Cross-Project Integration Spec** | (meta-reference) | Unified architecture for all 3 projects with governance layers | This index |
| **Venture Self-Funding Mechanics** | `docs/reference/VENTURE_SELF_FUNDING_MECHANICS.md` | Complete economic model: labor commodification, revenue streams, treasury optimization, reinvestment strategy | 2,100+ |
| **CivLab Game Design Document** | `docs/reference/CIVLAB_GAME_DESIGN.md` | Full game design: core mechanics, economy systems, war/diplomacy, modding API, victory conditions | 1,650+ |

### Venture Economics Documentation

**Core Economic Model:**
- Labor commodification (Agent-Hour model)
- Five venture types (V1 Research → V5 Orchestration)
- Pricing stack per venture type
- Daily treasury optimization loop
- Reinvestment decision matrix
- Portfolio risk management (HHI concentration limits)

**Key Sections:**
1. Agent-Hour (AH) unit model with pricing stack
2. Five venture types with margin profiles, constraints, growth levers
3. Daily measurement → allocation → reinvestment cycle
4. Reserve management policies (runway tiers, drawdown triggers)
5. Cash flow scenarios (baseline, contraction, rapid growth)
6. Portfolio diversification via HHI index
7. Annual stress testing procedures
8. Emergency mode governance & decision rules

**Financial Metrics (v1 baseline):**
- Daily revenue: $143 (85 AH/day @ $1.60 blended)
- Daily COGS: $35 (infrastructure + APIs)
- Daily operating expense: $27 (allocated overhead)
- Net income: $56/day → ~$20k/year
- Reserve runway: 75 days (balanced growth mode)
- Portfolio HHI: 1575 (moderate concentration)

---

### CivLab Game Design Documentation

**Comprehensive Game Design:**
- Inspirations & differentiation (Dwarf Fortress, Victoria 3, CK3, Factorio, OpenTTY)
- Three-zoom architecture (Strategic, Tactical, Simulation layers)
- Complete simulation tick breakdown (12 phases)
- Three economy systems (Market, Planned, Joule-backed)
- Trade network mechanics & merchant AI
- War, diplomacy, and casus belli system
- Shadow networks & espionage operations
- Modding & extensibility (headless core, YAML scenarios)
- Game modes (Campaign, Sandbox, Research)
- Victory conditions & defeat scenarios
- Technical architecture & determinism guarantees

**Key Game Mechanics:**

**Economy Systems:**
- **Market Economy**: Price signals, merchant networks, boom/bust cycles
- **Planned Economy**: Central planner quotas, coordination overhead, low inequality
- **Joule Economy**: Energy-backed currency, climate integration, production via physics

**War & Diplomacy:**
- Casus belli validation (territorial, religious, ideological, etc.)
- Alliance formation with trust mechanics
- Battle resolution (armies, terrain, morale)
- Shadow networks (intelligence, sabotage, assassination, propaganda)

**Modding Platform:**
- Headless core publishes state via WebSocket + JSON events
- Multiple client types (Web, Desktop, TUI)
- YAML scenario format with victory conditions
- Custom policy definitions with effects
- Deterministic replay (same seed = same events)

**Victory Conditions:**
- Stability victory (maintain >80 for 100 ticks)
- Territorial victory (control 60% of map)
- Economic victory (top-quartile GDP per capita)
- Hegemony victory (control 60% energy production)
- Diplomatic victory (50% of nations in your alliance)
- Scientific victory (unlock final technology)

---

### Cross-Project Integration: The Complete Picture

**Three Projects, One Ecosystem:**

```
┌─────────────────────────────────────────────────────────────────┐
│                     Parpour (Meta-Governance)                   │
│  - CLAUDE.md (policies, instruction architecture)               │
│  - SPECS_INDEX.md (you are here)                               │
│  - docs/governance/* (cross-project rules, QA mandates)         │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼────┐     ┌─────▼─────┐    ┌───▼──────┐
    │   CIV    │     │  Venture  │    │ External │
    │  (Rust)  │     │  (Python) │    │  Clients │
    │          │     │           │    │          │
    │Headless  │     │Agent Orch │    │ Research │
    │Sim Core  │     │Control    │    │ Platform │
    │+ Events  │     │Plane      │    │ Usage    │
    └─────┬────┘     └─────┬─────┘    └────┬─────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                [5 Integration Contracts]
                 (INTERFACE_CONTRACTS.md)
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼────┐     ┌─────▼─────┐    ┌───▼──────┐
    │ Ledger   │     │   FSM     │    │Compliance│
    │Alignment │     │Sync       │    │ Audit    │
    │(INT-001) │     │(INT-002)  │    │(INT-003) │
    │          │     │           │    │          │
    │Balance:  │     │Task ↔     │    │Policies  │
    │∑=0       │     │Tick       │    │→Evidence │
    └──────────┘     └───────────┘    └──────────┘
```

**Event Flow Example (CIV → Venture):**

```
1. CIV Simulation Tick #100 completes
2. Event: civ.economy.transfer_booked.v1
   { sender: "Great Britain", receiver: "France",
     amount: 1000 joules, reason: "war_reparations" }

3. CIV publishes event to Venture control plane
4. Venture receives event, validates schema, creates ledger entry:
   venture.ledger.entry_created.v1
   { debit: "gb_reparations_paid", credit: "france_reparations_received",
     amount: 1000, reference_type: "civ_transfer", policy_bundle_id: "..." }

5. Venture applies to treasury:
   - GB treasury -1000 joules (commitment honored)
   - France treasury +1000 joules (compensation received)

6. Compliance machine logs evidence:
   "Transfer authorized per treaty.signed.v1 event ID: ..."

7. Both systems converge on same ledger state (deterministic)
```

---

## Source References

- `../civ/docs/PLANNING_GAP_STATUS.md`
- `../civ/docs/PLANNING_GAP_CLOSURE_MATRIX.md`
- All CIV spec files in `../civ/docs/specs/CIV-*.md`
- All Venture spec files in root directory (merged from `./venture/`)
- Conversation context: `/Users/kooshapari/temp-PRODVERCEL/485/kush/parpour/../civ/docs/context/CONVO_2026-02-21_*.md`
- **NEW**: `docs/reference/VENTURE_SELF_FUNDING_MECHANICS.md` (2,100 lines)
- **NEW**: `docs/reference/CIVLAB_GAME_DESIGN.md` (1,650 lines)
