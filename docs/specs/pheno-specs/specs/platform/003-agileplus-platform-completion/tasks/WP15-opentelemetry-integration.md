---
work_package_id: WP15
title: OpenTelemetry Integration
lane: "done"
dependencies: []
base_branch: main
base_commit: e4f4052878f43cc3537b8da83b9e70a83a641a14
created_at: '2026-03-02T12:16:22.394755+00:00'
subtasks: [T090, T091, T092, T093, T094]
shell_pid: "36756"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

# WP15: OpenTelemetry Integration

Implementation command: `spec-kitty implement WP15 --base WP03`

## Objective

Extend `crates/agileplus-telemetry` with OpenTelemetry OTLP traces, metrics, and axum middleware for comprehensive observability.

## Subtasks

### T090: OTLP Exporter Setup

Add the following dependencies to `crates/agileplus-telemetry/Cargo.toml`:

```toml
opentelemetry = "0.28"
opentelemetry-otlp = { version = "0.31", features = ["http-proto"] }
opentelemetry-sdk = "0.28"
```

Create an `init_tracer()` function that:
- Reads `OTEL_EXPORTER_OTLP_ENDPOINT` from environment (default: `http://localhost:4317`)
- Creates an HTTP binary protocol exporter targeting the endpoint
- Builds a `TracerProvider` with a batch span exporter
- Sets the global tracer provider using `global::set_tracer_provider()`

### T091: tracing-opentelemetry Integration

Add `tracing-opentelemetry = "0.21"` to Cargo.toml.

Create a composable tracing subscriber layer:

```rust
pub fn telemetry_layer<S>() -> impl Layer<S>
where
    S: Subscriber + for<'a> LookupSpan<'a>,
{
    let tracer = global::tracer("agileplus");
    tracing_opentelemetry::layer().with_tracer(tracer)
}
```

Compose this layer with the existing `fmt` layer in the subscriber initialization code. The layer should be added before or after the fmt layer depending on the layering strategy.

### T092: axum Middleware

Add `axum-tracing-opentelemetry = "0.21"` to `crates/agileplus-api/Cargo.toml`.

In `crates/agileplus-api/src/main.rs`, update the router setup:

```rust
let app = Router::new()
    .route(...)
    .layer(opentelemetry_tracing_layer());
```

This middleware automatically:
- Propagates trace context on incoming HTTP requests (via W3C Trace Context headers)
- Injects trace context on outgoing HTTP requests
- Creates a span for each request

### T093: Custom Metrics

Create a `metrics` module in `crates/agileplus-telemetry/src/metrics.rs` that exposes:

- **events_processed** (counter): total events appended to the event store
- **sync_duration_ms** (histogram): duration in milliseconds for sync operations
- **cache_hit_rate** (gauge): cache hit/miss ratio (0.0 to 1.0)
- **api_request_duration_ms** (histogram): API request latency in milliseconds
- **active_features** (gauge): count of non-terminal features

Use the OpenTelemetry meter API to create instruments:

```rust
pub mod metrics {
    use opentelemetry::metrics::Meter;

    pub fn init_metrics(meter: &Meter) {
        let _ = meter.u64_counter("events_processed").init();
        let _ = meter.f64_histogram("sync_duration_ms").init();
        let _ = meter.f64_gauge("cache_hit_rate").init();
        let _ = meter.f64_histogram("api_request_duration_ms").init();
        let _ = meter.u64_gauge("active_features").init();
    }
}
```

### T094: Structured JSON Logs

Update the tracing subscriber configuration in `crates/agileplus-api/src/telemetry.rs` to use JSON output:

```rust
let subscriber = tracing_subscriber::fmt::layer()
    .json()
    .with_target(true)
    .with_span_events(FmtSpan::CLOSE)
    .with_current_span(true)
    .with_subscriber(...);
```

Ensure that:
- Log output is valid JSON, one record per line
- Each log entry includes `target` field (module path)
- Span lifecycle events (creation, close) are recorded
- `trace_id` and `span_id` are included in output for correlation with traces

## Definition of Done

- [ ] Traces export to configured OTLP endpoint with correct span structure
- [ ] Custom metrics (counter, gauge, histogram) record valid values
- [ ] JSON logs include `trace_id` and `span_id` for correlation
- [ ] Health check endpoint includes telemetry subsystem status
- [ ] Documentation: how to configure OTEL_EXPORTER_OTLP_ENDPOINT and view traces
- [ ] All tests pass with telemetry layer enabled

## Activity Log

- 2026-03-02T12:16:22Z – claude-opus – shell_pid=36756 – lane=doing – Assigned agent via workflow command
- 2026-03-02T12:39:14Z – claude-opus – shell_pid=36756 – lane=for_review – Ready for review: OpenTelemetry OTLP traces, custom metrics, axum middleware, JSON structured logs (24 tests)
- 2026-03-02T23:19:38Z – claude-opus – shell_pid=36756 – lane=done – Merged to main, 516 tests passing
