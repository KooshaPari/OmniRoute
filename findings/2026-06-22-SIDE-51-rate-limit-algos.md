# SIDE-51 — Rate-limit algorithms: comparison

**Date:** 2026-06-22
**Task ID:** SIDE-51 (rate-limit algorithms comparison)
**Agent:** orch-direct (read-only research)
**Status:** Proposed (informs `pheno-ratelimit` crate design per `findings/2026-06-20-GUARD-side-23-ratelimit-webhooks.md`)
**Scope:** 4 algorithms — fixed window, sliding window (log + counter variants), token bucket, leaky bucket (meter + queue variants). Per-algorithm pseudocode + complexity + fairness + burst behavior + use-case recommendation.

---

## 0. Why this doc

Side-23 (`findings/2026-06-20-GUARD-side-23-ratelimit-webhooks.md`) flagged that webhook ingestion across 4 fleet services is unrate-limited and recommended a token-bucket middleware by default. Before committing to token bucket as the fleet default, SIDE-51 surveys the four canonical rate-limit algorithms so the choice is defensible, and so future service authors can pick a different algorithm when the workload shape demands it.

This doc is **read-only research**. No code is changed. Findings feed:
- `pheno-ratelimit` crate design (token bucket as default; leaky-bucket-queue as opt-in for shaper-style use)
- `pheno-port-adapter` `RateLimitPort` trait contract (one algorithm per port impl, swappable)
- Webhook-receiver rollout plan (side-23)

---

## 1. Notation

| Symbol | Meaning |
|---|---|
| `W` | Window length (seconds) |
| `L` | Limit (max requests per window for fixed/sliding; tokens-per-second-refill for bucket variants) |
| `C` | Bucket capacity (max tokens / max queue size) |
| `r` | Refill / drain rate (tokens-per-second for bucket; requests-per-second for leaky-queue) |
| `now()` | Monotonic clock in seconds (use `Instant`, not `SystemTime`, to avoid wall-clock jumps) |
| `key` | Per-client identifier (IP, API key, tenant ID, source header) |
| `cost` | Tokens consumed per request (default 1; can be >1 for expensive endpoints) |
| `Δ` | Elapsed seconds since last update |

All algorithms are presented as per-request check functions. State is per-`key`. Distributed implementations (Redis-backed) are discussed in §6.

---

## 2. Algorithm 1 — Fixed Window

### Idea

Divide time into non-overlapping windows of length `W`. Maintain a counter per `(key, window_start)`. Reset the counter when the window rolls over.

### State

```
state[key] = { window_start: u64, counter: u64 }
```

With cleanup of stale entries (evict entries older than `now - W`).

### Pseudocode (per-request check)

```text
fn check_fixed_window(key, now) -> Decision:
    window = (now / W) * W                    # integer division, floor
    bucket = state.get_or_insert(key)         # atomic CAS or per-key mutex
    if bucket.window_start != window:
        bucket.window_start = window
        bucket.counter = 0                    # reset on window roll
    bucket.counter += 1
    if bucket.counter > L:
        return Deny { retry_after = window + W - now }
    return Allow
```

### Complexity

- **Time:** O(1) per request (one map lookup + atomic increment).
- **Space:** O(k) where `k` = number of distinct active keys. With TTL eviction on `window_start + W`, the working set stays bounded at ~1-2 windows per key.

### Fairness

**Poor.** Suffers from the **boundary burst** problem: a client can send `L` requests at `t = W - ε` and another `L` requests at `t = W + ε`, achieving `2L` requests in `2ε` seconds — twice the configured rate. This is exploitable for short-window floods (DoS) and breaks billing guarantees for clients that legitimately chunk their work at window boundaries.

### Burst behavior

Allows up to `2L` requests in a `2ε` window straddling a boundary. Within a window, no smoothing — the full `L` can arrive in one millisecond.

### When to use

- Coarse-grained quotas where boundary effects don't matter: **daily** API quotas, **monthly** billing caps, **weekly** email limits.
- Backends where the simplest possible implementation matters more than accuracy (e.g., a Redis `INCR` + `EXPIRE` is two commands and is atomic across replicas).
- Prototyping — fixed window is the easiest to implement correctly and the easiest to reason about.

### When **not** to use

- Sub-minute windows (boundary burst becomes the dominant traffic shape).
- Anywhere a billing/SLO guarantee like "no more than 100 req/min" is taken literally.
- Anti-abuse paths where the boundary exploit is the attack.

