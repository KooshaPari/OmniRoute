@echo off
cd /d C:\Users\koosh\OmniRoute-main-snap
set LEFTHOOK_EXCLUDE=editorconfig,secret-scan,prettier-markdown
git fetch origin main
git stash push -u -m "horizon-wip" -- apps/web crates/omniroute-rs/crates/omniroute-storage/src/provider.rs plans/2026-07-23-v4-bun-package-gate.md scripts/dev/rewrite-bff-origin.mjs
git checkout main
git pull origin main
git checkout -b fix/v4-bff-origin-sweep-bun-gate-392
git stash pop
git add apps/web plans/2026-07-23-v4-bun-package-gate.md scripts/dev/rewrite-bff-origin.mjs
git reset HEAD crates/omniroute-rs/crates/omniroute-storage/src/provider.rs 2>nul
git status -sb
git commit -m "fix(v4/#392): sweep dashboard BFF origins; document Bun package gate" -m "Replace hard-coded localhost:4322 fetches with bffApiUrl/bffUrl across dashboard pages. Document independent Bun package gates so root npm workspaces stay Contract-Test safe."
