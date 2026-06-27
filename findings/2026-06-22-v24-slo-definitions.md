# v24 T5 (L63) — SLO Catalog

**Date:** 2026-06-22
**Pillar:** L63 — SLO burn-rate alerts (1 → 3)
**Refs:** `plans/2026-06-22-v24-71-pillar-cycle-14-p1.md`, ADR-092, `alerts/slo-burn-rate.yaml`, `findings/2026-06-22-v24-L63-slo-on-call-runbook.md`
**Window:** 30-day rolling budget per Google SRE Book ch. 4 (Implementing SLOs).

## SLI / SLO objects

Each SLO is a `{sli, objective, budget, alerting_rule}` tuple per SRE ch. 4. The
alerts in `alerts/slo-burn-rate.yaml` currently page on the availability SLO only;
the latency and MCP-router SLOs use the same multi-window pattern but are not yet
wired (T5 P2 follow-up).

### SLO 1 — Fleet availability (primary, currently alerted)
- **SLI:** `1 - (sum(rate(http_requests_total{status=~"5xx"}[W])) / sum(rate(http_requests_total[W])))`
- **Objective:** 99.9% successful requests over 30 days
- **Budget:** 43.2 min of error time per 30-day window (0.1% of 43,200 min)
- **Alerting rule:** `SLOBurnRateFast1h` / `Fast6h` / `Slow24h` / `Slow3d` (4 multi-window)
- **Burn-rate thresholds:** 14.4x (1h) / 6x (6h) / 1.44x (24h) / 1.08x (3d)

### SLO 2 — p99 HTTP latency
- **SLI:** `histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))`
- **Objective:** p99 ≤ 50 ms over 30 days
- **Budget:** ≤ 1% of requests may exceed 50 ms; co-tracked with SLO 1
- **Alerting rule:** dashboard panel 4 in `dashboards/latency-p99.json`; future burn-rate alerts via `latency_budget_remaining` recording rule (T5 P2)

### SLO 3 — p95 HTTP latency (soft target)
- **SLI:** `histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket[5m])))`
- **Objective:** p95 ≤ 20 ms over 30 days
- **Budget:** soft — informational; not page-worthy on its own
- **Alerting rule:** dashboard panel 3 only; no paging (warn at 2× target)

### SLO 4 — MCP-router request success rate
- **SLI:** `sum(rate(mcp_router_requests_total{outcome="success"}[W])) / sum(rate(mcp_router_requests_total[W]))`
- **Objective:** ≥ 99.5% successful MCP-router requests over 30 days
- **Budget:** 216 min of error time per 30-day window (0.5% of 43,200 min) — looser than fleet SLO 1 because MCP-router is one component, not the whole fleet
- **Alerting rule:** future per-SLO burn-rate alerts (T5 P2; clone the 4-alert pattern, swap the metric and the budget constant 0.005 for `(1 - 0.995)`)

## Error budget accounting

30-day rolling window: 43,200 min total → budget fractions per SLO.
- SLO 1 (99.9%): 43.2 min total; 2% in 1h = 51.8 s; 5% in 6h = 2.16 min; 10% in 24h = 4.32 min; 10% in 3d = 4.32 min
- SLO 4 (99.5%): 216 min total; budget consumption scales 5x vs SLO 1

## Compliance

- **ADR-091** — SLO/burn-rate alerting policy (the v21 cycle 11 P1 reduction ADR)
- **ADR-024** — 71-pillar framework; L63 in Operations & Observability domain
- **Google SRE Book ch. 4** (Implementing SLOs), ch. 5 (Alerting on SLOs)
