# v45 Plan — Standby / Sustainment

**Date:** 2026-06-27 | **Target:** Sustain fleet mean **≥3.72**
**Scale:** No active tracks — standby for sponsor decisions on issues #160 and #161

## Theme

No active tracks. v45 is a standby cycle — the fleet is fully convergent (86/86 pillars at 3/3, 12 consecutive cycles, 4 CI gates). All remaining work is sponsor-conditional.

## Trigger Gates

| Trigger | Condition | Expected Track |
|---|---|---|
| Sponsor approves forge DB lock fix | Issue #160 → "green-light" | Apply WAL + busy_timeout in forge subagent source |
| Sponsor resolves CI billing block | Issue #161 → billing tier increased | All workflows activate; CI gates go from code to running |
| New pillar gap discovered | Fleet mean drops below 3.72 | Immediate diagnosis + recovery cycle |

## On Standby

All tools remain functional via direct execution:
- `tools/pillar-fleet/{inventory,drift,scorecard,trend,cliff-sync,server}.sh` — direct CLI
- `tools/adr-index-fleet/aggregator.sh` — manual ADR aggregation
- `nested-repo-lint` job — CI gate (defined in yml, dark if billing-blocked)

## Next Active Cycle (v45+)

If no trigger fires: close v45 as empty sustainment cycle every 48h.
If trigger fires: dispatch Wave A as single-track recovery.

Refs: v45 plan, standby, sustainment, sponsor-conditional
