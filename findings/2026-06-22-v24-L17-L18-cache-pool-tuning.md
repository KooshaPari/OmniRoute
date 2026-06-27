# v24 T3 (L17+L18) — Cache Invalidation + Connection Pool Tuning (Paired)

**Date:** 2026-06-22
**Pillars:** L17 (Cache invalidation) + L18 (Connection pool) — paired 1 → 3
**Branch:** `chore/v24-71-pillar-cycle-14-p1-2026-06-22`
**Device:** spec on macbook, bench on `device: heavy-runner` (per ADR-023)
**Refs:** `plans/2026-06-22-v24-71-pillar-cycle-14-p1.md`, ADR-092, ADR-040 (coverage gates), ADR-023 (device-fit), ADR-042B (substrate quality bar)

## 1. Scope (7 fleet-critical crates)

| # | Crate              | Cache? | Pool? | Triage          |
|---|--------------------|--------|-------|-----------------|
| 1 | pheno-config       | yes    | —     | PR-1 (knobs)    |
| 2 | pheno-otel         | yes    | yes   | PR-2 (OTLP)     |
| 3 | pheno-events       | yes    | —     | PR-3 (bus)      |
| 4 | pheno-mcp-router   | yes    | yes   | PR-4 (LlmPort)  |
| 5 | pheno-port-adapter | —      | yes   | PR-5 (port)     |
| 6 | pheno-tracing      | yes    | —     | measure-only    |
| 7 | pheno-context      | yes    | —     | measure-only    |

**Why paired:** L17 (cache) and L18 (pool) share the same hot path on the read
side (lookup → fetch) and the same failure mode on the write side (invalidation
storms, pool exhaustion under burst). Tuning them together avoids chasing one
symptom and creating the other.

## 2. Targets

| Metric                                            | Target          | Failure threshold |
|---------------------------------------------------|-----------------|-------------------|
| Cache hit-rate (steady state, 1k RPS, 30 min)     | **>= 80%**      | < 70% = fail      |
| Cache hit-rate (warm-up first 5 min)              | >= 50%          | < 30% = fail      |
| Pool exhaustion (1000 burst trials)               | **0/1000**      | >= 1/1000 = fail  |
| Pool acquire p99 latency                          | <= 5 ms         | > 20 ms = warn    |
| Pool leak (open - close) after 30 min             | 0               | > 0 = fail        |
| Stale entry (TTL exceeded) at t+TTL+1s            | 0% of sample    | > 5% = fail       |

## 3. Per-crate config knobs (ADR-040 coverage gate; all four knobs required per substrate)

| Crate              | max_cache_size_mb | ttl_seconds | pool_max | pool_min_idle |
|--------------------|-------------------|-------------|----------|---------------|
| pheno-config       | 16                | 300         | —        | —             |
| pheno-otel         | 64                | 60          | 8        | 2             |
| pheno-events       | 32                | 30          | —        | —             |
| pheno-mcp-router   | 128               | 120         | 32       | 8             |
| pheno-port-adapter | 8                 | 600         | 16       | 4             |
| pheno-tracing*     | 32                | 30          | —        | —             |
| pheno-context*     | 16                | 300         | —        | —             |

(* = measure-only this cycle; no PR — the substrate is owned by the
pheno-tracing and pheno-context circles respectively.)

Defaults keep p99 under the per-crate budget from
`findings/2026-06-21-v16-L13-latency-budgets.md` and hold a hot working set
under 1k RPS sustained. Each PR exposes these as env vars
(`PHENO_<CRATE>_MAX_CACHE_SIZE_MB`, …) per the 12-factor cascade in
phenotype-config (ADR-022 split).

## 4. Test plan (1k-RPS 30-min soak, heavy-runner)

1. **Baseline:** run with default knobs; record hit-rate + pool stats.
2. **Soak:** `wrk -t8 -c128 -d30m --latency http://localhost:<port>/probe`
   against each crate's bench harness (`bench/cache_pool/<crate>_bench`).
3. **Burst trial (1000x):** for each of 1000 trials, fire 10x the steady RPS
   for 5 s, then measure pool acquire failures. Pass criterion: 0/1000.
4. **TTL invalidation:** prime cache -> wait `ttl_seconds + 1` -> sample
   reads; assert stale rate is 0%.
5. **Cold-start:** restart service -> measure warm-up time to >= 50% hit-rate
   (target: <= 5 min).
6. **Pool leak:** open 1000 connections, close 1000, GC pause, assert
   file-descriptor count returns to baseline within 60 s.

`scripts/bench-cache-pool.sh` is a macbook-safe dry-run that exercises
steps 1, 2 (10 s sample, not 30 min) and 6 against a tiny Go test binary
or `curl` echo. The full 30-min soak and 1000-trial burst run on
`device: heavy-runner` (per ADR-023).

## 5. Success criteria (gate to merge each PR)

- [ ] Coverage gate met per ADR-040 (80% lib / 70% framework)
- [ ] Soak: hit-rate >= 80%, pool exhaustion 0/1000
- [ ] No regression on p99 latency from `dashboards/latency-p99.json` (T2)
- [ ] Knobs env-var overridable + documented in crate README
- [ ] OTel histogram metric `phenotype_cache_hit_ratio` exported
      (pheno-otel substrate, ADR-012)
- [ ] Worklog v2.1 entry per PR (ADR-015 v2.1; deprecation 2026-06-22)

## 6. 5 PRs planned (this cycle)

| PR  | Repo                                  | Branch                                              | Scope                              |
|-----|---------------------------------------|-----------------------------------------------------|------------------------------------|
| PR-1| `KooshaPari/pheno-config`             | `feat/l17-l18-config-knobs-2026-06-22`              | 4-knob struct + 12-factor cascade  |
| PR-2| `KooshaPari/pheno-otel`               | `feat/l17-l18-otel-cache-pool-2026-06-22`          | OTLP export cache + exporter pool  |
| PR-3| `KooshaPari/pheno-events`             | `feat/l17-l18-event-bus-cache-2026-06-22`          | subscriber dedup cache             |
| PR-4| `KooshaPari/pheno-mcp-router`         | `feat/l17-l18-llmport-pool-2026-06-22`              | LlmPort connection pool + tok cache|
| PR-5| `KooshaPari/pheno-port-adapter`       | `feat/l17-l18-port-pool-2026-06-22`                 | hexagonal Adapter pool              |

All 5 PRs land on the same `chore/v24-71-pillar-cycle-14-p1-2026-06-22`
wave branch before cycle-14 probe (per ADR-092 acceptance).

## 7. Out of scope (v25+)

- L17 deepening: distributed cache coherency (Redis cluster) — not on the fleet
- L18 deepening: pool warmup strategies (eager connect) — depends on L17 stabilization
- per-crate 2nd-pass tuning (pheno-tracing, pheno-context) — measure-only this cycle

## Related
- `findings/2026-06-21-v16-L13-latency-budgets.md` — per-op p99 budgets
- `dashboards/latency-p99.json` — v24 T2 dashboard (companion)
- `findings/2026-06-22-v24-T2-L14-p99-runbook.md` — companion runbook
- ADR-012 (pheno-tracing), ADR-013 (pheno-mcp-router), ADR-022 (config split)
- ADR-040 (coverage gates), ADR-042B (substrate quality bar)
- ADR-023 (device-fit gate — `device: heavy-runner` for soak)
