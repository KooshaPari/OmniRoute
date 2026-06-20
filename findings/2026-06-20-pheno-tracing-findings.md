# pheno-tracing — Repository Findings

**Date:** 2026-06-20
**Device:** macbook
**Layer:** L5 (substrate-level audit)
**Repo:** `pheno-tracing/` — Port-driven distributed tracing substrate (Rust)
**Status:** ACTIVE — ADR-036 compliant, v0.1.0 (pre-release)

---

## 1. Overview

`pheno-tracing` is the **canonical port-driven distributed tracing substrate** in the Phenotype ecosystem (per ADR-036). It provides a hexagonal L4 `TracePort` trait with domain types (`TraceOperation`, `TraceResult`, `TraceId`, `SpanId`, `SpanKind`) and two built-in adapter implementations (InMemory for tests, Stdout for debugging). Future adapters (OTLP, Jaeger, Honeycomb) are planned.

**Language:** Rust (edition 2021)
**Target:** Standalone library crate (no workspace)
**License:** MIT OR Apache-2.0
**Status:** v0.1.0 unreleased (pre-release)

---

## 2. Repository Structure

```
pheno-tracing/
├── src/
│   ├── lib.rs              # Crate root — re-exports, module declarations (35 lines)
│   ├── port.rs             # TracePort trait + domain types (67 lines)
│   ├── config.rs           # TracingConfig via figment (275 lines)
│   └── adapters.rs         # InMemoryAdapter + StdoutAdapter (73 lines)
├── tests/
│   ├── adapter_tests.rs    # 3 tests for StdoutAdapter
│   └── port_integration.rs # 4 tests for InMemoryAdapter
├── Cargo.toml              # Standalone package manifest
├── VERSION.toml            # Single-source version (0.1.0)
├── .github/workflows/ci.yml  # 7-job CI pipeline
├── README.md, AGENTS.md, SPEC.md, CHANGELOG.md, WORKLOG.md
├── PR_DESCRIPTION.md, llms.txt
└── default_*.profraw       # 4 LLVM coverage artifacts (should be gitignored)
```

---

## 3. Core Architecture — Hexagonal L4 (Port/Adapter)

```
┌─────────────────────────────────────────────┐
│ Consumer (pheno-errors, pheno-context, etc.) │
│   depends on pheno-tracing for span submit   │
└────────────────────┬────────────────────────┘
                     │ TracePort::submit(TraceOperation)
                     ▼
┌─────────────────────────────────────────────┐
│ pheno-tracing                                │
│   - TracePort trait (port)                   │
│   - TraceOperation / TraceResult / types     │
│   - InMemoryAdapter (test)                   │
│   - StdoutAdapter (debug)                    │
│   - (future: OtlpAdapter, JaegerAdapter)     │
└────────────────────┬────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────┐
│ tracing + tracing-subscriber + tracing-      │
│ opentelemetry → OTLP → Collector/Backend     │
└─────────────────────────────────────────────┘
```

---

## 4. The Port Layer (`src/port.rs`, 67 lines)

### 4.1 Domain Types

| Type | Description |
|---|---|
| `TraceId(pub String)` | 128-bit trace identifier (base16 per OTLP) |
| `SpanId(pub String)` | 64-bit span identifier (base16 per OTLP) |
| `SpanKind` enum | `Internal`, `Client`, `Server`, `Producer`, `Consumer` (matches OTel) |
| `TraceOperation` | Full span payload: trace_id, span_id, parent_span_id, kind, name, attributes |
| `TraceResult` | Submission response: trace_id, span_id, status: TraceStatus |
| `TraceStatus` enum | `Ok` or `Error(String)` |

All types derive `Debug`, `Clone`, `Serialize`, `Deserialize`.

### 4.2 TracePort Trait

```rust
#[async_trait]
pub trait TracePort: Send + Sync {
    async fn submit(&self, op: TraceOperation) -> TraceResult;
    async fn flush(&self) -> Result<(), String>;
}
```

---

## 5. Adapters (`src/adapters.rs`, 73 lines)

### 5.1 InMemoryAdapter

```rust
pub struct InMemoryAdapter {
    pub spans: Arc<Mutex<Vec<TraceOperation>>>,
}
```
- Thread-safe via `Arc<Mutex<Vec<TraceOperation>>>`
- `submit()`: clones operation into buffer, returns `TraceStatus::Ok`
- `flush()`: no-op
- **Purpose:** Unit/integration tests — lock `spans` and assert on submitted traces

### 5.2 StdoutAdapter

```rust
pub struct StdoutAdapter;  // Zero-sized type
```
- `submit()`: prints `[TRACE] trace=<id> span=<name> kind=<kind>` to stdout
- `flush()`: no-op
- **Purpose:** Local debugging, not for production

---

## 6. Configuration (`src/config.rs`, 275 lines)

### 6.1 TracingConfig — Figment-backed with 4-layer priority

