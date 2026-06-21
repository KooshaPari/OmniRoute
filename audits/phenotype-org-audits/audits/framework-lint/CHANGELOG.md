# Changelog — pheno-framework-lint

All notable changes to this project are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-18 → 2026-06-19

### Added (L5-110 governance batch, 2026-06-19)

- `AGENTS.md` — agent-facing project overview, key commands, conventions,
  v1.1 71-pillar L73 cross-references, sibling-tool (L72/L74) refs.
- `LICENSE` (MIT) — matches the `pheno-*` fleet convention; claimed in
  README since initial commit.
- `pyproject.toml` — PEP 621 packaging; console script
  `pheno-framework-lint`; `pip install -e .[test]` for the test extra.
- `deny.toml` — pip-audit + liccheck configuration (Python equivalent of
  cargo-deny). Allowlists MIT, Apache-2.0, BSD-2/3-Clause, ISC, MPL-2.0,
  Python-2.0, Unlicense, CC0-1.0; bans GPL/AGPL/LGPL/SSPL/Commons-Clause.
- `SPEC.md` — 1-page spec: purpose, scope, tier table, design, non-goals.
- `CHANGELOG.md` — this file.
- `.github/workflows/ci.yml` — 3-step CI: checkout, `python -m py_compile`,
  `python -m unittest discover tests`.
- `tests/test_smoke.py` — 5 unit tests covering the 10 rules:
  1. `test_infer_tier` — name → tier classification.
  2. `test_pheno_lib_no_domain` — `domain/` dir trigger.
  3. `test_phenotype_sdk_polyglot` — single-language SDK failure.
  4. `test_phenotype_framework_port_trait` — Port-trait detection.
  5. `test_federated_service_health_endpoint` — health-endpoint detection.

### Added (initial commit, 2026-06-18)

- `pheno_framework_lint.py` (473 LOC) — stdlib-only Python linter.
- `README.md` (124 lines) — install, usage, rule reference, CI integration.
- Commit `9862abe` — `feat: initial commit — predictive-DRY substrate tool`.

### Known issues (forward-looking, deferred)

- The v1.0 ADR-042 (`docs/adr/2026-06-18/ADR-042-security-audit-cadence.md`)
  is about security audit cadence, not substrate graduation. The v1.1 L73
  plan (`findings/71-pillar-2026-06-19.md:42, 123, 216`) names ADR-048 as
  the L73 home, which is a doc-numbering collision. Resolution: write a
  dedicated `docs/adr/2026-06-19/ADR-042-graduation-discipline.md` or
  rephrase the README to "planned v1.1 L73 ADR (TBD)".
- The `findings/71-pillar-2026-06-17-schema.md` reference in the README
  § "Schema" should be updated to the v1.1 schema once
  `findings/71-pillar-2026-06-19-schema.md` is authored.

[0.1.0]: https://github.com/KooshaPari/pheno-framework-lint/releases/tag/v0.1.0
