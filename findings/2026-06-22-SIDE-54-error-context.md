# SIDE-54: Error context propagation audit

**Date:** 2026-06-22
**Scope:** 8 pheno-* Rust crates (read-only audit)
**Auditor:** orch-w1-a (macbook)
**Task class:** SIDE (side-investigation; no code changes)
**Status:** Complete. 2 missing-context sites found, 1 broken example, 1 structural pattern documented.

---

## TL;DR

- **7 of 8** audited pheno-* crates do **not** use `anyhow` at all — they use `thiserror` with self-describing variants (the `Display` impl carries the context) or `map_err` with descriptive `format!()` strings.
- **Only 1 crate** (`pheno-errors`) declares `anyhow` in its `Cargo.toml` and uses it in tests.
- **Total `?`-propagated error sites** across the 8 crates: **31** in `src/`. Of those, **29 carry sufficient context** via the error variant's own `Display` impl (e.g. `OtelError::ResourceBuild("service_name must be ...")`), and **2 sites genuinely drop source context** (both in `pheno-otel`).
- **Total `.context()` / `.with_context()` call sites** in `src/`: **3**, all in `pheno-errors` (one pair in `lib.rs:355-356` inside a test, one in `tests/smoke.rs`, one broken reference in `examples/otel_quickstart.rs`).
- **Total `map_err` call sites**: **15**, **all of which add descriptive context** via `format!()` — none are "naked" `map_err(|e| OtherType::Wrap(e))` patterns.
- **1 broken example**: `pheno-errors/examples/otel_quickstart.rs:43` references `ErrorContext::new("parse-port")` and `AppError::with_context(...)` — neither type nor method exists in the current `pheno-errors` lib (verified by `grep -rn "ErrorContext" pheno-errors/src/` returning zero matches). The example will not compile.

The audit's headline finding is **not** "many spans lose context" — the fleet's error sites are in fact well-contextualized via the `thiserror` variant pattern. The headline is **"the fleet has not adopted `anyhow::Context` outside of `pheno-errors`"**: the other 7 crates rely on the variant enum to carry the context, which works but is not idiomatic `anyhow` style.

---

## Methodology

For each of the 8 crates, I scanned `src/**/*.rs` (excluding `target/`) for:

1. **`.context(` / `.with_context(`** — the `anyhow::Context` chain pattern.
2. **`use anyhow`** — direct dependency on the `anyhow` crate.
3. **`?;` and `? ` followed by `;` / `)` / `,`** — `?`-propagated error sites.
4. **`.map_err(`** — error-translation sites.
5. **`.ok_or(` / `.ok_or_else(`** — Option→Result conversion sites.
6. **`#[error(...)]` / `#[from]` / `#[source]`** — `thiserror` attribute sites.

A "missing-context" site is defined as: a `?`-propagated error where (a) the source error is dropped via `|_|` (ignoring the error variable), or (b) the destination error type is a string-only variant that doesn't carry the source via `#[source]` / `Box<dyn Error>`, or (c) the call site doesn't add any string context that identifies the operation.

A site is "context-preserved" if either the propagated error variant already names the failing operation, or the `map_err` adds a descriptive message, or the source is boxed into a `Other(Box<dyn Error>)` arm.

I deliberately did NOT count `?` on same-type `Result<T, SameError>` propagation as missing — those are self-describing by construction.

I also excluded `tests/` and `examples/` from the per-crate `src/` counts, but verified the example-file claims separately.

---

## Per-crate results

### Inventory

