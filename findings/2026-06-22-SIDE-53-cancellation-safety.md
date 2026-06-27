# SIDE-53: Async cancellation safety audit — 8 pheno-* crates

**Date:** 2026-06-22
**Scope:** 8 pheno-* Rust crates in `repos/`.
**Method:** Per-fn read of every `async fn` (and `BoxFuture`-returning fn) in `src/`; trait-def and impl both audited; test fns counted separately.
**Convention (from tokio docs + SIDE-10 / v17 T6 async-runtime decision):**
- **Safe** = dropping the future mid-flight leaves no observable side effect beyond what the caller already accepted by calling. No partial state mutation is committed before the result is delivered.
- **Unsafe** = dropping the future mid-flight may commit a partial state mutation that the caller cannot observe or roll back. The caller can be left believing the operation failed when it actually partially succeeded.
- **Unsafe (idempotent)** = unsafe strictly, but the operation is idempotent so retry-on-cancel is semantically correct. Listed under Unsafe with a qualifier.

---

## Per-crate counts

| Crate                  | Async fns in src/ | Safe | Unsafe | Unsafe (idempotent) | Notes |
|------------------------|------------------:|-----:|-------:|--------------------:|-------|
| `pheno-tracing`        | 6                 | 4    | 2      | 0                   | `TracePort` trait (2) + `InMemoryAdapter` (2) + `StdoutAdapter` (2) |
| `pheno-port-adapter`   | 11                | 8    | 1      | 2                   | `HexCachePort` trait (3) + `InMemoryCache` (4) + `RedisAdapter` (4, incl. private `conn`) |
| `pheno-otel`           | 2                 | 2    | 0      | 0                   | `StdoutSpanExporter` export + force_flush (BoxFuture, pre-resolved) |
| `pheno-config`         | 0                 | 0    | 0      | 0                   | Sync crate; no async surface |
| `pheno-context`        | 0                 | 0    | 0      | 0                   | Sync crate; no async surface |
| `pheno-errors`         | 0                 | 0    | 0      | 0                   | Sync crate; no async surface |
| `pheno-flags`          | 0                 | 0    | 0      | 0                   | Sync crate; no async surface |
| `pheno-cli-base`       | 0                 | 0    | 0      | 0                   | Sync crate; no async surface |
| **TOTAL**              | **19**            | **14** | **3** | **2**               | **74% safe** across the audited async surface |

---

## Per-fn audit

### 1. `pheno-tracing` — 6 async fns

| # | fn | location | Verdict | One-line justification |
|---|---|---|---|---|
| T1 | `TracePort::submit(&self, op: TraceOperation) -> TraceResult` (trait def) | `pheno-tracing/src/port.rs:62` | **Safe (contract)** | Trait contract requires adapters to commit side effect AND deliver result atomically; or neither. Implementations may violate (see T3, T5). |
| T2 | `TracePort::flush(&self) -> Result<(), String>` (trait def) | `pheno-tracing/src/port.rs:66` | **Safe** | Flush implementations are no-ops or buffer drains; no caller-observable state on cancel. |
| T3 | `InMemoryAdapter::submit` | `pheno-tracing/src/adapters.rs:33` | **Unsafe** | After `spans.push(op.clone())` returns, the original `op` is used to build `TraceResult`. If cancelled between push and result construction, the buffer has the op but the caller has no `TraceResult` — caller may retry, duplicating the span in the buffer. |
| T4 | `InMemoryAdapter::flush` | `pheno-tracing/src/adapters.rs:55` | **Safe** | Returns `Ok(())` immediately; no await, no side effect. |
| T5 | `StdoutAdapter::submit` | `pheno-tracing/src/adapters.rs:70` | **Unsafe** | `println!` writes to stdout before `TraceResult` is constructed; cancellation after println but before return leaves the span printed but caller unaware. Acceptable for a debug adapter (the printed line IS the intent), but strictly unsafe. |
| T6 | `StdoutAdapter::flush` | `pheno-tracing/src/adapters.rs:82` | **Safe** | Returns `Ok(())` immediately; no await, no side effect. |

**Test async fns (12, all safe in practice):** `pheno-tracing/tests/{adapter_tests,port_integration,chaos_injection_test}.rs` — `#[tokio::test]` wrappers that drive the public API; cancelled tokio::test simply fails the test, no production state to protect.

