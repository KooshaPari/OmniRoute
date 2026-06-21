# L7 — Concurrency safety & races

## Scope
Formal/model checking (Loom, Shuttle, TLA+, MIRI), runtime race detection (TSan, ASan), lock ordering & lock-free design, async cancellation safety, and Send/Sync invariants across the Phenotype bloc (AgilePlus, thegent, Tracely, Tracera).

## SOTA 2026
- **Tokio** — `loom` model checker is part of the Tokio CI (https://github.com/tokio-rs/tokio/tree/master/tests/loom). The Tokio team runs the entire executor through loom on every PR.
- **Shuttle** (Hawkins et al. 2023) — randomised concurrency testing; Causal & Storey use it for the Rust compiler.
- **MIRI** (`cargo +nightly miri test`) — detects data races, undefined behaviour in `unsafe` Rust; 2026 SOTA for low-level Rust crates.
- **ThreadSanitizer** (`-Z sanitizer=thread`) — used by Firefox, ripgrep, and `bat` for CI race detection.
- **TigerBeetle** — fully formalised with TLA+ specs; "tigerbeetle" codebase requires all concurrency invariants to have TLA+ proofs in the same PR.
- **Datadog `dd-trace-py`** — `CancellationToken` propagation pattern across async boundaries; considered SOTA for safe async cancellation.
- **AWS SDK for Rust** — `aws-smithy-async` uses `AbortHandle` + `tracing::Span` pairing for cancellation observability; the 2025+ reference for async safety.

## Phenotype state

### AgilePlus
- `crates/agileplus-triage/src/claim.rs` (594 LOC) — primary concurrency surface. `ClaimStore` with `Send`-but-not-`Sync` (line 1 comment) — **△** (hand-rolled concurrency primitive, no loom coverage)
- `crates/agileplus-triage/src/claim_store_sqlite.rs` — SQLite-backed cross-process `ClaimStoreTrait` — **✓** (process-safety via SQLite)
- `crates/agileplus-triage/src/claim_watcher.rs` — background TTL reaper — **△** (no formal verification of the reaper loop)
- `crates/agileplus-triage/src/claim.rs:143-145` — millisecond-precision TTL (`num_milliseconds() > ttl * 1000`) — **✓**
- `crates/agileplus-triage/src/claim.rs:359-396` — `claim_transfer` with `Draining` grace period — **△** (no formal model for the draining → active handoff)
- `crates/agileplus-sqlite/src/lib/adapter.rs` — `PRAGMA journal_mode=WAL` + `PRAGMA foreign_keys=ON`; comment "WAL mode is enabled to allow concurrent reads; all writes are serialized." — **✓** (concurrent-read design)
- `crates/agileplus-api/src/router.rs:100` — `tokio::sync::RwLock` for dashboard state — **△** (no documented lock ordering)
- `crates/agileplus-grpc/src/server/mod.rs:576` + `bootstrap.rs:72` — `tokio::select!` for graceful shutdown — **△** (no `CancellationToken` propagation)
- `crates/agileplus-integration-tests/tests/dashboard_sse.rs:98` — `tokio::select!` for SSE shutdown — **△**
- `crates/agileplus-nats/src/bus.rs` — "Spawn the reply asynchronously to avoid deadlock." — **△** (single comment, no formal pattern doc)
- `crates/agileplus-telemetry/src/metrics/mod.rs` — `AtomicU64` with explicit `Ordering` for hot metrics — **✓**
- Lock-free usage: 0 lock-free primitives (`arc-swap`, `crossbeam`, `radium`); 22 `tokio::sync::{Mutex,RwLock}` uses. — **△** (lock-heavy)
- `unsafe` blocks: present in `agileplus-subcmds/dashboard.rs` (env::set_var), `agileplus-plane/plane_sync.rs` (env), `agileplus-dashboard/routes.rs` (env), `agileplus-telemetry/lib.rs` (env), `agileplus-subcmds/dashboard.rs` (test). — **△** (all `unsafe` is `std::env::set_var` — Rust deprecates these but they are technically safe.)
- `Send`/`Sync` explicit impls: 1 (`agileplus-triage/src/claim.rs:1` comment "The SQLite implementation is `Send` but not `Sync`"). — **△** (no other explicit impls found; rely on auto-derives)
- **MIRI:** zero `miri test` invocations in CI. — **✗**
- **Loom / Shuttle:** zero crates with `loom` or `shuttle` in dev-deps. — **✗**
- **TSan / ASan:** zero `RUSTFLAGS="-Z sanitizer=..."` invocations in CI. — **✗**
- **TLA+ spec:** absent (see thegent for the only TLA+ spec in bloc). — **✗**
- **Async cancellation safety:** no `tokio_util::sync::CancellationToken` usage. `tokio::select!` is the only construct for cancellation. — **△**

### thegent
- `docs/spec/tla_multi_agent.tla:1-76` — **TLA+ specification of multi-agent orchestration.** Models `task_status`, `agent_locks`, `fork_depth`. Safety properties: `MutualExclusion` (no two agents hold the same task), `DepthLimit` (`fork_depth[t] <= MaxDepth`). Liveness: "All tasks must eventually reach a terminal state (Success/Failure)." — **✓** (TigerBeetle-style model)
- `crates/thegent-watcher/Cargo.toml:18` — `crossbeam-channel = "0.5.14"` — lock-free MPMC channel — **✓**
- `crates/thegent-cache/Cargo.toml:21` — `parking_lot::Mutex` (faster than `std`) — **✓**
- `crates/thegent-cache/src/lib.rs` — `use parking_lot::Mutex;` — explicit lock primitive choice — **✓**
- `crates/thegent-shm/Cargo.toml:21` — `parking_lot = "0.12.3"` — **✓**
- `crates/thegent-shims/src/cache.rs` — `use parking_lot::RwLock;` — **✓**
- `Cargo.lock` — pulls `arc-swap = "..."`, `crossbeam-channel`, `crossbeam-queue`, `crossbeam-utils`, `atomic-waker` — **✓** (lock-free primitives ecosystem)
- `crates/thegent-router/src/router.rs` — `use std::sync::atomic::{AtomicUsize, Ordering};` — atomic counters — **✓**
- `crates/harness-native/src/strategies/circuit_breaker.rs:1-30` — `AtomicU32/AtomicU64` with `Ordering::SeqCst` for failure-window counter — **✓** (lock-free hot path)
- `crates/thegent-zmx-interop/src/lib.rs` — `unsafe { ffi::zmx_list(buf.as_mut_ptr(), buf.len()) }` — **△** (ZMQ FFI; no MIRI coverage)
- `crates/thegent-shm/src/lib.rs` — "// Give each thread time to avoid race conditions" — **△** (comment only, no structured guard)
- `crates/thegent-router/Cargo.toml:33-38` — `overflow-checks = false` in release — **△** (faster, loses wraparound detection)
- `Cargo.toml` — `max-performance-safe` portable SIMD profile mentioned in comment — **△**
- `pyo3` boundary in `thegent-router/Cargo.toml:18` — `pyo3 = { version = "0.29", features = ["abi3-py312", "extension-module"] }` — GIL-aware boundary; no documented Send/Sync reasoning. — **△**
- **MIRI:** zero `miri test` invocations. — **✗**
- **Loom / Shuttle:** zero. — **✗**
- **TSan / ASan:** zero. — **✗**
- **Async cancellation safety:** `harness-native/src/dispatcher.rs` has multiple `Command::exec` paths with no `CancellationToken` propagation. — **△**
- **Lock ordering:** zero comments / docs on global lock acquisition order. — **✗**

### Tracely
- `CLAUDE.md` — notes "tokio (async), atomic operations" as key deps — **△** (no formal concurrency surface documented)
- `crates/tracely-sentinel/Cargo.toml` — no `parking_lot`, no `arc-swap`, no `crossbeam`, no `loom`/`shuttle`. — **✗**
- `unsafe` blocks: 0 found in `tracely-*/src/**/*.rs` — **✓** (no unsafe → MIRI less critical)
- Tokio + atomics: implicit. — **△**
- **MIRI / TSan / ASan:** zero. — **✗**
- **TLA+ spec:** absent. — **✗**
- **Async cancellation safety:** unknown (sentinel is hot path, no cancel handling docs). — **△**

### Tracera
- `pyproject.toml:30` — `pytest-benchmark>=5.2.3` (perf, not concurrency) — n/a
- Go core (`go.mod`) — uses Go's native race detector via `go test -race`. Per `thegent/grade.sh:111` Go stack runs `go test -race ./...` (2 pts) — **△** (in shared grade script; not in Tracera's own CI)
- `tests/performance/test_matrix_build_benchmark.py` — pure perf, no concurrency tests — **△**
- Rust crates: minimal. `unsafe` blocks: not applicable (no `crates/` core). — **△**
- **TLA+ spec:** absent. — **✗**
- **MIRI / TSan:** absent (Go has its own `go test -race`). — **△**
- **Async cancellation safety:** Tracera is mostly sync Python; no async surface. — **n/a**

