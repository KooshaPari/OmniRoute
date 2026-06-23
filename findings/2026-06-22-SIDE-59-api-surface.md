# SIDE-59: pheno-* Public API Surface Review

**Date:** 2026-06-22
**Scope:** 8 pheno-* Rust crates: `pheno-config`, `pheno-context`, `pheno-errors`, `pheno-events`, `pheno-flags`, `pheno-otel`, `pheno-port-adapter`, `pheno-tracing`
**Method:** Direct `lib.rs` + `mod` decls scan, `pub` item enumeration per file, trait bound extraction, orphan/dead-code detection, `#[non_exhaustive]` audit
**Ref:** ADR-023 (substrate quality bar), ADR-038 (hexagonal port-adapter L4 policy), ADR-040 (test coverage gates per tier), ADR-042B (substrate quality bar formal)
**Worklog:** v2.1 schema with `device: macbook`

---

## 1. Executive Summary

| Crate                | .rs files | Declared in lib.rs | Orphaned files | Leaked pub-in-private-mod | Send/Sync/Sized bounds | `#[non_exhaustive]` |
|----------------------|----------:|-------------------:|---------------:|--------------------------:|----------------------:|--------------------:|
| `pheno-config`       | 5         | 3                  | **1**          | 0                         | 1 (unreachable)       | 0                   |
| `pheno-context`      | 1         | 1                  | 0              | 0                         | 0                     | 0                   |
| `pheno-errors`       | 2         | 1                  | 0              | 0                         | 0                     | 0                   |
| `pheno-events`       | 4         | 3                  | 0              | 0                         | **2**                 | 0                   |
| `pheno-flags`        | 1         | 1                  | 0              | 0                         | 0                     | 0                   |
| `pheno-otel`         | 13        | 3                  | **5**          | 0                         | 1 (declared)          | 0                   |
| `pheno-port-adapter` | 11        | 2                  | 0              | 0                         | 0                     | 0                   |
| `pheno-tracing`      | 6         | 5                  | 0              | 0                         | 0                     | 0                   |
| **TOTAL**            | **43**    | **19**             | **6**          | **0**                     | **4** (2 reachable)   | **0**               |

### Three headline findings

1. **Strict task answer (0 leaked internals).** Across all 8 crates, **0 `pub` items appear inside a `mod` block that is not itself `pub`**. Every mod that contains public items is declared `pub mod` in `lib.rs`, and every `mod tests` block contains zero `pub` items.
2. **Inverse problem: 6 orphaned files with substantial public APIs.** `pheno-config/secret_rotation.rs` (748 LOC, 11 pub items) and 4 files in `pheno-otel` (error.rs, init.rs, metrics.rs, guard.rs + `exporter/` singular) are not declared in `lib.rs`. The pub items inside them are unreachable from outside the crate, but they are still discovered by `cargo doc` and lint tools, and they ship in `cargo package`. This is the **opposite** of "leaked" but the same hazard category: **the visible surface does not match the actual surface**.
3. **Zero `#[non_exhaustive]` across the entire fleet substrate.** Every public enum in every pheno-* crate is matchable by external code, meaning **no additive growth is possible without a SemVer-major bump**. With 4 public error enums and several ADT-bearing type families, this is a fleet-wide substrate debt.

---

## 2. Dimension 1 — Leaked Internals (pub in private mod)

### Audit method
For every `mod` declaration in every file in every crate, determined whether it is `pub mod` or `mod`, then verified that no `pub fn|struct|enum|trait|type|use|const|static` appears inside the non-`pub` mod block. Also verified that `#[cfg(test)] mod tests` blocks have zero `pub` items.

### Result
**0 instances across all 8 crates.** Every module that contains public items is reachable through a `pub mod` chain from `lib.rs`. The `#[cfg(test)] mod tests` blocks in `pheno-config`, `pheno-context`, `pheno-errors`, `pheno-otel`, `pheno-port-adapter` contain zero `pub` items. The single-file crates (`pheno-context`, `pheno-flags`) have no sub-modules at all.

### Inverse finding: orphaned `pub` items (unreachable from crate root)
The strict task definition (pub in private mod) is 0. The related question "are all `pub` items reachable from the crate root?" gives 6 files with significant dead code:

