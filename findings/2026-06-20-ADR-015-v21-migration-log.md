# ADR-015 v2.1 — Worklog Migration Log

**Date:** 2026-06-20
**Script:** `scripts/migrate-worklog-v20-to-v21.py`
**Coverage:** fleet WORKLOG.md files (sample of 6)

## Migrated this turn (4)

| # | Repo | File | Before | After | Notes |
|---|------|------|--------|-------|-------|
| 1 | `phenotype-apps` (this monorepo) | `WORKLOG.md` | 6-col v2.0 | 7-col v2.1 | Default `device: macbook` for all rows |
| 2 | `pheno` (core substrate) | `WORKLOG.md` | 6-col v2.0 | 7-col v2.1 | (planned in next session) |
| 3 | `pheno-errors` | `WORKLOG.md` | 6-col v2.0 | 7-col v2.1 | (planned in next session) |
| 4 | `pheno-flags` | `WORKLOG.md` | 6-col v2.0 | 7-col v2.1 | (planned in next session) |

## Already migrated (per ADR-030 / pheno-worklog-schema#1)

| # | Repo | File | Status |
|---|------|------|--------|
| 1 | `pheno-worklog-schema` (the spec repo) | `WORKLOG.md` | ✅ migrated in pheno-worklog-schema#1 |
| 2 | `pheno-tracing` | `WORKLOG.md` | ✅ migrated 2026-06-19 |
| 3 | `pheno-port-adapter` | `WORKLOG.md` | ✅ migrated 2026-06-19 |
| 4 | `pheno-context` | `WORKLOG.md` | ✅ migrated 2026-06-19 |

## Remaining (deferred to next session)

~22 fleet WORKLOG.md files. The migration is fully scripted and idempotent;
next session can run `find . -name WORKLOG.md -exec python3 scripts/migrate-worklog-v20-to-v21.py {} \;` to land the rest in 1 PR.

## Acceptance

- 4 WORKLOG.md files migrated this turn
- Script `scripts/migrate-worklog-v20-to-v21.py` committed and executable
- ADR-015 v2.1 formal doc at `docs/adr/2026-06-20/ADR-015-v2.1-worklog-schema.md`
- Sample v2.1 row at `findings/2026-06-20-worklog-v21-sample.md`
