# L41..L50 — Observability (the 10 observability pillars)

**Tier:** 1 (continually extended)
**Owner:** Lane owner (Forge)
**Date:** 2026-06-23

## Scope

Observability posture across the 13 lane repos — logs, metrics, traces,
profiling, and the SOTA 2026 open-telemetry + continuous-profiling
stack. The 10 pillars here mirror the OpenTelemetry + CNCF observability
landscape.

## Pillars (one per bullet)

| # | Pillar | 0=missing | 1=seeded | 2=partial | 3=complete |
|---|--------|-----------|----------|-----------|------------|
| L41 | **Structured logs** (`tracing`/`slog`/JSON) | n/a | text only | JSON in one binary | JSON in all + logfmt-pretty for dev |
| L42 | **OpenTelemetry instrumentation** (traces+metrics) | absent | one crate wired | cross-binary spans | full OTel SDK + OTLP exporter |
| L43 | **Metrics emission** (Prometheus / OTLP / statsd) | absent | counter on/off | counters+gauges | full RED/USE |
| L44 | **Distributed trace propagation** (W3C traceparent) | absent | manual | one boundary | every cross-process call |
| L45 | **Continuous profiling** (Pyroscope/pprof) | absent | one flamegraph | nightly | continuous in prod |
| L46 | **Error budgets + SLOs** (per-service) | absent | one SLO | RED+SLO | RED+USE+SLO+error budget policy |
| L47 | **Health endpoints** (`/healthz`, `/readyz`) | absent | one endpoint | both | both+per-dep checks |
| L48 | **Alerting routing** (PagerDuty/OpsGenie/Slack) | absent | one Slack channel | PagerDuty | PagerDuty+severity policy+runbooks |
| L49 | **Dashboard coverage** (Grafana/Datadog) | absent | one panel | per-service | per-service+lane+org |
| L50 | **Chaos/load testing** (steady-state hypothesis) | absent | one script | monthly | continuous+game-days |

## SOTA 2026 reference

- **OpenTelemetry** — vendor-neutral traces+metrics+logs; SDKs for every
  major language. The de-facto standard.
- **eBPF-based observability** — Pixie, Cilium Tetragon, Falco: kernel-
  level tracing without app instrumentation.
- **Continuous profiling** — Pyroscope (Grafana), Polar Signals,
  Datadog Continuous Profiler: per-request flame graphs in prod.
- **OpenTelemetry Collector** — single binary, vendor-neutral pipeline.
- **Prometheus + Grafana + Alertmanager** — the canonical RED/USE stack.

## Per-repo state (2026-06-23 snapshot)

| Repo | L41 | L42 | L43 | L44 | L45 | L46 | L47 | L48 | L49 | L50 | avg |
|------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| Benchora | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.1 |
| portage | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.1 |
| pheno-harness | 2 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.3 |
| phenodag | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.0 |
| Tracera | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.0 |
| heliosBench | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.2 |
| nanovms | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.1 |
| PhenoCompose | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.0 |
| BytePort | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.1 |
| AgilePlus | 2 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.4 |
| registry | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| audits | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.0 |
| vibeproxy | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.2 |

**Cross-repo finding:** the lane is at **~0.1/3 on observability** (median
across 13 repos × 10 pillars). pheno-harness and AgilePlus are the two
exceptions; everything else is a wide-open field.

**Tier-1 quick-fix list:**

1. `tracing` crate in every Rust binary with JSON output (L41) — 5 lines.
2. `tracing-opentelemetry` exporter in the top 3 Rust services
   (Benchora, portage-via-Harbor, AgilePlus) (L42).
3. Pyroscope agent in pheno-harness (L45) — profiling the 3090 Ti is
   the whole point of the harness.

## Cross-references

- Audit L31..L40 (the 10 security pillars) —
  [`./audit-30-pillar-L31-L40-security.md`](./audit-30-pillar-L31-L40-security.md).
- Audit L0..L30 (the existing 25 architecture/quality pillars) —
  [`./audit-30-pillar-L0.md`](./audit-30-pillar-L0.md) (etc.).
- DAG v2 —
  [`../../../plans/2026-06-23-eval-bench-qa-dag-v2.md`](../../../plans/2026-06-23-eval-bench-qa-dag-v2.md) (DAG-T4).
