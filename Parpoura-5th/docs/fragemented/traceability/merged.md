# Merged Fragmented Markdown

## Source: traceability/CROSS_PROJECT_TRACEABILITY.md

# Cross-Project Traceability Matrix

**Date:** 2026-02-21
**Scope:** Links between CIV simulation specs (CIV-0100 through CIV-0107) → Venture autonomy platform specs → Parpour planning documents
**Status:** ACTIVE
**Owner:** Kush Ecosystem Integration Team

---

## Executive Summary

This document formalizes the traceability relationships connecting the three projects:
- **CIV**: City simulation system (Rust-based, deterministic, Joule energy economy)
- **Venture**: Autonomous agent control plane (orchestration, compliance, artifact compilation)
- **Parpour**: Planning and specification workspace (meta-governance, cross-project coordination)

The matrix below documents each CIV specification's integration with Venture platform capabilities, identifies the interface contracts required, and tracks implementation status.

---

## Integration Points Overview

| # | CIV Spec | Venture Track | Parpour Planning | Integration Type | Status |
|---|----------|---------------|------------------|------------------|--------|
| 1 | CIV-0100 (Economy) | TRACK-B (Treasury) | `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` | **Ledger Alignment** | Spec Complete |
| 2 | CIV-0001 (Core Loop) + CIV-0100 | TRACK-C (Control Plane) | `TRACK_C_CONTROL_PLANE.md` | **FSM & State Sync** | Spec Complete |
| 3 | CIV-0103 (Institutions) | USER_SPEC + OPS (Compliance) | `OPS_COMPLIANCE_SPEC.md` | **Actor Lifecycle** | Spec Complete |
| 4 | CIV-0102 (Energy) + CIV-0100 | TRACK-B + TRACK-C (Quotas) | `TRACK_B_TREASURY_COMPLIANCE_SPEC.md` | **Resource Control** | Spec Complete |
| 5 | CIV-0104 (Constraints) | TRACK-A (Artifacts) | `TRACK_A_ARTIFACT_DETERMINISM_SPEC.md` | **Determinism** | Spec Complete |

---

## Detailed Traceability Matrix

### Integration Point 1: CIV Economy Ledger ↔ Venture Treasury Ledger

| Source Spec | Target Spec | Integration Type | Interface Contract | Status | Notes |
|---|---|---|---|---|---|
| **CIV-0100**: Economy v1 (double-entry accounting, market clearing, conservation) | **TRACK-B**: Treasury, Ledger, Compliance Closure | **Ledger Alignment** | `LEDGER_ALIGNMENT_CONTRACT.md` | Spec Complete | CIV's `ledger_transfers` event maps to Venture's `ledger.entry.created.v1` with double-entry pairs (debit/credit); reconciliation loops align |
| CIV-0100 (market clearing, supply-demand equilibrium) | TRACK-B (spend policies, cost allocation) | **Pricing Model** | `PRICING_ALIGNMENT_CONTRACT.md` | Spec Complete | CIV's market clearing price discovery → Venture's service cost basis; tier-based pricing variants |
| CIV-0100 (conservation invariants: sum of flows = 0) | TRACK-B (ledger conservation: all entries must balance) | **Invariant Alignment** | `CONSERVATION_INVARIANT_CONTRACT.md` | Spec Complete | Both systems enforce conservation; cross-system validation required during event relay |
| CIV-0100 (policy-driven transfer controls) | TRACK-B (policy attestation in authorizations) | **Policy Binding** | `POLICY_BINDING_CONTRACT.md` | Spec Complete | CIV's `policy.applied.v1` event includes policy_bundle_id; Venture's authorization decision is pinned to matching bundle version |

**Key Contracts:**
- **LEDGER_ALIGNMENT_CONTRACT**: CIV `economy.transfer_booked.v1` → Venture `ledger.entry.created.v1` schema mapping
  - CIV payload: `{ sender, receiver, amount, reason, tick_id }`
  - Venture payload: `{ debit_account, credit_account, amount, reference_id, workflow_id, policy_bundle_id }`
  - Sync frequency: Every CIV tick (deterministic ordering)
  - Replay guarantee: Both systems must produce identical ledger state from event log

---

### Integration Point 2: CIV Simulation State ↔ Venture Workflow Orchestration

| Source Spec | Target Spec | Integration Type | Interface Contract | Status | Notes |
|---|---|---|---|---|---|
| **CIV-0001**: Core simulation loop (tick-based state transitions) | **TRACK-C**: Control-plane orchestration (FSM, event bus) | **State Machine Sync** | `FSM_STATE_SYNC_CONTRACT.md` | Spec Complete | CIV tick = Venture task; both emit state entry/exit events; deterministic ordering guaranteed |
| CIV-0001 (deterministic tick sequence: demographics → policy → economy → spatial) | TRACK-C (workflow DAG execution: deterministic order guarantee) | **Execution Order** | `EXECUTION_ORDER_CONTRACT.md` | Spec Complete | Both enforce strict ordering; Venture task DAG mirrors CIV tick sequence within a simulation run |
| CIV-0100 (policy.evaluate function, O(population) cost) | TRACK-C (tool allowlist, per-call budget) | **Tool Budget Model** | `TOOL_BUDGET_CONTRACT.md` | Spec Complete | `civ.policy.evaluate` tool costs 10 EAU/call, max 100 calls/workflow; budget enforcement by Venture policy engine |
| CIV-0001 (simulation run = collection of ticks; deterministic replay) | TRACK-C (workflow = collection of tasks; deterministic replay) | **Replay Guarantee** | `REPLAY_GUARANTEE_CONTRACT.md` | Spec Complete | Both support full deterministic replay from event log; idempotency key = `hash(state, policy_bundle_id, tick_id)` for CIV, task_id for Venture |

**Key Contracts:**
- **FSM_STATE_SYNC_CONTRACT**: CIV tick state machine ↔ Venture task state machine
  - CIV states: `pending_tick → executing_tick → committed_tick → verified_tick`
  - Venture states: `pending → scheduled → executing → completed|failed|revoked`
  - Sync point: CIV tick completion → emit `civ.tick.completed.v1` (includes all intermediate state hashes)
  - Venture task maps to CIV tick; task_id = `tick_id` for audit traceability

- **TOOL_BUDGET_CONTRACT**: Per-call cost and quota enforcement
  - Tool: `civ.policy.evaluate`
  - Cost: 10 EAU (Ecosystem Allocation Unit) per call
  - Window: Per-workflow
  - Max calls: 100/workflow
  - Overrun behavior: Reject with `reason_code = quota_exceeded`

---

### Integration Point 3: CIV Institutions & Citizen Lifecycle ↔ Venture User Management & Compliance

| Source Spec | Target Spec | Integration Type | Interface Contract | Status | Notes |
|---|---|---|---|---|---|
| **CIV-0103**: Institutions, time-series, citizen lifecycle (actor birth/education/career/retirement/death) | **USER_SPEC**: User roles, capabilities, onboarding | **Actor Model Mapping** | `ACTOR_LIFECYCLE_MAPPING_CONTRACT.md` | Spec Complete | CIV citizen lifecycle (birth → education → career → retirement → death) maps to Venture user journey (signup → onboarding → active → suspension → offboarded); institutional change → user capability changes |
| CIV-0103 (institutional state machine: pending → active → dormant → dissolved) | OPS_COMPLIANCE_SPEC (compliance case lifecycle) | **Institution to Case Mapping** | `INSTITUTION_CASE_MAPPING_CONTRACT.md` | Spec Complete | CIV institution state transitions emit `institution.state_changed.v1` events; Venture compliance machine creates audit evidence chains for each transition |
| CIV-0103 (citizen time-series metrics: age, education, wealth, satisfaction) | USER_SPEC (user activity signals, capability signals) | **Metrics Mapping** | `CITIZEN_METRICS_MAPPING_CONTRACT.md` | Spec Complete | CIV citizen metrics exported as `citizen.metrics.v1` events; Venture uses these to populate user activity dashboard and behavioral signals for policy evaluation |
| CIV-0103 (institutional change cascades: birth → affect economy → affect citizen options) | OPS_COMPLIANCE_SPEC (audit trail, evidence chains) | **Causal Audit Trail** | `CAUSAL_AUDIT_TRAIL_CONTRACT.md` | Spec Complete | Every institutional change must be traceable to a prior event; audit trail reconstructs full causality chain from event log |

**Key Contracts:**
- **ACTOR_LIFECYCLE_MAPPING_CONTRACT**: CIV citizen lifecycle ↔ Venture user journey
  - CIV citizen: `{id, age, education_level, wealth, institution_id, career_path, satisfaction}`
  - Maps to Venture user: `{id, onboarding_stage, capability_tier, spend_quota, org_id, activity_tier, nps_signal}`
  - Sync: CIV citizen birth → Venture user signup signal; death → offboarding signal

- **INSTITUTION_CASE_MAPPING_CONTRACT**: CIV institutional change ↔ Venture compliance case
  - CIV event: `institution.created.v1` → Venture audit case: `{case_id, case_type="entity_creation", evidence_chain=[event_id], status="open"}`
  - CIV event: `institution.dissolved.v1` → Venture audit case: `{case_type="entity_dissolution", evidence_chain=[...], status="closed_by_policy"}`

---

### Integration Point 4: CIV Energy Accounting ↔ Venture Resource Quota & Cost Control