---

## 3. Algorithm 2 — Sliding Window

Two variants. The "log" variant is exact but memory-heavy; the "counter" variant is approximate but O(1) memory.

### 3a. Sliding Window Log

#### Idea

Store a timestamp for every admitted request. On each new request, evict timestamps older than `now - W`, then check whether the remaining count is below `L`.

#### State

```
state[key] = deque<u64>   # timestamps (seconds, monotonic) of admitted requests
```

#### Pseudocode

```text
fn check_sliding_window_log(key, now) -> Decision:
    q = state.get_or_insert(key)
    cutoff = now - W
    while q.front() is Some and q.front() < cutoff:
        q.pop_front()
    if q.len() >= L:
        oldest = q.front()
        return Deny { retry_after = oldest + W - now }
    q.push_back(now)
    return Allow
```

#### Complexity

- **Time:** O(1) amortized per request (one deque push + at most one pop per request, assuming requests arrive in chronological order; otherwise O(log n) for reordering, but rate-limit keys are typically serialized through a mutex so chronological order holds).
- **Space:** O(L) per key — the deque holds up to `L` timestamps. For L=10k req/min and 1M active keys, that's ~80 MB of `u64`s. Manageable; not free.

#### Fairness

**Highest (exact).** The definition "no more than `L` requests in any `W`-second interval" is enforced literally. No boundary exploit. No estimate. The deque is the ground truth.

#### Burst behavior

**Zero burst tolerance.** Burst of `L` at `t=0` blocks further requests until `t=W`. Then admits `L` more. Strictly enforces the rate.

#### When to use

- **Anti-abuse paths** where exact enforcement matters (login attempts, password resets, MFA challenges).
- **Billing-critical** endpoints where "100 req/min guaranteed" is contractual.
- Low-volume keys (humans, not fleets) where O(L) memory per key is acceptable.
- Cases where `L` is small (≤1000) and the per-key memory cost is negligible.

#### When **not** to use

- High-cardinality keys (every IoT device in a fleet) with `L` > 100 — memory becomes O(L × k).
- Hot paths where `O(L)` memory eviction per key adds GC pressure.

---

### 3b. Sliding Window Counter (Cloudflare approach)

#### Idea

Approximate the sliding-window count as a weighted sum of the current and previous fixed-window counters. The weight reflects how much of the previous window still overlaps with the trailing `W`-second view from `now`.

#### State

```
state[key] = {
    current_window_start: u64,
    current_count: u64,
    previous_count: u64,
}
```

#### Pseudocode

```text
fn check_sliding_window_counter(key, now) -> Decision:
    window = (now / W) * W
    bucket = state.get_or_insert(key)
    if bucket.current_window_start != window:
        # Roll window: previous <- current, current <- 0
        bucket.previous_count = bucket.current_count
        bucket.current_count = 0
        bucket.current_window_start = window
    elapsed = now - bucket.current_window_start       # 0 <= elapsed < W
    weight_prev = (W - elapsed) / W                   # fraction of prev window still in view
    estimated = bucket.current_count
             + bucket.previous_count * weight_prev
    if estimated + 1 > L:
        return Deny { retry_after = (estimated + 1 - L) / (L / W) + now }
    bucket.current_count += 1
    return Allow
```

#### Complexity

- **Time:** O(1) per request.
- **Space:** O(1) per key (two counters + one timestamp). Same as fixed window.

#### Fairness

**Approximate.** The estimate is accurate when traffic is uniform across the window. It's an **underestimate** when the previous window had a burst that has not yet "aged out" — i.e., a burst at the end of window N causes the second half of window N+1 to be over-throttled. It's an **overestimate** (more permissive) when the previous window was quiet and the current window is just starting.

The error is bounded: the worst-case discrepancy from the true sliding-window-log count is at most `L × (1 - weight_prev)` — typically ≤ `L/2` for any `now` not at a window boundary.

#### Burst behavior

**Smoothed.** A burst of `2L` at the window boundary (the fixed-window exploit) is reduced to approximately `L + L × weight_prev` admitted requests, where `weight_prev` is `0` at the very start of the new window and `1` at the very end. So the effective admitted rate is between `L` and `2L`, never exactly `2L`. Cloudflare reports this is good enough for production traffic shaping.

#### When to use

