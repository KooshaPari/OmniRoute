# Wave 6 — logkit canonical + Metron remap closure — 2026-06-17

**Predecessor:** [wave5-execution-2026-06-17.md](./wave5-execution-2026-06-17.md)

## Metron path remap (verified)

| Source | Canonical | Status |
|--------|-----------|--------|
| HexaKit `Metron/` (repo root, not `crates/metron/`) | PhenoObservability `crates/metrickit` | **Closed** — HexaKit [#244](https://github.com/KooshaPari/HexaKit/pull/244) exclude + [#251](https://github.com/KooshaPari/HexaKit/pull/251) stub prune |
| Pyron `Metron/` submodule | `metrickit` git dep → PhenoObservability | Closed Wave 5 [#53](https://github.com/KooshaPari/Pyron/pull/53) |

Mapping: `Metron/` → `metrickit` package (crate name unchanged during absorption).

## Wave 6 PRs

| Repo | PR | Change |
|------|-----|--------|
| PhenoObservability | TBD | Register `crates/logkit` in workspace |
| Pyron | TBD | Repoint `logkit` git dep Logify → PhenoObservability |
| phenotype-registry | TBD | This ledger + disposition/batch3 updates |

## Logify transitional closure

| Before | After |
|--------|-------|
| `logkit` → Logify repo | `logkit` → PhenoObservability `crates/logkit` |

Logify repo remains as historical source; observe-role canonical owner is PhenoObservability per DOMAIN_ROLES.

## Deferred

| Item | Blocker |
|------|---------|
| `stashly` final repoint | Canonical absorption target is phenoShared (ADR-ECO-001); dedicated `phenotype-resilience` repo still 404 — Pyron keeps HexaKit transitional pin |
| HexaKit genesis refresh | Remaining crate evictions |
| Archive delete (Metron/Settly/Traceon trees) | 100% downstream verify + registry retired rows |
