# v29-T1 — L11.1 cargo-fuzz Fleet Adoption (P1→3.0)

## What
Verify `pheno-port-adapter/fuzz/fuzz_endpoint.rs` runs in CI on every PR.

## Adoption check
- [x] `fuzz/fuzz_targets/fuzz_endpoint.rs` exists in pheno-port-adapter
- [ ] CI gate runs `cargo fuzz check fuzz_endpoint --runs=10000` on every PR
- [ ] Fuzz corpus is checked in (minimized, under 1MB)

## Action
Add `.github/workflows/fuzz-ci.yml` to pheno-port-adapter that runs fuzz_endpoint for 5min on every PR.