| Source Spec | Target Spec | Integration Type | Interface Contract | Status | Notes |
|---|---|---|---|---|---|
| **CIV-0102**: Climate follow-up, energy accounting integration | **TRACK-B + TRACK-C**: Spend policies, rate-limiting | **Energy Conservation → Budget Model** | `ENERGY_TO_BUDGET_CONTRACT.md` | Spec Complete | CIV's energy conservation equation (`supply + reserves_in - losses - consumption - reserves_out = delta_stock`) maps to Venture's quota model (`auth_limit - approved_spend - pending_spend = available_quota`) |
| CIV-0100 + CIV-0102 (supply-stress metrics, peak-shaving) | TRACK-C (API rate limits, velocity controls) | **Demand-Response Model** | `DEMAND_RESPONSE_CONTRACT.md` | Spec Complete | CIV's peak-shaving and demand-response mechanics (e.g., price increase when supply < demand) inform Venture's cost escalation and rate-limit tiers |
| CIV-0102 (renewable energy variability, storage dynamics) | TRACK-B (spend budget windows, reserve accounts) | **Reserve Account Alignment** | `RESERVE_ACCOUNT_CONTRACT.md` | Spec Complete | CIV's energy reserves model parallels Venture's reserved-spend account; both enforce conservation laws and reconciliation audits |
| CIV-0100 (energy cost basis for production activities) | TRACK-B (artifact render cost model) | **Cost Attribution** | `COST_ATTRIBUTION_CONTRACT.md` | Spec Complete | CIV energy costs for production → Venture artifact render cost basis; tier-based pricing applies both systems |

**Key Contracts:**
- **ENERGY_TO_BUDGET_CONTRACT**: CIV energy conservation ↔ Venture budget conservation
  - CIV: `Energy(t) = Reserves(t-1) + Supply(t) - Losses(t) - Consumption(t) + RechargeInflux(t) - RechargeOutflux(t)`
  - Venture: `Budget(t) = Budget(t-1) + Allocation(t) - ApprovedSpend(t) - PendingSpend(t)`
  - Both equations must hold deterministically; cross-system validation on sync points (end of CIV tick, Venture workflow completion)

- **DEMAND_RESPONSE_CONTRACT**: Peak-shaving mechanics
  - CIV trigger: `if supply < demand then price *= 1.5 + (demand_excess / base_price)`
  - Venture trigger: `if pending_spend > 80% of budget then rate_limit *= 0.8 and cost_multiplier *= 1.2`
  - Mechanics align: both use price/cost escalation to moderate demand

---

### Integration Point 5: CIV Determinism & Minimal Constraint Theorem ↔ Venture Artifact Determinism

| Source Spec | Target Spec | Integration Type | Interface Contract | Status | Notes |
|---|---|---|---|---|---|
| **CIV-0104**: Minimal constraint set theorem (mathematical foundations for determinism) | **TRACK-A**: Artifact IR and determinism closure | **Constraint Foundation** | `CONSTRAINT_THEOREM_MAPPING_CONTRACT.md` | Spec Complete | CIV-0104's theorem provides mathematical foundation for Venture's deterministic build guarantees; both systems prove minimal invariant sets required to achieve determinism |
| CIV-0104 (state space reduction, canonical form for equivalence) | TRACK-A (artifact IR schema, content hash, deterministic build) | **Canonical Form** | `CANONICAL_FORM_CONTRACT.md` | Spec Complete | CIV's minimal state representation → Venture's artifact IR schema (SlideSpec, DocSpec, etc.); both define deterministic serialization for hash computation |
| CIV-0001 (tick replay: given state + tick, output is deterministic) | TRACK-A (build replay: given IR + toolchain, artifact is deterministic within provider bounds) | **Replay Contract** | `REPLAY_CONTRACT.md` | Spec Complete | Both systems guarantee: `f(input, policy_bundle_id) = output` is deterministic within specified bounds (CIV: byte-identical; Venture artifact: semantic-equivalent if non-deterministic provider) |
| CIV-0104 (invariant verification harness) | TRACK-A (artifact provenance chain, signature verification) | **Proof Artifact** | `PROOF_ARTIFACT_CONTRACT.md` | Spec Complete | CIV tick execution emits proof artifacts (state snapshots, policy evaluations); Venture artifact build captures similar proof artifacts (IR, toolchain version, seed, signature) |

**Key Contracts:**
- **CONSTRAINT_THEOREM_MAPPING_CONTRACT**: CIV-0104 theorem applied to Venture artifact determinism
  - CIV constraint set: `{population_state, institution_state, economy_ledger, energy_state, policy_bundle_id}`
  - Venture constraint set: `{artifact_ir, toolchain_version, policy_bundle_id, target_surface, provider_seeds}`
  - Both enforce: minimal set sufficient to prove determinism; no extraneous dependencies

- **REPLAY_CONTRACT**: Deterministic replay with pinned policy bundles
  - Input: `(tick_id, state_snapshot, policy_bundle_id)` for CIV; `(ir_id, toolchain_version, policy_bundle_id)` for Venture
  - Output: `(new_state, events_emitted)` for CIV; `(artifact_bytes, provenance_signature)` for Venture
  - Guarantee: Multiple executions with identical inputs produce identical outputs (modulo non-deterministic providers)
  - Verification: Hash-based equivalence check post-execution

---

## Cross-Track Event Flow

Unified event flow across CIV and Venture systems:

```
CIV Simulation Tick
  ├─→ policy.evaluated.v1 (CIV-0100)
  ├─→ economy.transfer_booked.v1 (CIV-0100)
  ├─→ energy.consumed.v1 (CIV-0102)
  ├─→ citizen.lifecycle.event.v1 (CIV-0103)
  └─→ institution.state_changed.v1 (CIV-0103)

Venture Event Bus (relayed from CIV)
  ├─→ civ.policy.evaluated.v1 → Venture audit case
  ├─→ civ.economy.transfer_booked.v1 → Venture ledger.entry.created.v1
  ├─→ civ.energy.consumed.v1 → Venture quota.consumption.recorded.v1
  ├─→ civ.citizen.lifecycle.event.v1 → Venture user.activity.signal.v1
  └─→ civ.institution.state_changed.v1 → Venture compliance.case.evidence.added.v1

Venture Artifact Compilation (parallel)
  ├─→ artifact.ir.created.v1 (e.g., CivSimulationArtifact with timeline + dashboard)
  ├─→ artifact.build.started.v1
  ├─→ artifact.provenance.attested.v1 (signed by determinism engine)
  └─→ artifact.build.completed.v1 → stored in artifact IR table

Ledger Reconciliation
  └─→ Both CIV and Venture ledgers reconcile; drift > threshold → compliance.violation.detected.v1
```

---

## Implementation Status by Integration Point

### Point 1: Economy Ledger ↔ Treasury
- **Spec Complete**: TRACK-B, CIV-0100
- **Interface Contracts**: LEDGER_ALIGNMENT_CONTRACT (defined above)
- **Implementation Phase**: P0 (Week 1)
- **Owner**: Venture Treasury Team + CIV Sim Team
- **Exit Criteria**: CIV `economy.transfer_booked.v1` events map to Venture `ledger.entry.created.v1`; reconciliation passes deterministic replay test

### Point 2: Simulation State ↔ Workflow Orchestration
- **Spec Complete**: TRACK-C, CIV-0001, API_EVENTS_SPEC
- **Interface Contracts**: FSM_STATE_SYNC_CONTRACT, TOOL_BUDGET_CONTRACT
- **Implementation Phase**: P0 (Week 1)
- **Owner**: Venture Platform Team + CIV Sim Team
- **Exit Criteria**: CIV tick events flow through Venture event bus; task DAG mirrors tick sequence; tool budgets enforced

### Point 3: Institutions ↔ Compliance Audit
- **Spec Complete**: CIV-0103, OPS_COMPLIANCE_SPEC, USER_SPEC
- **Interface Contracts**: ACTOR_LIFECYCLE_MAPPING_CONTRACT, INSTITUTION_CASE_MAPPING_CONTRACT
- **Implementation Phase**: P1 (Week 2)
- **Owner**: CIV-Venture Integration Team + Compliance Team
- **Exit Criteria**: CIV institutional changes create audit cases in Venture; evidence chains queryable; actor lifecycle signals populate user capability model

### Point 4: Energy Accounting ↔ Cost Control
- **Spec Complete**: CIV-0102, CIV-0100, TRACK-B, TRACK-C
- **Interface Contracts**: ENERGY_TO_BUDGET_CONTRACT, DEMAND_RESPONSE_CONTRACT
- **Implementation Phase**: P1 (Week 2)
- **Owner**: Venture Finance + CIV Sim Team
- **Exit Criteria**: CIV energy conservation equation informs Venture quota model; cost estimates bound actual spend within 5%; peak-shaving mechanics align

### Point 5: Determinism ↔ Artifact Build
- **Spec Complete**: CIV-0104, TRACK-A, API_EVENTS_SPEC
- **Interface Contracts**: CONSTRAINT_THEOREM_MAPPING_CONTRACT, REPLAY_CONTRACT
- **Implementation Phase**: P0 (Week 1)
- **Owner**: Venture Artifact Team + CIV Sim Team
- **Exit Criteria**: Artifact IR schemas conform to determinism theorem; byte-identical replay tests pass; provenance chains verified

---

## Reference: Planning Documents

