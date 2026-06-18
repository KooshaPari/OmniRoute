# ADR-034: Schedule `KooshaPari/phenotype-monorepo-state` deletion (after ADR-033)

**Status:** ACCEPTED
**Date:** 2026-06-17
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
