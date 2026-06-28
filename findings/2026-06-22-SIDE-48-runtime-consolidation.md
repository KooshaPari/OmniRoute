# SIDE-48 — Tokio runtime consolidation across the pheno-* Rust fleet

**Date:** 2026-06-22
**Task:** SIDE-48
**Scope:** every `pheno-*` Rust crate at the top of the monorepo sparse-checkout cone (10 crates) — `pheno-chaos` (workspace + 2 sub-crates), `pheno-cli-base`, `pheno-config`, `pheno-context`, `pheno-errors`, `pheno-events`, `pheno-flags`, `pheno-otel`, `pheno-port-adapter`, `pheno-tracing`
**Method:** static parse of `Cargo.toml` (declared constraint + features) + source-tree scan of `src/**/*.rs` and `tests/**/*.rs` (actual tokio API surface) for each crate
**Verdict (top line):** 2/10 crates declare tokio but only **1** actually uses it in the public surface (`pheno-port-adapter`). 1 declares tokio but never uses it (`pheno-events`, dev-dep only — dead weight). 1 declares `features = ["full"]` despite having no tokio API in `src/` (`pheno-tracing`). 6 crates are tokio-free by design. **All three declared tokio users can shed between 50 % and 100 % of their declared feature surface.**

---

## 1. Executive summary

The pheno-* Rust fleet is **async-runtime-fragmented in declared features, not in actual usage.** SIDE-10 (2026-06-21) confirmed the fleet converges on tokio at the runtime-choice level. SIDE-36 (2026-06-22) confirmed version alignment (`tokio 1.52.3` everywhere). SIDE-48 closes the loop on **feature-surface alignment** — the third leg of the consolidation stool.

**Per-crate tokio footprint (declared vs. used):**

| # | Crate | Declared in Cargo.toml | Scope | Features declared | Actual tokio API in src/ | Actual tokio API in tests/ | Reduction opportunity |
|---|---|---|---|---|---|---|---|
| 1 | `pheno-cli-base` | NO | — | — | none | none | **none** (sync by design) |
| 2 | `pheno-config` | NO | — | — | none | none | **none** (sync by design) |
| 3 | `pheno-context` | NO | — | — | none | none | **none** (sync by design) |
| 4 | `pheno-errors` | NO | — | — | none | none | **none** (sync by design) |
| 5 | `pheno-events` | **YES** | **dev-deps** | `["macros", "rt-multi-thread"]` | **none** | **none** | **100 %** — remove entirely |
| 6 | `pheno-flags` | NO | — | — | none | none | **none** (sync by design) |
| 7 | `pheno-otel` | NO | — | — | none | none | **none** (sync by design) |
| 8 | `pheno-port-adapter` | YES | main + dev | main: `["rt-multi-thread", "macros", "sync", "time"]`; dev: `["macros", "rt-multi-thread"]` | `tokio::sync::Mutex` (2 files); `redis-rs` w/ `tokio-comp` | `tokio::time::sleep` (1 use); `#[tokio::test]` × 12 | **~60 %** — split main/dev; main to `["sync"]`; dev to `["macros", "rt", "time"]` |
| 9 | `pheno-tracing` | YES | main + dev | main: `["full"]`; dev: `["rt", "macros", "test-util"]` | **none** | `#[tokio::test]` × 7 | **~100 %** — move entire dep to dev-deps; drop `full` |
| 10 | `pheno-chaos` (workspace + 2 sub-crates) | **NO (deliberate)** | — | — | none | none | **none** — runtime-agnostic by design (ADR-040) |

**Three alternatives evaluated for the fleet default:**

| # | Alternative | Fleet fit | Verdict |
|---|---|---|---|
| **A** | `tokio = { version = "1", features = ["full"] }` (current `pheno-tracing` choice) | Poor — pulls `fs`, `net`, `process`, `signal`, `parking_lot`, `io-driver`, `io-std` that no substrate uses; inflates compile time + binary | **REJECT** for substrates |
| **B** | `tokio = { version = "1", default-features = false, features = [<explicit minimal>] }` (current `pheno-port-adapter` choice) | Strong — smallest set, cargo's `--cfg tokio_unstable` is opt-in, feature surface is auditable | **ACCEPT** as fleet default |
| **C** | `smol` + `async-io` + `async-lock` (no tokio) | Rejected for this fleet — `redis-rs` has no `smol-comp` feature; `reqwest`, `hyper`, `tonic`, `axum` all require tokio; rewriting every `tokio::sync::Mutex` → `async_lock::Mutex` is a non-trivial port; `#[tokio::test]` becomes `async-io::block_on` | **REJECT** for substrate crates; **CONSIDER** for future greenfield sub-crates (e.g. `pheno-pure-runtime` with no I/O) |

**Recommended default for the pheno-* fleet:**

> **Tokio with `default-features = false` + explicit minimal feature set** (Alternative **B**).
> Default feature set for substrate crates: `["rt", "macros", "sync", "time"]` (test-runtime-friendly minimum).
> Default feature set for adapter/transport crates: `["rt-multi-thread", "macros", "sync", "time"]` (multi-threaded for high-fanout workloads).
> Default rule: `default-features = false` is mandatory; `features = ["full"]` is forbidden in any pheno-* Cargo.toml.

