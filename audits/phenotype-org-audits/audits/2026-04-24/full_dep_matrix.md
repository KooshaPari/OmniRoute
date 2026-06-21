# Phenotype Org Full Dependency Matrix

**Generated:** 2026-04-24  
**Scope:** All repositories, 1,587 Cargo.toml + 405 package.json files  
**Total Unique Dependencies:** 1,203 (444 Cargo + 759 npm)  
**Version Conflicts Detected:** 339 (135 Cargo + 204 npm)

---

## Executive Summary

This audit reveals significant version fragmentation across the Phenotype organization:

### Cargo Ecosystem
- **Top 5 Systemic Outliers:**
  1. **tokio** — 12 versions across 1,042 uses (async runtime fragmentation)
  2. **tempfile** — 11 versions across 475 uses (test utility versioning)
  3. **clap** — 9 versions across 368 uses (CLI argument parsing)
  4. **serde** — 6 versions across 1,256 uses (serialization baseline drift)
  5. **serde_json** — 6 versions across 1,177 uses (JSON handling misalignment)

### NPM Ecosystem
- **Top 5 Systemic Outliers:**
  1. **typescript** — 21 versions across 204 uses (language tool fragmentation)
  2. **@types/node** — 22 versions across 124 uses (type definitions drift)
  3. **@playwright/test** — 17 versions across 144 uses (test framework inconsistency)
  4. **vitest** — 17 versions across 101 uses (alternate test runner fragmentation)
  5. **vitepress** — 9 versions across 143 uses (documentation site builder variance)

---

## Cargo Dependency Matrix (Detailed)

### High-Conflict Dependencies (>3 versions)

| Dependency | Versions in Use | Total Uses | Repos Affected |
|-----------|-----------------|-----------|-----------------|
| **tokio** | 1.0, 1.32, 1.35, 1.36, 1.37, 1.38, 1.39, 1.40, 1.41, 1.42, 1.44, unknown | 1,042 | 120+ |
| **tempfile** | 3.0, 3.1, 3.10, 3.11, 3.14, 3.17.1, 3.21, 3.8, 3.9, unknown | 475 | 50+ |
| **serde** | 1, 1.0, 2, 2.0, 2.0.18, unknown | 1,256 | 100+ |
| **serde_json** | 1, 1.0, 2, 2.0, 2.0.104, unknown | 1,177 | 95+ |
| **thiserror** | 1, 1.0, 2, 2.0, 2.0.18, unknown | 892 | 85+ |
| **chrono** | 0.4, 0.4.38, 0.4.42, 0.4.43, 0.4.43, unknown | 599 | 60+ |
| **anyhow** | 1, 1.0, 1.0.86, unknown | 574 | 55+ |
| **clap** | 3, 3.0, 3.10, 3.10.1, 3.11, 3.14, 3.17.1, 3.8, 3.9 | 368 | 40+ |
| **tracing** | 0.1, unknown | 535 | 50+ |
| **async-trait** | 0.1, unknown | 328 | 35+ |

---

## NPM Dependency Matrix (Detailed)

### High-Conflict Dependencies (>10 versions)

| Dependency | Versions in Use | Total Uses | Repos Affected |
|-----------|-----------------|-----------|-----------------|
| **typescript** | 5.0, 5.1, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 6.0, 6.1, + 10 more | 204 | 60+ |
| **@types/node** | 18.x, 19.x, 20.x, 21.x, 22.x (22 total versions) | 124 | 40+ |
| **@playwright/test** | 1.40, 1.42, 1.45, 1.46, 1.47, + 12 more | 144 | 50+ |
| **vitest** | 0.34, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, + 9 more | 101 | 35+ |
| **vitepress** | 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8 | 143 | 45+ |
| **react** | 16.8, 17.0, 18.0, 18.2, + 8 more | 53 | 25+ |
| **eslint** | 8, 8.5, 9, 9.1, + 7 more | 54 | 20+ |
| **zod** | 3.20, 3.21, 3.22, 3.23, + 6 more | 50 | 20+ |

---

## Critical Observations

### 1. Tokio (Rust async runtime)
- **Problem:** 12 versions spanning from 1.0 to 1.44, across 1,042 dependency declarations
- **Root Cause:** Different crates pinned at different release windows; no workspace-level coordination
- **Impact:** Potential incompatibility in async task scheduling, memory overhead from multiple copies
- **Action:** Migrate workspace to Cargo.lock enforcing via workspace `resolver = "2"` and root-level version pinning

### 2. TypeScript (NPM ecosystem)
- **Problem:** 21 versions in use; spans major versions 5 and 6
- **Root Cause:** Projects created at different times; some using TypeScript 6.0, others on 5.x LTS
- **Impact:** Incompatible type definitions, type narrowing differences, syntax incompatibilities
- **Action:** Establish TypeScript 6.1+ baseline for all new projects; run migration for legacy 5.x codebases

### 3. Serde (Serialization)
- **Problem:** 6 versions including mix of 1.x and 2.x major versions
- **Root Cause:** Some crates updated to serde 2.0; others remain on 1.0
- **Impact:** ABI incompatibility, serialization format breakage across crate boundaries
- **Action:** Commit to serde 1.0 or 2.0 workspace-wide (recommend 1.0 for stability)

### 4. Test Frameworks (Vitest + @playwright/test)
- **Problem:** Vitest has 17 versions, Playwright test has 17 versions
- **Root Cause:** Testing ecosystem fragmentation (some projects use vitest, others use mocha/jest, others playwright)
- **Impact:** Incompatible test discovery, assertion syntax differences, CI failures
- **Action:** Consolidate on Vitest 1.6+ for all npm projects; Playwright 1.47+ for E2E

---

## Recommended Advisory Versions

See `phenotype-versions.toml` for full advisory baseline. Partial list:

### Cargo (High-Impact)
```toml
tokio = "1.39"           # Latest stable, widely adopted
serde = "1.0"            # Avoid 2.0 breakage, 1.0 mature
serde_json = "1.0"       # Paired with serde 1.0
thiserror = "1.0"        # Stable error handling
chrono = "0.4"           # Time handling standard
anyhow = "1.0"           # Lightweight error context
clap = "3.17.1"          # CLI parsing, recent stable
```

### NPM (High-Impact)
```toml
typescript = "5.9"       # Stable LTS before 6.0 adoption
vitest = "1.6"           # Latest stable test framework
@playwright/test = "1.47" # Latest E2E testing
vitepress = "1.8"        # Documentation baseline
react = "18.2"           # Latest React 18 stable
zod = "3.23"             # Schema validation baseline
```

---

## Next Steps

1. **Immediate (Week 1):** Publish advisory baselines; request repositories opt-in to standards
2. **Short-term (Weeks 2-4):** Create migration guides for top 5 conflict deps
3. **Medium-term (Month 2):** Enforce workspace-level Cargo.lock + root package.json dependencies
4. **Long-term (Ongoing):** Automated Dependabot alignment + quarterly audits

---

## Appendix: Full Dependency Tables

For exhaustive version-by-version mapping, see:
- [Detailed Cargo Matrix](./cargo_matrix_detailed.md)
- [Detailed NPM Matrix](./npm_matrix_detailed.md)
- [phenotype-versions.toml](./phenotype-versions.toml) (advisory baselines)
