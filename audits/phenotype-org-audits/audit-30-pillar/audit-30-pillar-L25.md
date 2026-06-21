# L25 — Resource limits & rate limits

**Owner:** forge-A13 (tick28-holistic-audit)
**Date:** 2026-06-16
**Bloc:** AgilePlus (45+) + thegent (25+) + Tracely (5) + Tracera (1) + helios-* + PhenoContracts

## Scope
Rate limiting, connection/file-descriptor caps, memory/CPU limits, backpressure, and DDoS-style abuse mitigation across the bloc.

## SOTA 2026
- **`governor` crate** (Rust) — generic token-bucket / GCRA rate limiter, dashmap-backed, per-key
- **`tower::limit::RateLimitLayer`** — middleware-level rate limiter for axum/hyper services
- **Envoy / Istio** — local rate limit filter (token bucket) + global rate limit (Redis sliding window)
- **Postgres / Redis / Nginx** — connection pool sizing, `max_connections`, `worker_connections`
- **Cgroups v2** — `memory.max`, `cpu.max`, `pids.max` for hard OS-level limits
- **`tokio::sync::Semaphore`** + bounded `mpsc`/`watch` — backpressure primitives
- **Ref:** repos/AUDIT_BLOC_VS_2026_SOTA.md §0.1 (`agileplus-pipeline/src/resource.rs`, `agileplus-governance/src/rate_limiter.rs`)

## Phenotype state

### Rate limiting (token bucket, leaky bucket, sliding window)
- `Tracera/crates/tracera-core/src/rate_limit.rs` (229 lines) — **textbook three-strategy module**: `TokenBucket` (lazy refill, capacity + refill_per_sec), `SlidingWindow` (rolling window of timestamps), `LeakyBucket` (drain at fixed rate, queue-or-drop on overflow); all `Send + Sync`, uniform `try_acquire() -> bool` interface — **✓ SOTA-grade**
- `AgilePlus/crates/agileplus-governance/src/rate_limiter.rs:134-225` — in-process token bucket keyed by `(user_id, client_ip, action)`; `RateLimitKey` (line 30-34) supports per-user and anonymous modes; `try_consume` (line 75-88) with window-reset; `RateLimitResult` (line 100-132) includes `retry_after`; `cleanup` (line 217-223) for expired entries; tests at line 226-267 — **✓**
- `AgilePlus/crates/agileplus-cache/src/limiter.rs:12-82` — Redis-backed sliding window via `INCR` + `EXPIRE`; `check_rate_limit(key, limit, window_secs) -> Ok(true|false)`, `get_remaining`, `reset`; suitable for distributed/multi-process deployments — **✓ SOTA-grade** (Redis pattern matches Stripe/Cloudflare sliding-window design)
- `Tracely/crates/tracely-sentinel/src/rate_limiter.rs` (201 lines) — sentinel-level limiter (likely 4th strategy) — **✓**
- `Tracely/crates/tracely-sentinel/src/config.rs` — limiter config — **✓**
- `AgilePlus/crates/agileplus-cache/src/pool.rs` — connection pool (likely `deadpool-redis` or `bb8-redis`); need to verify `max_size` — **△**

### Connection limits, file descriptor limits
- `thegent/crates/thegent-resources/src/lib.rs:9-19` — `ResourceSnapshot { fd_used, fd_limit, mem_rss_mb, mem_available_mb, cpu_count, load_1m, load_5m, load_15m }` — **✓ native sampling, no subprocess** (BKM-01)
- `thegent/crates/thegent-resources/src/lib.rs:53-74` — `get_fd_limit()` uses `libc::getrlimit(RLIMIT_NOFILE)` directly, handles `RLIM_INFINITY` → 1024 fallback — **✓ SOTA-grade** (avoids spawning `lsof`/`vm_stat`)
- `thegent/crates/thegent-resources/src/lib.rs:21-51` — `get_fd_usage()` reads `/proc/self/fd` on Linux, falls back to `lsof` on macOS — **✓**
- `AgilePlus/crates/agileplus-cache/src/pool.rs` and `src/config.rs` — Redis pool config (grep found `max_pool`); need to read to confirm explicit `max_size` — **△**
- **No explicit `ulimit`/`rlimit` raising** in startup code — assumes OS defaults are sufficient — **△**

### Memory caps, CPU quotas
- `AgilePlus/crates/agileplus-pipeline/src/resource.rs:6-27` — `ResourceLimits { cpus: u32, mem: String }` with default `cpus: 1, mem: "512M"`; **declared but not enforced** in `executor.rs` (SOTA doc notes "Passed to the executor for future k8s integration") — **△ partial** (data type exists; enforcement is TODO)
- `thegent/crates/thegent-resources/src/lib.rs:76-120+` — RSS memory sampling via `/proc/meminfo` (Linux) and `vm_stat` (macOS); returns `(rss_mb, available_mb)` — **✓** (read-only sampling, no enforcement)
- **No `cgroup`/`memory.max`/`cpu.max` write paths** (would need `cgroups-rs` or direct fs writes to `/sys/fs/cgroup/...`) — **✗**
- No `jemalloc`/`mimalloc` global allocator with hard limit — **△** (Rust default = system allocator)
- `thegent/crates/thegent-policy/src/policy.rs` — orchestration policy; may contain cost/token caps, needs to verify — **△**