---

## 2. Methodology

For each of the 10 pheno-* Rust crates:

1. Read `Cargo.toml` and capture declared `tokio = …` lines (both `[dependencies]` and `[dev-dependencies]`).
2. Scan `src/**/*.rs` for `use tokio`, `tokio::X::Y`, `#[tokio::*]`, `tokio::spawn`, `tokio::time::*`, `tokio::sync::*`, `tokio::select!`, `tokio::join!`, `tokio::try_join!`.
3. Scan `tests/**/*.rs` and `examples/**/*.rs` for the same patterns.
4. Scan `examples/` and `fuzz/` for separate tokio usage (the `pheno-port-adapter/fuzz` sub-crate is a separate package).
5. Classify each crate as: **(S) sync by design**, **(A) async-substrate w/ tokio public surface**, **(A-test-only) async in tests but not in src**, **(A-dead) tokio declared but never used**.

Sparse-checkout cone is `true` for this branch (per AGENTS.md § "Stale / warnings"). The 10 crates above are the ones whose `Cargo.toml` files were verifiable at audit time. A 2026-06-22 re-sweep of `findings/2026-06-21-SIDE-10-async-runtime.md` confirmed the in-cone set has been stable since that audit closed.

---

## 3. Per-crate findings

### 3.1 `pheno-cli-base` — sync by design

**File:** `pheno-cli-base/Cargo.toml`

- Declared tokio: **none**. (`pheno-cli-base/Cargo.toml:22-28` lists `clap`, `tracing`, `tracing-subscriber` only.)
- `pheno-cli-base/SPEC.md:53` (per SIDE-36 anchor): "pure synchronous, no tokio".
- Source scan: 0 hits for `tokio::`, `async fn`, `.await`, `#[tokio::*]`.

**Verdict:** **No change.** Sync CLI boilerplate. The clap + tracing deps pull in `tokio` only transitively through `tracing-subscriber` features that we don't enable. Stay sync; stay runtime-agnostic.

---

### 3.2 `pheno-config` — sync by design

**File:** `pheno-config/Cargo.toml`

- Declared tokio: **none**. (`pheno-config/Cargo.toml:18-51` lists `zeroize`, `figment`, `toml`, `proptest`, `arc-swap`, `signal-hook`, `crossbeam-channel`, `tempfile` only.)
- Source scan (`pheno-config/src/cascade.rs`, `secrets.rs`, `hot_reload.rs`): uses `std::sync::Arc`, `crossbeam_channel::Receiver`, `signal_hook` — all sync.
- SIDE-10 § 3.3 confirmed lock-resolved `tokio` is **not** present in the lockfile; the only non-config dep is `zeroize 1.9.0`.

**Verdict:** **No change.** Layered config cascade is sync. SIGHUP-driven hot reload uses `signal-hook` (sync signal handling) + `crossbeam-channel` (sync mpsc) — no runtime needed.

---

### 3.3 `pheno-context` — sync by design

**File:** `pheno-context/Cargo.toml`

- Declared tokio: **none**. (`pheno-context/Cargo.toml:16-30` lists `thiserror`, `http`, `proptest` only.)
- Source scan (`pheno-context/src/lib.rs`): builder + header extraction + structured metadata, all sync.
- The v19 T3 OIDC federation work (per AGENTS.md) replaced the earlier `tokio::sync::RwLock`-based implementation with a synchronous `parking_lot::RwLock`-based version (per SIDE-10 § 8).

**Verdict:** **No change.** Context carrier stays sync; OIDC federation uses parking_lot, not tokio.

---

### 3.4 `pheno-errors` — sync by design

**File:** `pheno-errors/Cargo.toml`

- Declared tokio: **none**. (`pheno-errors/Cargo.toml:9-21` lists `anyhow`, `thiserror`, `tracing`, `serde`, `pheno-otel`, `proptest` only.)
- Source scan: pure `AppError` type + thiserror derive. Sync.
- SIDE-36 noted: "AGENTS.md mentions `From<tokio::io::Error>` but no Cargo.toml dep yet". If/when the `From<tokio::io::Error>` impl lands, the smallest acceptable feature set is `default-features = false, features = ["io-util"]` — see SIDE-36 § 4 note 3.

**Verdict:** **No change today.** When the `From<tokio::io::Error>` impl is added, pin to `default-features = false, features = ["io-util"]` (does not pull in `rt`, `sync`, `time`, etc.).

---

### 3.5 `pheno-events` — dead-weight tokio dev-dep

**File:** `pheno-events/Cargo.toml`

- Declared tokio: **YES**, dev-deps only (`pheno-events/Cargo.toml:46`):
  ```toml
  tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
  ```
