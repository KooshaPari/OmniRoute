# Wave 6 — HexaKit P3 wave 1 (error crates)

**Date:** 2026-06-17  
**HexaKit PR:** #252

## Scope

Exclude `phenotype-error-core` + `phenotype-errors` from workspace members; pin `workspace.dependencies` to phenoShared git.

## Learned

Full-batch phenoShared git pin **fails** `phenotype-core` compile — API surface mismatch vs HexaKit stubs. Broader P3 requires phenoShared parity sync first.

## pheno archive gate (spot check)

External `Cargo.toml` refs to `KooshaPari/pheno` still in: Agentora, AgilePlus, Tracera, PhenoPlugins, phenotype-gfx, PhenoCompose, Civis, phenotype-teamcomm, phenotype-go-sdk, TestingKit, etc. **Archive blocked.**
