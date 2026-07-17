# Absorption Record: phenoEvents → pheno

**Date**: 2026-07-17  
**Size**: 192KB (2 crates)  
**Files**: 6 Rust source, 2 Cargo.toml, benches, tests  
**Target**: `pheno/crates/pheno-events/`  
**Verification**: `cargo check -p pheno-events` — clean  

## Notable

- `phenoevents-observability` sub-crate was already present in pheno monorepo — only needed to absorb the root `pheno-events` crate
- Nested `[workspace]` section removed from absorbed Cargo.toml
- Inner dep path rewritten: `crates/phenoevents-observability` → `../phenoevents-observability`