### Parpour Planning Spec Files (Venture Track)
- `venture/TECHNICAL_SPEC.md` - Control-plane architecture, runtime model
- `venture/TRACK_A_ARTIFACT_DETERMINISM_SPEC.md` - Artifact IR family, deterministic build
- `venture/TRACK_B_TREASURY_COMPLIANCE_SPEC.md` - Money control, spend ledger, reconciliation
- `venture/TRACK_C_CONTROL_PLANE.md` - Orchestrator, FSM, tool allowlist, incident doctrine
- `venture/API_EVENTS_SPEC.md` - Event envelope schema, FSM transitions, validation
- `venture/DATA_MODEL_DB_SPEC.md` - Artifact IR tables, ledger tables, workflow tables
- `venture/OPS_COMPLIANCE_SPEC.md` - Compliance machine, audit toolchain, incident playbooks
- `venture/USER_SPEC.md` - User roles, capabilities, multi-tenant isolation
- `venture/SCHEMA_PACK.md` - Consolidated schema definitions (artifact, ledger, workflow, event)

### CIV Spec Files (linked from SPECS_INDEX.md)
- `../civ/docs/specs/CIV-0001-core-simulation-loop.md` - Tick sequencing, deterministic order
- `../civ/docs/specs/CIV-0100-economy-v1.md` - Double-entry ledger, market clearing, conservation
- `../civ/docs/specs/CIV-0101-two-zoom-lod-v1.md` - Spatial representation, LOD
- `../civ/docs/specs/CIV-0102-climate-followup-v1.md` - Energy accounting, supply-demand
- `../civ/docs/specs/CIV-0103-institutions-timeseries-citizen-lifecycle-v1.md` - Actor models, institutional change
- `../civ/docs/specs/CIV-0104-minimal-constraint-set-theorem.md` - Mathematical foundations for determinism
- `../civ/docs/specs/CIV-0105-war-diplomacy-shadow-v1.md` - Geopolitical dynamics
- `../civ/docs/specs/CIV-0106-social-ideology-health-insurgency-v1.md` - Citizen agency, emergent conflict
- `../civ/docs/specs/CIV-0107-joule-economy-system-v1.md` - Energy-backed economy, Joule unit

---

## Validation Checklist

Before marking an integration point as "Implementation Ready":

- [ ] Both source and target specs are CLOSED
- [ ] Interface contract document exists and is finalized
- [ ] Event schema mapping is complete (source event → target event)
- [ ] State machine alignment verified (if applicable)
- [ ] Determinism guarantees are stated and validated
- [ ] Cross-system invariants are formalized (e.g., conservation laws)
- [ ] Reconciliation procedure is documented
- [ ] Replay harness is designed and tested
- [ ] Owner teams have reviewed and approved the contract
- [ ] Integration test suite exists and passes

---

## Open Questions & Risk Register

### Q1. Non-Deterministic Artifact Providers (TRACK-A)
- **Risk**: Veo/NanoBanana do not guarantee byte-identical outputs
- **Mitigation**: Use semantic-equivalence fingerprinting; tag as non-deterministic
- **Owner**: Venture Artifact Team
- **Due Date**: End of Week 1 (P0)

### Q2. CIV Policy.Evaluate Tool Rate Limiting (TRACK-C ↔ CIV-0100)
- **Risk**: Tool is O(population); unbounded calls could exhaust quota
- **Mitigation**: Per-call budget = 10 EAU; max 100 calls/workflow
- **Owner**: CIV-Venture Integration Team
- **Due Date**: End of Week 1 (P0)

### Q3. Institutional Change Propagation Lag (CIV-0103 ↔ OPS_COMPLIANCE_SPEC)
- **Risk**: Unclear if institutional effects are instant or delayed
- **Mitigation**: Institution state machine has explicit delay phase; N specified in policy bundle
- **Owner**: CIV Sim Team
- **Due Date**: End of Week 1 (P0)

### Q4. CIV Simulation Artifacts IR Mapping (CIV-0001/0100/0103 ↔ TRACK-A)
- **Risk**: CIV outputs (timelines, dashboards, org charts) mapping to Venture artifact IRs unclear
- **Mitigation**: Define `CivSimulationArtifact` IR type; every simulation run exports via Venture artifact pipeline
- **Owner**: CIV-Venture Integration Team
- **Due Date**: End of Week 1 (P1 kickoff)

---

## Summary

All 5 integration points have complete specifications and formal interface contracts. The matrix above provides the traceability foundation for implementation teams. Each integration point has been assigned an owner, phase, and exit criteria.

**Next Action**: Schedule kickoff meeting with team leads from Venture Platform, Treasury, Artifact, CIV Simulation, and Compliance. Review the 5 integration points and 4 open questions; assign decision owners; commit to resolution dates.

**Target Timeline**:
- P0 (Week 1): All 5 integration point specs finalized; 4 open questions resolved or escalated
- P1 (Week 2): 80%+ implementation coverage of integration contracts
- P2 (Week 3+): Polish, incident hardening, compliance drills

---

**Document Control**

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-02-21 | Kush Integration Team | Initial version; all 5 points documented with formal contracts |



---

## Source: traceability/EVENT_TAXONOMY.md

# Unified Event Taxonomy for Kush Ecosystem

**Date:** 2026-02-21
**Scope:** CIV simulation events + Venture autonomy events + cross-track event flows
**Status:** ACTIVE
**Owner:** Kush Ecosystem Integration Team

---

## Executive Summary

This document defines the unified event taxonomy covering both CIV (city simulation) and Venture (autonomous agent platform) systems. It establishes:

1. **CIV Event Catalog**: Simulation lifecycle, policy evaluation, economy, energy, institutions, and citizen metrics
2. **Venture Event Catalog**: Workflow orchestration, artifact compilation, treasury authorization, compliance operations
3. **Cross-Track Event Flows**: How CIV events are relayed through Venture event bus, and how Venture events trigger CIV state updates

All events conform to `EventEnvelopeV1` schema defined in `API_EVENTS_SPEC.md` and `TRACK_C_CONTROL_PLANE.md`.

---

## Event Envelope Contract (Foundation)

All events in both CIV and Venture adhere to this envelope:

```json
{
  "event_id": "string (UUID)",
  "event_type": "string (namespace.resource.action.version)",
  "workflow_id": "string (UUID, links to parent workflow)",
  "task_id": "string (UUID, links to parent task)",
  "trace_id": "string (UUID, end-to-end request tracing)",
  "policy_bundle_id": "string (version, event evaluated under this policy)",
  "payload": "object (event-specific data)",
  "created_at": "timestamp (ISO 8601)",
  "source_system": "string (civ | venture)",
  "replay_token": "string (idempotency key for deterministic replay)"
}
```

---

## Part 1: CIV Event Catalog

Events emitted from the CIV simulation system.

### 1.1 Simulation Lifecycle Events (run.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Run Started | `civ.run.started.v1` | `{run_id, simulation_seed, tick_count_target, config_snapshot, policy_bundle_id}` | Simulation engine | Marks simulation initialization | v1 |
| Run Completed | `civ.run.completed.v1` | `{run_id, tick_count_executed, final_state_hash, event_count, duration_ms}` | Simulation engine | Marks simulation completion | v1 |
| Run Failed | `civ.run.failed.v1` | `{run_id, error_code, error_message, tick_id_when_failed, state_snapshot}` | Simulation engine | Records fatal errors during simulation | v1 |
| Tick Started | `civ.tick.started.v1` | `{run_id, tick_id, tick_sequence, phase_order}` | Core simulation loop | Marks tick initialization | v1 |
| Tick Completed | `civ.tick.completed.v1` | `{run_id, tick_id, state_hash_after, sub_events_count, duration_ms, phase_hashes}` | Core simulation loop | Marks tick completion with state verification | v1 |

**Payload Schema Details:**
- `run_id`: Unique identifier for a simulation run (immutable after creation)
- `simulation_seed`: RNG seed for reproducibility; pinned in replay
- `tick_count_target`: Expected number of ticks (from policy config)
- `final_state_hash`: SHA256(compressed_state); used for determinism verification
- `phase_order`: Array of phase names in deterministic order (e.g., `["demographics", "policy", "economy", "spatial"]`)

---

### 1.2 Policy Evaluation Events (policy.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Policy Evaluated | `civ.policy.evaluated.v1` | `{tick_id, policy_type, policy_bundle_id, control_decision, affected_entity_count, evaluation_duration_ms}` | Policy engine (CIV-0100) | Records policy evaluation and control decision | v1 |
| Policy Applied | `civ.policy.applied.v1` | `{tick_id, policy_type, control_decision, entities_affected, ledger_updates_count, state_delta}` | Policy engine | Records actual application of policy control | v1 |
| Constraint Violation Detected | `civ.policy.constraint_violation.v1` | `{tick_id, constraint_name, entity_id, actual_value, max_value, severity_level}` | Policy engine / Verifier | Records when a constraint (CIV-0104) is violated | v1 |

**Payload Schema Details:**
- `policy_type`: One of `fiscal`, `labor_market`, `environmental`, `institutional`
- `control_decision`: The control action selected (e.g., `"subsidize_sector_X"`, `"raise_tax_rate"`)
- `evaluation_duration_ms`: Cost of running `policy.evaluate()` function (for Venture tool budgeting)
- `severity_level`: `critical` | `warning` | `info`

---

### 1.3 Economy Events (economy.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Market Cleared | `civ.economy.market_cleared.v1` | `{tick_id, market_type, supply_qty, demand_qty, equilibrium_price, clearing_efficiency}` | Market clearing engine | Records supply-demand equilibrium | v1 |
| Transfer Booked | `civ.economy.transfer_booked.v1` | `{tick_id, sender_id, receiver_id, amount, transfer_reason, ledger_account_pair}` | Double-entry ledger engine | Records debit/credit transaction | v1 |
| Account Balance Updated | `civ.economy.balance_updated.v1` | `{tick_id, account_id, balance_before, balance_after, delta_reason}` | Double-entry ledger engine | Records account balance change | v1 |
| Supply Stress | `civ.economy.supply_stress.v1` | `{tick_id, market_type, supply_shortfall, stress_multiplier, price_impact}` | Supply-demand engine (CIV-0102) | Records when supply < demand | v1 |
| Market Price Changed | `civ.economy.price_changed.v1` | `{tick_id, market_type, price_before, price_after, price_change_pct, reason}` | Market clearing engine | Records price discovery and changes | v1 |

