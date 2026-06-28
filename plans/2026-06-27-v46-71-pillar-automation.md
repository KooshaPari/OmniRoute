# v46 Plan — Automation & Next Cycle

**Date:** 2026-06-27 | **Target:** Sustain fleet mean **≥3.72**
**Scale:** forge subagent now working (WAL+busy_timeout fix)
**Duration:** 2-3 days

## Theme

All infra items resolved. v46 pivots from sustainment to **automation architecture**: systematize the pattern of parallel agent dispatch, tool-driven CI gates, and fleet-wide observability that the 71-pillar program built.

## Wave A (T1-T2 parallel) — forge Automation Patterns

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T1 | New cycle bootstrap script | `roles/forge-bootstrap/bin/new-cycle` | 1 script |
| T2 | Make forge busy_timeout persistent | forge daemon config or startup hook | 1 commit |

## Wave B (T3-T4 parallel) — Fleet Observability

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T3 | Pillar drift alerting (slack/email) | `tools/pillar-fleet/alert.sh` | 1 script |
| T4 | Automated fleet scorecard push | `tools/pillar-fleet/push-scorecard.sh` | 1 script |

## Wave C (T5 single) — CI Gate Activation

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T5 | Verify all 4 CI gates run on every PR | Test PR against repo | 1 verification |

## Wave D (T6 single) — Closure

| Track | Description | Artifact | Scale |
|---|---|---|---|
| T6 | v46 closure + cycle-35 probe + v47 plan | 3 files | 1 commit |

## Deliverables

- 6 tracks → fleet mean sustained at ≥3.72
- forge cycle bootstrap script automates new session setup
- forge busy_timeout made persistent across daemon restarts
- Pillar drift alerting + auto-scorecard-push
- All 4 CI gates verified running on PR
- v46 closure + cycle-35 probe + v47 plan committed

## Exit Criteria

1. `roles/forge-bootstrap/bin/new-cycle` works end-to-end
2. forge daemon can restart without losing busy_timeout
3. `tools/pillar-fleet/alert.sh` fires on drift
4. `tools/pillar-fleet/push-scorecard.sh` pushes to findings/
5. All 4 CI gates green on test PR
6. v46 closure + cycle-35 probe + v47 plan committed

Refs: v46 plan, automation, fleet observability, cycle-35
