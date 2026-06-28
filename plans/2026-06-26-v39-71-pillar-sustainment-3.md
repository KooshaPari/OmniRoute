# v39 Plan — Post-Convergence Backlog

**Date:** 2026-06-26 | **Target:** Sustain fleet mean **≥3.72**
**Scale:** 100 concurrent agent sessions (if forge DB recovers), fallback to direct
**Duration:** 1 day

## Theme

Close the post-convergence backlog: 75 repos still missing `cliff.toml`, forge subagent DB lock, CI billing block, phantom submodule drift. Sustainability enters silent sustainment mode — pillar checks run on PR + weekly cron with zero-tolerance for regression.

## Wave A (T1-T3 parallel) — cliff.toml Fleet Sync

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T1 | Run `cliff-sync.sh --fix` across all 75 missing repos | 75 new `cliff.toml` files | 47 active repos |
| T2 | Validate all 108 fleet repos have valid cliff.toml | Validation report | 108 repos |
| T3 | Wire cliff-sync into `pillar-checks.yml` post-PR | CI step | 1 workflow |

## Wave B (T4-T5 parallel) — Infra Recovery

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T4 | Forge subagent DB lock diagnosis | `findings/forge-db-lock-2026-06-26.md` | 1 finding |
| T5 | CI billing block removal | STATUS.md update + org admin | 1 commit |

## Wave C (T6 single) — Submodule Cleanup

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T6 | Phantom submodule drift audit + cleanup | `findings/submodule-cleanup-2026-06-26.md` | ~5 affected repos |

## Deliverables

- 6 tracks → fleet mean sustained at ≥3.72
- 75 new cliff.toml files created
- forge DB lock diagnosed
- CI billing block resolved or deferred with a date
- Submodule drift cleaned
- Sustainability enters silent mode (cron-only oversight)

## Exit Criteria

1. `pillar-checks.yml` green on next weekly cron (Monday)
2. All 108 repos have valid cliff.toml
3. Forge subagent at least diagnosed (fix may span sessions)
4. CI billing block resolved or deferred with a date
5. `git submodule status` clean across the 5 affected repos
6. v39 closure + cycle-29 probe + v40 plan committed

Refs: v39 plan, post-convergence backlog, 3e framework sustained