**Payload Schema Details:**
- `market_type`: One of `labor`, `goods`, `capital`, `energy`
- `clearing_efficiency`: Float [0, 1]; 1.0 = perfect clearing, 0.5 = significant excess
- `ledger_account_pair`: `{debit_account: string, credit_account: string}` for accounting reconciliation
- `supply_shortfall`: Quantity units; used by Venture for quota model validation

---

### 1.4 Energy Accounting Events (energy.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Energy Consumed | `civ.energy.consumed.v1` | `{tick_id, consumer_entity_id, energy_qty, source_type, consumption_reason}` | Energy ledger (CIV-0102) | Records energy consumption | v1 |
| Energy Generated | `civ.energy.generated.v1` | `{tick_id, producer_entity_id, energy_qty, source_type, capacity_utilization_pct}` | Energy ledger | Records energy production | v1 |
| Energy Stored | `civ.energy.stored.v1` | `{tick_id, storage_entity_id, energy_qty_added, storage_capacity_before, storage_capacity_after}` | Energy ledger | Records energy reserve changes | v1 |
| Supply-Demand Balance | `civ.energy.balance.v1` | `{tick_id, supply_total, demand_total, reserves_delta, conservation_check_passed}` | Energy ledger | Records energy conservation equation results | v1 |
| Renewable Variability | `civ.energy.renewable_variability.v1` | `{tick_id, renewable_source_id, expected_output, actual_output, variance_pct}` | Energy ledger | Records renewable source variability | v1 |

**Payload Schema Details:**
- `energy_qty`: Joules (CIV-0107 unit system)
- `source_type`: One of `renewable`, `fossil`, `nuclear`, `storage`
- `conservation_check_passed`: Boolean; failure indicates determinism bug
- `variance_pct`: Percentage deviation from expected; used for peak-shaving policy triggers

---

### 1.5 Citizen Lifecycle Events (citizen.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Citizen Born | `civ.citizen.born.v1` | `{tick_id, citizen_id, parent_ids, birth_location, genetic_traits}` | Demographic engine (CIV-0103) | Records citizen birth | v1 |
| Citizen Education Updated | `civ.citizen.education_updated.v1` | `{tick_id, citizen_id, education_level_before, education_level_after, institution_id}` | Education subsystem | Records education progression | v1 |
| Citizen Career Changed | `civ.citizen.career_changed.v1` | `{tick_id, citizen_id, old_career, new_career, employer_id, salary_before, salary_after}` | Labor market engine | Records career transition | v1 |
| Citizen Retired | `civ.citizen.retired.v1` | `{tick_id, citizen_id, retirement_age, career_length_years, final_wealth}` | Labor market engine | Records retirement | v1 |
| Citizen Died | `civ.citizen.died.v1` | `{tick_id, citizen_id, death_age, death_location, estate_distributed_to}` | Demographic engine | Records death | v1 |
| Citizen Metrics Updated | `civ.citizen.metrics_updated.v1` | `{tick_id, citizen_id, age, wealth, education_level, satisfaction_score, institution_affiliation}` | Metrics engine (CIV-0103) | Time-series snapshot of citizen state | v1 |

**Payload Schema Details:**
- `education_level`: Integer [0, 5]; maps to institution types (primary, secondary, tertiary, etc.)
- `satisfaction_score`: Float [-1, 1]; used by Venture for user activity signaling
- `genetic_traits`: Array of traits; affects career path probabilities
- `estate_distributed_to`: Array of `{heir_id, amount_joules}`

---

### 1.6 Institution Lifecycle Events (institution.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Institution Created | `civ.institution.created.v1` | `{tick_id, institution_id, institution_type, founder_id, location, initial_population}` | Institutional engine (CIV-0103, CIV-0105) | Records institution formation | v1 |
| Institution State Changed | `civ.institution.state_changed.v1` | `{tick_id, institution_id, state_before, state_after, reason, affected_citizens_count}` | Institutional state machine | Records state transition (pending → active → dormant → dissolved) | v1 |
| Institution Merged | `civ.institution.merged.v1` | `{tick_id, merging_institution_ids, resulting_institution_id, population_transferred}` | Institutional engine | Records institution merger | v1 |
| Institution Split | `civ.institution.split.v1` | `{tick_id, source_institution_id, new_institution_ids, population_distributed}` | Institutional engine | Records institution fission | v1 |
| Institution Dissolved | `civ.institution.dissolved.v1` | `{tick_id, institution_id, citizen_relocations, asset_liquidations}` | Institutional engine | Records institution dissolution | v1 |
| Institution Metrics Updated | `civ.institution.metrics_updated.v1` | `{tick_id, institution_id, population, wealth, assets, influence_score}` | Metrics engine | Time-series snapshot of institution state | v1 |

**Payload Schema Details:**
- `institution_type`: One of `kingdom`, `city_state`, `alliance`, `corporation`, `religious_order`, `militia`
- `state_before/after`: One of `pending`, `active`, `dormant`, `dissolved`
- `reason`: String describing cause of state change (e.g., "diplomatic_treaty_expired", "bankruptcy", "armed_conquest")
- `influence_score`: Float [0, 1]; used in policy evaluation and war/diplomacy subsystems

---

### 1.7 War, Diplomacy & Conflict Events (conflict.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| War Declared | `civ.conflict.war_declared.v1` | `{tick_id, aggressor_institution_id, defender_institution_id, reason, military_strength_ratio}` | Diplomacy engine (CIV-0105) | Records declaration of war | v1 |
| Diplomatic Treaty Signed | `civ.conflict.treaty_signed.v1` | `{tick_id, party_1_id, party_2_id, treaty_type, terms, duration_ticks}` | Diplomacy engine | Records treaty formation | v1 |
| Territorial Control Changed | `civ.conflict.territorial_control_changed.v1` | `{tick_id, location_id, previous_controller_id, new_controller_id, population_affected}` | Conflict resolution engine | Records territory conquest/cession | v1 |
| Shadow Network Activated | `civ.conflict.shadow_network_activated.v1` | `{tick_id, network_id, network_type, target_institution_id, influence_direction}` | Shadow subsystem (CIV-0105) | Records covert influence operation | v1 |

**Payload Schema Details:**
- `treaty_type`: One of `military_alliance`, `trade_agreement`, `non_aggression_pact`, `vassalage`
- `military_strength_ratio`: Float; attacker_strength / defender_strength
- `network_type`: One of `spy_ring`, `merchant_guild`, `religious_sect`, `secret_society`
- `influence_direction`: One of `support`, `subvert`, `destabilize`

---

### 1.8 Social & Health Events (social.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Health Crisis Detected | `civ.social.health_crisis.v1` | `{tick_id, location_id, disease_type, infection_rate, mortality_rate, affected_population}` | Health subsystem (CIV-0106) | Records epidemic or plague | v1 |
| Social Unrest Escalated | `civ.social.unrest_escalated.v1` | `{tick_id, location_id, unrest_level, causes, insurgent_count}` | Insurgency subsystem (CIV-0106) | Records uprising or revolt | v1 |
| Ideology Shift | `civ.social.ideology_shift.v1` | `{tick_id, institution_id, ideology_before, ideology_after, driver}` | Ideology engine (CIV-0106) | Records ideological change | v1 |
| Cultural Event | `civ.social.cultural_event.v1` | `{tick_id, event_type, location_id, impact_on_satisfaction, influenced_population}` | Cultural subsystem | Records cultural occurrence (e.g., festival, artistic movement) | v1 |

**Payload Schema Details:**
- `unrest_level`: Integer [0, 100]; > 70 triggers insurgency events
- `ideology_before/after`: One of `monarchy`, `theocracy`, `democracy`, `autocracy`, `meritocracy`
- `driver`: String explaining cause of shift (e.g., "military_victory", "enlightenment_era", "famine")
- `event_type`: One of `festival`, `artistic_movement`, `scientific_breakthrough`, `religious_schism`

---

## Part 2: Venture Event Catalog

Events emitted from the Venture autonomy platform.

### 2.1 Workflow Orchestration Events (workflow.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Workflow Started | `venture.workflow.started.v1` | `{workflow_id, agent_role, workspace_id, initial_task_count, policy_bundle_id}` | Workflow orchestrator (TRACK-C) | Marks workflow initialization | v1 |
| Workflow Completed | `venture.workflow.completed.v1` | `{workflow_id, status, task_count_executed, event_count, duration_ms}` | Workflow orchestrator | Marks workflow completion | v1 |
| Workflow Failed | `venture.workflow.failed.v1` | `{workflow_id, error_code, error_message, task_id_when_failed}` | Workflow orchestrator | Records fatal workflow error | v1 |
| Task Scheduled | `venture.task.scheduled.v1` | `{task_id, workflow_id, task_type, estimated_eau_cost}` | Scheduler | Marks task scheduling | v1 |
| Task Started | `venture.task.started.v1` | `{task_id, workflow_id, agent_role, tool_calls_expected}` | Task executor | Marks task execution start | v1 |
| Task Completed | `venture.task.completed.v1` | `{task_id, workflow_id, status, tool_calls_count, actual_eau_cost, duration_ms}` | Task executor | Records task completion and cost | v1 |
| Task Failed | `venture.task.failed.v1` | `{task_id, workflow_id, error_code, error_message, partial_results}` | Task executor | Records task failure | v1 |

