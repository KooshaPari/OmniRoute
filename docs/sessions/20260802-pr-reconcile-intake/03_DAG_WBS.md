# DAG and WBS

```text
existing intake diff --> focused unit tests --> safety gates/pagination
         |                                      |
         +--> GitHub adapter split --> rebase onto current main --> Airlock snapshot
```

| ID | Work item | Status | Evidence |
|---|---|---|---|
| R1 | Inspect existing runtime diff | done | bounded source/test intake slice |
| R2 | Run focused intake tests | done | 19/19 pass |
| R3 | Preserve WIP commit | done | docs-only head `bbcd8e51a6` atop rebased runtime; no feature merge or dispatch |
| R4 | Split `cli.ts` below 350 lines | done | `d3b3e06383`; `cli.ts` 283 lines, `github.ts` 272 lines |
| R5 | Rebase onto current `origin/main` | done | `origin/main=92fafe865c`; no conflicts |
| R6 | Airlock snapshot | done | `wip/20260802T2147-18c81b4784c52fe8` points to `bbcd8e51a6` |
