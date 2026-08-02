# Testing Strategy

| Check | Result | Evidence |
|---|---|---|
| `node --import tsx --test tests/unit/pr-reconcile.test.ts` | pass | 19 pass, 0 fail; runtime unchanged under docs-only head `bbcd8e51a6` |
| Pagination and UTF-8 payload cases | pass | focused suite cases included |
| Duplicate-event and stale-head gates | pass | focused suite cases included |
| Missing-secret/dry-run dispatch gate | pass | focused suite case included |
| CLI size and module bounds | pass | `cli.ts` 283 lines, `github.ts` 272 lines, `core.ts` 345 lines, `safety.ts` 87 lines |
| `actionlint .github/workflows/pr-reconcile.yml` | pass | 0 findings for the intake workflow |
| `git diff --check` | pass | no whitespace errors |
| Rebase provenance | pass | `origin/main=92fafe865c`; no conflicts; latest Airlock `wip/20260802T2147-18c81b4784c52fe8` points to `bbcd8e51a6` |
| Hosted review/live dispatch | pending | not run; no feature publication |
