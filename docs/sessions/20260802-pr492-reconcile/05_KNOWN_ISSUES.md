# Known Issues

| Severity | Issue                                                                                                     | Disposition                             |
| -------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| high     | PR smoke still needs packaged `.app` launch coverage                                                      | deferred heavy-lift design              |
| high     | qgate run `30768053229` failed after a 44-minute quality run; local logs unavailable because disk is full | infrastructure/quality follow-up        |
| medium   | local proxy-registry and batch tests cannot create temp DBs (`ENOSPC`)                                    | rerun on a host with free space         |
| medium   | desktop TypeScript check lacks `electrobun` dependency in this worktree                                   | install dependencies on validation host |
| low      | Mergify review-team config is invalid on the organization                                                 | external governance fix, not this PR    |

## Reconciliation status

- **Integration state:** `93c5e5973b` reconciles against live base `f7709a87ab`.
- **Validation:** 11 checks passed; 39 SQLite-driver checks remain blocked by the host environment.
- **Preservation:** Airlock `wip/20260803T0636-18c83820dca03348`; no PR push or merge performed.
