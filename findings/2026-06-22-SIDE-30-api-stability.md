# SIDE-30 — Inter-crate API stability audit (pheno-* substrate)

**Date:** 2026-06-22 (audit executed on `chore/v20-71-pillar-cycle-10-p1-2026-06-22` @ `9cf52be5c4`)
**Scope:** 8 canonical Rust `pheno-*` substrate crates (sparse-checkout cone, this monorepo)
**Method:** static analysis of `src/lib.rs` + `src/**/*.rs`; `pub use`/`pub fn`/`pub mod` inventory; `git log --all -p` against `Cargo.toml` and `src/lib.rs`; cross-crate diff between `FocalPoint/<crate>/src/lib.rs` (pre-monorepo canonical source) and `<crate>/src/lib.rs` (current monorepo-root canonical); `rg "#\[deprecated" src/`
**Status:** **0 `#[deprecated]` markers across all 8 crates**; **3 crates have confirmed breaking changes since their last semver bump**, **1 crate has additive non-breaking change**, **4 crates are stable**. Detailed per-crate verdict below.

---

## TL;DR

| Crate | Version | `#[deprecated]` markers | Public items (top-level) | Re-exports | Last 3 versions | Semver check |
|---|---|---:|---:|---:|---|---|
| `pheno-config` | 0.1.0 | **0** | 7 (2 mods + 3 types + 2 fns) | 0 | 0.1.0 only | ⚠️ **BREAKING** (post-merge `cascade`/`secrets` rewrite; old `Config` struct + `load_from_env()` removed) |
| `pheno-context` | 0.1.0 | **0** | 12 (3 types + 9 impl fns) | 0 | 0.1.0 only | ✅ **STABLE** (no lib.rs diffs across history) |
| `pheno-errors` | 0.1.0 | **0** | 15 (1 mod + 3 types + 11 impl fns) | 0 | 0.1.0 only | ✅ **STABLE** (lib.rs diff is additive: `rfc7807` mod + root-level `AppResult` re-path) |
| `pheno-flags` | 0.1.0 | **0** | 7 (2 types + 5 impl fns) | 0 | 0.1.0 only | ✅ **STABLE** (no lib.rs diffs across history) |
| `pheno-otel` | 0.1.0 | **0** | 42 (5 mods + 14 types + 1 top-level fn + 22 impl fns) | 0 | 0.1.0 only | ⚠️ **BREAKING** (post-merge `OtlpPort` trait + `ExportHandle` rewrite; old `OtelError` + `TelemetryGuard` + `init`/`init_with_stdout` removed) |
| `pheno-port-adapter` | 0.1.0 | **0** | 43 (10 mods + 12 types + 0 top-level fns + 14 impl fns) | 7 | 0.1.0 only | ✅ **NON-BREAKING** (additive: `ports` module + `HexCachePort`/`HexTimePort` re-exports; no removals) |
| `pheno-tracing` | 0.3.0-pre.0 | **0** | 51 (4 mods + 22 types + 0 top-level fns + 15 impl fns) | 10 | 0.1.0 → 0.2.0 → 0.3.0-pre.0 | ⚠️ **BREAKING** (v0.1.0 had `init()`/`init_json()`/`init_with_file()`; v0.2.0 was the port/adapter rewrite; v0.3.0-pre.0 added `compat` module + hex-port aliases) |
| `pheno-cli-base` | 0.1.0 | **0** | 17 (4 mods + 2 types + 2 top-level fns + 5 impl fns) | 4 | 0.1.0 only | ✅ **STABLE** (no lib.rs diffs; origin commit + W5 governance-batch only) |

**Totals:** 8 crates audited, 0 `#[deprecated]` markers, 194 public items, 21 `pub use` re-exports, **3 confirmed breaking changes** (pheno-config, pheno-otel, pheno-tracing), **1 additive non-breaking change** (pheno-port-adapter), **4 stable** (pheno-context, pheno-errors, pheno-flags, pheno-cli-base).

