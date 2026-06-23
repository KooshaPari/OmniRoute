# SIDE-40 — `Display` impl coverage for `pheno-*` Rust crates

**Date:** 2026-06-22
**Task:** SIDE-40
**Scope:** All `pheno-*` Rust crates with source present in the local sparse-checkout
cone on `chore/l5-87-focus-repo-specs-2026-06-11` @ 2026-06-22.
**Method:** Static analysis. Detect `Display` from direct `impl Display for X`,
`#[derive(Display)]` (incl. `derive_more::Display`, `strum::Display`, etc.),
`#[derive(thiserror::Error)]` with at least one variant carrying `#[error("...")]`,
and `macro_rules!` invocations whose body contains `Display for $ty`. Script:
`/tmp/side40_analyze.py` (raw JSON: `/tmp/side40_results.json`).

---

## 1. Fleet summary

| Metric                         | Value      |
| ------------------------------ | ---------- |
| Rust crates scanned            | **10**     |
| Public types counted           | **68**     |
| Public types with `Display`    | **17**     |
| **Fleet coverage**             | **25.0 %** |
| Error types with `Display`     | **8 / 8**  |
| Non-error types with `Display` | **9 / 60** |

**Headline finding:** error types are **fully covered** (8/8 = 100 %).
Non-error public types are the entire gap (9/60 = 15 %). One crate
(`pheno-config`) is at 100 % via a `Display`-generating macro; one
crate (`pheno-cli-base`) is at 0 % (no `Display` on either public
type).

---

## 2. Per-crate coverage

Coverage = (public types with `Display` impl, direct or via derive /
macro) / (public types declared in `src/`, deduped by name).
`pub(crate)` types are **included**; types in private `mod foo { ... }`
blocks are **excluded**; types in `pub mod` blocks are included.
Definitions in `tests/`, `examples/`, and `benches/` are excluded —
only `src/` types count.

| Crate                | Total | w/ Display | Coverage | Mechanism used                              |
| -------------------- | -----:| ----------:| --------:| ------------------------------------------- |
| `pheno-config`       | 3     | 3          | **100.0 %** | `macro_rules! impl_secret_fmt!` (3 newtypes) |
| `pheno-context`      | 3     | 2          | 66.7 %   | direct impl + thiserror                     |
| `pheno-errors`       | 2     | 1          | 50.0 %   | thiserror                                   |
| `pheno-flags`        | 2     | 1          | 50.0 %   | thiserror                                   |
| `pheno-events`       | 4     | 1          | 25.0 %   | thiserror                                   |
| `pheno-otel`         | 16    | 4          | 25.0 %   | direct impl + thiserror                     |
| `pheno-port-adapter` | 9     | 2          | 22.2 %   | thiserror                                   |
| `pheno-chaos`        | 9     | 2          | 22.2 %   | direct impl                                 |
| `pheno-tracing`      | 18    | 1          |  5.6 %   | direct impl                                 |
| `pheno-cli-base`     | 2     | 0          |  0.0 %   | (none)                                      |
| **FLEET**            | **68**| **17**     | **25.0 %** | mixed                                     |

---

## 3. Per-crate type inventory

Each entry lists every public type in the crate's `src/`, with the
mechanism that provides `Display` (where applicable) and the source
location (`path:line`).

### 3.1 `pheno-config` — 3/3 (100.0 %)

| Status | Type         | File:line                | Mechanism                                       |
| :----: | :----------- | :----------------------- | :---------------------------------------------- |
|   +    | `ApiKey`        | `pheno-config/src/secrets.rs:119` | `macro_rules! impl_secret_fmt!(ApiKey)`        |
|   +    | `BearerToken`   | `pheno-config/src/secrets.rs:130` | `macro_rules! impl_secret_fmt!(BearerToken)`   |
|   +    | `DbPassword`    | `pheno-config/src/secrets.rs:141` | `macro_rules! impl_secret_fmt!(DbPassword)`    |

The `impl_secret_fmt!` macro (`pheno-config/src/secrets.rs:56`) emits
both `Display` (writes `"***REDACTED***"`) and `Debug` (writes
`ApiKey(***REDACTED***)`) for each newtype. Coverage is **100 %** and
the secrets are un-leakable by design (ADR-078 redaction policy is
centralized in the macro body).

### 3.2 `pheno-context` — 2/3 (66.7 %)