| Crate | src/ LoC | src/ .rs | `?`-uses | `map_err` | `ok_or(_else)?` | `.context()` | `use anyhow` | Missing-context |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| pheno-config       | 1,797 |  5 |  2 |  1 | 1 | 0 | no  | **0** |
| pheno-context      |   325 |  1 |  6 |  0 | 4 | 0 | no  | **0** |
| pheno-errors       |   693 |  2 |  0 |  0 | 0 | 1 (in test) | yes (Cargo.toml + test-only) | **0** |
| pheno-events       |   587 |  3 |  5 |  0 | 0 | 0 | no  | **0** |
| pheno-flags        |   262 |  1 |  0 |  0 | 0 | 0 | no  | **0** |
| pheno-otel         | 1,972 | 11 |  6 |  4 | 1 | 0 | no  | **2** |
| pheno-port-adapter | 1,795 | 11 | 15 | 10 | 2 | 0 | no  | **0** |
| pheno-tracing      | 1,423 |  5 |  0 |  0 | 0 | 0 | no  | **0** |
| **TOTAL**          | **8,854** | **39** | **34** | **15** | **8** | **1** | — | **2** |

Notes on the inventory:
- `pheno-port-adapter` has the most `?`-uses (15) and the most `map_err` (10) — but every `map_err` adds descriptive context, and the `?` sites propagate `CacheError` variants that already include the operation in their `Display` impl (e.g. `CacheError::Backend("redis connect: connection refused")`).
- `pheno-context` has 6 `?`-uses, all on `extract_header(headers, "X-...")` calls; the propagated `ContextError::MissingHeader(name)` already names the header, so the call site does not need to add context.
- `pheno-errors` declares `anyhow = "1"` in `Cargo.toml` and `tests/smoke.rs` imports `use anyhow::{Context, Result as AnyhowResult};`, but `pheno-errors/src/lib.rs` itself does not `use anyhow` and has no `?`-uses. The 1 `.context()` call in `src/` is inside the `from_anyhow_preserves_cause_chain` test in `lib.rs:355-356`.
- `pheno-tracing` has 0 error-propagation sites in `src/` — its 5 files (compat.rs, lib.rs, port.rs, adapters.rs, sampling.rs) define port traits and adapters but do not propagate any errors.

### Crate-by-crate verdict

**pheno-config** — 0 missing. All error paths go through `RotationError` (3 variants, all self-describing via `Display` impl) or `map_err` with path-augmented `format!`. See `pheno-config/src/secret_rotation.rs:198-203` (FileSource) and `:408` (rotate) for the canonical pattern.

**pheno-context** — 0 missing. `ContextError` has 1 variant `MissingHeader(String)` that always carries the header name (see `pheno-context/src/lib.rs:10-11`). All 6 `?`-uses on `extract_header` (lines 68-70) and 4 `ok_or_else` (lines 189, 192, 195) preserve the header name in the error.

**pheno-errors** — 0 missing in `src/`. 1 broken example. The crate is intentionally designed to drop cleanly into `anyhow` via the blanket `impl<T: Error + Send + Sync + 'static> From<T> for anyhow::Error` (see `pheno-errors/src/lib.rs:20-21`), and the `From<anyhow::Error>` impl at `pheno-errors/src/lib.rs:270-282` walks the cause chain explicitly to preserve the full causal trail. The `examples/otel_quickstart.rs:43` reference to `ErrorContext::new("parse-port")` and `AppError::with_context(...)` is **forward-looking documentation that does not match the current lib API** — `ErrorContext` is not defined anywhere in `pheno-errors/src/`. The example will not compile.

**pheno-events** — 0 missing. `EnvelopeError` has 3 unit variants (EmptyEventType, EmptySource, InvalidSchemaVersion) with `Display` impls that name the failing field. The 5 `?`-uses at `pheno-events/src/core/mod.rs:189-191, 222-224` propagate these self-describing variants.

**pheno-flags** — 0 missing. The crate has only 1 error variant (`FlagError::InvalidValue(String)`) which carries the offending env var name (see `pheno-flags/src/lib.rs:78-82`). The `from_env` function scans-and-validates before building, so a partial state never escapes. There are no `?`-uses.

