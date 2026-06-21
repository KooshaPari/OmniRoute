# v16 T3 (L13) — Per-Operation Latency Budgets in CI

**Date:** 2026-06-21
**Pillar:** L13 — Per-Operation Latency Budgets
**Branch:** `chore/v16-71-pillar-cycle-6-p0-2026-06-21`
**Scope:** Fleet-wide latency budgets (Rust + Go + Python) with CI enforcement

## Methodology

For each fleet crate, identify the top-3 critical-path operations and assign a p99 latency budget based on:

- **Empirical baseline:** criterion/pytest-benchmark p99 from cycle 5 perf-baseline
- **Domain context:** interactive (≤50ms), control-plane (≤200ms), data-plane (≤500ms), batch (≤5000ms)
- **SLO margin:** budget = baseline × 1.5 (50% headroom for cycle 6)

## Per-crate budget table

| Crate | Operation | Class | p99 budget | Source |
|---|---|---|---:|---|
| `pheno-flags` | `Flag::parse` | control | 5 ms | criterion v15 baseline |
| `pheno-errors` | `Error::wrap` | control | 1 ms | criterion |
| `pheno-port-adapter` | `TcpAdapter::connect` | data | 50 ms | criterion |
| `pheno-port-adapter` | `HttpAdapter::request` | data | 200 ms | criterion |
| `pheno-port-adapter` | `CircuitBreaker::allow` | control | 1 ms | criterion |
| `pheno-config` | `Config::load_toml` | control | 10 ms | criterion |
| `pheno-config` | `Config::cascade_resolve` | control | 5 ms | criterion |
| `pheno-otel` | `OtelExporter::export_spans` | control | 20 ms | criterion |
| `pheno-tracing` | `span!()` | control | 0.1 ms | criterion |
| `phenotype-router` | `Router::decide` | control | 25 ms | criterion (V12-19) |
| `phenotype-router` | `IntelligentRouter::route` | control | 50 ms | criterion (V12-19) |

## CI enforcement

The `perf-gate.yml` workflow (v15 T2) already runs `just bench` on every PR.
L13 adds:

1. **Budget comparison** — read `benchmarks/perf-budgets.toml`, run `just bench`, diff against the budget
2. **Fail-PR rule** — if any op exceeds budget, fail the PR with a comment listing the regressed ops
3. **Allowance window** — 5% of PRs may exceed budget (new instrumentation noise); auto-label the PR with `perf-overshoot`

## perf-budgets.toml (already exists from v15)

```toml
[pheno-flags.parse]
budget_ms = 5.0
class = "control"
baseline_ms = 3.2
sample_size = 1000

[pheno-port-adapter.tcp_connect]
budget_ms = 50.0
class = "data"
baseline_ms = 32.0
sample_size = 500

[pheno-port-adapter.http_request]
budget_ms = 200.0
class = "data"
baseline_ms = 130.0
sample_size = 500

[pheno-port-adapter.circuit_breaker_allow]
budget_ms = 1.0
class = "control"
baseline_ms = 0.6
sample_size = 10000
```

## L13 acceptance criteria

- [x] `perf-budgets.toml` exists at monorepo root
- [x] `perf-gate.yml` workflow runs on PR open + push to main
- [x] CI comment posted on PR if any op exceeds budget
- [x] No manual override path (budgets are normative)

## Related

- v15 T2: `perf-baseline.yml` (the baseline generator)
- v16 T10: budget-aware `perf-gate.yml` (the enforcer)
- ADR-040: 80% lib coverage gate (related, separate pillar)
