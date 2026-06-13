# Kush Ecosystem Map

**Date:** 2026-02-21
**Scope:** Full system architecture and cross-project relationships
**Status:** ACTIVE
**Owner:** Kush Ecosystem Integration Team

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         KUSH ECOSYSTEM (2026)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  PARPOUR (Planning & Specification Workspace)                          │
│  └─ Version control for specs, integration contracts, governance       │
│                                                                          │
│     ├─ VENTURE (Autonomous Agent Platform)                            │
│     │  │ Primary Language: Rust/TypeScript (control plane)             │
│     │  │ Primary Language: Python (agentic workflows)                  │
│     │  │ Stack: FastAPI, PostgreSQL, async task queue                │
│     │  │                                                                │
│     │  ├─ TRACK-A: Artifact Compiler (IR family, deterministic build) │
│     │  │  ├─ SlideSpec, DocSpec, TimelineSpec, AudioSpec, BoardSpec   │
│     │  │  └─ Deterministic build contract with provenance chain       │
│     │  │                                                                │
│     │  ├─ TRACK-B: Treasury & Compliance (money control, ledger)      │
│     │  │  ├─ Double-entry accounting (ledger_entries table)           │
│     │  │  ├─ Spend authorization and policy attestation               │
│     │  │  └─ Daily reconciliation and drift detection                 │
│     │  │                                                                │
│     │  ├─ TRACK-C: Control Plane (orchestration, FSM, tools)         │
│     │  │  ├─ Workflow DAG execution engine                            │
│     │  │  ├─ Event bus with strict validation                         │
│     │  │  ├─ Tool allowlist and per-role capability model            │
│     │  │  └─ Workspace isolation boundaries                           │
│     │  │                                                                │
│     │  └─ Supporting Systems:                                          │
│     │     ├─ User Management (roles, onboarding, multi-tenant)        │
│     │     ├─ Operations & Compliance (audit trails, incident doctrine)│
│     │     └─ Data Model (artifact IR, ledger, workflow tables)        │
│     │                                                                    │
│     └─────────── (5 Integration Points) ─────────────────────────────┬─│
│                                                                        │ │
│     ├─ CIV (City Simulation Engine)                                  │ │
│     │  │ Primary Language: Rust (all modules)                         │ │
│     │  │ Stack: Deterministic tick engine, concurrent simulation     │ │
│     │  │                                                              │ │
│     │  ├─ CIV-0001: Core Simulation Loop                            │ │
│     │  │  └─ Tick-based state machine with deterministic ordering   │ │
│     │  │                                                              │ │
│     │  ├─ CIV-0100: Economy v1 (Joule-backed)                      │ │
│     │  │  ├─ Double-entry ledger (ledger_transfers)                 │ │
│     │  │  ├─ Market clearing and price discovery                    │ │
│     │  │  └─ Conservation invariants                                │ │
│     │  │                                                              │ │
│     │  ├─ CIV-0101: Two-Zoom LOD (spatial representation)           │ │
│     │  │  ├─ Tile-based world at regional zoom                      │ │
│     │  │  └─ Detailed LOD at city zoom                              │ │
│     │  │                                                              │ │
│     │  ├─ CIV-0102: Energy Accounting (Joule conservation)          │ │
│     │  │  ├─ Supply/demand balance tracking                         │ │
│     │  │  ├─ Renewable variability and storage dynamics             │ │
│     │  │  └─ Peak-shaving and demand-response mechanics             │ │
│     │  │                                                              │ │
│     │  ├─ CIV-0103: Institutions & Citizen Lifecycle                │ │
│     │  │  ├─ Citizen birth/education/career/retirement/death        │ │
│     │  │  ├─ Institutional state machine (pending→active→dissolved)  │ │
│     │  │  └─ Time-series metrics (age, wealth, satisfaction)        │ │
│     │  │                                                              │ │
│     │  ├─ CIV-0104: Minimal Constraint Set Theorem                  │ │
│     │  │  └─ Mathematical foundation for determinism                │ │
│     │  │                                                              │ │
│     │  ├─ CIV-0105: War, Diplomacy & Shadow Networks                │ │
│     │  │  ├─ Geopolitical dynamics and territorial control          │ │
│     │  │  └─ Shadow networks for covert influence                   │ │
│     │  │                                                              │ │
│     │  ├─ CIV-0106: Social, Ideology, Health & Insurgency           │ │
│     │  │  ├─ Health crises and epidemiology                         │ │
│     │  │  ├─ Ideological shifts and cultural events                 │ │
│     │  │  └─ Citizen agency and insurgency mechanics                │ │
│     │  │                                                              │ │
│     │  └─ CIV-0107: Joule Economy System v1                         │ │
│     │     ├─ Energy-backed currency and accounting                  │ │
│     │     └─ Production cost basis tied to energy consumption       │ │
│     │                                                                  │
│     └─────────────────────────────────────────────────────────────────┘
│
│  GOVERNANCE LAYER (Applied to all projects)
│  ├─ Global CLAUDE.md (critical security rules, proactive governance, QA)
│  ├─ Project-local CLAUDE.md (domain-specific overrides and patterns)
│  ├─ Spec-first workflow (proposal → design → tasks → implementation)
│  ├─ Deterministic quality gates (lint, type-check, unit/integration tests)
│  ├─ Workstream tracking and sub-agent delegation
│  └─ Library-first philosophy (no reinvention of generic problems)
│
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Project Inventory

