// dashboards/argis-extensions/main.jsonnet
//
// Example Grafana dashboard for the argis-extensions fleet, expressed in
// Grafonnet/Jsonnet. This is the SCAFFOLD — it shows the canonical pattern
// (import lib factories → build panels → return dashboard.new(...)).
//
// Pillar: L25 observability metrics (dashboard-as-code).
// Cycle: v23 cycle-13 P3 reduction, T1.
//
// Relation to the v22 parallel agent's work:
//   The 5 dashboards at pheno-otel/docs/metrics/dashboards/*.json (commit
//   1c738725e3, branch feat/v22-l25-metrics-2026-06-22) are hand-authored
//   JSON. This .jsonnet is the .libsonnet equivalent that, when rendered
//   via `make dashboards.build`, would produce a dashboard JSON of the same
//   shape (panel count, query semantics, layout grid).
//
//   We do NOT regenerate those 5 v22 dashboards here — that's a v23+
//   follow-up. This file proves the pipeline works by example, on a 6th
//   dashboard (argis-extensions overview), so future dashboard authors
//   have a copy-paste template.
//
// Panel layout (12-col grid, 24-row):
//   +-------------------+-------------------+
//   | p99 latency (stat)| error rate (stat) |
//   +---------+---------+---------+---------+
//   | latency p50/p95/p99 (timeseries)      |
//   +--------------------------------------+
//   | request rate (timeseries)            |
//   +--------------------------------------+

local dashboard = import '../lib/dashboard.libsonnet';
local panel = import '../lib/panel.libsonnet';

{
  apiOverview:
    dashboard.new(
      title='argis-extensions — API overview',
      uid='argis-extensions-api-overview',
      tags=['argis-extensions', 'api', 'golden-signal'],
      refresh='30s',
      time_from='now-6h',
      time_to='now',
      panels=[
        // Row 1 (y=0): two stat panels side-by-side.
        panel.stat(
          title='p99 latency (5m)',
          query='histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{service="argis-extensions"}[5m])))',
          gridPos={ x: 0, y: 0, w: 6, h: 4 },
          unit='s',
          reducer='lastNotNull',
        ),
        panel.stat(
          title='Error rate (5m)',
          query='sum(rate(errors_total{service="argis-extensions"}[5m])) / sum(rate(http_requests_total{service="argis-extensions"}[5m]))',
          gridPos={ x: 6, y: 0, w: 6, h: 4 },
          unit='percentunit',
          reducer='lastNotNull',
        ),

        // Row 2 (y=8): latency percentiles timeseries.
        panel.timeseries(
          title='Latency percentiles (p50 / p95 / p99)',
          query='histogram_quantile(0.50, sum by (le) (rate(http_request_duration_seconds_bucket{service="argis-extensions"}[5m])))',
          gridPos={ x: 0, y: 8, w: 12, h: 8 },
          unit='s',
        ),

        // Row 3 (y=16): request rate.
        panel.timeseries(
          title='Request rate (rps)',
          query='sum by (route) (rate(http_requests_total{service="argis-extensions"}[5m]))',
          gridPos={ x: 0, y: 16, w: 12, h: 8 },
          unit='reqps',
        ),
      ],
    ),
}
