# Systemic Issues — Cross-Repo Patterns (Post-Intervention 2026-04-24)

Issues affecting 2+ repos (architectural/governance problems). **Updated to reflect post-intervention state.**

## Impact Summary

| Issue | Before | After | Δ | Status |
|-------|--------|-------|---|--------|
| Weak/missing governance | 53 repos | 28 repos | -25 (-47%) | Batch 1 deployed; Batch 2 pending |
| Missing FR traceability | 50 repos | 33 repos | -17 (-34%) | FR stubs scaffolded in 38 repos |
| Missing test coverage | 48 repos | 33 repos | -15 (-31%) | Smoke tests in 15 repos |
| Missing CI/CD pipeline | 42 repos | 20 repos | -22 (-52%) | Quality-gate workflows deployed |
| Build failures | 5 repos | 5 repos | — | Unresolved (dep + compiler issues) |
| Dep conflicts | 4 repos | 4 repos | — | Unresolved (canvasApp, cliproxy, cloud, PhenoObs) |

## Top Issues (Remaining)

### 1. Missing FR traceability/documentation (Affects 33 repos)

**DOWN from 50 repos** via FR scaffolding wave. Remaining 33 need content review + implementation.

**Repos**: Archived/unclassified + Tier 3 backlog (DataKit, DevHex, go-nippon, governance_adoption, KlipDot, McpKit, netweave-final2, org-github, PhenoPlugins, PhenoSpecs, PhenoVCS, PlatformKit, rich-cli-kit, + others).

### 2. Missing or broken CI/CD pipeline (Affects 20 repos)

**DOWN from 42 repos** via CI deployment. Remaining 20 are Tier 2/3 + archived awaiting batch extension.

**Repos**: CONSOLIDATION_MAPPING, Conft, DataKit, DevHex, go-nippon, governance_adoption, KlipDot, McpKit, PhenoPlugins, PhenoSpecs, PlatformKit, rich-cli-kit, test_scaffolding, thegent-dispatch, thegent-workspace, + archived/inactive.

### 3. Missing or broken test coverage (Affects 33 repos)

**DOWN from 48 repos** via smoke-test scaffolding. Remaining 33 need language-specific harness completion.

**Repos**: Same cohort as CI/CD above; TS/JS repos pending vitest config; documentation-only repos excluded.

### 4. Weak or missing governance frameworks (Affects 28 repos)

**DOWN from 53 repos** via Batch 1 deployment. Remaining 28 are Batch 2/3 targets (Tier 2/3 + archived).

**Repos**: Tier 2 (12): kmobile, kwality, localbase3, McpKit, netweave-final2, org-github, Paginary, phench, phenoDesign, PhenoDevOps, PhenoHandbook, PhenoLibs.
**Tier 3 (14):** PhenoMCP, PhenoObservability, PhenoPlugins, PhenoProc, PhenoSchema, PhenoSpecs, PhenoVCS, PlatformKit, PlayCua, PolicyStack, Pyron, ResilienceKit, TestingKit, Tokn, Tracely, Tracera, VirtualEngine.
**Archived (8):** Intentionally skipped.

### 5. Build failures across repos (Affects 5 repos)

**Unchanged (5 repos).** Requires manual triage + dependency resolution.

**Repos**: Tokn (build error), argis-extensions (import), cliproxyapi-plusplus (version conflict), cloud (resolver issue), tooling_adoption (binary pending).

### 6. Dependency version conflicts or broken imports (Affects 4 repos)

**Unchanged (4 repos).** Needs version bump + lockfile rebuild.

**Repos**: PhenoObservability (transitive), argis-extensions (direct), canvasApp (peer), cliproxyapi-plusplus (core).

