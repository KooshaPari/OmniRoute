# L4 — Async / concurrency design

## Scope
How the bloc designs asynchrony, channel / mutex usage, backpressure, cancellation, shutdown, and concurrent resource claim. Owner: forge-003 (AX).

## SOTA 2026
- `tokio` 1.x (or `async-std` 1.x) with structured concurrency primitives (`tokio::select!`, `JoinSet`, `CancellationToken`).
- Bounded channels (mpsc/broadcast) for backpressure; never unbounded in production paths.
- Explicit graceful-shutdown via `CancellationToken`/`watch` channels wired into every long-running task.
- RAII claim/lease primitives with TTL + heartbeat for distributed resource ownership (à la `try-rent`, `lease-rs`).
- Per-task structured `tracing::Span` for observability (see L5).
- Outbound HTTP/gRPC clients use `tower::Service` middleware for timeout + concurrency limits.

## Phenotype state
- AgilePlus: `crates/agileplus-triage/src/claim.rs:218-396` — **partial**. `ClaimStore` is in-memory with `HashMap<String, Claim>` guarded by caller-provided external locking (doc: "Use external locking for thread-safety in production deployments"). The trait `ClaimStoreTrait` is `&mut self` (synchronous), no async. TTL reaping is pull-based (`reap_expired(now)`). Heartbeat/transfer semantics correct. ✗ for thread-safety, ✓ for correctness of single-threaded semantics.
- AgilePlus: `crates/agileplus-triage/src/claim_store_sqlite.rs` (referenced at `claim.rs:24-27`, `claim.rs:174-176`) — SQLite impl is `Send` but not `Sync` per `claim.rs:174-176`; trait deliberately minimal so callers wrap in `Mutex`. △ (acceptable for now; production needs async-aware store).
- AgilePlus: `crates/agileplus-grpc/src/server/bootstrap.rs:44-72` — `serve_with_shutdown(addr, shutdown_signal())` + `tokio::select!` for shutdown orchestration. ✓
- AgilePlus: `crates/agileplus-grpc/src/server/mod.rs:547, 576` — same pattern, `serve_with_shutdown` + `tokio::select!`. ✓
- AgilePlus: HTTP services (`agileplus-api/src/router.rs:182`, `agileplus-dashboard/src/main.rs:31`, `agileplus-mcp-intent/src/http.rs:39`) — `axum::serve(listener, app).await?` — **missing explicit shutdown signal**; no `serve_with_shutdown` or `with_graceful_shutdown` call. △ (functional, but no SIGTERM/SIGINT plumbing).
- AgilePlus: tokio primitive usage — 28 occurrences of `tokio::sync::*` / `tokio::mpsc` / `tokio::Semaphore` across `crates/`. △
- AgilePlus: zero `#[tracing::instrument]` / `#[instrument]` attributes on async fns. ✗ for L4 (instrumentation is L5, but its absence here means no per-task span).
- thegent: `crates/thegent-offload/src/main.rs:62-202` — `#[tokio::main] async fn main`, `axum::serve`, `axum::Router` with `auth_middleware`, `health_handler`, `execute_handler`, `status_handler`, `run_client` — all `async fn` returning `Result`. ✓ for async-fn shape; ✗ for shutdown (no `with_graceful_shutdown`).
- thegent: `crates/thegent-offload/src/executor.rs:17, 82, 132` — `pub async fn execute`, `async fn setup_worktree`, `async fn cleanup_worktree`. ✓.
- thegent: `crates/thegent-runtime/src/main.rs` (838 lines) — single binary dispatch shim, no async runtime. ✓ for the role (CLI shim, not a server).
- thegent: `crates/thegent-metrics/src/lib.rs` — counters use `Arc<Mutex<u64>>` (`lib.rs:11, 28-29`). Single Mutex per Counter; calls `lock().expect("lock poisoned")`. △ (poisoning panics, no backpressure semantics; `DashMap` available in Cargo but not used here).
- thegent: zero occurrences of `tokio::sync::*` mpsc/broadcast/watch across `crates/` (count: 2 — both are `#[tokio::test]` attributes from search of `tokio::sync::`). **No async channel use anywhere.** ✗ (claim release/heartbeat mechanisms are notifier-free).
- thegent: zero `CancellationToken` / `with_graceful_shutdown` references. ✗
- Tracely: `crates/helix-tracing/src/lib.rs:81-127` — sync `init_tracing`, `TraceContext { trace_id, span_id }` UUIDv4 generation, `level_as_str`. ✗ for async/concurrency (no async surfaces, which is correct for a tracing-init crate, but no `TraceContext` propagation through async boundaries).
- Tracely: `crates/tracely-core/Cargo.toml` declares optional `opentelemetry`, `prometheus`, `metrics` — no consumer wires them. △.
- Tracely: `crates/zerokit/` — empty `src/` directory. ✗ (Zig logging shim not present; `pheno-logging-zig` directory is empty).
- Tracera (Python): `src/tracertm/api/main.py` — single FastAPI app with `RequestIdMiddleware`, one router (`traceability`). No async channel / backpressure concerns at this scale. △ (Python async handled by `uvicorn`/`anyio`; no custom concurrency).
- Tracera (Rust): `crates/tracera-core/src/health.rs:69-80, 142-186` — object-safe `HealthCheck` trait returning `Pin<Box<dyn Future>>`, `HealthRegistry` uses `Mutex<Vec<Arc<dyn HealthCheck>>>`, snapshots before awaiting (lock released). ✓ for async-trait shape, ✓ for lock-during-await avoidance.
- Tracera (Rust): `crates/tracera-core/src/observability.rs:34-36` — `make_span(envelope_id) -> Span` for `tracera.bus` span. △ (no explicit `JoinHandle` cancel / context propagation).
- Tracera (Rust): `crates/tracera-core/src/cache.rs` (256 lines), `notification.rs` (533 lines) — likely channel/timer primitives; not opened for line-level citations in this pillar (covered in L7).