**Payload Schema Details:**
- `agent_role`: One of `analyst`, `architect`, `engineer`, `auditor`, `orchestrator`
- `workspace_id`: Links to workspace isolation boundary
- `eau_cost`: Ecosystem Allocation Unit (EAU) consumed by task
- `task_type`: Corresponds to tool categories (code, artifact, policy, compliance, etc.)

---

### 2.2 Artifact Compilation Events (artifact.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Artifact IR Created | `venture.artifact.ir_created.v1` | `{artifact_ir_id, ir_type, schema_version, content_hash, payload_size_bytes}` | Artifact compiler (TRACK-A) | Marks artifact IR creation | v1 |
| Artifact Build Started | `venture.artifact.build_started.v1` | `{artifact_ir_id, build_id, toolchain_version, target_surface, estimated_cost_eau}` | Build engine | Marks build initialization | v1 |
| Artifact Build Completed | `venture.artifact.build_completed.v1` | `{build_id, artifact_ir_id, status, output_hash, actual_cost_eau, duration_ms}` | Build engine | Records build completion | v1 |
| Artifact Build Failed | `venture.artifact.build_failed.v1` | `{build_id, artifact_ir_id, error_code, error_message, partial_output}` | Build engine | Records build failure | v1 |
| Artifact Provenance Attested | `venture.artifact.provenance_attested.v1` | `{artifact_id, build_id, provider, model_version, signature, timestamp}` | Provenance engine | Records signed provenance evidence | v1 |
| Artifact Cache Hit | `venture.artifact.cache_hit.v1` | `{artifact_ir_id, idempotency_key, cached_artifact_id, cache_age_ms}` | Build engine | Records deterministic cache hit | v1 |

**Payload Schema Details:**
- `ir_type`: One of `SlideSpec`, `DocSpec`, `TimelineSpec`, `AudioSpec`, `BoardSpec`, `CivSimulationArtifact`
- `target_surface`: One of `web`, `mobile`, `vr`, `print`, `cinema`
- `provider`: One of `openai`, `anthropic`, `veo`, `nanobanana`, `internal`
- `model_version`: Semantic version of provider model/toolchain
- `signature`: Ed25519 signature over `{artifact_id, provider, model_version, timestamp}`

---

### 2.3 Money & Treasury Events (money.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Money Intent Created | `venture.money.intent_created.v1` | `{intent_id, workflow_id, scope_type, scope_id, cap_amount, window, ttl_ms}` | Money control (TRACK-B) | Records spend authorization request | v1 |
| Money Authorization Decided | `venture.money.authorization_decided.v1` | `{intent_id, workflow_id, decision, reason_code, policy_bundle_id}` | Authorization engine | Records spend approval/rejection | v1 |
| Ledger Entry Created | `venture.ledger.entry_created.v1` | `{entry_id, debit_account, credit_account, amount, reference_id, policy_bundle_id}` | Ledger engine (TRACK-B) | Records double-entry transaction | v1 |
| Budget Allocation Approved | `venture.budget.allocation_approved.v1` | `{workspace_id, allocation_amount, window, policy_bundle_id}` | Budget engine | Records workspace budget approval | v1 |
| Budget Exceeded | `venture.budget.exceeded.v1` | `{workspace_id, budget_limit, actual_spend, overage_amount}` | Budget engine | Records budget violation | v1 |
| Reconciliation Run | `venture.reconciliation.run.v1` | `{run_id, period, drift_amount, drift_pct, status, timestamp}` | Reconciliation engine | Records daily/weekly reconciliation | v1 |

**Payload Schema Details:**
- `scope_type`: One of `workflow`, `task`, `agent_action`, `workspace`, `global`
- `reason_code`: One of `approved`, `rejected_budget`, `rejected_policy`, `revoked`, `expired`
- `debit_account` / `credit_account`: Account IDs from chart of accounts (see DATA_MODEL_DB_SPEC)
- `drift_pct`: Reconciliation discrepancy as percentage of total ledger balance

---

### 2.4 Compliance & Audit Events (compliance.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Compliance Case Opened | `venture.compliance.case_opened.v1` | `{case_id, case_type, severity_level, evidence_chain_start}` | Compliance machine (OPS) | Records new compliance investigation | v1 |
| Compliance Case Evidence Added | `venture.compliance.case_evidence_added.v1` | `{case_id, evidence_id, event_id_reference, evidence_type, timestamp}` | Audit trail engine | Appends evidence to case | v1 |
| Compliance Case Closed | `venture.compliance.case_closed.v1` | `{case_id, closure_reason, evidence_count, finding}` | Compliance machine | Records case resolution | v1 |
| Compliance Violation Detected | `venture.compliance.violation_detected.v1` | `{violation_id, violation_type, severity_level, affected_workflow_id, remediation_action}` | Policy verifier | Records policy/regulatory breach | v1 |
| Audit Log Entry | `venture.audit.log_entry.v1` | `{log_id, action_type, actor_id, resource_id, change_summary, timestamp}` | Audit engine | Records user/system action for audit | v1 |
| Policy Bundle Drift Detected | `venture.compliance.policy_drift.v1` | `{drift_id, expected_bundle_id, actual_bundle_id, diff_summary}` | Policy drift detector | Records unintended policy change | v1 |

**Payload Schema Details:**
- `case_type`: One of `policy_violation`, `treasury_drift`, `tool_misuse`, `compliance_breach`, `incident_investigation`
- `severity_level`: One of `critical`, `high`, `medium`, `low`
- `evidence_type`: One of `event_log`, `state_snapshot`, `signature`, `attestation`, `audit_trail`
- `remediation_action`: One of `suspend_workflow`, `revoke_authorization`, `escalate_to_human`, `auto_remediate`

---

### 2.5 Policy & Governance Events (policy.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Policy Bundle Published | `venture.policy.bundle_published.v1` | `{bundle_id, version, schema_snapshot, published_at, effective_at}` | Policy engine (TRACK-C) | Records new policy bundle | v1 |
| Policy Evaluation Started | `venture.policy.evaluation_started.v1` | `{evaluation_id, bundle_id, context_snapshot, decision_pending}` | Policy evaluator | Marks policy evaluation start | v1 |
| Policy Decision Made | `venture.policy.decision_made.v1` | `{decision_id, bundle_id, decision_result, supporting_facts}` | Policy evaluator | Records policy decision | v1 |
| Policy Rollback Initiated | `venture.policy.rollback_initiated.v1` | `{rollback_id, bundle_id_being_revoked, new_bundle_id, affected_workflows}` | Policy admin | Records policy revocation and recovery | v1 |

**Payload Schema Details:**
- `schema_snapshot`: Compressed JSON schema of entire policy bundle
- `decision_result`: The control decision output (e.g., `"allow"`, `"reject_with_escalation"`, `"require_approval"`)
- `supporting_facts`: Array of facts from context that drove decision

---

### 2.6 User & Multi-Tenancy Events (user.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| User Onboarded | `venture.user.onboarded.v1` | `{user_id, role, workspace_id, capability_tier, initial_budget_eau}` | User management | Records new user creation | v1 |
| User Capability Changed | `venture.user.capability_changed.v1` | `{user_id, old_capability_tier, new_capability_tier, reason}` | Access control | Records permission/capability change | v1 |
| User Activity Signal | `venture.user.activity_signal.v1` | `{user_id, signal_type, metric_value, observation_window}` | Metrics engine | Records user behavior metrics | v1 |
| User Offboarded | `venture.user.offboarded.v1` | `{user_id, offboarding_reason, residual_budget_disposal}` | User management | Records user deactivation | v1 |

**Payload Schema Details:**
- `capability_tier`: One of `tier_0_admin`, `tier_1_advanced`, `tier_2_standard`, `tier_3_limited`
- `signal_type`: One of `task_completion_rate`, `tool_usage_distribution`, `budget_utilization`, `compliance_rate`
- `metric_value`: Float; context-dependent range
- `observation_window`: Time window over which signal was computed (e.g., "last_7_days")

---

### 2.7 Privacy & Data Protection Events (privacy.*)

| Event Name | Fully Qualified | Payload Schema | Emitted By | Purpose | Version |
|---|---|---|---|---|---|
| Privacy Request Received | `venture.privacy.request_received.v1` | `{request_id, request_type, subject_user_id, received_at}` | Privacy manager | Records data request (GDPR/CCPA) | v1 |
| Privacy Request Processed | `venture.privacy.request_processed.v1` | `{request_id, status, data_collected_bytes, completion_timestamp}` | Privacy engine | Records request fulfillment | v1 |
| Data Retention Policy Applied | `venture.privacy.retention_policy_applied.v1` | `{policy_id, affected_record_count, data_deleted_bytes, policy_version}` | Data retention engine | Records automatic data cleanup | v1 |
| PII Detected in Artifact | `venture.privacy.pii_detected.v1` | `{artifact_id, pii_type, detection_confidence, remediation_action}` | PII detector | Records sensitive data discovery | v1 |

**Payload Schema Details:**
- `request_type`: One of `right_to_access`, `right_to_deletion`, `right_to_portability`, `right_to_correction`
- `pii_type`: One of `email`, `phone`, `ssn`, `credit_card`, `api_key`, `password_hash`, `location`
- `detection_confidence`: Float [0, 1]; confidence that detected data is actually PII

