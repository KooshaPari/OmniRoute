# WORK_STREAM.md — Active Work Items and Status Tracking

**Date**: 2026-02-21
**Status**: ACTIVE
**Purpose**: Track ownership and completion of NEXT_STEPS.md tasks

---

## How to Use This Document

1. **Claiming**: When you start work on a task from NEXT_STEPS.md, add a row with `status: CLAIMED`
2. **Progress**: Update `status` as work progresses (IN_PROGRESS, BLOCKED, etc.)
3. **Completion**: Mark `status: COMPLETED` when the task is done
4. **Escalation**: Mark `status: BLOCKED` if you hit a dependency or blocker; add note in "Blockers" column

---

## P0: Foundation Layers (Week 1)

| Task ID | Description | Owner | Status | Started | Completed | Specs | Notes |
|---------|-------------|-------|--------|---------|-----------|-------|-------|
| venture-p0-1 | Venture Control-Plane Scaffolding (EventEnvelopeV1, TaskEnvelopeV1, PolicyBundle, FSM) | Venture Platform Team | UNCLAIMED | — | — | TECHNICAL_SPEC, TRACK_C_CONTROL_PLANE, TRACK_A_ARTIFACT_DETERMINISM_SPEC | 4–6 days, 2–3 subagents parallel |
| venture-p0-2 | Venture Money Control & Treasury Ledger (auth, ledger, audit trail) | Venture Treasury Team | UNCLAIMED | — | — | TRACK_B_TREASURY_COMPLIANCE_SPEC, API_EVENTS_SPEC, DATA_MODEL_DB_SPEC | 3–5 days, 2 subagents |
| venture-p0-3 | Artifact IR Schema Freeze & Deterministic Build (schema, idempotency, provenance) | Venture Artifact Team | UNCLAIMED | — | — | TRACK_A_ARTIFACT_DETERMINISM_SPEC, SCHEMA_PACK | 3–4 days, 2 subagents |

**Week 1 Sync Points**:
- Day 2: Review schema definitions (API_EVENTS_SPEC, SCHEMA_PACK)
- Day 4: EventEnvelope + policy bundle integration (alignment on event payload)
- Day 6: Full integration test (money.authorization + artifact.build events)

**Week 1 Exit Gate**: All P0 specs implemented; Q1–Q8 resolved or escalated; integration test passes

---

## P1: Integration Glue (Week 2, Dependent on P0)

| Task ID | Description | Owner | Status | Started | Completed | Specs | Notes |
|---------|-------------|-------|--------|---------|-----------|-------|-------|
| venture-p1-4 | CIV Simulation Event Export & Policy Audit Trail | CIV-Venture Integration Team | UNCLAIMED | — | — | CIV-0001, CIV-0100, CIV-0103, TRACK_C_CONTROL_PLANE, API_EVENTS_SPEC | 4–5 days, 2 subagents; starts Day 8 (post P0) |
| venture-p1-5 | Cost Model: CIV Energy Accounting → Venture Spend Quota | Venture Finance & Ops Team | UNCLAIMED | — | — | CIV-0100, CIV-0102, TRACK_B_TREASURY_COMPLIANCE_SPEC | 2–3 days, 1 subagent; starts Day 8 |

**Week 2 Sync Points**:
- Day 9: CIV event mapping (resolve Q7: artifact IR for CIV outputs)
- Day 12: Cost model validation (energy conservation tests)

**Week 2 Exit Gate**: P1 spec coverage 80%+; Q1–Q8 all have decision owners + committed due dates

---

## P2: Polish & Hardening (Week 3+, Post P0+P1)

| Task ID | Description | Owner | Status | Started | Completed | Specs | Notes |
|---------|-------------|-------|--------|---------|-----------|-------|-------|
| venture-p2-6 | Incident Doctrine & Compliance Drills | Venture Compliance & Audit Team | UNCLAIMED | — | — | OPS_COMPLIANCE_SPEC, TRACK_C_CONTROL_PLANE | 2–3 days, 1 subagent; starts Day 15 |

**Week 3+ Exit Gate**: Incident playbooks executable; audit cadence automated; no evidence gap

---

## Spec Validation & Quality Tasks (Ongoing)

