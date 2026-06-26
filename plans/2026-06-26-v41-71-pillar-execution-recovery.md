# v41 Plan — Execution Recovery

**Date:** 2026-06-26 | **Target:** Sustain fleet mean **≥3.72** + execute 4 v40-deferred items
**Scale:** 100 concurrent agent sessions (if forge DB recovers), fallback to direct
**Duration:** 2-3 days

## Theme

Execute the diagnoses: apply forge DB lock fix, escalate CI billing block, run submodule cleanup on 5 affected repos, land Tracera PR #637.

## Wave A (T1 single) — Forge DB Lock Fix

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T1 | Apply `busy_timeout=5000` + `journal_mode=WAL` to forge Task queue | 1 patch + 1 test | 1 file |

## Wave B (T2-T3 parallel) — Org Admin

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T2 | File forge DB lock tracking issue | GitHub issue | 1 issue |
| T3 | File CI billing block sponsor escalation | GitHub issue | 1 issue |

## Wave C (T4 single) — Submodule Cleanup

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T4 | Clean phantom submodule drift in 5 affected repos | 5 commits | 5 repos |

## Wave D (T5-T6 parallel) — PR Review

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T5 | Review/merge Tracera PR #637 | 1 review | 1 PR |
| T6 | Review/merge argis-extensions PR #159 (v40 Wave A) | 1 review | 1 PR |

## Wave E (T7 single) — Closure

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T7 | v41 closure + cycle-31 probe + v42 plan | 3 files | 1 commit |

## Deliverables

- 7 tracks → fleet mean sustained at ≥3.72
- Forge DB lock patched with WAL + busy_timeout
- 2 tracking issues filed
- 5 submodule cleanup commits
- 2 PRs reviewed/merged
- v41 closure + cycle-31 probe + v42 plan committed

## Exit Criteria

1. Forge Task dispatch works with 4+ parallel tasks
2. CI billing block resolved or sponsor escalation filed
3. `git submodule status` clean across the 5 affected repos
4. Tracera PR #637 merged to main
5. argis-extensions PR #159 merged to main
6. v41 closure + cycle-31 probe + v42 plan committed

Refs: v41 plan, execution recovery, post-v40 backlog