- **Public API rate limiting at scale** — this is Cloudflare's published algorithm and what Stripe uses for many endpoints. Best balance of accuracy vs memory.
- When you want sliding-window fairness but can't afford O(L) memory per key.
- Multi-tenant systems with high key cardinality (every customer, every IP).

#### When **not** to use

- Paths where the ~`L/2` worst-case error is unacceptable (use sliding-window-log).
- Audit/billing paths where "approximately 100/min" isn't precise enough.

---

## 4. Algorithm 3 — Token Bucket

### Idea

A bucket holds up to `C` tokens. Tokens refill at rate `r` tokens/second (continuously). Each request consumes `cost` tokens (default 1). If the bucket has fewer tokens than `cost`, the request is denied (or queued, depending on variant).

### State

```
state[key] = { tokens: f64, last_refill: f64 }
```

### Pseudocode

```text
fn check_token_bucket(key, now, cost=1) -> Decision:
    bucket = state.get_or_insert(key)        # atomic per-key mutex
    elapsed = now - bucket.last_refill
    if elapsed > 0:
        bucket.tokens = min(C, bucket.tokens + elapsed * r)
        bucket.last_refill = now
    if bucket.tokens >= cost:
        bucket.tokens -= cost
        return Allow
    shortfall = cost - bucket.tokens
    return Deny { retry_after = shortfall / r }
```

### Complexity

- **Time:** O(1) per request.
- **Space:** O(1) per key (two floats). Cheapest of all four algorithms.

### Fairness

**Medium.** A client that has been idle accumulates up to `C` tokens, then can burst at `C` requests instantaneously, then is throttled to `r` requests/second until idle again. Long-term average rate is exactly `r`, but short-term burst is up to `C`.

This is **intentional fairness** in many cases: it rewards clients that pace their requests and lets them "catch up" after a quiet period. But it is unfair in the strict sense (a client that has been busy all day has 0 tokens; a client that just connected has `C`).

### Burst behavior

**Configurable burst.** Choose `C` to allow the burst size you want. Typical API gateway config: `r = 100 req/s`, `C = 200` (allows 2-second burst, then steady 100/s).

### When to use

