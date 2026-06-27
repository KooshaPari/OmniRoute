# v29-T10 — L44.1 Flamegraph Diff Adoption (P1→3.0)

## What
Generate flamegraphs for pheno-port-adapter and diff across releases.

## Action
Add CI step to `release-pheno-port-adapter.yml` that runs `perf record -F 99 -g -- cargo bench` and generates `flamegraph.svg`. Diff with prior release via `tools/metrics-dashboard/dash.py --diff prior-release/flamegraph.svg current-release/flamegraph.svg`.

Ref: `findings/2026-06-22-v24-L44-flamegraph.md` (from v20 T5)