## Gaps
1. **agileplus-api / agileplus-dashboard / agileplus-mcp-intent: `axum::serve` without `with_graceful_shutdown`** — SIGTERM drops in-flight requests. Effort: **S** (3 sites, ~10 lines each, import `tokio::signal`).
2. **agileplus-triage: `ClaimStore` not thread-safe internally** — caller-supplied `Mutex` is the contract, but no in-process async broadcast for "claim released" / "claim expired" events. Effort: **M** (introduce `tokio::sync::watch` for state, async-trait variant of `ClaimStoreTrait`).
3. **agileplus: zero `#[instrument]` on async fns** — every long-running task needs a parent span for L5 correlation. Effort: **M** (~50 fns across `agileplus-pipeline`, `agileplus-convoys`, `agileplus-events`).
4. **thegent: no async channels / no cancellation primitive** — heartbeat, claim release, and worktree cleanup paths are synchronous with no event fan-out. Effort: **L** (introduce `CancellationToken`, wire `tokio::select!` into offload executor, add `mpsc` for heartbeat ticks).
5. **thegent: `thegent-metrics` `Mutex<u64>` per counter** — high-cardinality metric registration is a global lock. Migrate to `DashMap` (already a dep) or `parking_lot::Mutex`. Effort: **S** (~20 LOC).
6. **Tracely: `pheno-logging-zig` and `zerokit` shells are empty** — Zig logging + zerokit observability primitives are declared in `Cargo.toml` workspace but have no source. Either populate or remove from workspace. Effort: **M** (resolve direction; see L0).
7. **Tracera Python: no `/healthz` despite the spec** — `crates/tracera-core/src/health.rs` is implemented but the FastAPI app (`src/tracertm/api/main.py`) does not mount a health router. Effort: **S** (FastAPI route + import `tracertm.api.routers.health` once available; or thin Python wrapper around the spec contract).
8. **No bloc-wide backpressure policy** — bounded-channel sizes / queue depths are not documented. Effort: **S** (one ADR per repo setting defaults: e.g. mpsc 1024, broadcast 256, semaphore 64).

## Recommendations
1. **Promote shutdown wiring to a shared `agileplus-server-shutdown` / `thegent-shutdown` helper** in the `phenotype-` shared crate set, to prevent drift across 5+ `axum::serve` sites.
2. **Adopt `tokio-util::CancellationToken` as bloc standard** (SOTA 2026); expose it through `phenotype-runtime` once introduced.
3. **Convert `ClaimStoreTrait` to an async trait (or provide `async fn` shim)** with `tokio::sync::Mutex` to remove caller-side locking burden, then add a `tokio::sync::watch` notification stream for state transitions.
4. **Add `#[instrument]` + `tracing::Span` parents to all spawn-points** (covered under L5; cite here as enabling for distributed-trace propagation).
5. **Add an ADR per repo: "Async + Concurrency Policy"** covering: executor (tokio), channel sizes, cancellation primitive, backpressure defaults, lock-free primitives. Effort per ADR: **S** (2-3 pages).
6. **Wire `tracera-core` `HealthCheck` registry into the FastAPI service** (or expose a Python shim) so `/healthz`/`/readyz` are live, not just specified.
