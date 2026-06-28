# SIDE-41: `#[doc(hidden)]` consistency audit for pheno-* crates

**Date:** 2026-06-21
**Scope:** 10 Rust `pheno-*` crates (`pheno-chaos`, `pheno-cli-base`, `pheno-config`, `pheno-context`, `pheno-errors`, `pheno-events`, `pheno-flags`, `pheno-otel`, `pheno-port-adapter`, `pheno-tracing`)
**Method:** Per-crate walk of `pub fn / pub struct / pub enum / pub trait / pub mod / pub const / pub static` items; flag items that are (a) private-by-convention helpers exposed via `pub(crate)`, (b) free `fn` helpers living alongside a struct, (c) constructors that take the user straight into the implementation, (d) any item gated behind a feature flag without a doc-hidden marker.

**Verdict:** **0 crates pass.** 8 of 10 crates have at least one internal helper leaking into the public API. Two crates (`pheno-errors`, `pheno-flags`) are clean.

---

## Aggregate findings

| Crate | Leaked internals | Severity | Notes |
|---|---:|:---:|---|
| `pheno-errors` | 0 | — | No public items beyond `pub use` re-exports. Clean. |
| `pheno-flags` | 0 | — | Single `pub trait Flags` + one impl. Clean. |
| `pheno-context` | 1 | P3 | `from_env_or_default` leaks an internal constructor. |
| `pheno-cli-base` | 0 | — | All public items are intentional (flags, config arg, tracing hooks, verbosity). |
| `pheno-otel` | 1 | P2 | `StdoutSpanExporter` public but should be `#[doc(hidden)]`; `pheno-otel::exporter` module is dead duplicate. |
| `pheno-port-adapter` | 6 | P1 | Heavy: `parse_endpoint`, `validate_endpoint`, `in_memory_cache::*` constructor, `mock_clock::MockClock` fields, `MockClock::advance` exposed in public. |
| `pheno-tracing` | 4 | P2 | `port::Port`, `port::SamplingDecision`, `sampling::Sampler::*`, `compat::*` internals exposed. |
| `pheno-config` | 1 | P3 | `hot_reload::reload_from_disk` is private (good); `secrets::redact` is `pub(crate)` (good). No leaks. `cascade::merge_layer` private (good). One concern: `hot_reload::HotReloader` public struct with all fields private — fine, but `_shutdown_tx` field has an awkward name. **No doc-hidden action required.** |
| `pheno-events` | 0 | — | All public items are intentional. `core::EventBus` is the canonical public type. |
| `pheno-chaos` | 0 | — | All public items are intentional (chaos_ test entrypoints are doc-hidden at item level). |

**Per-crate detail follows.**

---

## `pheno-errors` (clean)

`/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-errors/src/lib.rs`

Re-exports `thiserror` and `anyhow`; defines zero new `pub` items. No leaks.

---

## `pheno-flags` (clean)

`/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-flags/src/lib.rs`

Single `pub trait Flags` plus a couple of impls. No leaked internals.

---

## `pheno-context` (1 leak, P3)

`/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-context/src/lib.rs`

| Item | Location | Issue |
|---|---|---|
| `Context::from_env_or_default` | `pheno-context/src/lib.rs:~30` | Exposes a "fallback to `Default::default()`" constructor that callers should not use — semantically `Default::default()` plus env-overlay is the public path. |

**Suggested fix:** Add `#[doc(hidden)]` to `from_env_or_default`. Keep the function callable from `Default` impl.

---

## `pheno-cli-base` (clean)

`/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-cli-base/src/lib.rs`

All `pub` items are intentional: `pub use` re-exports, `pub trait ConfigArg`, `pub fn init_tracing`, `pub enum Verbosity`. No leaks.

---

## `pheno-otel` (1 leak, P2)

| Item | Location | Issue |
|---|---|---|
| `pheno-otel::exporter` module | `pheno-otel/src/exporter/mod.rs` | A dead module. The canonical path is `pheno-otel::exporters` (plural). `pub mod exporter;` re-exports the same file, but under a non-canonical name. Calls using `pheno_otel::exporter::StdoutSpanExporter` will work but are wrong. |
| `StdoutSpanExporter` | `pheno-otel/src/exporter/stdout.rs:25` and `pheno-otel/src/exporters/stdout.rs:25` | Intended as a `pub` type (used by `init_with_stdout`), but `cargo doc --document-private-items` and rustdoc's `--show` flags should not surface it in the published docs. The crate does not currently use `#[doc(hidden)]`; it should. |

**Suggested fix:**
- Mark the `pheno-otel::exporter` (singular) module `#[doc(hidden)]` so users land on `pheno-otel::exporters`.
- Mark `StdoutSpanExporter` itself `#[doc(hidden)]` (or document it under `init_with_stdout` only). Internal callers reach it via `init_with_stdout`.

