# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- CI workflow (`.github/workflows/ci.yml`): test + fmt + clippy + coverage
- cargo-deny workflow (`.github/workflows/deny.yml`): license + supply chain audit
- cargo-audit workflow (`.github/workflows/audit.yml`): rustsec vulnerability scan
- OpenSSF Scorecard workflow (`.github/workflows/scorecard.yml`): weekly security posture
- .codespellrc: skip-list for codespell
- .editorconfig: per-language formatting
- .gitignore: target/ + editor cruft

## [0.1.0] - initial

Initial release. See git log for history.