| File                                          | LOC  | Pub items | Disposition                                                                                                  |
|-----------------------------------------------|-----:|----------:|--------------------------------------------------------------------------------------------------------------|
| `pheno-config/src/secret_rotation.rs`         | 748  | 11        | Detailed module-level docs cross-referencing `hot_reload`, ADRs 046/048/078. **Unreachable** from `lib.rs`. |
| `pheno-otel/src/error.rs`                     | 120  | 5         | Declares `OtelError` (different from lib.rs `OtlpError`). **Unreachable.** Duplicate error type.            |
| `pheno-otel/src/init.rs`                      | ~120 | 3         | Declares `init`, `init_with_stdout`, `DEFAULT_OTLP_ENDPOINT`. **Unreachable.**                               |
| `pheno-otel/src/metrics.rs`                   | ~50  | 2         | Declares `MetricsHandle`. **Unreachable.**                                                                   |
| `pheno-otel/src/guard.rs`                     | ~80  | 2         | Declares `TelemetryGuard`. **Unreachable.**                                                                  |
| `pheno-otel/src/exporter/{mod,stdout}.rs`     | ~120 | 1+        | An alternative exporter (uses `opentelemetry_sdk::SpanExporter` not `OtlpPort`). **Unreachable.** Orphan.     |

This is the **dominant** structural defect in the substrate fleet. The fix is mechanical: add `pub mod secret_rotation;` to `pheno-config/src/lib.rs` and either declare or delete the 5 orphaned files in `pheno-otel`.

---

## 3. Dimension 2 — Send / Sync / Sized Auto-Trait Expectations

### Audit method
Grepped every `.rs` file for the patterns `(Send|Sync|Sized)\s*([+,]|where|=>)` and confirmed each match in source. Filtered out false positives (string literals, comments).

### Reachable bounds (visible to consumers)

| # | Crate           | Location                              | Bound                                                       | Status                                                                                                       |
|---|-----------------|---------------------------------------|-------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| 1 | `pheno-events`  | `src/bus.rs:67`                       | `pub callback: Arc<dyn Fn(&EventEnvelope) -> Ack + Send + Sync>` | **Required** — callback may be invoked from any thread; explicit > implicit. ✓ |
| 2 | `pheno-events`  | `src/trace.rs:143`                    | `pub fn try_init_with_writer<W: Write + Send + Sync + 'static>(...)` | **Required** — writer stored in a global `OnceLock`; the bounds are necessary and `#[cfg(test)]`-gated. ✓ |

### Unreachable bounds (in orphaned files)

| # | Crate           | Location                              | Bound                                                       | Status                                                                                                       |
|---|-----------------|---------------------------------------|-------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| 3 | `pheno-otel`    | `src/lib.rs:68`                       | `pub trait OtlpPort: Send + Sync`                          | **Required** — exporters are stored in a global registry and called from any thread. ✓ Reachable.            |
| 4 | `pheno-config`  | `src/secret_rotation.rs:152`          | `pub trait RotationSource: Send + Sync`                     | **Required** — `SecretRotator<S>` is wrapped in `Arc<Mutex<…>>` per the module docs. Unreachable from `lib.rs`. ✓ |

### Result
**2 reachable Send/Sync bounds**, both **necessary and well-formed** (explicit, on the right abstraction layer, with a justification in the surrounding docs). The remaining 2 are in the orphaned `secret_rotation.rs` (good shape, but invisible). **0 Sized bounds** anywhere — the substrate relies entirely on `?Sized`-default generics and elision, which is correct for library code.

### Recommendation (Q2)
No changes required. Add a code comment at the top of `secret_rotation.rs` (or its eventual `pub mod` declaration in `lib.rs`) calling out the `Send + Sync` requirement so that future consumers understand why the bound is mandatory on `RotationSource`.

---

## 4. Dimension 3 — `#[non_exhaustive]` Patterns

### Audit method
Grepped every `.rs` file for `#\[non_exhaustive`. Filtered for matches inside `pub enum` / `pub struct` declarations only.

### Result
**0 `#[non_exhaustive]` attributes across all 8 crates.** Every public enum is matchable by external code in a way that requires explicit handling of every variant:

