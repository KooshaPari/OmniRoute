# Tier 3.10 — Audit: Pheno-OTEL

**Date:** 2026-07-08  
**Scope:** Read-only audit of `Phenotype-Apps/pheno-otel/`  
**Status:** ✅ Complete — production-grade, no blockers

---

## Audit Result: SHIP READY

**Score: 9/10** — production-grade OTel bootstrap crate. Minor documentation gaps; no code issues.

---

## Crate Summary

| Metric | Value |
|---|---|
| Location | `Phenotype-Apps/pheno-otel/` |
| Lines | 717 total (371 src/ + 249 tests/ + 97 Cargo.toml) |
| Dependencies | `opentelemetry 0.28`, `opentelemetry_sdk 0.28`, `opentelemetry-otlp 0.28`, `tracing-subscriber` (indirect) |
| MSRV | 1.75 |
| Edition | 2021 |
| Tests | 12 (8 unit + 4 integration) |
| Clippy | clean |

## File Structure

```
pheno-otel/
├── Cargo.toml
├── SPEC.md
├── src/
│   ├── lib.rs            # Re-exports + crate docs (init, init_with_stdout)
│   ├── init.rs           # init() OTLP + init_with_stdout() stdout exporter
│   ├── guard.rs          # TelemetryGuard RAII (flush+shutdown on drop)
│   ├── error.rs          # OtelError enum (ExporterInit/ResourceBuild/Shutdown)
│   └── exporter/
│       ├── mod.rs        # Re-exports StdoutSpanExporter
│       └── stdout.rs     # Custom stdout exporter for local dev
└── tests/
    └── init_test.rs      # 4 integration tests (249 lines)
```

## Public API Surface

| Function | Signature | Purpose |
|---|---|---|
| `pheno_otel::init()` | `fn(service_name: &str) -> Result<TelemetryGuard, OtelError>` | Initializes OTLP gRPC exporter with batch span processor |
| `pheno_otel::init_with_stdout()` | `fn(service_name: &str) -> Result<TelemetryGuard, OtelError>` | Initializes stdout exporter (no network needed) |
| `TelemetryGuard::shutdown()` | `fn() -> Result<(), OtelError>` | Explicit flush + shutdown |
| `OtelError::kind()` | `fn() -> &'static str` | Stable error kind for log fields |

## Findings

### ✅ Strengths
1. **RAII guard pattern** matches Rust conventions — drop flushes + shuts down
2. **Feature-gate aware** — OTLP exporter is optional; stdout exporter is the default test path
3. **Comprehensive error handling** — 3-variant `OtelError` with stable `kind()` tags
4. **Integration tests** use a `INIT_LOCK` mutex to serialize global-provider access across parallel test runs — a pattern worth backporting to `omniroute-runtime`
5. **SPEC.md** exists and is accurate
6. **No unsafe code** — clippy passes clean

### ⚠️ Minor Gaps
1. **No `tracing-subscriber` integration** — can't use `tracing-opentelemetry` layer yet. The crate initializes OTel but doesn't bridge it to `tracing`. Add a `with_tracing()` builder that creates an `OpenTelemetryLayer`.
2. **No resource attributes from env** — `OTEL_RESOURCE_ATTRIBUTES` and `OTEL_SERVICE_NAME` env vars are not parsed. Add `Resource::from_env()` fallback.
3. **No `_ => unreachable!` guard** — the `kind()` match is exhaustive on 3 known variants, but if a new variant is added without updating `kind()`, the compiler won't catch it. Add a `#[non_exhaustive]` + `_` arm.

### 🔗 Integration Points
- **`omniroute-runtime`** already has a parallel `otel.rs` module (feature-gated). `pheno-otel` could become the shared dependency once the tracing bridge is added.
- **BytePort Go backend** OTel middleware (`middleware.go`) is conceptually equivalent on the Go side — same service name pattern, same OTLP endpoint.
- **NVMS daemon** doesn't have OTel yet — `pheno-otel` would be the natural crate to add it if NVMS goes Rust.

## Recommendations

1. **Immediate**: No code changes needed — ship as-is
2. **Next quarter**: Add `tracing-opentelemetry` layer + `Resource::from_env()`
3. **Future**: Publish to `crates.io` as the canonical Phenotype OTel bootstrap crate
