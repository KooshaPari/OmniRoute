# Changelog

All notable changes to phenotype-org-audits are documented here.

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [0.0.1] - 2026-04-24

### Added

- **Baseline audit (2026-04-24)** — Initial snapshot capturing:
  - 74 Phenotype org repos catalogued
  - 9.9M LOC across Rust, Go, Python, TypeScript, Markdown
  - Systemic issues identified: test traceability gaps, governance adoption barriers, dependency drift
  - Quarterly audit schedule established (1st of Jan/Apr/Jul/Oct)
  - Retention policy: 4 quarters detailed, 1+ year archived

- **Repository structure**:
  - `audits/<YYYY-MM-DD>/` for timestamped snapshots
  - `tooling/` for aggregator scripts and worklog tooling
  - `.github/workflows/quarterly-audit.yml` for CI automation

- **Documentation**:
  - README with audit purpose and structure
  - Governance integration points (AgilePlus, test traceability, dependency waves)

### Notes

- Audit aggregator tooling symlinked from phenotype-tooling
- Initial audit reveals 0.43% realizable LOC reduction opportunity (43-44K LOC across AgilePlus decomposition)
- Governance adoption at 60% (CLAUDE.md in 45/74 repos)
- Test traceability scaffolding created (FR → test mapping for all 45 active repos)