1. **Defaults**: `log_level: "info"`, `format: Json`, no OTLP
2. **`pheno-tracing.toml`** — optional file on disk (documented but **not wired**)
3. **`PHENO_TRACING_*` env vars**
4. **OTel env vars** (`OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SDK_DISABLED`)

### 6.2 Configuration Fields

| Field | Type | Default | Env Override |
|---|---|---|---|
| `service_name` | `Option<String>` | `None` | `PHENO_TRACING_SERVICE_NAME` |
| `log_level` | `String` | `"info"` | `PHENO_TRACING_LOG_LEVEL` |
| `format` | `Format` | `Format::Json` | `PHENO_TRACING_FORMAT` |
| `otlp_endpoint` | `Option<String>` | `None` | `PHENO_TRACING_OTLP_ENDPOINT` / `OTEL_EXPORTER_OTLP_ENDPOINT` |
| `otlp_disabled` | `bool` | `false` | `OTEL_SDK_DISABLED` |

### 6.3 ConfigError

```rust
pub enum ConfigError {
    Invalid(String),
    FileNotFound(String),
}
```

---

## 7. Dependencies

| Dependency | Version | Role |
|---|---|---|
| `async-trait` | 0.1 | Async fn in traits |
| `figment` | 0.10 (env, toml) | Multi-source config |
| `serde` | 1.0 (derive) | Serialization for all types |
| `serde_json` | 1.0 | JSON serialization |
| `thiserror` | 2 | Error derive |
| `tokio` | 1 (full) | Async runtime |
| `tracing` | 0.1 | Core tracing framework |
| `tracing-subscriber` | 0.3 (env-filter, fmt, json) | Subscriber implementations |
| `chrono` | 0.4 (serde) | Timestamp handling |

---

## 8. Test Coverage

### Tests (`tests/adapter_tests.rs`, 3 tests)

| Test | What it covers |
|---|---|
| `test_stdout_adapter_submits_span` | Submit Client span, verify status, IDs |
| `test_stdout_adapter_with_parent_span` | Submit with parent_span_id, Server kind, attributes |
| `test_stdout_adapter_flush` | flush() returns Ok |

### Tests (`tests/port_integration.rs`, 4 tests)

| Test | What it covers |
|---|---|
| `test_in_memory_adapter_submits_span` | Submit Internal span, verify buffer |
| `test_in_memory_adapter_records_attributes` | Submit with Kafka-style attributes |
| `test_in_memory_adapter_flush` | flush() returns Ok |
| `test_in_memory_adapter_parent_child_relationship` | Parent + child, verify tree |

### Unit tests (in `config.rs`, ~5 tests)

Defaults, builder, env vars, OTel fallback, service_name required

**Total:** 12 tests (7 integration + 4 unit + 1 doctest)
**Coverage gate:** 80% line coverage per ADR-023 Rule 3.1 (enforced via `cargo-llvm-cov` + Codecov)

### CI Pipeline (7 parallel jobs)

| Job | Tool | Purpose |
|---|---|---|
| `test` | `cargo test` | All features + no-default-features |
| `fmt` | `cargo fmt --check` | Rustfmt conformance |
| `clippy` | `cargo clippy -D warnings` | Lint gate |
| `audit` | `cargo-audit` | Security vulnerability scan |
| `deny` | `cargo-deny` | License/dependency check |
| `coverage` | `cargo-llvm-cov` | 80% coverage gate |
| `otlp_smoke_test` | `cargo build + test` | OTLP wiring verification |

---

## 9. Key Observations & Gaps

1. **`llms.txt` vs source mismatch**: Documents reference `pheno_tracing::init()` and `init_with_format()` that **do not exist** in the current source. These are planned ADR-012 integration functions.

2. **No `TracingError` type**: Referenced in docs but not implemented. Only `ConfigError` exists.

3. **`pheno-tracing.toml` file loading not wired**: The figment stack doesn't merge the TOML file — only `Serialized::defaults()` + `Env` providers are wired.

4. **No OTLP adapter yet**: Only `InMemoryAdapter` and `StdoutAdapter` exist. Spec mentions future `OtlpAdapter`, `JaegerAdapter`, `HoneycombAdapter`.

5. **4 `.profraw` files in root**: LLVM coverage artifacts that should be gitignored.

6. **All IDs are `String`-based**: No use of `uuid`, `opentelemetry::SpanId`, or other strong types. Keeps port layer dependency-free but means ID generation is the consumer's responsibility.

7. **Well-documented**: Comprehensive SPEC.md, AGENTS.md, WORKLOG.md with proper ADR references.

---

## 10. Recommendations

1. **Implement `init()` and `init_with_format()`** to match documented API surface
2. **Wire `pheno-tracing.toml` file loading** in the figment stack
3. **Implement `OtlpAdapter`** — the most critical production adapter
4. **Add `.profraw` to `.gitignore`** — 4 stale coverage artifacts
5. **Add `TracingError` type** as documented
6. **Add strong-typed ID wrappers** or document that consumers own ID generation
7. **Add an `OtlpAdapter` implementation** as the production backend spike
