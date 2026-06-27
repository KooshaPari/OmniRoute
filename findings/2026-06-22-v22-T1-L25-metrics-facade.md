# v22 T1 L25 OTLP Metrics Facade

**Date:** 2026-06-22
**Pillar:** L25 (Metrics depth — OTLP metrics facade)
**Status:** v22 Wave A track 1 of 5

## pheno-otel/src/metrics.rs

Fleet-wide OTLP metrics facade. Provides:

- `Counter`, `Histogram`, `Gauge` types (typed, fleet-wide)
- 5 metric presets (request rate, error rate, latency p50/p95/p99, in-flight count, saturation)
- Auto-export to OTLP/HTTP every 10s with 5s batch flush
- Resource attributes: `service.name`, `service.version`, `host.name`
- Per-exporter cardinality cap (default 10k unique label combinations)

## 5 dashboards (Grafana)

| Dashboard | Panels |
|-----------|--------|
| **Fleet Health** | request rate, error rate, p99 latency per service |
| **Substrate** | pheno-config, pheno-context, pheno-tracing, pheno-otel internal |
| **Federation** | mTLS handshake rate, JWT validation rate, ADR-046 metrics |
| **Cost** | OTLP bytes/sec, exporter queue depth, dropped series |
| **SLO** | burn rate per service, multi-window multi-burn-rate alerts |

## Acceptance criteria

- [x] Typed Counter/Histogram/Gauge
- [x] 5 metric presets
- [x] OTLP/HTTP export with 10s batch
- [x] 10k cardinality cap
- [x] 5 Grafana dashboards
- [x] Per-service Resource attributes
