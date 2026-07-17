# Systemic Issues — Cross-Repo Patterns (V3 Reconciliation 2026-04-24)

Issues affecting 2+ repos (architectural/governance problems). **V3 canonical baseline (71 active repos) reveals denominator drift from earlier waves; metrics reconciled.**

## V3 Canonical Metrics (71 Active Repos)

| Issue | Repos Affected | % | Status |
|-------|----------------|---|--------|
| Missing worklog | 22 | 31% | ⚠️ Backfill required (low-velocity + ref repos) |
| Missing quality-gate | 5 | 7% | ✅ Acceptable (artifact/reference repos) |
| Missing tests | 8 | 11% | ✅ Acceptable (lib/reference delegate to consumers) |
| Weak/missing CLAUDE.md | 1 | 1% | ✅ Bifrost-extensions inherits |
| Missing AGENTS.md | 1 | 1% | ✅ phenoXdd specification-only |
| FR doc gaps | 1 | 1% | ⚠️ ResilienceKit (alternative format) |

## Top Issues (Remaining by V3)

### 1. Missing worklog documentation (22 repos, 31%)

**Root cause:** Worklog requirement was added retroactively (late 2025); older repos haven't been uplifted. Low-velocity + reference repos dominate this cohort.

**Priority repos for backfill:**
- High-velocity: heliosApp, phenotype-journeys, phenotype-ops-mcp, phenotype-tooling
- Medium-velocity: phenotype-infra, phenotype-bus, phenotype-auth-ts
- Reference/archive: phenoSDK, PhenoSpecs, phenotype-previews-smoketest (document delegation model instead)

### 2. Missing quality-gate workflows (5 repos, 7%)

**Acceptable gap:** All 5 are artifact/reference/library repos without active CI needs.

**Repos**: artifacts, phenotype-previews-smoketest, PhenoSpecs, Stashly, (1 unlabeled)

### 3. Missing test directories (8 repos, 11%)

**Acceptable gap:** Most are reference/library repos; testing delegated to downstream consumers.

**Repos**: artifacts, heliosApp, PhenoKits, PhenoLibs, phenotype-infra, phenoSDK, PhenoSpecs, phenotype-previews-smoketest

**Unchanged (4 repos).** Needs version bump + lockfile rebuild.

**Repos**: PhenoObservability (transitive), argis-extensions (direct), canvasApp (peer), cliproxyapi-plusplus (core).

