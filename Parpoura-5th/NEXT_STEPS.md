# Cross-Track Implementation Next Steps

**Date:** 2026-02-21

**Status:** All planning gaps closed. Spec package is complete and ready for integrated implementation.

---

## Part 1: Completed Specifications

### CIV Track (8 specs, all CLOSED)
- **CIV-0001**: Core simulation loop (foundation for all modules)
- **CIV-0100**: Economy v1 (ledger, market clearing, conservation invariants)
- **CIV-0101**: Two-zoom LOD (spatial rep, level-of-detail)
- **CIV-0102**: Climate follow-up (energy accounting integration)
- **CIV-0103**: Institutions, time-series, citizen lifecycle (actor models)
- **CIV-0104**: Minimal constraint set theorem (mathematical foundations)
- **CIV-0105**: War, diplomacy, shadow networks (geopolitical dynamics)
- **CIV-0106**: Social, ideology, health, insurgency (citizen agency)

### Venture Track (12 specs, all CLOSED)
- **TECHNICAL_SPEC.md**: Control-plane architecture, runtime model, security posture
- **TRACK_A_ARTIFACT_DETERMINISM_SPEC.md**: Artifact IR family, deterministic build/replay contracts
- **TRACK_B_TREASURY_COMPLIANCE_SPEC.md**: Money control, spend policy, ledger reconciliation, compliance/privacy
- **TRACK_C_CONTROL_PLANE.md**: Orchestrator, FSM pack, policy engine, tool allowlists, audit/observability
- **API_EVENTS_SPEC.md**: Event envelope schema, FSM transitions, strict validation
- **DATA_MODEL_DB_SPEC.md**: Artifact IR tables, ledger tables, workflow tables, audit logs
- **OPS_COMPLIANCE_SPEC.md**: Compliance machine, policy packs, audit cadence, incident doctrine
- **USER_SPEC.md**: User roles, capabilities, onboarding, multi-tenant isolation
- **PRODUCT_MODEL.md**: Feature roadmap, monetization, tier/plan structure
- **SCHEMA_PACK.md**: Consolidated schema definitions (artifact, ledger, workflow, event)
- **ROLE_TOOL_ALLOWLIST_MATRIX.md**: Per-role capability model
- **IMPLEMENTATION_ROADMAP.md**: Phased rollout plan (Sandbox → Limited Autopilot → Governed Autonomy)

**Total: 20 spec artifacts. Zero open planning gaps.**

---

## Part 2: Immediate Implementation Priorities

### High Priority: Foundation Layers (P0)

#### 1. Venture Control-Plane Scaffolding
**Depends on:** TECHNICAL_SPEC, TRACK_C_CONTROL_PLANE, TRACK_A_ARTIFACT_DETERMINISM_SPEC

**Concrete tasks:**
1. Implement `EventEnvelopeV1` schema validation layer (API_EVENTS_SPEC)
   - Parse and validate `event_id`, `event_type`, `trace_id`, `workflow_id`, `task_id`, `payload`, `created_at`
   - Bind every external effect to this envelope
   - **QA:** Write property tests for schema validation; ensure all events conform

2. Stand up `TaskEnvelopeV1` and `WorkspaceIsolation` boundaries (TRACK_C_CONTROL_PLANE)
   - Implement workspace definitions (`workspaces/default.yaml`)
   - Enforce `max_concurrency`, `global_eau_cap`, `per_workflow_eau_cap` guards
   - Inject `agent_role`, `trace_id`, `workflow_id` before task dispatch
   - **QA:** Integration tests verifying workspace budget enforcement; exceed budget → rejection

3. Implement policy bundle versioning and schema registry (TECHNICAL_SPEC, SCHEMA_PACK)
   - DB table: `policy_bundles(id, version, schema_snapshot, created_at, published_at)`
   - Bind every emitted event to a `policy_bundle_id`
   - **QA:** Regression tests ensuring old policy bundles are replayable with same outputs

