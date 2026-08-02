# DAG and WBS

```text
existing intake diff --> focused unit tests --> WIP commit --> Airlock snapshot
         |
         +--> 538-line CLI --> split into collection/dispatch adapters (follow-up)
```

| ID | Work item | Status | Evidence |
|---|---|---|---|
| R1 | Inspect existing runtime diff | done | four source/test files only |
| R2 | Run focused intake tests | done | 19/19 pass |
| R3 | Preserve WIP commit | done | `796c25f325`; no feature merge or dispatch |
| R4 | Split `cli.ts` below 350 lines | follow-up | required before production promotion |
| R5 | Airlock snapshot | done | `wip/20260802T0826-18c7ef8f8ac81830` |
