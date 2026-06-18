# Consolidation Final QA Report — 2026-06-14

## Repos Audited & Fixed

| Repo | Language | Status | Fixes Applied | Pushed |
|------|----------|--------|---------------|--------|
| clap-ext | Rust | Fixed | comp errors + panics | Yes |
| phenotype-py-utils | Python | Fixed | dead deps, tests, types | Yes |
| sharecli | Rust | Fixed | broken build (sysinfo, paths) | Yes |
| thegent-sharecli | Python | Fixed | typer dep, dataclass, Protocol | Yes |
| cheap-llm-mcp | Python | Archived | gitignore + archive final | Yes |

## Cross-Repo Duplication Analysis

### Rust Config Crates — Consolidation Candidates
| Crate | Overlap | Decision |
|-------|---------|----------|
| Configra | Phenotype-org config framework | Keep as Rust native |
| Settly | Layered configs, validation | **Archive/merge into Configra** |
| pheno-config | Figment-based config | **Merge into Configra** |
| pheno-context | Context management | **Absorb into Configra** |
| phenotype-config | Configuration in FocalPoint | **Migrate to Configra API** |

### CLI/Process Manager — Consolidation

| Repo | Stack | Decision |
|------|-------|----------|
| sharecli | Rust CLI manager | **Keep as Rust canonical** |
| thegent-sharecli | Python CLI manager | **Deprecate** — all features ported |
| thegent-dispatch | Rust dispatch | **Use sharecli as unified CLI** |

### Python Utilities

| Crate | Overlap | Decision |
|-------|---------|----------|
| phenotype-py-utils | Load config, logging, args | **Keep** — no Rust equiv |
| phenotype-py-extras | Extra Python utils | **Merge into py-utils** |

## AgilePlus Workspace
- `pheno/agileplus/Cargo.toml` — workspace root with 28 members
- All crates have valid Cargo.toml
- Ready for `cargo build` at workspace level

## Sparse Checkout & Branch State

### FocalPoint (meta-repo)
- Branch `chore/l5-87-focus-repo-specs-2026-06-11`: 58 ahead, 19 behind main
- Cannot create PR (token lacks collaborator access)
- **Next**: Push to trigger GitHub merging by collaborator

### Cleaning
- Stashes: 1 dropped (pre-rebase-snapshot — stale)
- Worktrees: 0 remaining in meta-repo
- 200+ submodule dirs exist as local copies (not git worktrees)

## Open Gaps

1. **PR creation** for focus-repo-specs branch (57 commits) — needs collaborator
2. **Configra/Settly/pheno-config consolidation** — code-level merge pending
3. **sharecli/thegent-sharecli deprecation** — Python version archived
4. **Profila** — needs review for phenotype-profiling consolidation
5. **phenoVessel/phenoTypes** — already archived, no action needed