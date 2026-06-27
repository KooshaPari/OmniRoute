# 71-Pillar Cycle-27 Probe — Sustainment Layer Live

**Date:** 2026-06-28 | **Target Fleet Mean:** 3.65 (maintained)

## Summary

Sustainment layer is live. The fleet now has weekly drift detection on top of the 3e framework. After v37:
- All 86 pillars remain at 3/3
- 6 sustainment tracks shipped (164 LOC)
- Weekly cron cadence: drift detected within 7 days

## Drift Detection Coverage

| Detector | Cadence | Trigger | Action |
|---|---|---|---|
| `evolve-checks.yml` (v36) | Weekly Mon 09:00 PDT | 7 weekly workflows missing | Fail gate, log to artifacts |
| `pillar-checks.yml` (v37 T5) | Weekly Mon 09:00 PDT | Any pillar < 3/3 | Fail gate, log to artifacts |
| `gitleaks-fleet.yml` (v37 T6) | Weekly Mon 09:00 PDT | Secret leaked | Fail gate, file issue |
| `pillar-fleet/drift.sh` (v37 T2) | Weekly Mon 09:30 PDT (after runs) | Any pillar score change | File `pillar-drift` issue |

## Sustainment SLAs

| Event | SLA |
|---|---|
| Drift detection (auto-issue filed) | 7 days from regression |
| Owner triage | 5 days from issue open |
| Score restoration OR accepted-risk label | 5 days from triage |

## Pillar Inventory (per substrate)

The `pillar-fleet/inventory.sh` script lists all 86 pillar dirs and marks present/absent. The `scorecard.sh` runs per-dir check for required files and prints the scorecard table.

Sample output:

```
Pillar     Status    Owner             Required files
L1  arch   ✓ 3/3     argis-extensions  SPEC.md, README.md, tests/, ci.yml
L2  arch   ✓ 3/3     argis-extensions  ...
...
L86 gitleaks ✓ 3/3   fleet-wide       .gitleaks.toml + CI gate
```

## What's NOT in Sustainment

- Pillar score **lifting** (already at 3/3 ceiling)
- New pillar **addition** (ADR-026 binds to industry standards)
- Pillar **retirement** (all 86 pillars serve a purpose)

## Next Cycle

v38+ cycle selection is a strategic decision. Default per ADR-113: **Option C — Organic maintain-only**.

Activation condition for **Option A — Cross-fleet reliability**:
- 3 consecutive weekly chaos-weekly.yml failures, OR
- 1 fleet-wide SLO violation lasting > 1h

Activation condition for **Option B — Cross-fleet cost**:
- v36/v37 weekly evidence artifacts trigger CI-minute cost alert, OR
- Federated service cloud spend > $X/month (TBD with sponsor)

Activation condition for **Option D — Pillar expansion**:
- New external industry standard published that maps to a missing pillar domain

If none of these conditions fire by 2026-09-30 (3 months from v37), sustainment continues indefinitely per Option C.

Refs: cycle-27 probe, v37 sustainment, ADR-113, 3e framework complete