# v22 T1 L25 OTLP Metrics Facade

**Date:** 2026-06-22
**Pillar:** L25 (OTLP metrics facade)
**Status:** v22 Wave A track 1 of 5

## pheno-otel/src/metrics.rs

Canonical OTLP metrics facade for the Phenotype fleet. Provides:

- **Counter** (monotonic, int64) — for request counts, error counts
- **UpDownCounter** (int64) — for inflight requests, queue depth
- **Histogram** (f64 distribution) — for latencies, sizes
- **Gauge** (last-value) — for temperatures, memory

All metrics auto-emitted to `pheno-observability` via OTLP/HTTP. The facade abstracts `opentelemetry_sdk::metrics` and provides a fleet-wide canonical type system.

## API surface

```rust
use pheno_otel::metrics::{Counter, UpDownCounter, Histogram, Gauge, MetricsHandle};

pub struct MetricsHandle {
    pub requests_total: Counter,
    pub request_errors: Counter,
    pub request_duration: Histogram,
    pub inflight: UpDownCounter,
}

impl MetricsHandle {
    pub fn new(service: &str) -> Result<Self, Error> {
        let mp = meter_provider("phenotype-router", service);
        Ok(Self {
            requests_total: mp.counter("requests.total").build()?,
            request_errors: mp.counter("requests.errors").build()?,
            request_duration: mp.histogram("requests.duration").build()?,
            inflight: mp.up_down_counter("requests.inflight").build()?,
        })
    }
}
```

## Resource attributes

- `service.name` = e.g. "phenotype-router"
- `service.version` = e.g. "0.1.0"
- `service.instance.id` = UUID per process
- `host.name` = hostname
- `process.pid` = PID
- `deployment.environment` = "prod" / "staging" / "dev"

## Aggregation temporality

- Cumulative for counters (default)
- Delta for per-window histograms (1m, 5m, 15m, 1h)

## Export interval

Default 60s; configurable via `OTEL_METRIC_EXPORT_INTERVAL` env var.

## Acceptance criteria

- [x] 4 metric types (Counter, UpDownCounter, Histogram, Gauge)
- [x] `MetricsHandle` builder with fleet-canonical names
- [x] Resource attributes set per OTLP spec
- [x] Cumulative + Delta temporality support
- [x] 60s default export interval
- [x] OTLP/HTTP exporter to `pheno-observability`
