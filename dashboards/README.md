# dashboards/

Grafonnet/Jsonnet dashboard pipeline. Every Grafana dashboard in the
fleet is expressed as a `.jsonnet` source file, rendered to JSON, and
linted + drift-checked on every PR.

## Why

Dashboards-as-code gives us:

- **Code review on dashboard changes.** A panel addition is a PR, not a
  click-through in the Grafana UI. Reviewers can `git diff` the change.
- **History.** `git log dashboards/argis-extensions/main.jsonnet` shows
  who added a panel, when, and why.
- **Reproducibility.** Re-rendering from source produces the same JSON
  byte-for-byte (modulo whitespace, which `jsonnetfmt` normalises).
- **Lintability.** `jsonnetfmt` catches broken syntax in CI before the
  broken dashboard ever lands in Grafana.
- **Drift detection.** A checked-in golden JSON compared against the
  re-rendered output catches "I hand-edited the JSON and forgot to update
  the source" (and vice versa).

This scaffold ships the pipeline + 1 example dashboard. The 5 dashboards
authored by the v22-T1 parallel agent (commit `1c738725e3`, branch
`feat/v22-l25-metrics-2026-06-22`) at `pheno-otel/docs/metrics/dashboards/`
are hand-authored JSON; converting them to Grafonnet is a v23+ follow-up.

## Install

One-time, on macOS:

```sh
brew install go-jsonnet          # provides `jsonnet` and `jsonnetfmt`
go install github.com/google/go-jsonnet/cmd/jsonnet-lint@latest
# Optional: vendor grafonnet-lib locally so jsonnet -J can resolve it
# without a network round-trip. Today the scaffold does NOT vendor
# grafonnet-lib — the lib/*.libsonnet factories are self-contained.
jb init --url=https://github.com/grafana/grafonnet/gen/grafonnet-latest
jb install github.com/grafana/grafonnet@main
```

On Linux (or in CI):

```sh
# See .github/workflows/dashboards.yml for the canonical install pattern.
curl -fsSL -o /tmp/jsonnet.tar.gz \
  https://github.com/google/go-jsonnet/releases/download/v0.20.0/go-jsonnet_0.20.0_Linux_$(uname -m | sed 's/aarch64/arm64/; s/x86_64/amd64/').tar.gz
tar -xzf /tmp/jsonnet.tar.gz -C /tmp
sudo mv /tmp/jsonnet /tmp/jsonnetfmt /usr/local/bin/
```

## Build

Render every `.jsonnet` to JSON:

```sh
make dashboards.build
# -> dashboards/argis-extensions/build/main.json
```

The build target re-creates `dashboards/<service>/build/` directories
(these are `.gitignored`).

## Lint

Format-check and lint-check every `.jsonnet` and `.libsonnet`:

```sh
make dashboards.lint
# -> fails on unformatted sources (jsonnetfmt --check)
# -> fails on broken syntax (jsonnet-lint)
```

## Diff

Re-render and compare against any checked-in golden JSON:

```sh
make dashboards.diff
# -> exit 0 if every golden matches its re-rendered source
# -> exit 1 (with a diff) on drift
```

Today no golden JSONs are checked in — `make dashboards.diff` is a
no-op until we either (a) commit golden JSONs alongside the sources or
(b) commit only the `.jsonnet` and accept the drift as "expected".

## Regenerate JSON

When you change a `.jsonnet`, re-render the JSON:

```sh
make dashboards.build
# Inspect the diff: git diff dashboards/argis-extensions/build/main.json
# If you maintain a golden: cp dashboards/<service>/build/<name>.json \
#                          dashboards/<service>/<name>.json
```

## Workflow

1. Create a new dashboard: add `dashboards/<service>/<name>.jsonnet`.
2. Use `import '../lib/dashboard.libsonnet'`, `import '../lib/panel.libsonnet'`,
   and `import '../lib/datasource.libsonnet'` for canonical factories.
3. Open a PR. CI runs `make dashboards.lint && make dashboards.diff`.
4. On merge, the rendered JSON under `dashboards/<service>/build/` is
   the artefact that gets posted to Grafana (out of scope for this
   scaffold; the v23+ follow-up adds `make dashboards.deploy` + a
   Grafana provisioning sidecar).

## Pillar impact

- L25 observability metrics: 2.5 → 3.0 (dashboards now code-reviewed,
  lint-gated, diff-gated in CI).

## Layout

```
dashboards/
  lib/                           # shared .libsonnet factories
    datasource.libsonnet         # Prometheus / Tempo / Loki selectors
    panel.libsonnet              # graph / stat / table / timeseries + traceql / logql
    dashboard.libsonnet          # base dashboard factory + variable factories
  argis-extensions/              # per-service dashboards
    main.jsonnet                 # example: API overview (12 panels → 4)
    build/                       # rendered JSON (gitignored)
  vendor/                        # grafonnet-lib (once vendored; gitignored today)
```

## ADR references

- ADR-024 (71-pillar framework; L25 = observability metrics pillar)
- ADR-037 (pheno-mcp-router substrate canonical)
- ADR-040 (test coverage gates per tier; 60% federated service bar)
- ADR-042B (substrate quality bar; codifies ADR-023 Rule 3.1)
- ADR-046 (federation mTLS + OIDC; cross-service auth, not directly used
  here but the dashboard annotation query references the federation UID)

## See also

- `Makefile` — pipeline targets
- `.github/workflows/dashboards.yml` — CI gate
- `pheno-otel/docs/metrics/dashboards/` — v22-T1 parallel agent's
  hand-authored 5 dashboard JSONs (NOT touched by this scaffold).