- Source scan (`pheno-events/src/bus.rs`, `trace.rs`):
  - `bus.rs:40` uses `std::sync::{Arc, Mutex}` — **std** mutex, not tokio.
  - 0 hits for `tokio::`, `async fn`, `.await`, `#[tokio::*]`.
  - 0 hits for `futures::`, `smol::`, `async_std::`.
- Test scan (`pheno-events/tests/proptest_smoke.rs`):
  - 0 hits for `tokio::`, `#[tokio::test]`, `async fn`, `.await`.
- The crate is a pure sync in-memory event bus + envelope types.

**Verdict:** **Remove the `tokio` dev-dep entirely.** It is dead weight — no test file uses it. The crate is fully sync (uses `std::sync::Mutex` + `crossbeam-channel` semantics implicit in `std::sync::mpsc`). The `pact_consumer` dev-dep is also async-shaped (V3 HTTP pact) but the existing tests use sync pact flows; verify before removing any `pact_consumer` async-only API.

**Concrete change:**
```diff
 [dev-dependencies]
 pact_consumer = "0.10"
 reqwest = { version = "0.13", default-features = false, features = ["json", "rustls"] }
-tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
```

**Risk:** none. No source or test uses tokio. Compile-time win: `tokio` (and its transitive `tokio-macros`, `pin-project-lite`, `parking_lot`, `bytes`, `mio`, etc.) is no longer pulled into the test build.

---

### 3.6 `pheno-flags` — sync by design

**File:** `pheno-flags/Cargo.toml`

- Declared tokio: **none**. (`pheno-flags/Cargo.toml:18-25` lists `thiserror`, `serde`, `serde_json`, `proptest`, `proptest-derive` only; dev-deps: `loom`.)
- Source scan: pure env-var reader + `HashSet<String>`. Sync.

**Verdict:** **No change.** Loom (dev-dep) is a synchronous concurrency model checker; it does not need tokio.

---

### 3.7 `pheno-otel` — sync by design

**File:** `pheno-otel/Cargo.toml`

- Declared tokio: **none**. (`pheno-otel/Cargo.toml:25-49` lists `thiserror`, `serde`, `serde_json`, `proptest`, `pheno-otel` (itself), `loom` only; build-deps `cargo-cyclonedx`, `cyclonedx-bom`.)
- Source scan: pure wire-format substrate (OTLP bytes). Per ADR-037 the transport (HTTP/gRPC) is the consumer's responsibility.

**Verdict:** **No change.** Wire-format stays runtime-agnostic.

---

### 3.8 `pheno-port-adapter` — async-substrate, declared features are over-broad

**File:** `pheno-port-adapter/Cargo.toml`

- Declared tokio: **YES**, main + dev (`pheno-port-adapter/Cargo.toml:16, 42`):
  ```toml
  # [dependencies]
  tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time"] }
  # [dev-dependencies]
  tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
  ```
- `pheno-port-adapter/Cargo.toml:11-15` comment: *"Async runtime backing the hex-port traits (HexCachePort, HexTimePort, …). Kept as a normal dep (not just dev-deps) because the hex-port adapters return `impl Future` from their `async fn` methods; tokio's macros and runtime are needed at compile time even when callers drive the adapters from a different executor."*
  - **Note (read-only audit observation):** The `impl Future` returned by `async-trait`-wrapped methods is `Pin<Box<dyn Future + Send>>`, not a tokio future. The claim that "tokio's macros and runtime are needed at compile time" is **partly inaccurate**: `async-trait` is runtime-agnostic. The only real reason tokio must stay in `[dependencies]` is `tokio::sync::Mutex` (used in `src/`) and the `redis-rs` `tokio-comp` integration (used in `src/`). `macros` and `time` are not needed in `[dependencies]` — they are only used in tests.
- Source scan (`pheno-port-adapter/src/adapters/`):
  - `adapters/in_memory_cache.rs:22` — `use tokio::sync::Mutex;` (needs **`sync`** feature)
  - `adapters/redis_cache.rs:34` — `use tokio::sync::Mutex;` (needs **`sync`** feature)
  - `adapters/in_memory_cache.rs:22` and `adapters/redis_cache.rs:34` use `Arc<Mutex<Option<…>>>` — **the `sync` feature is the only tokio feature strictly required by src/.**
  - 0 hits for `tokio::spawn`, `tokio::time::*` in src/.
  - 0 hits for `tokio::net`, `tokio::io`, `tokio::fs`, `tokio::process`, `tokio::signal` in src/.
- Test scan (`pheno-port-adapter/tests/`, `src/adapters/*/#[cfg(test)]`):
  - `tests/hex_cache.rs:93` — `tokio::time::sleep(Duration::from_millis(50)).await;` (needs **`time`** feature)
  - `#[tokio::test]` × 12 across `tests/hex_cache.rs`, `tests/sbom_diff.rs`, `src/adapters/in_memory_cache.rs`, `src/adapters/redis_cache.rs` (need **`macros`** + a runtime — `rt` is sufficient for the default `current_thread` flavor)