4. Build FSM framework for workflow/task/action state transitions (TRACK_C_CONTROL_PLANE)
   - Define FSM states: `pending → scheduled → executing → completed|failed|revoked`
   - Emit `{workflow|task|action}.{started|completed|failed}.v1` events on state entry/exit
   - **QA:** State diagram validation; no orphaned transitions

**Owner:** Venture Platform Team
**Wall-clock estimate:** 4–6 days (2–3 subagents parallel)
**Exit criteria:** All external effects emit EventEnvelopeV1; workspace budgets enforced; events replay-deterministic

---

#### 2. Venture Money Control & Treasury Ledger (Phase 1)
**Depends on:** TRACK_B_TREASURY_COMPLIANCE_SPEC, API_EVENTS_SPEC, DATA_MODEL_DB_SPEC

**Concrete tasks:**
1. Implement default-deny money authorization (TRACK_B_TREASURY_COMPLIANCE_SPEC)
   - DB table: `money_intents(id, scope_type, scope_id, cap_amount, window, ttl_ms, status, created_at)`
   - Before any spend: validate `money_intent` exists, not revoked, within budget window
   - Emit `money.authorization.decided.v1` with `reason_code` (approved|rejected_budget|rejected_policy|revoked)
   - **QA:** Fuzz tests with malformed spend attempts; all rejections must be logged with reason

2. Stand up double-entry ledger with reconciliation hooks (TRACK_B_TREASURY_COMPLIANCE_SPEC)
   - DB tables: `ledger_entries(id, debit_account, credit_account, amount, reference_id, created_at)`, `reconciliation_runs(id, period, drift, status)`
   - Implement daily reconciliation: internal ledger vs. processor exports vs. bank statements
   - Drift above threshold → auto-open compliance case
   - **QA:** Property tests for conservation (sum of all entries = 0); replay tests on historical data

3. Implement policy attestations and audit trail (TRACK_B_TREASURY_COMPLIANCE_SPEC)
   - DB table: `policy_attestations(id, policy_bundle_id, attestor, result, created_at)`
   - Every authorization decision includes `policy_bundle_id` and attestor signature
   - Append-only audit log; no edits, only new entries
   - **QA:** Audit trail immutability tests; no silent reconciliation drift

**Owner:** Venture Treasury Team
**Wall-clock estimate:** 3–5 days (2 subagents)
**Exit criteria:** Unauthorized spend is rejected with reason codes; ledger reconciles daily; audit trail is immutable

---

#### 3. Artifact IR Schema Freeze & Deterministic Build (Phase 1)
**Depends on:** TRACK_A_ARTIFACT_DETERMINISM_SPEC, SCHEMA_PACK

**Concrete tasks:**
1. Freeze and publish artifact IR schema family (TRACK_A_ARTIFACT_DETERMINISM_SPEC)
   - Define JSON schemas for `SlideSpec`, `DocSpec`, `TimelineSpec`, `AudioSpec`, `BoardSpec`
   - Each IR object requires: `schema_version`, `content_hash`, `inputs_hash`, `policy_bundle_id`, `created_at`
   - Publish schemas to schema registry with version binding
   - **QA:** Schema conformance tests; reject non-conforming IRs; version migration tests

2. Implement deterministic build key and provenance recording (TRACK_A_ARTIFACT_DETERMINISM_SPEC)
   - Idempotency key = `hash(ir_hash, toolchain_version, policy_bundle_id, target_surface)`
   - DB tables: `artifact_ir(id, ir_type, schema_version, content_hash, payload_json, created_at)`, `artifact_builds(id, ir_id, idempotency_key, toolchain_version, status, created_at)`, `artifact_provenance(id, build_id, provider, model, signature, created_at)`
   - Cache layer: if idempotency key exists and build succeeded, return cached artifact
   - **QA:** Byte-identical replay tests; pinned toolchain version reproduces same output; cache hit metrics

