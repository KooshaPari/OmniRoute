# Wave 11 — P3 phenoShared wave 4 — 2026-06-17

**Predecessor:** [wave10-execution-2026-06-17.md](./wave10-execution-2026-06-17.md)

## HexaKit P3 wave 4

| Crate | Target | PR |
|-------|--------|-----|
| `phenotype-security-aggregator` | phenoShared | TBD |
| `phenotype-async-traits` | phenoShared | TBD |
| `phenotype-macros` | phenoShared | TBD |

## Deferred (same wave, blocked)

| Crate | Blocker |
|-------|---------|
| `phenotype-contracts` | API diverge vs phenoShared HEAD — `phenotype-core` re-exports `InMemory*` adapters absent from canonical crate |

## P3 cumulative (waves 1–4)

| Wave | Crates |
|------|--------|
| 1 (#252) | error-core, errors |
| 2 (#256) | event-bus, event-sourcing, http-client-core |
| 3 (#258) | logging, time, state-machine, policy-engine |
| 4 | security-aggregator, async-traits, macros |

**12 crates** git-pinned to phenoShared; `phenotype-contracts` + ~17 other phenotype-* members remain in HexaKit workspace.

## Next (wave 12+)

| Item | Notes |
|------|-------|
| `phenotype-health` | PhenoObservability — separate observe lane |
| `phenotype-contracts` | Align HexaKit adapters vs phenoShared or split crate |
| `phenotype-bdd`, `phenotype-test-infra` | Retarget → phenotype-journeys |
| `phenotype-core` git pin | Still blocked on re-export API diverge |
