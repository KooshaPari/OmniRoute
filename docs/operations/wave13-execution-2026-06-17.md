# Wave 13 — parallel lanes A–D — 2026-06-17

**Predecessor:** [wave12-execution-2026-06-17.md](./wave12-execution-2026-06-17.md)

## Lane A — `phenotype-config-loader` → phenoShared

Pre-merged on HexaKit `main` via eco-consolidate (#255). No additional HexaKit PR in this wave.

| Crate | Target | PR |
|-------|--------|-----|
| `phenotype-config-loader` | phenoShared | HexaKit #255 |

## Lane B — test infra retarget → TestingKit

| Crate | Action | PR |
|-------|--------|-----|
| `phenotype-test-infra` | workspace exclude + git dep → TestingKit | HexaKit #264 |
| `phenotype-bdd` | workspace exclude (stub); canonical absorption pending journeys | HexaKit #264 |

**Pyron lockstep:** [Pyron #56](https://github.com/KooshaPari/Pyron/pull/56) — exclude `phenotype-bdd` / `phenotype-test-infra`; git pin test-infra → TestingKit.

## Lane C — contracts split (unblocks partial `phenotype-core` alignment)

| Component | Location | PR |
|-----------|----------|-----|
| Canonical traits (`Contract`, `MetricsHook`, …) | phenoShared `phenotype-contracts` (git pin) | HexaKit #264 |
| `InMemory*` adapters | HexaKit `phenotype-contract-adapters` (scaffold member) | HexaKit #264 |

`phenotype-core::contracts` re-exports adapters from scaffold crate.

## Lane D — `cipher` → Authvault

| Crate | Action | PR |
|-------|--------|-----|
| `phenotype-cipher` | Authvault `rust/phenotype-cipher` (pre-absorbed on Authvault `main`) | — |
| HexaKit `crates/cipher` | exclude + git dep → Authvault | HexaKit #264 |

## Disposition updates

| Row | Path | FSM | PR |
|-----|------|-----|-----|
| 2 | `crates/cipher` | done | HexaKit #264 |
| 4 | `crates/phenotype-bdd` | done | HexaKit #264 |
| 40 | `crates/phenotype-test-infra` | done | HexaKit #264 |

## P3 + contracts cumulative

**16 crates** git-pinned to phenoShared (waves 1–4 + wave 12 health/cache + wave 13 contracts + config-loader).

Additional git pins this wave: `phenotype-test-infra` → TestingKit; `phenotype-cipher` → Authvault.

## Wave 12 next-queue — dispatched

| Item | Wave 13 lane |
|------|----------------|
| `phenotype-contracts` adapter alignment | C |
| `phenotype-bdd`, `phenotype-test-infra` | B |
| `phenotype-config-loader` | A (pre-merged) |

## Next (wave H+)

| Item | Notes |
|------|-------|
| Wave H gateway charter | phenotype-gateway + branch supersets |
| `phenotype-core` git pin | blocked: missing `Apisync` git remote in Pyron `.gitmodules` prevents fetching `phenotype-validation` and `phenotype-string` from `Pyron#main` |