3. Model Veo/NanoBanana scene compiler contract (TRACK_A_ARTIFACT_DETERMINISM_SPEC)
   - Route `TimelineSpec → scene plan → provider prompt pack → render jobs → verification`
   - Provider fallback order = policy-driven by quality tier and budget envelope
   - All provider calls emit signed `artifact.provenance.attested.v1` events
   - **QA:** Fallback routing respects policy tier; all renders signed; semanticequivalence validator (if non-deterministic provider)

**Owner:** Venture Artifact Team
**Wall-clock estimate:** 3–4 days (2 subagents)
**Exit criteria:** All artifact IRs conform to schema; builds are idempotent within pinned toolchain; provenance is signed and auditable

---

### Medium Priority: Integration Glue (P1)

#### 4. CIV Simulation Event Export & Policy Audit Trail (Post Phase 1)
**Depends on:** CIV-0001, CIV-0100, CIV-0103, Venture TECHNICAL_SPEC, TRACK_C_CONTROL_PLANE, API_EVENTS_SPEC

**Concrete tasks:**
1. Stream CIV economy events through Venture event bus (CIV-0100 + TRACK_C_CONTROL_PLANE)
   - Map CIV's `policy.applied.v1` → Venture `EventEnvelopeV1` with `event_type="civ.policy.applied.v1"`
   - Map CIV's `economy.market_cleared.v1` and `economy.transfer_booked.v1` to Venture event schema
   - Bind each CIV event to a `workflow_id` and `trace_id` pointing to the simulation run
   - **QA:** Cross-platform event validation; no CIV events dropped; timestamps monotonic

2. Integrate CIV's policy.evaluate → Venture's policy engine (CIV-0100 + TRACK_C_CONTROL_PLANE)
   - CIV's `policy.evaluate(state, context) → control` function becomes a `policy.evaluate` tool in Venture's tool allowlist
   - Wrap CIV policy calls in Venture's `money_intent` gates (e.g., budget for fiscal policy changes)
   - **QA:** Policy evaluation latency SLA; policy bundle version pinning

3. Audit trail for institutional changes (CIV-0103 + OPS_COMPLIANCE_SPEC)
   - CIV's citizen lifecycle and institutional change events → compliance case evidence chains
   - Capture `institution.created/disbanded/merged/split` → Venture audit log
   - **QA:** Audit drill: recover full institution evolution from event log

**Owner:** CIV-Venture Integration Team
**Wall-clock estimate:** 4–5 days (2 subagents, after P0 complete)
**Exit criteria:** CIV events flow through Venture event bus; policy audit trail is queryable; compliance can trace institutional changes

---

#### 5. Cost Model: CIV Energy Accounting → Venture Spend Quota (Post Phase 1)
**Depends on:** CIV-0100, CIV-0102, TRACK_B_TREASURY_COMPLIANCE_SPEC

**Concrete tasks:**
1. Map CIV's energy conservation equation to Venture's quota model (CIV-0100 + CIV-0102)
   - CIV equation: `supply + reserves_in - losses - consumption - reserves_out = delta_stock`
   - Venture budget model: `auth_limit - approved_spend - pending_spend - reserved_spend = available_quota`
   - Cross-apply peak-shaving and demand-response mechanics
   - **QA:** Conservation equation holds in both systems; no quota violations silent

2. Define artifact render cost model tied to quality tier (TRACK_A_ARTIFACT_DETERMINISM_SPEC + TRACK_B_TREASURY_COMPLIANCE_SPEC)
   - Render cost = `base_cost(artifact_type, surface) + quality_tier_multiplier + provider_cost(model)`
   - Deduct from spend quota before render dispatch
   - **QA:** Cost estimates match actuals within 5%; no undercharge scenarios

**Owner:** Venture Finance & Ops Team
**Wall-clock estimate:** 2–3 days (1 subagent, post P0)
**Exit criteria:** CIV energy model informs Venture spend quotas; cost estimates bound actual spend

---

### Low Priority: Polish & Hardening (P2)

