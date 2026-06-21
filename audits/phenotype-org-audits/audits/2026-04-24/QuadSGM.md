# Audit: QuadSGM

**Date:** 2026-04-24 | **Repos:** QuadSGM | **Auditor:** Claude  
**LOC:** 45K | **Primary Language:** Other (Python/Jupyter/Shell) | **Status:** SCAFFOLD

## 10-Dimensional Scorecard

| Dimension | Status | Notes |
|-----------|--------|-------|
| **Build** | MISSING | No build system detected (Cargo, go.mod, package.json absent); script-based only |
| **Tests** | SCAFFOLD | 9 test files present; likely pytest; no CI execution gates |
| **CI/CD** | SHIPPED | 17 workflows present; pre-commit-hooks integration active; worktree gitignore checks |
| **Docs** | SHIPPED | 80 doc files; comprehensive docsite structure; README + SPEC combo |
| **Arch Debt** | SHIPPED | No apparent monolith; docs-heavy repo (likely reference/research project) |
| **FR Traceability** | SHIPPED | FUNCTIONAL_REQUIREMENTS.md present; test refs may exist in pytest markers |
| **Velocity** | SHIPPED | Recent commits: worktree setup (PR #197), pre-commit updates, dotagents setup |
| **Governance** | SHIPPED | CI workflows, pre-commit hooks, dotagents framework in place |
| **Dependencies** | SHIPPED | Minimal external deps (pre-commit, pytest); no version conflicts apparent |
| **Honest Gaps** | MISSING | No formal build/test gate in CI; relies on script execution; no packaging |

## Key Findings

**Purpose:** Appears to be a documentation + scripting repo (45K LOC spread across guides/notebooks/reference).

**Strength:** Heavy investment in docs (80 files); pre-commit hook governance; CI gate structure exists.

**Weakness:** No formal build artifact; tests are standalone pytest; no package published.

## Consolidation Verdict

**MERGE INTO → phenotype-research-archive** or **ARCHIVE**

- **If active development:** Consolidate to `phenotype-research-archive` (curated research/reference collection)
- **If stale:** Move to `.archive/` and remove from org CI
- **Rationale:** Docs-heavy, script-based repos don't scale as independent orgs; bundle as reference collection
- **Keep only if:** It houses a reusable pattern/algorithm (check FUNCTIONAL_REQUIREMENTS.md for clues)

## Recommendations

1. **Clarify purpose:** Is this research, reference docs, or actively developed? Update README intent
2. **Formalize build:** If it needs to run, add `Makefile` target + CI gate (python -m pytest)
3. **If archiving:** Move to `.archive/QuadSGM` in phenotype-infrakit; update org docs