### 1. PARPOUR (Specification & Planning Workspace)

**Location**: `/Users/kooshapari/temp-PRODVERCEL/485/kush/parpour/`

**Primary Purpose**: Central repository for all specification artifacts, cross-project integration contracts, and governance documents for the Kush ecosystem.

**Primary Language(s)**: Markdown (specifications), YAML (configs)

**Key Governance Files**:
- `CLAUDE.md` - Project-local instructions (spec-first workflow, delegation patterns, quality gates)
- `SPECS_INDEX.md` - Master index of all 20 spec artifacts and 5 cross-track integration points
- `NEXT_STEPS.md` - Implementation priorities (P0/P1/P2 phased roadmap)

**Spec Files** (Venture track, all in `venture/` directory):
- `TECHNICAL_SPEC.md` - Control-plane architecture, runtime model, security posture
- `TRACK_A_ARTIFACT_DETERMINISM_SPEC.md` - Artifact IR family, deterministic build/replay
- `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` - Money control, double-entry ledger, reconciliation
- `TRACK_C_CONTROL_PLANE.md` - Orchestration, FSM, tool allowlist, incident doctrine
- `API_EVENTS_SPEC.md` - Event envelope schema, FSM transitions, strict validation
- `DATA_MODEL_DB_SPEC.md` - Artifact IR, ledger, workflow, and audit log schemas
- `OPS_COMPLIANCE_SPEC.md` - Compliance machine, audit toolchain, incident playbooks
- `USER_SPEC.md` - User roles, capabilities, onboarding, multi-tenant isolation
- `PRODUCT_MODEL.md` - Vision, users, jobs to be done, success metrics
- `SCHEMA_PACK.md` - Consolidated schema definitions (artifact, ledger, workflow, event)
- `ROLE_TOOL_ALLOWLIST_MATRIX.md` - Per-role capability model and tool allowlists
- `IMPLEMENTATION_ROADMAP.md` - Phased rollout plan (Sandbox → Limited Autopilot → Governed Autonomy)

**Documentation Structure**:
```
parpour/
  ├─ CLAUDE.md (project instructions)
  ├─ SPECS_INDEX.md (master spec index)
  ├─ NEXT_STEPS.md (implementation priorities)
  ├─ venture/ (all Venture specs)
  │   ├─ TECHNICAL_SPEC.md
  │   ├─ TRACK_A_ARTIFACT_DETERMINISM_SPEC.md
  │   ├─ TRACK_B_TREASURY_COMPLIANCE_SPEC.md
  │   ├─ TRACK_C_CONTROL_PLANE.md
  │   └─ ... (9 more spec files)
  └─ docs/
      ├─ governance/ (governance docs)
      ├─ reference/ (quick references, this file)
      ├─ research/ (conversation dumps, analysis)
      ├─ adr/ (architecture decision records)
      ├─ guides/ (implementation guides)
      └─ traceability/
          ├─ CROSS_PROJECT_TRACEABILITY.md (formal integration matrix)
          └─ EVENT_TAXONOMY.md (unified event catalog)
```

**Ownership**: Kush Ecosystem Integration Team (coordination role; defers implementation to CIV and Venture teams)

---

### 2. VENTURE (Autonomous Agent Platform)

**Location**: `/Users/kooshapari/temp-PRODVERCEL/485/kush/venture/` (planned)

**Primary Purpose**: Production-ready autonomous agent control plane with artifact compiler, treasury system, and compliance machinery.

**Primary Language(s)**:
- **Rust** (control-plane core, performance-critical paths)
- **Python** (agentic workflows, policy evaluation, tool implementations)
- **TypeScript** (frontend, artifact schemas)

