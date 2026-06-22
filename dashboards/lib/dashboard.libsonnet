// dashboards/lib/dashboard.libsonnet
//
// Base dashboard factory — wraps Grafonnet's `dashboard.new` and applies
// fleet-canonical defaults so every dashboard ships with the same:
//
//   * time range (last 6h, refresh every 30s)
//   * theme (dark)
//   * tags (fleet, observability, service, env)
//   * time picker (5m, 15m, 1h, 6h, 24h, 7d)
//   * graph tooltip (shared crosshair)
//   * links (back to fleet runbook + observability-kit repo)
//
// Use: `dashboard.new(title='api-overview', tags=['fleet','api'], panels=[...])`
//
// Conventions:
//   - `panels` is an array of panel objects from `panel.*` factories.
//   - The factory auto-assigns `id` to each panel — caller does NOT set `id`.
//   - `templating.list` is empty by default; pass `variables=[...]` for templated
//     dashboards (see dashboard.variables for common variable factories).
//   - The `annotations.list` defaults to a single Tempo annotation query
//     (deploy events) — override with `annotations=[...]` if needed.
//
// See: ADR-024 (71-pillar framework, L25 observability pillar),
//      ADR-037 (pheno-mcp-router substrate),
//      findings/2026-06-22-V22-T1-metrics-facade.md (parallel agent's
//      5 v22 dashboard JSONs — this module is the .libsonnet form).

local panel = import 'panel.libsonnet';

{
  // new(title, panels=[], tags=[], variables=[], annotations=[], uid=null)
  //   Build a dashboard JSON object ready for jsonnet render.
  new(
    title,
    panels=[],
    tags=[],
    variables=[],
    annotations=[],
    uid=null,
    refresh='30s',
    time_from='now-6h',
    time_to='now',
  ):: {
    uid: uid,
    title: title,
    editable: true,
    graphTooltip: 'shared crosshair',
    schemaVersion: 38,
    version: 1,
    refresh: refresh,
    time: { from: time_from, to: time_to },
    timepicker: {
      refresh_intervals: ['5s', '10s', '30s', '1m', '5m', '15m', '30m', '1h', '2h', '1d'],
      time_options: ['5m', '15m', '1h', '6h', '24h', '7d'],
    },
    timezone: 'browser',
    tags: ['fleet', 'observability'] + tags,
    templating: { list: variables },
    annotations: {
      list: (
        if std.length(annotations) > 0 then annotations
        else [
          {
            name: 'Deploy events',
            datasource: { type: 'tempo', uid: 'phenotype-tempo' },
            enable: true,
            iconColor: 'rgba(0, 211, 255, 1)',
            expr: '{ resource.service.name=~".+" }',
            tagKeys: 'service.name',
            titleFormat: 'Deploy',
          },
        ]
      ),
    },
    panels: std.mapWithIndex(function(i, p) p + { id: i + 1 }, panels),
    links: [
      {
        title: 'Fleet runbook',
        url: 'https://github.com/KooshaPari/phenotype-ops/blob/main/docs/runbooks/fleet.md',
        type: 'link',
        icon: 'external link',
        targetBlank: true,
      },
      {
        title: 'ObservabilityKit',
        url: 'https://github.com/KooshaPari/ObservabilityKit',
        type: 'link',
        icon: 'external link',
        targetBlank: true,
      },
    ],
  },

  // variables — common variable factories for templated dashboards.
  // Usage: dashboard.variables.datasource(name='ds', query='prometheus')
  variables: {
    // datasource(name, query, label=null) — a Grafana datasource picker.
    datasource(name, query='prometheus', label=null):: {
      name: name,
      type: 'datasource',
      label: label,
      query: query,
      hide: 0,
      current: {},
    },

    // query(name, query, label=null, regex='', datasource=null)
    //   A query variable — values populated by running `query` against
    //   `datasource` (defaults to Prometheus). Use for service/env/region
    //   pickers.
    query(name, query, label=null, regex='', datasource=null):: {
      name: name,
      type: 'query',
      label: label,
      query: {
        query: query,
        regex: regex,
        refId: 'VariableQuery',
      },
      datasource: (
        if datasource != null then datasource
        else { type: 'prometheus', uid: 'phenotype-prometheus' }
      ),
      refresh: 2,
      hide: 0,
      current: {},
    },

    // interval(name, values=['1m','5m','15m']) — a polling-interval picker.
    interval(name, values=['1m', '5m', '15m', '30m', '1h']):: {
      name: name,
      type: 'interval',
      label: 'Interval',
      query: std.join(',', values),
      auto: true,
      auto_count: 30,
      hide: 0,
      current: { text: 'auto', value: '$__auto_interval' },
    },
  },
}