| Status | Type          | File:line                | Mechanism                                          |
| :----: | :------------ | :----------------------- | :------------------------------------------------- |
|   +    | `ContextError`   | `pheno-context/src/lib.rs:8`   | `#[derive(thiserror::Error)]` + `#[error("...")]`  |
|   +    | `Context`        | `pheno-context/src/lib.rs:30`  | `impl fmt::Display for Context`                    |
|   -    | `ContextBuilder` | `pheno-context/src/lib.rs:41`  | (missing)                                          |

### 3.3 `pheno-errors` — 1/2 (50.0 %)

| Status | Type     | File:line                    | Mechanism                                                          |
| :----: | :------- | :--------------------------- | :----------------------------------------------------------------- |
|   +    | `AppError`  | `pheno-errors/src/lib.rs:77`     | `#[derive(thiserror::Error)]` + `#[error("...")]` on every variant |
|   -    | `Problem`   | `pheno-errors/src/rfc7807.rs:51` | (missing — has only `Debug, Clone, PartialEq, Eq, Serialize`)      |

`Problem` is the RFC 7807 wire-format struct. It currently serialises to
JSON but has no `Display`. Adding `impl Display for Problem` would be a
trivial follow-up (it could just forward to the JSON serialization or
format the `type` / `title` / `status` / `detail` fields).
**Recommendation:** add `Display` — many crates that consume `Problem`
for logging need it.

### 3.4 `pheno-flags` — 1/2 (50.0 %)

| Status | Type     | File:line                  | Mechanism                                                                  |
| :----: | :------- | :------------------------- | :------------------------------------------------------------------------- |
|   +    | `FlagError` | `pheno-flags/src/lib.rs:73`   | `#[derive(Debug, Error, PartialEq, Eq)]` + `#[error("...")]`              |
|   -    | `FlagSet`   | `pheno-flags/src/lib.rs:94`   | (missing — has `Debug, Clone, Default, PartialEq, Eq`)                     |

`FlagSet` is a `HashMap<String, bool>` wrapper. `Display` is non-essential
but useful for `--print-flags` debug output.

### 3.5 `pheno-events` — 1/4 (25.0 %)

| Status | Type                | File:line                          | Mechanism                                          |
| :----: | :------------------ | :--------------------------------- | :------------------------------------------------- |
|   +    | `EnvelopeError`        | `pheno-events/src/core/mod.rs:48`       | `#[derive(thiserror::Error)]` + `#[error("...")]`  |
|   -    | `Ack`                  | `pheno-events/src/lib.rs:40`            | (missing)                                          |
|   -    | `EventEnvelope`        | `pheno-events/src/core/mod.rs:35`       | (missing)                                          |
|   -    | `EventEnvelopeBuilder` | `pheno-events/src/core/mod.rs:92`       | (missing — builder; less critical)                 |

`EventEnvelope` is the canonical data type of the crate and is logged
heavily. **Recommendation:** add `Display` to `EventEnvelope` (the wire
format and the log format are likely very close).

### 3.6 `pheno-otel` — 4/16 (25.0 %)

| Status | Type                    | File:line                                          | Mechanism                                          |
| :----: | :---------------------- | :------------------------------------------------- | :------------------------------------------------- |
|   +    | `PropagationError`         | `pheno-otel/src/propagation.rs:101`       | `impl std::fmt::Display for PropagationError`      |
|   +    | `StdoutSpanExporter`       | `pheno-otel/src/exporter/stdout.rs:25`    | `impl fmt::Display for StdoutSpanExporter`         |
|   +    | `OtlpError`                | `pheno-otel/src/lib.rs:38`                | `#[derive(thiserror::Error)]` + `#[error("...")]`  |
|   +    | `OtelError`                | `pheno-otel/src/error.rs:20`              | `#[derive(thiserror::Error)]` + `#[error("...")]`  |
|   -    | `Route`                    | `pheno-otel/src/histogram.rs:47`          | (missing)                                          |
|   -    | `Status`                   | `pheno-otel/src/histogram.rs:78`          | (missing)                                          |
|   -    | `Labels`                   | `pheno-otel/src/histogram.rs:100`         | (missing)                                          |
|   -    | `LatencyHistogram`         | `pheno-otel/src/histogram.rs:125`         | (missing)                                          |
|   -    | `HistogramSnapshot`        | `pheno-otel/src/histogram.rs:210`         | (missing)                                          |
|   -    | `ExportHandle`             | `pheno-otel/src/lib.rs:56`                | (missing — opaque handle)                          |
|   -    | `TelemetryGuard`           | `pheno-otel/src/guard.rs:31`              | (missing)                                          |
|   -    | `SpanContext`              | `pheno-otel/src/propagation.rs:56`        | (missing — very important)                         |
|   -    | `W3CTraceContextPropagator`| `pheno-otel/src/propagation.rs:135`       | (missing)                                          |
|   -    | `ExporterConfig`           | `pheno-otel/src/exporters/mod.rs:12`      | (missing)                                          |
|   -    | `HttpExporter`             | `pheno-otel/src/exporters/http.rs:11`     | (missing)                                          |
|   -    | `StdoutExporter`           | `pheno-otel/src/exporters/stdout.rs:10`   | (missing)                                          |