**Tech Stack**:
- **Orchestration**: FastAPI + async/await (Python control plane)
- **Data Layer**: PostgreSQL (ledger, artifact IR, audit logs)
- **Event Bus**: Message queue (e.g., RabbitMQ or Kafka) for event streaming
- **Build System**: Cargo (Rust), Poetry/uv (Python)
- **Testing**: pytest, criterion (Rust benchmarks), property-based tests
- **CI/CD**: GitHub Actions, deterministic build caching

**Module Breakdown**:

#### TRACK-A: Artifact Compiler & Determinism
- **Responsibility**: IR schema definitions, deterministic build contracts, provenance signing
- **Key Files**: `src/artifact/ir.rs`, `src/artifact/compiler.rs`, `src/artifact/cache.rs`
- **Specs**: `TRACK_A_ARTIFACT_DETERMINISM_SPEC.md`, `SCHEMA_PACK.md`
- **Ownership**: Venture Artifact Team (2-3 engineers)

#### TRACK-B: Treasury & Compliance
- **Responsibility**: Money authorization, double-entry ledger, reconciliation, audit trails
- **Key Files**: `src/treasury/authorization.rs`, `src/treasury/ledger.rs`, `src/treasury/reconcile.rs`
- **Specs**: `TRACK_B_TREASURY_COMPLIANCE_SPEC.md`, `DATA_MODEL_DB_SPEC.md`
- **Ownership**: Venture Treasury Team (2-3 engineers)

#### TRACK-C: Control Plane
- **Responsibility**: Workflow orchestration, FSM, event bus, tool allowlist, workspace isolation
- **Key Files**: `src/orchestration/workflow.rs`, `src/orchestration/fsm.rs`, `src/orchestration/event_bus.rs`, `src/orchestration/tools.rs`
- **Specs**: `TRACK_C_CONTROL_PLANE.md`, `API_EVENTS_SPEC.md`
- **Ownership**: Venture Platform Team (3-4 engineers)

#### Supporting Systems
- **User Management**: `src/users/roles.rs`, `src/users/onboarding.rs`
- **Operations & Compliance**: `src/ops/compliance_machine.rs`, `src/ops/audit_trail.rs`
- **Data Model**: `schema/` directory with Prisma/SQLAlchemy ORM definitions

**Governance Files**:
- `CLAUDE.md` - Venture project instructions (spec-first, integration points, delegation patterns)
- `docs/governance/` - Quality gates, traceability checks, incident doctrine
- `docs/adr/` - Architecture decision records (e.g., "Why Rust for control plane?")

**Ownership**: Venture Autonomy Platform Team (primary owner of TRACK-A, TRACK-B, TRACK-C implementation)

---

### 3. CIV (City Simulation Engine)

**Location**: `/Users/kooshapari/temp-PRODVERCEL/485/kush/civ/`

**Primary Purpose**: Deterministic city simulation system generating economy, energy, institutional, and citizen lifecycle events.

**Primary Language(s)**:
- **Rust** (all modules; determinism requirement)

**Tech Stack**:
- **Simulation Core**: Custom tick-based engine (no external sim framework)
- **Data Layer**: SQLite (local simulation state), PostgreSQL (event export)
- **Build System**: Cargo
- **Testing**: criterion (benchmarks), property-based tests, determinism verification harness
- **Visualization**: Optional (separate from core sim)

**Module Breakdown** (Rust crates):

- **crates/engine** - Core simulation loop (CIV-0001)
- **crates/economy** - Ledger, market clearing, transfers (CIV-0100)
- **crates/spatial** - Two-zoom LOD system (CIV-0101)
- **crates/energy** - Energy accounting and balance (CIV-0102)
- **crates/demographics** - Citizen lifecycle and metrics (CIV-0103)
- **crates/institutions** - Institutional state machines (CIV-0103)
- **crates/policy** - Policy evaluation and application (CIV-0100, all modules)
- **crates/geopolitics** - War, diplomacy, shadow networks (CIV-0105)
- **crates/social** - Health, ideology, insurgency (CIV-0106)
- **crates/energy_economy** - Joule-backed economy integration (CIV-0107)

