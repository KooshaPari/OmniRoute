# v39 Plan — Continue Maintain-Only (Option C Default)

**Date:** 2026-06-29 | **Target:** Fleet mean 3.65 (maintained)

## Cycle 28-29 bridge

v38 closed cycle 28 with the maintain-only layer (quarterly + annual cadences) operationalized. v39 continues Option C per ADR-113 unless a defect-driven signal emerges.

## Default tracks (zero unless defect)

| Track | Trigger | Artifact |
|---|---|---|
| T1 (conditional) | Drift detection fires | `pillar-drift` issue → triage → fix or accept-risk |
| T2 (conditional) | Weekly cron failure ≥ 2 consecutive weeks | Investigation issue → fix |
| T3 (annual) | 2027-06-29 | `docs/pillar-model-refresh-2027.md` |
| T4 (quarterly) | 2027-01-01 | `findings/2027-01-01-quarterly-coverage.md` |

## Activation conditions (per ADR-113)

If any of these fires during the cycle, v39 pivots to active work:

1. **3 consecutive weekly `chaos-weekly.yml` failures** → Option A activation (reliability)
2. **1 fleet-wide SLO violation >1h** → Option A activation (reliability)
3. **CI-minute cost alert from weekly evidence artifacts** → Option B activation (cost)
4. **New external standard published mapping to missing pillar domain** → Option D activation (pillar expansion)
5. **Pillar score drop from 3/3 to <3/3 in any weekly probe** → defect-driven T1 fix

## Deliverables

- **Default (no activation):** zero new artifacts; only the existing weekly + quarterly + annual cadences running
- **Activated (any of 1-5):** 1-3 tracks of defect-driven work per the activation signal

## Exit criteria

- All 86 pillars remain at 3/3 throughout cycle 29
- Weekly cron cadence remains green (9/9 workflows)
- Quarterly cron cadence generates Q4 2026 coverage report on 2027-01-01
- No activation conditions fire without corresponding defect-driven v39 tracks

## Why "zero tracks" is a valid plan

Per ADR-113 §"Sustain-mode rules" rule 1: "No new pillar lifting without explicit OK." The 3e framework is meant to be self-sustaining. A v39 plan with zero tracks is the *correct* outcome when the sustainment layer is working.

The cost of "doing nothing" in v39 is bounded: if drift detection fires, we get a `pillar-drift` issue within 7 days. If we ignore the issue, the next weekly probe will fail and the monthly pillar scorecard will show the regression.

## Reference

- ADR-113 — 3e framework closure, default Option C
- v38 closure — maintain-only layer shipped
- `findings/2026-09-30-quarterly-coverage.md` — first quarterly coverage report template

Refs: v39 plan, cycle-29 maintain-only, ADR-113 Option C