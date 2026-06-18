# ADR-033: Delete `KooshaPari/phenotype-monorepo-state` (it duplicates monorepo governance)

**Status:** ACCEPTED
**Date:** 2026-06-17
**Author:** orchestrator (claude opus 4.7)
**L5-104.9** — Phase 3 T21
**Refs:**
- findings/2026-06-17-L5-104-9-monorepo-state-deletion.md
- AGENTS.md § "Monorepo state policy" (new, this ADR)
- SSOT.md row "Monorepo canonical (single source of truth)" (new, this ADR)

---

## Context

User flagged: "phenotype monorepo... should not exist. again we only lightly use the federated handbook, specs, registry and other spine repos."

Investigation (T21):

| Repo | Created | Content | State |
|---|---|---|---|
| `KooshaPari/phenotype-monorepo-state` | 2026-06-18 03:52 | 11 commits, full governance snapshot (AGENTS.md, STATUS.md, SSOT.md, 5+ ADR/audit/plan files) | ACTIVE — but should not exist |

The repo was created on 2026-06-17 by an external session as a "small snapshot of governance" — but this **violates the single-source-of-truth principle**. The governance files belong in the monorepo (`repos/`) where they're authored. Snapshotting them to a separate repo creates fork drift.

## Decision

**Delete `KooshaPari/phenotype-monorepo-state` and consolidate the 11 commits back to the monorepo where they belong.**

### Sub-tasks

| # | Task | Repo | Effort |
|---|---|---|---|
| T21.1 | Identify the 11 commits in `phenotype-monorepo-state` | local | 5 min |
| T21.2 | Decide canonical monorepo remote (argis or new) | monorepo | 5 min |
| T21.3 | Cherry-pick governance files (already done in T6.3) | phenotype-org-audits | done |
| T21.4 | Cherry-pick non-governance files (3 ADR docs) to `docs/adr/2026-06-15/` | monorepo | 10 min |
| T21.5 | Update SSOT.md + AGENTS.md with monorepo state policy (no separate repo) | monorepo | 10 min |
| T21.6 | `gh repo delete KooshaPari/phenotype-monorepo-state` (after 30-day grace) | GitHub | 0 min (scheduled) |

**Total: 6 sub-tasks, ~30 min, 1 deletion scheduled**

### Why not just archive?

- Archiving still leaves a "phenotype-monorepo-state" repo in the org, which is misleading
- The content is already elsewhere (monorepo + phenotype-org-audits)
- The user's intent was clear: "should not exist"

### Why 30-day grace?

- Some teams may have linked to specific commit SHAs
- 30 days gives time to migrate any external references

## Consequence

- One canonical monorepo (`repos/`) on local disk + KooshaPari org
- One canonical governance location: monorepo (not a separate snapshot repo)
- `phenotype-org-audits` remains as the **aggregated audits** destination (ADR-028, still valid)
- 11 commits preserved in `phenotype-org-audits` (T6.3 already done) + remaining 3 cherry-picked to monorepo

## Notes

- This ADR establishes a policy: **no separate "monorepo state" repos**. The monorepo IS the source of truth.
- Future governance work that needs cross-repo visibility goes to `phenotype-org-audits` (audits) or stays in the monorepo (canonical).
- Spine repos (PhenoHandbook, PhenoSpecs, phenotype-registry) are **lightly used** per ADR-023 and unaffected by this ADR.
