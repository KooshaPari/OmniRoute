# v29-T5 — L29.1 SBOM CycloneDX Fleet Adoption (P1→3.0)

## What
Generate CycloneDX SBOM at release time for all Rust crates.

## Action
Add `cargo-cyclonedx` step to `release-*` workflow suite. Verify all 4 release-*.yml workflows (pheno-config, pheno-errors, pheno-otel, pheno-port-adapter) run `cargo cyclonedx` before signing.

Ref: `.github/workflows/release-sbom-diff.yml` (exists from v26 T1)