**`SpanContext` is the highest-impact gap** — it is the canonical
`OTel`-style trace identifier pair and is the most frequently
stringified / displayed value across the entire fleet.
**Recommendation:** add `Display` (format as
`trace_id=... span_id=...`).

### 3.7 `pheno-port-adapter` — 2/9 (22.2 %)

| Status | Type          | File:line                                          | Mechanism                                          |
| :----: | :------------ | :------------------------------------------------- | :------------------------------------------------- |
|   +    | `AdapterError`   | `pheno-port-adapter/src/lib.rs:39`          | `#[derive(thiserror::Error)]` + `#[error("...")]`  |
|   +    | `CacheError`     | `pheno-port-adapter/src/ports/cache.rs:50`  | `#[derive(thiserror::Error)]` + `#[error("...")]`  |
|   -    | `Connection`     | `pheno-port-adapter/src/lib.rs:62`          | (missing — opaque handle)                          |
|   -    | `SystemClock`    | `pheno-port-adapter/src/adapters/system_clock.rs:30` | (missing)                                   |
|   -    | `UnixAdapter`    | `pheno-port-adapter/src/adapters/unix.rs:27`      | (missing)                                   |
|   -    | `MockClock`      | `pheno-port-adapter/src/adapters/mock_clock.rs:39` | (missing)                                   |
|   -    | `RedisAdapter`   | `pheno-port-adapter/src/adapters/redis_cache.rs:45` | (missing)                                 |
|   -    | `InMemoryCache`  | `pheno-port-adapter/src/adapters/in_memory_cache.rs:40` | (missing)                             |
|   -    | `TcpAdapter`     | `pheno-port-adapter/src/adapters/tcp.rs:22`      | (missing)                                   |

Adapter structs and clock implementations are the primary public surface
of this crate. `Display` is desirable for log output (e.g.
`adapter=tcp state=connected`). The `PortAdapter` trait already exposes
`fn name(&self) -> &str;` — a blanket `impl<T: PortAdapter> Display for T`
**is impossible** (no orphan-rule cover) but each adapter could use a
derive. **Recommendation:** add `#[derive(Display)]` from `strum` or
`derive_more` to each enum / struct, or write a tiny
`impl_display_for_adapter!` macro similar to `impl_secret_fmt!` in
`pheno-config`.

### 3.8 `pheno-chaos` — 2/9 (22.2 %)

| Status | Type          | File:line                                                  | Mechanism                                  |
| :----: | :------------ | :--------------------------------------------------------- | :----------------------------------------- |
|   +    | `ChaosError`     | `pheno-chaos/crates/pheno-chaos/src/fault.rs:113`    | `impl std::fmt::Display for ChaosError`    |
|   +    | `FaultKind`      | `pheno-chaos/crates/pheno-chaos/src/runtime.rs:42`   | `impl std::fmt::Display for FaultKind`     |
|   -    | `ChaosConfig`    | `pheno-chaos/crates/pheno-chaos/src/runtime.rs:17`   | (missing)                                  |
|   -    | `CpuSpike`       | `pheno-chaos/crates/pheno-chaos/src/cpu.rs:39`       | (missing)                                  |
|   -    | `FaultGuard`     | `pheno-chaos/crates/pheno-chaos/src/fault.rs:16`     | (missing — guard handle)                   |
|   -    | `LatencyConfig`  | `pheno-chaos/crates/pheno-chaos/src/network.rs:44`   | (missing — `pub(crate)`, not user-facing)  |
|   -    | `NetworkLatency` | `pheno-chaos/crates/pheno-chaos/src/network.rs:90`   | (missing)                                  |
|   -    | `ConnectionDrop` | `pheno-chaos/crates/pheno-chaos/src/connection.rs:65`| (missing)                                  |
|   -    | `RstGuard`       | `pheno-chaos/crates/pheno-chaos/src/connection.rs:157`| (missing — guard handle)                  |