---

## Part 3: Cross-Track Event Flows

Events flowing between CIV and Venture systems.

### 3.1 CIV → Venture Relay Pattern

CIV events are captured and relayed into Venture event bus for audit and compliance purposes:

```
CIV Event Emitted
  ↓
Event Relay Layer (in TRACK-C_CONTROL_PLANE)
  ├─ Translate event type: civ.* → venture.civ.* (namespace isolation)
  ├─ Wrap in EventEnvelopeV1 (add workflow_id, trace_id, policy_bundle_id)
  ├─ Compute event_id (UUID for Venture tracking)
  └─ Emit to Venture event bus
  ↓
Venture Event Bus
  ├─ Store in event log
  ├─ Trigger subscribed handlers (compliance, metrics, etc.)
  └─ Make available for replay and audit
```

**Key Mapping Rules:**
1. **Namespace**: CIV events prefixed with `civ.` to distinguish from native Venture events
2. **Workflow Context**: CIV simulation run → Venture workflow_id (1:1 mapping)
3. **Tick to Task**: Each CIV tick → Venture task in orchestration DAG
4. **Policy Bundle Pinning**: CIV event's policy_bundle_id must match Venture's policy_bundle_id for that workflow
5. **Idempotency**: CIV event_id + source_system + timestamp = replay_token for deduplication

### 3.2 Specific Cross-Track Event Flows

#### Flow A: CIV Economy → Venture Ledger

```
civ.economy.transfer_booked.v1 (sender, receiver, amount, reason)
  ↓ (Relay)
venture.civ.economy.transfer_booked.v1 (wrapped)
  ↓ (Subscription)
Venture Ledger Engine
  ├─ Extract sender/receiver/amount
  ├─ Determine debit_account (sender's account) and credit_account (receiver's account)
  ├─ Emit venture.ledger.entry_created.v1 with (debit_account, credit_account, amount, reference_id=civ_event_id)
  └─ Update account balances; validate conservation law
```

**Validation Rules:**
- Both debit and credit amounts must be positive and equal
- Sum of all ledger entries must equal zero (conservation)
- Accounts must exist and be active
- Policy bundle version must match CIV's policy bundle

#### Flow B: CIV Policy Evaluation → Venture Audit Trail

```
civ.policy.evaluated.v1 (policy_type, control_decision, evaluation_duration_ms)
  ↓ (Relay)
venture.civ.policy.evaluated.v1 (wrapped)
  ↓ (Subscription)
Venture Compliance Machine
  ├─ Open or append to compliance case (case_type="entity_policy_evaluation")
  ├─ Add evidence (event_id_reference, evidence_type="policy_evaluation_record")
  ├─ Check if control_decision matches policy bundle expectations
  └─ If unexpected: emit compliance.violation_detected.v1 (severity_level="warning")
```

#### Flow C: CIV Citizen Lifecycle → Venture User Signals

```
civ.citizen.born.v1 / civ.citizen.retired.v1 / civ.citizen.died.v1 (citizen_id, ...)
  ↓ (Relay)
venture.civ.citizen.[event_name].v1 (wrapped)
  ↓ (Subscription)
Venture Metrics Engine
  ├─ Create user.activity_signal.v1 for onboarding/offboarding if applicable
  ├─ If citizen_id maps to managed user_id in Venture:
  │   └─ Update user capability tier based on life stage
  └─ Otherwise: log as observational metric (do not auto-create users)
```

**Mapping Details:**
- CIV citizen birth → Venture user onboarding signal (if opt-in)
- CIV citizen career change → Venture capability tier escalation
- CIV citizen death → Venture user offboarding signal (if opt-in)

#### Flow D: CIV Institution Changes → Venture Compliance Cases

```
civ.institution.created.v1 / civ.institution.dissolved.v1 / civ.institution.state_changed.v1
  ↓ (Relay)
venture.civ.institution.[event_name].v1 (wrapped)
  ↓ (Subscription)
Venture Compliance Machine
  ├─ Open compliance case: case_type="institutional_change"
  ├─ Add evidence chain:
  │   ├─ Event 1: institution.created.v1 (case opened)
  │   ├─ Event 2-N: state_changed.v1, merged.v1, split.v1 (evidence accumulation)
  │   └─ Event N+1: institution.dissolved.v1 (case closed)
  └─ Case queryable for audit and policy review
```

#### Flow E: CIV Energy Accounting → Venture Budget Consumption

```
civ.energy.consumed.v1 (consumer_entity_id, energy_qty, source_type)
  ↓ (Relay)
venture.civ.energy.consumed.v1 (wrapped)
  ↓ (Subscription)
Venture Budget Engine
  ├─ Map energy_qty → eau_cost_estimate using conversion function (see ENERGY_TO_BUDGET_CONTRACT)
  ├─ Deduct from workspace quota
  ├─ If quota exceeded:
  │   ├─ Emit budget.exceeded.v1
  │   └─ Trigger remediation (reduce consumption, escalate to policy review, etc.)
  └─ Log consumption signal for future capacity planning
```

**Conversion Function**:
- Base: 1 Joule (CIV-0107 unit) ≈ 0.001 EAU (empirically calibrated)
- Multiplier by source_type: renewable=1.0x, fossil=1.5x, nuclear=0.8x, storage_discharge=2.0x
- Final: `eau_cost = energy_qty * 0.001 * source_type_multiplier`

### 3.3 Venture → CIV Influence (Optional/Future)

Venture compliance decisions can influence CIV simulation policy:

```
venture.compliance.violation_detected.v1 (violation_type="tool_misuse")
  ↓ (Optional Feedback Loop)
CIV Policy Engine
  ├─ Reduce policy evaluation budget for next N ticks
  ├─ Adjust policy_bundle to be more conservative
  └─ Emit civ.policy.adjusted.v1 for audit
```

**Note**: This is optional and future; current design emphasizes CIV → Venture telemetry, not closed-loop control.

---

## Part 4: Event Ordering & Determinism Guarantees

### Event Ordering Within a CIV Tick

All CIV events within a single tick follow deterministic phase order:

```
Tick T:
  1. civ.tick.started.v1
  2. civ.policy.evaluated.v1 (demographic policies)
  3. civ.citizen.[born|retired|died].v1 (demographic changes)
  4. civ.policy.evaluated.v1 (economic policies)
  5. civ.economy.market_cleared.v1
  6. civ.economy.transfer_booked.v1 (multiple)
  7. civ.energy.consumed.v1 / civ.energy.generated.v1 (multiple)
  8. civ.energy.balance.v1 (conservation check)
  9. civ.policy.evaluated.v1 (spatial policies)
  10. civ.citizen.metrics_updated.v1
  11. civ.institution.metrics_updated.v1
  12. civ.tick.completed.v1
```

**Determinism Guarantee**: Given identical `tick_id`, `simulation_seed`, and `policy_bundle_id`, events 1-12 must be emitted in identical order with identical payloads.

### Event Ordering Within a Venture Workflow

Venture events are ordered by task execution order (DAG semantics):

```
Workflow W (CIV integration example):
  1. venture.workflow.started.v1
  2. venture.task.scheduled.v1 (task_type="civ_simulation")
  3. venture.task.started.v1
  4. venture.civ.tick.started.v1 (relayed from CIV)
  5. venture.civ.economy.transfer_booked.v1 (relayed)
  6. venture.ledger.entry_created.v1 (Venture-side transaction)
  7. venture.civ.tick.completed.v1 (relayed)
  8. venture.task.completed.v1
  9. venture.workflow.completed.v1
```

**Concurrency**: Tasks can execute in parallel; events from different tasks may interleave. However, events from the same task follow strict ordering.

---

## Part 5: Schema Registry & Versioning

### Event Schema Versioning

All event types follow semantic versioning:

- **Major version** (e.g., `v1` → `v2`): Breaking schema changes (required field added/removed/type changed)
- **Minor version** (e.g., `v1.1`): Backwards-compatible addition (new optional field)
- **Patch version** (e.g., `v1.0.1`): Documentation/comment updates; no schema changes

**Deprecation Policy**:
- When deprecating an event type, mark as deprecated in schema registry
- Support deprecated types for 2 policy bundle versions (N and N+1)
- After 2 versions, reject deprecated types with error message

### Payload Schema Storage

All event payload schemas are stored in `venture/SCHEMA_PACK.md` and registered in Venture's schema registry with:

```json
{
  "event_type": "civ.economy.transfer_booked.v1",
  "schema_version": 1,
  "json_schema": { /* full JSON schema */ },
  "registered_at": "2026-02-21T00:00:00Z",
  "deprecated": false,
  "references": ["CIV-0100", "TRACK_B_TREASURY_COMPLIANCE_SPEC"]
}
```

---

## Summary

| Dimension | Count | Coverage |
|-----------|-------|----------|
| CIV Event Types | 32 | Run lifecycle, policy, economy, energy, citizens, institutions, conflict, social |
| Venture Event Types | 26 | Workflows, artifacts, money, compliance, policy, users, privacy |
| **Total Event Types** | **58** | All mapped to EventEnvelopeV1 schema |
| Cross-Track Flows | 5 major patterns | CIV→Venture relay, ledger sync, audit trail, user signals, budget consumption |
| Determinism Guarantees | 100% | Both systems support full deterministic replay from event log |

All events are audit-ready, replay-safe, and traceable through both CIV and Venture systems.

---

**Document Control**

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-02-21 | Kush Integration Team | Initial version; 58 event types documented, 5 cross-track flows defined |



---

