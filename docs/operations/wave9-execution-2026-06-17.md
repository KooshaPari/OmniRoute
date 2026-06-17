# Wave 9 — P3 phenoShared wave 2 — 2026-06-17

**Predecessor:** [wave8-execution-2026-06-17.md](./wave8-execution-2026-06-17.md)

## HexaKit P3 wave 2

| Crate | Target | PR |
|-------|--------|-----|
| `phenotype-event-bus` | phenoShared | TBD |
| `phenotype-event-sourcing` | phenoShared | TBD |
| `phenotype-http-client-core` | phenoShared | TBD |

Pattern: workspace `exclude` + `workspace.dependencies` git pin (same as wave 1 #252). Stub trees retained.

## Disposition updates

| Row | Path | FSM |
|-----|------|-----|
| 19 | `crates/phenotype-event-bus` | done |
| 23 | `crates/phenotype-http-client-core` | done (target corrected → phenoShared) |

## P3 backlog (wave 10+)

| Crate | Target | Blocker |
|-------|--------|---------|
| `phenotype-health` | PhenoObservability | PO workspace registration |
| `phenotype-logging`, `phenotype-time`, … | phenoShared | API parity audit vs `phenotype-core` |
| `phenotype-bdd`, `phenotype-test-infra` | phenotype-journeys / python-sdk | TestingKit archived — retarget |
| `phenotype-mcp` | substrate | Wave D |
| `cipher` | Authvault | Wave C |

## Next

1. P3 wave 3 — logging, time, state-machine, policy-engine (phenoShared batch)
2. `phenotype-core` decomposition / git pin (blocked on API diverge)
3. FocalPoint manual absorption
