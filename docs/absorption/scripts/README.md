# Absorption Record: scripts

**Date**: 2026-07-17
**Source**: `KooshaPari/scripts`
**Target**: `phenotype-tooling/bin/legacy-scripts/`
**Wave**: `2026-07-17-queue-refresh-2`
**Disposition**: `ABSORB`

## Transfer Summary

| Metric | Value |
| --- | --- |
| Files transferred | 18 `.sh` + 1 README |
| Total LOC | ~1200 |
| Source archived | yes |
| Source size | ~20KB |

## What was absorbed

- `ai-dd-{maze,pipeline,strict}.sh` — AI-DD pipeline orchestrators
- `curated-{full,lite,refresh-curated}.sh` — curated trace management
- `deploy-grapheon.sh` — Grapheon deployment script
- `eval-{ai-dd-rare,}.sh` — eval harnesses
- `grade-all.sh`, `judge.sh`, `role.sh`, `role-judge.sh` — judge/role grading
- `profile-concurrency.sh` — concurrency profiling
- `show-{forge-config,forge-session,grapheon-status}.sh` — runtime status
- `switch-forge-session.sh` — forge session switch

## Verification

- `git push` succeeded: branch `salvage/phenotype-tooling-workspace-2026-07-15` on `phenotype-tooling`
- Source repo `KooshaPari/scripts` archived 2026-07-17

## Branch

- `phenotype-tooling`: `salvage/phenotype-tooling-workspace-2026-07-15`
- Commit hash: `6d6a723c`