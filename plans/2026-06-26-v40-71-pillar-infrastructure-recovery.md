# v40 Plan — Infrastructure Recovery

**Date:** 2026-06-26 | **Target:** Sustain fleet mean **≥3.72** + close 4 deferred items
**Scale:** 100 concurrent agent sessions (if forge DB recovers), fallback to direct
**Duration:** 2-3 days

## Theme

Close the 4 v39-deferred items:
1. Wire cliff-sync into CI (T3)
2. Diagnose forge DB lock (T4)
3. Resolve CI billing block (T5)
4. Clean phantom submodule drift (T6)

These are all infrastructure / cross-cutting concerns that don't move the fleet mean but unlock future cycles.

## Wave A (T1-T2 parallel) — CI Wiring

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T1 | Wire `cliff-sync.sh` into `pillar-checks.yml` post-PR | 1 workflow | 1 file |
| T2 | Wire `trend.sh` weekly cron | 1 workflow | 1 file |

## Wave B (T3-T4 parallel) — Infra

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T3 | Forge DB lock diagnosis | `findings/forge-db-lock-2026-06-26.md` | 1 finding |
| T4 | CI billing block resolution | STATUS.md update | 1 commit |

## Wave C (T5 single) — Submodule Cleanup

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T5 | Phantom submodule drift audit + cleanup (5 repos) | `findings/submodule-cleanup-2026-06-26.md` | ~5 affected repos |

## Wave D (T6 single) — Closure

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T6 | v40 closure + cycle-30 probe + v41 plan | 3 files | 1 commit |

## Deliverables

- 6 tracks → fleet mean sustained at ≥3.72
- cliff-sync CI wired
- forge DB lock diagnosed
- CI billing block resolved or deferred with date
- Submodule drift cleaned
- v40 closure + cycle-30 probe + v41 plan committed

## Exit Criteria

1. `pillar-checks.yml` runs cliff-sync on every PR + weekly
2. `trend.sh` runs weekly cron, writes trend report
3. Forge subagent infra diagnosis report exists (may not fix in this cycle)
4. CI billing block resolved or documented as deferred with a date
5. `git submodule status` clean across the 5 affected repos
6. v40 closure + cycle-30 probe + v41 plan committed

Refs: v40 plan, infrastructure recovery, post-convergence backlog
