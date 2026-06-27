# 71-Pillar Cycle-28 Probe — Maintain-Only Layer Live

**Date:** 2026-06-29 | **Target Fleet Mean:** 3.65 (maintained)

## Summary

Maintain-only layer is live. The fleet now has:
- **Weekly** cron cadence (9 workflows from v34-v37)
- **Quarterly** cron cadence (1 workflow from v38: `pillar-coverage-quarterly.yml`)
- **Annual** hand-authored refresh (`docs/pillar-model-refresh-{year}.md`)

Three cadences, three scales, one purpose: keep all 86 pillars at 3/3 with minimal engineering overhead.

## Cadence stack

```
Annual   (hand-authored)  pillar-model-refresh-{year}.md   (Jun 29)
Quarterly (cron)          pillar-coverage-quarterly.yml    (Jan 1, Apr 1, Jul 1, Oct 1)
Weekly    (cron)          9 evolve + drift + gitleaks + pillar-checks   (Mon 09:00 PDT)
```

Each layer aggregates the layer below it:
- Annual reviews the annual pillar-model crosswalk
- Quarterly generates a fleet-wide coverage report (inventory + scorecard + drift)
- Weekly runs individual pattern probes + drift detection

## Drift detection coverage

| Detector | Cadence | Trigger | Action |
|---|---|---|---|
| `evolve-checks.yml` (v36) | Weekly Mon | 7 weekly workflows missing | Fail gate |
| `pillar-checks.yml` (v37 T5) | Weekly Mon | Any pillar < 3/3 | Fail gate |
| `gitleaks-fleet.yml` (v37 T6) | Weekly Mon | Secret leaked | Fail gate |
| `pillar-fleet/drift.sh` (v37 T2) | Weekly Mon | Score change | File `pillar-drift` issue |
| `pillar-coverage-quarterly.yml` (v38 T2) | Quarterly | — | Coverage report artifact |

## Maintain-only posture validation

The Option C posture is validated by the **first quarterly coverage report** (`findings/2026-09-30-quarterly-coverage.md`) which provides:

- Total pillars / at 3/3 / at 2/3 / etc.
- Fleet mean (currently 3.65)
- Pillars drifted vs previous quarter (0 in Q3 2026)
- Drift issues filed and resolved (0/0)
- Weekly workflow health (9/9 green)
- Pillar model refresh recommendation status
- Decision log (which Option A/B/D activation conditions fired)

If the first quarterly report shows non-zero drift, the posture flips to a defect-driven active cycle per ADR-113 rule 1.

## What's NOT in Maintain-Only

- Pillar score lifting (ceiling at 3/3)
- New pillar addition (ADR-026 binds to industry standards; refresh deferred)
- Pillar retirement (none retired in 2026)
- Active development cycles (ADR-113 §"Sustain-mode rules" rule 1)

## Next cycle

v39 continues Option C. Default plan:
- Continue weekly + quarterly cron cadence
- Maintain the 86/86 invariant
- Author the 2027 pillar-model-refresh on 2027-06-29

If a defect-driven signal emerges, v39 may pivot per ADR-113.

Refs: cycle-28 probe, v38 maintain-only, ADR-113 Option C