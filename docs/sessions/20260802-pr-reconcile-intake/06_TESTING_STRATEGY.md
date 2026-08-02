# Testing Strategy

| Check | Result | Evidence |
|---|---|---|
| `node --import tsx/esm --test tests/unit/pr-reconcile.test.ts` | pass | 19 pass, 0 fail |
| Pagination and UTF-8 payload cases | pass | focused suite cases included |
| Duplicate-event and stale-head gates | pass | focused suite cases included |
| Missing-secret/dry-run dispatch gate | pass | focused suite case included |
| CLI size | follow-up | 538 lines; decomposition required |
| Hosted review/live dispatch | pending | not run; no feature publication |
