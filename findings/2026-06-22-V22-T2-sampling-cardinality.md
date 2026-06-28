# V22-T2 — Sampling Policies + Cardinality Cap (L26)

**Date:** 2026-06-22
**Cycle:** 12 (P1 reduction round 3, per `plans/2026-06-22-v22-71-pillar-cycle-12-p1.md`)
**Pillar:** L26 (Sampling + Cardinality)
**Branch:** `feat/v22-l26-tracing-2026-06-22` (commit `7a531fa`, **NOT PUSHED**)
**Repo:** `KooshaPari/pheno-tracing`
**Diff:** `+1749 / -2` across 5 files (`src/sampling.rs`, `src/cardinality.rs`, `src/lib.rs`, `tests/sampling_cardinality_test.rs`, `README.md`)

---

## TL;DR

Three new sampling strategies and one cardinality-cap middleware
ship on top of the v12 sampling-policy port. The substrate now
exposes:

- **Head-based**: `AlwaysSampler`, `NeverSampler`, `ProbabilisticSampler` (= `TraceIdRatioBased`), `ParentBasedSampler`, `RateLimitedSampler` (new, hybrid), `RateLimitSampler` (legacy token-bucket).
- **Tail-based**: `TailSampler` (new, rule-list) and `TailBasedSampler` (legacy sliding-window).
- **Cardinality**: `CardinalityCap` with `process(&mut HashMap<String, String>) -> CardinalityReport`.

All 66 tests pass (41 lib unit + 25 integration incl. 9 new in
`tests/sampling_cardinality_test.rs`). Hash distribution verified
empirically: splitmix64 finalizer over an FNV-1a-folded seed
produces a uniform `[0, 1)` distribution on sequential trace_ids
(FNV-1a alone does not — see § 4).

---

## 1. API design

### 1.1 Sampling port

The `Sampler` trait (introduced v12-04) gets one new method:

```rust
fn should_sample_with_attrs(
    &self,
    trace_id: &str,
    name: &str,
    attrs: &std::collections::HashMap<String, String>,
) -> SamplingDecision;
```

Default implementation builds a root `SpanContext` from
`trace_id` and delegates to `should_sample`; tail samplers
override to consult `name`/`attrs` at decision time.

This is the spec-mandated 3-argument form
`ShouldSample(trace_id, name, attrs) -> Decision`.

### 1.2 ProbabilisticSampler

```rust
pub struct TraceIdRatioBased { rate: f64 }  // canonical OTel-spec name
pub type ProbabilisticSampler = TraceIdRatioBased;  // readable alias

impl ProbabilisticSampler {
    pub fn new(rate: f64) -> Self;  // rate.clamp(0.0, 1.0)
    pub fn rate(&self) -> f64;
}
```

**Decision rule:** FNV-1a-folded `trace_id`, finalized with
splitmix64 (Stafford variant 13), normalized to `[0.0, 1.0)`;
record iff `normalized < rate`.

**Why splitmix64 instead of pure FNV-1a:** FNV-1a on sequential
inputs (e.g. `trace-000000`, `trace-000001`, …) produces clustered
hashes — consecutive hashes differ by exactly the FNV prime
(`0x00000100000001b3`), and the high bits do not avalanche well.
Verified empirically: 1024 sequential `trace-NNNNNN` IDs with
FNV-1a produced 0/1024 hashes in the bottom 10% of `u64` (all
clustered around `0.65 * u64::MAX`). Switching to
splitmix64-finalized hashes produced a uniform distribution:
`100/1024` hashes in the bottom 10% on the same inputs.

### 1.3 RateLimitedSampler

```rust
pub struct RateLimitedSampler {
    parent_rate: f64,    // probabilistic gate, [0.0, 1.0]
    max_per_sec: f64,    // token-bucket refill rate, > 0
    bucket: Mutex<TokenState>,
}

impl RateLimitedSampler {
    pub fn new(parent_rate: f64, max_per_sec: f64) -> Self;
    pub fn parent_rate(&self) -> f64;
    pub fn max_per_sec(&self) -> f64;
}
```

**Two-stage decision:**
1. **Probabilistic gate:** `TraceIdRatioBased::new(parent_rate).should_sample(ctx) == Record` → continue, else drop.
2. **Token-bucket cap:** refill proportional to elapsed time, try to consume 1 token; record if consumed, drop otherwise.

