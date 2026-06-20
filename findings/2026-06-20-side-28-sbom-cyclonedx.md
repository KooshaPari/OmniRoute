# SBOM Adoption — cargo-cyclonedx for Fleet Rust Crates (side-28)

**Date:** 2026-06-20 10:05 UTC
**Task ID:** side-28
**Agent:** orch-v11-real-research-7
**Verdict:** Adopt now for release builds. Skip for dev builds.

## Current state (lock inventory, 2026-06-20)
- 4 of 8 pheno-* crates have a checked-in `Cargo.lock`: `pheno-otel` (14 deps), `pheno-port-adapter` (7 deps), `pheno-tracing` (97 deps), `pheno-errors` (69 deps), `pheno-flags` (7 deps), `pheno-agents-md` (96 deps).
- 4 pheno-* crates have **no Cargo.lock**: `pheno-config`, `pheno-mcp-router`, `pheno-context`, `pheno-flake`. These are library-only and depend on the consumer's lock — fine for libs but means no SBOM is generatable without first choosing a consumer scenario.

## Tool
`cargo-cyclonedx` 0.7.x generates CycloneDX 1.5 JSON or XML from `Cargo.lock`. Compatible with cargo 1.78+. Available via `cargo install cargo-cyclonedx --locked`.

## How to emit one SBOM per crate
Inside each pheno-* directory that has a Cargo.lock:
```
cargo cyclonedx --format json --override-filename target/sbom
```
Output: `target/sbom.cdx.json`. Human-readable. ~1-5 KB depending on dep count.

For pheno-* crates without Cargo.lock, run `cargo generate-lockfile` first to bootstrap one (does not change the published crate — just a temporary SBOM emission step).

## Where to publish the SBOM
Three viable sinks, in order of preference:
1. **GitHub Release artifacts** — attach `sbom.cdx.json` to every tag. Use `softprops/action-gh-release@v2` in `.github/workflows/release.yml`. Free, immutable per release, consumable by Dependabot.
2. **OCI registry as OCI artifact** — push the SBOM alongside the crate via `oras`. Most rigorous, requires ORAS CLI in CI.
3. **Internal artifact server** — if/when we add `phenotype-infra` artifact store. Skip for now.

## CI integration pattern
Add a `release-sbom.yml` workflow that:
1. Triggers on tag push (`v*.*.*`).
2. Runs `cargo cyclonedx --format json --override-filename target/sbom` per pheno-* crate.
3. Uploads `target/sbom.cdx.json` to the GitHub Release for that tag.
4. Validates the SBOM with `cyclonedx-cli validate --input-file target/sbom.cdx.json --input-format json`.

## What this buys us
- **Supply-chain transparency** — every release has a bill of materials in a standardized format.
- **Dependabot / Renovate compatibility** — both can ingest CycloneDX to find known-vulnerable transitive deps.
- **Customer compliance** — enterprise users increasingly ask for SBOMs (US Executive Order 14028, EU CRA). One workflow satisfies it for the whole fleet.
- **Faster incident response** — when a new CVE lands, `grype` or `trivy` can scan our SBOMs to identify affected versions across all crates.

## What it doesn't buy us
- SBOM is a static artifact; runtime behavior may differ (dynamic linking, feature flags, vendored C). Use SBOM as one signal, not the only one.

**Refs:** `phenotype-ops` release workflow, `pheno-tracing` (largest dep tree, best pilot candidate).
