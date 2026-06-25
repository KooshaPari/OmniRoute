# v29-T8 — L36.1 Chaos-CI Fleet Adoption (P1→3.0)

## What
Run chaos-injection tests in CI weekly for all 4 pillar repos.

## Action
Verify `.github/workflows/chaos.yml` is enabled in:
- [ ] PhenoCompose
- [ ] pheno-port-adapter
- [ ] HeliosLab
- [ ] OmniRoute

Each must run `python3 tools/chaos-ci-gate/gate.py --suite chaos-injection/` on a weekly Monday 09:00 PDT cron.

Ref: `tools/chaos-ci-gate/gate.py` (exists from v28 T3)