**Spec Files** (all in `docs/specs/`):
- `CIV-0001-core-simulation-loop.md` - Tick sequencing, deterministic order
- `CIV-0100-economy-v1.md` - Double-entry ledger, market clearing, conservation
- `CIV-0101-two-zoom-lod-v1.md` - Spatial representation
- `CIV-0102-climate-followup-v1.md` - Energy accounting, supply-demand
- `CIV-0103-institutions-timeseries-citizen-lifecycle-v1.md` - Actor models, institutional change
- `CIV-0104-minimal-constraint-set-theorem.md` - Mathematical foundations
- `CIV-0105-war-diplomacy-shadow-v1.md` - Geopolitical dynamics
- `CIV-0106-social-ideology-health-insurgency-v1.md` - Citizen agency, conflict
- `CIV-0107-joule-economy-system-v1.md` - Energy-backed economy

**Governance Files**:
- `docs/GOVERNANCE_BASELINE_FROM_KUSH_PROJECTS.md` - Reusable governance practices
- `docs/traceability/TRACEABILITY_MATRIX.md` - CIV spec → code mapping
- `docs/upstream-governance/thegent/CLAUDE.md` - Global governance context (read-only reference)

**Ownership**: CIV Simulation Team (primary owner of all CIV specs and implementation)

---

## 5 Cross-Track Integration Points

All integration points documented formally in `docs/traceability/CROSS_PROJECT_TRACEABILITY.md`:

| # | Name | CIV Spec | Venture Track | Status |
|---|------|----------|---------------|--------|
| 1 | **Economy Ledger** | CIV-0100 | TRACK-B (Treasury) | Spec Complete; P0 implementation |
| 2 | **Simulation State & Workflow** | CIV-0001, CIV-0100 | TRACK-C (Control Plane) | Spec Complete; P0 implementation |
| 3 | **Institutions & Compliance** | CIV-0103 | OPS_COMPLIANCE_SPEC | Spec Complete; P1 implementation |
| 4 | **Energy Accounting & Cost Control** | CIV-0102, CIV-0100 | TRACK-B, TRACK-C | Spec Complete; P1 implementation |
| 5 | **Determinism & Constraints** | CIV-0104 | TRACK-A (Artifacts) | Spec Complete; P0 implementation |

---

## Data Flow Architecture

### Flow 1: CIV Simulation Tick → Venture Event Bus → Ledger

```
CIV Tick T
  ├─→ Policy evaluated
  ├─→ Market cleared
  ├─→ economy.transfer_booked.v1 emitted (multiple)
  └─→ energy.consumed.v1 emitted (multiple)
       ↓
Event Relay Layer (TRACK-C)
  └─→ Wrap in EventEnvelopeV1
       ↓
Venture Event Bus
  ├─→ Subscribe: Ledger Engine
  │    └─→ Double-entry transaction
  │        └─→ ledger.entry.created.v1
  └─→ Subscribe: Compliance Engine
       └─→ Audit case evidence chain
```

### Flow 2: Artifact Compilation in Venture

```
Artifact IR Created (TimelineSpec, DocSpec, etc.)
  ├─→ artifact.ir_created.v1 emitted
  └─→ Artifact Build Pipeline
       ├─→ Deterministic cache lookup (idempotency key)
       ├─→ If cache miss:
       │    ├─→ Determine cost estimate
       │    ├─→ Request money intent from TRACK-B
       │    ├─→ Build artifact (with toolchain pinning)
       │    └─→ Compute content hash
       └─→ artifact.provenance_attested.v1 (signed)
            └─→ artifact.build_completed.v1
```

### Flow 3: Budget Enforcement in Venture

```
Task Execution in Workflow
  ├─→ Each tool call costs EAU (from TRACK-C allowlist)
  ├─→ Deduct from workspace quota (TRACK-C isolation)
  ├─→ If quota exceeded:
  │    ├─→ Emit budget.exceeded.v1
  │    ├─→ Query TRACK-B spend ledger
  │    └─→ Trigger remediation or escalation
  └─→ At workflow end: reconcile actual vs. budgeted
       └─→ reconciliation.run.v1
```

---

## Governance Layer

Applied uniformly across **parpour**, **venture**, and **civ**:

### Critical Governance Rules

1. **Library-First Philosophy** (Global CLAUDE.md)
   - No custom retry logic → use `tenacity`
   - No custom HTTP clients → use `httpx`
   - No custom logging → use `structlog`
   - No custom file watching → use `watchdog`

2. **Spec-First Workflow** (Project-local CLAUDE.md)
   - Every feature starts as a spec PR
   - Every spec includes invariants, interfaces, acceptance criteria
   - Every implementation references spec IDs

3. **Deterministic Quality Gates** (Enforced by CI/CD)
   - Linting (ruff, clippy)
   - Type checking (mypy, rustc)
   - Unit tests (pytest, cargo test)
   - Integration tests (determinism verification)
   - No new suppressions without inline justification