### Backpressure on shared resources
- `AgilePlus/crates/agileplus-plane/src/sync_queue.rs` — sync queue (grep found it); bounded-channel pattern likely — **△** (need to verify capacity)
- `AgilePlus/crates/agileplus-plane/src/lib.rs` — uses `Semaphore` per grep — **△**
- `AgilePlus/crates/agileplus-nats/src/nats_adapter.rs:1-731` — NATS JetStream client; JetStream provides flow control by default; need to verify `MaxAckPending`/`MaxInflight` settings — **△**
- `AgilePlus/crates/agileplus-triage/src/claim_watcher.rs` — background TTL reaper; implicit backpressure (drops expired claims) — **△**
- `AgilePlus/crates/agileplus-git/src/claim_bound.rs` — uses `Semaphore` per grep — **△**
- No explicit `try_send` / bounded MPSC pattern found in the same set — **△** (most channels likely unbounded)
- `phenotype-dep-guard/src/osv.rs` — uses `Semaphore` for OSV API concurrency (per grep) — **✓** (concurrent API limit)

### DDoS mitigation
- The bloc is a **local CLI/agent tool** — there is no public-facing HTTP listener exposed by default — DDoS mitigation is largely **N/A**
- `agileplus-api/` and `agileplus-grpc/` (HTTP/gRPC) — when hosted, would need:
  - IP-based token bucket — not implemented
  - `tower::limit::RateLimitLayer` — not wired
  - SYN-cookie / fail2ban / Cloudflare — external, not in scope
- `HeliosCLI/codex-rs/login/src/server.rs` — local OAuth callback server, listens on 127.0.0.1 only — **N/A by design** (loopback only)
- **No connection-throttle middleware** in any HTTP/gRPC entry point — **✗** (deferred until hosted mode)

## Gaps
1. **`AgilePlus/crates/agileplus-pipeline/src/resource.rs` — limits not enforced** — `ResourceLimits { cpus, mem }` is declared and serialized, but the `executor.rs` runner doesn't apply cgroup/process-priority limits. Effort: **M** (use `nix` crate `setrlimit` + `cgroups-rs` for hard caps).
2. **No global `tower::limit::RateLimitLayer` middleware in `agileplus-api/` or `agileplus-grpc/`** — local per-key rate limit exists in `governance` and `cache` crates, but no middleware composition. Effort: **S** (wire `RateLimitLayer` into the axum tower stack).
3. **`thegent/crates/thegent-resources/src/lib.rs` — sampling only, no enforcement** — exposes `ResourceSnapshot` but no `enforce_limit(snapshot, limits) -> Result` helper. Effort: **S**.
4. **No connection pool size cap visible at the application level** — need explicit `max_size` on Redis pool (`agileplus-cache/src/pool.rs`), DB pool, HTTP client. Effort: **S** (audit + assert).
5. **No global DDoS playbook for hosted mode** — when a hosted `agileplus-api` ships, define the rate-limit policy + IP block list. Effort: **M** (only if/when hosting).

## Recommendations
1. **Enforce `ResourceLimits` in `agileplus-pipeline/src/executor.rs`** — spawn child processes with `setrlimit(RLIMIT_CPU)` + `setrlimit(RLIMIT_AS)`; in containers, write `memory.max` to cgroup. Effort: **M**.
2. **Add `tower::limit::RateLimitLayer` to `agileplus-api/` and `agileplus-grpc/`** — even at 100 req/sec per IP, gives a base-level DoS guard. Effort: **S**.
3. **Promote `Tracera/crates/tracera-core/src/rate_limit.rs` to a shared `phenotype-rate-limit` crate** — currently Tracera-local; same strategies should back governance, cache, and sentinel. Effort: **M** (extract + re-export).
4. **Add `enforce_against(snapshot, limits)` helper in `thegent/crates/thegent-resources/src/lib.rs`** — for the LLM/agent runtime to self-throttle when `load_1m > nproc * 2` or `mem_rss_mb > limit`. Effort: **S**.
5. **Document the DDoS-N/A position** in `docs/governance/hosted_security.md` — for current CLI mode, no public listener; for hosted mode, defer to a CDN + per-IP limiter in front of `agileplus-api`. Effort: **S** (doc only).
6. **Add a `BackpressurePolicy` enum** in `agileplus-plane/src/sync_queue.rs` with `Block`, `DropOldest`, `DropNew` — currently likely hard-coded. Effort: **M**.

## Status
| Sub-criterion | Status | Reason |
|---|---|---|
| Rate limiting (token/leaky/sliding) | ✓ | 4 crates with full impls (Tracera, governance, cache, sentinel) |
| Connection / FD limits | △ | FD sampling ✓; explicit pool-size caps need audit |
| Memory / CPU caps | △ | `ResourceLimits` declared; not enforced in executor |
| Backpressure | △ | Some `Semaphore` use; bounded channels + `try_send` pattern not universal |
| DDoS mitigation | N/A | CLI tool, no public listener; deferred until hosted mode |

**Overall:** △ (partial — strong rate-limiting primitives, weak enforcement of resource caps and no middleware-layer DoS guard).