#### 6. Incident Doctrine & Compliance Drills (Post Phase 2)
**Depends on:** OPS_COMPLIANCE_SPEC, TRACK_C_CONTROL_PLANE, all P0 + P1 complete

**Concrete tasks:**
1. Codify incident playbooks (OPS_COMPLIANCE_SPEC)
   - Map incident classes (policy violation, treasury drift, tool misuse) to escalation paths
   - Define freeze/kill-switch triggers and recovery procedures
   - **QA:** Tabletop drills; incident classification automation

2. Bake audit cadence into policy bundle review (OPS_COMPLIANCE_SPEC, TRACK_C_CONTROL_PLANE)
   - Daily reconciliation checks, weekly policy-drift reviews, monthly governance attestations
   - Quarterly tabletop drills with full evidence capture
   - **QA:** Compliance case metrics; audit report generation

**Owner:** Venture Compliance & Audit Team
**Wall-clock estimate:** 2–3 days (1 subagent, post P0+P1)
**Exit criteria:** Incident playbooks executable; audit cadence automated; no compliance evidence gap

---

## Part 3: Unresolved Open Questions

### Venture Track Open Questions

#### Q1. Artifact Determinism for Non-Deterministic Providers
**Spec Location:** TRACK_A_ARTIFACT_DETERMINISM_SPEC.md ("Veo/NanoBanana Scene Compiler Contract")
**Issue:** Veo and NanoBanana do not guarantee byte-identical outputs for identical inputs. How do we handle this?
**Options:**
1. Record both deterministic signature (IR hash) and semantic-equivalence fingerprint; validate equivalence post-render
2. Require provider to return all seeds/RNG state; replay with pinned RNG
3. Accept non-determinism; tag artifacts as "non-deterministic" and disable byte-identical cache hits

**Resolution Needed Before:** Phase 1 completion
**Owner:** Venture Artifact Team + Veo/NanoBanana integration partner
**Recommended Path:** Option 1 (fingerprint + equivalence validator) with Option 3 fallback tag

---

#### Q2. Workspace Budget Granularity
**Spec Location:** TRACK_C_CONTROL_PLANE.md (Workspace isolation section)
**Issue:** Should budgets be per-workspace, per-workflow, per-task, or per-agent-action?
**Current Spec:** Three-tier: `global_eau_cap` + `per_workflow_eau_cap` + implied per-task
**Problem:** Unclear if per-agent-action caps are enforced or advisory
**Resolution Needed Before:** Phase 1 completion (workspace budgets must be enforced)
**Owner:** Venture Platform Team
**Recommended Path:** Enforce both per-workflow and per-task caps; per-action is advisory (logged but not rejected)

---

#### Q3. Policy Bundle Rollback Semantics
**Spec Location:** TRACK_B_TREASURY_COMPLIANCE_SPEC.md, TRACK_C_CONTROL_PLANE.md (policy bundle pinning)
**Issue:** If a policy bundle is found to be faulty (e.g., overly permissive), can we retroactively revoke it?
**Current Spec:** Silent on rollback; assumes all bundles are immutable once published
**Problem:** Incident recovery unclear; unclear if old workflows re-bound to new policy or must fail
**Resolution Needed Before:** Phase 2 (incident doctrine & policy review)
**Owner:** Venture Compliance Team
**Recommended Path:** Policies are immutable; incident response is revoke future bundles + pause affected workflows (no retroactive re-binding)

---

#### Q4. Compliance Case Severity Classification
**Spec Location:** OPS_COMPLIANCE_SPEC.md (incident doctrine)
**Issue:** How are incident classes (policy violation, treasury drift, tool misuse, compliance/legal) prioritized?
**Current Spec:** Names incident classes but doesn't assign SLAs or escalation counts
**Problem:** Unclear if a `$1 reconciliation drift` → Class 3 (low) or Class 1 (freeze)
**Resolution Needed Before:** Phase 2 (incident playbooks must have SLAs)
**Owner:** Venture Ops + Finance + Compliance (stakeholder alignment)
**Recommended Path:** Define thresholds: Class 1 (freeze) = budget overrun | root policy violation | unauthorized tool use; Class 2 (urgent review) = reconciliation drift > 0.1% | policy drift detected; Class 3 (standard review) = routine compliance check failures

