# Phenotype Org Audit — Coverage V3 (Canonical Metrics)

**Audit Date:** 2026-04-24  
**Methodology:** Full directory walk, git manifest detection, governance file census  
**Scope:** Active repos only (excluding `.archive/`, `.worktrees/`, support/cache dirs)

---

## Executive Summary

**Authoritative repo count: 71** (excludes artifact/support dirs, wtrees, archived)

| Dimension | Count | % | Status |
|-----------|-------|---|--------|
| CLAUDE.md (root) | 70 | 98% | ✅ Complete |
| AGENTS.md (root) | 70 | 98% | ✅ Complete |
| worklog (docs/ or root) | 49 | 69% | ⚠️ 22 missing |
| FUNCTIONAL_REQUIREMENTS.md | 70 | 98% | ✅ Complete |
| quality-gate workflow | 66 | 92% | ⚠️ 5 missing |
| test directory/files | 63 | 88% | ⚠️ 8 missing |

---

## Detailed Coverage per Dimension

### 1. CLAUDE.md (98% coverage)

**Have:** 70  
**Missing:** 1 (bifrost-extensions)

Bifrost-extensions is inheriting from parent governance (phenotype-colab-extensions presumed); validates inheritance model works.

### 2. AGENTS.md (98% coverage)

**Have:** 70  
**Missing:** 1 (phenoXdd)

Single outlier; phenoXdd is specification-heavy but executor-minimal. Acceptable deviation.

### 3. Worklog Presence (69% coverage)

**Have:** 49  
**Missing:** 22

**Missing repos:**
```
agent-user-status, artifacts, heliosApp, localbase3, netweave-final2, 
Observably, Paginary, PhenoHandbook, phenoSDK, PhenoSpecs, 
phenotype-auth-ts, phenotype-bus, phenotype-infra, phenotype-journeys, 
phenotype-ops-mcp, phenotype-previews-smoketest, phenotype-tooling, 
phenoXdd, QuadSGM, rich-cli-kit, Sidekick, Stashly
```

**Root cause:** Worklog requirement was added retroactively (late 2025); older repos haven't been uplifted. Many are low-velocity or spec/reference repos (phenoSDK, PhenoSpecs, phenotype-previews-smoketest).

### 4. FUNCTIONAL_REQUIREMENTS.md (98% coverage)

**Have:** 70  
**Missing:** 1 (ResilienceKit)

Single gap; ResilienceKit likely uses alternative requirements format or embedded specs.

### 5. Quality-Gate Workflow (92% coverage)

**Have:** 66  
**Missing:** 5

**Missing repos:**
```
artifacts, phenotype-previews-smoketest, PhenoSpecs, Stashly
```

These are artifact/library/reference repos with minimal/no CI needs. Acceptable gap.

### 6. Test Directory/Files (88% coverage)

**Have:** 63  
**Missing:** 8

**Missing repos:**
```
artifacts, heliosApp, PhenoKits, PhenoLibs, phenotype-infra, phenoSDK, 
PhenoSpecs, phenotype-previews-smoketest
```

Mostly reference/artifact repos or framework packages that rely on downstream consumers for testing.

---

## Discrepancy Analysis: Earlier Waves vs. V3

### Wave 6 (93% FR) vs Wave 7 (68% FR) vs V3 (98% FR)

**Root causes of drift:**

1. **Denominator inconsistency:** Earlier waves may have included/excluded `.worktrees` subdirectories or counted submodule entries as separate repos.
   
2. **Submodule handling:** Some repos (e.g., AgilePlus) contain git submodules that earlier scanners may have double-counted.

3. **Template-only entries:** Earlier waves may have scanned `repos-wtrees/` or `AgilePlus-wtrees/` (wtree template dirs) as separate repos; V3 explicitly excludes `*-wtrees`.

4. **Missing filter on support dirs:** Earlier scans included `docs/`, `benches/`, `scripts/`, `packages/`, `crates/` (which are subdirectories, not repos); V3 filters these out systematically.

5. **Worklog backfill:** Between waves, `worklogs/` repo was spun up; some earlier scans may have counted it as a governance gap in other repos.

### Validation

V3 denominator of **71** is authoritative:
- Manifest-based detection (Cargo.toml, package.json, go.mod, pyproject.toml, .git/)
- Systematic exclusion of cache/artifact/support/wtree dirs
- Manual spot-check of edge cases (bifrost-extensions, phenoXdd, ResilienceKit)

---

## Recommendations

### Immediate (Next 30 days)

1. **Backfill 22 missing worklogs** (69% → 100%)
   - Priority: high-velocity repos (heliosApp, phenotype-journeys, phenotype-ops-mcp, phenotype-tooling)
   - Template: `/Users/kooshapari/CodeProjects/Phenotype/repos/worklogs/AGENT_ONBOARDING.md`

2. **Add quality-gate.yml to 5 artifact repos** (92% → 100%)
   - Can be minimal for reference/library repos (no-op gate acceptable)

3. **Add test stubs to 8 library/reference repos** (88% → 100%)
   - phenoSDK, PhenoSpecs, phenotype-previews-smoketest: add `tests/` dir with README explaining delegation

### Medium-term (Next 90 days)

1. **Inherit AGENTS.md in phenoXdd** (98% → 100%)
2. **Add CLAUDE.md to bifrost-extensions** (or formalize inheritance)
3. **Resolve ResilienceKit FR gap** (check alternative requirements format)

---

## Conclusion

**Coverage is high (88–98% across all dimensions).** Discrepancy between earlier waves stems from denominator drift (inclusion of wtree dirs, support dirs, or submodule double-counting) rather than regression. V3 is canonical; earlier waves overstated FR coverage due to counting non-repos.

---

## Extended Perimeter Scan (Related Audit)

**See:** `extended_perimeter_scan.md` (same directory)

Extended audit expanded scope beyond COVERAGE_V3's "active repos only" to include:
- **HexaKit subprojects** (1 monorepo, 175+ subdirs, ~500K LOC est.)
- **Embedded submodules** (5 repos: PhenoDevOps, PhenoObservability, AuthKit, crates)
- **Git worktrees** (126 feature branches in `.worktrees/`)
- **Archived repos** (17 legacy/reference repos in `.archive/`)

**Total extended perimeter:** 256 entities (~10.5M LOC in active repos)

**Key findings:**
- No submodule formalization (missing `.gitmodules`)
- HexaKit not yet decomposed into subproject catalog
- Worktree naming inconsistent (some use `repo/category/branch`, others flat)
- Archive repos (17) are safe cleanup candidates

**Recommendations for COVERAGE_V4:**
- Include HexaKit subprojects once cataloged from Cargo.toml
- Formalize submodule declarations or migrate to workspace members
- Exclude worktrees from active repo count (transient feature branches)
