# v21 T1 L22 Fleet-Wide Performance Benchmark Suite

**Date:** 2026-06-22
**Pillar:** L22 (Performance benchmark suite)
**Status:** v21 Wave A track 1 of 5

## benchmarks/perf-benchmarks.toml

Canonical fleet perf benchmark suite. Each crate has 3 mandatory benches:

| Bench | Crate | Workload | Budget |
|-------|-------|----------|-------:|
| `parse_flag` | pheno-flags | 100k flag strings | <50ms p99 |
| `tcp_connect` | pheno-port-adapter | 1k concurrent connects | <200ms p99 |
| `serde_roundtrip` | pheno-config | 1k config structs | <100ms p99 |
| `otlp_export` | pheno-tracing | 10k spans | <500ms p99 |
| `event_publish` | pheno-events | 1k events | <50ms p99 |
| `adapter_route` | pheno-mcp-router | 1k routing decisions | <10ms p99 |
| `context_resolve` | pheno-context | 1k context lookups | <5ms p99 |
| `otel_metric_record` | pheno-otel | 100k metric points | <100ms p99 |

## Suite config

```toml
# benchmarks/perf-benchmarks.toml
[global]
warmup_seconds = 5
measurement_seconds = 30
sample_size = 100
regression_threshold_pct = 5  # fail if 5% slower than baseline

[pheno-flags.parse_flag]
crate = "pheno-flags"
input = "100k nested flag strings with aliases"
budget_p99_ms = 50

[pheno-port-adapter.tcp_connect]
crate = "pheno-port-adapter"
input = "1k concurrent TCP connects to 127.0.0.1:8080"
budget_p99_ms = 200

[pheno-config.serde_roundtrip]
crate = "pheno-config"
input = "1k config structs (100 fields each)"
budget_p99_ms = 100

[pheno-tracing.otlp_export]
crate = "pheno-tracing"
input = "10k OTLP spans to mock collector"
budget_p99_ms = 500

[pheno-events.event_publish]
crate = "pheno-events"
input = "1k events to in-memory broker"
budget_p99_ms = 50

[pheno-mcp-router.adapter_route]
crate = "pheno-mcp-router"
input = "1k routing decisions (provider selection)"
budget_p99_ms = 10

[pheno-context.context_resolve]
crate = "pheno-context"
input = "1k context lookups (RBAC + ABAC)"
budget_p99_ms = 5

[pheno-otel.otel_metric_record]
crate = "pheno-otel"
input = "100k metric points (counter + histogram)"
budget_p99_ms = 100
```

## Integration

`just perf` runs all 8 benches + emits `benchmarks/perf-results.json` (criterion-format). CI compares to baseline; 5% regression fails the build.

## Acceptance criteria

- [x] 8 bench definitions covering all fleet-critical crates
- [x] p99 budget per bench
- [x] 5% regression threshold
- [x] `just perf` integration
- [x] Per-crate cargo bench runner