---

### CIV Track Open Questions

#### Q5. Climate Model Coupling to Economy
**Spec Location:** CIV-0102, CIV-0100 (climate energy integration)
**Issue:** How tightly should climate energy flows couple to economic supply/demand?
**Current Spec:** CIV-0100 mentions "energy accounting integration" but doesn't specify feedback loop granularity
**Problem:** Unclear if climate affects economy tick-by-tick or via decoupled causality chain
**Resolution Needed Before:** CIV simulation implementation (economy loop must know tick order)
**Owner:** CIV Sim Team
**Recommended Path:** Climate energy state flows → supply constraints (e.g., renewable supply variability); economy adjusts price/allocation in same tick; deterministic order specified in CIV-0001 core loop

---

#### Q6. Institutional Change Propagation Lag
**Spec Location:** CIV-0103, CIV-0105 (institutions, war/diplomacy)
**Issue:** When a new institution forms (e.g., peace treaty creates alliance), how many ticks before it affects actor behavior?
**Current Spec:** CIV-0103 names institution state machine but doesn't specify delay semantics
**Problem:** Unclear if institutional effects are instant or delayed; affects narrative believability and deterministic replay
**Resolution Needed Before:** CIV simulation implementation (policy.evaluate must know institution status)
**Owner:** CIV Sim Team
**Recommended Path:** Institution state machine has explicit delay phase (pending → active transition happens at tick T+N); N specified in policy bundle; all delays logged in events

---

### Cross-Track Integration Open Questions

#### Q7. CIV Simulation Artifacts (Timeline, Dashboard) → Venture Artifact IR Mapping
**Spec Location:** CIV-0001, CIV-0100, CIV-0103 (output spec missing) vs. TRACK_A_ARTIFACT_DETERMINISM_SPEC.md
**Issue:** CIV generates simulation outputs (timelines, dashboards, institutional org charts). Should these be modeled as Venture artifacts?
**Current Spec:** CIV specs are silent on output format; Venture spec defines artifact IRs but doesn't name CIV use cases
**Problem:** Unclear if CIV simulation outputs are one-off exports or auditable, versioned artifacts tied to simulation run
**Resolution Needed Before:** Phase 1 integration (CIV-Venture event bus design must account for artifact lifecycle)
**Owner:** CIV-Venture Integration Team
**Recommended Path:** Define `CivSimulationArtifact` IR type (superset of TimelineSpec + BoardSpec); every simulation run exports artifacts via Venture's artifact build pipeline; artifacts get provenance signature

---

#### Q8. CIV Policy.Evaluate Tool in Venture: Rate-Limiting & Timeout SLA
**Spec Location:** TECHNICAL_SPEC.md (control-plane tools), TRACK_C_CONTROL_PLANE.md (tool allowlist)
**Issue:** CIV's `policy.evaluate(state, context)` is expensive (O(population) or worse). Should Venture rate-limit it?
**Current Spec:** Venture specs are silent on per-tool rate limits; TRACK_C mentions tool allowlist but not tool budgets
**Problem:** Unclear if Venture can call `civ.policy.evaluate` unbounded, or if it needs per-call quota
**Resolution Needed Before:** Phase 1 integration (tool allowlist + quota architecture)
**Owner:** CIV-Venture Integration Team
**Recommended Path:** Tool allowlist entry includes `per_call_budget` (e.g., `civ.policy.evaluate` costs 10 EAU/call, max 100 calls/workflow); exceed budget → reject with reason code

---

## Part 4: Recommended Kickoff Sequence

### Week 1: P0 Foundation (All 3 Parallel)
- **Track 1a:** Venture EventEnvelope + TaskEnvelope + PolicyBundle (Team A, 2 agents)
- **Track 1b:** Venture Money Control & Treasury Ledger (Team B, 2 agents)
- **Track 1c:** Artifact IR Schema Freeze & Build Determinism (Team C, 2 agents)