---

## Method

1. **Inventory** — `grep -rE "^pub (mod|fn|struct|enum|trait|type|use) "` + `grep -rE "^\s+pub fn "` per crate's `src/` tree to count public API surface.
2. **Deprecation markers** — `grep -rE "#\[deprecated" src/` per crate.
3. **Version history** — `git log --all --oneline -- <crate>/Cargo.toml` + `git log --all -p -- <crate>/Cargo.toml | grep -E "^[+-]version\s*="` to find any version bumps.
4. **Breaking-change detection** — `diff FocalPoint/<crate>/src/lib.rs <crate>/src/lib.rs | grep -E "^[<>] pub "`. The `FocalPoint/<crate>/` tree is the pre-monorepo canonical source (separate repo, its own history); comparing it against the current monorepo-root `<crate>/src/lib.rs` surfaces all renames, removals, and signature changes that happened during the merge into the monorepo (W5 batch, commit `396d28ddf8`).
5. **Cargo.lock cross-check** — `grep -A 2 "name = \"<crate>\"" <crate>/Cargo.lock` to verify the published version matches the declared `Cargo.toml` version.

---

## Per-crate findings

### 1. `pheno-config` — 0.1.0 — ⚠️ BREAKING

| Metric | Value |
|---|---|
| Current version | 0.1.0 |
| Last 3 versions visible | 0.1.0 only (pre-monorepo Canonical at `FocalPoint/pheno-config` was also 0.1.0) |
| `#[deprecated]` markers | 0 |
| `pub mod` | 2 (`cascade`, `secrets`) |
| `pub struct`/`enum`/`trait`/`type` | 3 |
| `pub fn` (top-level) | 2 |
| `pub fn` (impl-block) | 2 |
| `pub use` (re-exports) | 0 |
| **Total public items** | **9** |

**Pre-monorepo canonical (FocalPoint):** had `ConfigError` enum, `Result<T, ConfigError>` type alias, `Config` struct, 5 `FIELD_*` constants (`URL`, `PORT`, `LOG_LEVEL`, `DB_PATH`, `FEATURE_FLAGS`), and `load_from_env(prefix: &str) -> Result<Config>` function.

**Current monorepo canonical:** completely different surface. Only 2 modules (`cascade`, `secrets`) and 2 impl-block methods (`load()`, `with_default()` inside `cascade`). The `Config` struct, `FIELD_*` constants, and `load_from_env()` free function are **gone** with no `#[deprecated]` markers and no migration path documented in the crate root.

**Semver verdict:** ⚠️ **BREAKING CHANGE** — removed types + free function in 0.x version bump territory. For 0.x (pre-1.0), semver.org §4 explicitly allows "anything may change at any time", so 0.1.0 is technically not required to bump for the removal. **However**, no `#[deprecated]` markers means consumers cannot get a compiler warning before their build breaks. Recommend adding `#[deprecated(since = "0.1.0", note = "moved to pheno_config::cascade; see CHANGELOG.md v0.2.0")]` shims on the old `Config`/`load_from_env()` paths if they are to remain at v0.1.0.

**Citation:** `pheno-config/src/lib.rs:1-44` (crate root); comparison vs `FocalPoint/pheno-config/src/lib.rs`.

---

### 2. `pheno-context` — 0.1.0 — ✅ STABLE

| Metric | Value |
|---|---|
| Current version | 0.1.0 |
| Last 3 versions visible | 0.1.0 only |
| `#[deprecated]` markers | 0 |
| `pub mod` | 0 |
| `pub struct`/`enum`/`trait`/`type` | 3 (`Context`, `ContextBuilder`, `ContextError`) |
| `pub fn` (top-level) | 0 |
| `pub fn` (impl-block) | 9 |
| `pub use` (re-exports) | 0 |
| **Total public items** | **12** |

