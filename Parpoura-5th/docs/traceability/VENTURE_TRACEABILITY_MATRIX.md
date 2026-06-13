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
| **Role evolution** | CIV-0103 (implicit in agent states) | USER_SPEC (role lifecycle open question) | ⚠️ PARTIAL | User role changes need formalization |

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
| **ADRs** | 2+ | ✅ ADR-001, ADR-002 ACCEPTED | ADR-003+ planned per roadmap |
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
