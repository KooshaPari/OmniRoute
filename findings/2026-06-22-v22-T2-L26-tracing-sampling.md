# v22 T2 L26 Tracing Sampling + Cardinality Cap

**Date:** 2026-06-22
**Pillar:** L26 (Tracing quality — sampling + cardinality)
**Status:** v22 Wave A track 2 of 5

## Sampling policies

| Tier | Strategy | Sample rate | Use case |
|------|----------|------------:|----------|
| Errors | AlwaysOn | 100% | All 5xx and 4xx (auth) |
| Slow | AlwaysOn | 100% | p99 > 500ms |
| Default | ParentBased(TraceIdRatioBased(0.1)) | 10% | Normal traffic |
| Health | AlwaysOff | 0% | /healthz, /metrics, /readyz |
| Dev | AlwaysOn | 100% | `RUST_LOG=trace` only |

## Cardinality cap

10,000 unique label combinations per metric per exporter. When exceeded:
- LRU eviction of oldest series
- Metric `otel_exporter_evicted_series_total` increments
- WARN log emitted with metric name + evicted key count

## Acceptance criteria

- [x] 5 sampling tiers
- [x] 10k cardinality cap with LRU eviction
- [x] Health endpoint exclusion
- [x] Parent-based for distributed context
- [x] Documented in `pheno-tracing/src/sampling.rs`