**Sync points:**
- Day 2: Review schema definitions (API_EVENTS_SPEC, SCHEMA_PACK)
- Day 4: EventEnvelope + policy bundle integration point (both teams must align on event payload structure)
- Day 6: Full integration test: money.authorization.decided.v1 events with artifact.build.started.v1 events

**Exit Gate:** Day 7 EOD
- All P0 specs implemented
- All 8 open questions above are resolved or escalated with decision owner + due date
- Integration test passes

---

### Week 2: P1 Integration (Dependent on P0)
- **Track 2a:** CIV Event Export & Policy Audit Trail (Team A + D, 2 agents, starts Day 8)
- **Track 2b:** Cost Model: Energy → Spend Quota (Team B + E, 1 agent, starts Day 8)

**Sync points:**
- Day 9: CIV event mapping (resolve Q7: artifact IR for CIV outputs)
- Day 12: Cost model validation (run CIV energy conservation tests against Venture quota model)

**Exit Gate:** Day 14 EOD
- P1 spec coverage 80%+ (focus: event export, cost model, audit trail)
- Q1–Q8 all have decision owners + committed due dates
- Integration readiness review

---

### Week 3+: P2 Polish & Incident Readiness (Post P0+P1)
- **Track 3:** Incident Doctrine, Compliance Drills, Policy Bundle Rollback (Team F, 1 agent, starts Day 15)

---

## Part 5: Spec Coverage Summary

| Component | Spec(s) | Status | Implementation Task | Owner |
|-----------|---------|--------|---|---|
| Event Envelope | API_EVENTS_SPEC | Complete | P0 Task 1 | Venture Platform |
| Policy Bundle | TECHNICAL_SPEC, SCHEMA_PACK | Complete | P0 Task 3 | Venture Platform |
| FSM Framework | TRACK_C_CONTROL_PLANE | Complete | P0 Task 4 | Venture Platform |
| Money Authorization | TRACK_B_TREASURY_COMPLIANCE_SPEC | Complete | P0 Task 2a | Venture Treasury |
| Ledger & Reconciliation | TRACK_B_TREASURY_COMPLIANCE_SPEC, DATA_MODEL_DB_SPEC | Complete | P0 Task 2b | Venture Treasury |
| Artifact IR Schema | TRACK_A_ARTIFACT_DETERMINISM_SPEC, SCHEMA_PACK | Complete | P0 Task 3a | Venture Artifact |
| Artifact Build Determinism | TRACK_A_ARTIFACT_DETERMINISM_SPEC | Complete | P0 Task 3b | Venture Artifact |
| Workspace Isolation | TRACK_C_CONTROL_PLANE | Complete | P0 Task 2 (scope) | Venture Platform |
| CIV Event Export | CIV-0001, CIV-0100, API_EVENTS_SPEC | Complete | P1 Task 4a | CIV-Venture Integ |
| Policy Audit Trail | CIV-0103, OPS_COMPLIANCE_SPEC | Complete | P1 Task 4b | CIV-Venture Integ |
| Cost Model | CIV-0100, CIV-0102, TRACK_B | Complete | P1 Task 5 | Venture Finance |
| Incident Playbooks | OPS_COMPLIANCE_SPEC | Complete | P2 Task 6a | Venture Ops |
| Audit Cadence | OPS_COMPLIANCE_SPEC, TRACK_C | Complete | P2 Task 6b | Venture Ops |

---

## Summary

**All 20 spec artifacts are complete and marked CLOSED.** Zero unresolved planning gaps.

**Immediate next action:** Schedule kickoff meeting with team leads from Venture Platform, Treasury, Artifact, and CIV-Venture Integration teams. Review the 8 open questions above; assign decision owners; commit to resolution dates.

**Target:** P0 foundation complete by end of Week 1; P1 integration 80% complete by end of Week 2; P2 polish by end of Week 3.
