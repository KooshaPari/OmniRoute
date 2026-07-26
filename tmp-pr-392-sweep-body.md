## Summary
Closes remaining #392 shell gaps after #449/#453:

- Sweep all dashboard/client hard-coded `http://localhost:4322` fetches to `bffApiUrl()` / server `bffUrl()` (37 pages + panels).
- Document independent Bun package gates (`plans/2026-07-23-v4-bun-package-gate.md`) so root npm workspaces stay Contract-Test safe.

## Test plan
- [x] No remaining hard-coded `:4322` under `apps/web/src` except default in `bff-origin.ts`
- [ ] Spot-check login/dashboard pages resolve BFF via helper
- [ ] Close #392 after merge