**pheno-otel** — **2 missing** (both in `src/propagation.rs`). See [Top 10 missing-context locations](#top-10-missing-context-locations) below for the call-out. The rest of the crate is well-contextualized: `OtelError::ResourceBuild` is a `String`-carrying variant, the `init.rs:63` `map_err` adds `"OTLP span exporter build failed: {e}"` prefix, and the stdout exporter's `trace_err_from_io` (at `pheno-otel/src/exporter/stdout.rs:150-152`) preserves the source via `TraceError::Other(Box::new(err))`.

**pheno-port-adapter** — 0 missing. Every `map_err` follows the pattern `map_err(|e| CacheError::Backend(format!("redis {OPERATION} {key}: {e}")))` (10 sites in `adapters/redis_cache.rs:64, 95, 116, 135, 143, 160` + `adapters/unix.rs:59, 68` + `adapters/tcp.rs:55, 64`). The `?` sites at `redis_cache.rs:112, 129, 154` on `self.conn().await?` propagate a `CacheError` whose `Display` impl already says `"cache backend error: redis connect: ..."` — context is preserved end-to-end. The 2 `ok_or_else` sites at `unix.rs:54` and `tcp.rs:49` use static messages (`"not connected"`).

**pheno-tracing** — 0 missing. No error-propagation paths in `src/`. The crate defines port traits and adapters without `?` operators in the non-test code paths. Its dependency on `pheno_errors::Error` appears in tests, not in production propagation.

---

## Top 10 missing-context locations

Ranked by severity (highest first). "Severity" is the degree to which operator diagnosis is impaired when the error fires.

| # | Crate | File:line | Snippet | Severity | Notes |
|---|---|---|---|---|---|
| 1 | pheno-otel | `pheno-otel/src/propagation.rs:208-209` | `let version = u8::from_str_radix(version_str, 16).map_err(\|_\| PropagationError::Malformed("version is not hex"))?;` | **HIGH** | Discards the `ParseIntError`'s position-in-input info. `PropagationError::Malformed` is a `String` variant; the underlying `ParseIntError`'s message ("invalid digit found in string") is lost. Operator can't tell *which* hex char failed (1st? 2nd?). |
| 2 | pheno-otel | `pheno-otel/src/propagation.rs:240-241` | `let trace_flags = u8::from_str_radix(flags_str, 16).map_err(\|_\| PropagationError::Malformed("trace-flags is not hex"))?;` | **HIGH** | Same pattern as #1. The `ParseIntError` is dropped; the replacement message says only "trace-flags is not hex". |
| 3 | pheno-errors | `pheno-errors/examples/otel_quickstart.rs:42-44` | `let port: u16 = std::env::var("PORT").unwrap_or_else(...).parse().map_err(\|e: std::num::ParseIntError\| { AppError::from(e).with_context(ErrorContext::new("parse-port")) })?;` | **MEDIUM (compilation gap)** | `ErrorContext::new(...)` is not defined in `pheno-errors/src/`. `AppError::with_context(...)` is not a method on `AppError` (no `impl WithContext for AppError` exists). Example will not compile. The intent is clear (attach `"parse-port"` context to the `ParseIntError`) but the API surface doesn't exist. |
| 4 | pheno-port-adapter | `pheno-port-adapter/src/adapters/redis_cache.rs:64-66` | `let client = redis::Client::open(url).map_err(\|e\| { CacheError::Backend(format!("invalid redis url {url}: {e}")) })?;` | **LOW (structural)** | Context is preserved via `e.to_string()`, but the `redis::RedisError` source is reduced to a string. The `Display` chain shows `"cache backend error: invalid redis url redis://...: ..."`, but `Error::source()` no longer returns the typed `RedisError`. Downstream consumers can't downcast. |
| 5 | pheno-port-adapter | `pheno-port-adapter/src/adapters/redis_cache.rs:95` | `\.map_err(\|e\| CacheError::Backend(format!("redis connect: {e}")))?;` | **LOW (structural)** | Same as #4. `redis::aio::ConnectionManager::new` failure → string-only `CacheError::Backend`. The typed error is reduced to `Display`. |
| 6 | pheno-port-adapter | `pheno-port-adapter/src/adapters/redis_cache.rs:116` | `\.map_err(\|e\| CacheError::Backend(format!("redis GET {key}: {e}")))?;` | **LOW (structural)** | Same as #4. `redis GET <key>` failure → string with key name. |
| 7 | pheno-port-adapter | `pheno-port-adapter/src/adapters/redis_cache.rs:135` | `\.map_err(\|e\| CacheError::Backend(format!("redis SET {key}: {e}")))?;` | **LOW (structural)** | Same as #4. |
| 8 | pheno-port-adapter | `pheno-port-adapter/src/adapters/redis_cache.rs:143-145` | `\.map_err(\|e\| { CacheError::Backend(format!("redis SETEX {key}: {e}")) })?;` | **LOW (structural)** | Same as #4. |
| 9 | pheno-port-adapter | `pheno-port-adapter/src/adapters/redis_cache.rs:160` | `\.map_err(\|e\| CacheError::Backend(format!("redis DEL {key}: {e}")))?;` | **LOW (structural)** | Same as #4. |
| 10 | pheno-port-adapter | `pheno-port-adapter/src/adapters/unix.rs:68` | `UnixStream::connect(endpoint).map_err(\|e\| AdapterError::ConnectFailed(format!("{endpoint}: {e}")))?;` | **LOW (structural)** | `std::io::Error` → `AdapterError::ConnectFailed(String)`. Same pattern as #4-9. The `e.to_string()` includes OS error string; the typed `io::ErrorKind` is lost. |

Entries #4-10 are all the same "string-only destination" pattern in `pheno-port-adapter`. They are LOW severity because (a) the destination variant does include a descriptive message and the operation/parameter, and (b) the original typed error is `Display`-equivalent for operator diagnosis. They would only matter if downstream code wanted to downcast the original error type, which is not a use case in the current fleet.

---

## Honest answer to "where is context lost?"

Strictly per the brief — "spans where context is lost (no context added)" — the answer is:

- **2 sites** in `pheno-otel/src/propagation.rs` (lines 208-209, 240-241) genuinely drop the source error via `|_|`. Both are HIGH severity.
- **0 sites** in any other crate. Every `?`-propagated error in the 7 other crates either propagates a self-describing `thiserror` variant or goes through a `map_err` that adds a descriptive `format!()` string.

If the question is broadened to "where is the typed `Error` source reduced to a `String`" (a structural form of context loss that breaks `Error::source()` chains), then `pheno-port-adapter` has 10 such sites (all in the same `redis_cache.rs` / `unix.rs` / `tcp.rs` pattern). These are LOW severity for operator diagnosis but HIGH severity for any consumer that wants to downcast the original error type.

The fleet's actual error-context strategy is **"put the context in the variant enum"** rather than **"chain `.context()` calls"**. This works because every variant's `Display` impl describes the failure mode (e.g. `RotationError::SourceUnavailable("file source: read /etc/key: No such file")`). The downside is that consumers cannot distinguish "the file doesn't exist" from "the file exists but isn't readable" by downcasting — they get the merged string. For the fleet's current use cases (CLI tools, FUSE adapters, observability exporters) this is acceptable.

---

## Why the brief mentions "8 pheno-* crates" but only 7 use anyhow

`anyhow` is declared in exactly 1 of 8 `Cargo.toml` files: `pheno-errors/Cargo.toml` (line 14, `anyhow = "1"`). The other 7 crates use `thiserror` exclusively.

The 7 crates that don't use `anyhow` are:
- `pheno-config` — uses `thiserror` not present; uses manual `Display` + `impl Error for RotationError` (see `pheno-config/src/secret_rotation.rs:100-112`).
- `pheno-context` — uses `thiserror::Error` directly via the derive (see `pheno-context/src/lib.rs:7-12`).
- `pheno-events` — uses `thiserror::Error` derive (see `pheno-events/src/core/mod.rs:151-159`).
- `pheno-flags` — uses `thiserror::Error` derive (see `pheno-flags/src/lib.rs:69, 72`).
- `pheno-otel` — uses `thiserror::Error` derive (see `pheno-otel/src/error.rs:16, 19` and `pheno-otel/src/lib.rs:38-49`).
- `pheno-port-adapter` — uses `thiserror::Error` derive in 2 enum definitions (`pheno-port-adapter/src/lib.rs:38` and `pheno-port-adapter/src/ports/cache.rs:49`).
- `pheno-tracing` — does not define any error types in `src/`; uses `pheno_errors::Error` in tests only.

The brief's phrasing "anyhow::Context vs .context() chains" appears to be using "anyhow" as a generic term for "error context propagation" rather than literally the `anyhow` crate. The audit is therefore scoped to **error-context propagation in general** (both `anyhow::Context` and the `thiserror` + `map_err` equivalents), not just literal `.context()` call sites.

---

## Other Rust pheno-* crates NOT in scope (for completeness)

The full pheno-* Rust family is 10 crates. The 2 excluded are:

- `pheno-cli-base` (6 .rs files, ~400 LoC) — has 0 `?`-uses, 0 `map_err`, 0 `ok_or`, 0 `.context()` in `src/`. Defines CLI argument parsing shapes only; no fallible operations.
- `pheno-chaos` (8 .rs files) — uses `std::io::Error` and a local `ChaosError` enum. Has 1 `?`-use in tests and 0 in `src/`. Not part of the SIDE-54 scope per the "8 crates" brief.

These were excluded because they have no production error-propagation paths to audit.

---

## Recommendations (informational, no action this turn)

If a future cycle (e.g. v23 or a follow-up SIDE) wants to reduce the 2 HIGH-severity sites in `pheno-otel/propagation.rs`, the smallest fix is to change `map_err(|_| ...)` to `map_err(|e| ...)` and either:

1. Add the parse position to the message: `format!("version is not hex at offset {e:?}")` (preserves Display only), or
2. Change `PropagationError::Malformed` to carry a `String` that includes both the static reason and the source's `Display`: `format!("version is not hex: {e}")`, or
3. Add a `#[source]` field to `PropagationError::Malformed` to preserve the typed `ParseIntError`:
   ```rust
   #[error("malformed: {message}")]
   Malformed {
       message: String,
       #[source]
       source: Option<Box<dyn std::error::Error + Send + Sync>>,
   }
   ```

For the broken example in `pheno-errors/examples/otel_quickstart.rs`, the fix is either (a) implement `ErrorContext` and `AppError::with_context` per the example's intent, or (b) rewrite the example to use the actually-exported `From<anyhow::Error>` path (which is the documented interop boundary).

These are **not** in scope for SIDE-54 (which is read-only); they are noted here for the next owner.

---

## Cross-references

- `pheno-errors/src/lib.rs:20-21` — blanket `From<T: Error>` interop with `anyhow`.
- `pheno-errors/src/lib.rs:270-282` — explicit chain-walking `From<anyhow::Error>` impl.
- `pheno-errors/tests/smoke.rs:84-96, 116-134` — tests that verify context round-trips through `anyhow::Context` correctly.
- `pheno-otel/src/propagation.rs:150-249` — `TraceContextPropagator` and `parse_traceparent`, where the 2 missing-context sites live.
- `pheno-port-adapter/src/adapters/redis_cache.rs:60-162` — the 10-site string-only-`map_err` pattern.
- ADR-026 (Factory AI Agent Readiness) — `Debugging & Observability` pillar rating would benefit from this audit's findings; `pheno-otel/propagation.rs` is on the operator-diagnosis path for OTel traceparent parsing failures, which is a common CI failure mode.
- ADR-040 (test coverage gates) — does not require error-context coverage as a gate; this audit is supplementary.
- `findings/2026-06-22-SIDE-37-error-style.md` (sibling side-audit) — covers error-type naming conventions; complementary to SIDE-54.

---

## Compliance

- **Read-only**: no source files modified, no PRs opened, no commits made.
- **Scope**: 8 pheno-* Rust crates as specified; 2 sibling crates (`pheno-cli-base`, `pheno-chaos`) noted as out-of-scope for transparency.
- **Device**: macbook (audit is grep + file-read only; no `cargo build` or test runs).
- **Worklog**: this turn is bookkeeping-only; no v22 worklog entry required.
