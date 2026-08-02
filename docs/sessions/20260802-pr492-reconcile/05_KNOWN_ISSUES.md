# Known Issues

| Severity | Issue                                                                                                     | Disposition                             |
| -------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| high     | PR smoke still needs packaged `.app` launch coverage                                                      | deferred heavy-lift design              |
| high     | qgate run `30768053229` failed after a 44-minute quality run; local logs unavailable because disk is full | infrastructure/quality follow-up        |
| medium   | local proxy-registry and batch tests cannot create temp DBs (`ENOSPC`)                                    | rerun on a host with free space         |
| medium   | desktop TypeScript check lacks `electrobun` dependency in this worktree                                   | install dependencies on validation host |
| low      | Mergify review-team config is invalid on the organization                                                 | external governance fix, not this PR    |
