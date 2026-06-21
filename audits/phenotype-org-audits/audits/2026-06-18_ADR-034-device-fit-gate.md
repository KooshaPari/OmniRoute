# ADR-034: Device-fit gate (Tier-0 macbook / Tier-1 heavy-runner / Tier-2 subagent)

Worklog `device:` field (ADR-015 v2.1) classifies every task by device tier. Heavy work (full `cargo test --workspace` on multi-100-crate workspaces, iOS Simulator boot, Docker-in-Docker, Unity/Unreal editor head, any single build/test cycle > 10 min wall on the MacBook) MUST run on a Tier-1 heavy-runner or Tier-2 subagent; the MacBook is reserved for Tier-0 (planning, ADR-writing, small focused PRs, code review, dogfooding).

**Status:** Accepted
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**Track:** v8 T14 (governance backlog)
**L8-013** (T14.5 / Rule 3.1 derivative)

## Context

The 2026-06-17 wrap-up session made the device-fit problem explicit: the MacBook (the operator's primary device) is **not** a heavy-work device. A single `cargo test --workspace` against a 100+ crate workspace can take 30+ min wall and fan the laptop's thermals. A full iOS Simulator boot + UI test pass takes 20+ min wall. Docker-in-Docker requires a privileged runner. Unity/Unreal editor heads require a discrete-GPU runner.

Until 2026-06-17, every task — including the heavy ones — ran on the MacBook, with operators manually running single-crate subsets of the workspace and assembling the result. This was a throughput cap: the fleet could not exercise its full test matrix in a session. ADR-015 v2.1 (per ADR-025) adds an 11th column to the worklog schema: `device:`, which the operator sets per row.

## Decision

**Three device tiers, mutually exclusive per task, declared in the worklog `device:` field:**

| Tier | Device | Allowed work | Examples |
|---|---|---|---|
| **Tier-0** | `device: macbook` | Planning, ADR-writing, small focused PRs (≤ 5 files), code review, dogfooding, doc edits, governance commits | Writing this ADR; opening a 1-PR Configra re-export; reviewing a subagent's diff |
| **Tier-1** | `device: heavy-runner` | Full `cargo test --workspace` (multi-100-crate); iOS Simulator boot + UI test; Docker-in-Docker; Unity/Unreal editor head; any build cycle 5–60 min wall on the MacBook | Running `cargo test --workspace` on `phenoShared`; booting the iOS Simulator for a PlayCua smoke test; building the Unity editor head for `Dino` |
| **Tier-2** | `device: subagent` | Any single build/test cycle > 10 min wall on the MacBook; tasks too large for Tier-1 wall budget; cross-repo migrations; full 71-pillar fleet probe | A 30-min `cargo test` on `phenoShared`; a fleet-wide `gitleaks` run; the Configra 12-PR absorption wave |

The `device:` field is **mandatory** in worklog v2.1 (ADR-015 + ADR-025). A `L#-#` task without a `device:` field is invalid; the v2.1 CI lint in `pheno-worklog-schema` rejects it.

**Heavy work MUST use a heavy-runner or subagent.** The MacBook is reserved for orchestration. The operator's role at Tier-0 is to *plan*, *review*, and *decide*, not to *execute* the heavy cycle.

### Heavy-work assignment rules

1. **Self-hosted runner** (Tier-1, `device: heavy-runner`): used when the heavy cycle is **deterministic and short enough** to need a specific machine profile (e.g. macOS + Apple Silicon for iOS Simulator; Linux + discrete GPU for Unity). The runner is a known machine; the work is reproducible.
2. **Forge / cloud-runner / subagent** (Tier-2, `device: subagent`): used when the work is **opportunistic or scale-bound** (e.g. fleet-wide gitleaks, 30+ PR absorption wave). The subagent is a dispatched worker; the result is returned asynchronously.

The split is **opportunistic vs deterministic**, not "more powerful vs less powerful". A subagent can be more powerful than a self-hosted runner; the decision criterion is whether the work needs a known reproducible environment (runner) or can run anywhere (subagent).

## Consequences

*Positive:*
- The MacBook is no longer a throughput cap. Heavy work runs in parallel on heavy-runners and subagents; the operator's wall-time on the MacBook drops to Tier-0 tasks only.
- The `device:` field is auditable: per-task, per-session, per-req_id. The 71-pillar audit can score L28 (DX) on the basis of "what fraction of the fleet's heavy work actually runs on the right device?"
- Subagent dispatch becomes the default for any work that would otherwise bottleneck on a single device.

*Negative / Risks:*
- The dispatch infrastructure (forge, OmniRoute, subagent workers) must be reliable; a dispatch failure on a Tier-2 task blocks the wave. Mitigation: T0 pre-flight gate in the v8 plan (T0.2) verifies `forge -p "echo ok"` returns 0 in < 30s.
- Tier-1 (self-hosted runner) requires provisioned hardware; the fleet may not have enough runner capacity for all v8 tracks running in parallel. Mitigation: T0.3 verifies OmniRoute liveness; fallback to Tier-2 (subagent) if no runner is free.
- A misclassified task (Tier-0 work tagged Tier-2, or vice versa) wastes the wrong resource. Mitigation: ADR-030 (PR template 71-pillar delta) requires the author to justify the `device:` choice in the delta rationale.

## Refs

- ADR-015 (worklog v2.0 schema — original 10 columns)
- ADR-025 (worklog v2.1 schema bump — adds 11th `device:` column)
- AGENTS.md § "Device-fit gate" (Rule 1)
- `pheno-worklog-schema/SPEC-v2.1.md`
- v8 plan § 3.0 Track T0 (pre-flight gate: T0.2 forge liveness, T0.3 OmniRoute liveness)
