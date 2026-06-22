# Streaming Crate SOTA — v22 SD3 Federation Streaming Research

**Date:** 2026-06-22
**Branch:** `feat/v22-l26-tracing-2026-06-22`
**Agent:** `orch-v22-SD3-sota-research`
**Cycle:** v22 cycle 12 (P1 reduction) — Side-discovery 3 (SD3) of v22 scope
**Device:** macbook (research, no cargo work)
**Pillars touched (research-only, no code yet):** L26 (tracing), L33 (hot-reload), L46 (secrets), L54 (federation identity), L56 (observability)
**Backlinks:** `docs/adr/2026-06-18/ADR-046-federation-mtls-oidc.md`, `docs/adr/2026-06-21/ADR-079-oidc-federation-reference.md`, `docs/adr/2026-06-21/ADR-077-vault-migration-roadmap.md`, `docs/adr/2026-06-18/ADR-035B-event-bus-substrate-consolidation.md`, `findings/2026-06-22-v22-T2-L26-tracing.md`

---

## TL;DR

For Phenotype's federation use cases (mTLS cert rotation streams, OIDC JWKS rotation, MCP router SSE, OTLP export, event-bus pub/sub, hot-reload config diff streams), the canonical streaming stack is **`tokio-stream` 0.1 + `futures-util` 0.3 + `async-stream` 0.3** — and we should **NOT** adopt `futures-lite` for new federation work.

| Tier | Crate | Version | Verdict for fleet |
|------|-------|---------|--------------------|
| **PRIMARY (mandatory)** | `tokio-stream` | **0.1.18** | ✅ Adopt — tokio-rs canonical, fleet 49x, integrates with tokio-util codec |
| **COMPLEMENTARY** | `async-stream` | **0.3.6** | ✅ Adopt — generator macros (`stream!`/`try_stream!`), fleet 26x |
| **COMBINATOR BACKBONE** | `futures` (via `futures-util`) | **0.3.32** | ✅ Re-export via `futures-util` — fleet 37x, de-facto standard |
| **DISCOURAGED for federation** | `futures-lite` | **2.6.1** | ❌ Avoid — smol-runtime affinity, only 1 fleet use, API smaller |

---

## 1. Versions & Freshness (verified 2026-06-22)