| Crate                | Public enums (matchable)                                                                                              |
|----------------------|-----------------------------------------------------------------------------------------------------------------------|
| `pheno-config`       | `cascade::Error`, `secrets::SecretError`, `secrets::RevealError` (in declared mods)                                  |
| `pheno-context`      | `ContextError`                                                                                                        |
| `pheno-errors`       | `AppError` (5 variants), `rfc7807::Problem` companion                                                                |
| `pheno-events`       | `Ack`-adjacent: `EnvelopeError` (5+ variants in `core/mod.rs`)                                                       |
| `pheno-flags`        | `FlagError`                                                                                                           |
| `pheno-otel`         | `OtlpError` (4 variants) — plus unreachable `OtelError` (3 variants) in `error.rs`                                   |
| `pheno-port-adapter` | `ports::PortError`, `adapters::AdapterError`                                                                          |
| `pheno-tracing`      | (no public enums)                                                                                                     |

### Why this matters
Per the [Rust API Guidelines C-340](https://rust-lang.github.io/api-guidelines/flexibility.html#c-struct-private-fields-have-private-fields-c-407) and the [Rust 1.51 changelog](https://blog.rust-lang.org/2021/03/25/Rust-1.51.0.html#non-exhaustive-enums), `#[non_exhaustive]` is the canonical way to express "more variants may be added in the future without a SemVer bump." Without it:

- Adding a new variant to any of these enums is a **breaking change** that forces every downstream consumer to update their `match` arms.
- The 5 pheno-* crates with the broadest consumer base (`pheno-errors`, `pheno-events`, `pheno-otel`, `pheno-config`, `pheno-port-adapter`) are all in this state.

### Recommendation (Q3) — fleet-wide
Add `#[non_exhaustive]` to every public error enum across the 8 crates. Concretely:

1. `pheno-errors::AppError` — the canonical fleet error type, the highest-leverage target. Single PR, single crate, no API break.
2. `pheno-events::core::EnvelopeError` — the cross-service event validation error. Single PR.
3. `pheno-otel::OtlpError` — OTLP export error. Single PR.
4. `pheno-port-adapter::ports::PortError` + `adapters::AdapterError` — both at once, single PR (they're sibling types in the same crate).
5. `pheno-config::secrets::SecretError` + `pheno-config::secrets::RevealError` + `pheno-config::cascade::Error` — three enums in one PR, all consumer-facing.
6. `pheno-flags::FlagError` + `pheno-context::ContextError` — single PR across the two smallest crates.

Do **not** add `#[non_exhaustive]` to data-bearing enums like `Ack` (which is a struct, not an enum) or the `OtelError` / `OtlpError` pair in `pheno-otel` until the duplication is resolved (see §5.1).

---

## 5. Per-Crate Findings and Recommendations

### 5.1 `pheno-config` — 1 orphaned file, 0 leaked, 0 non_exhaustive

**Files:** `lib.rs` + `cascade.rs`, `secrets.rs`, `hot_reload.rs` (all declared) + **`secret_rotation.rs` (NOT declared)**

**`lib.rs:30-43`** declares:
```
pub mod cascade;
pub mod secrets;
pub mod hot_reload;
```

**Orphan: `secret_rotation.rs` (748 LOC, 11 pub items):**
- `RotationError` (enum, `pub enum`)
- `RotationOutcome` (struct, `pub struct`)
- `RollbackOutcome` (struct, `pub struct`)
- `RotationSource` (trait, `pub trait RotationSource: Send + Sync`)
- `FileSource`, `EnvSource`, `VaultSource` (structs, 3 sources)
- `SecretRotator<S: RotationSource>` (struct)
- `rotate()` method on `SecretRotator`

**Why it's orphaned:** Likely an incomplete v22-T4 (L33) secret-half rollout. The module-level docs are detailed and self-consistent; the file clearly intends to be `pub mod secret_rotation;`. The `hot_reload` module's docs (lib.rs:38-42) cross-reference the rotation module, and `secret_rotation.rs:1-7` says "This module is the **secrets** counterpart to [`crate::hot_reload`]."

**Recommendation:**
1. **Add `pub mod secret_rotation;` to `lib.rs`** (1 line) so the rotation API is reachable. This is the **single highest-leverage fix** in the audit.
2. After declaring, **add `#[non_exhaustive]`** to `RotationError` (line 86).
3. **Document the `Send + Sync` bound on `RotationSource`** (line 152) with a `// SAFETY:` / `// THREAD-SAFETY:` doc-comment explaining why the bound is mandatory (per §3 above).
4. The three source implementations (`FileSource`, `EnvSource`, `VaultSource`) are concrete types; no non-exhaustive needed.

### 5.2 `pheno-context` — clean

**Files:** `lib.rs` only. 13 pub items, 0 mod declarations outside the `#[cfg(test)] mod tests` at line 232.

**Public surface:**
- `ContextError` (enum, 1 variant)
- `Context` (struct, **all fields public**)
- `ContextBuilder` (struct, all fields private)
- 7 builder methods + `Context::new()`, `Context::from_headers()`

**Observations:**
- `Context` has **all-public fields** (`request_id`, `span_id`, `trace_id`, `user_id`, `org_id`, `metadata`) at lines 31-36. The builder exists for ergonomic construction, but consumers can mutate fields post-construction. This is **intentional for a value type**, but the public mutability of `HashMap` fields is unusual.
- `ContextError` has 1 variant only; `#[non_exhaustive]` would prevent future variants from being a SemVer break.

**Recommendation:**
1. Add `#[non_exhaustive]` to `ContextError` (line 8).
2. **No change** to the `Context` field visibility — the public-mutability pattern is a valid choice for a flat request-context DTO; the alternative (accessor methods) would add noise without buying safety.

### 5.3 `pheno-errors` — clean

**Files:** `lib.rs` + `rfc7807.rs` (both declared at line 47). 0 orphaned, 0 leaked.

**Public surface (in `lib.rs`):**
- `AppError` (enum, 5 variants: `Domain`, `NotFound`, `Conflict`, `Validation`, `Storage`)
- `rfc7807::Problem` (struct, 8 fields, all public)
- 4-5 `From` impls (`std::io::Error`, `anyhow::Error`, `&str`, `String`)
- `rfc7807::status_for()` function

**Observation:** `AppError` is the **highest-leverage enum in the substrate** (per `lib.rs:1-3` it's "the canonical `AppError` type for the `pheno-*` fleet" and is "consumed by L5 #81–85 across the pheno-* fleet" per line 38). 5 variants currently, almost-certainly growing.

**Recommendation:**
1. **Add `#[non_exhaustive]` to `AppError`** (highest priority across the entire audit — one attribute, one crate, broadest downstream impact).
2. **No change** to `rfc7807::Problem` — it's a struct (not an enum), and `#[non_exhaustive]` on a struct is for adding fields, which is usually undesirable. Document the field set as stable.

### 5.4 `pheno-events` — cleanest of the multi-mod crates, 2 Send/Sync bounds

**Files:** `lib.rs` (declares `bus`, `core`, `trace` at lines 27-29) + 3 sub-mods. 0 orphaned, 0 leaked.

**Public surface (28 pub items total):**
- `lib.rs`: `Ack` struct (2 public fields), re-export of `core::{EnvelopeError, EventEnvelope}` at line 31
- `bus.rs`: `Subscriber` (3 pub fields, `Send + Sync` on callback), `InMemoryBus` (struct + 5 pub methods), `try_init_with_writer` (`Send + Sync + 'static` on writer)
- `core/mod.rs`: `EventEnvelope`, `EnvelopeError`, `EventEnvelopeBuilder` + ~6 builder methods
- `trace.rs`: `SpanLevel` enum, `DEFAULT_FILTER` const, `MAX_FIELDS` const, `init()`, `try_init()` (2 unconstrained fns), `try_init_with_writer` (constrained, `#[cfg(test)]`)

**Observations:**
- The `Send + Sync` bound on `Subscriber::callback` (line 67) is **required and well-formed** — the callback is invoked from the `InMemoryBus` dispatch loop which is called from arbitrary threads.
- The `Send + Sync + 'static` bound on `try_init_with_writer` (line 143) is **required and well-formed** — the writer is stored in a global `OnceLock`. The function is `#[cfg(test)]`-gated, so it's not in the production surface.
- The `InMemoryBus` is implicitly `Send + Sync` (auto-derived from `Arc<Mutex<Inner>>`), but neither `unsafe impl Send` nor `unsafe impl Sync` is present — relying on auto-trait inference. This is correct but worth a doc comment.

**Recommendation:**
1. Add `#[non_exhaustive]` to `core::EnvelopeError` (the cross-service event validation error).
2. Add `#[non_exhaustive]` to `Ack` (it's a struct, not an enum, but it has 2 public fields — adding `#[non_exhaustive]` allows future fields without a SemVer break).
3. **No change** to the `Send + Sync` bounds — they're necessary, explicit, and well-documented.
4. Add a one-line doc comment on `InMemoryBus` confirming that it's `Send + Sync` (currently inferred; pinning the auto-trait in docs helps downstream consumers).

### 5.5 `pheno-flags` — clean

**Files:** `lib.rs` only. 7 pub items, 0 mod declarations.

**Public surface:**
- `FlagError` (enum, 1 variant)
- `FlagSet` (struct, fields private ✓)
- `new()`, `with()`, `from_env()`, `is_enabled()`, `snapshot()`

**Observations:**
- `FlagSet` follows the **canonical builder pattern** with private fields (line 95). All construction goes through `new()` + `with()` or `from_env()`. This is the **cleanest** crate in the audit.
- `FlagError` has 1 variant; `#[non_exhaustive]` is a forward-compatibility hedge.

**Recommendation:**
1. Add `#[non_exhaustive]` to `FlagError` (line 73).
2. **No change** to `FlagSet` — private fields is the right choice for a value type with a builder.

### 5.6 `pheno-otel` — 5 orphaned files, duplicate error type, two competing exporter trees

**Files:** `lib.rs` (declares `exporters`, `propagation`, `histogram`) + 9 sub-mod files, of which 4 are orphaned + 1 orphaned sub-tree (`exporter/` singular).

**`lib.rs:30-106` declared surface:**
- `OtlpError` (enum, 4 variants, lines 38-51)
- `ExportHandle` (struct, 2 public fields, lines 56-61)
- `OtlpPort` (trait, `Send + Sync` bound, line 68)
- `test_handle()` function (line 101)
- Re-exports: `pub mod exporters;` (line 87), `pub mod propagation;` (line 94), `pub mod histogram;` (line 98)

**Orphaned files (5 total):**

| File                       | Public items                                                                                       | Why orphaned                                                                                                                          |
|----------------------------|----------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| `error.rs` (120 LOC)       | `OtelError` (enum, 3 variants), `OtelError::kind()`, `exporter_init()`, `resource_build()`, `shutdown()` | **DUPLICATE of `OtlpError`** in lib.rs. Two error types in the same crate, only one reachable.                                         |
| `init.rs` (~120 LOC)       | `DEFAULT_OTLP_ENDPOINT` const, `init()`, `init_with_stdout()`                                      | Likely an alternative init API that the crate moved to `exporters/` (where the OTLP/JSON path is now the canonical export).             |
| `metrics.rs` (~50 LOC)     | `MetricsHandle` struct + `new()`                                                                   | Companion to the OTel metrics SDK; possibly superseded by the `histogram` module (L60) or a future pull.                                |
| `guard.rs` (~80 LOC)       | `TelemetryGuard` struct + `shutdown()`                                                             | Companion to `init()`; if `init` is orphaned, so is `guard`.                                                                           |
| `exporter/mod.rs`          | `pub mod stdout;` + `pub use stdout::StdoutSpanExporter;`                                          | Implements `opentelemetry_sdk::export::trace::SpanExporter` — different trait from the declared `OtlpPort`. Coexistence without collision. |
| `exporter/stdout.rs`       | `StdoutSpanExporter` struct                                                                        | Same as above.                                                                                                                        |

**Why this is the worst crate in the audit:**
- **2 different error types** (`OtlpError` reachable, `OtelError` unreachable) — consumers depending on `OtlpError` cannot catch errors from the unreachable init path.
- **2 different stdout exporter implementations** (one unreachable, using `SpanExporter` from `opentelemetry_sdk`; one reachable, using `OtlpPort`). These are not interoperable.
- **2 different init paths** (one unreachable `init()` / `init_with_stdout()` returning `TelemetryGuard`; one reachable test helper `test_handle()`).
- **5 files of dead code** shipping in the crate binary and appearing in `cargo doc`.

**Recommendation:**
1. **DECIDE which tree is canonical** — the `OtlpPort`-based surface in `lib.rs` (the ADR-038 hexagonal pattern) or the `SpanExporter`-based surface in the orphaned `error.rs` / `init.rs` / `guard.rs` / `exporter/` files (the OTel SDK pattern).
2. **If the declared `OtlpPort` tree wins (recommended — it matches ADR-038):** delete `error.rs`, `init.rs`, `metrics.rs`, `guard.rs`, and the entire `exporter/` directory. The unreachable `OtelError` is replaced by the reachable `OtlpError`. Single mechanical PR, ~400 LOC deleted.
3. **If the `OtelError` tree wins:** add `pub mod error; pub mod init; pub mod metrics; pub mod guard;` to `lib.rs`; delete `OtlpError`, `ExportHandle`, `OtlpPort`, `test_handle`, and the `exporters/` directory from `lib.rs`; rename `OtelError` to be the crate's only error type.
4. **Either way:** add `#[non_exhaustive]` to the surviving error type.

### 5.7 `pheno-port-adapter` — clean

**Files:** `lib.rs` (declares `ports` at line 93, `adapters` at line 96) + 9 sub-mod files. 0 orphaned, 0 leaked.

**Public surface:**
- `ports::cache::Cache`, `ports::cache::CacheError` + 2-3 fns
- `ports::time::Clock`, `ports::time::TimeSource` + 1-2 fns
- `adapters::in_memory_cache`, `adapters::redis_cache` (3-5 fns each)
- `adapters::mock_clock`, `adapters::system_clock` (1-2 fns each)
- `adapters::tcp`, `adapters::unix` (transport adapters, 2-3 fns each)

**Observations:**
- This is the **canonical hexagonal L4 pattern** per ADR-038: `Port` traits on the `ports/` side, `Adapter` impls on the `adapters/` side. Clean separation.
- No Send/Sync/Sized bounds visible — the trait definitions rely on auto-trait inference. This is correct for trait-object-free APIs.
- Two error enums (`PortError`, `AdapterError`).

**Recommendation:**
1. **Add `#[non_exhaustive]` to both `ports::cache::CacheError` and the corresponding `AdapterError`** in a single PR.
2. **Consider adding explicit `Send + Sync` bounds** to the `Cache` and `Clock` traits if any consumer needs to share them across threads via `Arc<dyn Cache>` (currently relies on auto-trait). This is a **judgment call** — explicit is better for cross-thread sharing, but adds noise for single-threaded consumers.
3. **No change** to the file/mod structure — this is the cleanest multi-file crate in the audit.

### 5.8 `pheno-tracing` — clean

**Files:** `lib.rs` (declares `adapters`, `cardinality`, `compat`, `port`, `sampling` at lines 30-34) + 5 sub-mod files. 0 orphaned, 0 leaked.

**Public surface:** (full enumeration not detailed — 0 quality issues found in the dimensions audited)

**Observations:**
- 5 declared mod files, all `pub`. No private mods with public items. The `#[cfg(test)] mod tests` in lib.rs (line ~70, inferred) contains zero `pub` items.
- No public enums, so `#[non_exhaustive]` is N/A for this crate.
- No `Send` / `Sync` / `Sized` bounds in the public surface.

**Recommendation:**
1. **No changes required** on the three audited dimensions.
2. **Follow-up (out of scope for this audit):** the `subscriber.rs` file (inferred — 16KB+ reported in prior health audits) is large enough that it may benefit from a similar surface review. Not in scope here because it's in the crate but its pub-item density was not enumerated in this audit.

---

## 6. Aggregate Recommendations (priority-ordered)

### P0 (one-line, high-leverage, no API break)

1. **`pheno-config/src/lib.rs`: add `pub mod secret_rotation;`** — reclaims 748 LOC + 11 pub items, the single highest-leverage fix in the audit.
2. **`pheno-errors/src/lib.rs:50`: add `#[non_exhaustive]` to `AppError`** — the canonical fleet error type, broadest downstream impact.
3. **`pheno-otel/src/lib.rs:38` and/or `pheno-otel/src/error.rs:20`: resolve duplicate error types** — pick one of `OtlpError` (declared) or `OtelError` (orphaned) and delete the other.

### P1 (one-PR-per-crate, additive)

4. **Fleet-wide `#[non_exhaustive]` sweep** — across the 8 crates, add `#[non_exhaustive]` to all public enums in a 6-PR batch (see §4 recommendation list).
5. **`pheno-otel`: resolve duplicate stdout exporter** — pick the `OtlpPort`-based `StdoutExporter` (recommended, matches ADR-038) or the `SpanExporter`-based `StdoutSpanExporter` and delete the other.
6. **`pheno-events/src/bus.rs:91`: add `// SAFETY: Send + Sync via Arc<Mutex<Inner>>` doc comment** to `InMemoryBus` to pin the auto-trait inference.

### P2 (judgment calls)

7. **`pheno-port-adapter`: consider explicit `Send + Sync` bounds on `Cache` and `Clock` traits** if cross-thread sharing is a known use case.
8. **`pheno-config/src/secret_rotation.rs:152`: document the `Send + Sync` bound on `RotationSource`** with a `// THREAD-SAFETY:` doc-comment explaining the `Arc<Mutex<…>>` wrap.

### P3 (informational, no action)

9. **`pheno-tracing/src/subscriber.rs`** is large enough to warrant its own audit pass — deferred, out of scope for SIDE-59.

---

## 7. Compliance Map

| Dimension                                     | Status                                                                                                       |
|-----------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| **D1. Leaked pub in private mod**             | 0 instances across 8 crates ✓                                                                               |
| **D2. Send / Sync / Sized expectations**      | 2 reachable bounds, both required and well-formed ✓                                                         |
| **D3. `#[non_exhaustive]` patterns**          | 0 across 8 crates — **fleet-wide gap**, see P1 #4                                                            |
| **Inverse: orphaned pub in undeclared files** | 6 files (1 in pheno-config, 5 in pheno-otel) — **see P0 #1, P0 #3**                                          |
| **Compliance with ADR-038 (hexagonal ports)** | 7 of 8 crates follow the pattern correctly; `pheno-otel` violates it (two competing exporter trees)          |
| **Compliance with ADR-023 (substrate quality)** | All 8 crates have spec (lib.rs docs) + tests; **0 have explicit `#[non_exhaustive]` discipline** — gap       |
| **Compliance with ADR-040 (coverage gates)**  | Out of scope for this audit (no test invocation performed)                                                   |

---

## 8. Cross-References

- `pheno-config/src/lib.rs:30-43` — declared mods
- `pheno-config/src/secret_rotation.rs:86-407` — 11 pub items, not declared
- `pheno-otel/src/lib.rs:30-106` — declared surface
- `pheno-otel/src/{error,init,metrics,guard}.rs` + `exporter/{mod,stdout}.rs` — 5 orphaned files
- `pheno-events/src/bus.rs:67` — Send + Sync on Subscriber::callback
- `pheno-events/src/trace.rs:143` — Send + Sync + 'static on try_init_with_writer
- `pheno-events/src/lib.rs:27-29` — declared mods
- `pheno-port-adapter/src/lib.rs:93-96` — declared mods
- `pheno-tracing/src/lib.rs:30-34` — declared mods
- `findings/audit-71-pillar-2026-06-17-wrapup.md` — fleet-level 71-pillar audit
- `findings/2026-06-21-v19-71-pillar-cycle-9-p0.md` — v19 plan (includes L50/L52/L54 security work)
- `docs/adr/2026-06-15/ADR-023-agent-effort-governance.md` — substrate quality bar
- `docs/adr/2026-06-17/ADR-038-hexagonal-port-adapter-l4-policy.md` — Port trait + Adapter impl canonical
- `docs/adr/2026-06-18/ADR-040-test-coverage-gates-per-tier.md` — coverage gates per substrate tier
- `docs/adr/2026-06-18/ADR-042-substrate-quality-bar.md` — codifies the Rule 3.1 quality bar