## Source: traceability/VENTURE_TRACEABILITY_MATRIX.md

# Venture Traceability Matrix

**date:** 2026-02-21
**status:** ACTIVE

Maps each Venture spec to its domain, key requirements, implementation phase, cross-track dependencies, and open questions.

---

## Overview

This matrix provides a consolidated view of:
1. **What each spec covers** (domain, key concepts)
2. **Where it fits in the implementation roadmap** (phase, dependencies)
3. **How it integrates with CIV** (integration points, cross-track links)
4. **What's open** (open questions, validation gaps)

Update this matrix whenever:
- A spec is created or updated
- A spec moves to a new implementation phase
- A CIV integration point is discovered
- An open question is resolved

---

## Master Traceability Table

| Spec File | Domain | Key Requirements | Dependencies | Impl. Phase | Cross-Track Links | Open Questions |
|-----------|--------|------------------|--------------|-------------|-------------------|-----------------|
| **TECHNICAL_SPEC.md** | Architecture & Runtime | Control plane components (orchestrator, agent runtime, tool engine, money API, schema registry, compliance evaluator); workload identity; tool allowlists; external-content isolation | (none) | Foundation (Pre-Phase-1) | — | How to handle dynamic tool discovery? Versioning strategy for control plane APIs? |
| **ARTIFACT_COMPILER_SPEC.md** | Artifact Compilation | IR schema family (SlideSpec, DocSpec, TimelineSpec, AudioSpec, BoardSpec); build pipeline (spec→render→validate→export); provenance metadata | TECHNICAL_SPEC | Phase 2 (DocSpec, SlideSpec) → Phase 3 (TimelineSpec) → Phase 4 (Audio, Board) | *Integration Point 1*: CIV simulation outputs → artifacts (time-series, policy docs, org charts) | How many artifact variants per type? Font/style versioning strategy? Caching for incremental builds? |
| **TRACK_A_ARTIFACT_DETERMINISM_SPEC.md** | Artifact Determinism | Deterministic build/replay contracts; schema freezing; provenance tracking; hash-based versioning | TECHNICAL_SPEC, ARTIFACT_COMPILER_SPEC | Phase 1 (validation framework) → Phase 2 (implementation in artifact compiler) | *Integration Point 5*: Minimal constraint set theorem (CIV-0104) provides foundation for determinism | How to version IR schemas without breaking determinism? Audit trail for schema freeze decisions? |
| **TRACK_B_TREASURY_COMPLIANCE_SPEC.md** | Treasury & Ledger | Double-entry accounting; spend policies (budgets, per-category, velocity); event ledger (idempotent, reconciliation); compliance validation | TECHNICAL_SPEC | Phase 1 (schema definition) → Phase 2 (ledger implementation) | *Integration Point 1*: CIV-0100 joule model (double-entry, conservation invariant, market clearing) | Joule-to-USD conversion rates and update frequency? Merchant/category taxonomy finalized? Velocity control algorithms (e.g., exponential backoff)? |
| **TRACK_C_CONTROL_PLANE.md** | Control Plane Orchestration | FSM (workflow→task→agent action); event bus + schema validation; tool allowlists; isolation boundaries (workspaces); rollout stages; incident doctrine | TECHNICAL_SPEC, TRACK_A, TRACK_B | Phase 0 (design & scaffolding) → Phase 1 (FSM + event bus) → Phase 2 (policy enforcement) | *Integration Point 2*: CIV-0001/0100 simulation state & tick-based transitions mirror Venture's workflow DAG | FSM state explosion potential? How to test policy rollout stages in sandbox? Incident playbook automation? |
| **API_EVENTS_SPEC.md** | Event Contracts | Event schema contracts (event_id, event_type, trace_id, workflow_id, payload); FSM transitions; strict validation; event envelope | TECHNICAL_SPEC, TRACK_C | Phase 1 (schema definition) → Phase 2 (validation implementation) | *Integration Point 2*: Event shapes align with CIV's economy.transfer.v1, policy.applied.v1 events | Event ordering guarantees under concurrent workflows? Dead letter queue strategy? Event retention policy (audit archive)? |
| **DATA_MODEL_DB_SPEC.md** | Data & Schema | Artifact IR tables; ledger tables; workflow tables; audit log schema; task envelope; event envelope | TECHNICAL_SPEC, TRACK_A, TRACK_B, API_EVENTS_SPEC | Phase 1 (schema freeze) → Phase 2 (implementation) | *Integration Point 1*: Ledger schema aligned with CIV-0100 transfers *Integration Point 5*: Audit log mirrors CIV determinism model | Partition strategy for multi-year audit logs? Encryption for sensitive data (API keys, customer PII)? Backup/recovery SLO? |
| **OPS_COMPLIANCE_SPEC.md** | Operations & Compliance | Compliance machine (policy packs); audit toolchain (tamper-evidence, checksums); observability (metrics, alerts); incident escalation; freeze/kill-switch | TECHNICAL_SPEC, TRACK_B, TRACK_C | Phase 2 (compliance machine) → Phase 3 (observability) → Phase 4 (incident automation) | *Integration Point 3*: CIV-0103 institutional change tracking informs Venture audit trail structure *Integration Point 2*: Venture's policy evaluator mirrors CIV's policy.applied.v1 events | Policy pack versioning and rollback? Alert fatigue mitigation? Compliance evidence retention schedule? |
| **USER_SPEC.md** | User Management | User roles (Founder, Operations, Finance, Compliance); capabilities matrix; onboarding workflows; multi-tenant isolation | TECHNICAL_SPEC | Phase 1 (role definition) → Phase 2 (isolation implementation) | *Integration Point 3*: CIV-0103 citizen lifecycle metadata informs user journey design | Role evolution as product scales? Service account lifecycle? User activation/deactivation event chain? |
| **ROLE_TOOL_ALLOWLIST_MATRIX.md** | Role-Based Access Control | Per-role tool allowlists (orchestrator, researcher, solver, auditor roles); capability model; update mechanism | TECHNICAL_SPEC, USER_SPEC, TRACK_C | Phase 1 (matrix definition) → Phase 2 (enforcement in control plane) | — | How to handle tool allowlist updates without disrupting active workflows? Temporary capability escalation (break-glass)? |
| **SCHEMA_PACK.md** | Consolidated Schemas | Complete schema family (Task Envelope, Event Envelope, Artifact IR variants, Ledger Entry, Policy Bundle); versioning strategy | TRACK_A, TRACK_B, TRACK_C, API_EVENTS_SPEC, DATA_MODEL_DB_SPEC | Phase 0 (consolidation) → Phase 1 (frozen v1.0) | — | JSON Schema vs. Protobuf vs. custom serialization? Schema registry API shape? Backward-compatibility guarantees? |
| **PRODUCT_MODEL.md** | Product Vision & Roadmap | Vision (no-HITL autonomous platform); primary users; jobs to be done; product surfaces; success metrics | TECHNICAL_SPEC, USER_SPEC | Foundation → Phase 1-4 (phased rollout) | — | Monetization strategy (per-artifact, per-hour, per-agent)? Enterprise multi-tenant pricing? Usage telemetry consent model? |
| **IMPLEMENTATION_ROADMAP.md** | Phased Rollout Plan | Phase breakdown (0-4); dependencies and sequencing; milestones and success criteria | All other specs | (see phases below) | — | Resource estimates for each phase? Go/no-go criteria between phases? Regression testing strategy across phases? |

---

## Dependency Graph (DAG)

```
TECHNICAL_SPEC (foundation)
  ├─→ ARTIFACT_COMPILER_SPEC
  │     └─→ TRACK_A_ARTIFACT_DETERMINISM_SPEC
  │
  ├─→ TRACK_B_TREASURY_COMPLIANCE_SPEC
  │
  ├─→ TRACK_C_CONTROL_PLANE
  │     ├─→ (depends on TRACK_A, TRACK_B)
  │     └─→ API_EVENTS_SPEC
  │
  ├─→ DATA_MODEL_DB_SPEC
  │     └─→ (depends on TRACK_A, TRACK_B, API_EVENTS_SPEC)
  │
  ├─→ OPS_COMPLIANCE_SPEC
  │     └─→ (depends on TRACK_B, TRACK_C)
  │
  ├─→ USER_SPEC
  │
  ├─→ ROLE_TOOL_ALLOWLIST_MATRIX
  │     └─→ (depends on USER_SPEC, TRACK_C)
  │
  └─→ PRODUCT_MODEL (vision layer, agnostic to internals)

SCHEMA_PACK (consolidation of all schemas)

IMPLEMENTATION_ROADMAP (sequencing all phases)
```

---

## CIV-Venture Integration Points

### Integration Point 1: Economy Ledger (CIV-0100 ↔ TRACK_B)

| Aspect | CIV Spec | Venture Spec | Alignment Status | Notes |
|--------|----------|--------------|------------------|-------|
| **Double-entry accounting** | CIV-0100 Section 3 | TRACK_B_TREASURY_COMPLIANCE_SPEC | ✅ ALIGNED (ADR-002) | Venture adopts CIV ledger model; conservation invariant applies |
| **Market clearing** | CIV-0100 Section 4 | TRACK_B (policy engine) | ✅ DESIGNED | Venture's policy enforcement mirrors CIV's market clearing |
| **Event schema** | CIV-0100 economy.transfer.v1 | API_EVENTS_SPEC money.ledger_entry.v1 | ✅ ALIGNED | Debit/credit structure compatible |
| **Reconciliation** | CIV-0100 conservation equation | DATA_MODEL_DB_SPEC audit checks | ✅ PLANNED (Phase 2) | Nightly audit: sum(budgets) ≤ reserve |