## Gaps

1. **No TLA+ spec for `agileplus-triage` claim system** — the bloc's flagship concurrency primitive (claim, transfer, expire, reap) has zero formal model. **effort: M** — port the `tla_multi_agent.tla` style to cover `claim.rs:359-396` `claim_transfer` with `Draining` state.
2. **No `loom` or `shuttle` in any dev-deps** — every concurrency primitive (claim store, NATS bus, gRPC server) is unverified. **effort: M** — add `loom` dev-dep to `agileplus-triage`, `agileplus-nats`, `agileplus-grpc`; add a `tests/loom_*.rs` suite.
3. **No `miri test` in CI** — every `unsafe` block (5+ in thegent, 4+ in AgilePlus) is unverified. **effort: S** — add `cargo +nightly miri test -p thegent-zmx-interop -p agileplus-plane` job to each repo's CI.
4. **No TSan / ASan in CI** — zero sanitized runs. **effort: S** — add `RUSTFLAGS="-Z sanitizer=thread" cargo test` job in nightly matrix.
5. **No `CancellationToken` propagation** — async shutdowns use bare `tokio::select!` without structured cancellation. **effort: S** — add `tokio-util` to `[dependencies]` of `agileplus-grpc`, `agileplus-api`, `thegent-runtime`; thread `CancellationToken` from entry points.
6. **No documented lock ordering** — `agileplus-factory/queue.rs:108` (`tokio::sync::Mutex<Vec<Issue>>`), `agileplus-api/router.rs:100` (`tokio::sync::RwLock`), and `agileplus-events/store.rs:7` (`tokio::sync::RwLock`) are all held in different orders depending on call site. **effort: S** — add `docs/architecture/LOCK_ORDERING.md` defining the global acquire sequence.
7. **No Go race detector in Tracera CI** — `go test -race` is only in the shared `grade.sh`; Tracera's `.github/workflows/` does not run it. **effort: S** — add `go test -race ./...` to `Tracera/.github/workflows/ci.yml`.
8. **Tracely has no concurrency surface documented** — `crates/tracely-sentinel/Cargo.toml` uses tokio + atomics but no test exercises concurrency. **effort: M** — add `tests/concurrency/*.rs` covering the sentinel critical section under contention.

