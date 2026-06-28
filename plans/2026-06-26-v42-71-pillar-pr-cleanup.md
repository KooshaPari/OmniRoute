# v42 Plan — PR & Submodule Cleanup

**Date:** 2026-06-26 | **Target:** Sustain fleet mean **≥3.72** + close 8 open PRs
**Scale:** 100 concurrent agent sessions (if forge DB recovers), fallback to direct
**Duration:** 2-3 days

## Theme

Close the PR backlog: 8 open PRs in argis-extensions + 1 in Tracera + 2 tracking issues. Execute submodule cleanup on 5 affected repos. Apply forge DB lock fix if sponsor approves.

## Wave A (T1-T4 parallel) — PR Triage

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T1 | Review/merge argis-extensions PR #157 (v37 sustainment) | 1 review | 1 PR |
| T2 | Review/merge argis-extensions PR #147 (v27-T1 doc-test) | 1 review | 1 PR |
| T3 | Review/merge argis-extensions PR #139 (v25-T1 SOC2) | 1 review | 1 PR |
| T4 | Review 5 dependabot PRs (#140-#144) | 1 batch review | 5 PRs |

## Wave B (T5-T6 parallel) — Submodule Cleanup

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T5 | Clean phantom submodule drift (5 repos) | 5 commits | 5 repos |
| T6 | Document submodule cleanup pattern in AGENTS.md | 1 commit | 1 file |

## Wave C (T7 single) — Tracera PR

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T7 | Review/merge Tracera PR #664 | 1 review | 1 PR |

## Wave D (T8 single) — Forge DB Lock Fix

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T8 | Apply WAL + busy_timeout to forge Task queue | 1 patch | 1 commit (sponsor-conditional) |

## Wave E (T9 single) — Closure

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T9 | v42 closure + cycle-32 probe + v43 plan | 3 files | 1 commit |

## Deliverables

- 9 tracks → fleet mean sustained at ≥3.72
- 8 open PRs reviewed/merged
- 5 submodule cleanup commits
- AGENTS.md submodule pattern documented
- Tracera PR #664 merged
- Forge DB lock patched (sponsor-conditional)
- v42 closure + cycle-32 probe + v43 plan committed

## Exit Criteria

1. All 8 argis-extensions PRs reviewed/merged/closed
2. `git submodule status` clean across 5 affected repos
3. AGENTS.md has submodule cleanup pattern
4. Tracera PR #664 merged
5. Forge DB lock fix applied (if sponsor approves)
6. v42 closure + cycle-32 probe + v43 plan committed

Refs: v42 plan, PR cleanup, submodule cleanup, cycle-32
