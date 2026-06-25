# ADR-104: Latency-budget enforcement in CI

**Status:** ACCEPTED 2026-06-25
**Date:** 2026-06-25 (v28 cycle 1)
**Owner:** omniroute-perf circle
**Supersedes:** none
**Refs:** ADR-038 (SLO/SLI framework), ADR-076 (observability v12 closure), ADR-044 (perf-regression gate)

## Summary

Define latency budgets for each routing tier (provider, combo, cache-hit, fallback) and enforce them in CI so that a deployment that regresses p50/p90/p99 latency beyond the budget fails before reaching production.

## Context

OmniRoute currently measures request latency via OpenTelemetry spans (`open-sse/handlers/` distributed tracing) and exposes p50/p90/p99 metrics in the dashboard. However, there is **no formal latency budget** and **no CI gate** that prevents a slow deployment from shipping:

| Problem | Symptom | Severity |
|---|---|---|
| No per-provider latency SLO | Degraded provider goes unnoticed until users complain | P1 |
| No CI latency regression check | A change that adds 500ms overhead passes review | P2 |
| Budgets exist only in docs | Actual thresholds are tribal knowledge | P2 |
| Cache-hit vs cache-miss lack separate budgets | Cache optimisations that hurt miss latency go undetected | P3 |

Without CI enforcement, latency drift is a slow, invisible accumulation — each deploy adds a few ms, and by the time someone notices, the root cause is buried in a dozen commits.

## Decision

Adopt **Option 2**: Latency-budget-to-CI — a declarative budget file committed to the repo, enforced by a CI job that runs a latency probe suite against a staging deployment and fails the pipeline if any metric exceeds its budget.

### Budget file format

Each tier gets a budget record in `ci/latency-budgets.yaml`:

```yaml
# ci/latency-budgets.yaml
version: v1
default_tier: p50=500ms p90=2000ms p99=5000ms

providers:
  openai:
    p50: 800ms
    p90: 3000ms
    p99: 8000ms
  anthropic:
    p50: 1200ms
    p90: 4000ms
    p99: 10000ms

cache:
  hit:
    p50: 50ms
    p90: 100ms
    p99: 200ms
  miss:
    p50: 2000ms
    p90: 5000ms
    p99: 12000ms

combo:
  round-robin:
    p50: 1000ms
    p90: 3000ms
    p99: 8000ms
  fallback:
    p50: 5000ms
    p90: 10000ms
    p99: 20000ms
```

### CI job contract

1. On every PR targeting `main`, a `latency-budget-check` job runs.
2. The job deploys to a staging environment, runs a probe suite (20 requests per provider tier), collects p50/p90/p99 from the staging OTel metrics.
3. Compares observed latency against budgets in `ci/latency-budgets.yaml`.
4. If any metric exceeds its budget, the job **fails** (blocking merge).
5. An optional `[skip-latency]` trailer in the commit message skips the check for documentation-only or emergency-hotfix PRs.

### Out of scope (this ADR)

- Production enforcement (circuit breakers use separate budgets per ADR-038).
- Dynamic budget adjustment (auto-tuning from historical data — deferred to v29).
- Budget alerting in production (covered by ADR-076 OTel alert rules).

## Options Considered

### Option 1: Manual review only (status quo)

| Aspect | Assessment |
|---|---|
| Effort | None |
| Latency drift detection | Reactive — only after user report |
| CI gate | None |
| Budget visibility | Tribal knowledge |
| Per-provider granularity | None |
| Verdict | **Rejected** — does not solve any of the stated problems |

### Option 2: Latency-budget-to-CI (SELECTED)

| Aspect | Assessment |
|---|---|
| Effort | ~3 days (budget file + CI job + probe suite) |
| Latency drift detection | Every PR — proactive |
| CI gate | Fails pipeline on regression |
| Budget visibility | Declarative YAML in repo — single source of truth |
| Per-provider granularity | Per-tier budgets in `ci/latency-budgets.yaml` |
| Verdict | **Selected** — solves all stated problems with proportional effort |

### Option 3: Service-level CI (external SLO-as-code platform)

| Aspect | Assessment |
|---|---|
| Effort | ~2 weeks (vendor eval + integration + contract negotiation) |
| Latency drift detection | Every deploy — proactive (vendor-managed) |
| CI gate | Via webhook |
| Budget visibility | Vendor dashboard + API |
| Per-provider granularity | Configurable per-endpoint |
| Verdict | **Rejected** — over-engineered for current scale; introduces external dependency and recurring cost. Revisit when provider count exceeds 300 (currently 232). |

## Consequences

### Positive

- Every PR gets an objective latency signal. A change that accidentally regresses latency by 200ms is caught before review.
- Budget file is version-controlled, auditable, and reviewable in the same PR as the code change.
- New team members can see the latency contract without asking senior engineers.
- Combo and cache-tier budgets incentivise performance-aware routing — a slow fallback chain becomes visible immediately.

### Negative

- CI runtime increases by ~3 minutes (staging deploy + probe suite). Mitigation: run probes in parallel per provider; accept the increase as the cost of quality gating.
- Budgets must be maintained as provider performance changes upstream. Mitigation: a quarterly budget-review task in the perf circle's OKR.
- Staging environment must be representative of production. If staging is under-provisioned, budgets will be systematically pessimistic and cause false positives. Mitigation: staging replicas match production instance type; baseline budgets are calibrated from a green run.

## Implementation Plan

1. **Budget file** — create `ci/latency-budgets.yaml` with initial budgets for openai, anthropic, gemini, deepseek, groq, together, cache-hit, cache-miss, combo-round-robin, combo-fallback. Calibrate from last 30 days of production p50/p90/p99 (query from OTel).
2. **Probe suite** — add `ci/latency-probes/` with a Node.js script that calls each provider's `/v1/chat/completions` with a fixed 100-token prompt and measures wall-clock latency. Instrument with OTel for p50/p90/p99 aggregation.
3. **CI job** — add `.github/workflows/latency-budget.yml` that deploys to staging, runs the probe suite, runs comparison logic, and fails on regression.
4. **Docs** — add `docs/ops/LATENCY_BUDGETS.md` explaining budget-file format, how to update budgets, and how to skip the check.
5. **Calibration** — run the probe suite on a green staging deploy, record baseline, and set initial budgets at 2x baseline (allowing headroom).
6. **Onboarding** — add latency-budget check to the release checklist (`docs/ops/RELEASE_CHECKLIST.md`). Announce in #eng-channels.

## Refs

- ADR-038 (SLO/SLI framework) — circuit-breaker budgets for production enforcement
- ADR-076 (observability v12 closure) — OTel pipeline that provides the latency metrics
- ADR-044 (perf-regression gate) — precedent for CI-enforced performance gates
- `docs/ops/RELEASE_CHECKLIST.md` — where the latency-budget step will be added
- `open-sse/handlers/chatCore.ts` — primary tracing span source for provider latency
