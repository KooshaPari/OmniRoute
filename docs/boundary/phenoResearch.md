---
repo: "phenoResearchEngine"
role: research
status: absorbed
absorbed_into: "pheno (monorepo)"
absorbed_at: "pheno/phenotype-research-engine/"
absorbed_date: 2026-07-17
last_boundary_review: 2026-07-17
review_cadence: never (absorbed)
---

# Boundary — phenoResearchEngine (ABSORBED)

## Disposition

**ABSORBED** into `pheno/phenotype-research-engine/` on 2026-07-17.

The phenoResearchEngine repo was a deprecated Python research/investigation service
(236KB, 30 branches). Its code has been moved to the empty `phenotype-research-engine/`
directory in the `pheno` monorepo, which was pre-allocated for this purpose.

## Content migrated

| Category | Count | Target path |
|----------|-------|-------------|
| Python source | 6 modules + 7 crawlers + MCP | `pheno/phenotype-research-engine/src/research_engine/` |
| Tests | 5 test files + BDD | `pheno/phenotype-research-engine/tests/` |
| Docs | SSOT, journeys, operations, retrieval, sessions | `pheno/phenotype-research-engine/docs/` |
| Config | pyproject.toml, setup.py, Justfile, etc. | `pheno/phenotype-research-engine/` |
| GitHub workflows | CI, coverage, SAST, release, scorecard | `pheno/phenotype-research-engine/.github/workflows/` |
| AgilePlus specs | Specs, tasks, ADRs | `pheno/phenotype-research-engine/.agileplus/` |
| Ports (TS) | Retriever, search backend, adapters | `pheno/phenotype-research-engine/ports/` |

Total: 140 files, 175 items (incl. directories).

## Outcome

Source repo `KooshaPari/phenoResearchEngine` archived on GitHub.
Registry disposition-index updated: disposition=ABSORB, target=pheno (monorepo).