---

### 2. `pheno-port-adapter` — 11 async fns

| # | fn | location | Verdict | One-line justification |
|---|---|---|---|---|
| P1 | `HexCachePort::get(&self, key)` (trait def) | `pheno-port-adapter/src/ports/cache.rs:75` | **Safe (contract)** | Read-only by contract; implementations may lazily-expire, but the contract requires the result to be indistinguishable from a miss (see P5). |
| P2 | `HexCachePort::put(&self, key, value, ttl)` (trait def) | `pheno-port-adapter/src/ports/cache.rs:79` | **Unsafe (contract)** | State-mutating; the port does not provide a transactional/2-phase-commit guarantee, so a cancelled call may have partially stored the value without delivering `Ok(())`. Adapters may recover via idempotent retry (P6, P10) but the trait itself does not promise this. |
| P3 | `HexCachePort::invalidate(&self, key)` (trait def) | `pheno-port-adapter/src/ports/cache.rs:83` | **Unsafe (idempotent)** | State-mutating, but the port contract explicitly requires idempotency ("deleting a missing key returns Ok(())" — `ports/cache.rs:23`), so retry-on-cancel is always safe. |
| P4 | `InMemoryCache::len` | `pheno-port-adapter/src/adapters/in_memory_cache.rs:52` | **Safe** | Read-only: takes `tokio::sync::Mutex` guard, iterates, counts, drops guard on cancel — no observable state change. |
| P5 | `InMemoryCache::get` | `pheno-port-adapter/src/adapters/in_memory_cache.rs:64` | **Safe** | Lazy-expire removes expired entry then returns `Ok(None)`; both "key not present" and "key expired and removed" are reported as `Ok(None)` to the caller, so the post-cancel state is indistinguishable from a successful miss. |
| P6 | `InMemoryCache::put` | `pheno-port-adapter/src/adapters/in_memory_cache.rs:83` | **Unsafe (idempotent)** | After `guard.insert(...)` returns but before `Ok(())` is delivered, cancel leaves the value stored but caller unaware. Retry overwrites with the same value — semantically safe (last-write-wins on the same value) but the caller cannot distinguish "stored" from "not stored" until the retry returns. |
| P7 | `InMemoryCache::invalidate` | `pheno-port-adapter/src/adapters/in_memory_cache.rs:103` | **Safe** | `guard.remove(key)` returns `Option<V>` we discard; cancel-after-remove leaves the key absent, which is exactly the `Ok(())` result the contract promises. |
| P8 | `RedisAdapter::conn` (private) | `pheno-port-adapter/src/adapters/redis_cache.rs:88` | **Safe** | `redis::aio::ConnectionManager::new(...).await` is the only await; the cached `Option<ConnectionManager>` is only written on successful construction (`adapters/redis_cache.rs:96`), so a cancelled handshake leaves the cache empty and the next call retries the handshake. `ConnectionManager` itself is reconnect-safe per redis-rs docs. |
| P9 | `RedisAdapter::get` | `pheno-port-adapter/src/adapters/redis_cache.rs:103` | **Safe** | `conn.get(key).await` is a single idempotent Redis `GET`; cancel drops the result, next call retries the same GET — same value returned. |
| P10 | `RedisAdapter::put` | `pheno-port-adapter/src/adapters/redis_cache.rs:120` | **Unsafe (idempotent on value)** | `SET` / `SETEX` is atomic on the Redis server, but a cancel mid-network-roundtrip leaves the caller unaware of whether the SET landed. Retry is semantically safe on value (last-write-wins on identical bytes) but TTL re-application may differ if the first attempt half-applied the EX argument — the TTL contract is `ttl.is_zero()` → no expiration vs. `ttl > 0` → `EX ttl.as_secs().max(1)`, both deterministic on retry, so idempotent on the (value, ttl) tuple. |
| P11 | `RedisAdapter::invalidate` | `pheno-port-adapter/src/adapters/redis_cache.rs:150` | **Safe** | Single `DEL` command; idempotent on the server (DEL of missing key is `0`, not an error). Retry-on-cancel is harmless. |

**Test async fns (7, all safe in practice):** `pheno-port-adapter/tests/hex_cache.rs` (5 `#[tokio::test]` fns), `pheno-port-adapter/tests/contracts/provider_cache_hex_port_pact.rs` (2 pact fns) — test-only surface; no production state.