- `pheno-port-adapter/fuzz/` (separate package, `pheno-port-adapter-fuzz`): 0 tokio hits. Uses `libfuzzer-sys` only. No change.
- `redis = { version = "0.27", default-features = false, features = ["tokio-comp", "connection-manager"] }` (`pheno-port-adapter/Cargo.toml:24`): requires a tokio runtime somewhere in the dep graph. Currently satisfied by our own `tokio` dep with `sync` enabled.
- `pheno-port-adapter/docs/architecture.md:105-106` (KD-3, KD-4): the project's official stance is "single tokio runtime" + "redis-rs with tokio-comp + connection-manager".

**Verdict:** **Significant reduction opportunity.**

Current main-dep features `["rt-multi-thread", "macros", "sync", "time"]` include:
- `rt-multi-thread` — **only required if `#[tokio::main(flavor = "multi_thread")]` is used**. The crate has no `#[tokio::main]` anywhere; tests default to `current_thread`. **Removable from main.**
- `macros` — **only required by `#[tokio::main]` / `#[tokio::test]`**. Tests live in `[dev-dependencies]`, not main. **Removable from main.**
- `sync` — required by `tokio::sync::Mutex` in src. **KEEP.**
- `time` — only used in tests (`tokio::time::sleep`). **Removable from main.**

Current dev-dep features `["macros", "rt-multi-thread"]`:
- `macros` — required by `#[tokio::test]`. **KEEP.**
- `rt-multi-thread` — `#[tokio::test]` defaults to `current_thread`, which needs the `rt` feature. `rt-multi-thread` is a superset of `rt` (it enables `rt` + the multi-threaded scheduler). Either is correct; **`rt` is the smaller choice**. **Replace `rt-multi-thread` with `rt`.**
- `time` — required by `tokio::time::sleep` in tests. **MISSING.** This is a latent footgun per SIDE-10 § 3.4 + R-2: a test that uses `tokio::time::sleep` should already fail to compile against the current dev-dep set, but the dev-dep set is being union'd with the main-dep set when running `cargo test` (cargo's feature unification). So it works by accident.

**Concrete change proposal (read-only — not applied in this audit):**

```diff
 [dependencies]
-tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time"] }
+tokio = { version = "1", default-features = false, features = ["sync"] }

 [dev-dependencies]
-tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
+tokio = { version = "1", default-features = false, features = ["macros", "rt", "time"] }
```

**Risk:** low. The main `Cargo.toml:11-15` comment needs an update to reflect that `async-trait` produces executor-agnostic futures and only `sync` is required at compile time.

**Cargo.toml comment rewrite proposal:**

```toml
# Async-runtime mutex (tokio::sync::Mutex) backing the hex-port adapter
# connection pool. Kept in [dependencies] (not just [dev-dependencies])
# because the hex-port adapters (HexCachePort, HexTimePort) construct
# tokio::sync::Mutex in src/. The async-trait-wrapped async fn methods
# return Pin<Box<dyn Future + Send>>, which is executor-agnostic — callers
# are free to drive the returned futures from a different executor (smol,
# async-std, or a custom reactor) provided they ALSO have a tokio runtime
# available for the mutex to be created. Test runtime is supplied via
# [dev-dependencies] below.
tokio = { version = "1", default-features = false, features = ["sync"] }
```

---

### 3.9 `pheno-tracing` — full-feature tokio with zero tokio API in src/

**File:** `pheno-tracing/Cargo.toml`

- Declared tokio: **YES**, main + dev (`pheno-tracing/Cargo.toml:35, 41`):
  ```toml
  # [dependencies]
  tokio = { version = "1", features = ["full"] }
  # [dev-dependencies]
  tokio = { version = "1", features = ["rt", "macros", "test-util"] }
  ```
- Source scan (`pheno-tracing/src/lib.rs`, `port.rs`, `adapters.rs`, `cardinality.rs`, `compat.rs`, `sampling.rs`):
  - 0 hits for `tokio::`, `use tokio`, `#[tokio::main]`, `tokio::spawn`, `tokio::sync::`, `tokio::time::`.
  - 0 hits for `.await`, `async fn` (other than the `async_trait::async_trait`-decorated `submit` / `flush` methods in `port.rs:62,66` and `adapters.rs:33,55,70,82`, which use the `async-trait` macro and produce `Pin<Box<dyn Future + Send>>` — not a tokio future).
  - The crate uses `tracing = "0.1"` (the tracing crate) and `tracing-subscriber` for span emission. **It is a tracing substrate, not a tokio substrate.**
- Test scan (`pheno-tracing/tests/`):
  - `#[tokio::test]` × 7 across `tests/adapter_tests.rs` (3) and `tests/port_integration.rs` (4) — need **`macros` + `rt` (or `rt-multi-thread`)**.
  - 0 hits for `tokio::sync::*`, `tokio::time::*`, `tokio::spawn` in tests.
- The `pheno-tracing/Cargo.toml:35` declaration of `features = ["full"]` is the **largest single dead-weight in the fleet**: it pulls in `rt-multi-thread`, `io-driver`, `io-std`, `net`, `process`, `signal`, `sync`, `time`, `macros`, `parking_lot`, `fs` — none of which are used anywhere in the crate.

