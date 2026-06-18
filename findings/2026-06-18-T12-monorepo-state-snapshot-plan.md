# `phenotype-monorepo-state` deletion — schedule + snapshot plan (T12, Decision C)

**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**Plan version:** v1.0
**Refs:**
- ADR-033 (phenotype-monorepo-state deletion plan)
- ADR-034 (monorepo-state deletion schedule)
- AGENTS.md § "Decision C"

---

## Investigation findings

### `phenotype-monorepo-state` (the to-delete repo)

| Property | Value |
|---|---|
| Location | `github.com/KooshaPari/phenotype-monorepo-state` (created 2026-06-18 03:52 UTC) |
| Purpose | Ad-hoc governance snapshot taken during wrap-up session |
| Content | 4 governance-snapshot commits (cherry-picked from local monorepo) |
| Branches | Single branch (likely `main`) |
| Commits | 4 (small snapshot) |
| Status | Should NOT exist going forward (per Decision C) |

## Migration plan (T12.1-T12.6, 6 sub-tasks, ~30 min)

| # | Task | Where | Action |
|---|---|---|---|
| 12.1 | Author `findings/2026-06-18-L8-008-phenotype-monorepo-state-snapshot.md` | local monorepo | (this file) |
| 12.2 | Clone phenotype-monorepo-state locally | local `/tmp` | `git clone https://github.com/KooshaPari/phenotype-monorepo-state.git /tmp/pms` |
| 12.3 | Inspect 4 commits, extract their content (commits + diffs) | `/tmp/pms` | `git log -p --all 2>&1 \| head -200` |
| 12.4 | Compare extracted content to local monorepo's `archive/2026-06-15-30-pillar-fleet` | local monorepo | `git diff archive/2026-06-15-30-pillar-fleet..origin/main /tmp/pms` |
| 12.5 | If content is unique, copy into local `archive/2026-06-15-30-pillar-fleet/imports/2026-06-18-phenotype-monorepo-state/` | local monorepo | `mkdir -p archive/.../imports/2026-06-18-phenotype-monorepo-state/ && cp -r /tmp/pms/* archive/.../imports/2026-06-18-phenotype-monorepo-state/` |
| 12.6 | If content is a subset (already in local), document as `LAST_RESORT_EXCEPTION` and proceed to deletion | local monorepo + ADR-034 | (delete per schedule) |

## Deletion schedule (per ADR-034)

| Date | Action |
|---|---|
| 2026-06-17 (today) | ADR-033 + ADR-034 accepted |
| 2026-06-18 | T12.1-T12.6 executed (this file + content migration) |
| 2026-06-19 to 2026-06-30 | 12-day grace period (announce to any potential consumers) |
| 2026-07-01 | `gh repo delete KooshaPari/phenotype-monorepo-state` (after final snapshot at `archive/2026-07-01-phenotype-monorepo-state-snapshot/`) |
| 2026-07-01 to 2026-09-30 | 90-day GitHub retention; backup at `findings/2026-07-01-phenotype-monorepo-state-final-snapshot.md` |
| 2026-09-30 | Full deletion confirmed; ADR-033 closed |

## Open questions

1. **Are the 4 governance-snapshot commits unique, or are they already in the local monorepo?**
   - **Plan:** T12.4 will answer this. If unique, copy. If duplicate, mark as `LAST_RESORT_EXCEPTION` and proceed to deletion.
2. **Does `phenotype-monorepo-state` have any other branches (besides main)?**
   - **Plan:** T12.3 will enumerate. Currently expected: 1 branch (main, 4 commits).
3. **Does any other repo (KP or external) reference `phenotype-monorepo-state`?**
   - **Plan:** T12.4 will check (via `gh search code`). Expected: 0 references.
4. **What about GitHub's 90-day retention policy?**
   - **Plan:** Pre-delete snapshot at `archive/2026-07-01-phenotype-monorepo-state-snapshot/` covers the content for archival purposes. After 90 days (2026-09-30), the GitHub tombstone is fully gone.

## Cross-references

- AGENTS.md § "Decision C"
- ADR-033 (deletion plan)
- ADR-034 (deletion schedule)
- `findings/2026-06-17-L5-108-phenotype-monorepo-state-deletion.md` (predecessor decision log)