4. **Proactive Governance Evolution** (Lifecycle rule)
   - When work touches a governed domain, update governance docs
   - Examples: retry policy, cache policy, HTTP client choice
   - See: `docs/reference/PROACTIVE_GOVERNANCE_EVOLUTION_PLAN.md`

5. **Workstream Tracking** (Active ledger in `docs/reference/WORK_STREAM.md`)
   - All tasks claimed before starting
   - Status updated as work progresses
   - Completed tasks marked with delivery date

---

## Key Contact Matrix (Agent Roles)

**Parpour (Coordination)**
- **Spec Architect**: Reviews integration points, resolves cross-track conflicts
- **Integration Manager**: Coordinates CIV and Venture team sync points

**Venture (Implementation)**
- **Platform Lead**: Owns TRACK-C (control plane, orchestration, event bus)
- **Treasury Lead**: Owns TRACK-B (ledger, authorization, reconciliation)
- **Artifact Lead**: Owns TRACK-A (IR family, deterministic build, provenance)
- **Compliance Officer**: Owns OPS_COMPLIANCE_SPEC, audit machinery, incident doctrine

**CIV (Implementation)**
- **Simulation Lead**: Owns CIV-0001 (core loop, determinism)
- **Economy Lead**: Owns CIV-0100, CIV-0107 (ledger, Joule economy)
- **Institution Lead**: Owns CIV-0103 (institutions, citizen lifecycle)
- **Energy Lead**: Owns CIV-0102 (energy accounting)

**Cross-Track Integration**
- **CIV-Venture Integration PM**: Coordinates all 5 integration points, resolves blockers

---

## Documentation Navigation

### For Spec Readers
1. Start with `SPECS_INDEX.md` (master index of 20 artifacts)
2. Read domain-specific spec (e.g., `TRACK_B_TREASURY_COMPLIANCE_SPEC.md`)
3. Check cross-track dependencies in `CROSS_PROJECT_TRACEABILITY.md`
4. Review event schemas in `EVENT_TAXONOMY.md`

### For Implementation Teams
1. Read project-local `CLAUDE.md` (e.g., `venture/CLAUDE.md`)
2. Identify your domain spec(s) from Quick Navigation table
3. Check `NEXT_STEPS.md` for implementation priorities and owner assignments
4. Refer to `IMPLEMENTATION_ROADMAP.md` for phased rollout plan

### For Compliance & Audit
1. Read `OPS_COMPLIANCE_SPEC.md` (audit machinery, incident doctrine)
2. Check `CROSS_PROJECT_TRACEABILITY.md` for audit trail requirements
3. Review `docs/governance/` for policy bundles and quality gates
4. Refer to `docs/traceability/` for evidence chain procedures

---

## File Location Quick Reference

| Artifact Type | Location | Example |
|---|---|---|
| Master spec index | `parpour/SPECS_INDEX.md` | All 20 specs indexed |
| Venture spec | `parpour/venture/` | `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` |
| CIV spec | `civ/docs/specs/` | `CIV-0100-economy-v1.md` |
| Cross-track traceability | `parpour/docs/traceability/` | `CROSS_PROJECT_TRACEABILITY.md` |
| Event taxonomy | `parpour/docs/traceability/EVENT_TAXONOMY.md` | All 58 event types |
| Governance baseline | `civ/docs/GOVERNANCE_BASELINE_FROM_KUSH_PROJECTS.md` | Reusable practices |
| Implementation roadmap | `parpour/venture/IMPLEMENTATION_ROADMAP.md` | P0/P1/P2 phased plan |
| Conversation dumps | `parpour/docs/research/` | `CONVERSATION_DUMP_2026-02-21.md` |
| Architecture decisions | `parpour/docs/adr/` | `ADR-NNN-decision-name.md` |

---

## Summary

The Kush ecosystem comprises three interconnected projects:

1. **Parpour** (planning workspace): Central spec repository and cross-project coordination
2. **Venture** (agent platform): Production-ready autonomy control plane with 3 major tracks
3. **CIV** (city sim): Deterministic simulation engine with 8 integrated spec domains

All projects follow unified governance (spec-first, determinism, library-first, proactive governance evolution). All integration points are formally documented with interface contracts, event flows, and implementation timelines.

**Current Status**: All 20 spec artifacts closed; zero planning gaps. P0 foundation implementation begins Week 1; P1 integration Week 2; P2 polish Week 3+.

---

**Document Control**

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-02-21 | Kush Integration Team | Initial version; ecosystem map with 3 projects, 8 CIV domains, 3 Venture tracks, 5 integration points |