`LatencyConfig` is `pub(crate)` — counted here but not a public-API
target. The other 6 non-error types are public and would benefit from
`Display` (especially `ChaosConfig` for log / metric labelling).

### 3.9 `pheno-tracing` — 1/18 (5.6 %)

| Status | Type                | File:line                                | Mechanism                                          |
| :----: | :------------------ | :--------------------------------------- | :------------------------------------------------- |
|   +    | `TracingVersion`       | `pheno-tracing/src/compat.rs:54`     | `impl fmt::Display for TracingVersion`             |
|   -    | `SubscriberKind`       | `pheno-tracing/src/compat.rs:107`    | (missing — small enum)                             |
|   -    | `TracingBackend`       | `pheno-tracing/src/compat.rs:215`    | (missing)                                          |
|   -    | `TraceId`              | `pheno-tracing/src/port.rs:13`       | (missing — newtype)                                |
|   -    | `SpanId`               | `pheno-tracing/src/port.rs:17`       | (missing — newtype)                                |
|   -    | `SpanKind`             | `pheno-tracing/src/port.rs:21`       | (missing — small enum)                             |
|   -    | `TraceOperation`       | `pheno-tracing/src/port.rs:31`       | (missing)                                          |
|   -    | `TraceResult`          | `pheno-tracing/src/port.rs:42`       | (missing — `Result`-like enum)                     |
|   -    | `TraceStatus`          | `pheno-tracing/src/port.rs:50`       | (missing — small enum)                             |
|   -    | `InMemoryAdapter`      | `pheno-tracing/src/adapters.rs:18`   | (missing)                                          |
|   -    | `StdoutAdapter`        | `pheno-tracing/src/adapters.rs:66`   | (missing)                                          |
|   -    | `SpanContext`          | `pheno-tracing/src/sampling.rs:47`   | (missing — critical; same name as `pheno-otel::SpanContext` but distinct type) |
|   -    | `SamplingDecision`     | `pheno-tracing/src/sampling.rs:98`   | (missing — small enum)                             |
|   -    | `AlwaysSampler`        | `pheno-tracing/src/sampling.rs:147`  | (missing — marker struct)                          |
|   -    | `NeverSampler`         | `pheno-tracing/src/sampling.rs:161`  | (missing — marker struct)                          |
|   -    | `ParentBasedSampler`   | `pheno-tracing/src/sampling.rs:185`  | (missing)                                          |
|   -    | `RateLimitSampler`     | `pheno-tracing/src/sampling.rs:219`  | (missing)                                          |
|   -    | `TailBasedSampler`     | `pheno-tracing/src/sampling.rs:303`  | (missing)                                          |

**Lowest coverage in the fleet.** Marker structs (`AlwaysSampler`,
`NeverSampler`) arguably don't need `Display`. **High-priority gaps:**
`SpanContext` (core type), `SpanKind`, `SamplingDecision`, `TraceStatus`
(small enums — trivial with `strum::Display` derive),
`TracingBackend`, `SubscriberKind`, the adapter structs.

### 3.10 `pheno-cli-base` — 0/2 (0.0 %)

| Status | Type      | File:line                          | Mechanism  |
| :----: | :-------- | :--------------------------------- | :--------- |
|   -    | `ConfigArg` | `pheno-cli-base/src/config_arg.rs:14` | (missing)  |
|   -    | `Verbosity` | `pheno-cli-base/src/verbosity.rs:12`   | (missing)  |

`Verbosity` is a classic candidate for `Display` (it almost certainly
wants to print as `quiet` / `normal` / `verbose` / `debug`).
`ConfigArg` is a CLI argument parser; `Display` would help `--help` text
rendering.

---

## 4. Crates excluded from this analysis

The following `pheno-*` directories exist in the local checkout but are
**not Rust** (or have no `src/*.rs` files in the cone), so `impl Display`
does not apply. They are listed for completeness — the "coverage" metric
is Rust-specific.