The hybrid gives the best of both: the gate spreads load across
trace_ids (so one trace_id can't saturate the bucket); the bucket
enforces a hard ceiling (so a probabilistic spike can't overshoot
the back-end's ingestion rate).

### 1.4 TailSampler (rule-list)

```rust
pub struct TailSamplingRule {
    name: String,
    predicate: Box<dyn Fn(&str, &str, &HashMap<String, String>) -> bool + Send + Sync>,
}

impl TailSamplingRule {
    pub fn errors() -> Self;
    pub fn slow(threshold_ms: u64) -> Self;
    pub fn named(pattern: &str) -> Self;  // glob match on span name
    pub fn custom(name: &str, pred: impl Fn(...) -> bool + Send + Sync) -> Self;
}

pub struct TailSampler {
    rules: Vec<TailSamplingRule>,
    marked: Mutex<HashSet<String>>,  // trace_ids that have been marked Record
}

impl TailSampler {
    pub fn new(rules: Vec<TailSamplingRule>) -> Self;
    pub fn rules(&self) -> &[TailSamplingRule];
    pub fn mark(&self, trace_id: &str, name: &str, attrs: &HashMap<String, String>);
    pub fn decision(&self, trace_id: &str) -> SamplingDecision;
}
```

**Decision rule:** `decision(trace_id)` returns `Record` iff at
least one rule's predicate has matched a previous
`mark(trace_id, name, attrs)` call for that trace_id. Otherwise
`Drop`. Rules compose with logical OR.

### 1.5 CardinalityCap

```rust
pub struct CardinalityCap {
    cap: usize,
    overflow_marker: String,
    seen: Mutex<HashMap<String, HashSet<String>>>,
}

pub const DEFAULT_CAP: usize = 100;
pub const DEFAULT_OVERFLOW_MARKER: &str = "__other__";

pub struct CardinalityReport {
    pub inspected: usize,
    pub kept: usize,
    pub overflowed: usize,
}

impl CardinalityCap {
    pub fn new(max_unique_per_attr: usize) -> Self;
    pub fn with_default() -> Self;  // = Self::new(DEFAULT_CAP)
    pub fn with_overflow_marker(cap: usize, marker: String) -> Self;
    pub fn cap(&self) -> usize;
    pub fn overflow_marker(&self) -> &str;
    pub fn process(&self, attrs: &mut HashMap<String, String>) -> CardinalityReport;
    pub fn reset(&self);  // clear seen-set
    pub fn seen_value_count(&self, name: &str) -> usize;
    pub fn seen_name_count(&self) -> usize;
}
```

**Algorithm:** For each `(name, value)` in `attrs`:

1. Look up `name` in the seen registry. If absent, insert `name → {value}` and pass `value` through.
2. If `name` is present and `value` is in the seen-set: pass through verbatim (idempotent).
3. If `name` is present and the seen-set is below the cap: insert `value` and pass through verbatim.
4. Otherwise: replace `value` in `attrs` with the overflow marker. The seen-set is NOT updated.

**Hash-bucket memory bound:** the seen-set is
`HashMap<name, HashSet<value>>`. Each bucket is independently
bounded by `cap`; once full, the bucket size stays at `cap` and
additional distinct values are discarded. Total memory is
`O(num_attribute_names * cap)`. For the default `cap = 100` and a
typical service with 50 attribute names, the cap uses ~50 KB of
stable state.

---

## 2. Test results

### 2.1 Test suite summary

```
running 41 tests   ← lib unit (sampling + cardinality + adapters + port + tracing)
test result: ok. 41 passed; 0 failed

running 3 tests    ← legacy sampling_port / card tests
test result: ok. 3 passed; 0 failed

running 4 tests    ← adapters / port
test result: ok. 4 passed; 0 failed

running 9 tests    ← tests/sampling_cardinality_test.rs (NEW, v22-T2)
test result: ok. 9 passed; 0 failed

running 8 tests    ← tests/sampling_port.rs
test result: ok. 8 passed; 0 failed

running 1 test     ← doc-tests
test result: ok. 1 passed; 0 failed
```

**Total: 66 tests pass, 0 fail.**

### 2.2 The 9 new integration tests

| # | Test | What it verifies |
|---|------|------------------|
| 1 | `probabilistic_sampler_records_at_configured_rate` | 1024 sweep at rate 0.10; observed rate within ±0.03 of expected. |
| 2 | `rate_limited_sampler_caps_at_max_per_sec` | parent_rate=1.0, max_per_sec=50; 500 calls record ≈50 (±20% tolerance). |
| 3 | `rate_limited_sampler_probabilistic_gate_drops_outside_window` | parent_rate=0.0; 2000 calls all return `Drop`. |
| 4 | `cardinality_cap_evicts_to_overflow_marker` | 4 phases: fill to CAP=3, idempotent re-submit, overflow, recheck seen-set stays at 3. |
| 5 | `cardinality_cap_default_is_one_hundred` | `CardinalityCap::default().cap() == 100`. |
| 6 | `tail_sampler_rule_match_records_trace` | Mark a trace with `TailSamplingRule::errors()`, verify `decision(trace_id) == Record`. |
| 7 | `tail_sampler_multi_rule_composition` | 3 rules (errors, slow, named) — any match records. |
| 8 | `tail_sampler_three_arg_method_consults_rules` | `should_sample_with_attrs` overrides `should_sample` for tail samplers. |
| 9 | `should_sample_with_attrs_matches_should_sample_for_probabilistic` | Default `should_sample_with_attrs` impl matches `should_sample` for non-tail samplers. |

### 2.3 Hash distribution verification

```
FNV-1a alone:     1024 sequential trace_ids → 0/1024 hashes in bottom 10%
splitmix64 final: 1024 sequential trace_ids → 100/1024 hashes in bottom 10%
```

The splitmix64 finalizer (Stafford variant 13) is mandatory for
the probabilistic sampler; FNV-1a is kept as the seed mixer
because it's cheap and stable.

### 2.4 Test isolation caveat (HashMap design)

The original lib tests for `CardinalityCap` used
`HashMap<String, String>` with duplicate keys (e.g.
`iter::map(|i| ("user_id", format!("user-{i}"))).collect()`). A
HashMap deduplicates keys, so all such tests collapsed to 1 entry
instead of N. Rewrote all 5 lib tests + the integration test to
call `process()` once per value (each call carries a one-entry
HashMap). This matches the production usage pattern (each span
attribute map carries at most one value per attribute name) and
removes the false-positive "kept=1" results.

---

## 3. Sampling-strategy recommendations

The substrate now offers 6 head-based and 2 tail-based strategies.
The right choice depends on the service's traffic shape and the
back-end's ingestion budget. The decision tree below is the
recommendation for fleet-wide adoption.

### 3.1 Decision tree

```
START ─ Is the back-end ingestion budget fixed and known?
  │
  ├─ YES ─ Is there a high-volume trace_id (e.g. health check)
  │          that would saturate a pure token-bucket?
  │     │
  │     ├─ YES ─► RateLimitedSampler(parent_rate=0.05..0.20,
  │     │                              max_per_sec=budget/3)
  │     │         # e.g. parent_rate=0.10, max_per_sec=300/sec
  │     │
  │     └─ NO  ─► RateLimitSampler(max_per_sec=budget)
  │                # e.g. 1000/sec, no probabilistic gate
  │
  └─ NO  ─ Is the service a low-throughput consumer of trace
            analytics (e.g. < 1k spans/sec)?
       │
       ├─ YES ─► ProbabilisticSampler::new(1.0)
       │         # record everything; back-end absorbs it
       │
       └─ NO  ─► ParentBasedSampler(TraceIdRatioBased::new(0.05))
                 # honor W3C sampled bit, fall back to 5%
                 # for root spans (no upstream contract)
```

```
START ─ Is "errors-only" or "slow-only" the primary signal?
  │
  ├─ YES ─► TailSampler(rules = [errors(), slow(p99_ms)])
  │         # the rule-list form is the modern API
  │
  └─ NO  ─ Is "error rate > N% over a window" the signal?
           │
           ├─ YES ─► TailBasedSampler(window=100, threshold=0.05)
           │         # the legacy sliding-window form
           │
           └─ NO  ─ Don't tail-sample. Use head-based.
```

### 3.2 Recommended defaults per service class

| Service class                  | Head-based                | Tail-based                              |
|--------------------------------|---------------------------|-----------------------------------------|
| API gateway / edge proxy      | `ParentBasedSampler(0.05)`| `TailSampler([errors()])`              |
| Async worker / cron            | `RateLimitedSampler(0.10, 100)` | `TailSampler([errors(), slow(1000)])` |
| Health check / metrics-only    | `AlwaysOffSampler`        | n/a                                     |
| User-facing interactive        | `RateLimitedSampler(0.20, 5000)` | `TailSampler([errors(), slow(200)])` |
| Background fan-out (e.g. ETL)  | `RateLimitedSampler(0.01, 50)` | `TailSampler([errors()])`             |
| Local-dev / debug              | `AlwaysSampler`           | n/a                                     |

### 3.3 Cardinality cap

**Recommended default:** `CardinalityCap::with_default()` (cap=100, marker=`__other__`) for all services. The cost is
negligible (~50 KB for 50 attribute names) and the protection
against accidental high-cardinality attribute keys (user_id,
request_id, etc.) is critical for back-end cost control.

**When to raise:** if the fleet-wide metric for "X values were
evicted to `__other__`" is non-zero for a known-good attribute
(e.g. user_id has 200 distinct values in a multi-tenant service),
raise the cap to 256 or 512. **When NOT to change:** do not switch
to LRU eviction — the first-N-wins policy is deterministic and
reproducible across deployments; LRU gives different winners per
process and is harder to reason about operationally.

---

## 4. Hash function: splitmix64 finalizer

The splitmix64 finalizer is the standard "avalanche" mixer used
by xoroshiro and other PRNGs. It spreads entropy evenly across
all 64 bits even for sequential inputs (which FNV-1a alone does
not). Implementation:

```rust
fn splitmix64_hash(bytes: &[u8]) -> u64 {
    // Seed: FNV-1a fold of the input bytes.
    let mut seed: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in bytes {
        seed ^= *byte as u64;
        seed = seed.wrapping_mul(0x0000_0100_0000_01b3);
    }
    // Stafford variant 13 finalizer.
    let mut z = seed.wrapping_add(0x9e37_79b9_7f4a_7c15);
    z = (z ^ (z >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
    z ^ (z >> 31)
}
```

Reference: <https://prng.di.unimi.it/splitmix64.c>

The splitmix64 finalizer is the only place where a non-cryptographic
hash is acceptable for sampling — sampling is not a security
boundary; collisions are fine (they just mean a few extra traces
are recorded). If cryptographic guarantees are needed (e.g. for
rate-limit evasion resistance), replace the finalizer with a keyed
SipHash or HMAC-SHA256 (both would require consumer coordination).

---

## 5. Tradeoffs (full table)

The README's Sampling and Cardinality sections contain the
single-page reference tables. The full tradeoff catalog:

### 5.1 Sampling strategy tradeoffs

| Strategy              | Memory | CPU | Correctness | Coordination   | Backpressure |
|-----------------------|--------|-----|-------------|----------------|--------------|
| AlwaysSampler         | O(1)   | O(1)| exact       | none           | none         |
| NeverSampler          | O(1)   | O(1)| exact       | none           | none         |
| ProbabilisticSampler  | O(1)   | O(1)| probabilistic | none        | none         |
| ParentBasedSampler    | O(1)   | O(1)| exact       | W3C sampled bit | none         |
| RateLimitSampler      | O(1)   | O(1)| statistical | none           | hard ceiling |
| RateLimitedSampler    | O(1)   | O(1)| statistical | none           | hard ceiling + load-spreading |
| TailBasedSampler      | O(W)   | O(1)| exact       | window state   | none         |
| TailSampler           | O(K)   | O(R)| exact       | rule list      | none         |

W = sliding window size; K = unique trace_ids ever marked;
R = number of rules.

### 5.2 Cardinality tradeoffs

| Aspect              | First-N-wins (this impl) | LRU eviction       | Fleet-wide cap    |
|---------------------|--------------------------|--------------------|-------------------|
| Determinism         | yes                      | no                 | yes (with coord)  |
| Memory bound        | O(names × cap)           | O(names × cap)     | O(global_cap)     |
| Coordination        | none                     | none               | coordinator svc   |
| Operational clarity | winners visible in logs  | winners hidden     | winners in dashboards |
| Cost                | 0                        | 0                  | high              |

### 5.3 Hash function tradeoffs

| Hash                | Speed       | Avalanche on sequential inputs | Used by                       |
|---------------------|-------------|--------------------------------|-------------------------------|
| FNV-1a              | very fast   | poor (clustered)               | seed mixer (this impl)        |
| splitmix64          | fast        | excellent                      | finalizer (this impl)         |
| SipHash-1-3         | fast        | excellent                      | Rust's `DefaultHasher`        |
| xxHash64            | very fast   | excellent                      | not yet adopted               |
| HMAC-SHA256         | slow        | excellent + keyed              | over-engineered for sampling  |

---

## 6. Files changed

```
README.md                           | 154 ++++++++++++++++  (Sampling + Cardinality sections)
src/lib.rs                          |  12 +-        (re-exports + cardinality module)
src/sampling.rs                     | 541 +++++++++++ (TraceIdRatioBased, RateLimitedSampler,
                                                  TailSampler, TailSamplingRule, 3-arg method)
src/cardinality.rs                  | 520 ++++++++  (new module, full impl + tests)
tests/sampling_cardinality_test.rs  | 524 +++++++   (new integration test file)
```

5 files changed, 1749 insertions, 2 deletions.

### Re-exports from `pheno_tracing::*`

```rust
// sampling
pub use sampling::{
    AlwaysSampler, NeverSampler, ParentBasedSampler, ProbabilisticSampler, RateLimitSampler,
    RateLimitedSampler, Sampler, SamplingDecision, SpanContext, TailBasedSampler, TailSampler,
    TailSamplingRule, TraceIdRatioBased,
};

// cardinality
pub use cardinality::{
    CardinalityCap, CardinalityReport, DEFAULT_CAP as DEFAULT_CARDINALITY_CAP,
    DEFAULT_OVERFLOW_MARKER,
};
```

---

## 7. Outstanding follow-ups

- **`drain()` and `marked_count()` helpers** in `RateLimitedSampler` / `TailSampler` are dead-code (warned in the build). Either delete or expose for production telemetry. Recommendation: delete (callers can use the existing fields). Not blocking.
- **Cargo workspace `.cargo/config.toml` bug** — the parent monorepo config has invalid `package."pheno-*"` / `package."phenotype-*"` wildcards that fail under cargo 1.95.0. This is unrelated to v22-T2 work but blocks `cargo check --lib` in the parent tree. Tracked as a side-task; verification used an isolated `/tmp/pheno-tracing-isolated` copy with a `pheno-otel` stub.
- **`pact-consumer` pre-existing path-dep** in `pheno-tracing/Cargo.toml` (added in v20 cycle-10) — was bypassing the workspace via a non-existent directory. Not exercised by v22-T2 tests; left as-is for v22-T5.
- **Probabilistic sampler is non-thread-safe across `trace_id` collisions** — by design. If two replicas hash the same `trace_id` to the same decision, both record or both drop; the W3C sampled bit is the only way to coordinate. Documented in the README.
- **`TailSamplingRule::named` uses `glob::Pattern` semantics** — confirmed via the doc string. If consumers need regex, they should use `custom()` with a regex predicate (out of scope; no regex dep wanted in substrate).

---

## 8. Cross-references

- v22 plan: `plans/2026-06-22-v22-71-pillar-cycle-12-p1.md`
- L26 acceptance: `findings/71-pillar-2026-06-17-schema.md` (pillar L26)
- ADR-024 (71-pillar framework): `docs/adr/2026-06-17/ADR-024-71-pillar-audit-framework.md`
- ADR-040 (test coverage gates per tier): `docs/adr/2026-06-18/ADR-040-test-coverage-gates-per-tier.md`
- ADR-042B (substrate quality bar): `docs/adr/2026-06-18/ADR-042-substrate-quality-bar.md`
- ADR-036B (pheno-tracing canonical): `docs/adr/2026-06-18/ADR-036-pheno-tracing-substrate-canonical.md`
- Prior sampling-port work (v12-04): commit `22489d1` on `pheno-tracing`
- Hash distribution source: <https://prng.di.unimi.it/splitmix64.c>
- OTel-spec probabilistic sampling: <https://opentelemetry.io/docs/specs/otel/trace/tracestate-probability-sampling/>
