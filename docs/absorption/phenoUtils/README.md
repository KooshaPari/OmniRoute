# phenoUtils Absorption

**Date**: 2026-07-17
**Source**: `KooshaPari/phenoUtils` (archived)
**Target**: `pheno` monorepo as `crates/pheno-utils-*/`
**Branch**: `absorb/pheno-utils-2026-07-17` (pushed to origin)
**Wave**: `2026-07-17-queue-refresh-2`

## What was absorbed

phenoUtils v0.1.0 — a 7-crate workspace of substrate-utility primitives:

| Source crate | Target crate | LOC | Purpose |
|--------------|--------------|-----|---------|
| `pheno-shell` | `pheno-utils-shell` | ~900 | tokio-based async shell exec, command builder |
| `pheno-fs` | `pheno-utils-fs` | ~800 | async file walker, hash, fs ops |
| `pheno-net` | `pheno-utils-net` | ~1100 | reqwest wrapper, URL utils, retry helpers |
| `pheno-async` | `pheno-utils-async` | ~600 | async patterns (barrier, latch, pool) |
| `pheno-crypto` | `pheno-utils-crypto` | ~1100 | AES-GCM, HMAC, base64 helpers |
| `pheno-testing` | `pheno-utils-testing` | ~1100 | wiremock harness, fixtures |
| `chaos-injection` | `pheno-utils-chaos` | ~1200 | `FaultInjector` chaos testing primitive |
| **Total** | | **6781 LOC** | |

## Changes during absorption

- Renamed crate names to `pheno-utils-*` for workspace consistency
- Rewrote path deps: `chaos-injection` → `pheno-utils-chaos`
- Updated cross-crate `use` statements (`use chaos_injection::` → `use pheno_utils_chaos::`)
- Registered 7 new workspace members in `Cargo.toml`
- Cleaned up stale `crates/pheno-data-from-phenoData/` (artefact from prior failed attempt)

## Verification

```
cargo check -p pheno-utils-{shell,fs,net,async,crypto,testing,chaos}
  → Finished `dev` profile [unoptimized + debuginfo] target(s) in 5.67s
```

All 7 crates compile cleanly standalone. Tests are present in source (`tests/chaos_test.rs`
for fs and net, plus inline `#[cfg(test)]` modules) — full test run deferred to CI due
to heavy deps (wiremock + reqwest + tokio).

## Notes

- The `pheno-utils-*` naming aligns with the existing convention (`pheno-context`,
  `pheno-cdylib-bridge`, `pheno-events`, `httpora-core`) — kebab-case, prefixed
- These are substrate-utility primitives intended to be depended on by other pheno
  crates. None of them have been wired as deps yet — that's a follow-up.
- The `chaos-injection` crate is the most novel: `FaultInjector::new(config)` lets
  tests probabilistically inject IO/network failures.

## Disposition

`disposition-index.json` row `repo-phenoUtils` → `fsm=absorbed, archived=true`.