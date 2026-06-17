# Wave 12 — phenotype-health + cache-adapter — 2026-06-17

**Predecessor:** [wave11-execution-2026-06-17.md](./wave11-execution-2026-06-17.md)

## HexaKit wave 12 (traits lane → phenoShared)

| Crate | Target | PR |
|-------|--------|-----|
| `phenotype-health` | phenoShared (traits) | TBD |
| `phenotype-cache-adapter` | phenoShared | TBD |

**Boundary note:** PhenoObservability `rust/phenotype-health*` (axum/cli/runtime) is a **runtime superset** on a different trait surface (`HealthCheck` / `HealthRegistry`). HexaKit consumers use phenoShared traits (`HealthChecker` / `HealthMonitor`); PO absorption is runtime-only and already in PO workspace.

## Disposition updates

| Row | Path | FSM |
|-----|------|-----|
| 22 | `crates/phenotype-health` | done (traits → phenoShared; PO runtime separate) |

## P3 + health cumulative

**14 crates** git-pinned to phenoShared (waves 1–4 + wave 12 health/cache).

## Next (wave 13+)

| Item | Notes |
|------|-------|
| `phenotype-contracts` | API diverge — adapter alignment |
| `phenotype-bdd`, `phenotype-test-infra` | Retarget → phenotype-journeys |
| `phenotype-retry`, `phenotype-validation`, … | phenoShared batch 5 |
| `phenotype-core` git pin | Still blocked on contracts + partial re-exports |
