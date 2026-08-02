# Testing Strategy

| Check | Result | Evidence |
|---|---|---|
| `node --import tsx --test tests/unit/pr-reconcile.test.ts` | pass | 19 pass, 0 fail at rebased HEAD `9eea133228` |
| Pagination and UTF-8 payload cases | pass | focused suite cases included |
| Duplicate-event and stale-head gates | pass | focused suite cases included |
| Missing-secret/dry-run dispatch gate | pass | focused suite case included |
| CLI size and module bounds | pass | `cli.ts` 283 lines, `github.ts` 272 lines, `core.ts` 345 lines, `safety.ts` 87 lines |
| `actionlint .github/workflows/pr-reconcile.yml` | pass | 0 findings for the intake workflow |
| `git diff --check` | pass | no whitespace errors |
| Rebase provenance | pass | `origin/main=92fafe865c`; no conflicts; Airlock `wip/20260802T0944-18c7f3cd823b3ea8` |
| Hosted review/live dispatch | pending | not run; no feature publication |
