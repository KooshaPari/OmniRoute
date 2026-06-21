# SPEC — pheno-framework-lint

**Status:** ACTIVE (1 page)
**L5 ID:** L5-110 (this commit), tool ID L73 in 71-pillar v1.1
**Author:** orchestrator (claude opus 4.7)

## Purpose

`pheno-framework-lint` is the canonical L73 (Graduation discipline) measurement
tool in the v1.1 71-pillar framework. It enforces the 4 substrate-tier
conventions from **ADR-023 (App substrate placement)** on every `pheno-*` /
`phenotype-*` / federated-service repo in the fleet.

## Scope

- **In scope:**
  - Classify a repo by name into 1 of 4 tiers (`pheno-*-lib`,
    `phenotype-*-sdk`, `phenotype-*-framework`, `federated-service`).
  - Apply 10 tier-specific rules across the 4 tiers (3 lib + 1 sdk + 4
    framework + 2 federated-service = 10 rules).
  - Emit a JSON `RepoReport` with `inferred_tier`, `violations[]`, `passed[]`.
  - Provide a `check` subcommand (single repo) and `check-all` subcommand
    (fleet walk).
  - Exit 0/1/2 for downstream CI consumption.

- **Out of scope:**
  - No AST parsing; checks are file-presence + grep + regex heuristics.
  - No HTTP / network calls.
  - No third-party Python package dependencies.
  - No business-logic enforcement (only structural tier conformance).

## Tier table (per ADR-023 "App substrate placement")

| Tier | Required | Forbidden |
|---|---|---|
| `pheno-*-lib` | no business logic, no App deps, no `domain/` dir | `domain/` dir, app-level deps in Cargo.toml, controllers/handlers |
| `phenotype-*-sdk` | polyglot consumers (≥ 2 languages) OR ADR-018 PRCP markers | single-language consumer only |
| `phenotype-*-framework` | ≥ 1 Port trait, ≥ 1 Adapter impl, IoC lifecycle, `docs/architecture/` | no Port trait, no Adapter, no architecture doc |
| `federated-service` | long-running binary, Dockerfile / k8s / compose, `/health` or `/readyz` | missing health endpoint, no deployment manifest |

## Design

- **Stdlib-only** — single-file Python (`pheno_framework_lint.py`, 473 LOC),
  imports only `argparse`, `json`, `re`, `sys`, `dataclasses`, `pathlib`,
  `typing`. Zero install footprint.
- **Heuristic-by-design** — false positives accepted; false negatives are
  not. Author review required for promotion PRs (see `PROMOTION.md` in
  `pheno-cargo-template`).
- **JSON-first** — stdout is structured JSON for downstream consumers (CI,
  the 71-pillar weekly refresh, `pheno-otel` log exporters).
- **PEP 621 packaging** — `pyproject.toml` per the `pheno-*` fleet convention;
  console script `pheno-framework-lint`.

## Non-goals

- This tool does NOT replace `phenotype-registry` (which tracks repo
  disposition state) or `pheno-scaffold-kit` (which scaffolds new repos).
  It is a *tier-convention linter*, not a registry or scaffolder.
- This tool does NOT enforce `pheno-vibecoding-guard` pre-commit checks
  (WORKLOG task IDs, AGENTS.md zones) — those are scope-of-pre-commit
  hygiene, not tier policy.

## Cross-references

- ADR-023 (App substrate placement) — the policy this tool enforces.
- ADR-014 (Hexagonal L4 ports) — defines the Port trait / Adapter impl
  pattern.
- ADR-018 (PRCP polyglot) — defines the `pyo3`/`uniffi`/`wasm_bindgen`/
  `grpc` markers.
- `findings/71-pillar-2026-06-19.md:42, 123, 216` — v1.1 scorecard L73 home.
- `findings/2026-06-18-L5-110-pheno-framework-lint-absorption-audit.md` —
  L5-110 audit (this turn).