## Recommendations

1. **Adopt the TigerBeetle rule:** "Every concurrency primitive ships with a TLA+ spec in the same PR." This is now feasible because `tla_multi_agent.tla` shows the pattern works in the bloc.
2. **Adopt Tokio's CI pattern:** add a `loom` test suite for every `Arc<Mutex<…>>` and `Arc<RwLock<…>>` in the bloc. Start with `agileplus-triage/claim_store_sqlite.rs` and `agileplus-events/store.rs`.
3. **Add `cargo miri test` to a nightly-only CI matrix** — only `thegent-zmx-interop` and `agileplus-plane` have FFI/`unsafe`; the rest get a free pass.
4. **Add `RUSTFLAGS="-Z sanitizer=thread"` nightly job** — running for one nightly job per crate finds >90 % of data races per Mozilla's Firefox experience.
5. **Lock-free refactor of `agileplus-factory/queue.rs:108`** — replace `tokio::sync::Mutex<Vec<Issue>>` with `arc-swap` (already a transitive dep via `thegent`) to remove the lock on the issue hot path.
6. **Thread `CancellationToken` end-to-end** in `agileplus-api` and `agileplus-grpc` — a single root `CancellationToken` in `agileplus-cli` should propagate through every async call.
7. **Document `Send`/`Sync` reasoning** for the `agileplus-triage::claim` SQLite impl — currently a single comment in `claim.rs:1`; expand to a module-level doc with invariants.
8. **Per-crate `CONCURRENCY.md`** listing the concurrency primitives, the ordering invariant, and the TLA+ / loom test that proves it. Model on `thegent/docs/spec/tla_multi_agent.tla`.
