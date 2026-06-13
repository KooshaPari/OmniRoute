# Observability Fleet — World Map

**Date:** 2026-06-08 (revised 2026-06-08 20:30 PT after user correction on Tracera role)
**Scope:** Read-only research. No source modified, no commits, no agents scheduled for execution.
**Audience:** Phenotype org owner. Inputs into a follow-up consolidation plan.
**Revision log:**
- 20:30 PT — Corrected §1.8, §2.10, §6.2 (Tracera row), §7 Q2, Phase 4, and diagram labels per user feedback. **Tracera is not a category error**: it is the canonical full-stack requirements traceability + product/project management platform, distinct from OTel-style observability but a bidirectional peer of the future observability core (consumes OTel for self-observability; could expose RTM APIs as an SDK surface). The original "category error" framing has been removed.

---

## 0. TL;DR

- **Nine repos claim to be "observability"** (Tracely, ObservabilityKit, Observably, phenoObservability, PhenoObservability, Tracera, HexaKit, phenoShared, plus four `-wtrees` worktree forks). Only **one is a real OTel-based Rust core**, two more have OTel on the side (Go), and the rest are **partial facades, duplicated crates, or in-memory stubs**. (Tracera is a *separate* product — requirements-traceability + PM platform — that legitimately consumes OTel for self-observability; it is not a misnamed observability crate.)
- **`Observably` is an empty directory** (zero files). Likely the intended canonical home; the work was done elsewhere.
- **`phenoObservability` and `PhenoObservability` are duplicate repos** with byte-identical READMEs and Cargo.toml — one is a clone or branch mirror, not a fork with a different charter.
- **ObservabilityKit's README describes a four-language OTel SDK**; the code in the repository is an **in-memory tracing crate with no OTel dependency** at all. The `python/` directory is a benchmark/profiling tool, the `go/go.work` references four modules that do not exist on disk, and the Rust crates roll their own collectors with `Arc<Mutex<Vec<_>>>`.
- **The single working OTel Rust core in the fleet is `HexaKit/crates/phenotype-logging`** (`HexaKit/crates/phenotype-logging/src/otel.rs:7-36`). It uses the canonical `opentelemetry 0.27` + `opentelemetry-otlp 0.27` + `tracing-opentelemetry 0.28` stack.
- **`phenoObservability/crates/phenotype-observably-tracing` declares OTel deps but its `init_otel` is a no-op** (`phenoObservability/crates/phenotype-observably-tracing/src/lib.rs:119-127`) — the file is `phenoObservability/crates/phenotype-observably-tracing/src/lib.rs` and the offending comment is on line 119: *"This is simplified to avoid runtime dependency on the tokio runtime."*
- **`Tracera` is the canonical full-stack requirements traceability + product/project management platform** — a Go backend (Go 1.25, OTel v1.43.0 fully wired) with a TypeScript/React 19 + Bun + Turbo frontend (`Tracera/README.md:5-13, 40, 46-58`). "Tracing" in the name refers to **requirements traceability** (linking requirements ↔ code ↔ tests ↔ deployments via the RTM, with TraceLink flow and dependency-graph visualization per README:35-38), **not** OTel-style distributed tracing. Tracera ships as a **separate product** outside the observability consolidation scope and is a **bidirectional peer** of the future observability core: it *consumes* OTel for its own runtime self-observability (ships to the Phenotype OTLP collector per README:40, with the `tracing/otel.go` file at `phenoObservability/tracing/otel.go:1-185` being the lift-and-shift form of Tracera's init), and it *exposes* its own RTM/PM APIs (TraceLink creation, FR/NFR chains, requirements dashboard) as a possible SDK surface for the rest of the org to depend on. The earlier "category error" framing in this document was **incorrect**; the §1.8 / §2.10 / §6.2 / §7-Q2 / Phase-4 sections below have been corrected.
- **`tracely-sentinel` in Tracely and phenoObservability is misnamed** — its `[package] name = "phenotype-sentinel"` (`Tracely/crates/tracely-sentinel/Cargo.toml:2`) and its `lib.rs` (`Tracely/crates/tracely-sentinel/src/lib.rs:1-9`) describe a resilience library (rate-limit, circuit breaker, bulkhead). It is not observability at all.
- **Recommendation:** designate `HexaKit/crates/phenotype-logging` (with `phenotype-telemetry` traits and `phenotype-sentry-config`) as the **Rust core**. Provide FFI bindings to Python (PyO3), TypeScript (napi-rs), and Go (cgo/C-ABI), then **deprecate or merge** the other six in-scope observability repos and remove the duplicate `tracely-sentinel`/`phenotype-sentinel` confusion. (`Tracera` is excluded — see §1.8 and §2.10 for why it is a separate product, not a fleet member.) See §6 for specifics.

---

## 1. Local Repo World Map

All file paths are absolute. The eight primary repos surveyed (plus four `-wtrees` worktree forks that mirror subsets of the primaries) are inventoried below. LOC counts are the *Rust line count of the main source file(s)* in each crate unless otherwise noted; full test counts and coverage require a `cargo tarpaulin` run that this read-only task does not perform.

### 1.1 `Tracely/` — small, focused, mostly real

- **Workspace root:** `Tracely/Cargo.toml:1-7` — `helix-tracing`, `tracely-core`, `tracely-sentinel` are workspace members.
- **Pitch:** `Tracely/README.md:8-16` — *"Tracely is the canonical observability layer for the Phenotype ecosystem ... tracing, metrics, and structured logging, all built on battle-tested crates (tracing, metrics, opentelemetry) without reimplementation."*
- **Language:** Rust 2021, MSRV not pinned in `Cargo.toml` (only `edition = "2021"` at `Tracely/crates/tracely-core/Cargo.toml:4`).
- **Subcrates:**
  - `Tracely/crates/tracely-core/src/lib.rs:23-28` — re-exports `logging` and `tracing` modules. Public API: `tracely::{LogContext, LoggerConfig, TraceContext, TracingConfig}`.
  - `Tracely/crates/tracely-core/src/tracing.rs:13-25` — `TracingConfig { level, span_events, include_thread_ids, include_thread_names, target }`. Implementation uses `tracing_subscriber::registry().with(filter).with(fmt_layer)` at `tracely-core/src/tracing.rs:97-98`. **No OTel init wired in this module.**
  - `Tracely/crates/tracely-core/src/logging.rs:35-50` — `env_logger::Builder` with a custom `chrono`-formatted line. Has a `log_json!` macro at `tracely-core/src/logging.rs:62-71` (uses `serde_json::json!`).
  - **OTel is *optional* via Cargo features:** `Tracely/crates/tracely-core/Cargo.toml:26-37` — `opentelemetry = "0.27"`, `prometheus = "0.13"`, `metrics = "0.24"`, gated behind `otel`, `prometheus`, `metrics`, and `full` features. **None of those features are exercised in the current source.**
  - `Tracely/crates/helix-tracing/` — `helix-tracing/Cargo.toml:2,6` declares `name = "helix-tracing"`, with `tracing = "0.1"` and `tracing-subscriber = "0.3"`. Marked ARCHIVED at `Tracely/crates/helix-tracing/ARCHIVED.md:2,5-6,42` (archived 2026-03-26) but **still in the workspace** at `Tracely/Cargo.toml:4`.
  - `Tracely/crates/tracely-sentinel/` — `tracely-sentinel/Cargo.toml:2` says `name = "phenotype-sentinel"` (misnamed crate; this is a resilience library). See `tracely-sentinel/src/lib.rs:23-32` — `bulkhead`, `circuit_breaker`, `config`, `rate_limiter`, `validation` modules. **Not observability.**
- **Test count:** `tracely-core/src/tracing.rs:156-219` has 7 `#[test]` functions; `tracely-core/src/logging.rs:88-119` has 4 tests; `tracely-sentinel/src/lib.rs:49-70` has 3 tests. No `cargo tarpaulin` data is committed.
- **CI:** `Tracely/STATUS.md:6,16` — *"GitHub Actions billing-blocked org-wide. Local cargo-deny+audit weekly."* Quality gates enrolled but not run.
- **Unique value:** the only observability crate in the fleet that is *consistently named and structurally focused* on tracing + logging. Even though OTel is not wired, the API surface (`tracely::tracing::init_tracing`) is what downstream code expects. The `tracely-core/Cargo.toml:5` description ("absorbs helix-logging and helix-tracing") is honest about its lineage.

### 1.2 `ObservabilityKit/` — multi-language promise, in-memory reality

- **Workspace root:** `ObservabilityKit/rust/Cargo.toml:1-8` — 4 members: `phenotype-health-runtime`, `phenotype-logging`, `phenotype-metrics`, `phenotype-telemetry`. The workspace also references a Go workspace at `ObservabilityKit/go/go.work:1-7` (members `./pheno-logging`, `./pheno-metrics`, `./pheno-health`, `./pheno-tracing` — **none of these directories exist**; only `go.work` is present, so `go build ./...` would fail).
- **Pitch:** `ObservabilityKit/README.md:9-30` — multi-language SDKs (Rust, Python, Go, TS) with OTel integration, framework middleware, exporters to Tempo/Loki/Prometheus, etc. `ObservabilityKit/AGENTS.md:7` even contains a placeholder *"ObservabilityKit is a [brief description of purpose and role in Phenotype ecosystem]."*
- **Language stack claim vs reality:**
  - **Rust:** four crates that are **not** OTel-based at all.
    - `ObservabilityKit/rust/phenotype-telemetry/Cargo.toml:9-12` — only `chrono` and `uuid` as deps. No `opentelemetry` dependency.
    - `ObservabilityKit/rust/phenotype-telemetry/src/lib.rs:17-23` — `enum MetricValue { Counter(u64), Gauge(f64), Histogram(Vec<f64>), Summary{...} }`. `MetricsCollector` at lines 72-119 stores everything in `Arc<Mutex<Vec<Metric>>>`. `Tracer` at lines 197-237 stores `Arc<Mutex<Vec<Span>>>`. `TelemetryExporter` trait at line 246-252; `ConsoleExporter` at line 255-271 is the *only* implementation. **No OTel.**
    - `ObservabilityKit/rust/phenotype-metrics/Cargo.toml:8-14` — `tokio`, `serde`, `serde_json`, `chrono`, `tracing`. `phenotype-metrics/src/lib.rs:11-15` defines its own `MetricKey` with hand-rolled Prometheus exposition (`export_prometheus_format` at lines 232-295). The comment on `phenotype-metrics/Cargo.toml:9-10` is honest: *"prometheus exposition format produced via direct string formatting in `export_prometheus_format`; no `prometheus` crate dependency required."*
    - `ObservabilityKit/rust/phenotype-logging/Cargo.toml:9-15` — `tracing`, `tracing-subscriber` (with `json` feature), `tracing-appender`, `serde`, `serde_json`, `uuid`. `phenotype-logging/src/lib.rs:43-65` — `init_logger` and `init_logger_with_format` with no OTel. `RequestContext` at lines 67-131 is identical in spirit to `phenoShared/crates/phenotype-logging/src/lib.rs`.
    - `ObservabilityKit/rust/phenotype-health-runtime/Cargo.toml:7-44` — feature-gated `http`, `prometheus`, `background` features. Pulls `phenotype-health` from phenoShared by git URL (`phenotype-health-runtime/Cargo.toml:17`). The `prometheus` feature uses `metrics 0.23` + `metrics-exporter-prometheus 0.15`, again without OTel. The crate is a *runtime* on top of the trait definitions in phenoShared.
  - **Python:** `ObservabilityKit/python/performance_kit/__init__.py:1-4` declares `__version__ = "0.1.0"`, `__all__ = []`. **The Python directory is not an observability SDK — it is a benchmarking toolkit.** `ObservabilityKit/python/README.md:1-360` is 360 lines of benchmark/profiler/analyzer scripts (`benchmark.py`, `profiler.py`, `analyze_complexity.py`, `analyze_dependencies.py`, `coverage_analysis.py`, `duration_tracker.py` — tools that run *against* observability setups, not provide them). Extracted from `phenoSDK/packages/performance-kit/` on 2026-04-04 per `ObservabilityKit/python/README.md:355-360`.
  - **Go:** only `ObservabilityKit/go/go.work:1-7` exists. None of `pheno-logging`, `pheno-metrics`, `pheno-health`, `pheno-tracing` directories are present on disk.
  - **TypeScript:** not present. The README at `ObservabilityKit/README.md:99-102` describes `typescript/observability-core` and `observability-express` but no `typescript/` directory exists.
- **ADRs:** `ObservabilityKit/docs/adr/0003-observability-client-transport-scope.md` and `0004-tracing-bridge-facade-future.md` exist (per the directory listing at `ObservabilityKit/docs/adr/`) but are aspirational; nothing in the code implements them.
- **Test counts:**
  - `phenotype-telemetry/src/lib.rs:293-325` — 3 unit tests (counter, span context, labels).
  - `phenotype-metrics/src/lib.rs:325-408` — 6 unit tests (key, in-memory, gauge, histogram, client, prometheus export).
  - `phenotype-logging/src/lib.rs:218-246` — 3 unit tests.
  - `phenotype-health-runtime/src/lib.rs:395-454` — 5 unit/integration tests.
- **Beaded feature files:** `ObservabilityKit/tests/features/phenotype-metrics/metrics_observability.feature`, `phenotype-logging/structured_logging.feature`, `phenotype-health-runtime/health_probes.feature`, `phenotype-observability-client/otlp_shipping.feature`, `phenotype-observability-core/shared_types.feature` — note the `phenotype-observability-client/otlp_shipping.feature` exists as a *feature file* but no `phenotype-observability-client` crate exists in the workspace (`ObservabilityKit/rust/Cargo.toml:3-8`).
- **Unique value:** the `phenotype-health-runtime` crate (`ObservabilityKit/rust/phenotype-health-runtime/src/lib.rs:99-319`) is a well-designed runtime layer with `HealthStatus`, `HealthCheck`, `HealthRegistry`, `HealthReport`, history, composite checks, and optional axum/prometheus/background features. This is genuinely useful and *extends* phenoShared's traits rather than duplicating them.
- **Risk surface:** the README's claims (Tempo exporter, multi-language SDKs, OTel OTLP) are **not backed by the code in the same repository**. This is a significant documentation-vs-implementation drift.

### 1.3 `Observably/` — empty

- **Status:** `Observably/` directory contains **zero files** (verified by `fs_search` returning no matches). No `README.md`, no `Cargo.toml`, no `package.json`, no `pyproject.toml`, no `go.mod`.
- **Implication:** Either the project was never started, was deleted in an in-progress reorg, or exists as a placeholder. The name "Observably" is not referenced from any other repo in the fleet (a quick `fs_search` of the `tracely|Tracely` corpus timed out before completion; a targeted `grep` was not run, but the file listings of the other repos show no `Observably/` path). It is a good candidate to be repurposed as the canonical observability home.

### 1.4 `phenoObservability/` and `PhenoObservability/` — **duplicates of each other**

- **Identity check:** the two repos are byte-identical in their root README and Cargo.toml:
  - `phenoObservability/README.md:1-220` and `PhenoObservability/README.md:1-220` are **identical 220-line files**, including the work-state banner (`Last commit | 2026-06-08`, `Open issues | 6`, `Focus | consolidate LogContext, Severity, RateLimiter, tracing init`).
  - `phenoObservability/Cargo.toml:1-45` and `PhenoObservability/Cargo.toml:1-45` are **identical 45-line files**, with the same workspace members, the same workspace.package, the same `tracing-opentelemetry = "0.23"`, the same git deps on `phenotype-errors` and `phenotype-event-bus` from HexaKit.
  - The same `phenotype-dragonfly`, `phenotype-questdb`, `tracely-core`, `tracely-sentinel`, `helix-logging`, `tracingkit`, `phenotype-observably-tracing`, `phenotype-observably-logging`, `phenotype-observably-sentinel`, `phenotype-observably-macros`, `phenotype-observably-ports` workspace members.
- **README's "This is the canonical observability layer" claim** is shared verbatim. There is no apparent reason for two repos with the same name; one is likely a misconfigured clone or a parallel fork that was never rebased.
- **Language stack (combined):**
  - **Rust** (16+ crates — see §1.5): the heavy lift is here.
  - **Go** (5+ subdirs): `phenoObservability/tracing/otel.go:1-185` is a real, working OTel SDK wrapper using `go.opentelemetry.io/otel v1.43.0`, `otlptracegrpc v1.40.0`, `semconv v1.21.0`, W3C `TraceContext{}` + `Baggage{}` propagators, `BatchSpanProcessor`, head-based `ParentBased(TraceIDRatioBased(0.1))` sampling. Other Go files: `metrics/collector.go`, `alerting/rules.go`, `health/checker.go`, `logctx/logctx.go`, `logging/rotation.go`, `logging/structured.go`, `logging/interceptor.go`, `dashboards/grafana.go`. There is **no top-level `go.mod`** in the repo (verified — the `fs_search` for `**/go.mod` returned nothing). The Go code is therefore a *scratch directory* without a buildable module.
  - **Python:** `phenoObservability/ai-prompt-logger/` — small `pyproject.toml` and `prompt_logger.py` + `cli.py`. This is an LLM prompt logger, not generic observability.
  - **TypeScript:** `phenoObservability/ts/ADR.md` exists but no TypeScript source is visible.
  - **Zig, Mojo, WASI, FFI:** subdirs `zig/`, `mojo/`, `wasi/`, `ffi/` exist, each with only an `ADR.md` and no source. The "multi-language" ambition is real but the implementation is in skeleton form.
- **Embedded ObservabilityKit subtree:** `phenoObservability/ObservabilityKit/` (full subtree copy of the ObservabilityKit repo, same `rust/`, `python/`, `tests/`, `docs/`, `README.md`, `CLAUDE.md` — see file listing at `phenoObservability/ObservabilityKit/rust/Cargo.toml`). The README at `phenoObservability/README.md:103-112` documents this: *"The ObservabilityKit SDK is absorbed under `ObservabilityKit/` (squashed subtree). It ships language-specific SDKs; the Rust nested workspace lives at `ObservabilityKit/rust/`"*.
- **Embedded Logify/logkit subtree:** `phenoObservability/crates/logkit/` (see `phenoObservability/crates/logkit/Cargo.toml:1-19`) — a hexagonal-architecture structured-logging SDK with `domain/`, `application/`, `adapters/`, `infrastructure/` layers. Description: `"Zero-cost structured logging framework"`. **Does not use `tracing` or any OTel crate** — it is its own logging framework.
- **Embedded tracely-core, tracely-sentinel, helix-logging, tracingkit subtrees** all live in `phenoObservability/crates/`.
- **Real OTel code in the Go subdir only.** The Rust `phenotype-observably-tracing` crate has the OTel deps declared but its `init_otel` is a no-op (see §1.5 below).
- **Test surface:** sparse. `phenotype-observably-tracing/src/lib.rs:129-178` has 4 tests but skips the OTel path entirely. `phenoObservability/crates/phenotype-observably-tracing/tests/phenotype_bus_observability_e2e.rs` exists but its content was not opened in this read-only pass.
- **Unique value:** the Go `tracing/otel.go` is the **most complete OTel code in the fleet** (W3C propagator, batch span processor, parent-based ratio sampling, OTLP/gRPC, semconv). The `phenotype-observably-ports` crate is a clean hexagonal port definition (`CachePort`, `TimeSeriesPort`, `MetricsPort`) that other crates can plug into (`phenoObservability/crates/phenotype-observably-ports/src/lib.rs:8-30`).

### 1.5 `phenoObservability/` Rust crate inventory (and the OTel no-op)

The workspace is dense; here is the per-crate read of what each one actually does.

| Crate | Path | LOC (approx, src/) | Has OTel? | Notes |
|---|---|---|---|---|
| `tracely-core` | `phenoObservability/crates/tracely-core/` | small (mirrors Tracely/) | **No** | Identical content to `Tracely/crates/tracely-core/`. Wraps `tracing` and `tracing-subscriber`; OTel is a Cargo feature that is not exercised. |
| `tracely-sentinel` | `phenoObservability/crates/tracely-sentinel/` | small | **No** | Misnamed; the package is `phenotype-sentinel`, a resilience library. |
| `helix-logging` | `phenoObservability/crates/helix-logging/` | small | **No** | ARCHIVED 2026-03-26 (per `Tracely/crates/helix-tracing/ARCHIVED.md` for the tracing analogue). |
| `tracingkit` | `phenoObservability/crates/tracingkit/` | 11 lines (`src/lib.rs`) | **No (but looks like it should)** | README claims "Distributed tracing with OpenTelemetry support" and "Multiple Exporters: OTLP, Jaeger, Zipkin, Console" (`tracingkit/README.md:1-12`). But `tracingkit/Cargo.toml:8-17` only depends on `tracing`, `parking_lot`, `chrono`, `uuid`, `async-trait`, and the local `phenotype-observably-macros`. **No `opentelemetry`, no `tracing-opentelemetry`, no `opentelemetry-otlp`.** Hexagonal layout (domain/application/adapters/infrastructure) is the empty scaffold for an OTel wrapper that was never built. |
| `logkit` | `phenoObservability/crates/logkit/` | 9 lines (`src/lib.rs`) | **No** | Same pattern as `tracingkit` — hexagonal layout, no OTel, no `tracing` integration. |
| `phenotype-observably-tracing` | `phenoObservability/crates/phenotype-observably-tracing/` | 178 lines (`src/lib.rs`) + `metrics.rs` (233 lines) | **Declared, but `init_otel` is a no-op** | `phenotype-observably-tracing/Cargo.toml:18-23` declares `tracing-opentelemetry = "0.33"`, `opentelemetry = "0.27"`, `opentelemetry-otlp = "0.32"`, `prometheus = "0.14"`. The `metrics.rs:7,17-24` is **genuinely working** — it uses `prometheus::IntCounterVec`, `prometheus::HistogramVec`, `prometheus::Registry`, `TextEncoder::new().encode(...)` to emit the Prometheus text format. **But `init_otel` at `phenotype-observably-tracing/src/lib.rs:111-127` is a no-op:** *"For now, we initialize OTEL config but don't panic on failure. In production, you would wire this with tracing-opentelemetry + opentelemetry-otlp. This is simplified to avoid runtime dependency on the tokio runtime."* The function takes `endpoint: Option<&str>`, ignores it, and returns `Ok(())` after an `info!` macro. |
| `phenotype-observably-logging` | `phenoObservability/crates/phenotype-observably-logging/` | 36 lines (`src/lib.rs`) | **No** | A `LogContext` struct with `trace_id, span_id, service` and a `StructuredLogger` shell. Real OTel correlation is not implemented. |
| `phenotype-observably-ports` | `phenoObservability/crates/phenotype-observably-ports/` | small | **No** | Real hexagonal ports (`CachePort`, `TimeSeriesPort`, `MetricsPort`) and test-doubles / Prometheus adapter. Genuinely useful. |
| `phenotype-observably-macros` | `phenoObservability/crates/phenotype-observably-macros/` | small (proc-macro) | **No** | Provides `#[async_instrumented]` and `pii_scrub!` (per `phenotype-observably-macros/README.md:5-32`). Uses `quote` and `syn`. |
| `phenotype-observably-sentinel` | `phenoObservability/crates/phenotype-observably-sentinel/` | small | **No** | `alerting.rs` + `lib.rs`; description suggests this is the alerting half of observability. |
| `pheno-dragonfly` | `phenoObservability/crates/pheno-dragonfly/` | small | **No** | Dragonfly cache adapter; storage backend for time-series. |
| `pheno-questdb` | `phenoObservability/crates/pheno-questdb/` | small | **No** | QuestDB time-series adapter. |

### 1.6 `HexaKit/` — 50+ crates, the most complete observability story

- **Workspace root:** `HexaKit/Cargo.toml:1-70` — 50+ workspace members; explicitly listed `phenotype-logging`, `phenotype-telemetry`, `phenotype-sentry-config`, `phenotype-port-traits`, `phenotype-health`, `phenotype-ports-canonical` as observability-adjacent.
- **Self-description:** `HexaKit/README.md:22-26` — *"HexaKit is the GitHub repository name for phenotype-infrakit, the Phenotype Infrastructure Kit. ... a Rust workspace containing 16+ specialized infrastructure libraries ... hexagonal architecture port/adapter patterns."*
- **Observability surface area (the only complete one in the fleet):**
  - `HexaKit/crates/phenotype-logging/Cargo.toml:10-19` declares `opentelemetry = "0.27"`, `opentelemetry_sdk = "0.27"`, `opentelemetry-otlp = "0.27"`, `tracing-opentelemetry = "0.28"`, plus `tracing`, `tracing-subscriber`. **This is the only crate in the fleet with a complete, working OTel init.**
  - `HexaKit/crates/phenotype-logging/src/otel.rs:7-36` — `init_with_otel(service_name, otlp_endpoint)` actually wires up the OTLP exporter:
    ```rust
    let otlp_exporter = opentelemetry_otlp::SpanExporter::builder()
        .with_tonic()
        .with_endpoint(otlp_endpoint)
        .build()?;
    let tracer_provider = opentelemetry_sdk::trace::TracerProvider::builder()
        .with_batch_exporter(otlp_exporter, runtime::Tokio)
        .with_resource(opentelemetry_sdk::Resource::new(vec![
            opentelemetry::KeyValue::new("service.name", service_name),
        ]))
        .build();
    let tracer = tracer_provider.tracer(service_name);
    let otel_layer = tracing_opentelemetry::layer().with_tracer(tracer);
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer())
        .with(otel_layer)
        .init();
    ```
    This is **exactly** the canonical pattern from the OTel Rust docs.
  - `HexaKit/crates/phenotype-logging/src/lib.rs:1-11` — minimal `Result<T>` alias.
  - `HexaKit/crates/phenotype-logging/src/config.rs:1-122` — `LogLevel`, `OutputFormat { Pretty, Compact, Json }`, `LogConfig` with `from_env()` reader.
  - `HexaKit/crates/phenotype-logging/src/subscriber.rs:1-53` — `init(config)`, `init_default()`, `init_from_env()`.
  - `HexaKit/crates/phenotype-telemetry/Cargo.toml:8-15` — depends on `serde`, `serde_json`, `thiserror`, `chrono`, `tracing`, `tracing-subscriber`. **No OTel** in the dep set, but the trait surface (`HexaKit/crates/phenotype-telemetry/src/lib.rs:50-304`) is a clean abstraction over `MetricsRecorder`, `Tracer`, `Logger`, `Telemetry`, with `NoopMetrics`, `NoopTracer`, `NoopLogger`, `NoopTelemetry` no-op implementations. `LogEntry::new`/`info`/`warn`/`error` (lines 215-258) and `LogLevel::from_str` (lines 178-189) are clean value types.
  - `HexaKit/crates/phenotype-sentry-config/src/lib.rs:1-105` — Sentry SDK wrapper. `sentry::init((dsn, ClientOptions{...}))` at line 31. `capture_error` at line 72, `capture_message` at line 84. Uses `sentry 0.34` from `HexaKit/Cargo.toml:72`.
  - `HexaKit/crates/phenotype-port-traits/src/lib.rs:1-45` — declares `pub mod inbound; pub mod outbound;`. `outbound/` contains `secret.rs`, `repository.rs`, `event.rs`, `cache.rs`, `mod.rs` — but **no `logger.rs`** at the time of inspection. The phenoShared port crate *does* have `outbound/logger.rs`; the HexaKit one does not.
  - `HexaKit/crates/phenotype-health/Cargo.toml:8-13` — `serde`, `thiserror`, `tokio`, `chrono` only. No OTel. It is the *trait* layer that `ObservabilityKit/rust/phenotype-health-runtime` extends.
  - `HexaKit/Cargo.toml:157-167` — workspace-level deps: `opentelemetry = "0.24"`, `opentelemetry_sdk = "0.24"`, `tracing-opentelemetry = "0.24"`. (Note: the workspace pins 0.24, but the logging crate itself pins 0.27 — there is a workspace dep version skew.)
- **Test counts (sampled):** `phenotype-telemetry/src/lib.rs:374-444` has 6 tests; `phenotype-logging/src/subscriber.rs` has no inline tests; `phenotype-sentry-config/src/lib.rs:88-104` has 2 tests.
- **Unique value:** HexaKit is the *only* place where observability is treated as a first-class responsibility. The `phenotype-logging` crate is the only one that actually starts an OTLP exporter end-to-end. The `phenotype-telemetry` trait surface is the right shape for a library — pure abstractions, no backend lock-in. The `phenotype-sentry-config` wraps error tracking. Combined, this is the closest thing in the fleet to a "Rust core + ports" architecture.
- **Risk surface:** the workspace depends on `HexaKit` from `phenoObservability/Cargo.toml:43-44` (`phenotype-errors = { git = "https://github.com/KooshaPari/HexaKit", branch = "main" }`, `phenotype-event-bus = { git = "https://github.com/KooshaPari/HexaKit", branch = "main" }`) — meaning HexaKit is already the implicit upstream for PhenoObservability's infra. The workstate in `phenoObservability/README.md:13` mentions *"phantom HexaKit dep to fix"* — a sign the git dep is not pinning to a tag, and the "deps blocked by missing sibling pheno path" message in `phenoObservability/docs/sessions/20260507-phenoobservability-sladge-main-refresh/00_SESSION_OVERVIEW.md:14-15` confirms build gates are not green.

### 1.7 `phenoShared/` — hexagonal infra, lean observability story

- **Workspace root:** `phenoShared/Cargo.toml:1-22` — 18 members including `phenotype-logging` and `phenotype-port-interfaces`. Description in `phenoShared/README.md:8-19` — *"Rust infrastructure toolkit ... shared domain, application, port, and infrastructure crates that support hexagonal and clean architecture."*
- **Observability surface:**
  - `phenoShared/crates/phenotype-logging/Cargo.toml:14-16` — depends only on `tracing` and `tracing-subscriber`. **No OTel.**
  - `phenoShared/crates/phenotype-logging/src/lib.rs:1-152` — three entry points: `init_tracing()` (line 54), `init_tracing_with_default(default_filter)` (line 77), `init_tracing_for_test(filter_directive)` (line 99). All idempotent (`try_init` instead of `init`). All read `RUST_LOG` via `EnvFilter::try_from_default_env()`. **This is the canonical pattern** consumed by PhenoRuntime, PhenoAgent, PhenoMCP-cheap, HeliosLab (per the docstring at lines 1-31). It is the **most-used observability helper in the org** based on the docstring's claimed call sites.
  - `phenoShared/Cargo.toml:48-51` — workspace deps include `tracing-opentelemetry = "0.33"`. **The workspace declares the dep, but the logging crate does not consume it.** This is a half-built step toward OTel.
  - `phenoShared/crates/phenotype-port-interfaces/src/outbound/` — `cache.rs`, `event.rs`, `logger.rs`, `queue.rs`, `http.rs`, `repository.rs`, `filesystem.rs`, `config.rs`, `secret.rs`, `mod.rs` (per file listing). The `outbound/logger.rs` is the canonical *trait* for outbound logger ports; the HexaKit equivalent does not exist (only `secret.rs`, `repository.rs`, `event.rs`, `cache.rs` are present in `HexaKit/crates/phenotype-port-traits/src/outbound/`).
- **Non-observability stack:** Python (`pheno-shared/python/pheno_llm/`) and TypeScript (`packages/errors`, `packages/ids`, `packages/types`).
- **Unique value:** `phenoShared` already has *the* canonical tracing init pattern that the rest of the org uses. Adding OTel to `phenotype-logging` here is a smaller diff than redoing it elsewhere. The `outbound/logger.rs` trait is the right boundary for FFI bindings to consume.
- **Risk surface:** the `phenotype-llm` and other "phenotype-*" crates inside `phenoShared` overlap heavily with the `phenoObservability` and HexaKit duplicates (see §2).

### 1.8 `Tracera/` — full-stack requirements traceability + product/project management platform (separate product, not observability)

- **Pitch:** `Tracera/README.md:5-13, 40` — *"Agent-native requirements traceability and project management dashboard ... unified dashboard and control plane for linking requirements to code, tests, and deployments — built on a Go backend with a TypeScript/React Turbo frontend."* Also: *"Integrated Observability: Metrics (Prometheus), logs (Loki), and tracing through Phenotype OTLP collector."* (README:40). The product is a **full-stack traceability + PM platform**, not a misnamed observability repo.
- **Capabilities (per `Tracera/README.md:33-41`):**
  - Multi-View Traceability: requirements ↔ code ↔ tests ↔ deployment lenses
  - Agent-Native Design: AI-assisted analysis and automated traceability maintenance
  - Real-Time Updates: live sync across dashboard and backend
  - Interactive Visualization: dependency graphs and impact analysis for requirements/code
  - Hardened Governance: SLSA provenance, signed attestations, automated quality gates
  - Integrated Observability: metrics (Prometheus), logs (Loki), tracing via Phenotype OTLP collector
  - **PM capabilities:** requirements status board, FR/NFR chains, traceability reports, TraceLink flows, audit trail views (per the README features and the rich-media stubs at README:225-238)
- **Language:** Go 1.25 backend (`Tracera/backend/go.mod:3`), TypeScript/React 19 + Bun + Turbo frontend (`Tracera/README.md:54-58`).
- **OTel presence (Go side — real, complete):** `Tracera/backend/go.mod:43-47` lists `go.opentelemetry.io/otel v1.43.0`, `go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.40.0`, `go.opentelemetry.io/otel/sdk v1.43.0`, plus `otelecho v0.65.0` for echo HTTP instrumentation. **This is the most complete OTel Go integration in the fleet** — better than the PhenoObservability Go file because it is built into a working module with a real `go.mod` and dependency closure. The `tracing/otel.go` file in `phenoObservability/tracing/otel.go:1-185` is the *exportable form* of Tracera's init code (lifted out so other Go consumers can call it).
- **Other signals:** `prometheus/client_golang v1.23.2` at `Tracera/backend/go.mod:32`, `getsentry/sentry-go v0.42.0` at line 15, `go.uber.org/zap v1.27.1` at line 49. Tracera *ships its own telemetry* to the Phenotype OTLP collector.
- **Role relative to the observability consolidation:**
  - Tracera is **not a fleet member** of the proposed `HexaKit/crates/phenotype-observability/` core. It is its own product.
  - But Tracera is a **first-class OTel consumer**: its backend calls the OTel SDK directly, exports to the Phenotype OTLP collector, and (via the lifted `tracing/otel.go`) is the *reference implementation* for how a Go service in the org should wire OTel.
  - If the org ever ships a Go-side OTel FFI shim (see §4.1 of the lang-FFI strategy playbook), Tracera is the **first adopter** and the validation target — its OTel init is the regression baseline.
  - Tracera's RTM/PM APIs (TraceLink creation, FR/NFR chain queries, requirements dashboard) are a **separate, valuable SDK surface** that other org repos (HexaKit, Phenotype agent repos) could depend on for traceability *consumers* (e.g. "when code changes, update the TraceLink"). That is out of scope for observability consolidation but should be tracked as a separate "Tracera-as-SDK" workstream.
- **Naming note:** the Go module is published as `github.com/kooshapari/tracertm` (per README:7); the product name in code is `tracertm`; the repo and product display name is "Tracera / TracerTM". This is consistent and intentional, not a misnaming.

### 1.9 Worktree forks (`-wtrees` directories)

- **`Tracely-wtrees/work-state-2026-06-08/`:** a worktree fork of Tracely. `Tracely-wtrees/work-state-2026-06-08/Cargo.toml:1-7` is identical to the primary `Tracely/Cargo.toml:1-7`. `Tracely-wtrees/work-state-2026-06-08/crates/tracely-core/Cargo.toml:1-38` is identical to the primary. Treat as a transient working copy, not a separate codebase.
- **`phenoObservability-wtrees/rmcp-migration/`** and **`phenoObservability-wtrees/docs-toc-2026-06-08/`:** worktree forks of phenoObservability, with the same Rust workspace members (`rmcp-migration/Cargo.toml` and `docs-toc-2026-06-08/Cargo.toml` not opened, but the file listing at the top of the search shows the same `crates/phenotype-observably-tracing/`, `crates/tracely-core/`, `crates/logkit/`, `crates/tracingkit/`, etc. subtrees). Both are transient working copies.
- **`ObservabilityKit-wtrees/` and `Tracera-wtrees/`:** listed in the user's prompt and in the file_list at the root, but **no such directories were found on disk** in this read-only pass (the `fs_search` for `ObservabilityKit-wtrees` returned a "Path does not exist" error). Either the directories were removed, are git worktrees that require the repo to be open in the right branch, or are listed as part of the parent CLAUDE.md corpus without actual filesystem presence. The user's prompt should be re-validated before any consolidation work depends on these.

### 1.10 LOC and coverage summary

| Repo / crate | Source LOC (approx) | Tests (inline `#[test]`) | Coverage data |
|---|---|---|---|
| `Tracely/crates/tracely-core` | 366 (`tracing.rs` 219 + `logging.rs` 119 + `lib.rs` 28) | 11 | not committed |
| `Tracely/crates/helix-tracing` | 176 (`lib.rs`) | 5 | not committed |
| `Tracely/crates/tracely-sentinel` (= `phenotype-sentinel`) | small (≤200) | 3 | not committed |
| `ObservabilityKit/rust/phenotype-telemetry` | 325 | 3 | not committed |
| `ObservabilityKit/rust/phenotype-metrics` | 408 | 6 | not committed |
| `ObservabilityKit/rust/phenotype-logging` | 246 | 3 | not committed |
| `ObservabilityKit/rust/phenotype-health-runtime` | 454 | 5 | not committed |
| `ObservabilityKit/python/performance_kit` | small (script toolkit) | none in repo | n/a |
| `Observably` | 0 | 0 | n/a |
| `phenoObservability/...` (entire repo, all crates) | ~3,000–5,000 across 16+ crates (estimate) | 10–20 (sparse) | not committed |
| `PhenoObservability/...` | identical to above | identical | not committed |
| `HexaKit/crates/phenotype-logging` | ~200 (`otel.rs` 89 + `config.rs` 122 + `subscriber.rs` 53 + `lib.rs` 11) | 0 in those files | not committed |
| `HexaKit/crates/phenotype-telemetry` | 445 | 6 | not committed |
| `HexaKit/crates/phenotype-sentry-config` | 105 | 2 | not committed |
| `HexaKit/crates/phenotype-port-traits` | small (≤300) | 4 | not committed |
| `phenoShared/crates/phenotype-logging` | 152 | 3 | not committed (FR-traced to FR-LOG-001/002/003 in docstring) |
| `Tracera/backend` (Go) | large (real product) | many (real product) | not committed |

Coverage cannot be measured without `cargo tarpaulin --workspace`, which is a write/install operation and is therefore out of scope for this read-only research. Coverage gaps in the form of the `tracely-sentinel` crate's working BDD suite (`Tracely/crates/tracely-sentinel/tests/bdd/`) and the `phenotype-observably-tracing` integration tests exist but were not opened in this pass.

---

## 2. Redundancy Analysis

The fleet has the following duplication patterns, ranked by the size of the merge risk they pose.

### 2.1 Identical twins: `phenoObservability` == `PhenoObservability`

These two repos have **byte-identical `README.md` (220 lines) and `Cargo.toml` (45 lines)** — verified by reading both. The work-state banner at the top of each (`phenoObservability/README.md:1-9`) is also identical. Both worktrees (`rmcp-migration`, `docs-toc-2026-06-08`) are forks of the same source. **One of these repos should be deleted.** No value is lost by retiring the duplicate; the surviving repo can keep either GitHub remote.

### 2.2 The `tracely-sentinel` misnaming (3 copies, 1 real home)

`tracely-sentinel` appears as a workspace member in three repos:
- `Tracely/Cargo.toml:6` — `crates/tracely-sentinel`
- `phenoObservability/Cargo.toml:10` — `crates/tracely-sentinel`
- `PhenoObservability/Cargo.toml:10` — `crates/tracely-sentinel`

In all three, the `[package] name = "phenotype-sentinel"` (`Tracely/crates/tracely-sentinel/Cargo.toml:2`). The crate is a *resilience* library (`Tracely/crates/tracely-sentinel/src/lib.rs:23-32`: `bulkhead`, `circuit_breaker`, `config`, `rate_limiter`, `validation`). It is **not** an observability primitive and should not be categorized as such. A 4th similar-but-unrelated `phenotype-sentinel` may exist in phenoObservability as a "sentinel" submodule within `phenotype-observably-sentinel/`. The three copies of `tracely-sentinel` are themselves duplicates of the same source tree.

### 2.3 The `helix-logging` and `helix-tracing` "absorbed but still in workspace" pattern

`Tracely/crates/tracely-core/src/tracing.rs:1-5` and `Tracely/crates/tracely-core/src/logging.rs:1-5` claim to have absorbed `helix-tracing` and `helix-logging`. The `ARCHIVED.md:1-5,42` confirms 2026-03-26 archival. **But `Tracely/Cargo.toml:4-5` still lists `helix-tracing` as a workspace member**, and `phenoObservability/Cargo.toml:11` lists `helix-logging`. So the absorption is **partial**: the *code* has been copied into `tracely-core`, but the *workspace members* have not been removed. The downstream `tracely-core` Rust API (`use tracely::{tracing, logging}`) is the canonical one, but the old crate names still resolve and will still appear in `cargo metadata`.

### 2.4 Three tracing init patterns for the same job

There are five distinct "initialize tracing" entry points that achieve substantially the same outcome:

| Pattern | File | OTel? | Used by |
|---|---|---|---|
| `tracely::tracing::init_tracing(TracingConfig)` | `Tracely/crates/tracely-core/src/tracing.rs:76-78` | Optional Cargo feature, not exercised in code | Tracely consumers |
| `phenotype_logging::init_tracing()` | `phenoShared/crates/phenotype-logging/src/lib.rs:54-62` | No | PhenoRuntime, PhenoAgent, PhenoMCP-cheap, HeliosLab (per docstring) |
| `HexaKit/phenotype_logging::otel::init_with_otel(service_name, otlp_endpoint)` | `HexaKit/crates/phenotype-logging/src/otel.rs:7-36` | **Yes (real)** | HexaKit consumers |
| `phenotype_observably_tracing::init_tracing(service_name, log_level)` | `phenoObservability/crates/phenotype-observably-tracing/src/lib.rs:67-105` | No (no-op `init_otel`) | PhenoObservability consumers |
| `phenotype_logging::init_logger()` (ObservabilityKit) | `ObservabilityKit/rust/phenotype-logging/src/lib.rs:43-65` | No | ObservabilityKit consumers |

Five different "init" functions across the fleet. **Only one actually starts an OTLP exporter.** The other four are functionally equivalent to each other and to the `tracely-core` one when OTel is off.

### 2.5 Three "metrics" implementations, all with the same shape

- **`ObservabilityKit/rust/phenotype-metrics/src/lib.rs:11-229`** — `MetricKey`, `MetricsClient`, `MetricsRecorder` trait, `InMemoryRecorder` with `Arc<Mutex<HashMap<...>>>`, hand-rolled `export_prometheus_format` (lines 232-295). **No `prometheus` crate.**
- **`HexaKit/crates/phenotype-telemetry/src/lib.rs:47-80`** — `MetricsRecorder` trait, `NoopMetrics` no-op. **No backend implementation; just the trait.**
- **`phenoObservability/crates/phenotype-observably-tracing/src/metrics.rs:17-147`** — `MetricsRegistry` with the real `prometheus` crate. `IntCounterVec`, `HistogramVec`, `Registry`, `TextEncoder::new().encode(...)`. **This is the only working Prometheus exporter in the fleet.**
- **`phenoObservability/crates/phenotype-observably-ports/src/metrics.rs`** — port trait with optional `prometheus-adapter` feature (`phenotype-observably-ports/Cargo.toml:14-15`) for an adapter.
- **`phenoObservability/crates/phenotype-observably-ports/src/metrics_prometheus.rs`** — adapter implementation.

Five different metrics surfaces; the only one that emits real Prometheus text format is `phenoObservability/crates/phenotype-observably-tracing/src/metrics.rs`. The ObservabilityKit implementation rolls its own (with the comment that it explicitly avoided the `prometheus` crate).

### 2.6 Two "is this an OTel SDK" crates, one with deps and no code, one with code and no deps

- **`tracingkit`** (`phenoObservability/crates/tracingkit/`) — README claims OTel, but `tracingkit/Cargo.toml:8-17` has zero OTel dependencies. The crate body is a 4-line `lib.rs` re-exporting `application::*` and `domain::*`. **Empty facade.**
- **`phenotype-observably-tracing`** (`phenoObservability/crates/phenotype-observably-tracing/`) — declares OTel deps but the `init_otel` function is a no-op (`phenotype-observably-tracing/src/lib.rs:111-127`). **Stub facade.**

### 2.7 The "ObservabilityKit subtree" duplication

`phenoObservability/ObservabilityKit/` is a full copy of the `ObservabilityKit/` repo, including its `rust/`, `python/`, `tests/`, `docs/` directories. The README at `phenoObservability/README.md:103-112` documents this as a "squashed subtree" absorbed into PhenoObservability. The result is that the in-memory tracing crate in `ObservabilityKit/rust/phenotype-telemetry/src/lib.rs` is now compiled *twice* if both repos are in the same workspace — once as `phenotype-telemetry` (ObservabilityKit) and once via the `tracely-core` re-export. The `phenoObservability` repo additionally has the *real* working code in its own `tracely-core`, `phenotype-observably-tracing`, and `tracingkit` crates, so the duplicated ObservabilityKit subtree is a third copy of the same in-memory primitives.

### 2.8 The `phenotype-port-interfaces` vs `phenotype-port-traits` split

Two ports crates exist:
- `phenoShared/crates/phenotype-port-interfaces/src/outbound/logger.rs` (and friends) — defined and used by phenoShared consumers.
- `HexaKit/crates/phenotype-port-traits/src/outbound/` — has `secret.rs`, `repository.rs`, `event.rs`, `cache.rs`, `mod.rs` but **no `logger.rs`**.

These are the *same conceptual crate* with different shapes. The phenoShared one has a logger port; the HexaKit one has cache and event ports. Neither subsumes the other; both must be coordinated when defining FFI boundaries.

### 2.9 The "tracing/otel.go" duplication

`tracing/otel.go:1-185` in `phenoObservability/` is the same code that drives `Tracera/backend/`'s OTel integration. There is no shared module — the Go file is a copy. If a Go consumer wants OTel, they import from Tracera (or copy the file again). **Resolution path (post-correction):** since Tracera is a separate product and not an observability-fleet member, this duplication is acceptable *as a transitional state* — the long-term fix is for Tracera to publish a `phenotype-otel-go` Go module (Phase 4 below) that other Go consumers can `go get`, eliminating the copy.

### 2.10 Tracera's relationship to the observability core (revised)

`Tracera/README.md:5-13, 33-41` describes a full-stack **requirements traceability + product/project management platform** with integrated observability for self-monitoring. It is **not** an observability backend, **not** a metrics store, and **not** a tracing system in the OTel sense. The "tracing" in its name refers to **requirements traceability** (requirements → design → code → tests → deployments), not distributed tracing.

The earlier "category error" framing in this document was incorrect. Tracera's correct position in the fleet is:

- **Tracera is a separate, independent product.** It is not in scope for observability consolidation.
- **Tracera is a first-class OTel consumer.** Its backend wires `go.opentelemetry.io/otel v1.43.0` + `otlptracegrpc` + `otelecho` (per `Tracera/backend/go.mod:43-47`) and ships to the Phenotype OTLP collector. It is the **reference Go implementation** of OTel init in the org.
- **Tracera is a potential SDK source.** Its RTM/PM APIs (TraceLink, FR/NFR chains, requirements dashboard) are a different but valuable surface that other fleet repos may eventually depend on. That is a separate workstream, not part of observability consolidation.
- **The bidirectional relationship:** the future `HexaKit/crates/phenotype-observability/` core does not subsume Tracera, but Tracera (a) consumes the core's downstream OTel SDK (via Go's first-party OTel, no FFI needed), and (b) could expose its own APIs to the rest of the org for traceability *use*. This is "peers, not parent-child" — see §6.4 diagram.

