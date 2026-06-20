# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
### Added
- `CODE_OF_CONDUCT.md` (Contributor Covenant v2.1) for tier-0 governance hygiene.
- Tier-0 / 71-pillar baseline audit by orch-v12-s2-019: confirmed presence of
  `Justfile`, `.github/workflows/*` (ci, conventions, legacy-tooling-gate, pages,
  sbom, scorecard, security-scan, trufflehog), `.editorconfig`, `.gitattributes`,
  `deny.toml`, `CODEOWNERS`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`,
  issue templates (`bug_report.md`, `feature_request.md`, `config.yml`),
  `PULL_REQUEST_TEMPLATE.md`, `dependabot.yml`, `FUNDING.yml`, and
  Cargo toolchain (`Cargo.toml` + `Cargo.lock` + `src/lib.rs` + `src/connector.rs`).

## [0.1.1] - 2026-06-20

### Added
- **catalog/registry.yaml** — first canonical machine-readable substrate
  catalog (ADR-ECO-017). Three entries: Configra, pheno-tracing,
  pheno-mcp-router.
- **catalog/registry.schema.json** — JSON Schema for catalog entries;
  encodes the tier-required and architecture-required rules.
- **scripts/validate-catalog.py** — offline validator. Checks tier
  required, architecture required when tier=phenotype-framework,
  ports/adapters required when architecture=hexagonal-l4, naming
  conventions (`*Port` / `*Adapter` CamelCase), and boundary/intent
  path resolution.
- **.github/workflows/registry-validate.yml** — CI workflow that runs
  `scripts/validate-catalog.py` + `scripts/conventions-lint.sh` on PRs
  touching `catalog/`, `scripts/`, `docs/boundary/`, `docs/intent/`,
  or `docs/adrs/`.
- **docs/adrs/ADR-ECO-017-substrate-schema-conventions.md** — new ADR
  porting monorepo ADR-013 (substrate model) and ADR-014 (hexagonal
  port/adapter naming) into the registry catalog schema as enforced
  requirements.
- **docs/boundary/Configra.md** — first-class boundary entry for
  Configra (was missing; `role: unknown` previously).
- **docs/intent/Configra.md** — first-class intent entry for Configra.
- **okf/manifest.okf.yaml** — added `substrate-catalog` and
  `substrate-schema` artifacts so the OKF manifest indexes the catalog.

### Changed
- **docs/adrs/README.md** — registered ADR-017 in the ecosystem ADR table.

### Notes
- T23 registry refresh dispatch (2026-06-20).
- Closes the L5-110 / L5-114 / L5-500 substrate catalog gap.
- Cross-references: monorepo ADR-013, ADR-014, ADR-023, ADR-040,
  ADR-048.

## [0.1.0] - 2026-06-08
- Initial release