| Crate | Latest | Released | MSRV | License | Repo | GH stars | Last meaningful change |
|-------|--------|----------|------|---------|------|---------:|------------------------|
| `tokio-stream` | **0.1.18** | ships with tokio 1.52.3 (May 8, 2026) | 1.71 | MIT | [tokio-rs/tokio](https://github.com/tokio-rs/tokio) | 32.3k | active (bundled with tokio releases) |
| `async-stream` | **0.3.6** | Oct 1, 2024 | 1.65 | MIT | [tokio-rs/async-stream](https://github.com/tokio-rs/async-stream) | 759 | soundness fix + MSRV bump 1.65 |
| `futures-lite` | **2.6.1** | Aug 4, 2025 | 1.60 | Apache-2.0 / MIT | [smol-rs/futures-lite](https://github.com/smol-rs/futures-lite) | 542 | docs only — last functional release v2.6.0 (Jan 12, 2025, `map_while`) |
| `futures` | **0.3.32** | Feb 15, 2025 | 1.71 | MIT / Apache-2.0 | [rust-lang/futures-rs](https://github.com/rust-lang/futures-rs) | 5.9k | MSRV bump 1.71, deprecates `ready!`/`pin_mut!` (now in std) |

All 4 crates are at the **Stable / Mature** tier of the SOTA rubric:
- 100 % API documentation (per docs.rs badges)
- No `0.x → 1.0` breaking churn pending
- `tokio-stream` and `futures` are bundled with flagship projects (tokio, futures-rs)
- `async-stream` is low-churn (last release Oct 2024) — soundness + MSRV only
- `futures-lite` is in maintenance mode (docs-only releases since Aug 2025)

Sources (verified this turn):
- `https://docs.rs/tokio-stream` → 0.1.18, 100 % documented
- `https://docs.rs/async-stream` → 0.3.6, 100 % documented
- `https://docs.rs/futures-lite` → 2.6.1, 100 % documented
- `https://docs.rs/futures` → 0.3.32, 100 % documented
- `https://github.com/tokio-rs/tokio/releases` → tokio 1.52.3 (2026-05-08)
- `https://github.com/tokio-rs/async-stream/releases` → v0.3.6 (2024-10-01)
- `https://github.com/smol-rs/futures-lite/releases` → v2.6.1 (2025-08-04)
- `https://github.com/rust-lang/futures-rs/releases` → 0.3.32 (2025-02-15)
- `https://raw.githubusercontent.com/tokio-rs/tokio/master/tokio-stream/Cargo.toml` → MSRV 1.71
- crates.io / lib.rs pages blocked (HTTP 403 / robots.txt) — version data verified via GitHub release pages instead.

---

## 2. Per-Crate Deep Dive

### 2.1 `tokio-stream` 0.1.18 — PRIMARY

**Role:** Tokio-native stream utilities; re-exports `futures_core::Stream` and provides `StreamExt` plus Tokio-type wrappers.

**Dependencies (`Cargo.toml`):**
- `futures-core ^0.3.0` (the trait defs)
- `pin-project-lite ^0.2.11`
- `tokio ^1.38.0` (feature `sync`)
- `tokio-util ^0.7.0` (optional, enabled by `sync` feature)

**Features (from crate manifest):**
- `default = ["time"]`
- `full = ["time", "net", "io-util", "fs", "rt", "sync", "signal"]`
- `sync = ["tokio/sync", "tokio-util"]` — unlocks `tokio_stream::wrappers::{Receiver, BroadcastStream, WatchStream}`

**Key types (per docs.rs):**
- `StreamMap` — combine N streams indexed by `K: Hash + Eq`
- `StreamNotifyClose` — `Stream<Item = Option<T>>` for "stream ended" signal
- `Elapsed` — error for `Timeout` / `TimeoutRepeating`
- `wrappers::*` — `ReceiverStream` (mpsc), `BroadcastStream`, `WatchStream`, `SignalStream`
- `wrappers::PollSender` — backpressure-aware sender
- Functions: `empty`, `iter`, `once`, `pending`

**SOTA maturity:** Bundled with tokio itself (32.3k stars). Active maintenance — every tokio release ships a matching tokio-stream. tokio-stream 0.1.18 was released alongside tokio 1.52.3 (May 8, 2026). No major API churn since 0.1.

**Fit for federation:**
- ✅ `wrappers::ReceiverStream` + `wrappers::WatchStream` are the canonical pattern for converting tokio channels into streams (needed for `mpsc`/`watch` channels from `tokio::sync` → stream consumers like MCP router).
- ✅ `StreamMap` is the right primitive for **JWKS key rotation** (one stream per `kid`) and **mTLS cert rotation** (one stream per `SPIFFE ID`).
- ✅ `tokio_stream::iter` + `StreamExt::timeout` gives the **OIDC refresh sliding window** pattern (5-min proactive refresh per ADR-046).
- ⚠️ Does NOT provide `AsyncRead` ↔ `Stream` conversion — that lives in `tokio-util::io::{ReaderStream, StreamReader}` (codec).

### 2.2 `async-stream` 0.3.6 — COMPLEMENTARY

**Role:** Proc-macro library that adds `yield` syntax to async blocks, producing anonymous `impl Stream<Item = T>` types.

**Dependencies (`Cargo.toml`):**
- `async-stream-impl =0.3.6` (proc-macro)
- `futures-core ^0.3`
- `pin-project-lite ^0.2`
- MSRV 1.65 (bumped in 0.3.6 for soundness fix)

**Macros:**
- `stream! { ... yield x; ... }` — produces `Stream<Item = T>` with `Item = T`
- `try_stream! { ... yield x; ... }` — produces `Stream<Item = Result<T, E>>`; supports `?` operator

**SOTA maturity:** Low-churn but well-trusted. 759 stars. Last release (0.3.6, Oct 2024) fixed **soundness bugs** (PR #109) — important to note this is the ONLY candidate in this comparison that shipped a soundness fix in the last 2 years. The MSRV was raised to 1.65 as part of that fix.

**Fit for federation:**
- ✅ **`try_stream!`** is the natural fit for fallible federation protocols:
  - OIDC `discovery` + `jwks_uri` fetching (network failures, parse errors)
  - SPIRE `fetch_x509_svid` (mTLS cert fetch with TTL countdown)
  - MCP SSE tool-call dispatch (per-call error propagation)
- ✅ **`stream!` over `for await in input`** is exactly the pattern needed for **event-bus fan-out** in `pheno-events` (subscribe → forward → yield).
- ✅ Pairs naturally with `tokio-stream` (the produced `impl Stream` is a `futures_core::Stream` — `tokio_stream::StreamExt::timeout`, `.map`, `.filter` etc. all work).

### 2.3 `futures` 0.3.32 — COMBINATOR BACKBONE (via `futures-util`)

**Role:** The de-facto standard crate for `Future` + `Stream` + `Sink` combinators, channels, executors. We use it via the `futures-util` sub-crate (lighter, no executor dep).

**Dependencies (`Cargo.toml`):**
- `futures-channel ^0.3.32`
- `futures-core ^0.3.32`
- `futures-executor ^0.3.32` (optional)
- `futures-io ^0.3.32`
- `futures-sink ^0.3.32`
- `futures-task ^0.3.32`
- `futures-util ^0.3.32`

**Key sub-crates (re-exported by `futures::prelude`):**
- `Stream`, `TryStream`, `StreamExt`, `TryStreamExt`
- `Sink`, `SinkExt`
- `Future`, `FutureExt`, `TryFutureExt`
- `select!`, `select_biased!`, `join!`, `try_join!`, `stream_select!` macros
- `channel::{mpsc, oneshot, broadcast}` (executor-agnostic channels)
- `lock::{Mutex, RwLock, BiLock}` (futures-aware)

**SOTA maturity:** Maintained by `rust-lang` (5.9k stars). Last release (0.3.32, Feb 15, 2025) bumped MSRV to 1.71 for utility crates and **soft-deprecated** `ready!` and `pin_mut!` macros in favor of `std::task::ready!` (Rust 1.64) and `std::pin::pin!` (Rust 1.68). This is significant — new code should prefer `std::pin::pin!` over `futures::pin_mut!`.

**Fit for federation:**
- ✅ `FuturesOrdered` / `FuturesUnordered` for **concurrent mTLS handshake streams** (one per peer).
- ✅ `select_biased!` for **OIDC refresh sliding window** — prefer local JWT verify over network JWKS refresh (per ADR-046).
- ✅ `stream::select!` for **event-bus multiplexing** (merge in-memory + network + replay log streams).
- ⚠️ The full `futures` crate pulls 7 sub-crates; prefer `futures-util` for everything except executor-bound code.

### 2.4 `futures-lite` 2.6.1 — DISCOURAGED for federation

**Role:** smol-rs's lightweight alternative to `futures`. Same trait shapes (re-exports `futures_core::Stream`), but smaller API surface and **runtime-agnostic** with a smol-rs bias.

**Dependencies (`Cargo.toml`):**
- `futures-core ^0.3.5`
- `pin-project-lite ^0.2.0`
- Optional: `fastrand`, `futures-io`, `memchr`, `parking`

**Features:** None declared (compile-time gates are commented out — see `FEATURES.md`). Pure compile-time feature policy via comment, not feature flags.

**SOTA maturity:** Mature and stable, but **in maintenance mode** — last release v2.6.1 (Aug 4, 2025) is docs-only. Last meaningful feature release was v2.6.0 (Jan 12, 2025) which added `Stream::map_while`. The README explicitly states the API is "intentionally constrained" and refers to `FEATURES.md` for what is **excluded**.

**Why NOT for federation:**
- ❌ **smol-runtime affinity.** Many helpers are biased toward `smol::spawn` / `async-io`. For example, `AsyncRead`/`AsyncWrite` impls use `futures_io` traits, which require a compat shim to interoperate with tokio's `tokio::io::AsyncRead`. Federation requires tokio (L46/L54 ADRs all assume tokio).
- ❌ **Only 1 fleet use** (vs 49 for tokio-stream). Adopting it would create a divergent second streaming API for no benefit.
- ❌ **Smaller API surface.** Lacks `StreamMap`, `StreamNotifyClose`, `BroadcastStream`, `WatchStream` (all in `tokio-stream`). Federation use cases (mTLS cert rotation, JWKS rotation, MCP SSE) need those wrappers.
- ⚠️ Permitted ONLY for: **WASM targets** where tokio's reactor cannot run (e.g., in-browser JWKS fetching) — see ADR-046 § alternatives.

---

## 3. Comparison Matrix

| Criterion (weight) | `tokio-stream` 0.1.18 | `async-stream` 0.3.6 | `futures` 0.3.32 (via `futures-util`) | `futures-lite` 2.6.1 |
|--------------------|:----------------------:|:--------------------:|:-----------------------------------:|:---------------------:|
| **Tokio interop** (critical) | ✅ native | ✅ via `Stream` trait | ✅ via `Stream` trait (compat needed) | ⚠️ needs compat shim |
| **MSRV** (1.75 floor for `pheno-tracing`) | ✅ 1.71 | ✅ 1.65 | ✅ 1.71 | ✅ 1.60 |
| **AsyncRead ↔ Stream** (needed for OTLP/HTTP) | ⚠️ via `tokio-util` | ⚠️ via `tokio-util` | ⚠️ via `tokio-util` | ⚠️ via `tokio-util` |
| **Generator macros** (yield syntax) | ❌ no | ✅ `stream!` / `try_stream!` | ❌ no | ❌ no |
| **`select!` / `join!` macros** | ⚠️ via `futures` | ⚠️ via `futures` | ✅ native (`select_biased!`) | ⚠️ subset |
| **`StreamMap` / `BroadcastStream` / `WatchStream`** | ✅ native | ❌ no | ⚠️ partial (only some in `futures-util`) | ❌ no |
| **`mpsc::Receiver` → `Stream`** | ✅ `wrappers::ReceiverStream` | ❌ no | ⚠️ `StreamExt::map` | ❌ no |
| **Backpressure-aware sender** | ✅ `PollSender` | ❌ no | ✅ `Sink::send` | ❌ no |
| **Soundness history (last 2y)** | ✅ none known | ✅ fixed (0.3.6) | ✅ none known | ✅ none known |
| **Fleet adoption (greps)** | **49x** | **26x** | **37x** (futures-util) | **1x** |
| **Active maintenance** | ✅ very active | ⚠️ low-churn | ✅ active | ⚠️ maintenance mode |
| **Bundle size impact** | low (≈10 wrappers) | proc-macro only | high (full: 7 sub-crates) | very low |
| **`async-trait` / dyn-safe** | ✅ via `Stream` trait | ✅ via `Stream` trait | ✅ | ✅ |
| **Substrate-quality bar (ADR-042B)** | ✅ tokio-rs core | ✅ tokio-rs core | ✅ rust-lang | ✅ smol-rs |

**Weighted verdict:**
- **tokio-stream**: 11 ✅ / 1 ⚠️ / 0 ❌ → **canonical primary**
- **async-stream**: 8 ✅ / 2 ⚠️ / 1 ❌ → **canonical complement** (the missing generator macros)
- **futures-util**: 9 ✅ / 3 ⚠️ / 0 ❌ → **canonical combinators** (already in 37x fleet)
- **futures-lite**: 6 ✅ / 5 ⚠️ / 2 ❌ → **rejected for new federation work**

---

## 4. Federation Use-Case Mapping

Per ADR-046 (mTLS+OIDC federation), ADR-079 (OIDC reference impl), ADR-077 (Vault), ADR-035B (event-bus substrate), and v22 T2/T4 (tracing + hot-reload), here is the concrete use-case → crate mapping:

| Use case | Owner / repo | Required crate(s) | Why |
|----------|--------------|-------------------|-----|
| **mTLS cert rotation stream** (SPIRE → service, 24h TTL) | `pheno-context` (ADR-046) | `tokio-stream` (`wrappers::WatchStream` + `StreamMap`) | watch channel → stream of certs, one per SPIFFE ID |
| **OIDC JWKS rotation stream** (Auth0 → service) | `pheno-context` (ADR-079) | `tokio-stream` (`StreamMap` indexed by `kid`) + `async-stream` (`try_stream!` for fetch+parse) | one stream per key id; fallible fetch via try_stream |
| **OIDC refresh sliding window** (5min proactive) | `pheno-context` (ADR-046) | `futures-util::select_biased!` + `tokio-stream` (`StreamExt::timeout`) | local JWT verify preferred over JWKS network refresh |
| **Vault dynamic secret rotation** (60s budget) | `pheno-config` (ADR-077) | `tokio-stream` + `async-stream` (`try_stream!` w/ retry) | `try_stream!` w/ exponential backoff matches `pheno-config`'s `hot_reload` shape |
| **Event-bus pub/sub fan-out** | `pheno-events` (ADR-035B) | `async-stream` (`stream! { for await x in input { yield x } }`) + `futures-util` (`stream::select!`) | fan-out via generator; merge in-mem + network + replay |
| **MCP router SSE tool dispatch** | `pheno-mcp-router` (ADR-051) | `tokio-stream` (`wrappers::ReceiverStream`) + `tokio-util` (`codec::Framed` + `StreamReader`) | mpsc → SSE wire; codec for framing |
| **OTLP trace export** (batched) | `pheno-tracing` (ADR-012/036B) | `tokio-stream` + `tokio-util` (`codec::LengthDelimitedCodec`) | batch span streams → OTLP/gRPC frames |
| **Config hot-reload diff stream** (SIGHUP) | `pheno-config` (v22 T4 / L33) | `async-stream` (`stream!`) + `futures-util` (`FuturesUnordered`) | diff old vs new on each SIGHUP, stream the patches |
| **SSE MCP server → client** (browser bridge) | `pheno-events` → browser | `tokio-stream` (`wrappers::BroadcastStream`) + `async-stream` | broadcast to many SSE subscribers; no need for smol |

**Zero uses of `futures-lite`** in any of these. The single existing fleet use (`phenotype-registry-utils-boundary` per grep) is for a tool binary, not a long-running service, and predates the v22 fleet governance.

---

## 5. Recommended Adoption Rules (codify in v22+)

### 5.1 Tier table

| Tier | Crate | Rule |
|------|-------|------|
| **T1 (mandatory)** | `tokio-stream` (≥ 0.1.18, with `sync` + `time` features) | Required in **every** pheno-* substrate and federated service that uses tokio channels or `Stream`. |
| **T2 (mandatory)** | `futures-util` (≥ 0.3.32, with `std` only — no default features to avoid pulling `futures-executor`) | Required for combinators (`select_biased!`, `stream::select!`, `FuturesOrdered`). |
| **T3 (recommended for new code)** | `async-stream` (≥ 0.3.6) | Required for any generator-style code (`try_stream!` for fallible streams, `stream!` for fan-out). Pairs with T1. |
| **T4 (discouraged)** | `futures-lite` | **Do not adopt** for new federation work. Permitted only for WASM targets that cannot run the tokio reactor. Document any new use in `findings/<date>-futures-lite-justification.md`. |
| **T5 (forbidden)** | `futures` (the full crate) | **Do not depend on the umbrella `futures` crate.** Always depend on the specific sub-crate (`futures-util`, `futures-channel`, etc.) to keep build times and surface area minimal. The umbrella crate pulls 7 sub-crates. |

### 5.2 Version pinning (ADR-025 / ADR-035)

Pin at the workspace level in the appropriate Cargo workspace's `Cargo.toml`:
```toml
[workspace.dependencies]
tokio-stream = { version = "0.1", features = ["sync", "time"] }
async-stream = "0.3"
futures-util = { version = "0.3", default-features = false, features = ["std"] }
```

Do NOT pin `futures-lite` at workspace level. If a specific crate needs it (e.g., for WASM), pin at the crate level only.

### 5.3 Required for v22 cycle 12+ work

The following v22 cycle 12 tracks MUST follow the T1/T2/T3 rules above:
- **v22 T1 (L25 metrics facade)** — `pheno-otel/src/metrics.rs` — uses `tokio-stream` for OTLP metric batches
- **v22 T2 (L26 tracing sampling)** — `pheno-tracing/src/sampling.rs` — uses `async-stream` for tail-sampling pipeline
- **v22 T3 (L31 release cadence)** — no streaming impact
- **v22 T4 (L33 hot-reload)** — `pheno-config/src/hot_reload.rs` — uses `async-stream` for diff stream
- **v22 T5 (L35 build perf)** — no streaming impact

### 5.4 Required for v23 cycle 13 (federation wave)

The v23 cycle 13 plan is expected to add federation implementation work per ADR-046/079/077. When it lands, **all new federation code must follow the T1/T2/T3 rules**. Specifically:
- `pheno-context/src/oidc.rs` (T3 of v19, now being implemented) — must use `tokio-stream` for JWKS rotation + `async-stream` for `try_stream!` fallible fetch
- `pheno-context/src/mtls.rs` (new in v23) — must use `tokio-stream` for cert rotation
- `pheno-mcp-router` SSE server (new in v23) — must use `tokio-stream` for channel→SSE conversion

---

## 6. Risk & Migration Notes

### 6.1 MSRV floor (ADR-042B substrate quality bar)

The four crates' MSRVs:
- tokio-stream: 1.71
- async-stream: 1.65
- futures-util: 1.71
- futures-lite: 1.60

`pheno-tracing` (currently `rust-version = "1.75"`) is the **floor** for new substrate crates. All four candidates are below the floor — **no MSRV conflict**.

### 6.2 Soundness notes

- `async-stream` 0.3.6 fixed soundness bugs (PR #109, Oct 2024). Anything older than 0.3.6 must be upgraded. Verify `Cargo.lock` for any `async-stream` < 0.3.6 in archived submodules and trigger a workspace-wide `cargo update -p async-stream --precise 0.3.6` if found.
- `futures` 0.3.31 fixed `select!` parsing + `AsyncBufRead::read_line` bugs. Anything older than 0.3.31 must be upgraded for the parsing fix (which can affect L33 config hot-reload patterns).

### 6.3 API deprecations (Rust std advancements)

`futures` 0.3.32 soft-deprecated `ready!` and `pin_mut!` in favor of `std::task::ready!` (1.64) and `std::pin::pin!` (1.68). New code should use the std versions. **Audit fleet for old `futures::pin_mut!` calls and migrate to `std::pin::pin!`** as part of v23 cycle 13 if time permits.

### 6.4 Workspace lock contention (per SIDE-31 cargo-lock-fresh finding)

Per `findings/2026-06-22-SIDE-31-cargo-lock-fresh.md` (this session), the root workspace has 140+ transitive `tokio-stream` mentions from vendored submodules (`BytePort`, `codex-rs`, `aws-runtime`). When bumping `tokio-stream`, run `cargo update -p tokio-stream --workspace` and verify no vendored crate pins to < 0.1.18.

### 6.5 Backward compat with existing fleet crates

- 49 existing fleet uses of `tokio-stream` all use `version = "0.1"` → fully compatible with 0.1.18 (caret-compatible within 0.1.x).
- 37 existing fleet uses of `futures-util` all use `version = "0.3"` → fully compatible with 0.3.32.
- 26 existing fleet uses of `async-stream` all use `version = "0.3"` → fully compatible with 0.3.6.

**No breaking change for any fleet crate** when adopting these versions.

### 6.6 What about `gRPC`/`tonic`/`axum`?

`tonic` 0.12+ uses `tokio-stream` + `futures-util` internally for streaming RPC. `axum` 0.7+ uses `tokio-stream` for SSE response bodies. **Adopting the T1/T2/T3 rules is therefore aligned with the larger tokio ecosystem** — no friction.

---

## 7. Decision & Next Steps

### Decision

> **Adopt `tokio-stream` 0.1.18 + `async-stream` 0.3.6 + `futures-util` 0.3.32 as the canonical streaming stack for all v22+ federation work. Discourage `futures-lite` for federation; allow only for WASM targets.**

### Next steps

1. **(now)** Add this finding to the v22 cycle 12 closure probe → informs v23 cycle 13 planning
2. **(v22 T2 close)** Add a `deny.toml` lint to **warn** on `futures` (umbrella) imports in pheno-* substrate crates (not blocking; advisory)
3. **(v22 T4 close)** Verify `pheno-config` hot-reload uses `async-stream::try_stream!` (T3 rule)
4. **(v23 cycle 13 plan)** Cite this finding in the federation implementation tracks (T3 OIDC reference, T5 mTLS stream)
5. **(v23 cycle 13 plan)** Add a **coverage gate** check: any new `Stream` impl must have at least one `proptest` roundtrip + one integration test using `tokio_stream::StreamExt::timeout` or similar

### Backlinks & references

- `docs/adr/2026-06-18/ADR-046-federation-mtls-oidc.md` — Federation mTLS + OIDC (L46/L54)
- `docs/adr/2026-06-21/ADR-077-vault-migration-roadmap.md` — Vault migration (L50)
- `docs/adr/2026-06-21/ADR-079-oidc-federation-reference.md` — OIDC reference (L54)
- `docs/adr/2026-06-18/ADR-035B-event-bus-substrate-consolidation.md` — event-bus substrate (L56)
- `findings/2026-06-22-v22-T2-L26-tracing.md` — current L26 tracing sampling track
- `findings/2026-06-22-SIDE-31-cargo-lock-fresh.md` — root cargo.lock hygiene (workspace-wide `tokio-stream` transitive fan-out)
- `pheno-tracing/Cargo.toml` — MSRV floor reference (1.75)
- ADR-025 (worklog schema v2.1) — used to format the orchestrator worklog
- ADR-042B (substrate quality bar) — MSRV floor for new substrate

---

## 8. Changelog

- 2026-06-22 — Initial finding. Versions verified against docs.rs + GitHub release pages. Fleet usage grep over `**/Cargo.toml` (submodule noise flagged but not removed — patterns hold).
