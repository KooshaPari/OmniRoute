# v29-T2 — L19.1 perf-gate Fleet Adoption (P1→3.0)

## What
Run `tools/perf-gate/perf_gate.py` on every PR across pilot repos.

## Action
Add `.github/workflows/perf-gate-ci.yml` to PhenoCompose + pheno-port-adapter that calls `tools/perf-gate/perf_gate.py --thresholds .perf-gate.yaml`.

Ref: `tools/perf-gate/perf_gate.py` (49 lines, exists in repo)
