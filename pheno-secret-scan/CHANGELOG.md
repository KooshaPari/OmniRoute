# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Canonical CI workflow (`.github/workflows/ci.yml`): test + fmt + clippy + coverage
- cargo-deny workflow (`.github/workflows/deny.yml`): license + supply-chain audit
- cargo-audit workflow (`.github/workflows/audit.yml`): rustsec vulnerability scan
- `.codespellrc`, `.editorconfig`: editor hygiene
- `LICENSE-MIT`, `SECURITY.md`, `CONTRIBUTING.md`, `AGENTS.md`, `VERSION`
- Meta-bundle per ADR-023 (substrate quality bar)

## [0.1.0] - 2026-06-29

Initial release. Adopted canonical Phenotype substrate layout.