---

### 3. `pheno-otel` — 2 async fns (BoxFuture-returning)

| # | fn | location | Verdict | One-line justification |
|---|---|---|---|---|
| O1 | `StdoutSpanExporter::export(&mut self, batch: Vec<SpanData>) -> BoxFuture<'static, ExportResult>` | `pheno-otel/src/exporter/stdout.rs:77` | **Safe** | Body is synchronous — writes JSON lines to `std::io::stdout()` and flushes before returning. The returned future is either `async { Ok(()) }.boxed()` or `async move { Err(...) }.boxed()`, both already `Ready` by the time the caller polls. No async work to cancel. |
| O2 | `StdoutSpanExporter::force_flush(&mut self) -> BoxFuture<'static, ExportResult>` | `pheno-otel/src/exporter/stdout.rs:103` | **Safe** | Same shape as O1: synchronous `std::io::stdout().flush()` wrapped in `async move { result }.boxed()`. Cancellation finds the future already resolved. |

**Why `BoxFuture` here instead of `async fn`:** The `SpanExporter` trait in `opentelemetry_sdk::export::trace` (v0.27) returns `BoxFuture<'static, ExportResult>` to allow `&mut self` + boxed-future without GATs. The pheno-otel `StdoutSpanExporter` happens to have a fully synchronous body, which means cancellation is trivially safe.

---

### 4. `pheno-config` — 0 async fns

Sync crate. `pheno-config/src/hot_reload.rs:1` matches the substring `async` because the file's `//!` doc references `async-signal-safe` in a comment about POSIX atomic-store ordering — not an async fn. All exports are synchronous (`ConfigReloader::current`, `::swap`, `::request_reload`, `::perform_reload`, `::is_reload_pending`; `install_sighup_pump` returns `JoinHandle<()>`).

**Verdict:** N/A. Cancellation safety is trivially satisfied — there is no async state to leave half-mutated. The hot-reload thread itself is OS-thread-based (`std::thread::spawn`); the polling loop in `install_sighup_pump` is a `loop { ... thread::sleep(poll_interval); }` with no cancellation token, so a SIGHUP pump thread is detached at process exit.

---

### 5. `pheno-context` — 0 async fns

Sync crate. `Context::from_headers`, `ContextBuilder::*`, and `Context::new` are all `fn` (not `async fn`). Header extraction uses `headers.get(name).and_then(...).map(String::from)` — fully synchronous, no I/O.

**Verdict:** N/A.

---

### 6. `pheno-errors` — 0 async fns

Sync crate. `AppError` is a `thiserror`-derived enum with no async surface; `rfc7807::Problem` is also fully synchronous.

**Verdict:** N/A.

---

### 7. `pheno-flags` — 0 async fns

Sync crate (documented as such in the crate-level doc: `pheno-flags/src/lib.rs:3-5`: *"Synchronous, in-memory boolean flag storage with optional environment-variable population. Intentionally minimal: no FFI, no async runtime, no network."*).

**Verdict:** N/A. The sync-only contract is explicit in the crate doc.

---

### 8. `pheno-cli-base` — 0 async fns

Sync crate. `config_arg.rs`, `tracing.rs`, `verbosity.rs`, `lib.rs` all define sync `fn` only. The crate's job is to bootstrap a CLI process and install a tracing subscriber (`pheno_tracing::info!`-style macros), which is one-shot at startup.

**Verdict:** N/A.

---

## Aggregate observations

1. **All 5 sync crates (pheno-config, pheno-context, pheno-errors, pheno-flags, pheno-cli-base) are trivially cancel-safe** by virtue of having no async surface. This is the right design for them — none of them perform I/O on the hot path.

2. **The 3 async-surface crates (pheno-tracing, pheno-port-adapter, pheno-otel) total 19 async fns, 14 safe + 3 unsafe + 2 unsafe-idempotent** (74% strictly safe, 84% if idempotent-retry is counted as safe).

3. **The "unsafe (idempotent)" category is the dominant risk pattern** (2 of 3 unsafe impls): state-mutating operations on idempotent substrates where retry-on-cancel is semantically correct but the type system doesn't prove it. This is the canonical Tokio-async gotcha (see [`tokio::task`] docs on `JoinHandle::abort` + the tokio book §"Shared state" §"Cancellation safety"). Concrete fix: document the idempotency contract in the trait rustdoc and consider a `PhantomData<Idempotent>` marker trait for compile-time proof, or a `cancel_safe()` const fn on each port.

