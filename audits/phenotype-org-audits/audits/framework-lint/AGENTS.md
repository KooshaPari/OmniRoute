# AGENTS.md — pheno-framework-lint

**Date:** 2026-06-19
**Status:** ACTIVE
**Substrate tier:** `pheno-*-lib` (single-concern Python linter, stdlib-only)
**Owner:** KooshaPari

---

## What this repo is

`pheno-framework-lint` is the **canonical L73 (Graduation discipline) tool** in
the v1.1 71-pillar framework (see `findings/71-pillar-2026-06-19.md:42, 123, 216`).
It is a 473-line stdlib-only Python script that enforces the 4 substrate-tier
conventions from ADR-023 (App substrate placement), ADR-014 (Hexagonal L4 ports),
and ADR-018 (PRCP polyglot reuse).

**What it does**: classifies a repo by name into one of 4 substrate tiers
(`pheno-*-lib`, `phenotype-*-sdk`, `phenotype-*-framework`, `federated-service`)
and applies tier-specific rules to check the codebase for structural compliance.

**What it does NOT do**: it does not enforce business-logic rules, does not
parse ASTs, does not make HTTP calls, and does not require any third-party
Python package.

---

## v1.1 71-pillar framework cross-references

- **L73 (Graduation discipline)** — the script is the L73 measurement
  instrument. See `findings/71-pillar-2026-06-19.md:216`.
- **L73 forward-looking ADR**: ADR-048 (L73 = graduation discipline per the v1.1
  plan). The current v1.0 ADR-042 is `docs/adr/2026-06-18/ADR-042-security-audit-cadence.md`
  (different subject — a doc-numbering collision the L5-110 audit flagged).
- **Sibling tools**: L72 (predictive) is `KooshaPari/pheno-predict`; L74 (drift)
  is `KooshaPari/pheno-drift-detector`. All three were created 2026-06-18 as the
  v8 sweep's PAX-domain governance additions.

---

## Key commands

```bash
# Single repo check
./pheno_framework_lint.py check --path ../pheno-config

# Fleet-wide check (JSON output)
./pheno_framework_lint.py check-all --root .. --out fleet-violations.json

# Tests
pytest tests/ -v

# Or via the installed console script
pheno-framework-lint check --path ../pheno-config
```

---

## Conventions

- **No third-party deps.** The script imports only stdlib (`argparse`, `json`,
  `re`, `sys`, `dataclasses`, `pathlib`, `typing`).
- **PEP 621** `pyproject.toml` for packaging. Install with `pip install -e .[test]`.
- **Conventional Commits** for commit messages.
- **Branch prefix**: `chore/l5-110-...` for L5-110-batch governance work; `feat/...`
  for new rules; `fix/...` for bug fixes.

---

## Related

- `pheno-predict` (L72) — predictive-DRY candidate scanner
- `pheno-drift-detector` (L74) — app-substrate drift detector
- `phenotype-tooling` — reusable CI workflow templates
- `AGENTS.md` (monorepo) — fleet-wide conventions, ADR table, app-level repo triage
- `findings/71-pillar-2026-06-19.md` — v1.1 71-pillar scorecard
- `findings/2026-06-18-L5-110-pheno-framework-lint-absorption-audit.md` — L5-110 audit
