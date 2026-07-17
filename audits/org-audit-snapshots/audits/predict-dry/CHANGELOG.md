# Changelog — pheno-predict

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-19

### Added

- **Substrate quality bar (ADR-023 Rule 3.1)** — initial release with:
  - `AGENTS.md` — L72 predictive discipline context, 5 ADR cross-references
  - `LICENSE-MIT` — MIT, Copyright (c) 2026 KooshaPari
  - `pyproject.toml` — v0.1.0, console_script `pheno-predict`
  - `deny.toml` + `.safety-policy.yml` — Python supply-chain policy stub
  - `SPEC.md` — 1-page L72 spec (token-shingle Jaccard, 4-criteria pre-check)
  - `CHANGELOG.md` — this file
  - `.github/workflows/ci.yml` — Python 3.10/3.11/3.12 matrix, pytest, pip-audit
  - `tests/test_smoke.py` — 17 tests (12 in-process + 5 subprocess E2E)
  - `.gitignore` + `tests/__init__.py` — Python stdlib hygiene
- **README fix** — `--format gh-issues` → `--format md` (code only supports
  `["json", "csv", "md"]`).
- **README fix** — `phenotype-tooling/predictive-dry-check.yml` reference
  retained; the workflow is added in `KooshaPari/phenotype-tooling`
  PR `chore/l5-112-predictive-dry-check-workflow-2026-06-19`.

### Notes

- Source file `pheno_predict.py` unchanged from prior session
  (L72 tool implementation, 376 LOC).
- Companion tools: `pheno-drift-detector` (L74), `pheno-framework-lint` (L73).
- See `findings/2026-06-18-L5-112-pheno-predict-absorption-audit.md` for the
  absorption audit that motivated this quality-bar PR.
