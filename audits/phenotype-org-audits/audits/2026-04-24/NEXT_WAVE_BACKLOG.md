# Wave-2 Backlog: Next Priorities (2026-04-24 Refresh)

**Wave-1 Status:** 63/109 repos with governance baseline; 38/109 with FR stubs; 22/109 with CI workflows; 15/109 with smoke tests.

**Wave-2 Threshold:** Top-10 opportunities ranked by leverage (effort vs. impact). Each item includes repos affected, estimated effort, and blocking dependencies.

---

## Top 10 Priorities by Leverage

### 1. Complete FR Scaffolding to 100% (71 → 109 repos)

**What:** Add FUNCTIONAL_REQUIREMENTS.md stubs to remaining 38 repos (Batch 2: Tier 2/3 + archived).

**Why:** FR traceability unblocks test-first mandate + spec-kitty specs. 65 repos still lack FRs; this enables cross-org quality gates.

**Repos Affected:** Tier 2 (12): kmobile, kwality, localbase3, McpKit, netweave-final2, org-github, Paginary, phench, phenoDesign, PhenoDevOps, PhenoHandbook, PhenoLibs. Tier 3 (14+): PhenoMCP, PhenoPlugins, PhenoProc, PhenoSpecs, PhenoVCS, PolicyStack, Pyron, ResilienceKit, Tokn, Tracely, Tracera + 8 archived.

**Effort:** 2-3 parallel agents × 30 min = ~50 min wall-clock. Automated template insertion via aggregator script.

**Blocker:** None. Ready to execute.

**Category:** collection-extraction

---

### 2. Extend CI Deployment to 60+ Repos (22 → 60+ repos)

**What:** Deploy quality-gate.yml + fr-coverage.yml + doc-links.yml to remaining 38 repos (Batch 2 CI).

**Why:** 87 repos (80%) lack CI pipelines. Undetected build failures, quality regression, missing FR traceability checks.

**Repos Affected:** All Tier 2/3 + archived repos without workflows.

**Effort:** 3-4 parallel agents × 40 min = ~60 min wall-clock. Use phenotype-tooling workflow templates.

**Blocker:** None (GitHub Actions billing constraint already accounted for in continue-on-error flag).

**Category:** collection-extraction

---

### 3. Fix TS/JS Test Runners (3 repos → 100% executable)

**What:** Configure vitest + jest in 3 repos with pending smoke tests (phenotype-design, cheap-llm-mcp, heliosApp TS/JS components).

**Why:** 3 repos scaffolded smoke tests but cannot execute; CI gates will fail silently.

**Repos Affected:** phenotype-design, cheap-llm-mcp, heliosApp.

**Effort:** 1 agent × 20 min = ~20 min. Use bun/pnpm package managers; copy working vitest config from phenotype-auth-ts.

**Blocker:** None. Reference configs exist.

**Category:** remaining-gaps

---

### 4. Resolve Build Failures + Dep Conflicts (5 repos)

**What:** Triage + fix 5 broken builds (Tokn, argis-extensions, cliproxyapi-plusplus, cloud, tooling_adoption) + 4 dep conflicts (PhenoObservability, canvasApp).

**Why:** Unresolved builds block test execution + CI pipelines. Affects quality gates for critical repos.

**Repos Affected:** Tokn, argis-extensions, cliproxyapi-plusplus, cloud, tooling_adoption, PhenoObservability, canvasApp.

**Effort:** 2-3 agents × 45 min each = ~90 min. Manual dependency triage + cargo/npm lockfile rebuilds.

**Blocker:** None. Root causes identified in SYSTEMIC_ISSUES.md.

**Category:** external-blockers

---

### 5. Upgrade Rust Edition 2015 → 2021 (5-8 repos)

**What:** Migrate repos still on edition 2015 to modern 2021 Cargo.toml.

**Why:** Reduces compiler warnings; enables newer syntax + patterns; aligns with phenotype-infrakit baseline.

**Repos Affected:** KaskMan, KVirtualStage, kmobile, agentkit, agentapi-plusplus (5 confirmed).

**Effort:** 1-2 agents × 30 min = ~40 min. Mechanical change: Cargo.toml edition field + MSRV check.

**Blocker:** None.

**Category:** legacy-decomp

---

### 6. Audit & Fix Dead Code Suppressions (15 repos)

**What:** Review 45+ #[allow(dead_code)], #[allow(unused)], #[allow(clippy::*)] suppressions. Remove unnecessary; add proper justifications for intentional suppressions.

**Why:** Deferred quality debt; masks real issues. Tightens linter enforcement.

**Repos Affected:** AgilePlus, phenotype-infrakit, cliproxyapi-plusplus, and 12 others (15 total from SYSTEMIC_ISSUES).

**Effort:** 1 agent × 60 min = ~60 min. Per-file review; systematic justification addition.

**Blocker:** None.

**Category:** legacy-decomp

---