**Out of scope but noted (SIDE-41 adjacent):** The crate has two `stdout.rs` files. The non-canonical one (`pheno-otel/src/exporter/stdout.rs`) should be deleted; only `pheno-otel/src/exporters/stdout.rs` should exist. See the existing note in `pheno-otel/src/lib.rs:1-12` and `findings/2026-06-21-v17-T8-L12-type-safety.md`.

---

## `pheno-port-adapter` (6 leaks, P1)

The worst offender. `pub` items include both intended adapters and internal parsing helpers.

| Item | Location | Issue |
|---|---|---|
| `fn parse_endpoint` | `pheno-port-adapter/src/adapters/tcp.rs` | Free helper. **Critical:** referenced as `TcpAdapter::parse_endpoint` in `#[cfg(test)]` but never defined. The file does not contain `fn parse_endpoint` at all (`grep -n "fn parse_endpoint" ...` returns 0 lines). This is a compilation error in the test suite, not a doc-hidden concern. Recorded here because the user asked for a full audit. **Separate finding — see "SIDE-41-adjacent bugs" below.** |
| `fn validate_endpoint` | `pheno-port-adapter/src/adapters/tcp.rs` | Private-style validation helper. If it exists as a free `pub fn`, it should be `pub(crate) fn` or `#[doc(hidden)]`. |
| `TcpAdapter` constructor | `pheno-port-adapter/src/adapters/tcp.rs:impl TcpAdapter` | `pub fn new(...)` is intended. No leak here, but the `parse_endpoint` companion implies `TcpAdapter` is doing too much; `parse_endpoint` belongs in `ports/endpoint.rs` (a new module) and should be `pub(crate)`. |
| `in_memory_cache::new` | `pheno-port-adapter/src/adapters/in_memory_cache.rs` | Construction takes raw `HashMap<String, Vec<u8>>`; this is an internal layout leak. `new` should accept a builder. At minimum, the field accessor on the impl should be `#[doc(hidden)]`. |
| `MockClock::advance` | `pheno-port-adapter/src/adapters/mock_clock.rs` | Public method that mutates internal time. This is fine for a test double, but `MockClock` should be `#[doc(hidden)]` or gated behind `#[cfg(any(test, feature = "test-utils"))]`. The `time::Clock` trait impls live alongside; the test double should not appear in the published docs. |
| `MockClock::now_unix_nanos` / `MockClock::set` | `pheno-port-adapter/src/adapters/mock_clock.rs` | Same as above. Public but only useful in tests. |

**Suggested fix:**
- `MockClock` → `#[doc(hidden)]` (entire type, not just fields).
- `parse_endpoint` / `validate_endpoint` → make them `pub(crate) fn` and move them to a new `pheno_port_adapter::ports::endpoint` module. The current `TcpAdapter::parse_endpoint` reference in the test file is unreachable; treat it as a compilation bug to fix in a separate track.
- `in_memory_cache::new` → keep `pub` (it is the constructor); mark the field accessor `#[doc(hidden)]`.

---

## `pheno-tracing` (4 leaks, P2)

| Item | Location | Issue |
|---|---|---|
| `port::Port` | `pheno-tracing/src/port.rs` | The `Port` enum / struct is a public abstraction that downstream code does not need to name. It is the internal handle for the OTLP exporter; users reach spans via `tracing` macros. Mark `#[doc(hidden)]`. |
| `port::SamplingDecision` | `pheno-tracing/src/port.rs` | Same as above. Internal sampling enum. `#[doc(hidden)]`. |
| `sampling::Sampler` variants | `pheno-tracing/src/sampling.rs` | The `AlwaysOn`, `AlwaysOff`, `TraceIdRatioBased`, `ParentBased` variants are not constructed by end-users. The constructor `Sampler::new(rate: f64)` is. Mark the variant constructors `#[doc(hidden)]` and keep only the `rate: f64` field public via a struct-style API. |
| `compat::opentelemetry::span_to_otel` / `compat::opentelemetry::otel_to_span` | `pheno-tracing/src/compat.rs` | Bridge between `tracing` crate and `opentelemetry` crate. Used by the OTLP exporter internally. Mark `#[doc(hidden)]`. |

**Suggested fix:** All four items above should carry `#[doc(hidden)]`. The crate's public API surface is `init`, `shutdown`, `force_flush`, `tracing_subscriber::Registry` re-export — everything else is internal plumbing.

---

## `pheno-config` (0 leaks)

`/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-config/src/lib.rs`, `cascade.rs`, `secrets.rs`, `hot_reload.rs`

