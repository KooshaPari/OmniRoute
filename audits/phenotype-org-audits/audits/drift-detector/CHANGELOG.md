# Changelog — pheno-drift-detector

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-19

### Added

- **Substrate quality bar (ADR-023 Rule 3.1)** — initial release with:
  - `AGENTS.md` — L74 drift-detection discipline context, ADR cross-references
  - `LICENSE-MIT` — MIT, Copyright (c) 2026 KooshaPari
  - `deny.toml` — Python supply-chain policy stub
  - `SPEC.md` — 1-page L74 spec (3-pass algorithm, output formats)
  - `CHANGELOG.md` — this file
  - `.github/workflows/ci.yml` — Python 3.11/3.12, pytest, lint
  - `tests/test_smoke.py` — 4 subprocess E2E tests

### Notes

- Source file `pheno_drift_detector.py` unchanged from prior session
  (L74 tool implementation, 413 LOC).
- Companion tools: `pheno-predict` (L72), `pheno-framework-lint` (L73).
- See `findings/2026-06-18-L5-111-pheno-drift-detector-absorption-audit.md` for the
  absorption audit that motivated this quality-bar release.