| Task ID | Description | Owner | Status | Started | Completed | Specs | Notes |
|---------|-------------|-------|--------|---------|-----------|-------|-------|
| parpour-spec-idx | Index all specs; validate completeness (task spec:index) | parpour maintainer | UNCLAIMED | — | — | All | Run before any implementation sprint |
| parpour-spec-gaps | Find untraced requirements (task spec:gaps) | parpour maintainer | UNCLAIMED | — | — | All | Run weekly to catch coverage gaps |
| parpour-lint | Markdown linting (task lint:markdown) | parpour maintainer | UNCLAIMED | — | — | N/A | Run before marking spec ACTIVE |

---

## Blockers and Escalations

| Task ID | Blocker | Owner | Due Date | Status |
|---------|---------|-------|----------|--------|
| venture-p0-1 | Q2: Workspace Budget Granularity (unclear if per-task caps enforced or advisory) | Venture Platform Team | 2026-02-27 | OPEN |
| venture-p0-3 | Q1: Artifact Determinism for Non-Deterministic Providers (Veo/NanoBanana seed handling) | Venture Artifact Team + Veo/NanoBanana partner | 2026-02-27 | OPEN |
| venture-p1-4 | Q7: CIV Simulation Artifacts → Venture IR Mapping (timeline/dashboard as versioned artifacts?) | CIV-Venture Integration Team | 2026-02-28 | OPEN |
| venture-p1-5 | Q5: Climate Model Coupling to Economy (tick-by-tick vs. decoupled causality) | CIV Sim Team | 2026-02-28 | OPEN |

---

## Open Questions (From NEXT_STEPS.md)

All open questions must be resolved or escalated before respective phase gates. See NEXT_STEPS.md "Part 3: Unresolved Open Questions" for full details and recommended resolutions.

| Q# | Title | Due | Owner | Status |
|----|-------|-----|-------|--------|
| Q1 | Artifact Determinism for Non-Deterministic Providers | 2026-02-27 | Venture Artifact Team | OPEN |
| Q2 | Workspace Budget Granularity | 2026-02-27 | Venture Platform Team | OPEN |
| Q3 | Policy Bundle Rollback Semantics | 2026-03-07 | Venture Compliance Team | OPEN |
| Q4 | Compliance Case Severity Classification | 2026-03-07 | Venture Ops + Finance | OPEN |
| Q5 | Climate Model Coupling to Economy | 2026-02-28 | CIV Sim Team | OPEN |
| Q6 | Institutional Change Propagation Lag | 2026-02-28 | CIV Sim Team | OPEN |
| Q7 | CIV Simulation Artifacts → Venture IR Mapping | 2026-02-28 | CIV-Venture Integ | OPEN |
| Q8 | CIV policy.evaluate Tool in Venture: Rate-Limiting & Timeout SLA | 2026-02-28 | CIV-Venture Integ | OPEN |

---

## Status Legend

| Status | Meaning |
|--------|---------|
| UNCLAIMED | Task available; no owner assigned |
| CLAIMED | Owner assigned; work not yet started |
| IN_PROGRESS | Owner actively working |
| BLOCKED | Work paused due to dependency or blocker |
| COMPLETED | Task done; marked in NEXT_STEPS.md as complete |

---

## How to Claim a Task

1. Find an UNCLAIMED task above
2. Add your name: `Owner: @your-name`
3. Set: `status: CLAIMED | started: YYYY-MM-DD`
4. Begin implementation following NEXT_STEPS.md task description
5. Update status as you progress
6. Mark `status: COMPLETED | completed: YYYY-MM-DD` when done

Example:
```markdown
| venture-p0-1 | Venture Control-Plane Scaffolding | Kosh Sapari | CLAIMED | 2026-02-21 | — | ... | Started work on EventEnvelopeV1 |
```

---

## Coordination with Sibling Projects

When work in this task requires changes to `civ` or `venture` sibling projects:

1. **Before implementing**: Link to the relevant spec(s) in parpour
2. **During implementation**: Follow sibling project's AGENTS.md rules
3. **After completing**: Update this WORK_STREAM.md with status
4. **Handoff**: Write brief note in `docs/research/CONVERSATION_DUMP_YYYY-MM-DD.md` (optional)

---

## Related Documents

- **Implementation roadmap**: `NEXT_STEPS.md`
- **Master spec index**: `SPECS_INDEX.md`
- **Governance rules**: `AGENTS.md`, `CLAUDE.md`
- **Quality criteria**: `docs/governance/QUALITY_GATES.md`
- **Architecture decisions**: `docs/adr/`
