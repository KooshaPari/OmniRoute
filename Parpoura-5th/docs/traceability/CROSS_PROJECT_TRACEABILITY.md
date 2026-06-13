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

