# phenotype-otel — Repository Findings

**Date:** 2026-06-20
**Device:** macbook
**Layer:** L5 (substrate-level audit)
**Repo:** `phenotype-otel/` — Canonical OTLP bridge substrate (Rust)
**Status:** ACTIVE — Turnkey OpenTelemetry initialization for pheno-* services, v0.1.0

---

## 1. Overview

`phenotype-otel` is the **canonical OpenTelemetry bridge substrate** for the Phenotype ecosystem. It provides a turnkey `init()` call that configures the full OTLP pipeline: `tracing-subscriber` → `tracing-opentelemetry` layer → OTel SDK TracerProvider → OTLP HTTP exporter. Ships as a workspace with 3 crates: core bridge, figment-backed config, and extensible backend registry.

**Language:** Rust (edition 2021)
**Target:** Library crate (workspace with 3 members)
**License:** MIT OR Apache-2.0 (triple-licensed: MIT + Apache-2.0 + MIT)
**Release:** v0.1.0

---

## 2. Workspace Structure

```
phenotype-otel/
├── src/
│   └── lib.rs                         # Core OTLP bridge (389 lines)
├── pheno-otel-config/
│   ├── Cargo.toml                     # Config sub-crate manifest
│   └── src/lib.rs                     # Figment-backed OtelSettings (360 lines)
├── phenotype-otel-backends/
│   ├── Cargo.toml                     # Backends sub-crate manifest
│   └── src/lib.rs                     # Backend trait + StdoutBackend + OtlpBackend stub (292 lines)
├── examples/
│   └── basic.rs                       # Runnable smoke test (37 lines)
├── docs/
│   ├── intent/                        # Intent docs, assumptions, synthesis
│   ├── security/THREAT_MODEL.md       # STRIDE threat model
│   ├── sota/technical.md              # Language placement
│   ├── slsa.md                        # SLSA Build L2 attestation
│   └── traceon-migration.md           # Traceon archive status
├── .github/workflows/
│   ├── ci.yml                         # Push/PR CI
│   ├── release-attestation.yml        # SLSA Build L2 provenance
│   └── release-plz.yml                # Automated publishing
├── Cargo.toml                         # Workspace root + pheno-otel package
├── Cargo.lock
├── justfile                           # Task runner
├── Taskfile.yml                       # Go-task runner
├── moon.yml                           # Moon project config
├── .moon/workspace.yml                # Moon v2 orchestration
├── deny.toml                          # cargo-deny policy
├── cliff.toml                         # git-cliff changelog config
├── audit_scorecard.json               # 48% grade D
├── charter.md, intent.md, SOTA.md, review.md
├── AGENTS.md, README.md, CHANGELOG.md, CONTRIBUTING.md, SECURITY.md
└── phenodag.db                        # Built-in SQLite fleet state DB
```

---

## 3. Core Library — OTLP Bridge (`src/lib.rs`, 389 lines)

### 3.1 Public API

```rust
pub fn init(service_name: &str) -> Result<(), OtelBridgeError>
pub fn init_with_endpoint(service_name: &str, otlp_endpoint: &str) -> Result<(), OtelBridgeError>
pub fn shutdown()
```

### 3.2 OtelConfig Builder

| Method | Description |
|---|---|
| `OtelConfig::new(service_name)` | Defaults to `http://localhost:4318` |
| `from_env(service_name)` | Reads `OTEL_EXPORTER_OTLP_ENDPOINT` |
| `with_endpoint(endpoint)` | Explicit override |
| `with_attribute(key, value)` | Adds resource attribute (last-write-wins) |
| `init(self)` | Full initialization |

### 3.3 Init Flow (`OtelConfig::init()`)

1. **Resource construction**: `service.name` + extra attributes → `Vec<KeyValue>`
2. **OTLP HTTP exporter**: `opentelemetry_otlp` HTTP/protobuf exporter (not gRPC)
3. **TracerProvider**: Batch span processor (Tokio runtime) + `AlwaysOn` sampler + resource
4. **Global registration**: `opentelemetry::global::set_tracer_provider()`
5. **Tracing bridge**: `tracing_opentelemetry::layer()` connected to tracer
6. **Subscriber init**: `tracing_subscriber::registry()` with `EnvFilter` + OTel layer
7. **Shutdown**: `opentelemetry::global::shutdown_tracer_provider()` flushes buffered spans

### 3.4 Key Types

| Type | Purpose |
|---|---|
| `OtelConfig` | Fluent builder for OTLP bridge configuration |
| `OtelBridgeError` | `Export(String)` | `Subscriber(String)` |
| `Attribute` | Re-export of `opentelemetry::KeyValue` |

---

## 4. Configuration Sub-crate (`pheno-otel-config`, 360 lines)

### 4.1 OtelSettings — Figment-backed with 3-layer priority

1. Hardcoded defaults (from `Default` impl)
2. TOML config file (path from `PHENO_OTEL_CONFIG` env var)
3. Environment variables: `OTEL_EXPORTER_OTLP_ENDPOINT`, `RUST_LOG`, `PHENO_OTEL_SAMPLER`

### 4.2 Configuration Fields

| Field | Type | Default | Env Override |
|---|---|---|---|
| `otlp_endpoint` | `String` | `http://localhost:4318` | `OTEL_EXPORTER_OTLP_ENDPOINT` |
| `log_filter` | `String` | `info` | `RUST_LOG` |
| `service_name` | `Option<String>` | `None` | N/A (caller supplies) |
| `resource_attributes` | `HashMap<String, String>` | empty | N/A |
| `sampler` | `String` | `always_on` | `PHENO_OTEL_SAMPLER` |
| `batch_export_timeout_secs` | `u64` | 10 | N/A |
| `batch_max_queue_size` | `usize` | 2048 | N/A |
| `batch_max_export_batch_size` | `usize` | 512 | N/A |

