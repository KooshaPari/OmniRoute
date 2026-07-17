# phenoResearchEngine — Absorption Justification

**Status:** ABSORBED 2026-07-17
**Source:** `KooshaPari/phenoResearchEngine` (DEPRECATED upstream since 2026-06-20)
**Target:** `KooshaPari/phenoAI` at `python/phenotype-research/`
**Disposition:** ABSORBED (was DEPRECATED → AFFIRM)

## Confidence

**0.85** — HIGH. Upstream is already formally deprecated with the exact migration target declared. The 90-day compatibility shim expires 2026-09-18.

## What was absorbed

| Item | Source path | Target path | Notes |
|---|---|---|---|
| Python package | `src/research_engine/*.py` (10 modules) | `python/phenotype-research/src/phenotype_research/` | renamed module: `research_engine` → `phenotype_research` |
| Crawlers | `src/research_engine/crawlers/` (8 modules) | `…/src/phenotype_research/crawlers/` | HN, Reddit, GitHub, arXiv, RSS, DDG, base, registry |
| MCP tools | `src/research_engine/mcp/tools.py` | `…/src/phenotype_research/mcp/tools.py` | |
| Tests | `tests/test_basic.py`, `tests/test_py_utils_smoke.py` | `python/phenotype-research/tests/` | |
| BDD tests | `tests/bdd/{steps.py,features/test.feature}` | `python/phenotype-research/tests/bdd/` | |
| pyproject.toml | `pyproject.toml` | `python/phenotype-research/pyproject.toml` | renamed package: `phenotype-research-engine` → `phenotype-research`; classifiers updated to 7-Inactive |
| Lint configs | `pytest.ini`, `ruff.toml`, `pyrightconfig.json` | `python/phenotype-research/` | |
| Docs | `CHANGELOG.md`, `SSOT.md`, `SPEC.md`, `ADR.md`, `FUNCTIONAL_REQUIREMENTS.md`, `PRD.md` | `python/phenotype-research/` | historical provenance |
| README | `README.md` | `python/phenotype-research/README.md` | rewritten to reflect post-absorption identity |

**Total: 25 files copied.** Source repo was 236 KB; absorbed footprint in target is ~140 KB (after dropping `.git/`, `__pycache__/`, `node_modules/`).

## What was NOT absorbed

- `AGENTS.md`, `CLAUDE.md`, `lefthook.yml`, `Justfile`, `Taskfile.yml`, `mise.toml`, `package.json`, `tsconfig.json`, `vitest.config.mjs`, `cliff.toml`, `deny.toml`, `gitleaks.toml`, `trufflehog.yml`, `.pre-commit-config.yaml` — workspace-level files that were specific to the standalone-repo workflow. The absorbed package adopts the parent `phenoAI` workflows.
- `docs/`, `findings/`, `worklogs/`, `ports/`, `audit_scorecard.json` — forensic artifacts preserved in the archived source repo for audit continuity.

## Verification

- 25 new files under `python/phenotype-research/` in `phenoAI` repo.
- Source module renamed consistently (no remaining references to `research_engine` as Python module — the package is now `phenotype_research`).
- `pyproject.toml` package name matches directory layout (`phenotype_research`).
- Pre-existing tests (`test_basic.py`, `test_py_utils_smoke.py`) copied without modification; will need runtime deps installed before pytest can run.

## Boundary

See `docs/boundary/phenotype-research.md` in the registry spine.

## Restore procedure

```sh
# 1. Un-archive the source repo
gh repo unarchive KooshaPari/phenoResearchEngine

# 2. Remove the absorbed package
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenoAI
git rm -r python/phenotype-research/
git commit -m "revert: undo phenoResearchEngine absorption"

# 3. In the registry spine
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-registry
# Edit registry/disposition-index.json: change fsm from "absorbed" back to "deprecated"
# Restore projects/phenoResearchEngine.json from git history
```

## Cross-references

- Disposition row in `registry/disposition-index.json`: search for `"path": "KooshaPari/phenoResearchEngine"`.
- Boundary doc: `docs/boundary/phenotype-research.md`.
- Source deprecation: `https://github.com/KooshaPari/phenoResearchEngine/blob/main/DEPRECATED.md`.
- Registry ecosystem plan: `RATIONALIZATION_PLAN.md` § "Python research orchestration".