# Tier-1 Security Gate Status

> Tier-1 gates: **security scan** (cargo audit / npm audit / trufflehog), **SBOM** produced (CycloneDX), **LICENSE** present (Apache-2.0 OR MIT), **CHANGELOG** updated.

These gates must pass before merging to main.

## Gate Details

| Gate | Description | Tooling |
|------|-------------|---------|
| Security Audit | Scan for known CVEs in dependencies | `cargo audit` (Rust), `npm audit` (Node), `pip-audit` (Python), `govulncheck` (Go) |
| License/Advisory | Verify deny policy (licenses, bans) | `cargo deny check` (Rust) |
| SBOM | Generate CycloneDX SBOM on release | `cargo cyclonedx` / `npm sbom` |
| LICENSE | Apache-2.0 OR MIT file present | `test -f LICENSE` |
| CHANGELOG | Release notes updated | `grep -q "Unreleased" CHANGELOG.md` |

## Per-Repro Tier-1 Status

| Repo | audit/security | deny | Status |
|------|----------------|------|--------|
| phenotype-infra | skipped | skipped | SKIP |
| PhenoCompose | fail | fail | FAIL |
| BytePort | fail | fail | FAIL |
| nanovms | fail | N/A | FAIL |

## Findings Detail

| Repo | Tool | Finding |
|------|------|---------|
| PhenoCompose | cargo audit | cargo not installed in grading environment |
| BytePort | cargo audit | Cargo.toml resolver 3 not supported by current toolchain |
| BytePort | cargo deny | Cargo.toml resolver 3 causes parse failure |
| nanovms | npm audit | esbuild <=0.24.2: moderate severity — any website can send requests to dev server |
| phenotype-infra | cargo audit | Skipped (fast mode) |

## Gate Summary

- **Repos passing Tier-1 (audit):** 0 / 4
- **Repos with skipped audit:** 1 (phenotype-infra — fast mode)
- **Repos with failing audit:** 3 (PhenoCompose, BytePort, nanovms)

## Next Steps for Failing Repos

1. **PhenoCompose**: Install Rust toolchain in grading environment; run `cargo audit`
2. **BytePort**: Fix resolver version in Cargo.toml (change `resolver = "3"` to `resolver = "2"`); run `cargo audit && cargo deny check`
3. **nanovms**: Upgrade esbuild to >0.24.2; run `npm audit fix`
4. **phenotype-infra**: Run full mode (not fast) to get audit results
5. **All repos**: Ensure SBOM produced on release (CycloneDX), Apache-2.0 LICENSE present, CHANGELOG updated