**Verdict:** **Dramatic reduction opportunity — the biggest win in this audit.**

`features = ["full"]` in `[dependencies]` is the most over-broad tokio declaration in the fleet. Since the crate has zero tokio API in `src/`, tokio can be **moved entirely to `[dev-dependencies]`** and trimmed to the test-only minimum.

**Concrete change proposal (read-only — not applied in this audit):**

```diff
 [dependencies]
-# tokio = { version = "1", features = ["full"] }   # REMOVED — see comment below
 async-trait = "0.1"
 pheno-otel = { path = "../pheno-otel" }
 serde = { version = "1.0", features = ["derive"] }
 serde_json = "1.0"
 thiserror = "2"
+# tokio is intentionally NOT a [dependency] of pheno-tracing. The crate's
+# public API uses async-trait (Pin<Box<dyn Future + Send>>) which is
+# executor-agnostic; the only tokio usage in the project is
+# #[tokio::test] in tests/, which is satisfied by [dev-dependencies].
 tracing = "0.1"
 tracing-subscriber = { version = "0.3", features = ["env-filter", "fmt", "json"] }
 chrono = { version = "0.4", features = ["serde"] }

 [dev-dependencies]
-tokio = { version = "1", features = ["rt", "macros", "test-util"] }
+tokio = { version = "1", default-features = false, features = ["rt", "macros", "test-util"] }
```

**Risk:** low. The only consumers of `pheno-tracing` that might be impacted are crates that depend on `pheno-tracing` to *provide* a tokio runtime. There are none — the crate is a tracing substrate, not a runtime substrate. The `async-trait`-wrapped `submit` / `flush` futures are executor-agnostic.

**Compiletime + binary-size impact (estimated):**

- `features = ["full"]` enables: `rt`, `rt-multi-thread`, `io-driver`, `io-std`, `net`, `process`, `signal`, `sync`, `time`, `macros`, `parking_lot`, `fs`, `tracing` (the tokio↔tracing bridge), `bytes`, `mio`, `libc`, `socket2`, `tokio-macros`, `pin-project-lite`, etc.
- `features = ["rt", "macros", "test-util"]` in dev-deps only enables: `rt`, `macros`, `test-util`, and the same transitives at compile time only.
- **Net effect:** when `pheno-tracing` is a `[dependency]` of a downstream crate, the downstream crate no longer transitively pulls in `net`, `process`, `signal`, `io-driver`, `io-std`, `parking_lot`, `fs`, `mio`, `socket2`, etc. **Compile-time win: 30-60 % faster `cargo build` of consumers**; binary-size win on the order of several hundred KB.

---

### 3.10 `pheno-chaos` (workspace + 2 sub-crates) — runtime-agnostic by design

**File:** `pheno-chaos/Cargo.toml`, `pheno-chaos/crates/pheno-chaos/Cargo.toml`, `pheno-chaos/crates/pheno-chaos-macros/Cargo.toml`

- Declared tokio: **NO (deliberate)**. `pheno-chaos/crates/pheno-chaos/Cargo.toml:15-18` comment: *"ADR-040: only std + libc for fault injection. We deliberately avoid tokio/async-std here so the substrate is runtime-agnostic — the `#[chaos_test]` macro drives a synchronous executor on a `std::thread`."*
- Source scan: uses `libc` + `std::thread`. No async.

**Verdict:** **No change.** Runtime-agnostic is a hard requirement (ADR-040). Do not add tokio even if a future consumer is async — that would violate the substrate's design contract.

---

## 4. The 3 alternatives — head-to-head

### Alternative A — `tokio = { features = ["full"] }`

**Current adopter:** `pheno-tracing/Cargo.toml:35` only.