- **Public API gateways** (AWS API Gateway, Kong, NGINX Plus, Envoy all default to token bucket for client-facing limits). Most popular algorithm in production.
- **Outbound traffic shaping** from your service to an upstream with a published rate limit (where you want to "use up" your budget efficiently without slamming).
- **Allowing bursty client behavior** (humans don't make requests at constant rates; APIs sometimes do batch operations).
- Any case where O(1) memory per key matters at scale.

### When **not** to use

- Strictly constant output rate is required (use leaky-bucket-queue).
- Burst of `C` at startup is exploitable for DoS amplification.

---

## 5. Algorithm 4 — Leaky Bucket

The name is overloaded in the literature; two distinct variants exist. Both are covered.

### 5a. Leaky Bucket as Meter (counter variant)

#### Idea

Mathematically equivalent to token bucket with inverted metaphor: a bucket "leaks" at rate `r`; incoming requests add to the bucket. If the bucket exceeds capacity `C`, the request is denied.

In practice this is identical to the token-bucket math:

```text
fn check_leaky_bucket_meter(key, now, cost=1) -> Decision:
    bucket = state.get_or_insert(key)
    elapsed = now - bucket.last_refill
    if elapsed > 0:
        bucket.level = max(0, bucket.level - elapsed * r)   # leak
        bucket.last_refill = now
    if bucket.level + cost <= C:
        bucket.level += cost                                  # pour in
        return Allow
    return Deny { retry_after = (bucket.level + cost - C) / r }
```

**Algorithmically indistinguishable from token bucket.** The metaphor differs (overflow is rejected immediately vs. accumulated as available tokens), but the math is the same. If you find a library called "leaky bucket" that does this math, it is a token bucket by another name. Use the implementation that is well-tested and documented in your stack.

#### Complexity

Same as token bucket: O(1) time, O(1) space.

#### Fairness

Same as token bucket (medium). The two algorithms only differ in semantics — one "stores" excess as future capacity, the other "discards" it.

#### Burst behavior

Same as token bucket: configurable burst of `C`.

#### When to use

- When the literature or your team uses the term "leaky bucket" and you don't want to bikeshed.
- Equivalent to token bucket; choose whichever your team finds more intuitive.

---

### 5b. Leaky Bucket as Queue (FIFO shaper)

#### Idea

Requests enter a FIFO queue of capacity `C`. A background drainer dispatches requests at a constant rate `r`, regardless of input rate. If the queue is full, new requests are rejected. Output is strictly rate-limited.

This is the **canonical** leaky bucket from the telecom literature (ATM, Token Bucket vs Leaky Bucket papers) and what NGINX's `limit_req` module implements (with `burst=0` / queueing off).

#### State

```
state[key] = {
    queue: deque<request_id>,
    next_drain_at: f64,    # monotonic timestamp when next request will be dispatched
}
```

#### Pseudocode

```text
fn check_leaky_bucket_queue(key, now) -> Decision:
    bucket = state.get_or_insert(key)
    # 1. Drop queue entries that have already been dispatched (logical drain).
    #    In practice the drainer runs in background; here we advance the cursor.
    if now >= bucket.next_drain_at:
        # Pop everything whose dispatch time has passed.
        while not bucket.queue.is_empty() and bucket.queue.front().dispatch_at <= now:
            bucket.queue.pop_front()
    # 2. If queue full, deny.
    if bucket.queue.len() >= C:
        return Deny { retry_after = bucket.queue.front().dispatch_at - now }
    # 3. Enqueue with computed dispatch_at.
    dispatch_at = max(now, bucket.next_drain_at)
    bucket.queue.push_back({ dispatch_at })
    bucket.next_drain_at = dispatch_at + 1.0 / r
    return Allow { will_dispatch_at = dispatch_at }
```

#### Complexity

- **Time:** O(1) amortized per request (one push; one pop per drain interval).
- **Space:** O(C) per key — the queue holds up to `C` pending requests.

#### Fairness

**Very high (FIFO).** Requests are served in arrival order. A burst at `t=0` queues up to `C` requests and they are dispatched one per `1/r` seconds. A late-arriving request from a different client cannot jump the queue.

#### Burst behavior

**Zero.** Output is exactly `r` requests/second, constant, regardless of input rate. This is the defining property.

#### When to use

- **Strict traffic shaping** to a downstream with a fixed-rate SLA (database connection pool, payment processor with `N req/sec` SLA, hardware sensor with fixed polling rate).
- **Load shedding with predictable latency** — by queueing with a known depth, you convert bursty input into smooth output and your downstream never sees spikes.
- **Real-time / streaming** paths where variable output rate would cause jitter (audio/video pipelines, control systems).

#### When **not** to use

- Clients cannot tolerate `1/r`-second dispatch latency for queued requests (use token bucket — fail fast instead of queueing).
- Multi-tenant fairness isn't needed and you want to allow bursts (token bucket is simpler).

---

## 6. Side-by-side comparison

| Dimension | Fixed Window | Sliding Window Log | Sliding Window Counter | Token Bucket | Leaky Bucket (Queue) |
|---|---|---|---|---|---|
| **Time complexity (per req)** | O(1) | O(1) amortized | O(1) | O(1) | O(1) amortized |
| **Space complexity (per key)** | O(1) | O(L) | O(1) | O(1) | O(C) |
| **Fairness** | Poor (2× boundary burst) | Exact | Approx (≤ L/2 error) | Medium (rewards pacing) | High (FIFO) |
| **Burst tolerance** | Up to 2×L at boundary | Zero | ≤ 1.5×L near boundary | Up to C (configurable) | Zero (strict rate) |
| **Output rate** | Variable (0 to 2L in 2ε) | Variable, bounded by L/W | Variable, bounded by L/W | Variable (0 to C then r) | Constant at r |
| **Memory at scale (10M keys, L=1000)** | ~80 MB | ~80 GB ❌ | ~80 MB | ~160 MB | ~800 MB (if C=100) |
| **Distributed atomicity** | `INCR`+`EXPIRE` (trivial) | Complex (sorted set, or Lua script) | `INCR`×2 + window read | Float math in Lua / ZADD | Sorted set + ZREMRANGEBYSCORE |
| **Famous users** | GitHub API (per-hour), most simple Redis limiters | Auth0, login throttles | Cloudflare, Stripe | AWS API Gateway, Kong, Envoy | NGINX `limit_req`, traffic shapers |
| **Suitable default for fleet** | ❌ (boundary exploit) | ⚠️ (memory-heavy at scale) | ✅ (best accuracy/memory balance) | ✅ (most popular, O(1)) | ⚠️ (only when strict shaping needed) |

### Decision flowchart

```
Need strict constant output rate (no burst at all)?
  YES → Leaky Bucket (queue)
  NO  ↓

Memory budget per key is < 100 bytes?
  YES (most production cases)
    ↓
    Allow some burst for idle clients (typical API use case)?
      YES → Token Bucket (default fleet choice)
      NO  ↓
    Need exact "≤ L req in any W-second window"?
      YES → Sliding Window Counter (if error tolerance ≤ L/2 is OK)
           → Sliding Window Log (if exact is required and L is small)
      NO  ↓
  NO (L is small, e.g., ≤ 100)
    → Sliding Window Log
Need trivially-distributed (Redis INCR)?
  YES → Fixed Window (only for coarse daily/monthly quotas)
```

---

## 7. Distributed / Redis-backed implementation notes

For the Phenotype fleet, `pheno-ratelimit` should ship with a `Local` backend (in-memory, single-process) and a `Distributed` backend (Redis, multi-instance).

### Per-algorithm atomicity

| Algorithm | Redis primitive | Notes |
|---|---|---|
| Fixed Window | `INCR` + `EXPIRE` | Atomic; the canonical 2-command pattern. Race window between `INCR` and `EXPIRE` is closed by Lua script or `SET key 0 EX W NX` first. |
| Sliding Window Log | Sorted set `ZADD key now now` + `ZREMRANGEBYSCORE key 0 (now-W)` + `ZCARD key` | 3 commands, wrapped in `MULTI/EXEC` or a Lua script for atomicity. Memory cost per key is O(L) — fine for small L. |
| Sliding Window Counter | `INCR` per window + `GET` previous + arithmetic in Lua | 2 keys per `(key, window)` pair. The arithmetic lives in Lua for atomicity. Cloudflare's open-source implementation is a good reference. |
| Token Bucket | Hash `HMSET key tokens last_refill`, `HGETALL`, compute, `HMSET` back — all in Lua | Float math in Lua is awkward but works. Alternative: store `tokens` as integer microtokens (× 10^6) to keep arithmetic integer. |
| Leaky Bucket (queue) | Sorted set `ZADD key dispatch_at request_id` + `ZREMRANGEBYSCORE key 0 now` + `ZCARD key` | Same primitives as sliding-window-log; just keyed on `dispatch_at` instead of admission time. |

### Cluster-mode caveats

- Redis Cluster hashes keys to slots; all `key`-state must live on the same slot. Use `{key}`-style hash tags if you co-locate state.
- For token bucket, the `last_refill` timestamp must be on the same key as `tokens` (same Lua script) — never split.
- Sliding-window-log with high L across many keys can blow up Redis memory; budget for it in cluster capacity planning.

### Recommended fleet default

**Token bucket** for `pheno-ratelimit` (per side-23). Rationale:
- O(1) memory per key, the most efficient at fleet scale.
- O(1) time per request, no Lua arithmetic.
- Configurable burst matches how real API clients behave (humans + batch jobs).
- The same crate can implement leaky-bucket-queue by replacing the per-request math; offer as opt-in `RateLimitAlgorithm::LeakyBucketQueue` enum variant.

---

## 8. Concrete recommendations for the Phenotype fleet

| Workload | Recommended algorithm | Why |
|---|---|---|
| **Webhook ingestion** (side-23: payment-core, hub, notify, forms) | **Token bucket** | Bursty legit retries from Stripe/GitHub match token-bucket's "burst then pace" semantics. Per-source buckets sized per the side-23 table. |
| **Public REST API** (`/v1/*` endpoints) | **Sliding window counter** | High key cardinality (every customer/API key); exact accuracy is preferred but L=1000/min makes log variant too memory-heavy. Counter variant hits the sweet spot. |
| **Login / MFA / password reset** | **Sliding window log** | Low key cardinality (humans only); exact enforcement matters for anti-abuse; L is small (5-10/min). O(L) memory is negligible. |
| **Outbound calls to a fixed-rate upstream** (payment processor with N req/sec SLA) | **Leaky bucket (queue)** | Strict constant output rate prevents SLA breach. The upstream never sees a spike. |
| **Per-IP HTTP connection cap** (NGINX-style) | **Token bucket** or **leaky bucket (meter)** | Configurable burst lets browsers open parallel connections without throttling; long-term rate protects the server. |
| **Daily / monthly billing quota** | **Fixed window** | Coarse-grained, where the boundary exploit doesn't matter and the simplest Redis `INCR+EXPIRE` is desirable. |

### `pheno-port-adapter` `RateLimitPort` trait shape

```rust
// pseudocode only — no code changes this turn
pub trait RateLimitPort: Send + Sync {
    async fn check(&self, key: &BucketKey, cost: u32) -> Result<Decision, RateLimitError>;
}

pub enum Decision {
    Allow,
    Deny { retry_after: Duration },
}

pub enum RateLimitAlgorithm {
    FixedWindow { window: Duration, limit: u32 },
    SlidingWindowLog { window: Duration, limit: u32 },
    SlidingWindowCounter { window: Duration, limit: u32 },
    TokenBucket { capacity: u32, refill_rate: f64 },         // tokens / second
    LeakyBucketQueue { capacity: u32, drain_rate: f64 },    // requests / second
}
```

Each algorithm is a separate impl. Services pick at construction time. Per-algorithm tests in `pheno-ratelimit/tests/`. Coverage gate 80% (lib per ADR-040).

---

## 9. Reference implementations and prior art

- **Stripe**: sliding window + token bucket hybrid; see [Stripe blog — Scaling your API rate limits](https://stripe.com/blog/rate-limiters) (2017).
- **Cloudflare**: sliding window counter; see [Cloudflare blog — Analyzing a Facebook session leak](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/) (and the original 2015 post). Open-sourced as `cloudflare/cf-workers-sliding-window`.
- **NGINX** `limit_req`: leaky bucket (queue variant). See [NGINX docs](https://nginx.org/en/docs/http/ngx_http_limit_req_module.html).
- **AWS API Gateway**: token bucket. Documented in the API Gateway throttling docs.
- **Envoy**: token bucket (`local_ratelimit` and `ratelimit` filters).
- **Kong**: token bucket (default), sliding window (legacy).
- **Redis** [`redis_rate`](https://github.com/brandur/redis-rate) Rust crate: token bucket (leaky-bucket-meter variant), atomic Lua, well-tested.
- **RFC 3290** (telecom): the formal leaky bucket + token bucket spec used in ATM networks. The clearest formal treatment of the two algorithms and their equivalence.
- **GCRA** (Generic Cell Rate Algorithm): a less-known 5th algorithm equivalent to a virtual-scheduling token bucket; used in some LTE/satellite stacks. Worth knowing about but out of scope for the initial 4-algorithm comparison.

---

## 10. Open questions / follow-ups

- **Q1.** For side-23 webhook middleware, should `pheno-ratelimit` expose per-source overrides at runtime (hot-reload from Configra) or require restart? Hot-reload requires the rate-limit map to be `Arc<RwLock<...>>`; minor cost.
- **Q2.** Sliding window counter error bound (≤ L/2) — is this acceptable for billing? If not, sliding-window-log with bounded memory (e.g., sample-and-decimate for L > 1000) is a possible hybrid.
- **Q3.** Should `pheno-ratelimit` ship a `Local` backend only initially and add `Distributed` (Redis) in a follow-up? `Local` is faster to ship and dogfoodable in single-process services first.
- **Q4.** Per-key TTL / eviction policy for the in-memory backend. LRU with max entries? TTL on `last_seen + window`? Needs a design pass.

These flow into the `pheno-ratelimit` crate design doc (not yet written — out of scope for this read-only research).

---

## 11. Summary

- **Fixed window**: simplest, worst fairness (2× boundary burst). Only for coarse-grained quotas.
- **Sliding window log**: exact, memory-heavy. For anti-abuse on low-cardinality, small-L keys.
- **Sliding window counter**: best balance of accuracy and memory. Cloudflare / Stripe default.
- **Token bucket**: O(1) memory, configurable burst, most popular in API gateways. **Fleet default recommendation.**
- **Leaky bucket queue**: constant output rate, FIFO. For strict downstream shaping.
- **Leaky bucket meter**: math-equivalent to token bucket; same use cases.

For `pheno-ratelimit`: **token bucket as default**, with the other four exposed as algorithm enum variants so services can choose per workload. Per-workload recommendations in §8.

Refs: `findings/2026-06-20-GUARD-side-23-ratelimit-webhooks.md`, ADR-031 (Configra), ADR-040 (test coverage gates), ADR-046 (federation mTLS).
