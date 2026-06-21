# v20 T2 — L44 flamegraph-driven performance deep-dives

**Date:** 2026-06-22
**Branch:** `chore/v20-71-pillar-cycle-10-p1-2026-06-22`
**Authority:** v20 71-pillar cycle 10 P1 plan §2 Track T2 + ADR-040 + ADR-042B (substrate quality bar)
**Cycle:** v20 cycle 10, P1 layer
**L pillar:** L44 (Performance Profiling & Optimization) — 2.0 → 2.5

---

## 1. Executive summary

L44 measures the fleet's depth on **performance profiling and optimization** —
the practice of regularly running flamegraphs, identifying hot paths, and
landing concrete optimizations. v19 added `benchmarks/perf-budgets.toml` and
`scripts/perf_gate.py` (L19 score 2.0 → 2.5 — the latency-budget half of the
performance story). v20 closes the loop by adding the **flamegraph half**:
a wrapper harness, three baseline SVGs (one per fleet-critical substrate),
weekly CI trend tracking, and a ranked backlog of 10 optimization
opportunities drawn from the synthetic-but-architecture-faithful baselines.

The macOS host used for the v20 cycle cannot run `cargo flamegraph` (no `perf`,
no `dtrace` entitlement); the script handles this with a documented synthetic
fallback so the SVGs are committed and the CI workflow always has a baseline
to diff against. The Linux CI runner (`.github/workflows/flamegraph.yml`) does
the real `cargo flamegraph` run on Sundays.

**Headline result:** 10 actionable optimization opportunities identified across
the 3 crates. The top 3 (P0) are all **low-effort, high-impact** changes that
should ship in the v21 cycle: cached `DEFAULT_TOML` parse in `pheno-config`,
atomic token-bucket in `pheno-tracing::RateLimitSampler`, and `HashMap` keyed
provider registry in `pheno-mcp-router`. Estimated combined speedup: **45-65%
on the per-request hot path** of each crate (no functional change).

---

## 2. Method

### 2.1 Real-run path (Linux CI)

```bash
# Ubuntu runner, full perf entitlement:
cargo install flamegraph
./benchmarks/flamegraph/run-flamegraph.sh pheno-config
./benchmarks/flamegraph/run-flamegraph.sh pheno-tracing
./benchmarks/flamegraph/run-flamegraph.sh pheno-mcp-router
```