### 7. Cross-Repo Dependency Version Audit (All 109 repos)

**What:** Audit transitive dependency versions across all repos. Identify conflicts (4 known), upgrade stale deps, consolidate versions where applicable (phenotype-error-core, phenotype-config-core, phenotype-health).

**Why:** Transitive conflicts cause silent breakage. Stale deps (>2 major versions behind) introduce security vulnerabilities + compatibility gaps.

**Repos Affected:** All repos with lockfiles; priority on 4 known conflicts + top 10 largest.

**Effort:** 2 agents × 60 min = ~120 min. Parse lockfiles (Cargo.lock, package-lock.json, go.mod); generate dependency matrix; identify candidates for extraction/consolidation.

**Blocker:** None initially; pending coordination with cross-repo extraction phase.

**Category:** cross-repo-dep-bumps

---

### 8. Documentation Organization & Link Validation (53 repos)

**What:** Audit docs/ structure against CLAUDE.md standards. Fix broken links detected by doc-links.yml. Consolidate scattered README/GUIDE files per org standards.

**Why:** 53 repos (49%) have format anomalies. Broken links undermine discoverability; inconsistent structure confuses contributors.

**Repos Affected:** 53 repos with docs/ (mostly Tier 2/3). Priority: Tier 1 (7) + high-value Tier 2 (10).

**Effort:** 2 agents × 90 min = ~180 min (includes manual link fixes). Automated validation via doc-links.yml.

**Blocker:** None.

**Category:** remaining-gaps

---

### 9. Archive Inactive Repos & Clean Worktrees (8 repos)

**What:** Formally archive 8 inactive/deprecated repos (KaskMan, KDesktopVirt rebuilt, etc.). Clean stale worktrees from repos/.worktrees/ (60+ entries accumulating disk pressure).

**Why:** Orphaned repos consume operational bandwidth + disk space. Stale worktrees clutter git state.

**Repos Affected:** KaskMan, KVirtualStage, KMobileAutomation, localbase, and 4 others marked ARCHIVED in audit.

**Effort:** 1 agent × 40 min = ~40 min. Move to .archive/; remove stale worktrees via `git worktree prune`.

**Blocker:** None. User approval already granted in MEMORY (device-automation repos).

**Category:** external-blockers

---

### 10. Worklog Aggregation & Cross-Repo Pattern Synthesis (All 109 repos)

**What:** Run `worklogs/aggregate.sh all`. Synthesize cross-project patterns from 26 worklogs (current baseline). Produce worklog INDEX + cross-repo opportunities summary.

**Why:** Identifies code duplication, architectural misalignments, reusable components. Feeds into Phase 2 extraction planning (library extraction, module consolidation).

**Repos Affected:** All with worklog entries (26 + Wave 1 additions ~40 total).

**Effort:** 1 agent × 30 min = ~30 min. Parse markdown + aggregate via aggregator script.

**Blocker:** None. Aggregator tool exists in phenotype-tooling.

**Category:** collection-extraction

---

## Summary by Category

| Category | Count | Total Effort | Impact | Priority |
|----------|-------|--------------|--------|----------|
| **collection-extraction** | 3 (FR, CI, worklog) | ~140 min | Org-wide traceability + pipeline | CRITICAL |
| **remaining-gaps** | 2 (TS/JS tests, docs) | ~260 min | Execution + discoverability | HIGH |
| **cross-repo-dep-bumps** | 1 (dep audit) | ~120 min | Security + compatibility | HIGH |
| **legacy-decomp** | 2 (Rust edition, dead code) | ~100 min | Code quality | MEDIUM |
| **external-blockers** | 2 (builds, archival) | ~130 min | Unblock CI + cleanup | MEDIUM |

**Total Wave-2 Effort:** ~750 min (~12.5h) across 5-6 parallel agents. **Wall-clock: ~90-120 min with 4 parallel agents.**

---

## Execution Strategy

### Batch A (CRITICAL — parallel execution)
1. FR Scaffolding (Batch 2): 2 agents × 30 min
2. CI Deployment (Batch 2): 3 agents × 40 min
3. Worklog Aggregation: 1 agent × 30 min

**Exec time:** ~40 min (all parallel).

### Batch B (HIGH — after Batch A)
1. TS/JS Test Runners: 1 agent × 20 min
2. Dep Audit: 2 agents × 60 min

**Exec time:** ~60 min.

### Batch C (MEDIUM — opportunistic)
1. Build Fixes: 2-3 agents × 45 min each
2. Dead Code Audit: 1 agent × 60 min
3. Documentation Org: 2 agents × 90 min
4. Archival: 1 agent × 40 min

**Exec time:** ~120 min (parallel).

---

**Report Date:** 2026-04-24  
**Next Review:** Post-wave-2 completion (~2h from start)  
**Target Org Health Index:** 35% SHIPPED (from 17%), 80%+ FR coverage, 70%+ CI deployment, 5% UNKNOWN.
