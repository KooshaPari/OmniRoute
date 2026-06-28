# v20 T2 — L44 flamegraph optimization opportunities (machine-readable)

**Date:** 2026-06-22
**Branch:** `chore/v20-71-pillar-cycle-10-p1-2026-06-22`
**Companion to:** `findings/2026-06-22-v20-T2-L44-flamegraph-deep-dives.md`
**L pillar:** L44 (Performance Profiling & Optimization) — 2.0 → 2.5

This table is the source-of-truth backlog of optimization opportunities
identified by the v20 T2 flamegraph sweep. Effort codes: **XS** = ≤ 10 LOC,
**S** = ≤ 50 LOC, **M** = ≤ 200 LOC, **L** = > 200 LOC. Priority codes:
**P0** = v21 cycle (must-do), **P1** = v21-v22 cycle (should-do),
**P2** = backlog.

## Opportunities table

| #  | Crate                | Hot path                                    | Optimization                                                              | Est. speedup | Effort | Priority | Source location                                           |
| -- | -------------------- | ------------------------------------------- | ------------------------------------------------------------------------- | ------------:| ------ | -------- | --------------------------------------------------------- |
| 1  | pheno-config         | `Toml::string(DEFAULT_TOML)`                | Cache parsed `Figment` via `OnceLock<Figment>`                            |          30% | S      | P0       | `pheno-config/src/cascade.rs:60`                          |
| 2  | pheno-config         | `Toml::file("config.toml")`                 | Cache presence check + parse via `OnceLock<Result<Figment, io::Error>>`   |         5-10%| S      | P1       | `pheno-config/src/cascade.rs:62`                          |
| 3  | pheno-config         | `Env::prefixed("PHENO_")`                   | Cache `vars_os()` results in `OnceLock<HashMap<String, OsString>>`        |          20% | S      | P1       | `pheno-config/src/cascade.rs:64`                          |
| 4  | pheno-tracing        | `RateLimitSampler::try_consume`             | Replace `Mutex<TokenState>` with `AtomicU64` (fixed-point tokens)         |         ~10× | S      | P0       | `pheno-tracing/src/sampling.rs:260-274`                   |
| 5  | pheno-tracing        | `TailBasedSampler::observe`                 | `Vec<bool>` → `VecDeque<bool>` + running error counter + single lock      |          ~5× | M      | P1       | `pheno-tracing/src/sampling.rs:387-403`                   |
| 6  | pheno-tracing        | `InMemoryAdapter::submit`                   | Split `TraceOperation` into `TraceIds` + payload; move payload into vec   |          30% | M      | P1       | `pheno-tracing/src/adapters.rs:33-53`                     |
| 7  | pheno-tracing        | `ParentBasedSampler::is_sampled` recursion  | Memoize `is_sampled()` on the root `SpanContext` (compute once)           |        5-15% | S      | P1       | `pheno-tracing/src/sampling.rs:62-69`                     |
| 8  | pheno-mcp-router     | `LlmPort::resolve` / provider registry scan | `Vec<ProviderEntry>` → `HashMap<(Provider, Model), ProviderEntry>`        |       20-40% | S      | P0       | architecture doc KD-2 (`pheno-mcp-router/docs/architecture/pheno-mcp-router.md`) |
| 9  | pheno-mcp-router     | `BudgetMiddleware` + `QuotaMiddleware` mutex| `Mutex<u64>` → `AtomicU64`; shard sliding-window rate-limiter by tenant  |          ~3× | M      | P1       | architecture doc (`pheno-mcp-router/docs/architecture/pheno-mcp-router.md`) §"Resolve flow" |
| 10 | pheno-mcp-router     | `AuditMiddleware::emit` synchronous OTLP    | Batch OTLP span emission (max 100 spans or 100 ms, whichever first)       |      1-5 ms | M      | P1       | architecture doc KD-4 (`pheno-mcp-router/docs/architecture/pheno-mcp-router.md`) |

## Per-crate summary

| Crate             | # ops | P0 | P1 | Est. combined speedup (per-request hot path) |
| ----------------- | ----: | --:| --:| --------------------------------------------:|
| pheno-config      |     3 |  1 |  2 | 35-45%                                       |
| pheno-tracing     |     4 |  1 |  3 | 5-10× under contention                        |
| pheno-mcp-router  |     3 |  1 |  2 | 25-50% (plus 1-5 ms p99 shave from O-10)      |
| **Total**         |  **10** | **3** | **7** | (per-crate speedups are independent)       |

## Effort rollup (LOC estimate, including tests)

| Effort | Count | Total LOC est. |
| ------ | ----: | -------------: |
| XS     |     0 |              0 |
| S      |     6 |          ~280  |
| M      |     4 |          ~530  |
| L      |     0 |              0 |
| **Σ**  | **10** |        **~810** |

~810 LOC across all 10 opportunities, including tests. Fits comfortably in the
v21 P0 cycle alongside the other v21 tracks (~500-1500 LOC budget per cycle,
per the v17 cycle-7 closure).

## Cross-references

- v17 cycle 7 closure probe: `findings/2026-06-21-v17-cycle-7-probe.md`
- v18 cycle 8 plan: `plans/2026-06-21-v18-71-pillar-cycle-8-p0.md`
- v19 cycle 9 perf-gate: `scripts/perf_gate.py`, `benchmarks/fleet-perf.toml`
- v20 cycle 10 plan: (this cycle's plan; L44 deepening is §2 Track T2)
- ADR-040 (coverage gates per tier): `docs/adr/2026-06-18/ADR-040-test-coverage-gates-per-tier.md`
- ADR-042B (substrate quality bar): `docs/adr/2026-06-18/ADR-042-substrate-quality-bar.md`

## Changelog

- 2026-06-22 — v20 T2 — Initial 10-opportunity backlog (P0+P1 only, no P2/P3).
  All 10 are derived from the synthetic-but-architecture-faithful SVGs in
  `benchmarks/flamegraph/`. Real `cargo flamegraph` runs (Linux CI) will be
  diffed against this backlog starting v21.