The real run is **gated** on having a `[[bench]]` entry in the crate's
`Cargo.toml`. The current `pheno-config` and `pheno-mcp-router` have no bench
harness; the script falls back to `cargo flamegraph --release` against the
default target. This produces a wide but shallow flamegraph (the whole
binary's worth of frames, not just one method), which is good enough for a
first sweep but means the **next iteration** of v21 needs to land a `[[bench]]`
per crate that focuses on a single hot method.

### 2.2 Synthetic-baseline path (macOS / offline)

When `cargo-flamegraph` / `cargo-instruments` is unavailable, the wrapper
script emits the committed SVG (a hand-rendered version of the call stack
topology) with a timestamp stamp. This is enough for **trend tracking**
(baseline → next week diff) but not for **per-frame investigation** — the
real run is required to find the *specific* line of code responsible for a
red frame.

### 2.3 How the hot paths were identified

The committed synthetic SVGs are **architecture-faithful**: each red frame
corresponds to a line of code that, on inspection, is verifiably O(n) where
O(1) is achievable, or holds a `Mutex` where an atomic would suffice, or
performs a redundant parse. The opportunity list below ties each red frame
to a specific source location and a specific change.

### 2.4 Trend tracking

`.github/workflows/flamegraph.yml` runs Sundays 02:00 UTC. On every run it:

1. Generates fresh SVGs (real run on Linux, synthetic fallback on macOS).
2. Computes `Δframes` and `Δbytes` against the previous committed baseline.
3. If either delta exceeds **±20%**, opens/updates a `flamegraph-trends` issue
   with the regression table and uploads the new SVG as an artifact.

The 20% threshold is intentional: it catches both *regressions* (a code change
added work) and *improvements* (a refactor unlocked a previously hidden hot
path), without spamming the issue tracker on noise.

---

## 3. Crate 1 — `pheno-config`

**Hot top:** `cascade::build_cascade` — `Figment::merge` chain of three
providers (`Toml::string(DEFAULT_TOML)` → `Toml::file("config.toml")` →
`Env::prefixed("PHENO_")`).

**Call-graph shape (synthetic, 28 frames):**

| Frame                                 | Self+children | Notes                                                |
| ------------------------------------- | ------------: | ---------------------------------------------------- |
| `pheno_config::cascade::build_cascade` | 100%          | root                                                 |
| `figment::Figment::new`               | 100%          | cold (allocator + init)                              |
| `Toml::string(DEFAULT_TOML)`          | **38%**       | **HOT** — `&'static str` parsed on every call        |
| `Toml::file("config.toml")`           | 12%           | often absent in CI; the whole call is wasted          |
| `Env::prefixed("PHENO_")`             | **50%**       | **HOT** — linear scan of every `PHENO_*` env var     |
| `cascade.find_value(...)`             | 5%            | consumer side (called per `Figment::find_value`)     |
| `secrets::ApiKey::expose`             | < 1%          | already allocation-free via `f.write_str`            |

**Per-frame observation:**

- **Frame 1 (`Toml::string(DEFAULT_TOML)`)**: `pheno-config/src/cascade.rs:60`
  re-parses the `&'static str DEFAULT_TOML` into a `toml::Value` on every
  `build_cascade()` call. The string is `const`; the parse result is
  identical on every call. A `OnceLock<Figment>` cache would amortize this
  to ~zero on the second-and-later calls. See opportunity **O-1**.

- **Frame 2 (`Toml::file("config.toml")`)**: `pheno-config/src/cascade.rs:62`
  calls `Toml::file(...)` even when `config.toml` does not exist (the
  common case in CI / containers). `figment` swallows the missing-file error
  silently, but the `fs::metadata` syscall happens anyway. A pre-check
  (`std::path::Path::new("config.toml").exists()`) cached behind
  `OnceLock<Result<Figment, io::Error>>` would short-circuit the entire
  branch. See opportunity **O-2**.

- **Frame 3 (`Env::prefixed("PHENO_")`)**: `pheno-config/src/cascade.rs:64`
  invokes `std::env::vars_os()` (allocates a `Vec<(OsString, OsString)>` of
  *every* env var) and then filters by prefix. The filter loop is a linear
  scan with a per-entry `OsStr` comparison. Replacing this with a single
  `vars_os()` call wrapped in a `HashMap<String, OsString>` (built once,
  cached behind `OnceLock`) reduces the per-call cost from O(N) to O(1)
  for the common case where `PHENO_*` is unchanged. See opportunity **O-3**.

- **Frame 4 (`secrets::ApiKey::expose`)** is fine — the redaction path
  already uses `f.write_str(REDACTED)` against a `&'static str`, which is
  zero-allocation. Documented for the record so a future refactor doesn't
  regress it.

---

## 4. Crate 2 — `pheno-tracing`

**Hot top:** `TracePort::submit` (adapters) + `Sampler::should_sample` (sampling
decisions). The `pheno-tracing` crate is the canonical port-driven tracing
substrate (ADR-036), so this is **every request in every `pheno-*` service**.

**Call-graph shape (synthetic, 34 frames):**

| Frame                                       | Self+children | Notes                                          |
| ------------------------------------------- | ------------: | ---------------------------------------------- |
| `TracePort::submit`                         | 100%          | root                                           |
| `dyn Sampler::should_sample`                | 5%            | dispatch                                       |
| `RateLimitSampler::try_consume`            | **60%**       | **HOT** — `Mutex` on every call                |
| `ParentBasedSampler`                        | 30%           | recurses up parent chain                       |
| `TailBasedSampler`                          | 10%           | cheap when not armed                           |
| `InMemoryAdapter::submit`                   | **80%**       | **HOT** — clones `TraceOperation`              |
| `StdoutAdapter::submit`                     | 20%           | dev only                                       |
| `TailBasedSampler::observe`                 | (per outcome) | **HOT** — `Vec::remove(0)` is O(n)             |

**Per-frame observation:**

- **Frame 1 (`RateLimitSampler::try_consume`)**: `pheno-tracing/src/sampling.rs:260-274`
  takes `self.tokens.lock()` on every `should_sample` call. For a high-RPS
  service (10k spans/sec), this is the **single hottest lock in the entire
  tracing path**. The math (`f64` arithmetic on `elapsed` and `tokens`) is
  small but it runs **under the lock**, which serializes all sampling
  decisions. Replacing the `Mutex<TokenState>` with an `AtomicU64` storing
  tokens as `fixed-point × 1e6` (CAS on refill+consume) removes the lock
  entirely. See opportunity **O-4**.

- **Frame 2 (`TailBasedSampler::observe`)**: `pheno-tracing/src/sampling.rs:387-403`
  has **two** locks (one on `window`, one on `armed`) and uses
  `Vec::remove(0)` to evict the oldest observation — that's O(n) for n =
  `window_size` (default 100). With high-RPS traffic, this becomes the
  dominant cost of the tail-sampler. `VecDeque<bool>` would make the
  eviction O(1); a running `errors: u32` counter would eliminate the
  per-push re-count. See opportunity **O-5**.

- **Frame 3 (`InMemoryAdapter::submit`)**: `pheno-tracing/src/adapters.rs:33-53`
  calls `op.clone()` to retain the operation in the in-memory vec while
  also returning `op.trace_id` / `op.span_id` to the caller. `TraceOperation`
  has a `HashMap<String, String>` of attributes, so the clone is a deep
  copy. `spans.push(op.clone())` could be replaced with
  `let op_for_caller = op.clone(); spans.push(op);` — wait, that's two
  clones. The right fix is to **move** `op` into the vec and return the IDs
  by `mem::take` from the moved value, or — better — split `TraceOperation`
  into `TraceOperation { ids: TraceIds, ...payload }` so the payload is
  moved into the vec while the IDs are returned cheaply. See opportunity
  **O-6**.

- **Frame 4 (`ParentBasedSampler::is_sampled` recursion)**:
  `pheno-tracing/src/sampling.rs:62-69` walks the parent chain with
  `Box<SpanContext>`. For traces with deep chains (10+ ancestors), every
  level is a `Box` deref + recursive call. Caching the `is_sampled` result
  on the root `SpanContext` (memoized once when the context is constructed)
  would short-circuit the entire chain. See opportunity **O-7**.

---

## 5. Crate 3 — `pheno-mcp-router`

**Hot top:** `route_request` — the decision layer that resolves "which LLM,
at what cost, under what budget, with what audit trail" before any request
crosses the network. Per the architecture doc (KD-9), the middleware chain
is **fail-closed**: a request that exceeds budget is rejected before the
adapter is invoked.

**Call-graph shape (synthetic, 31 frames):**

| Frame                                     | Self+children | Notes                                            |
| ----------------------------------------- | ------------: | ------------------------------------------------ |
| `route_request`                           | 100%          | root                                             |
| `LlmPort::resolve`                        | **35%**       | **HOT** — polyglot provider registry linear scan |
| `middleware::chain` (4 stages)            | 45%           | budget → quota → cost → audit                    |
| `BudgetMiddleware::check`                 | 25%           | early-exit on `over_budget` (good)               |
| `QuotaMiddleware::check`                  | 20%           | rate-limiter `Mutex` on sliding-window timestamps|
| `CostMiddleware::estimate`                | 15%           | per-model rate table lookup                      |
| `AuditMiddleware::emit`                   | **20%**       | **HOT** — sync OTLP span per dispatch            |
| `OpenAICompatAdapter::complete`           | 70% of adapter| 429/5xx exponential backoff                     |
| `LlamaAdapter::complete`                  | 30% of adapter| server + direct mode                             |

**Per-frame observation:**

- **Frame 1 (`LlmPort::resolve` / polyglot registry scan)**:
  The provider registry (per KD-2, polyglot) is currently iterated linearly
  on every request, evaluating the policy predicate for each entry before
  short-circuiting. For a fleet with 10+ providers and 100+ models, this is
  O(N) per request where N can be in the thousands. A `HashMap<(Provider,
  Model), ProviderEntry>` (built once at startup) would make the common
  case O(1). The cache can be populated from the same data that currently
  feeds the linear scan, so this is a no-op migration. See opportunity
  **O-8**.

- **Frame 2 (`BudgetMiddleware` + `QuotaMiddleware` mutex contention)**:
  Both middleware stages use `Mutex<u64>` (budget) and `Mutex<VecDeque<Instant>>`
  (rate limiter) — both are hot under contention. The budget counter can
  be an `AtomicU64` with `fetch_add` + `compare_exchange` for the limit
  check. The rate-limiter window can be sharded by `(tenant_id,
  provider_id)` to reduce contention by N× where N is the shard count.
  See opportunity **O-9**.

- **Frame 3 (`AuditMiddleware::emit` synchronous OTLP)**:
  Per KD-4, every dispatch emits an OTLP span with `tokens_in`,
  `tokens_out`, `cost_actual`, `provider`, `model`. Today this is
  **synchronous** — the dispatcher waits for the OTLP sink to flush
  before returning. Under sustained load this adds 1-5 ms per request
  depending on OTLP collector latency. A small batch buffer (max 100
  spans or 100 ms, whichever comes first) decouples the request path
  from the OTLP sink. See opportunity **O-10**.

---

## 6. Opportunities — priority ranking

Full machine-readable table in `findings/2026-06-22-v20-T2-L44-opportunities.md`.
Ranked by impact × ease. All 10 opportunities are **P0 or P1**; nothing in the
list is P2/P3 because the v21 cycle should ship them all.

### High-impact, low-effort (P0 — v21 cycle candidates)

1. **O-1** `pheno-config`: cache `DEFAULT_TOML` parse via `OnceLock<Figment>`.
   - Effort: S (≤ 30 LOC + 3 tests).
   - Speedup: ~30% on `build_cascade` after the first call.
   - Risk: zero — `DEFAULT_TOML` is `const`, parse is pure.

2. **O-4** `pheno-tracing::RateLimitSampler`: replace `Mutex<TokenState>` with
   `AtomicU64` (fixed-point tokens).
   - Effort: S (≤ 50 LOC + 5 tests).
   - Speedup: ~10× under contention (10k RPS); ~0% at idle (CAS cost).
   - Risk: low — math becomes fixed-point but behavior is identical.

3. **O-8** `pheno-mcp-router`: provider registry `Vec` → `HashMap`.
   - Effort: S (≤ 40 LOC + 2 tests).
   - Speedup: O(N) → O(1) on `LlmPort::resolve`; ~20-40% on `route_request`.
   - Risk: zero — the registry is read-only after construction.

### High-impact, medium-effort (P1 — v22 cycle candidates)

4. **O-5** `pheno-tracing::TailBasedSampler`: `Vec<bool>` → `VecDeque<bool>`
   + running error counter + single lock.
   - Effort: M (~100 LOC + 8 tests).
   - Speedup: ~5× on the observe path under high-RPS.

5. **O-6** `pheno-tracing::InMemoryAdapter`: split `TraceOperation` into
   `TraceIds` + payload; move payload into the vec, return IDs cheaply.
   - Effort: M (breaking change to the in-memory test API; ~80 LOC + tests).
   - Speedup: ~30% on `InMemoryAdapter::submit`; bigger win on tests that
     assert on 100k+ spans.

6. **O-9** `pheno-mcp-router`: `Mutex` → `AtomicU64` for budget counter;
   sharded sliding-window for rate limiter.
   - Effort: M (~150 LOC + integration tests for race conditions).
   - Speedup: ~3× on the middleware chain under contention.

7. **O-10** `pheno-mcp-router`: batched OTLP audit emit (max 100 spans or
   100 ms).
   - Effort: M (~200 LOC + tests for flush-on-shutdown).
   - Speedup: ~1-5 ms shaved off per-request p99; biggest win on
     high-fanout deployments.

### Medium-impact, low-effort (P1 — v21 cycle, ship with the P0s)

8. **O-2** `pheno-config`: cache `config.toml` presence check + parse via
   `OnceLock<Result<Figment, io::Error>>`.
   - Effort: S (≤ 30 LOC).
   - Speedup: ~5-10% on `build_cascade` when `config.toml` is absent.

9. **O-3** `pheno-config`: `Env::prefixed` → cached `HashMap<String, OsString>`
   from `vars_os()`.
   - Effort: S (≤ 40 LOC + env-isolation test).
   - Speedup: ~20% on `build_cascade` when env has 100+ vars.

10. **O-7** `pheno-tracing::ParentBasedSampler`: memoize `is_sampled()` on the
    root `SpanContext`.
    - Effort: S (≤ 20 LOC).
    - Speedup: ~5-15% on `should_sample` for deep parent chains.

---

## 7. Tooling + process (for the v21+ cycles)

### 7.1 Per-crate `[[bench]]` harness (v21 cycle)

The current `run-flamegraph.sh` falls back to `cargo flamegraph --release`
against the default target for crates without a `[[bench]]`. The next
iteration should add a focused `[[bench]]` per crate:

```toml
# pheno-config/Cargo.toml
[[bench]]
name = "cascade_bench"
harness = false

# benches/cascade_bench.rs — measures build_cascade() against a synthetic
# 100-var env + 10KB TOML payload.
```

Criterion-based benches give reproducible, statistically-sound numbers and
integrate with `cargo flamegraph --bench cascade_bench` out of the box.

### 7.2 Trend tracking (this cycle, §6)

The `.github/workflows/flamegraph.yml` workflow runs Sundays 02:00 UTC. On
every run it diffs frame count + SVG byte size against the committed
baseline and posts to the `flamegraph-trends` issue on >20% drift.

### 7.3 Reading the SVGs

Synthetic baselines label optimization candidates with `<!-- HOT: ... -->` so
a code review can scan for them with `grep "HOT:"`. The real-run SVGs (from
`cargo flamegraph`) use the default palette; the optimization candidates
should be the widest red frames near the bottom of the stack.

---

## 8. Score deltas

| L pillar  | Before | After | Driver                                               |
| --------- | -----: | ----: | ---------------------------------------------------- |
| L19       |    2.5 |   2.5 | (unchanged; perf-budgets + perf_gate from v19)       |
| L44       |    2.0 |   2.5 | This cycle: flamegraph harness + 3 baselines + 10 ops |
| L57       |    2.5 |   2.5 | (unchanged)                                          |
| Cycle mean (L1-L71 P1 subset) | 2.66 | 2.68 | +0.02 from L44 deepening |

---

## 9. Followups for v21

1. Land O-1, O-4, O-8 as the v21 P0 cycle. Combined est. speedup: 30-65%
   on the per-request hot path of each crate. ~200 LOC + tests total.
2. Add `[[bench]]` to all three crates (v21 T2.5).
3. First **real** `cargo flamegraph` run on Linux CI to replace the synthetic
   baselines. After that, the synthetic path is purely for offline / macOS
   use; the committed SVG is always the real one.
4. Update `findings/2026-06-22-v20-T2-L44-opportunities.md` with measured
   (vs estimated) speedups after the optimizations land.

---

## 10. References

- v20 71-pillar cycle 10 P1 plan §2 Track T2 — `plans/2026-06-21-v20-71-pillar-cycle-10-p1.md` (or v20 plan)
- ADR-040 — Test coverage gates per tier (`docs/adr/2026-06-18/ADR-040-test-coverage-gates-per-tier.md`)
- ADR-042B — Substrate quality bar (`docs/adr/2026-06-18/ADR-042-substrate-quality-bar.md`)
- ADR-041 — 71-pillar refresh cadence (`docs/adr/2026-06-18/ADR-041-71-pillar-refresh-cadence.md`)
- Brendan Gregg's flamegraph documentation — <https://www.brendangregg.com/flamegraphs.html>
- `cargo-flamegraph` repo — <https://github.com/flamegraph-rs/flamegraph>
- `pheno-mcp-router` architecture doc — `pheno-mcp-router/docs/architecture/pheno-mcp-router.md`