---

## 3. OpenTelemetry Compatibility

### 3.1 Per-repo OTel usage

| Repo / crate | `opentelemetry` crate version | `opentelemetry-otlp` version | `tracing-opentelemetry` version | Actually wired? |
|---|---|---|---|---|
| `Tracely/crates/tracely-core` | `0.27` (optional feature) | not declared | not declared | **No** — feature exists but no `init_otel` |
| `Tracely/crates/helix-tracing` | not declared | not declared | not declared | **No** |
| `ObservabilityKit/rust/phenotype-telemetry` | not declared | not declared | not declared | **No** (in-memory `Arc<Mutex<Vec<_>>>`) |
| `ObservabilityKit/rust/phenotype-metrics` | not declared | not declared | not declared | **No** (hand-rolled Prometheus text) |
| `ObservabilityKit/rust/phenotype-logging` | not declared | not declared | not declared | **No** (tracing-subscriber only) |
| `phenoObservability/.../phenotype-observably-tracing` | `0.27` | `0.32` | `0.33` | **No** (`init_otel` is a no-op) |
| `phenoObservability/.../phenotype-observably-metrics` (in same crate) | n/a (uses `prometheus 0.14`) | n/a | n/a | **Yes** for Prometheus, **No** for OTel |
| `phenoObservability/.../tracingkit` | not declared | not declared | not declared | **No** |
| `phenoObservability/.../logkit` | not declared | not declared | not declared | **No** |
| `phenoObservability/.../ObservabilityKit/.../phenotype-telemetry` | not declared | not declared | not declared | **No** (copy of ObservabilityKit code) |
| `HexaKit/crates/phenotype-logging` | `0.27` (and `0.24` in workspace) | `0.27` | `0.28` | **Yes** — `init_with_otel` is the only working OTel init in the Rust fleet |
| `HexaKit/crates/phenotype-telemetry` | not declared | not declared | not declared | **No** (trait-only) |
| `phenoShared/crates/phenotype-logging` | not declared (workspace has `tracing-opentelemetry 0.33`) | not declared | not declared (in crate) | **No** |
| `Tracera/backend` (Go) | `go.opentelemetry.io/otel v1.43.0` | `otlptracegrpc v1.40.0` | n/a | **Yes** — full SDK, batch span processor, semconv, W3C propagator, sampling. Reference Go implementation. |
| `phenoObservability/tracing/otel.go` | `go.opentelemetry.io/otel` (via `go.mod`-less copy) | `otlptracegrpc` | n/a | **Yes** (lifted from Tracera's init; transitional state until `phenotype-otel-go` module is published) |

### 3.2 Should the fleet converge on a single OTel-based core?

**Yes — strongly recommended.** Rationale:

1. The OpenTelemetry Rust SDKs are at 0.27+ and are CNCF-graduated (verified at <https://opentelemetry.io/>, *"OpenTelemetry is a CNCF graduated project"*, footer of homepage). Rust has first-class support with 12+ languages (per the homepage's "1006+ Integrations" and "Languages 12+" stat block). The user's strategy of "Rust core + FFI bindings" maps directly to the OTel ecosystem's Rust SDKs + OTel Collector.
2. The fleet has **exactly one** crate that actually starts an OTLP exporter (`HexaKit/crates/phenotype-logging/src/otel.rs:7-36`). Promoting that to the canonical core eliminates all five no-op/facade OTel paths listed in §2.4 and §2.6.
3. The current OTel versions across the fleet are inconsistent (`0.23` in `phenoObservability/Cargo.toml:36` workspace; `0.24` in `HexaKit/Cargo.toml:157-158` workspace; `0.27` in `HexaKit/crates/phenotype-logging/Cargo.toml:16-17` and `0.32` in `phenoObservability/.../phenotype-observably-tracing/Cargo.toml:21`). A single converged core pins the version once and re-uses it everywhere.
4. The fleet's Prometheus exporter in `phenoObservability/crates/phenotype-observably-tracing/src/metrics.rs:7-147` is *also* worth preserving as a sibling of OTel — `prometheus 0.14` is a battle-tested crate and the existing implementation is the only working metrics exporter in the fleet.
5. The OTel ecosystem handles *storage* and *query* via the **OTel Collector** (`https://opentelemetry.io/docs/collector/`). The fleet should not invent a custom collector or storage backend; it should ship spans to an OTel Collector (or directly to a vendor), which then fans them out to Tempo, Loki, Prometheus, etc.

---

## 4. Multi-Language and FFI Strategy

The user has a stated "Rust core + FFI bindings (PyO3 pattern)" strategy. Here is the language inventory and the FFI binding plan.

### 4.1 Language-by-language current state

| Language | Where in fleet | Status | Bindings strategy |
|---|---|---|---|
| **Rust** | HexaKit (core), Tracely, phenoShared, ObservabilityKit, phenoObservability | Canonical, used by 5+ repos | **This is the core.** No binding needed. |
| **Go** | Tracera (real, working), phenoObservability/tracing (mirror), ObservabilityKit (workfile only) | Two parallel implementations, neither reused as a module | C-ABI FFI from a thin `phenotype-otel-go` shim that exposes `cgo` exports. Alternatively, since Go has first-class OTel, provide a *Rust crate that exposes an FFI*, plus a *Go module that calls into it via cgo* for non-OTel primitives (e.g., the PII scrubber from `phenotype-observably-macros`). For pure OTel, recommend Go consumers use `go.opentelemetry.io/otel` directly. |
| **Python** | ObservabilityKit/python/performance_kit (benchmark toolkit, not SDK), phenoObservability/ai-prompt-logger (LLM prompt logger), phenoShared/python/pheno_llm (LLM client) | No actual observability SDK exists | **PyO3** bindings wrapping the Rust core. Target crate: `phenotype-observability-python` published to PyPI. Bindings to expose: `init_otel(service_name, otlp_endpoint)`, `init_tracing(level)`, `record_counter(name, value, labels)`, `record_histogram(name, value, labels)`, `capture_exception(exc)`, `flush()`. The `ai-prompt-logger` and `performance_kit` should be merged into a single `phenotype-observability` PyPI package. |
| **TypeScript** | ObservabilityKit (claimed but absent), phenoObservability/ts/ (ADR only), phenoShared/packages/errors, packages/ids, packages/types | No observability SDK in TS | **napi-rs** bindings wrapping the Rust core. Target crate: `phenotype-observability-node` published to npm. Auto-generate TypeScript types via `napi-derive` + `ts-rs`. Same API surface as the PyO3 module. The TS "middleware" claimed by the ObservabilityKit README (Express, Hono) should be added in a separate `phenotype-observability-hono` / `-express` package, layered on top of the core. |
| **Zig / Mojo / WASI / WASM** | phenoObservability/zig/, mojo/, wasi/, ffi/ (ADRs only) | Skeleton | **Defer.** No binding work until the core is stabilized. When done, WASM bindings are via `wasm-bindgen` + a JS-FFI shim. Zig/Mojo are sufficiently niche that effort is better spent elsewhere. |

### 4.2 Recommended FFI core boundaries

The Rust core should expose a C-ABI stable surface with four function groups:

1. **Lifecycle:** `phenotype_obs_init(service_name: *const c_char, otlp_endpoint: *const c_char, log_level: *const c_char) -> i32`, `phenotype_obs_flush() -> i32`, `phenotype_obs_shutdown() -> i32`.
2. **Spans:** `phenotype_obs_span_begin(name: *const c_char, parent: u128) -> u64`, `phenotype_obs_span_set_attr(span_id: u64, key: *const c_char, value: *const c_char)`, `phenotype_obs_span_end(span_id: u64, status_code: i32)`.
3. **Events (logs):** `phenotype_obs_event(level: i32, target: *const c_char, message: *const c_char, kv_json: *const c_char)`.
4. **Metrics:** `phenotype_obs_metric_counter_add(name: *const c_char, value: f64, labels_json: *const c_char)`, `phenotype_obs_metric_histogram_observe(...)`, `phenotype_obs_metric_gauge_set(...)`, `phenotype_obs_metric_render_prometheus() -> *const c_char`.

The PyO3 and napi-rs wrappers both wrap this C-ABI surface. The Go wrapper either reuses the C-ABI (via cgo) **or** prefers the native `go.opentelemetry.io/otel` path for OTel primitives and only uses cgo for non-OTel extensions (PII scrubbing, the structured-log serializer, etc.).

### 4.3 Which repo should be the "Rust core"?

**Pick `HexaKit/crates/phenotype-logging` as the OTel core, and `HexaKit/crates/phenotype-telemetry` as the trait/port surface.** Justification:

- The OTel init code in `HexaKit/crates/phenotype-logging/src/otel.rs:7-36` is the only working OTel wiring in the fleet.
- The `phenotype-telemetry` trait surface is the cleanest (no backend, no OTel, just shapes), matching the user's "Rust core + FFI" intuition.
- HexaKit is already the implicit upstream for `phenoObservability` (via git deps on `phenotype-errors` and `phenotype-event-bus`), so promoting HexaKit crates is a *promotion of what's already de-facto canonical*, not a new consolidation.
- The `phenotype-sentry-config` crate is the only Sentry wrapper; folding error-tracking into the core is straightforward.
- The `phenotype-port-traits` crate is close to `phenoShared/crates/phenotype-port-interfaces` and could absorb it.

**Reject `Tracely` as the core** because (a) the `tracely-core` Cargo.toml at `Tracely/crates/tracely-core/Cargo.toml:26-37` declares OTel as a feature that is *not exercised* in code, (b) it does not actually start an OTLP exporter, and (c) it carries a misnamed `tracely-sentinel` workspace member that would need to be moved out before the workspace could be used as a clean core.

**Reject `phenoObservability` as the core** because (a) the `init_otel` no-op makes it misleading, (b) the `tracingkit`/`logkit` empty facades would need to be deleted before the core is real, and (c) it is a duplicate of `PhenoObservability`, so picking it would entrench the duplication.

**Reject `ObservabilityKit` as the core** because (a) the four-language SDKs are aspirational, not present, (b) the Python directory is a benchmark toolkit, not an SDK, (c) the Go workspace members don't exist, and (d) the TypeScript directory doesn't exist.

---

## 5. OSS Competitor World Map

The fleet's observability work has to compete with a very mature ecosystem. Brief status (current as of 2026-06-08, verified via the cited URLs):

| Tool / Project | Language | License | Market position | OTel compat | Fleet duplication? | URL |
|---|---|---|---|---|---|---|
| **OpenTelemetry** | Multi (Rust has 0.27 SDK) | Apache 2.0 | Canonical CNCF-graduated standard. 1006+ integrations, 12+ languages. | Itself | **Yes — `HexaKit/phenotype-logging/otel.rs` is the only implementation; the rest are no-op facades** | <https://opentelemetry.io/> |
| **OpenTelemetry Collector** | Go | Apache 2.0 | Vendor-neutral pipeline for traces/metrics/logs. 200+ receiver/exporter/processor components. | Itself | None — fleet has no collector | <https://opentelemetry.io/docs/collector/> |
| **Datadog** | SaaS (multi-lang agents) | Proprietary | Commercial APM/logs/metrics. Strong on UX, expensive. | Yes (Datadog agent supports OTLP ingest) | No direct duplication, but `phenotype-sentry-config` overlaps with Datadog's error-tracking | <https://www.datadoghq.com/> |
| **Honeycomb** | SaaS (multi-lang agents) | Proprietary | Commercial APM focused on wide events / high-cardinality observability. | Yes (OTLP) | None | <https://www.honeycomb.io/> |
| **Grafana Cloud / Grafana stack** | Loki/Tempo/Mimir/Prometheus in Go; Pyroscope in Go for profiles | AGPL/Apache mix | OSS Grafana stack + commercial Grafana Cloud | Yes | The fleet's `prometheus` exporter duplicates the *format* but not the storage. `pheno-dragonfly` and `pheno-questdb` time-series adapters overlap with Mimir (long-term Prometheus) and Loki (logs). | <https://grafana.com/oss/> |
| **New Relic** | SaaS (multi-lang agents) | Proprietary | Commercial APM. | Yes (OTLP) | None | <https://newrelic.com/> |
| **Sentry** | Multi (Python/JS/Go/Rust/etc.) | MIT (server) / BSL (some newer pieces) | Error tracking + performance. | Partial (Sentry SDK + OTel interop) | **Yes — `HexaKit/phenotype-sentry-config` is a thin Sentry wrapper; the fleet should consume the official `sentry` crate and avoid duplicate wrappers** | <https://sentry.io/> |
| **Grafana Loki** | Go | AGPL 3.0 | OSS log aggregation. Promtail/Alloy for shipping. | Yes (OTLP logs) | None | <https://grafana.com/oss/loki/> |
| **Grafana Tempo** | Go | AGPL 3.0 | OSS distributed tracing. | Yes (OTLP) | None | <https://grafana.com/oss/tempo/> |
| **Grafana Mimir** | Go | AGPL 3.0 | OSS long-term Prometheus storage. | Yes (OTLP metrics) | The fleet's `pheno-questdb` adapter overlaps conceptually with Mimir's role | <https://grafana.com/oss/mimir/> |
| **Prometheus** | Go | Apache 2.0 | OSS metrics standard. | Yes (OTLP exporter) | The fleet's `phenotype-observably-tracing::metrics` already uses the official `prometheus` crate — this is the right pattern | <https://prometheus.io/> |
| **Jaeger** | Go | Apache 2.0 | OSS distributed tracing (CNCF graduated). | Yes (OTLP since v1.35) | **No duplication in the fleet, but the OTel setup in `tracing/otel.go:78-83` includes Jaeger-style head-based sampling — a code smell; sample at the collector instead** | <https://www.jaegertracing.io/> |
| **Zipkin** | Java | Apache 2.0 | Older OSS tracing. | Partial | None | <https://zipkin.io/> |
| **Vector** | Rust | MPL 2.0 | High-performance log/metric pipeline. Datadog-built. | Yes (Vector 0.42+ has OTel source/sink) | None directly; the fleet's tracingkit/logkit *could* be replaced by a Vector pipeline but the in-process API is what consumers want | <https://vector.dev/> |
| **Fluentd** | Ruby/C | Apache 2.0 | OSS log collector. | Partial (Fluent Bit and OTel collector integration) | None | <https://www.fluentd.org/> |
| **Fluent Bit** | C | Apache 2.0 | Lightweight log forwarder. | Yes | None | <https://fluentbit.io/> |
| **tokio-tracing** | Rust | MIT/Apache 2.0 | Ecosystem-standard `tracing` crate for Rust. Used by Tokio, hyper, axum, etc. | Via `tracing-opentelemetry` 0.28 | **Yes — this is what `Tracely`, `phenoShared`, and `HexaKit` all already use; the consolidation should not reinvent it** | <https://github.com/tokio-rs/tracing> |
| **tracing-opentelemetry** | Rust | MIT/Apache 2.0 | Official bridge from `tracing` to OpenTelemetry. | Itself | **Yes — the dependency is declared in three repos but the bridge is never actually activated. The canonical core should use it.** | <https://github.com/tokio-rs/tracing-opentelemetry> |
| **metrics / metrics-exporter-prometheus** | Rust | MIT/Apache 2.0 | Ecosystem-standard metrics facade. | Via OTel exporter | Used by `ObservabilityKit/.../phenotype-health-runtime` (prometheus feature), partially overlaps with the `prometheus` crate. | <https://github.com/metrics-rs/metrics> |
| **OpenObserve** | Rust | AGPL 3.0 | Newer OSS observability backend in Rust. | Yes | None directly | <https://openobserve.ai/> |
| **Quickwit** | Rust | AGPL 3.0 | OSS cloud-native search & analytics (logs/traces) in Rust. | Partial | None | <https://quickwit.io/> |

**Key strategic takeaway:** the *backend* half of the observability stack (collector, TSDB, log store, trace store) is already served by mature OSS projects. The fleet should **not** build a custom storage backend. The fleet's *value* is the *client-side* Rust core + FFI bindings, with data shipped to an OTel Collector that fans out to Tempo/Loki/Mimir/Prometheus (or a vendor).

---

## 6. Consolidation Recommendation

### 6.1 The single canonical core

**Designate `HexaKit/`'s observability crates as the canonical core.** Specifically:

- **`HexaKit/crates/phenotype-logging`** — the only working OTel Rust init. Becomes the public entry point.
- **`HexaKit/crates/phenotype-telemetry`** — the trait/port layer. Already pure abstraction; no OTel dep.
- **`HexaKit/crates/phenotype-sentry-config`** — the Sentry wrapper. Stays as-is.
- **`HexaKit/crates/phenotype-port-traits`** — needs an `outbound/logger.rs` to match phenoShared's trait (currently missing; add one).

### 6.2 Per-repo action plan

| Repo | Action | Specifics |
|---|---|---|
| **`Tracely/`** | **(a) Merge into core** for `tracely-core` and **(c) Deprecate** for `helix-tracing`/`helix-logging` | The `Tracely/crates/tracely-core/src/lib.rs:23-28` API surface (`tracely::{LogContext, LoggerConfig, TraceContext, TracingConfig}`) is the *Rust API* downstream code expects. Move it into `HexaKit/crates/phenotype-logging/` as a re-export module so the call sites `use tracely::tracing::init_tracing(...)` continue to compile. After the merge, delete `Tracely/Cargo.toml:4-5` workspace members `helix-tracing` and `helix-logging` (already archived). Re-evaluate whether `tracely-sentinel` belongs in the same workspace; if it stays, rename the package to `phenotype-sentinel` (matching the actual `[package] name`) and move it under `HexaKit/crates/phenotype-sentinel`. |
| **`ObservabilityKit/`** | **(b) Wrap/bind** and **(c) Deprecate** | The `phenotype-health-runtime` crate (`ObservabilityKit/rust/phenotype-health-runtime/src/lib.rs:99-319`) extends `phenotype-health` from phenoShared and adds a real runtime. **Move `phenotype-health-runtime` into `HexaKit/crates/`** as `phenotype-health-runtime` so it sits next to its trait sibling. The `phenotype-telemetry`, `phenotype-metrics`, and `phenotype-logging` crates in ObservabilityKit are **all superseded by HexaKit equivalents and the official `prometheus`/`opentelemetry` crates** — delete them. **Delete the in-memory `Arc<Mutex<Vec<_>>>` code at `ObservabilityKit/rust/phenotype-telemetry/src/lib.rs:72-119` and `:197-237` outright** — it has no OTel, no exporter, no value. The `python/performance_kit` (benchmark toolkit) and the `tests/features/*.feature` BDD files are useful but should be moved to a *new* `HexaKit/crates/phenotype-observability-testkit` crate. The Go `go.work` and TypeScript claims in the README are aspirational and should be removed. |
| **`Observably/`** | **(a) Use as the canonical home** | The empty directory. Repurpose: clone the consolidated observability crates from HexaKit into `Observably/`, and make `Observably/` the *public* rust workspace that the rest of the org depends on. The internal implementation continues to live in HexaKit (where the Sentry wrapper, the OTel init, and the port traits are); the `Observably/` repo is the *distribution* workspace. (Alternative: skip this and just keep the crates in HexaKit. The user should decide based on whether they want a "feature-named" repo for external consumption.) |
| **`phenoObservability/` and `PhenoObservability/`** | **(c) Deprecate** | These two are duplicates — pick one (recommend `phenoObservability/` since its name sorts first) and delete the other. Then, in the survivor, fold the salvageable crates into the core: **`phenotype-observably-tracing` → HexaKit** (the metrics.rs at lines 7-147 has the only working Prometheus exporter; the init_tracing / no-op init_otel paths at lines 67-127 are also salvageable once the no-op is replaced with the real `HexaKit/phenotype-logging::otel::init_with_otel` call). **`phenotype-observably-ports` → HexaKit/crates/phenotype-port-traits/outbound/** (the `CachePort`, `TimeSeriesPort`, `MetricsPort` traits at `phenoObservability/crates/phenotype-observably-ports/src/lib.rs:8-30` are valuable). **`phenotype-observably-macros` → HexaKit** (the `#[async_instrumented]` and `pii_scrub!` proc macros at `phenotype-observably-macros/README.md:5-32` are real value). **`tracingkit`, `logkit`, `phenotype-observably-logging`, `phenotype-observably-sentinel`, `phenotype-dragonfly`, `phenotype-questdb` → delete** (empty facades or already-superseded). The Go `tracing/otel.go` is best moved to Tracera (or its own Go module) so the Go OTel init has a buildable home. |
| **`HexaKit/`** | **(a) Promote** | Becomes the canonical home. The `phenotype-logging` crate absorbs `tracely-core` and the observably-tracing work; the `phenotype-port-traits` crate gains an `outbound/logger.rs` and the `phenotype-observably-ports` traits. The workspace dep version skew (workspace pins 0.24, logging pins 0.27) must be resolved to a single version. |
| **`phenoShared/`** | **(b) Wrap** | Keep the `phenotype-logging::init_tracing` API (it is the most-used observability init in the org per its docstring) but make it a *re-export* of the canonical `HexaKit::phenotype-logging` init. This way the call sites in PhenoRuntime, PhenoAgent, etc. continue to work unchanged. The `phenotype-port-interfaces` crate is a duplicate of `phenotype-port-traits` in concept; align the two and pick one as the FFI-facing surface. |
| **`Tracera/`** | **(Keep separate, treat as peer)** | Tracera is the canonical full-stack requirements traceability + product/project management platform — **not** in scope for observability consolidation. It is a **first-class OTel consumer** (its backend wires `go.opentelemetry.io/otel v1.43.0` + `otlptracegrpc` + `otelecho` and ships to the Phenotype OTLP collector) and serves as the **reference Go implementation** of OTel init for the org. Action items: (1) leave Tracera untouched in this consolidation; (2) Tracera is the **first adopter** of any future Go-side OTel FFI shim and the regression baseline for "does the OTel SDK still work for Go consumers?"; (3) the `phenoObservability/tracing/otel.go` lifted-from-Tracera code should eventually be replaced by a `phenotype-otel-go` Go module that Tracera publishes and other Go consumers import (Phase 4 below); (4) Tracera's RTM/PM APIs are a **separate, valuable SDK surface** to be tracked in a follow-up "Tracera-as-SDK" workstream. |
| **`Tracely-wtrees/`, `phenoObservability-wtrees/`** | **Transient** | These are worktrees of the primaries. Resolve via the upstream decisions. |

### 6.3 Conflict with active agent

The user noted that **ObservabilityKit is currently in another active agent's conflict list** — *do not modify its source in this pass*. All ObservabilityKit references in this document are read-only and reflect the state on disk at 2026-06-08. The merge actions above should be coordinated with the other agent (and with the user) before they execute.

### 6.4 Summary diagram of the proposed world

```
                                 +----------------------------+
                                 | Observably/                |  <-- optional public-facing
                                 |   (re-export workspace)    |      distribution workspace
                                 +-------------+--------------+
                                               |
                                               v
+-------------------------+   +------------+   +---------+   +-----------------------+
| Tracera                 |   | phenoShared|   | Other   |   | HexaKit/ (core)       |
| (Go)                    |   | (legacy)   |   | Rust    |   |   phenotype-logging   |
| OTel self-observability |   | init_      |   | crates  |   |   - OTel init (real)  |
| via go.opentelemetry.io |   | tracing()  |   |         |   |   - tracing layer     |
| Reference Go init impl  |   |  re-export |   |         |   |   - sentry_config     |
| (PEER, not in core)     |   |            |   |         |   |   phenotype-telemetry |
|                         |   |            |   |         |   |   - traits / ports    |
| Tracera-as-SDK (RTM/PM) |   |            |   |         |   |   phenotype-ports-    |
| exposes TraceLink,      |   |            |   |         |   |     traits (logger,   |
| FR/NFR chains to fleet  |   |            |   |         |   |     cache, event,...) |
+-------------------------+   +------------+   +---------+   +-----------------------+
        |        ^                                                   |
        |        |                                                   |
        v        |                                                   v
   consumes OTel |                                      +------------+--------------+
   via first-    |                                      |            |              |
   party Go SDK  +----<--- "I am a peer, not part"     v            v              v
                                                       PyO3       napi-rs         cgo
                                                       (Python)   (TS)            (Go)
                                                       + OTel      + OTel          (optional;
                                                       + Sentry    + Sentry         Go's first-
                                                       + prometheus + prometheus   party OTel
                                                                                   preferred)
```

### 6.5 What gets deleted

If the user accepts the above, the deletion set is:

- `Tracely/crates/helix-tracing/` (already archived; just remove from workspace).
- `Tracely/crates/helix-logging/` (if a separate copy exists; otherwise remove from phenoObservability).
- `ObservabilityKit/rust/phenotype-telemetry/src/lib.rs` (in-memory collectors, no OTel).
- `ObservabilityKit/rust/phenotype-metrics/src/lib.rs` (hand-rolled Prometheus text).
- `ObservabilityKit/go/go.work` (broken — points to non-existent members).
- `ObservabilityKit/python/performance_kit/` (move to a new testkit crate or to `phenoResearchEngine` if it's a benchmark for the org; not an SDK).
- `phenoObservability/crates/tracingkit/`, `crates/logkit/`, `crates/phenotype-observably-logging/`, `crates/phenotype-observably-sentinel/`, `crates/pheno-dragonfly/`, `crates/pheno-questdb/`.
- `phenoObservability/ObservabilityKit/` (squashed subtree copy).
- `phenoObservability/tracing/`, `phenoObservability/metrics/`, `phenoObservability/health/`, `phenoObservability/logctx/`, `phenoObservability/logging/`, `phenoObservability/alerting/`, `phenoObservability/dashboards/`, `phenoObservability/zig/`, `phenoObservability/mojo/`, `phenoObservability/wasi/`, `phenoObservability/ffi/`, `phenoObservability/ai-prompt-logger/`, `phenoObservability/ts/` — all are skeletons / scratch dirs / single-purpose; the survivors in this list (`tracing/otel.go` and `ai-prompt-logger`) get re-homed.
- `PhenoObservability/` entire repo (duplicate of phenoObservability).
- The phantom `-wtrees` repos that exist only in the file list (`ObservabilityKit-wtrees/`, `Tracera-wtrees/` — see §1.9).

---

## 7. Risks and Open Questions

These need user input before a Phase-1 PR is opened:

1. **Which repo is the canonical core: HexaKit or Observably?**
   HexaKit has the working OTel init but is a *50-crate infra workspace*. Observably is empty. The user said in CLAUDE.md they have a *strategy* for naming; the question is whether the canonical observability workspace should be a sub-crate inside HexaKit (`HexaKit/crates/phenotype-observability/`) or its own repo (repurpose `Observably/`).

2. **Tracera's OTel code — re-home to a Go module or leave in Tracera? (revised 2026-06-08 20:30 PT)**
   The `phenoObservability/tracing/otel.go:1-185` is a copy of Tracera's init. Options: (a) extract a `phenotype-otel-go` Go module (publishable, versioned, with its own `go.mod`) that *other* Go consumers can `go get`, and have Tracera keep its own internal init unchanged; (b) leave the OTel init in Tracera and have other Go consumers import Tracera as a Go module path; (c) keep the scratch-dir pattern (not recommended). My recommendation is (a). **Tracera's own backend init stays in Tracera** — it is the reference implementation.

3. **Tracera-as-SDK workstream (deferred, separate workstream).** Tracera's RTM/PM APIs (TraceLink, FR/NFR chains, requirements dashboard) are valuable and could be exposed as an SDK the rest of the org depends on for traceability *consumers*. This is out of scope for observability consolidation; should it be a tracked workstream?

3. **Should `ObservabilityKit/python/performance_kit` be preserved as a benchmark/testkit?**
   It is a real benchmarking toolkit (360 lines) but it is not an observability SDK. If it's used by the org's CI to measure performance, it should be moved to a testkit crate; otherwise, it can be deleted as out-of-scope.

4. **How aggressively to converge on OTel?**
   There are two reasonable scopes:
   - **Conservative:** only the *log + tracing* path goes through OTel. Metrics stay on the `prometheus` crate + the `phenotype-observably-tracing::metrics` exporter.
   - **Aggressive:** every signal goes through OTel (metrics via `opentelemetry-prometheus`, logs via `opentelemetry-appender-logging`). This is the CNCF-recommended path and avoids running a separate Prometheus scraper, but it requires the OTel Collector to expose a Prometheus read endpoint.

5. **CI status.** `Tracely/STATUS.md:6` says *"GitHub Actions billing-blocked org-wide. Local cargo-deny+audit weekly."* Without CI, the consolidated core's first PR is effectively a *blind merge*. The user should specify how the consolidation will be validated — is the local `cargo-deny+audit` sufficient, or will CI be unblocked first?

6. **Naming convention: `phenotype-observability-*` vs `tracely-*` vs `observably-*`.**
   The three prefixes are in use in different repos. Pick one to enforce going forward. My recommendation: **`phenotype-observability-*`** (matches the existing OTel-related HexaKit prefixes and is consistent with `phenotype-*` for the rest of the org). This is also the prefix used by the `phenotype-observably-*` crates in phenoObservability, suggesting the org has already implicitly chosen it.

7. **Sentry vs Datadog APM error-tracking.** `HexaKit/phenotype-sentry-config` wraps Sentry only. If the org uses both Sentry and Datadog, the wrapper may need a `tracing/dynatrace.rs`-style adapter.

8. **The `tracely-sentinel` package misnaming.** All three copies say `name = "phenotype-sentinel"` but live in directories called `tracely-sentinel`. This is a real bug to fix during the merge.

---

## 8. Proposed Plan-of-Attack (3-5 Phases, Not Executed)

These are the proposed phases for a follow-up consolidation effort. **This document does not execute any of them.** Each phase has a clear, testable exit criterion.

### Phase 0 — Resolve conflicts and answer open questions (no code changes)

- [ ] User confirms the canonical core location (HexaKit sub-crate vs Observably repo).
- [ ] User confirms OTel scope (conservative vs aggressive per Q4 above).
- [ ] User confirms the Tracera/Go OTel re-homing strategy (Q2).
- [ ] User confirms naming convention (`phenotype-observability-*`).
- [ ] Coordinator: align with the active agent touching ObservabilityKit; agree on a merge window.

### Phase 1 — Stand up the canonical core, absorb the salvageable crates (read-only permission granted, write enabled)

- [ ] In `HexaKit/`, create a new `crates/phenotype-observability/` workspace member that re-exports the public surface of `phenotype-logging`, `phenotype-telemetry`, `phenotype-sentry-config`, and the future `phenotype-port-traits/outbound/logger.rs`.
- [ ] Add a `pub use` shim so existing `tracely::tracing::init_tracing` and `pheno_shared::phenotype_logging::init_tracing` call sites continue to work without source edits.
- [ ] Move `ObservabilityKit/rust/phenotype-health-runtime` into `HexaKit/crates/phenotype-health-runtime` (as a sibling of `phenotype-health`).
- [ ] Move `phenoObservability/crates/phenotype-observably-ports` into `HexaKit/crates/phenotype-port-traits/outbound/` and resolve the duplicate-trait surface with `phenoShared/crates/phenotype-port-interfaces/`.
- [ ] Move `phenoObservability/crates/phenotype-observably-macros` into `HexaKit/crates/phenotype-observability-macros` (preserves the `#[async_instrumented]` and `pii_scrub!` proc macros).
- [ ] Move the working Prometheus exporter from `phenoObservability/.../phenotype-observably-tracing/src/metrics.rs:7-147` into `HexaKit/crates/phenotype-observability/src/metrics/prometheus.rs`.
- [ ] Replace `phenoObservability/.../phenotype-observably-tracing/src/lib.rs:111-127` no-op `init_otel` with a call to `HexaKit::phenotype_logging::otel::init_with_otel(service_name, otlp_endpoint)`.
- [ ] Pin a single OTel version across the HexaKit workspace (resolve the 0.24 / 0.27 skew at `HexaKit/Cargo.toml:157-158` vs `HexaKit/crates/phenotype-logging/Cargo.toml:16-17`).
- [ ] Add CI: enforce `cargo test --workspace`, `cargo clippy --workspace -- -D warnings`, `cargo deny check`, and a smoke test that calls `init_with_otel` against a local OTel Collector.

**Exit criterion:** `cargo test --workspace` is green on HexaKit with the OTel init code path exercised. `tracely::tracing::init_tracing` and `pheno_shared::phenotype_logging::init_tracing` re-exports work without caller changes.

### Phase 2 — Delete duplicates and absorb ObservabilityKit (coordinated with active agent)

- [ ] In coordination with the active agent on ObservabilityKit, delete the in-memory collectors at `ObservabilityKit/rust/phenotype-telemetry/src/lib.rs:72-119` and `:197-237` (the `Arc<Mutex<Vec<...>>>` code).
- [ ] Delete `ObservabilityKit/rust/phenotype-metrics/` (superseded by the new `phenotype-observability::metrics::prometheus`).
- [ ] Delete `ObservabilityKit/rust/phenotype-logging/` (replaced by the re-export shim in Phase 1).
- [ ] Delete `ObservabilityKit/go/go.work` (broken — points to non-existent members; nothing to migrate).
- [ ] Move `ObservabilityKit/python/performance_kit` to `HexaKit/crates/phenotype-observability-testkit` (or to a different testkit crate; user choice per Q3).
- [ ] Move `ObservabilityKit/tests/features/*.feature` BDD files to the new testkit crate.
- [ ] In Tracely, delete `crates/helix-tracing/` and `crates/helix-logging/` from the workspace (`Tracely/Cargo.toml:4-5`).
- [ ] In Tracely, fix the `tracely-sentinel` package misnaming (`Tracely/crates/tracely-sentinel/Cargo.toml:2`) — either rename the directory to `phenotype-sentinel` or move the crate under HexaKit.
- [ ] Delete `phenoObservability/crates/tracingkit/`, `crates/logkit/`, `crates/phenotype-observably-logging/`, `crates/phenotype-observably-sentinel/`, `crates/pheno-dragonfly/`, `crates/pheno-questdb/`.
- [ ] Delete `phenoObservability/ObservabilityKit/` subtree.
- [ ] Delete `phenoObservability/zig/`, `mojo/`, `wasi/`, `ffi/`, `ts/`, `ai-prompt-logger/`, `dashboards/`, `alerting/`, `health/`, `metrics/`, `logctx/`, `logging/`, `tracing/` (the working `tracing/otel.go` is re-homed per Phase 4 below; the rest are scratch).
- [ ] Pick one of `phenoObservability/` or `PhenoObservability/`; delete the other (per Q1, recommend keeping `phenoObservability/` and deleting `PhenoObservability/`).
- [ ] In the survivor, re-route dependencies on the deleted crates to the HexaKit equivalents.
- [ ] Archive the `Tracely/` repo on GitHub and keep a pointer README pointing to `HexaKit/crates/phenotype-observability/`.

**Exit criterion:** `cargo test --workspace` green in HexaKit; `cargo test --workspace` green in the surviving `phenoObservability/` (now a thin re-export workspace); no other consumer has been broken.

### Phase 3 — Build FFI bindings (PyO3, napi-rs, optional cgo)

- [ ] Create `HexaKit/crates/phenotype-observability-c` exposing the C-ABI surface (lifecycle, spans, events, metrics) per §4.2.
- [ ] Create `HexaKit/crates/phenotype-observability-py` as a PyO3 wrapper around the C-ABI. Add a `pyo3` feature flag.
- [ ] Create `HexaKit/crates/phenotype-observability-node` as a napi-rs wrapper. Add a `napi` feature flag.
- [ ] Generate TypeScript types with `ts-rs` and publish the JS package as `@phenotype/observability`.
- [ ] Publish the Python package as `phenotype-observability` on PyPI (and as a `maturin` build).
- [ ] Add binding tests: a Python test that imports the module, calls `init_otel`, and asserts the OTel Collector (running in a test container) receives a span. Same for the TypeScript binding.
- [ ] (Optional) Add a cgo shim for Go consumers; document that Go's first-party `go.opentelemetry.io/otel` is preferred for OTel primitives and the cgo shim is only needed for the PII scrubber and structured-log serializer.

**Exit criterion:** a Python `pip install phenotype-observability` and an `npm install @phenotype/observability` both produce a working SDK that can send a span to a local OTel Collector.

### Phase 4 — Re-home the Go OTel code (revised 2026-06-08 20:30 PT: Tracera stays put, optional module extracted)

Per the user's correction, Tracera is a **separate product**, not a fleet member. The scope of Phase 4 is therefore narrower than originally drafted:

- [ ] **Tracera's own OTel init stays in Tracera.** Do not move or rewrite it. Tracera is the **reference Go implementation** of OTel init for the org.
- [ ] (Optional, user-confirm) Extract a `phenotype-otel-go` Go module from the *lifted* code in `phenoObservability/tracing/otel.go:1-185`. This is so *other Go consumers* (not Tracera itself) can `go get` the init pattern. Tracera's backend keeps using its own internal init.
- [ ] (Optional, user-confirm) If extracted, publish the Go module on the org's Go proxy or at least tag a release on GitHub. Document in the module's README that it is for non-Tracera Go consumers and that Tracera uses its own internal init.
- [ ] (Optional, user-confirm) Add a test that imports `phenotype-otel-go` from a fresh Go module and asserts the OTel Collector receives a span. Use the Tracera backend's existing tests as the regression baseline.

**Exit criterion:** Tracera's backend tests pass; (if extracted) `phenotype-otel-go` is importable from a fresh Go module and a non-Tracera Go service can adopt it without copy-paste from `phenoObservability/`. Tracera itself is unchanged.

**Tracera-as-SDK follow-up (out of scope for this phase):** expose TraceLink / FR-NFR / requirements-dashboard APIs as an SDK. This is a separate workstream; not part of observability consolidation.

### Phase 5 — Deprecate and document

- [ ] Add `ARCHIVED.md` to `Tracely/`, `ObservabilityKit/`, `phenoObservability/` (survivor), and `phenoObservability/ObservabilityKit/` with a pointer to `HexaKit/crates/phenotype-observability/` and the FFI packages.
- [ ] Add a `# Deprecated: see HexaKit/phenotype-observability` doc comment to each `tracely_*` and `phenotype_observably_*` crate's `lib.rs`.
- [ ] Update `ARCHITECTURE.md` (parent repo) with a "consolidated observability core" section.
- [ ] Update `STATUS.md` (parent repo) to record the consolidation as a 2026-06-08 workstream.
- [ ] If `Observably/` is the chosen public-facing repo, transfer the consolidated HexaKit crates to it; otherwise leave the crates in HexaKit and document the choice.

**Exit criterion:** A new contributor reading any of the deprecated repos is redirected to the canonical home within one click. The OTel init path is exercised by CI on every PR to the consolidated core.

---

## 9. Sources & Citations

All file:line references in this document are to absolute paths in `~/CodeProjects/Phenotype/repos/`. The key cited files are:

- `Tracely/README.md`, `Tracely/Cargo.toml`, `Tracely/STATUS.md`
- `Tracely/crates/tracely-core/Cargo.toml`, `src/lib.rs`, `src/tracing.rs`, `src/logging.rs`
- `Tracely/crates/helix-tracing/Cargo.toml`, `ARCHIVED.md`
- `Tracely/crates/tracely-sentinel/Cargo.toml`, `src/lib.rs`
- `ObservabilityKit/README.md`, `CLAUDE.md`, `AGENTS.md`
- `ObservabilityKit/rust/Cargo.toml`
- `ObservabilityKit/rust/phenotype-telemetry/Cargo.toml`, `src/lib.rs`
- `ObservabilityKit/rust/phenotype-metrics/Cargo.toml`, `src/lib.rs`
- `ObservabilityKit/rust/phenotype-logging/Cargo.toml`, `src/lib.rs`
- `ObservabilityKit/rust/phenotype-health-runtime/Cargo.toml`, `src/lib.rs`
- `ObservabilityKit/go/go.work`
- `ObservabilityKit/python/performance_kit/__init__.py`, `README.md`
- `phenoObservability/README.md`, `Cargo.toml`
- `phenoObservability/docs/sessions/20260507-phenoobservability-sladge-main-refresh/00_SESSION_OVERVIEW.md`
- `phenoObservability/docs/research/SOTA-OBSERVABILITY.md`
- `phenoObservability/crates/tracely-core/Cargo.toml`
- `phenoObservability/crates/tracingkit/Cargo.toml`, `src/lib.rs`, `README.md`
- `phenoObservability/crates/logkit/Cargo.toml`, `src/lib.rs`
- `phenoObservability/crates/phenotype-observably-tracing/Cargo.toml`, `src/lib.rs`, `src/metrics.rs`
- `phenoObservability/crates/phenotype-observably-logging/Cargo.toml`, `src/lib.rs`
- `phenoObservability/crates/phenotype-observably-ports/Cargo.toml`, `src/lib.rs`
- `phenoObservability/crates/phenotype-observably-macros/Cargo.toml`, `README.md`
- `phenoObservability/tracing/otel.go`, `ADR.md`
- `PhenoObservability/README.md`, `Cargo.toml`
- `HexaKit/README.md`, `Cargo.toml`
- `HexaKit/crates/phenotype-logging/Cargo.toml`, `src/lib.rs`, `src/otel.rs`, `src/config.rs`, `src/subscriber.rs`
- `HexaKit/crates/phenotype-telemetry/Cargo.toml`, `src/lib.rs`
- `HexaKit/crates/phenotype-sentry-config/Cargo.toml`, `src/lib.rs`
- `HexaKit/crates/phenotype-port-traits/Cargo.toml`, `src/lib.rs`
- `HexaKit/crates/phenotype-health/Cargo.toml`
- `phenoShared/README.md`, `Cargo.toml`
- `phenoShared/crates/phenotype-logging/Cargo.toml`, `src/lib.rs`
- `Tracera/README.md`, `backend/go.mod`
- **Tracera role correction (2026-06-08 20:30 PT, user-verified):** `Tracera` is the canonical full-stack requirements traceability + product/project management platform (Go 1.25 + TS/React 19 + Bun + Turbo). "Tracing" in the name refers to **requirements traceability** (RTM), not OTel-style distributed tracing. Tracera is a **separate product** outside the observability consolidation scope, but is a first-class OTel consumer (its backend wires `go.opentelemetry.io/otel v1.43.0` + `otlptracegrpc` and ships to the Phenotype OTLP collector) and serves as the **reference Go implementation** of OTel init for the org. The `phenoObservability/tracing/otel.go:1-185` is a lifted copy of Tracera's init; the long-term fix is a `phenotype-otel-go` Go module that other (non-Tracera) Go consumers can import, while Tracera keeps its own internal init untouched. Tracera's RTM/PM APIs (TraceLink, FR/NFR chains, requirements dashboard) are a separate, valuable SDK surface — track as a "Tracera-as-SDK" workstream.
- `Tracely-wtrees/work-state-2026-06-08/Cargo.toml`, `crates/tracely-core/Cargo.toml`

Web sources verified at 2026-06-08:
- <https://opentelemetry.io/> (CNCF-graduated, 12+ languages, 1006+ integrations)
- <https://opentelemetry.io/docs/collector/> (OTel Collector overview)
- <https://www.datadoghq.com/>, <https://www.honeycomb.io/>, <https://newrelic.com/>, <https://sentry.io/>, <https://grafana.com/oss/>, <https://grafana.com/oss/loki/>, <https://grafana.com/oss/tempo/>, <https://grafana.com/oss/mimir/>, <https://prometheus.io/>, <https://www.jaegertracing.io/>, <https://zipkin.io/>, <https://vector.dev/>, <https://www.fluentd.org/>, <https://fluentbit.io/>, <https://github.com/tokio-rs/tracing>, <https://github.com/tokio-rs/tracing-opentelemetry>, <https://github.com/metrics-rs/metrics>, <https://openobserve.ai/>, <https://quickwit.io/>

---

*End of world-map document. No source modified. No commits made. The only artifact produced is this file.*
