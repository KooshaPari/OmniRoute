# L5 — Observability (logs / metrics / traces)

## Scope
Structured logging, metrics export, distributed tracing, health endpoints, error reporting, and audit trail across the Phenotype bloc. Owner: forge-003 (perf+ops).

## SOTA 2026
- **Logs**: `tracing` + `tracing-subscriber` with `EnvFilter`, JSON or compact formatter, `tracing-appender` for non-blocking writers, `RUST_LOG` + per-app env override. Log correlation via `tracing::Span` parents + W3C `traceparent`.
- **Metrics**: OpenTelemetry `MeterProvider` (counter / histogram / gauge) → OTLP, OR Prometheus exposition. Histogram buckets matched to SLOs. Exemplars link metrics to traces.
- **Traces**: `tracing-opentelemetry` bridge; W3C trace context propagation; `#[instrument]` on async fns; batch span processor with retry+queue.
- **Health**: `/healthz` (liveness), `/readyz` (readiness), `/startupz` (one-shot) per Kubernetes spec; probe categories; aggregated `HealthReport`.
- **Error reporting**: Sentry SDK (or OTel error events to Honeycomb/HyperDX).
- **Audit trail**: append-only event log (`agileplus-events`) with structured `kind/value` and replay tooling.

## Phenotype state
- AgilePlus: `crates/agileplus-telemetry/Cargo.toml:14-31` — full dep set: `tracing`, `tracing-subscriber` (env-filter, fmt, json), `tracing-appender`, `tracing-opentelemetry` 0.28, `opentelemetry`, `opentelemetry_sdk`, `opentelemetry-otlp`. ✓ for dependency surface.
- AgilePlus: `crates/agileplus-telemetry/src/lib.rs:38-105` — `init_subscriber` env-gated on `OTEL_EXPORTER_OTLP_ENDPOINT` (no network if unset, line 47); HTTP exporter only (`with_http`, `with_endpoint`); `with_simple_exporter` (no batching); falls back to `phenotype_logging::init_tracing_with_default` (line 48). △ (gRPC missing despite config enum declaring it; **no batch span processor**).
- AgilePlus: `crates/agileplus-telemetry/src/config.rs:37-41, 105-120` — `OtlpProtocol::{Grpc, Http}` declared, but `init_subscriber` (lib.rs:60-74) only calls `.with_http()`. ✗ (gRPC path untested).
- AgilePlus: `crates/agileplus-telemetry/src/config.rs:34-202` — full YAML loader with env override (`AGILEPLUS_LOG_LEVEL`, `AGILEPLUS_OTLP_ENDPOINT`), URL validation, sampling ratio. ✓.
- AgilePlus: `crates/agileplus-telemetry/src/logs/mod.rs:18-176` — `LogOutput::{Stdout, File, Both}` (line 19-26), `LogConfig { level, output, include_spans, include_target }`, `init_logging` with `tracing_appender::non_blocking`, `rolling::daily`, JSON layer, span list, `FmtSpan::CLOSE`. ✓.
- AgilePlus: `crates/agileplus-telemetry/src/metrics/mod.rs:27-248` — `MetricsRecorder` (Counters, Histograms, Gauges for `agent_runs`, `review_cycles`, `command_duration_ms`, `sync_duration_ms`, `cache_hit_rate`, `api_request_duration_ms`, `active_features`); `Arc<MetricsRecorder>` + `AgilePlusMetrics` Clone (line 198-247); `MetricSnapshot` for SQLite persistence (line 254-261). ✓.
- AgilePlus: `crates/agileplus-telemetry/src/traces/mod.rs:34-202` — `init_tracer` (HTTP only), `telemetry_layer<S>()` builds `tracing_opentelemetry::layer().with_tracer(tracer)`; `create_command_span` (line 126-135), `create_agent_span` (line 138-145), `create_review_span` (line 148-151); `SpanGuard` RAII records `duration_ms` on drop (line 188-193). ✓.
- AgilePlus: `crates/agileplus-api/src/middleware/otel.rs:12` — `//! use axum::Router;` (module header) — module exists. △ (file content not inspected at line-level; covered in L1).
- AgilePlus: `crates/agileplus-telemetry/src/metrics/mod.rs` — **no Prometheus exporter wired**; metrics are in-process and persisted via `MetricSnapshot` to SQLite. △ (no remote scrape).
- AgilePlus: `crates/agileplus-telemetry/src/metrics/mod.rs:9-13` — uses `Arc<AtomicU64>` + `Ordering::Relaxed` for counters. ✓ for low-overhead.
- AgilePlus: zero `#[instrument]` on business-logic async fns (verified across `crates/`). ✗ (L5 instrumentation hygiene).
- thegent: `crates/thegent-metrics/src/lib.rs` (264 lines) — `Counter`, `Gauge` (presumed), backed by `Arc<Mutex<u64>>` and `DashMap` (declared in `Cargo.toml:18`). Lock-poisoning panics. △ (no Prometheus / OTel exporter).
- thegent: `crates/thegent-offload/src/main.rs:147` — `async fn health_handler(State(state): State<Arc<AppState>>) -> Json<WorkerInfo>` — basic liveness. △ (single endpoint, no `/readyz` distinction, no probe registration).
- thegent: `crates/thegent-offload/src/main.rs:62-202` — no `tracing` `info!` / `instrument` call verified for request lifecycle. ✗.
- thegent: zero `prometheus` / `opentelemetry` / `tracing-opentelemetry` references in thegent crates (only the `tracing` re-export through `thegent-metrics` in transitive deps, not in app code). ✗ (no remote observability backend).
- Tracely: `crates/tracely-core/Cargo.toml:7-39` — optional `opentelemetry` 0.27, `prometheus` 0.13, `metrics` 0.24. △.
- Tracely: `crates/tracely-core/src/lib.rs` — `tracely-core` exports `logging::init_logging` + `tracing::*` + `metrics::*` + `traces::*` per directory listing; helpers `init_tracing_for_test`, `init_tracing_with_default`, `DEFAULT_FILTER` re-exported. ✓ for surface.
- Tracely: `crates/helix-tracing/src/lib.rs:57-127` — `TracingConfig { level, span_events, include_thread_ids, include_thread_names, target }`, `init_tracing` returns `TryInitError`; `build_subscriber` returns `impl Subscriber + Send + Sync`; `TraceContext { trace_id, span_id }` with `uuid::Uuid::new_v4` (line 81-87). △ (no OTel bridge, no propagation helpers).
- Tracely: `crates/pheno-logging-zig/Cargo.toml` and `crates/zerokit/src/` — empty; observability shells not populated. ✗.
- Tracera: `crates/tracera-core/src/observability.rs:1-61` — `init_tracing()` reads `RUST_LOG` via `EnvFilter::try_from_default_env` (line 12); `otlp_endpoint()` checks 5 env vars (`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_COLLECTOR_ENDPOINT`, `OTEL_COLLECTOR_HTTP_ENDPOINT`, `TRACERA_OTLP_ENDPOINT`) (line 21-31); `make_span(envelope_id)` returns `tracera.bus` `info_span!`. △ (no exporter wiring, no metric surface).
- Tracera: `crates/tracera-core/src/health.rs:1-320` — full `HealthCheck` trait, `HealthRegistry` (mutex-guarded `Vec<Arc<dyn HealthCheck>>`), `FnCheck` adapter, `HealthStatus::{Healthy, Degraded, Unhealthy}`, `HealthReport` aggregation with severity fold (line 104-115), three probe types (`Liveness`/`Readiness`/`Startup`), `HealthError::{Failed, Timeout, Panicked}`. ✓ (highest-quality health registry in the bloc; matches K8s spec).
- Tracera (Python): `src/tracertm/api/main.py` — `RequestIdMiddleware` (X-Request-Id propagation, ContextVar). △ (correlation ID only, no structured logger configured in this entrypoint).
- Tracera (Python): `src/tracertm/mlflow_compat.py:15` — `from opentelemetry import trace` — OTel SDK imported for MLflow compatibility path. △.
- Tracera (Python): `pyproject.toml:71, 152, 159, 197` — `prometheus-client>=0.24.1`, `opentelemetry-exporter-prometheus>=0.60b1` declared. △ (deps present, no consumers in `src/`).
- Tracera (Python): zero `tracing`/`opentelemetry-instrumentation-fastapi` middleware mounted in `main.py`. ✗ (deps unused).
- Bloc-wide: zero Sentry SDK / error reporting client (`sentry`, `sentry-tracing`, `sentry-sdk`) found in any Cargo.toml or pyproject.toml. ✗.

