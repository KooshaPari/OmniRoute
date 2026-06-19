# phenoShared-niche + phenotype-*-sdk domain shaping

**Date:** 2026-06-19  
**Authority:** phenotype-registry  
**Exemplar:** [ResilienceKit](https://github.com/KooshaPari/ResilienceKit) — domain-first Rust workspace  
**ADR:** [ADR-ECO-014](../adrs/ADR-ECO-014-phenoshared-decompose.md)

## Three layers

| Layer | Example | Holds |
|-------|---------|-------|
| Domain workspace | ResilienceKit, Eventra | SSOT implementations |
| Language SDK index | python-sdk, go-sdk | Optional edges / install surfaces |
| Rust genesis facade | phenotype-rust-sdk | async-traits, macros, generic `Contract` only |

## phenoShared-niche routing (archived)

| Niche crate | Terminal owner |
|-------------|----------------|
| retry, health, policy, state-machine, cache-adapter, http | **ResilienceKit** |
| event-sourcing, event-bus | **Eventra** |
| async-traits, macros, contracts | **phenotype-rust-sdk** |
| test-support | **phenotype-test** |
| nanovms-client | **phenotype-go-sdk** / platform |

**Gate:** `gate-phenoshared-niche` — archived 2026-06-19, 0 production git deps.

## N1 execution (2026-06-19)

| Action | Status |
|--------|--------|
| Org grep `phenoShared-niche` in manifests | **0 production deps** |
| `phenotype-event-sourcing` canonical | **Eventra** `rust/phenotype-event-sourcing` |
| ResilienceKit workspace trim | **ResilienceKit#6** — evict junk-drawer members |
| SDK boundary docs | registry boundary/*.md |

## SDK rules

- **phenotype-rust-sdk:** 3 crates max — reject domain absorption
- **phenotype-python-sdk:** py-sdk-index — packages mirror domain owners
- **phenotype-go-sdk:** platform + gateway edges only
