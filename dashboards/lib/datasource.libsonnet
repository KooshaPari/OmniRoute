// dashboards/lib/datasource.libsonnet
//
// Datasource helper module — canonical factory for the 3 datasources the
// fleet uses (Prometheus for metrics, Tempo for traces, Loki for logs).
//
// Layout follows the Grafonnet convention (https://github.com/grafana/grafonnet):
// one factory per datasource, returning the `{ uid, type, name }` selector
// shape that panel queries expect.
//
// Conventions:
//   - UIDs are stable across renders; do NOT randomise per build (drift).
//   - Defaults match the prod cluster (Phenotype ObservabilityKit HA stack).
//   - Each factory is pure: input → selector, no side effects.
//
// See: ADR-012 (pheno-tracing canonical), ADR-037 (pheno-mcp-router substrate),
//      ADR-036B (pheno-tracing substrate canonical, v8 sweep re-affirmation).

{
  // Fleet-canonical datasource UIDs. Stable; do not change without an ADR.
  uids: {
    prometheus: 'phenotype-prometheus',
    tempo: 'phenotype-tempo',
    loki: 'phenotype-loki',
  },

  // prometheus(uid=...) — returns a datasource selector for PromQL queries.
  // Use this on any panel that runs PromQL (the vast majority of fleet dashboards).
  prometheus(uid='phenotype-prometheus'):: {
    uid: uid,
    type: 'prometheus',
    name: 'Prometheus',
  },

  // tempo(uid=...) — returns a datasource selector for TraceQL queries.
  // Pair with `panel.traceql(...)` for trace-derived panels.
  tempo(uid='phenotype-tempo'):: {
    uid: uid,
    type: 'tempo',
    name: 'Tempo',
  },

  // loki(uid=...) — returns a datasource selector for LogQL queries.
  // Pair with `panel.logql(...)` for log-derived panels.
  loki(uid='phenotype-loki'):: {
    uid: uid,
    type: 'loki',
    name: 'Loki',
  },

  // byName(name) — convenience: resolve a UID from the canonical map above.
  // Use when you want to reference a datasource by fleet nickname rather
  // than hard-coded UID (recommended for new dashboards).
  byName(name):: {
    prometheus: self.prometheus(self.uids.prometheus),
    tempo: self.tempo(self.uids.tempo),
    loki: self.loki(self.uids.loki),
  }[name],
}