### 4.3 Config Error

```rust
pub enum ConfigError {
    FileNotFound(String),
    Extraction(String),
}
```

**Note:** The core library (`pheno-otel`) currently uses its own simpler `OtelConfig` builder and does NOT yet consume `OtelSettings`. The config sub-crate is fully implemented but not integrated into `init()`.

---

## 5. Backends Sub-crate (`phenotype-otel-backends`, 292 lines)

### 5.1 Core Data Type

```rust
pub struct Span {
    pub name: String,
    pub trace_id: String,          // 32-hex-char
    pub span_id: String,           // 16-hex-char
    pub start_time: SystemTime,
    pub end_time: SystemTime,
    pub attributes: Vec<(String, String)>,
}
```

**Key design decision:** Intentionally decoupled from `opentelemetry::trace::SpanContext`. Self-contained data record with `Serialize`/`Deserialize`.

### 5.2 Backend Trait & Registry

```rust
pub trait Backend: Send + Sync {
    fn name(&self) -> &str;
    fn export(&self, spans: &[Span]) -> Result<(), BackendError>;
    fn health(&self) -> Result<(), BackendError>;
}

pub struct BackendRegistry {
    backends: HashMap<String, Box<dyn Backend>>,
}
```

### 5.3 Built-in Backends

| Backend | `name()` | `export()` | `health()` |
|---|---|---|---|
| `StdoutBackend` | `"stdout"` | JSON println! each span | Always Ok |
| `OtlpBackend` | `"otlp"` | **No-op (stub)** | **No-op (stub)** |

---

## 6. Dependencies

### Core (`pheno-otel`)

| Dependency | Version | Features | Role |
|---|---|---|---|
| `opentelemetry` | 0.24 | trace | Core OTel API |
| `opentelemetry-otlp` | 0.17 | trace, http-proto, reqwest-client | OTLP HTTP exporter |
| `opentelemetry_sdk` | 0.24 | trace, rt-tokio | TracerProvider builder |
| `opentelemetry-semantic-conventions` | 0.16 | — | Resource attribute conventions |
| `pheno-otel-config` | path | — | Config sub-crate |
| `tracing` | 0.1 | — | Structured diagnostics |
| `tracing-opentelemetry` | 0.25 | — | Tracing ↔ OTel bridge |
| `tracing-subscriber` | 0.3 | env-filter, fmt, registry | Subscriber registry |
| `thiserror` | 1 | — | Error derive |

### Config (`pheno-otel-config`)

| Dependency | Role |
|---|---|
| `serde` (derive) | Deserialize `OtelSettings` |
| `figment` (toml, env) | Multi-provider config |
| `thiserror` | Error derive |

### Backends (`phenotype-otel-backends`)

| Dependency | Role |
|---|---|
| `thiserror` | Error derive |
| `serde` (derive) | Span serialization |
| `serde_json` | JSON output |

---

## 7. Test Coverage

| Crate | Tests | Pattern |
|---|---|---|
| `pheno-otel` (core) | 18 | Pure data-structure/unit — no live OTLP connections |
| `pheno-otel-config` | 12 | Pure unit — env var manipulation |
| `phenotype-otel-backends` | 12 | Unit — no external deps |

**Total:** 42 tests
**Coverage coverage:** No integration tests — example serves as manual smoke test
**Patterns:** No mocking frameworks, no test fixtures, no async tests, env vars manually saved/restored

---

## 8. CI/CD

- **CI** (`.github/workflows/ci.yml`): Rust fmt + clippy → cargo check + test → cargo-deny → cargo-audit → TruffleHog → build example
- **Release** (`release-plz.yml`): Auto-opens release PR, publishes to crates.io on tag
- **SLSA Build L2** (`release-attestation.yml`): Provenance generation on release

---

## 9. Key Observations

1. **Thin bridge philosophy**: "No tracing domain logic" per charter. Single `init()` call wraps the entire OTLP setup.

2. **Workspace separation**: Config and backends are separate crates for independent versioning.

3. **OTLP HTTP only**: Uses HTTP/protobuf (not gRPC) via `reqwest-client` feature.

4. **Tokio runtime hardcoded**: Batch exporter uses `opentelemetry_sdk::runtime::Tokio` — no async runtime abstraction.

5. **AlwaysOn sampling**: No configurable sampling in core (config sub-crate supports sampler field but not wired).

6. **Configuration gap**: `pheno-otel-config` is fully built but not integrated into core `init()`. Core uses its own simpler builder.

7. **Backend span decoupled**: The `Span` type is intentionally separate from `opentelemetry::trace::SpanContext` — `From`/`Into` conversions deferred.

8. **Audit score: 48% (Grade D)** — significant room for improvement across all pillars.

---

## 10. Recommendations

1. **Wire `pheno-otel-config` into core `init()`** — eliminate the config gap
2. **Add async integration tests** with a real or mocked OTLP collector
3. **Implement `OtlpBackend`** — currently a no-op stub
4. **Add configurable sampling** to the core library
5. **Implement `From<opentelemetry::trace::SpanData>` for `Span`** — bridge the backend decoupling
6. **Improve audit score** — current 48% D grade needs pillar improvements