| Directory                  | Language / reason excluded                              |
| -------------------------- | ------------------------------------------------------- |
| `pheno-chaos-macros`       | Proc-macro crate; doesn't impl `Display` on its own API |
| `pheno-mcp-router`         | Only `docs/`, `i18n/`, `pact/`, `PROMOTION.md` (no `src/`) |
| `pheno-drift-detector`     | Python (`pheno_drift_detector.py`)                      |
| `pheno-framework-lint`     | Python (`pheno_framework_lint.py`)                      |
| `pheno-predict`            | Python (`pheno_predict.py`)                             |
| `pheno-vibecoding-guard`   | Python (`pyproject.toml`)                               |
| `pheno-secret-scan`        | Only `docs/`, `deny.toml`, `Justfile` (no Rust `src/`)  |
| `pheno-ssot-template`      | Templates only (`Cargo.toml.template`, `justfile`, etc.)|
| `pheno-ci-templates`       | Templates only                                          |
| `pheno-events`             | ✅ Rust (counted)                                       |
| `pheno-fastapi-base`       | Python                                                  |
| `pheno-go-ctxkit`          | Go                                                      |
| `pheno-llms-txt`           | Python                                                  |
| `pheno-prompt-test`        | Python                                                  |
| `pheno-pydantic-models`    | Python                                                  |
| `pheno-scaffold-kit`       | Python                                                  |
| `pheno-worklog-schema`     | Python                                                  |
| `pheno-zod-schemas`        | TypeScript                                              |
| `pheno-cost-card`          | (not in local cone)                                     |

---

## 5. Mechanism breakdown (where does `Display` come from?)

| Mechanism                                            | Crates using it                                                              | Types | %       |
| :--------------------------------------------------- | :---------------------------------------------------------------------------- | ----: | ------: |
| `impl Display for X` / `impl fmt::Display for X`     | `pheno-otel`, `pheno-port-adapter` (via thiserror), `pheno-context`, `pheno-tracing`, `pheno-chaos` | 7     | 41 %    |
| `#[derive(thiserror::Error)]` + `#[error("...")]`    | `pheno-errors`, `pheno-context`, `pheno-events`, `pheno-flags`, `pheno-otel` (×2), `pheno-port-adapter` (×2) | 8 | 47 % |
| `macro_rules!` + invocation (`impl_secret_fmt!`)     | `pheno-config`                                                                | 3     | 18 %    |
| `#[derive(Display)]` from `derive_more` / `strum`    | (none — opportunity)                                                          | 0     |  0 %    |
| `#[derive(Display)]` from `displaydoc`               | (none — opportunity)                                                          | 0     |  0 %    |
| **Total**                                            |                                                                                | **18** | 106 %¹  |

¹ Some types use both `impl Display` and `thiserror::Error` (counts in
both rows). The 17 unique types with `Display` are 41 % hand-written +
47 % thiserror + 18 % macro.

---

## 6. Cross-cutting observations

1. **Error types are universally covered.** Every `thiserror`-derived
   error type in the fleet (8 of 8) has `Display`. This matches the
   `pheno-errors` substrate norm and the `AppError` / `AppResult` idiom.
2. **`pheno-config` shows the macro pattern at its best.** The
   `impl_secret_fmt!` macro centralises the redaction policy so the
   three newtypes cannot accidentally diverge. The same pattern would
   help `pheno-port-adapter` (six adapter structs) and `pheno-tracing`
   (six sampler structs) — a `impl_adapter_display!(name)` macro would
   take 5-10 lines and lift those crates by 15-20 percentage points
   each.
3. **No use of `strum::Display` / `derive_more::Display` / `displaydoc`**
   anywhere in the fleet. For small enums (`SpanKind`, `Route`,
   `Status`, `SamplingDecision`, `SubscriberKind`, `TraceStatus`,
   `FaultKind`), `#[derive(strum::Display)]` would be a one-liner per
   type and would push the fleet coverage well above 50 %.
4. **Newtype structs (`TraceId`, `SpanId`) are a recurring gap.** Both
   crates that have them (`pheno-tracing`) leave them without `Display`,
   and they are the most frequently stringified values in trace context
   propagation.

---

## 7. Recommendations

Ordered by impact-per-effort:

| Priority | Change                                                                                       | Effort  | Coverage lift           |
| :------: | :------------------------------------------------------------------------------------------- | :------ | :---------------------- |
| P1       | `pheno-tracing`: `#[derive(strum::Display)]` on `SpanKind`, `SamplingDecision`, `SubscriberKind`, `TraceStatus`, `TracingBackend`; hand-rolled `Display` for `SpanContext` (5-7 lines). | ~30 min | +27 pp (1 crate: 5.6 → 33.3 %) |
| P1       | `pheno-port-adapter`: `impl Display for TcpAdapter` / `UnixAdapter` / `RedisAdapter` / `InMemoryCache` / `SystemClock` / `MockClock` via a 4-line `impl_display_for_adapter!` macro (each delegates to `self.name()`). | ~30 min | +67 pp (1 crate: 22.2 → 88.9 %) |
| P1       | `pheno-otel`: `impl Display for SpanContext` (format `trace_id=... span_id=...`); `#[derive(strum::Display)]` on `Route` and `Status`. | ~20 min | +12.5 pp (1 crate: 25.0 → 37.5 %) |
| P2       | `pheno-errors`: `impl Display for Problem` (forward to `serde_json` or a manual format).     | ~10 min | +50 pp (1 crate: 50.0 → 100.0 %) |
| P2       | `pheno-events`: `impl Display for EventEnvelope`; `impl Display for Ack` if it's not a unit struct. | ~15 min | +50 pp (1 crate: 25.0 → 75.0 %) |
| P2       | `pheno-chaos`: `impl Display for ChaosConfig` (and a macro for the four guard structs if they're all handle types). | ~20 min | +44 pp (1 crate: 22.2 → 66.7 %) |
| P3       | `pheno-cli-base`: `impl Display for Verbosity` (one-liner), `impl Display for ConfigArg` (one-liner). | ~10 min | +100 pp (1 crate: 0 → 100 %) |
| P3       | `pheno-flags`: `impl Display for FlagSet` (iterates sorted flags).                            | ~10 min | +50 pp (1 crate: 50.0 → 100 %) |

If **all P1 + P2 + P3** are applied, the fleet coverage would rise from
**25.0 % → ~58 %** with **~2 hours of focused work** and zero new
dependencies (`strum` is a small dev-dep addition; `derive_more` is not
needed).

---

## 8. Methodology notes

- **What counts as "public":** `pub` (any visibility — including
  `pub(crate)` and `pub(super)`), at the top level of a `src/*.rs` file
  OR inside a `pub mod` block. Types in private `mod foo { ... }` blocks
  are excluded.
- **What counts as "has `Display`":**
  1. `impl Display for X` / `impl std::fmt::Display for X` (any path form)
  2. `#[derive(... Display ...)]` (any crate prefix; e.g.
     `derive_more::Display`)
  3. `#[derive(... Error ...)]` (thiserror) **AND** the type body
     contains at least one `#[error("...")]` attribute (the thiserror
     contract for auto-`Display`)
  4. A `macro_rules!` whose body contains `Display for $X`, and the
     macro is invoked on the type (e.g. `impl_secret_fmt!(ApiKey);`)
- **Dedup:** types are counted once per crate, even if defined in
  multiple files (e.g. a type re-exported in `prelude.rs`).
- **False positives:** the `#[derive(Error)]` heuristic could in theory
  count a type that imports `Error` from somewhere other than
  `thiserror`. In practice, the only `Error` derives in the fleet are
  from `thiserror` (verified by checking each `#[error(...)]` attribute
  site). No false positives observed.
- **False negatives:** the script does not detect `Display` impls
  written via a proc-macro other than `derive_more` / `strum` /
  `displaydoc` unless the derive name literally contains `Display`
  (which all three do). It also does not detect `Display` impls for
  non-`struct` / `enum` types (e.g. type aliases, function pointers),
  which is intentional.
- **Out of scope:** `pheno-*-macros` proc-macro crates (their public
  API is a `proc_macro_derive`, not a `struct` or `enum`).

---

## 9. Reproducibility

- **Script:** `/tmp/side40_analyze.py` (347 lines, single-file Python 3
  stdlib only)
- **Raw output:** `/tmp/side40_results.json` (17 398 bytes)
- **Run:** `python3 /tmp/side40_analyze.py`
- **Crate list:** `RUST_CRATES` constant at the top of the script
- **Date stamp:** `scan_date: 2026-06-22` in the JSON

---

## 10. Related

- `findings/71-pillar-2026-06-17.md` (L1-L71 framework; this task falls
  under L12 "type safety" / L36 "API ergonomics")
- `findings/2026-06-21-v17-T8-L12-type-safety.md` (deny(missing_docs)
  sweep across 8 crates — sibling audit to this one)
- `pheno-errors` substrate (ADR-022, ADR-023 Rule 3.1) — the canonical
  `AppError` pattern that all error types in the fleet follow.
- `pheno-config/src/secrets.rs:56-78` — the `impl_secret_fmt!` macro
  that gives `pheno-config` its 100 % coverage; the recommended
  pattern for `pheno-port-adapter` and `pheno-tracing`.
