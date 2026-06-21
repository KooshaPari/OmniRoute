# phenotype-router — per-route p99 latency budgets

This document is the canonical source for **per-route p99 latency budgets**
on the `phenotype-router` decision layer (ADR-050 / ADR-051). It pairs
with the bench module (`bench/`) and the bench workflow
(`.github/workflows/bench.yml`) which gates tagged releases against these
budgets.

Per AGENTS.md §"v13 outlook" and ADR-040 (test coverage gates per tier):

> Performance benchmarks: per ADR-040 — router e2e (request → decision →
> plugin dispatch) + p95 latency under sustained load (1k RPS, 30 min soak),
> benchmark harness co-located with the spike artifacts.

`phenotype-router` is classified as a **federated service** under ADR-023
Rule 3 (long-running, independently scalable). The coverage gate is **60 %**
(ADR-040 §"Coverage gate per tier"); the latency budgets below are the
performance equivalent.

## How budgets were derived

The benchmarks measure end-to-end `Decide()` latency, decomposed by step.
The step budgets below sum to the **headline end-to-end budget** (1.5 s
p99) with a 200 ms safety margin for OTel span emission, GC pause, and
scheduler jitter.

| Step | Budget | Rationale |
|---|---|---|
| **Selector** (`intelligentrouter`)        | ≤ 50 ms p99 | MIRT + RouteLLM + semantic scoring is O(candidates × models) on a 16-dim vector. Per-call cost ~20 ms in profile. |
| **Plugin: contentsafety**                  | ≤ 30 ms p99 | Mandatory pre-routing (L3.6, ADR-050 §3). Per-call cost ~10 ms; budget covers external safety API round-trip on the hot path. |
| **Plugin: promptadapter**                  | ≤ 20 ms p99 | Token-shaping / provider-specific prompt mutation. Per-call cost ~5 ms. |
| **Plugin: contextfolding**                 | ≤ 100 ms p99 | Window compression (largest single step). Per-call cost ~50 ms; budget covers 8k→2k folding on the longest context window. |
| **Provider dispatch**                      | ≤ 1200 ms p99 | The headline number. 95 % of total wall time on the realistic-latency profile (anthropic 800 ms mean / 40 ms stdev). |
| **Fallback (`smartfallback`)**             | ≤ 100 ms p99 | Cascade step: try next provider; per-step budget for the health check + selection. Worst-case sum is the cascade depth (2) × this budget. |
| **OTel span emission**                     | ≤ 50 ms p99 | Single OTLP export per Decide(); budget covers the batched gRPC flush. |

**Headline budget: 1.5 s p99 end-to-end** (selector + 3 plugins +
provider + fallback + OTel, with margin).

## Per-route budget table (machine-readable)

| Route                              | p99 budget | p95 budget | Source of truth |
|---|---|---|---|
| `phenotype-router/decision` (e2e) | **1500 ms** | 1100 ms | `bench/cmd/p95_latency -rps=1000 -duration=30m` |
| `selector/intelligentrouter`       | 50 ms       | 35 ms    | `bench/cmd/p95_latency` selector step |
| `plugin/contentsafety`             | 30 ms       | 20 ms    | `bench/cmd/p95_latency` plugin step |
| `plugin/promptadapter`             | 20 ms       | 12 ms    | `bench/cmd/p95_latency` plugin step |
| `plugin/contextfolding`            | 100 ms      | 70 ms    | `bench/cmd/p95_latency` plugin step |
| `provider/anthropic`               | 1200 ms     | 900 ms   | Upstream SLO (Anthropic p99 ≤ 1.2 s) |
| `provider/openai`                  | 1100 ms     | 800 ms   | Upstream SLO (OpenAI p99 ≤ 1.1 s) |
| `provider/google`                  | 1300 ms     | 1000 ms  | Upstream SLO (Google p99 ≤ 1.3 s) |
| `fallback/smartfallback`           | 100 ms      | 70 ms    | `bench/cmd/p95_latency` fallback step |
| `tracing/otel-span`                | 50 ms       | 35 ms    | `pheno-otel` histogram (post-v15 T8) |

## How budgets are enforced

1. **CI gate (`.github/workflows/bench.yml`)** — every tagged release runs
   the p95 soak for 5 min (1k RPS × 300 s = 300 k samples, well above the
   statistical floor for p99 estimates) and asserts p99 ≤ 1500 ms. Tag
   promotion is blocked on overshoot.

2. **Local gate (`just bench-router-strict`)** — runs all three suites
   against the local checkout with `-strict` on the p95 driver so it exits
   non-zero on p99 overshoot. Use this in pre-merge local verification.

3. **Historical baseline (`bench/bench-results/`)** — every release
   captures a snapshot. PR review compares the candidate PR's snapshot
   against the last release's snapshot. A p99 regression > 10 % requires
   justification in the PR body.

## How to update a budget

A budget change requires:

1. A worklog entry under `worklogs/` with the proposed new value, the
   rationale (SLO change from upstream, fleet growth, etc.), and the
   rolling 30-day p99 from observability.
2. An ADR (under `docs/adr/<date>/`) recording the decision. Reference
   ADR-040 (coverage gates) and this doc (`docs/perf-budget.md`).
3. A PR that updates this doc + the bench workflow's enforcement
   threshold. The bench workflow's `BUDGET_P99_MS` env var must be
   updated in lockstep.

The dev workflow is "fail-fast": if a budget can't be hit, the bench
workflow fails the release tag rather than the budget silently inflating.

## Out-of-scope (deferred)

- **Per-tenant budgets** — fleet is single-tenant today; P3 structural
  gap per `audit-71-pillar-2026-06-17.md` § L46. Re-evaluate when a
  multi-tenant use case lands.
- **p999 budgets** — sample sizes in the 5-min CI soak (~300 k) are not
  enough for stable p999 estimates. The 30-min local soak (1.8 M samples)
  is the lower bound. Re-evaluate when the fleet crosses 10 M req/day.
- **Cost-aware budgets** — cost-per-request is orthogonal to latency;
  tracked separately in `docs/perf-cost.md` (post-v15).

## References

- AGENTS.md §"v13 outlook" — performance benchmarks mandate (this PR
  satisfies it).
- ADR-040 — test coverage gates per tier (80 % lib / 70 % framework /
  60 % federated service). The latency budgets are the performance
  equivalent for the federated-service tier.
- ADR-050 — Router rebuild Option B (Bifrost-as-library + Phenotype-owned
  decision layer).
- ADR-051 — Bifrost as library, not wrapper (the sharp ownership
  boundary that makes per-step budgets meaningful).
- ADR-006 — Circuit Breaker pattern (the `smartfallback` health-aware
  fallback layer this budget covers).