## Gaps
1. **AgilePlus gRPC exporter path is dead code** — `OtlpProtocol::Grpc` declared in `config.rs:37-41` but `init_subscriber` (`lib.rs:60-92`) only calls `with_http()`. Either implement gRPC or remove the enum variant. Effort: **S**.
2. **No batch span processor in AgilePlus** — `lib.rs:71-73` uses `with_simple_exporter(exporter)`, which exports synchronously and risks request latency spikes under load. SOTA is `BatchSpanProcessor` (or `BatchConfig`). Effort: **S** (~10 LOC + dep).
3. **AgilePlus has zero `#[instrument]` attributes** across all business crates — distributed traces will be flat at top level, no per-CLI-command or per-async-task spans. Effort: **M** (~30-50 spans).
4. **No metrics scraping endpoint** anywhere in the bloc — `MetricsRecorder` is in-process; `thegent-metrics` has no `GET /metrics` route. Effort: **M** (add `axum`/`prometheus_exporter` to `agileplus-dashboard` or sidecar; add to `thegent-offload`).
5. **thegent-offload: no structured logging on request lifecycle** — `main.rs:159-202` (`execute_handler`, `status_handler`, `run_client`) emits no `info!` / `debug!` events; harder to debug production. Effort: **S** (wrap handlers in `#[instrument]` + structured fields).
6. **Tracely `pheno-logging-zig` + `zerokit` shells empty** — declared in workspace, no source. Either populate or remove. Effort: **M**.
7. **Tracera Python FastAPI: structured logger + OTel middleware not mounted** — `main.py` has only `RequestIdMiddleware`; deps for `prometheus-client` / `opentelemetry` are present but unused. Effort: **S** (`tracing` logger config + `OpenTelemetryMiddleware`).
8. **Tracera Python: `/healthz`/`/readyz` not implemented** despite `crates/tracera-core/src/health.rs` defining the contract. Effort: **S** (FastAPI route forwarding to the Rust binary, OR thin Python port).
9. **No Sentry / error reporting** anywhere — bloc has no centralized error capture path; relies entirely on logs. Effort: **L** (introduce `sentry` crate + Python `sentry-sdk`, configure DSN via env, wire to unhandled-error hooks).
10. **No `agileplus-events` audit trail integration in observability** — events crate exists in the workspace (`crates/agileplus-events/`) but no `metrics`/`trace` link in `agileplus-telemetry` emits audit events. Effort: **M** (add `AuditPort` impl that subscribes to event log).
11. **Prometheus deps declared in Tracera `pyproject.toml:71, 152, 159, 197` but never imported in `src/`** — `prometheus_client` is not actually wired. Effort: **S** (mount `make_asgi_app()` in `main.py`).
12. **`SamplingConfig.trace_ratio` is the only sampling knob** — no head-based / tail-based / per-endpoint sampling. Effort: **L** (parent-based sampler + per-route overrides).

