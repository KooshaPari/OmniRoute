@echo off
cd /d C:\Users\koosh\OmniRoute-main-snap
gh pr create -R KooshaPari/OmniRoute --base main --head test/bff-dashboard-sse-characterization-340 --title "test(bff): characterize dashboard SSE and route manifest (#340)" --body "## Summary
- Snapshot 59 unique dashboard method-path registrations.
- Add representative contract tests for health, unavailable stores, validators, and provider payloads.
- Lock playground SSE token order and terminal cost metadata.
- Characterize health SSE cadence, monotonic ids, overlapping writes, and current abort cleanup gap.

## Test plan
- [x] `npx vitest run tests/unit/routes/dashboard.test.ts tests/unit/routes/dashboard.health.concurrent.test.ts`
- [ ] Scoped BFF CI green

Closes the dashboard/SSE half of #340 (proxy half landed in #401)."
