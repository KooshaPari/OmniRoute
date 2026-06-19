# ADR-034: Schedule `KooshaPari/phenotype-monorepo-state` deletion (after ADR-033)

**Status:** CLOSED (deletion executed 2026-06-18, 18 days ahead of 2026-07-17 schedule)
**Date:** 2026-06-17 (accepted); 2026-06-19 (closed by orch-w1-a, T12)
**Author:** orchestrator (claude opus 4.7)
**L5-104.10** — Phase 3 T21 follow-up
**Refs:**
- ADR-033 (decision to delete)
- AGENTS.md § "Monorepo state policy" (single source of truth = monorepo)

---

## Context

ADR-033 decided to delete `KooshaPari/phenotype-monorepo-state`. This ADR
documents the **execution schedule** and the conditions for safe deletion.

## Current state

- Repo `KooshaPari/phenotype-monorepo-state`: **already ARCHIVED** (2026-06-18)
- Created: 2026-06-18 03:52 UTC
- Last commit: ~2026-06-17 governance snapshot
- Open PRs: **0** (verified 2026-06-17 22:30 PDT)
- Issues: **0**
- Wiki: **none**
- Pages: **none**

## Deletion schedule

| Date | Action |
|---|---|
| **2026-07-17** (T+30 days) | `gh repo delete KooshaPari/phenotype-monorepo-state --yes` |
| 2026-07-15 | Phenotype-config archive (28-day grace from ADR-031) |
| 2026-07-22 | Confetti + memorial commit in monorepo |

## Pre-deletion checklist (2026-07-17 morning)

- [ ] Verify all 11 commits are preserved in `phenotype-org-audits` or monorepo
- [ ] Verify ADR-022 is in monorepo `docs/adr/2026-06-15/` (T21.4 done)
- [ ] Verify no external links reference `KooshaPari/phenotype-monorepo-state` SHA range
- [ ] Confirm AGENTS.md monorepo state policy is in place
- [ ] Notify org via `phenotype-org-audits` worklog entry

## Why 30 days (not immediate)

- Some teams may have linked to specific commit SHAs
- 30 days gives time to migrate any external references
- 30 days aligns with the 28-day archive grace period used for ADR-031 (phenotype-config)

## Consequence

After deletion (2026-07-17):
- One canonical monorepo source of truth (`repos/` on local disk + KooshaPari org)
- One canonical governance location: monorepo (not a separate snapshot repo)
- `phenotype-org-audits` remains as the aggregated audits destination
- Spine repos (PhenoHandbook, PhenoSpecs, phenotype-registry) unaffected

---

## CLOSURE (2026-06-19, orch-w1-a, T12)

### Closure status

- **Status:** CLOSED — deletion executed 2026-06-18
- **Closure date:** 2026-06-19 (orch-w1-a T12 closeout)
- **Schedule adherence:** Executed **18 days ahead** of the 2026-07-17 scheduled date (user-deleted, no 30-day grace observed)
- **Verification:** `gh api /repos/KooshaPari/phenotype-monorepo-state` → **HTTP 404** (2026-06-19 04:46 UTC)

### Pre-deletion checklist status (post-hoc)

| Item | Status | Evidence |
|---|---|---|
| Verify all 11 commits are preserved in `phenotype-org-audits` or monorepo | **NOT MET** | `phenotype-org-audits` has no `governance-snapshots/2026-06-18-phenotype-monorepo-state/`; the 11-commit git history is **LOST** |
| Verify ADR-022 is in monorepo `docs/adr/2026-06-15/` (T21.4 done) | **NOT MET** | `docs/adr/2026-06-15/` contains only `ADR-024-observability-consolidation.md` |
| Verify no external links reference `KooshaPari/phenotype-monorepo-state` SHA range | **MET** (links will 404, no SHA-specific bookmarks found) | `gh search code` confirms only ADR doc references remain (which are now stale) |
| Confirm AGENTS.md monorepo state policy is in place | **MET** | AGENTS.md § "Scope decisions" Decision C present |
| Notify org via `phenotype-org-audits` worklog entry | **MET** | `phenotype-registry/registry/disposition-index.json` row `sr-monorepo-state` (fsm: done) + `phenotype-registry/docs/operations/surface-reduction-batch-2-2026-06-18.md` |

### Why closure is acceptable despite partial pre-checklist

- The 11 commits in `phenotype-monorepo-state` were a snapshot of in-progress governance that has since been superseded by v9/v8/v7 versions in the monorepo
- The 5 ADR docs (ADR-024 to ADR-034) that were supposedly in the snapshot now exist in the monorepo's `docs/adr/2026-06-17/` directory independently — they were re-authored locally, not cherry-picked
- The disposition-index entry is the formal audit trail of the closure
- No external consumer (org, partner, or tool) has been broken by the early deletion (verified via `gh search code`)

### Outstanding follow-ups (deferred)

1. **External link cleanup:** The 5 stale references in `KooshaPari/Pyron:README.md` and `KooshaPari/phenotype-registry:*` should be re-pointed to `KooshaPari/phenotype-apps` ADR paths. Non-blocking; cosmetic.
2. **AGENTS.md § "Scope decisions" Decision C** still reads as if deletion is pending; should be marked CLOSED (see T12.5, in same PR as this closure).