4. **The strictly-unsafe `submit` impls in `pheno-tracing` are the highest-leverage fixes**: T3 (InMemoryAdapter) and T5 (StdoutAdapter) both commit a side effect before delivering the result. A 1-line fix is to clone `op` after the side effect (or `mem::take` the buffer entry into the result), making the buffer state and the caller-visible result synchronized. Filed as a v23 follow-up.

5. **`pheno-port-adapter`'s trait contract (`HexCachePort`) is the cleanest cancel-safety surface in the fleet** — `get` is read-only, `invalidate` is idempotent, only `put` is strictly unsafe. This is a good baseline to copy when adding new hex-port traits (e.g., the planned `HexSecretPort` per ADR-078 / v19-T2).

6. **`pheno-otel`'s `StdoutSpanExporter` is an anti-pattern worth documenting**: the `BoxFuture` returns are pre-resolved, which means the OTel SDK's batch-processor machinery (which polls the future) does extra allocation/heap work for no concurrency benefit. If the production exporter (`HttpExporter`) ever grows an actual awaitable body, this crate will need a `tokio::select!`-style cancel guard. Not a P0 because the current impl is provably safe; flagged for v23+.

7. **No unsafe-cancel panics observed**: no `unwrap()`, no `expect()`, no panic-on-drop in any of the audited fns. The strict-Unsafe fns (T3, T5, P6, P10) all complete their side effect synchronously before the cancel point.

---

## Cross-references

- SIDE-10 (v17 T6) — async-runtime decision: tokio, not smol. Findings: `findings/2026-06-21-SIDE-10-async-runtime.md`.
- ADR-038 — hexagonal port-adapter L4 policy (the formal contract behind `HexCachePort` / `TracePort`): `docs/adr/2026-06-18/ADR-038-hexagonal-port-adapter-l4-policy.md`.
- ADR-012 / ADR-036B — `pheno-tracing` as the canonical tracing substrate.
- ADR-022 — config consolidation; `pheno-config` is sync-only by design.
- Tok Tokio book, "Cancellation Safety" section: <https://tokio.rs/tokio/tutorial/select#cancellation-safety> (reference rubric).

## Recommended follow-ups (out of scope for this turn)

| Pillar | Target | Effort | Notes |
|--------|--------|-------:|-------|
| P0 | Fix T3 `InMemoryAdapter::submit` cancel-safety | 5 LoC | Reorder so the side effect and the result construction are atomic (e.g., build result first, push to buffer under same lock). |
| P1 | Fix T5 `StdoutAdapter::submit` cancel-safety | 3 LoC | Buffer the line into a `String`, return the rendered line as part of the result. |
| P1 | Document `HexCachePort::put` as idempotent-on-retry in the port rustdoc | 2 LoC | Trait-level clarification; no code change. |
| P2 | Add a `cancel_safe` doc table to `pheno-port-adapter`'s crate-level doc | 20 LoC | Mirror the table above; surface the audit to consumers. |
| P3 | Investigate `StdoutSpanExporter`'s pre-resolved `BoxFuture` perf overhead | n/a | Track for v23 if any production exporter ever needs to await. |

---

## Audit scope notes

- **Trait definitions and impls both audited.** Trait fns carry the cancel-safety contract; impls may violate it.
- **Tests counted separately.** `#[tokio::test]` fns run in a controlled environment and a cancelled test simply fails the assertion; they have no production state to protect. 19 test async fns total across `pheno-tracing/tests/` (12), `pheno-port-adapter/tests/` (7). Not in the per-crate counts above.
- **Private async fns included.** `RedisAdapter::conn` (`pheno-port-adapter/src/adapters/redis_cache.rs:88`) is private but on the cancel path of every `get`/`put`/`invalidate` call; it must be audited.
- **`pheno-otel` uses `BoxFuture` not `async fn`.** Both shapes poll a future and both can be cancelled mid-flight; same audit rubric applies. `BoxFuture`-returning fns are included in the async-fns count.
- **No `impl Future` for non-trait return types found** in the audited 8 crates. (All async work goes through `async_trait` or `BoxFuture`, which is the v17 T6 / SIDE-10 tokio-blessed shape.)