## Recommendations
1. **Adopt OpenTelemetry as the bloc-wide observability contract**; deprecate parallel `tracely-core` ad-hoc builders and route everything through `agileplus-telemetry` + `tracely-core` thin wrappers.
2. **Add `#[instrument]` + `tracing` calls to all `async fn` entry points** (CLI, gRPC, HTTP, offload). Make this a blocking PR gate (lint rule via `tracing` / `clippy::needless_collect`-style custom rule).
3. **Wire batch span processor + gRPC exporter** in `agileplus-telemetry`; expose both `OtlpProtocol` paths.
4. **Mount a `/metrics` endpoint in every long-running service** (`agileplus-api`, `agileplus-dashboard`, `agileplus-mcp-intent`, `thegent-offload`, Tracera FastAPI) backed by Prometheus exposition.
5. **Implement `/healthz` and `/readyz` in Tracera FastAPI** mirroring the Rust `HealthCheck` contract (liveness, readiness, startup).
6. **Add Sentry or Honeycomb error capture** for all unhandled-error surfaces.
7. **Connect `agileplus-events` audit log to metrics + trace exemplars** so each business event produces a metric delta and trace span.
8. **Resolve Tracely `pheno-logging-zig` and `zerokit` shells** — either implement or remove from the workspace; the empty crates drag `cargo check` time and confuse contributors.
9. **Document the bloc's correlation-id contract** (X-Request-Id from `phenotype-request-id`) and ensure it's added as a `traceparent` header in every outbound HTTP/gRPC call.
10. **Add a single SOTA ADR: "Observability Stack 2026"** pinning: OTel SDK version, exporter protocol (gRPC primary), sampling policy, log format, metric cardinality limits, retention.
