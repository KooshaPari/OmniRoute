# v30 Tools Index

This directory contains 7 fleet-wide governance tools delivered in v30 (cycle-20).

## Quick reference

| Tool | Pillar | Lines | Purpose |
|---|---|---|---|
| `cargo-fuzz-schedule/schedule.py` | L11.1 | 157 | Nightly cargo-fuzz orchestration across fleet |
| `perf-budget-table/render.py` | L17.1 | 62 | Per-endpoint latency budget → Markdown table |
| `perf-aggregate/aggregate.py` | L19.1 | 97 | Multi-repo perf report rollup |
| `contract-test-fleet/run.py` | L27.1 | 96 | Cross-repo contract test runner (Pact) |
| `sbom-cyclonedx-fleet/generate.py` | L29.1 | 147 | Multi-ecosystem CycloneDX SBOM generator |
| `gitleaks-fleet/scan.py` | L47.1 | 96 | Fleet-wide gitleaks scanner |
| `mtls-fleet/mtls.py` | L52.1 | 110 | Internal mTLS CA + cert issuer + verifier |

## Total: 765 LOC of stdlib-only Python

## Common patterns

- All tools use stdlib only (no `pip install` required in CI)
- All tools accept `--output` for JSON and `--summary` for Markdown table
- All tools use ISO 8601 timestamps with UTC
- All tools follow the convention `python3 tools/<name>/<script>.py --help`

## CI integration

`.github/workflows/v30-checks.yml` runs T2, T3, T4, T5, T6 on every PR. T1 (fuzz) and T7 (mTLS) are operator-triggered.

## Adoption

Each tool is independently adoptable. Per-repo adoption tracked in `findings/2026-06-27-v30-tools-adoption-status.md` (to be created in v31).

Refs: v30 plan, v30 closure, cycle-21 probe
