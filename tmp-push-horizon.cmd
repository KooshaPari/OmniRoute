@echo off
cd /d C:\Users\koosh\OmniRoute-main-snap
set LEFTHOOK_EXCLUDE=editorconfig,secret-scan,prettier-markdown

git add plans/2026-07-18-tic-cockpit.md
git commit -m "docs(tic): refresh cockpit after #433/#449/#453 merges"
git push -u origin HEAD
gh pr create --repo KooshaPari/OmniRoute --base main --head fix/v4-bff-origin-sweep-bun-gate-392 --title "fix(v4/#392): sweep BFF origins; document Bun package gate" --body-file tmp-pr-392-sweep-body.md

REM Isolate P4-R1 from sweep: branch from main, cherry-pick only storage files via checkout
git fetch origin main
git stash push -m "p4r1" -- crates/omniroute-rs/Cargo.toml crates/omniroute-rs/crates/omniroute-storage/src/provider.rs
git checkout -B feat/p4-r1-provider-repo-crud origin/main
git stash pop
git add crates/omniroute-rs/Cargo.toml crates/omniroute-rs/crates/omniroute-storage/src/provider.rs
git commit -m "feat(storage): implement ProviderRepo CRUD (P4-R1)" -m "Add get/list/insert/update/delete for providers with validation, conflict handling, and in-memory tests. Stop dual-listing omniroute-ffi crates in the omniroute-rs workspace so cargo can resolve the storage package."
git push -u origin HEAD
gh pr create --repo KooshaPari/OmniRoute --base main --head feat/p4-r1-provider-repo-crud --title "feat(storage): ProviderRepo CRUD (P4-R1)" --body-file tmp-pr-p4r1-body.md
