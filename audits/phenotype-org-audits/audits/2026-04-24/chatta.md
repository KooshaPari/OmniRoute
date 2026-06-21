# Audit: chatta

**Date:** 2026-04-24 | **Size:** 497,903 LOC | **Primary Language:** Unknown (data-heavy)

## Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Code Maturity** | 2/10 | 4 commits; likely dataset or generated |
| **Test Coverage** | 0/10 | No tests |
| **CI/CD Health** | 7/10 | GitHub Actions present |
| **Documentation** | 5/10 | README + docs/; minimal |
| **Modularity** | 2/10 | 1,862 files; data-heavy structure |
| **Code Quality** | 2/10 | Unclear content; not code-like |
| **Dependency Health** | 1/10 | No dependencies |
| **API Surface** | 1/10 | Not applicable |
| **Security Posture** | 2/10 | Unclear |
| **Consolidation Readiness** | 1/10 | Data artifact |

**Overall:** 23/100 (Archive candidate)

## Findings

- **Status:** Large data repository or dataset dump
- **Architecture:** 1.8K files suggests data collection, not application code
- **Key Risk:** Unmaintainable; unclear purpose
- **Candidate Action:** Archive or evaluate for datasets subproject

## Consolidation Verdict

**ARCHIVE.** This appears to be a dataset or large data repository. Move to `.archive/` or create `phenotype-datasets` subproject if content is reusable.