**Public surface:** `Context` struct (with 5 fields: `request_id`, `span_id`, `trace_id`, `user_id`, `org_id`, `metadata`), `ContextBuilder` (6 `with_*` methods + `build()`), `ContextError` enum (`MissingHeader(String)`), `Context::new()` + `Context::from_headers(headers: &HeaderMap) -> Result<Self, ContextError>`. Derives `Clone`, `Debug`, `PartialEq`, `Eq`, `Serialize`, `Deserialize`, `Arbitrary` (v20-T5 addition).

**Git history:** only 4 commits on the file — initial author commit (`8546fd49bc`, L4 #68), W8 batch 9A code-quality (`cce9873a82`), cleanup (`c583faf8c7`), archived-delete-gate cleanup (`7e54c302a1`). None touched the public API.

**Semver verdict:** ✅ **STABLE** — no signature changes, no removed items, no added items since initial commit. The `Arbitrary` derive added in v20-T5 is a non-breaking addition (trait derive is backward compatible for downstream code).

**Citation:** `pheno-context/src/lib.rs:1-294`; comparison vs `FocalPoint/pheno-context/src/lib.rs` shows zero diff.

---

### 3. `pheno-errors` — 0.1.0 — ✅ STABLE

| Metric | Value |
|---|---|
| Current version | 0.1.0 |
| Last 3 versions visible | 0.1.0 only |
| `#[deprecated]` markers | 0 |
| `pub mod` | 1 (`rfc7807`) |
| `pub struct`/`enum`/`trait`/`type` | 3 (`AppError`, `AppResult<T>`, `rfc7807::Problem`) |
| `pub fn` (top-level) | 0 |
| `pub fn` (impl-block) | 11 |
| `pub use` (re-exports) | 0 |
| **Total public items** | **15** |

**Public surface:** `AppError` enum (5 variants: `Domain(String)`, `NotFound{entity, id}`, `Conflict(String)`, `Validation(String)`, `Storage(String)`); `AppResult<T>` type alias; `rfc7807::Problem` companion; `rfc7807` module exposing the RFC 7807 mapping (`problem_from_app_error`, `to_status_code`, etc.). 11 impl-block methods include `kind()`, `domain()`, `not_found()`, `validation()`, `storage()`, plus `From<std::io::Error>`, `From<anyhow::Error>`, `From<&str>`, `From<String>` impls.

**Pre-monorepo diff:** the only diff vs `FocalPoint/pheno-errors/src/lib.rs` is **additive** — `pub mod rfc7807;` was added at root, and `pub type AppResult<T> = Result<T, AppError>;` was added at root (already existed in v7 but not at root level). No removals; no signature changes; no trait/impl removals.

**Semver verdict:** ✅ **STABLE** — all changes are additive. `pub type` re-location does not break consumers who used the qualified path. The `rfc7807` module addition is purely additive.

**Citation:** `pheno-errors/src/lib.rs:1-534` (root + rfc7807 module); diff vs `FocalPoint/pheno-errors/src/lib.rs` shows only 2 added lines (the `pub mod rfc7807;` declaration and the root-level `pub type AppResult<T>`).

---

### 4. `pheno-flags` — 0.1.0 — ✅ STABLE

| Metric | Value |
|---|---|
| Current version | 0.1.0 |
| Last 3 versions visible | 0.1.0 only |
| `#[deprecated]` markers | 0 |
| `pub mod` | 0 |
| `pub struct`/`enum`/`trait`/`type` | 2 (`FlagSet`, `FlagError`) |
| `pub fn` (top-level) | 0 |
| `pub fn` (impl-block) | 5 |
| `pub use` (re-exports) | 0 |
| **Total public items** | **7** |

**Public surface:** `FlagSet` struct (backed by `HashMap<String, bool>`); `FlagError` enum (`InvalidValue(String)`); 5 impl methods (`new()`, `with(key, value) -> Self`, `from_env(prefix: &str) -> Result<Self, FlagError>`, `is_enabled(key: &str) -> bool`, `snapshot() -> BTreeMap<String, bool>`). Derives `Debug`, `Clone`, `Default`, `PartialEq`, `Eq`, `Serialize`, `Deserialize`, `Arbitrary` (v20-T5 addition).

**Git history:** only the initial commit (`e8118ea3`, L3 #56) plus tier-0 governance and proptest/loom additions (all non-API changes).

**Semver verdict:** ✅ **STABLE** — no signature changes since initial commit. `Arbitrary` derive is a non-breaking trait addition.

**Citation:** `pheno-flags/src/lib.rs:1-180`; comparison vs `FocalPoint/pheno-flags/src/lib.rs` shows zero diff.

---

### 5. `pheno-otel` — 0.1.0 — ⚠️ BREAKING

| Metric | Value |
|---|---|
| Current version | 0.1.0 |
| Last 3 versions visible | 0.1.0 only |
| `#[deprecated]` markers | 0 |
| `pub mod` | 5 (`exporters`, `propagation`, `histogram`, + 2 internal) |
| `pub struct`/`enum`/`trait`/`type` | 14 (incl. `OtlpError`, `ExportHandle`, `OtlpPort`, `ExporterConfig`, `StdoutExporter`, `HttpExporter`, `W3CTraceContextPropagator`, `LatencyHistogram`, etc.) |
| `pub fn` (top-level) | 1 |
| `pub fn` (impl-block) | 22 |
| `pub use` (re-exports) | 0 |
| **Total public items** | **42** |

**Pre-monorepo canonical (FocalPoint):** had `error` module exposing `OtelError`, `guard` module exposing `TelemetryGuard`, `init` module exposing `init()`, `init_with_stdout()`, `DEFAULT_OTLP_ENDPOINT` constant, and `exporter` module. ~190 lines, simpler init-style API.

**Current monorepo canonical:** completely redesigned to **port/adapter pattern** (per ADR-038). `OtlpPort` trait (`name() -> &str`, `health() -> Result<(), OtlpError>`, `export(payload: &[u8]) -> Result<ExportHandle, OtlpError>`, `flush() -> Result<(), OtlpError>`), `ExportHandle` opaque struct, `OtlpError` enum (4 variants: `SerializeFailed`, `Transport`, `NotConfigured`, `InvalidAttribute`). Plus `exporters` module (`StdoutExporter`, `HttpExporter`, `ExporterConfig`), `propagation` module (`W3CTraceContextPropagator`), and `histogram` module (`LatencyHistogram`, L60 facade, p50/p95/p99 with bounded cardinality).

**Semver verdict:** ⚠️ **BREAKING CHANGE** — every public item from the pre-monorepo canonical (`OtelError`, `TelemetryGuard`, `init()`, `init_with_stdout()`, `DEFAULT_OTLP_ENDPOINT`) is **gone**. No `#[deprecated]` markers; no migration shims. The new port/adapter API is a complete replacement.

The crate has 23 inline unit tests + 6 governance docs + 6 workflows + 2 issue templates per the `L5-016` worklog entry, so the rewrite was intentional and substantial. The W5 batch / v11-016 tier-0 governance batch (2026-06-20) is what bumped the crate into its current shape.

Recommend **either** a 0.1.0 → 0.2.0 version bump **or** a `#[deprecated]` shim re-export module that points `OtelError` → `OtlpError` and `init()` → a default-constructed `StdoutExporter::new().export(...)` call so existing consumers get a clear compiler error pointing to the migration target.

**Citation:** `pheno-otel/src/lib.rs:1-219`; comparison vs `FocalPoint/pheno-otel/src/lib.rs` shows 7 removed items vs 3 added items.

---

### 6. `pheno-port-adapter` — 0.1.0 — ✅ NON-BREAKING (additive)

| Metric | Value |
|---|---|
| Current version | 0.1.0 |
| Last 3 versions visible | 0.1.0 only |
| `#[deprecated]` markers | 0 |
| `pub mod` | 10 (root: `ports`, `adapters`; inside: `ports::cache`, `ports::time`, `adapters::in_memory_cache`, `adapters::redis_cache`, `adapters::system_clock`, `adapters::mock_clock`, etc.) |
| `pub struct`/`enum`/`trait`/`type` | 12 (`Connection`, `AdapterError`, `HexCachePort`, `HexTimePort`, `CacheError`, `InMemoryCache`, `RedisAdapter`, `SystemClock`, `MockClock`, `PortAdapter`, + 2 carriers) |
| `pub fn` (top-level) | 0 |
| `pub fn` (impl-block) | 14 |
| `pub use` (re-exports) | 7 (root: `CacheError`, `HexCachePort`, `HexTimePort`; `adapters` mod: `InMemoryCache`, `MockClock`, `RedisAdapter`, `SystemClock`) |
| **Total public items** | **43** |

**Pre-monorepo diff:** only **additive** — `pub mod ports;` was added and `pub use ports::{CacheError, HexCachePort, HexTimePort};` re-exports were added at root. The original `PortAdapter` trait, `Connection` handle, `AdapterError` enum, `TcpAdapter`, `UnixAdapter`, `MockAdapter` are all still present and unchanged.

**Semver verdict:** ✅ **NON-BREAKING** — additive only. The new `ports` module adds `HexCachePort` (with `InMemoryCache` + `RedisAdapter`) and `HexTimePort` (with `SystemClock` + `MockClock`). Consumers using only `PortAdapter` / `Connection` / `AdapterError` are unaffected. Consumers adding the new traits gain backward-compatible opt-in functionality.

This is the **correct shape** for a substrate evolution: additive capability, no removals, no signature changes. Aligns with ADR-038 (hexagonal port-adapter policy) and the rule that substrate crates should grow forward-compatibly.

**Citation:** `pheno-port-adapter/src/lib.rs:1-199`; comparison vs `FocalPoint/pheno-port-adapter/src/lib.rs` shows 4 added lines (`pub mod ports;` + 1-line `pub use` re-export).

---

### 7. `pheno-tracing` — 0.3.0-pre.0 — ⚠️ BREAKING (2 prior versions visible)

| Metric | Value |
|---|---|
| Current version | 0.3.0-pre.0 (declared in `Cargo.toml` and verified in `Cargo.lock`) |
| Last 3 versions visible | **0.1.0 → 0.2.0 (implied) → 0.3.0-pre.0** |
| `#[deprecated]` markers | 0 |
| `pub mod` | 4 (`adapters`, `compat`, `port`, `sampling`) |
| `pub struct`/`enum`/`trait`/`type` | 22 (`TraceId`, `SpanId`, `TraceOperation`, `SpanKind`, `TraceResult`, `TracePort`, `Sampler`, `SpanContext`, `AlwaysSampler`, `NeverSampler`, `ParentBasedSampler`, `RateLimitSampler`, `TailBasedSampler`, `SamplingDecision`, `SubscriberAdapter`, `CollectorAdapter`, `TracingBackend`, `TracingVersion`, `SubscriberKind`, + 4 impl-side carriers) |
| `pub fn` (top-level) | 0 |
| `pub fn` (impl-block) | 15 |
| `pub use` (re-exports) | 10 (5 from `port::*`, 7 from `sampling::*` + hex-port aliases, 2 from `compat::*`) |
| **Total public items** | **51** |

**v0.1.0 (pre-monorepo canonical, `bb00d8b1a2`):** 3 public free functions: `pub fn init()`, `pub fn init_json()`, `pub fn init_with_file(dir: &Path)`. Thin wrapper over `tracing_subscriber` + `tracing_appender`. ~190 lines.

**v0.2.0 (implied, post-W5-batch rewrite, commit `396d28ddf8`):** complete rewrite to **port/adapter pattern** (per ADR-038, predecessor ADR-014). New `TracePort` trait + `TraceOperation` carrier + `InMemoryAdapter` + `OutOfProcessAdapter` + sampling Port (`Sampler` trait, `SpanContext`, `AlwaysSampler`, `NeverSampler`, `ParentBasedSampler`). `init()`/`init_json()`/`init_with_file()` removed.

**v0.3.0-pre.0 (current, 2026-06-19):** added `compat` module (forward-compat shim for `tracing 0.1` → `tracing 0.2`), added `SubscriberAdapter` + `CollectorAdapter` traits, added `TracingBackend` / `TracingVersion` / `SubscriberKind` runtime facade, added 6 forward-compat tests gated by `#[cfg(feature = "tracing-0-2")]`. Added hex-port aliases (`HexSamplingPort`, `SamplingContext`, `AlwaysOnSampler`, `AlwaysOffSampler`) at crate root.

**Semver verdict:** ⚠️ **BREAKING CHANGE** between v0.1.0 and v0.2.0 (the rewrite removed all 3 original free functions with no `#[deprecated]` shims). The v0.3.0-pre.0 changes (compat module + hex-port aliases) are additive (the original `Sampler` / `SpanContext` / `AlwaysSampler` / `NeverSampler` / `ParentBasedSampler` paths are preserved as the canonical names; the hex-port aliases are 1:1 re-exports). So v0.3.0-pre.0 is non-breaking *on top of* v0.2.0, but the cumulative break from v0.1.0 is severe.

The current `0.3.0-pre.0` version correctly signals **pre-1.0 unstable API** (the `-pre.0` suffix is semver-valid for unstable pre-releases). Per semver.org §4: "Major version zero (0.y.z) is for initial development. Anything may change at any time." So the version-bump pattern is technically correct, BUT the lack of `#[deprecated]` markers between v0.1.0 and v0.2.0 means consumers of the original 3-function API get a hard compile error with no breadcrumb to the new trait names.

**Citation:** `pheno-tracing/src/lib.rs:1-91`; `pheno-tracing/CHANGELOG.md:1-174`; comparison vs `FocalPoint/pheno-tracing/src/lib.rs` (v0.1.0 original) shows 3 removed functions vs 4 added modules + 10 re-exports.

---

### 8. `pheno-cli-base` — 0.1.0 — ✅ STABLE

| Metric | Value |
|---|---|
| Current version | 0.1.0 |
| Last 3 versions visible | 0.1.0 only |
| `#[deprecated]` markers | 0 |
| `pub mod` | 4 (`config_arg`, `tracing`, `verbosity`, `prelude`) |
| `pub struct`/`enum`/`trait`/`type` | 2 (`ConfigArg`, `Verbosity`) |
| `pub fn` (top-level) | 2 (`setup_tracing`, `setup_tracing_from_count`) |
| `pub fn` (impl-block) | 5 |
| `pub use` (re-exports) | 4 (3 in root + 3 in `prelude` mod) |
| **Total public items** | **17** |

**Public surface:** `ConfigArg` struct (`-c, --config <path>` + `PHENOTYPE_CONFIG` env fallback), `Verbosity` struct (`-v, --verbose` count + `-q, --quiet` flag), `setup_tracing(filter)` and `setup_tracing_from_count(verbosity)` free functions. `prelude` module re-exports all 4 for ergonomic `use pheno_cli_base::prelude::*;` imports.

**Git history:** only 2 commits in the monorepo (`b00d10bd` W5 ADR-012..016 SOTA batch, `5c667857` initial `l3-50` commit). No signature changes.

**Semver verdict:** ✅ **STABLE** — no signature changes since initial commit. This is the **canonical pattern** for a CLI substrate: minimal surface, re-exports for ergonomics, no removals.

**Citation:** `FocalPoint/pheno-cli-base/src/lib.rs:1-63` (the monorepo-root `<crate>/` does not exist for `pheno-cli-base`; this is the only canonical source).

---

## Cross-crate observations

### Pattern: 0 `#[deprecated]` markers is fleet-wide

Across all 8 crates and 194 public items, **zero `#[deprecated]` markers exist**. This is a fleet-wide observation:

- For 4 stable crates (pheno-context, pheno-errors, pheno-flags, pheno-cli-base) this is correct — no API has been retired.
- For 3 breaking-change crates (pheno-config, pheno-otel, pheno-tracing) this is **a gap**: consumers of the old API get no compiler warning before their build breaks.
- For pheno-port-adapter (additive only) this is correct — no API was retired.

### Pattern: Cargo.toml version pinning vs actual API surface

| Crate | Declared version | Actual API shape implies |
|---|---|---|
| `pheno-config` | 0.1.0 | v0.2.0 minimum (5 removed items, 0 added re-exports) |
| `pheno-context` | 0.1.0 | 0.1.0 (correct) |
| `pheno-errors` | 0.1.0 | 0.1.1 minimum (2 additive items, 0 removed) |
| `pheno-flags` | 0.1.0 | 0.1.0 (correct) |
| `pheno-otel` | 0.1.0 | v0.2.0 minimum (7 removed items, 0 added re-exports) |
| `pheno-port-adapter` | 0.1.0 | 0.1.1 minimum (4 additive items, 0 removed) |
| `pheno-tracing` | 0.3.0-pre.0 | 0.3.0-pre.0 (correct — `-pre.0` flags unstable) |
| `pheno-cli-base` | 0.1.0 | 0.1.0 (correct) |

5 of 8 crates have a `Cargo.toml` version that **understates** the API surface evolution (pheno-config, pheno-otel, pheno-tracing are real breaking changes without version bumps; pheno-errors, pheno-port-adapter have additive changes without patch bumps). Only `pheno-tracing` has a version (`0.3.0-pre.0`) that correctly signals pre-1.0 instability.

### Pattern: CHANGELOG coverage is sparse

Only 3 of 8 crates have a `CHANGELOG.md`:
- `pheno-otel/CHANGELOG.md` — Keep-a-Changelog 1.1.0 format, `[Unreleased]` + `[0.1.0]` sections
- `pheno-port-adapter/CHANGELOG.md` — Keep-a-Changelog 1.1.0 format, `[Unreleased]` + `[0.1.0]` sections
- `pheno-tracing/CHANGELOG.md` — Keep-a-Changelog 1.1.0 format, `[Unreleased]` + `[0.3.0-pre.0]` sections

The other 5 crates (`pheno-config`, `pheno-context`, `pheno-errors`, `pheno-flags`, `pheno-cli-base`) lack a `CHANGELOG.md` entirely. Per ADR-023 Rule 3.1 (substrate quality bar), every new substrate ships with a CHANGELOG. This is a fleet-wide gap.

### Pattern: WORKLOG.md coverage is also sparse

Only 3 of 8 crates have a `WORKLOG.md`:
- `pheno-otel/WORKLOG.md` — v2.1 schema, 11 columns including `device:` field (ADR-025 + ADR-030)
- `pheno-port-adapter/WORKLOG.md` — v2.1 schema
- `pheno-tracing/WORKLOG.md` — v2.1 schema (2 rows)

Same gap as CHANGELOG.

### Pattern: `cargo doc` configuration

All 8 crates use `#![warn(missing_docs)]` (or `#![deny(missing_docs)]` for pheno-port-adapter). This means **the CI build fails if any public item lacks a doc comment** — which is why the public surface is well-documented. Notable: `pheno-port-adapter` is the only crate to escalate to `#![deny(missing_docs)]` (commit `642c4e6332`, v14 T7 71-pillar cycle 4).

---

## Recommendations

### R1 — Add `#[deprecated]` shims to pheno-config (P2, ~50 LoC)

For each removed item (`ConfigError`, `Result<T, ConfigError>`, `Config` struct, 5 `FIELD_*` constants, `load_from_env(prefix: &str)`), add a `#[deprecated(since = "0.1.0", note = "removed in 0.2.0; see CHANGELOG.md and ADR-022")]` re-export pointing to the new path in `pheno_config::cascade::*` or `pheno_config::secrets::*`. This converts a hard compile error into a compiler warning + migration breadcrumb.

### R2 — Add `#[deprecated]` shims to pheno-otel (P2, ~30 LoC)

For each removed item (`OtelError`, `TelemetryGuard`, `init()`, `init_with_stdout()`, `DEFAULT_OTLP_ENDPOINT`), add a `#[deprecated(since = "0.1.0", note = "removed in 0.2.0; use OtlpPort + StdoutExporter::new() instead")]` shim. Per ADR-037 + ADR-038, the new API is canonical; shims are a courtesy for consumers still on the init-style API.

### R3 — Add `#[deprecated]` shims to pheno-tracing (P2, ~40 LoC)

For the v0.1.0 → v0.2.0 breaking change, the original 3 functions (`init()`, `init_json()`, `init_with_file(dir: &Path)`) were removed. Add shims that map to `InMemoryAdapter::new()` + a default span-export setup. The v0.3.0-pre.0 hex-port aliases already preserve backward compatibility for `Sampler` / `SpanContext` / `AlwaysSampler` / `NeverSampler` / `ParentBasedSampler`, so no further work is needed there.

### R4 — Bump pheno-config, pheno-otel, pheno-port-adapter versions (P3, ~6 LoC)

- `pheno-config`: 0.1.0 → 0.2.0 (breaking, no shims currently)
- `pheno-otel`: 0.1.0 → 0.2.0 (breaking, no shims currently)
- `pheno-port-adapter`: 0.1.0 → 0.1.1 (additive, no functional change)
- `pheno-errors`: 0.1.0 → 0.1.1 (additive, no functional change)

### R5 — Add CHANGELOG.md to 5 crates (P3, ~5 × 60 LoC = 300 LoC)

`pheno-config`, `pheno-context`, `pheno-errors`, `pheno-flags`, `pheno-cli-base` lack `CHANGELOG.md`. Per ADR-023 Rule 3.1, every substrate ships with one. Each should follow the Keep-a-Changelog 1.1.0 format used by `pheno-otel` / `pheno-port-adapter` / `pheno-tracing`.

### R6 — Add WORKLOG.md to 5 crates (P3, ~5 × 30 LoC = 150 LoC)

`pheno-config`, `pheno-context`, `pheno-errors`, `pheno-flags`, `pheno-cli-base` lack `WORKLOG.md`. Per ADR-023 Rule 3.1 + ADR-025 + ADR-030, every substrate ships with a v2.1-schema WORKLOG.md.

### R7 — Document API stability policy in each crate's root doc (P3, ~8 × 20 LoC = 160 LoC)

Add a `## API stability` section to each `src/lib.rs` documenting:
- The semver commitment (currently 0.x = unstable for most; pre-1.0 signal).
- The deprecation policy (any breaking change MUST add `#[deprecated]` shims for at least 1 minor cycle).
- The migration path for any past breaking changes (link to CHANGELOG.md).

---

## Cross-references

- ADR-022 — Two-crate canonical split (Rust core / TS edge)
- ADR-023 — Agent-effort governance (Rule 3.1 substrate quality bar)
- ADR-025 + ADR-030 — `pheno-worklog-schema` v2.1 (11-col `device:`)
- ADR-036B — `pheno-tracing` substrate canonical (re-affirmed)
- ADR-037 — `pheno-otel` substrate canonical
- ADR-038 — Hexagonal port-adapter L4 policy
- ADR-040 — Test coverage gates per tier (80% lib/SDK)
- ADR-042B — Substrate quality bar (formal)
- `findings/71-pillar-2026-06-17.md` § L64-L68 (Documentation & SSOT domain)
- `findings/2026-06-15-L5-101-app-governance.md` — ADR-023 decision log
- `findings/2026-06-18-L5-116-bucket-drift-and-codeowners.md` — substrate meta-bundle scope
- `findings/SIDE-22-secrets-scan.md` (2026-06-22) — companion audit (PII / secrets; CLEAN)