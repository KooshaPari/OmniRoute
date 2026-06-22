// dashboards/lib/panel.libsonnet
//
// Base panel factory — the 4 panel types the fleet uses today:
//
//   * graph       — legacy Graph panel (Grafana ≤ 9.x); kept for parity
//                   with existing dashboards. Prefer `timeseries` for new work.
//   * stat        — single-number KPI panels (current rate, error count, etc.).
//   * table       — tabular data (top-N lists, per-tenant breakdowns).
//   * timeseries  — modern time-series panel (Grafana ≥ 7.4). Default choice.
//
// Each factory returns the panel JSON object that drops directly into a
// dashboard's `panels` array. Use `panel.graph(...)`, `panel.stat(...)`, etc.
//
// Conventions:
//   - The `query` argument is the raw PromQL/TraceQL/LogQL string.
//   - The `datasource` argument defaults to datasource.prometheus() — pass
//     `datasource.tempo()` or `datasource.loki()` for trace/log panels.
//   - All factories accept a `gridPos={x,y,w,h}` kwarg for layout.
//   - Unit defaults to 'short' for rate/count, 's' for latency — override
//     via the `unit` kwarg if you need something else.

local datasource = import 'datasource.libsonnet';

{
  // graph(title, query, datasource=..., gridPos={x:0,y:0,w:12,h:8}, unit='short')
  //   Legacy Graph panel — kept for parity with v22 dashboards. New panels
  //   should use `timeseries` instead.
  graph(
    title,
    query,
    datasource=datasource.prometheus(),
    gridPos={ x: 0, y: 0, w: 12, h: 8 },
    unit='short',
    legendMode='table',
  ):: {
    title: title,
    type: 'graph',
    datasource: datasource,
    gridPos: gridPos,
    targets: [
      {
        expr: query,
        refId: 'A',
        datasource: datasource,
        legendFormat: '{{label_name}}',
      },
    ],
    options: {
      legend: {
        showLegend: true,
        legendMode: legendMode,
        placement: 'bottom',
        calcs: ['mean', 'last', 'max'],
      },
      tooltip: { mode: 'multi', sort: 'desc' },
    },
    yaxes: [
      { format: unit, label: null, min: 0 },
      { format: 'short', show: false },
    ],
    xaxis: { mode: 'time', show: true },
  },

  // stat(title, query, datasource=..., gridPos={x:0,y:0,w:6,h:4}, unit='short')
  //   Single-number KPI. Use for "current error rate", "p99 latency now",
  //   "queue depth". Renders as one big number with optional sparkline.
  stat(
    title,
    query,
    datasource=datasource.prometheus(),
    gridPos={ x: 0, y: 0, w: 6, h: 4 },
    unit='short',
    colorMode='value',
    graphMode='area',
    reducer='lastNotNull',
  ):: {
    title: title,
    type: 'stat',
    datasource: datasource,
    gridPos: gridPos,
    targets: [
      {
        expr: query,
        refId: 'A',
        datasource: datasource,
      },
    ],
    options: {
      reduceOptions: {
        values: false,
        calcs: [reducer],
        fields: '',
      },
      textMode: 'auto',
      colorMode: colorMode,
      graphMode: graphMode,
      justifyMode: 'auto',
      orientation: 'auto',
    },
    fieldConfig: {
      defaults: {
        unit: unit,
        decimals: 2,
        thresholds: {
          mode: 'absolute',
          steps: [
            { color: 'green', value: null },
            { color: 'red', value: 80 },
          ],
        },
      },
    },
  },

  // table(title, query, datasource=..., gridPos={x:0,y:0,w:12,h:8}, unit='short')
  //   Tabular panel — use for top-N lists (top erroring endpoints, top
  //   slow tenants). Renders a sort-able table.
  table(
    title,
    query,
    datasource=datasource.prometheus(),
    gridPos={ x: 0, y: 0, w: 12, h: 8 },
    unit='short',
  ):: {
    title: title,
    type: 'table',
    datasource: datasource,
    gridPos: gridPos,
    targets: [
      {
        expr: query,
        refId: 'A',
        datasource: datasource,
        format: 'table',
        instant: true,
      },
    ],
    options: {
      showHeader: true,
      sortBy: [{ displayName: 'Value', desc: true }],
    },
    fieldConfig: {
      defaults: { unit: unit, decimals: 2 },
    },
  },

  // timeseries(title, query, datasource=..., gridPos={x:0,y:0,w:12,h:8}, unit='short')
  //   Modern time-series panel — Grafana ≥ 7.4. Preferred for new work.
  //   Supports multi-target overlays, threshold lines, custom legend calcs.
  timeseries(
    title,
    query,
    datasource=datasource.prometheus(),
    gridPos={ x: 0, y: 0, w: 12, h: 8 },
    unit='short',
    legendCalcs=['mean', 'last', 'max'],
  ):: {
    title: title,
    type: 'timeseries',
    datasource: datasource,
    gridPos: gridPos,
    targets: [
      {
        expr: query,
        refId: 'A',
        datasource: datasource,
        legendFormat: '{{label_name}}',
      },
    ],
    fieldConfig: {
      defaults: {
        unit: unit,
        decimals: 2,
        custom: {
          drawStyle: 'line',
          lineInterpolation: 'linear',
          lineWidth: 1,
          fillOpacity: 10,
          showPoints: 'never',
          spanNulls: false,
          stacking: { mode: 'none' },
        },
      },
    },
    options: {
      legend: {
        showLegend: true,
        displayMode: 'table',
        placement: 'bottom',
        calcs: legendCalcs,
      },
      tooltip: { mode: 'multi', sort: 'desc' },
    },
  },

  // traceql(title, query, gridPos={x:0,y:0,w:12,h:8}, unit='ns')
  //   Convenience: timeseries panel wired to a Tempo datasource for TraceQL.
  //   Use for trace-derived metrics (e.g. trace span counts by service).
  traceql(
    title,
    query,
    gridPos={ x: 0, y: 0, w: 12, h: 8 },
    unit='ns',
  ):: $.timeseries(
    title=title,
    query=query,
    datasource=datasource.tempo(),
    gridPos=gridPos,
    unit=unit,
  ),

  // logql(title, query, gridPos={x:0,y:0,w:12,h:8}, unit='short')
  //   Convenience: timeseries panel wired to a Loki datasource for LogQL.
  //   Use for log-derived metrics (e.g. error log rate by service).
  logql(
    title,
    query,
    gridPos={ x: 0, y: 0, w: 12, h: 8 },
    unit='short',
  ):: $.timeseries(
    title=title,
    query=query,
    datasource=datasource.loki(),
    gridPos=gridPos,
    unit=unit,
  ),
}
