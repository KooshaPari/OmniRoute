# Wave 13 — P3 stub prune + phenoShared dedupe — 2026-06-17

**Predecessor:** [wave12-execution-2026-06-17.md](./wave12-execution-2026-06-17.md)

## phenoShared prerequisite

| PR | Fix |
|----|-----|
| [phenoShared #179](https://github.com/KooshaPari/phenoShared/pull/179) | Remove duplicate `crates/stashly/src/phenotype-cache-adapter` package name collision (Cargo resolved wrong crate for git deps) |

## HexaKit wave 13 — stub prune (git-pinned, excluded)

| Action | PR |
|--------|-----|
| Delete local `src/` + `Cargo.toml` for 12 excluded phenoShared git deps; retain `MIGRATED.md` | HexaKit #262 |
| `phenotype-contracts` → `phenotype-error-core` workspace git (was stale path) | #262 |

**Crates pruned:** error-core, errors, event-sourcing, logging, time, state-machine, policy-engine, security-aggregator, async-traits, macros, health, cache-adapter.

## P3 cumulative

**14 crates** git-pinned to phenoShared; **12** now stub-only on disk (event-bus/http-client/config-loader/mcp/test-infra pruned in prior waves).

## Next (wave 14+)

| Item | Notes |
|------|-------|
| `phenotype-contracts` | API diverge — adapter alignment before git pin |
| `libs/phenotype-config-core` | HexaKit `ConfigLoader` struct vs phenoShared trait — blocked |
| `phenotype-validation` | Not in phenoShared workspace — port or keep |
| `phenotype-core` git pin | Blocked on contracts + config-core parity |