**Open Questions:**
- When CIV emits transfer events, how does Venture ingest them? Event bridge design needed.
- Joule supply: fixed or dynamic per simulation run?
- Multi-run reconciliation: how to handle CIV state resets?

---

### Integration Point 2: Simulation State & Workflow (CIV-0001, CIV-0100 ↔ TRACK_C)

| Aspect | CIV Spec | Venture Spec | Alignment Status | Notes |
|--------|----------|--------------|------------------|-------|
| **Tick-based state** | CIV-0001 tick loop | TRACK_C workflow DAG | ✅ PARALLEL | Both event-driven; ticks ≈ workflow steps |
| **FSM transitions** | CIV-0001 state machine | TRACK_C control plane FSM | ✅ ALIGNED | Same pattern: state → event → new state |
| **Policy evaluation** | CIV-0100 Section 5 | TRACK_C policy engine | ✅ DESIGNED | Both evaluate policies before state transitions |
| **Event trails** | CIV-0001 audit log | API_EVENTS_SPEC + OPS audit | ✅ ALIGNED | Both emit immutable event chains |

**Open Questions:**
- How to synchronize Venture workflow with CIV tick? Is Venture async to CIV or blocking?
- Policy version pinning: how to tie Venture event to CIV policy state?
- Determinism: can both systems replay identical state from same event log?

---

### Integration Point 3: Actor Lifecycle & Compliance (CIV-0103 ↔ USER_SPEC, OPS)

| Aspect | CIV Spec | Venture Spec | Alignment Status | Notes |
|--------|----------|--------------|------------------|-------|
| **Lifecycle metadata** | CIV-0103 citizen birth/career/retirement | USER_SPEC user onboarding/lifecycle | ✅ REFERENCE | CIV patterns inform user journey design |
| **Institutional change** | CIV-0103 Section 4 | OPS_COMPLIANCE_SPEC audit trails | ✅ DESIGNED | Institutional change = audit evidence |
| **Time-series metrics** | CIV-0103 citizen metrics | OPS_COMPLIANCE_SPEC observability | ✅ PLANNED (Phase 3) | User activity signals can feed analytics |
| **Role evolution** | CIV-0103 (implicit in agent states) | USER_SPEC (role lifecycle TBD) | ⚠️ PARTIAL | User role changes need formalization |

**Open Questions:**
- How to model user "retirement" or offboarding in compliance audit?
- Should Venture users have time-series activity metrics (like CIV citizens)?
- Policy audit evidence: how detailed? Linked to individual user actions?

---

### Integration Point 4: Resource Quotas & Energy (CIV-0102, CIV-0100 ↔ TRACK_B, TRACK_C)

| Aspect | CIV Spec | Venture Spec | Alignment Status | Notes |
|--------|----------|--------------|------------------|-------|
| **Conservation equation** | CIV-0100 energy supply | TRACK_B budget conservation | ✅ ALIGNED (ADR-002) | Joules as conservation-preserving unit |
| **Supply-stress metrics** | CIV-0102 peak-shaving | TRACK_B velocity controls | ✅ DESIGNED | Similar demand-response mechanics |
| **Quota enforcement** | CIV-0102 rationing | TRACK_C policy engine | ✅ ALIGNED | Both enforce quotas via policy |
| **Rate limiting** | (implicit in CIV) | TRACK_C tool invocation limits | ✅ DESIGNED | API rate limits modeled as energy quotas |

**Open Questions:**
- CIV energy model complexity (primary/secondary, supply curves): which parts map to Venture budgets?
- Venture "energy demand" (API calls, artifact bytes): is this a first-class metric or derived?
- Dynamic quota adjustment: how often, by whom, via what mechanism?

---

### Integration Point 5: Determinism & Constraints (CIV-0104 ↔ TRACK_A)

| Aspect | CIV Spec | Venture Spec | Alignment Status | Notes |
|--------|----------|--------------|------------------|-------|
| **Minimal constraint set theorem** | CIV-0104 (entire spec) | TRACK_A_ARTIFACT_DETERMINISM_SPEC | ✅ FOUNDATION | CIV-0104 provides mathematical basis for artifact determinism |
| **Replay capability** | CIV-0104 determinism proof | TRACK_A build/replay contracts | ✅ ALIGNED | Both fully replay-safe (byte-for-byte) |
| **Idempotency** | CIV-0104 (implicit) | API_EVENTS_SPEC idempotent events | ✅ DESIGNED | Idempotent artifact builds mirror CIV idempotent ticks |
| **Audit completeness** | CIV-0104 (proof artifact) | OPS audit trail + DATA audit log | ✅ PLANNED (Phase 2+) | Venture audit can be replayed like CIV simulation |

**Open Questions:**
- How to prove Venture artifact determinism formally (like CIV-0104)?
- Floating-point variance in renders (fonts, colors): acceptable or not?
- What audit artifacts are sufficient for compliance? Full byte-for-byte diffs?

---

## Implementation Phases (Per IMPLEMENTATION_ROADMAP.md)

| Phase | Duration | Key Deliverables | Specs Driving | Milestones |
|-------|----------|------------------|---------------|-----------|
| **Phase 0: Design & Scaffolding** | Week 1-2 | Governance structure, ADRs, schema consolidation | TECHNICAL_SPEC, SCHEMA_PACK | CLAUDE.md, Taskfile, QA config ready |
| **Phase 1: Foundation (Control Plane & Ledger)** | Week 3-4 | FSM + event bus scaffold, ledger schema, compliance machine frame | TRACK_C, TRACK_B, API_EVENTS_SPEC, DATA_MODEL_DB_SPEC | CIV integration points documented, deployment-ready control plane |
| **Phase 2: Artifact Compiler & Treasury** | Week 5-8 | DocSpec & SlideSpec renderers, ledger implementation, policy enforcement | ARTIFACT_COMPILER_SPEC, TRACK_A, TRACK_B | Headless artifact generation working, spend policies enforced |
| **Phase 3: Expansion & Observability** | Week 9-12 | TimelineSpec & AudioSpec, audit/observability instrumentation | (above) + OPS_COMPLIANCE_SPEC | Full artifact family, audit trail working, dashboards live |
| **Phase 4: Optimization & Security** | Week 13-16 | Performance tuning, security hardening, SaaS export bridge | (all specs) | Production-ready, SaaS export optional, incident automation tested |

---

## Validation Status Summary

| Category | Count | Status | Notes |
|----------|-------|--------|-------|
| **Specs Finalized** | 12 | ✅ ALL CLOSED | All specs frozen as of 2026-02-21 |
| **CIV Integration Points** | 5 | ✅ 5/5 MAPPED | All mapped to CIV specs; ADRs created for 2 major points |
| **ADRs** | 2+ | ✅ ADR-001, ADR-002 ACCEPTED | ADR-003+ TBD per roadmap |
| **Governance Docs** | 3 | ✅ COMPLETE | GOVERNANCE_SUMMARY.md, QUALITY_GATES.md, this file |
| **Open Questions** | ~25 | ⚠️ DOCUMENTED | See per-spec rows and integration point sections |
| **Dependency DAG** | Clean | ✅ NO CYCLES | All dependencies resolved; ready for Phase 1 |

---

## Open Questions by Priority

### High Priority (Block Phase 1 Start)

1. **Event bridge design** (Integration Point 1): How do Venture workflows consume CIV economy.transfer events?
2. **FSM determinism proof** (Integration Point 5): Formal proof that Venture FSM is deterministic like CIV simulation?
3. **Joule-to-USD conversion** (Integration Point 1): Fixed rate vs. market-clearing? Updated daily or per-run?
4. **Schema registry API** (SCHEMA_PACK): What's the control plane API for schema versioning/lookup?

### Medium Priority (Phase 1-2)

5. **Tool discovery dynamics** (TECHNICAL_SPEC): Can agents use "new" tools, or is allowlist truly static?
6. **Font/style versioning** (ARTIFACT_COMPILER_SPEC): How to handle typography updates without breaking determinism?
7. **Incident playbook automation** (OPS_COMPLIANCE_SPEC): Which incident types auto-execute vs. requiring human approval?
8. **User role evolution** (USER_SPEC): What's the lifecycle for user role changes?

### Lower Priority (Phase 3-4, or future ADRs)

9. **SaaS export strategy** (future ADR): When/how to add optional Canva/Figma export?
10. **Multi-run reconciliation** (DATA_MODEL_DB_SPEC): Handling CIV state resets across multiple simulation runs?

---

## Next Steps

1. **Phase 0 Kickoff**: Start with Taskfile, QA config, Makefile (this week)
2. **Resolve high-priority open questions**: Create design docs or additional ADRs
3. **Finalize IMPLEMENTATION_ROADMAP.md**: Resource estimates, go/no-go criteria
4. **Begin Phase 1**: Control plane scaffold and ledger schema

---

## References

- **All Venture specs**: Root directory (TECHNICAL_SPEC.md through IMPLEMENTATION_ROADMAP.md)
- **All CIV specs**: `../civ/docs/specs/` (CIV-0001 through CIV-0106)
- **Cross-track index**: `../SPECS_INDEX.md` (5 integration points)
- **Architecture decisions**: `docs/adr/` (ADR-001, ADR-002)
- **Governance**: `docs/governance/` (QUALITY_GATES.md, GOVERNANCE_SUMMARY.md)

---

**Last Updated:** 2026-02-21
**Owned By:** Venture Autonomy Platform Team
**Next Review:** 2026-03-21


---