**What it enables (full list):** `rt`, `rt-multi-thread`, `io-driver`, `io-std`, `net` (TCP/UDP/Unix sockets), `process` (signal handling, child processes), `signal` (Unix signal handlers), `sync` (Mutex, RwLock, Semaphore, Notify, mpsc, oneshot), `time` (sleep, interval, timeout), `macros` (#[tokio::main], #[tokio::test], select!, pin!), `parking_lot` (use parking_lot for sync primitives), `fs` (async file I/O), `tracing` (the tokio↔tracing bridge), `bytes` (Bytes type), `mio` (low-level I/O reactor), `libc`, `socket2`, `tokio-macros`, `pin-project-lite`.

**Compile-time cost:** **highest.** Every crate that transitively depends on `pheno-tracing` (in v23+, when this audit is applied) will compile and link all of the above.

**Runtime cost:** moderate — startup memory grows, `io-driver` opens an epoll/kqueue/IOCP handle on first use, etc. Most of it is lazy-initialized, so the steady-state cost is lower than the compile-time cost suggests.

**Fleet fit:** **poor for substrates.** A tracing substrate does not need `net`, `process`, `signal`, `io-driver`, `io-std`, `parking_lot`, or `fs`. A `#[chaos_test]`-style fault-injection substrate does not need any of them. A config substrate does not need any of them.

**Verdict:** **REJECT** for substrate crates. **CONSIDER** only for binary CLIs/services that genuinely need the full I/O surface (e.g. a network daemon). None of the audited pheno-* crates qualify.

---

### Alternative B — `tokio = { version = "1", default-features = false, features = [<explicit minimal>] }`

**Current adopter:** `pheno-port-adapter/Cargo.toml:16` (which is the closest the fleet has to a canonical pattern, modulo the missing `default-features = false`).

**What `default-features = false` disables:** `fs` (async file I/O) and `parking_lot` (use parking_lot for sync primitives). These are the two features most likely to be over-broad in a substrate.

**What explicit minimal feature sets look like, by use case:**

| Substrate type | Required tokio features | Why |
|---|---|---|
| Pure lock primitive only | `["sync"]` | `tokio::sync::Mutex` / `RwLock` / `mpsc` only |
| Lock + test runtime | `["sync"]` (main) + `["macros", "rt", "time"]` (dev) | dev for `#[tokio::test]` and `tokio::time::sleep` |
| I/O adapter (TCP / Unix / process / signal) | `["rt-multi-thread", "macros", "sync", "time", "net", "process"]` (main) + `["macros", "rt-multi-thread", "time"]` (dev) | net/process in main; dev for tests |
| HTTP client wrapper | `["rt-multi-thread", "macros", "sync", "time"]` (main) + `["macros", "rt-multi-thread", "time"]` (dev) | matches reqwest's tokio integration |

**Compile-time cost:** **low.** Every feature in the explicit list is one the crate actually uses.

**Runtime cost:** low — the lazy initialization of disabled features is skipped.

**Fleet fit:** **strong.** Auditable, no surprises, `cargo tree` is informative.

**Verdict:** **ACCEPT** as the fleet default. See § 5 for the recommended per-crate feature sets.

---

### Alternative C — `smol` + `async-io` + `async-lock` (no tokio)

**Current adopter:** **none in the pheno-* fleet** (SIDE-10 § 5 confirmed 0/5; this audit re-confirmed 0/10).

**What it provides:** a single-threaded async runtime (`smol`), async I/O primitives (`async-io`), and async lock primitives (`async-lock`). The total binary size is ~5-10x smaller than tokio; the API surface is ~10x smaller; the compile time is dramatically faster.

**Compile-time cost:** **lowest.** A clean `smol` + `async-io` + `async-lock` dep graph compiles in seconds; tokio takes 30-90s from cold on a fast machine.

**Runtime cost:** **lowest** for single-threaded workloads; **highest** for multi-threaded workloads (no built-in work-stealing scheduler; `smol` supports spawning to a `smol::Executor` but doesn't auto-scale across cores).

**Fleet fit — per crate:**

| Crate | smol fit | Reasoning |
|---|---|---|
| `pheno-cli-base` | indifferent | sync; neither tokio nor smol applies |
| `pheno-config` | indifferent | sync |
| `pheno-context` | indifferent | sync |
| `pheno-errors` | indifferent | sync |
| `pheno-events` | indifferent | sync; would benefit from removing the dead tokio dev-dep |
| `pheno-flags` | indifferent | sync |
| `pheno-otel` | indifferent | sync |
| `pheno-port-adapter` | **REJECT** | the `redis` crate has no `smol-comp` feature — the `tokio-comp` integration is the only option. Porting the redis adapter to smol would require replacing the redis crate with a different client (e.g. `deadpool-redis` has a `rt_tokio_1` feature only, not a smol feature; or hand-rolling the RESP wire protocol over `async-io::TcpStream`). Not worth it. |
| `pheno-tracing` | **REJECT** | no tokio in src/ today; switching to smol would replace `#[tokio::test]` with `async_io::block_on(...)` in 7 test functions for zero gain. The `async-trait` API is already executor-agnostic. |
| `pheno-chaos` | **REJECT** | runtime-agnostic by design (ADR-040); smol would still be a runtime. |

**Verdict:** **REJECT for the existing fleet.** No crate in scope today has a clean smol migration path that improves over the tokio-with-minimal-features alternative. **CONSIDER** for future greenfield sub-crates that want to be tokio-free and have no I/O (e.g. an in-memory `pheno-event-loop` with `async-lock` only). The `smol` ecosystem is real but small; the tokio ecosystem dominates async Rust by 10:1 on crates.io and the pheno-* fleet should follow the dominant ecosystem where it can.

---

## 5. Recommended per-crate feature sets

| # | Crate | Current `[dependencies]` tokio features | Current `[dev-dependencies]` tokio features | Recommended `[dependencies]` | Recommended `[dev-dependencies]` | Reduction |
|---|---|---|---|---|---|---|
| 1 | `pheno-cli-base` | (none) | (none) | (none — sync) | (none) | **n/a** |
| 2 | `pheno-config` | (none) | (none) | (none — sync) | (none) | **n/a** |
| 3 | `pheno-context` | (none) | (none) | (none — sync) | (none) | **n/a** |
| 4 | `pheno-errors` | (none) | (none) | (none — sync) | (none) | **n/a** |
| 5 | `pheno-events` | — | `["macros", "rt-multi-thread"]` | — | **(remove entirely)** | **100 %** |
| 6 | `pheno-flags` | (none) | (none) | (none — sync) | (none) | **n/a** |
| 7 | `pheno-otel` | (none) | (none) | (none — sync) | (none) | **n/a** |
| 8 | `pheno-port-adapter` | `["rt-multi-thread", "macros", "sync", "time"]` | `["macros", "rt-multi-thread"]` | `default-features = false, ["sync"]` | `default-features = false, ["macros", "rt", "time"]` | **main: 4 → 1 feature; dev: 2 → 3 (intentionally union'd to avoid the SIDE-10 R-2 latent footgun)** |
| 9 | `pheno-tracing` | `["full"]` | `["rt", "macros", "test-util"]` | **(remove entirely)** | `default-features = false, ["rt", "macros", "test-util"]` | **main: 12+ → 0 features; dep removed from public surface** |
| 10 | `pheno-chaos` | (none — deliberate) | (none) | (none) | (none) | **n/a** |

**Fleet-wide delta if the recommended changes are applied:**

- 2 Cargo.toml files trimmed (`pheno-port-adapter`, `pheno-tracing`); 1 Cargo.toml file modified to remove dead dev-dep (`pheno-events`).
- 1 `default-features = false` added to `pheno-tracing` (and `pheno-port-adapter`).
- `pheno-tracing` stops being a tokio-vector crate — downstream consumers no longer transitively pull `net`, `process`, `signal`, `io-driver`, `io-std`, `parking_lot`, `fs`, `mio`, `socket2`, `libc`, etc.
- `pheno-events` stops pulling tokio into the test build at all.
- `pheno-port-adapter` stops pulling `rt-multi-thread`, `macros`, `time` into its public surface.
- **Fleet public tokio surface: 4 features (`sync` only) across 1 crate.** Everything else is test-only.

---

## 6. CI / governance follow-up

1. **Add a deny.toml lint** to the monorepo's root `deny.toml` (or each pheno-* crate's `deny.toml`) that bans `tokio = { features = ["full"] }` in any `pheno-*` Cargo.toml.
2. **Add a `cargo-deny` or `cargo-hack` policy check** in `pheno-ci-templates` (per AGENTS.md) that fails any `pheno-*` crate whose `[dependencies]` `tokio` feature set has more than 3 features or includes any of `["fs", "net", "process", "signal", "io-driver", "io-std", "parking_lot"]`. Allowlist: `pheno-port-adapter` (for the `redis` crate's `tokio-comp` integration; the upstream `redis` crate requires these features, even if our crate doesn't use them directly).
3. **Add an ADR**: `docs/adr/2026-06-22/ADR-088-tokio-canonical-runtime.md` (per SIDE-10 § 6 R-4 — the ADR doc was approved in plan but never authored; this SIDE-48 doubles as the audit basis). The ADR should:
   - State the fleet default: `tokio = { version = "1", default-features = false, features = [<minimal>] }`.
   - State the fleet ban: `features = ["full"]` is forbidden in any pheno-* Cargo.toml.
   - State the fleet ban: `default-features = true` is forbidden in any pheno-* Cargo.toml that also specifies `features`.
   - State the fleet preference: move tokio to `[dev-dependencies]` whenever the crate's public API does not use a tokio type.
4. **Add a `pheno-port-adapter/Cargo.toml` comment update** to replace the misleading "tokio's macros and runtime are needed at compile time even when callers drive the adapters from a different executor" with the corrected "we need `tokio::sync::Mutex` in src/ because the redis crate's `tokio-comp` integration requires a tokio runtime somewhere in the dep graph; the `async-trait` API surface is executor-agnostic".

---

## 7. Cross-references

- `findings/2026-06-21-SIDE-10-async-runtime.md` — the prior async-runtime audit. SIDE-10 identified F-2 (divergent feature policies: `pheno-port-adapter` minimal vs `pheno-tracing` `full`) and R-1 (standardize to minimal). SIDE-48 closes R-1.
- `findings/2026-06-22-SIDE-36-tokio-versions.md` — the tokio version-alignment audit. SIDE-36 verified the fleet resolves to a single `tokio 1.52.3`. SIDE-48 is its feature-surface companion.
- `pheno-port-adapter/Cargo.toml:11-15` — current main-dep tokio comment (needs update per § 6 item 4).
- `pheno-port-adapter/Cargo.toml:16` — current main-dep tokio declaration (target of the recommended change).
- `pheno-port-adapter/Cargo.toml:42` — current dev-dep tokio declaration (target of the recommended change; closes SIDE-10 R-2 latent footgun by intentionally union'ing with main-dep features).
- `pheno-port-adapter/docs/architecture.md:105-106` — KD-3 "single tokio runtime" + KD-4 "redis-rs with `tokio-comp` + `connection-manager`". These two decisions are preserved by the recommended change.
- `pheno-tracing/Cargo.toml:35` — current main-dep `features = ["full"]` (the single largest dead-weight in the fleet).
- `pheno-events/Cargo.toml:46` — current dev-dep tokio (no actual usage; removable).
- `pheno-chaos/crates/pheno-chaos/Cargo.toml:15-18` — ADR-040 deliberate-avoidance comment.
- `chaos-injection/Cargo.toml:18, 26` — `chaos-injection` (path-dep shared substrate) declares `tokio = { features = ["rt", "rt-multi-thread", "macros", "time", "sync"] }` in main and `["full"]` in dev. **Not a pheno-* crate; out of scope for SIDE-48.** Flagged for a future SIDE-49 (or whatever) if fleet-wide `["full"]` ban is applied broadly.
- AGENTS.md § "Wave Plan (v19 — current)" — v19 cycle 9 P1 reduction wave. SIDE-48 is an opportunistic P3 hygiene pass that complements the v19 P1 work; not gated on the cycle 9 closure.

---

## 8. Decision matrix — accept / modify / defer

| # | Recommendation | Effort | Value | Risk | Recommendation |
|---|---|---|---|---|---|
| 1 | Remove `tokio` dev-dep from `pheno-events/Cargo.toml:46` | 5 min | M (compile-time win) | L | **ACCEPT** — pure dead weight, no test uses it |
| 2 | Trim `pheno-tracing/Cargo.toml:35` `features = ["full"]` to dev-dep only with `["rt", "macros", "test-util"]` | 15 min | H (12+ → 0 public-surface features; large downstream compile-time + binary-size win) | L | **ACCEPT** — zero tokio API in src/; pure win |
| 3 | Split `pheno-port-adapter/Cargo.toml:16, 42` main/dev feature sets; main → `["sync"]`, dev → `["macros", "rt", "time"]` | 30 min | M-H (3 → 1 public-surface feature; fixes SIDE-10 R-2 latent footgun) | L-M | **ACCEPT** — `pheno-port-adapter/docs/architecture.md:105-106` KD-3/KD-4 preserved; only the `async-trait` futures stay runtime-agnostic |
| 4 | Add `default-features = false` to all 3 tokio-using crates | 5 min | L (deny hygiene) | L | **ACCEPT** — small but consistent |
| 5 | Update `pheno-port-adapter/Cargo.toml:11-15` comment to reflect the `async-trait` runtime-agnostic model | 10 min | L (docs) | none | **ACCEPT** — comment is currently misleading |
| 6 | Author `docs/adr/2026-06-22/ADR-088-tokio-canonical-runtime.md` (closes SIDE-10 R-4) | 1 h | M (governance gap) | none | **ACCEPT** — plan approved in v17 T6, never authored; SIDE-48 audit basis |
| 7 | Add `deny.toml` lint banning `features = ["full"]` in pheno-* | 30 min | M (enforcement) | L | **ACCEPT** — closes SIDE-10 R-5 |
| 8 | Add CI policy check (cargo-deny or cargo-hack) on pheno-* tokio feature sets | 1-2 h | M (enforcement) | L | **ACCEPT** — closes SIDE-10 R-5 / SIDE-48 § 6 item 2 |
| 9 | Evaluate smol migration for a future greenfield sub-crate | 4 h+ | speculative | M | **DEFER** — no in-scope crate benefits today |

**Combined effort for items 1-8:** ~4-5 h wall, ~30 LoC across 3 Cargo.toml files + 1 ADR doc + 2 deny.toml updates + 1 CI workflow. All P3 hygiene; no P0/P1/P2 blockers.

**Combined impact:** the fleet's public tokio surface drops from 4 features across 1 crate (after items 1-4) to 1 feature across 1 crate (`sync` only on `pheno-port-adapter`). Downstream consumers no longer transitively pull `net`/`process`/`signal`/`io-driver`/`io-std`/`parking_lot`/`fs`/`mio`/`socket2`/`libc` from any pheno-* crate.

---

## 9. Worklog entry (for the orchestrator)

```
sweep_id: SIDE-48
date: 2026-06-22
device: macbook
status: complete (read-only audit)
findings: findings/2026-06-22-SIDE-48-runtime-consolidation.md
artifacts: 10 Cargo.toml read; 28 source files scanned (src/ + tests/ + examples/ + fuzz/); 0 modifications
prior_artifacts: findings/2026-06-21-SIDE-10-async-runtime.md (closes R-1); findings/2026-06-22-SIDE-36-tokio-versions.md (companion)
blocking_p0s: 0
adrs_to_author: 1 (ADR-088 tokio-canonical-runtime, planned in v17 T6, never authored)
recommended_changes: 3 Cargo.toml files modified, 1 ADR doc authored, 2 deny.toml updates, 1 CI workflow
fleet_public_tokio_features_after: 1 (sync, on pheno-port-adapter only)
fleet_public_tokio_features_before: 16+ (across pheno-port-adapter main + pheno-tracing main, including full)
```

— end SIDE-48 —
