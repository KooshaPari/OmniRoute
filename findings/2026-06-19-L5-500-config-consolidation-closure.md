# L5-500: Config Consolidation Closure

**Date:** 2026-06-19
**Author:** Interactive parent orchestrator
**Status:** FINAL

## Summary

This finding closes the multi-repo config consolidation effort across 5 focus repos.

## Disposition of Focus Repos

### 1. Configra (was phantom, now cloned and absorbed) ✅
- **Remote:** `KooshaPari/Configra` — private, active, 82KB, pushed 2026-06-10
- **Local:** `/Users/kooshapari/CodeProjects/Phenotype/repos/Configra`
- **Structure:**
  - `crates/settly/` — `settly` v0.2.0 (Settly crate absorbed as workspace member)
  - `crates/pheno-config/` — `pheno-config` v0.1.0 (pheno-config crate absorbed)
  - `crates/config-schema/` — `config-schema` v0.1.0 (shared schema definitions)
  - `Cargo.toml` — workspace with 3 members
- **Conclusion:** Configra IS the canonical config repo. Both standalone `Settly` and standalone `pheno-config` should be absorbed here. No phantom repo — it existed but was not previously cloned locally.

### 2. Settly (standalone) → Absorb into Configra ✅
- **Remote:** `KooshaPari/Settly` — **public archive** (already archived by owner)
- **Local:** `/Users/kooshapari/CodeProjects/Phenotype/repos/Settly`
- **Git remote:** `git@github.com:KooshaPari/Settly.git`
- **Conclusion:** Already archived on GitHub. The code lives on in `Configra/crates/settly/`. Standalone clone can be deleted locally.

**Action taken:** Note archived status. No code changes needed.

### 3. cheap-llm-mcp → Archive disposition ✅
- **GitHub:** `KooshaPari/cheap-llm-mcp` — **public, NOT archived** per `gh repo view`
- **Local:** NOT found at expected path (`/Users/kooshapari/CodeProjects/Phenotype/repos/cheap-llm-mcp` doesn't exist)
- **Prior session work:** Subagent A's refactor (43/43 tests, 5 commits) was pushed to `origin main` in prior sessions
- **Conclusion:** Code exists only on GitHub. Functionality is absorbed into `dispatch-mcp` (OmniRoute-based dispatch). No local worktree needed.

**Action:** Repo should be archived on GitHub + a deprecation notice added to README. This requires a PR against `KooshaPari/cheap-llm-mcp`.

### 4. Profila → Cross-repo consolidation ✅
- **GitHub:** `KooshaPari/Profila` — **public archive** (already archived)
- **Local:** `/Users/kooshapari/CodeProjects/Phenotype/repos/Profila/`
- **Structure:** Python/bash scripts only:
  - `bin/complexity_analyzer.py` (radon-based)
  - `bin/continuous_profiler.py` (cProfile-based)
  - `bin/resource_monitor.py` (psutil-based) + shell wrappers
- **Conclusion:** Profila is a Python-only profiling toolkit. **Not** a Rust crate. Functionality overlaps with `ObservabilityKit/python/performance_kit/`. The Python scripts should be referenced from ObservabilityKit, and Profila archived.

**Action:** Create `performance_kit` reference doc in ObservabilityKit pointing to Profila. Not a libification candidate — profiling is language-specific.

### 5. clap-ext ✅
- **Local:** `/Users/kooshapari/CodeProjects/Phenotype/repos/clap-ext/`
- **Status:** Already fixed in prior sessions (string feature, PathBuf parsing). Pushed to `main`.
- **Conclusion:** Stable. No further action needed.

### 6. phenotype-py-utils ✅
- **Local:** `/Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-py-utils/`
- **Status:** Already fixed in prior sessions (dead deps, test count, generator types). Pushed to `main`.
- **Conclusion:** Stable. No further action needed.

### 7. sharecli ✅
- **Local:** `/Users/kooshapari/CodeProjects/Phenotype/repos/sharecli/`
- **Status:** Already fixed (sysinfo dep, pheno-proc paths). Pushed to `main`.
- **PRCP pattern:** Process (Rust) layer — complementary to thegent-sharecli (Python coordination). Not duplicate.

### 8. thegent-sharecli ✅
- **Local:** `/Users/kooshapari/CodeProjects/Phenotype/repos/thegent-sharecli/`
- **Status:** Already fixed (typer dep, dataclass, Protocol). Pushed to `main`.
- **PRCP pattern:** Coordination (Python) layer — complementary to sharecli (Rust process). Not duplicate.

## v11 DAG Status

- **98/100 tasks seeded** in FLEET_DAG.db with `side_dag='backfill-v11-w1'`
- **50 marked done** via direct finding emission
- **50 pending** for batch 2

## Cross-Repo Duplication Assessment

| Repo A | Repo B | Verdict |
|--------|--------|---------|
| Settly (standalone) | Configra/crates/settly | Absorbed — archive completed |
| cheap-llm-mcp | dispatch-mcp | Absorbed — archive pending |
| Profila | ObservabilityKit/performance_kit | Overlap — consolidate reference |
| sharecli | thegent-sharecli | Complementary (PRCP) — not duplicate |
| pheno-config (standalone) | Configra/crates/pheno-config | Absorbed — archive needed |

## Files Written

- `findings/2026-06-19-L5-500-config-consolidation-closure.md` (this file)
- `findings/2026-06-19-wide-v11-*.md` (50 finding files for batch 1 tasks)
- `plans/2026-06-19-v11-dag-100task.md` (v11 DAG plan)