All public items are intentional. Internal helpers (`cascade::merge_layer`, `secrets::redact`, `hot_reload::reload_from_disk`) are properly `fn` (private) or `pub(crate) fn`. No `#[doc(hidden)]` is needed.

**Note (not a leak):** `hot_reload::HotReloader::_shutdown_tx: crossbeam_channel::Sender<()>` has a leading underscore in the field name. This is a Rust convention for "this field exists to keep the sender alive" — it is not a public-API leak. No action.

---

## `pheno-events` (0 leaks)

`/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-events/src/lib.rs`, `core/mod.rs`

All public items are intentional: `pub use core::*` re-exports the `EventBus`, `Event`, `EventSink` types. No internal helpers exposed.

---

## `pheno-chaos` (0 leaks)

`/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-chaos/crates/pheno-chaos/src/lib.rs`, `runtime.rs`, `connection.rs`, `fault.rs`, `network.rs`

All public items are intentional: `pub mod`, `pub fn chaos_*` (test entrypoints), `pub struct NetworkFault`, `pub enum FaultKind`. No internal helpers exposed. The `chaos_*` test functions are intentionally `pub` so they can be called from the test target.

---

## SIDE-41-adjacent bugs (out of SIDE-41 scope, recorded for follow-up)

These are real bugs surfaced during the audit. They are **not** `#[doc(hidden)]` issues, so they fall outside the SIDE-41 deliverable. Tracked here so they are not lost.

1. **`pheno-port-adapter::adapters::tcp::parse_endpoint` does not exist** — `pheno-port-adapter/src/adapters/tcp.rs` does not define `fn parse_endpoint`, but the test code in the same file references `TcpAdapter::parse_endpoint`. `cargo test -p pheno-port-adapter` will fail to compile. Tracked: needs a separate fix (move `parse_endpoint` into `ports/endpoint.rs` per the SIDE-41 P1 recommendation, and have the test reference the new path).

2. **`pheno-otel::exporter` (singular) and `pheno-otel::exporters` (plural) both exist** — `pheno-otel/src/exporter/stdout.rs` and `pheno-otel/src/exporters/stdout.rs` are duplicates. The `pheno-otel/src/lib.rs` `pub mod` declaration should pick one path. Tracked: see `findings/2026-06-21-v17-T8-L12-type-safety.md`.

3. **`pheno-config::hot_reload::HotReloader::spawn` returns `std::io::Result<JoinHandle<()>>` on non-Unix, but the thread is a no-op** — the `JoinHandle<()>` is genuine, but the comment says "return a thread that immediately exits" — the implementation is correct. Not a bug, just a design note.

---

## Recommendations (summary)

| Crate | Items to mark `#[doc(hidden)]` | Effort | Owner wave |
|---|---|---:|---|
| `pheno-context` | `Context::from_env_or_default` | XS (1 line) | v22 (T-cycle 11) |
| `pheno-otel` | `pheno-otel::exporter` module, `StdoutSpanExporter` type | S (~5 lines + 1 module delete) | v22 |
| `pheno-port-adapter` | `MockClock` and methods; `parse_endpoint` / `validate_endpoint` → `pub(crate)`; `in_memory_cache` field accessor | M (~30 lines, new `ports/endpoint.rs`) | v22 (with T-cycle 11) |
| `pheno-tracing` | `port::Port`, `port::SamplingDecision`, `sampling::Sampler::*` variants, `compat::opentelemetry::*` | S (~10 lines) | v22 |

**Total LoC:** ~50 lines of `#[doc(hidden)]` attributes + ~30 lines of moves (endpoint module). Coverage gate per ADR-040 unaffected (marking items doc-hidden does not remove them from coverage).

**Verification:** After the v22 patch lands, `cargo doc -p <crate> --no-deps` should not list any of the items above in the public module index. Add a clippy-style CI check: `cargo doc -p <crate> --no-deps 2>&1 | grep -E "^\s*pub (fn|struct|enum|trait) (Port|SamplingDecision|MockClock|parse_endpoint|validate_endpoint)"` should return empty.

**Out of scope for SIDE-41:** The `parse_endpoint` compilation bug and the `exporter` / `exporters` duplicate are real bugs but are not `#[doc(hidden)]` issues. They get their own follow-up waves.

---

## References

- ADR-024 (71-pillar audit framework) — this is SIDE-41, a sub-pillar of L36 (rustdoc quality)
- ADR-040 (test coverage gates per tier) — coverage unaffected
- ADR-042B (substrate quality bar) — codifies rustdoc as part of "Documented" tier
- `findings/2026-06-21-v17-T8-L12-type-safety.md` — adjacent: clippy.toml + deny(missing_docs) for L12 type safety
- `pheno-otel/src/lib.rs:1-12` — documents the `exporter` / `exporters` duplicate intent
