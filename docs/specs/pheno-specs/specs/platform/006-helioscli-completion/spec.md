# Spec: heliosCLI Completion

## Meta

- **ID**: 006-helioscli-completion
- **Title**: heliosCLI Multi-Runtime Agent CLI Completion
- **Created**: 2026-03-25
- **State**: specified
- **Repo**: /Users/kooshapari/CodeProjects/Phenotype/repos/heliosCLI

## Overview

Complete heliosCLI multi-runtime AI coding CLI (153 commits since 2025-01-01).

## Architecture

### Components
- **codex-rs**: Rust core
- **codex-cli**: TypeScript CLI
- **Bazel monorepo**: Build system
- **thegent integration**: Agent orchestration

## Past Work (Completed)

### WP001: Expect Pattern Cleanup
- State: shipped
- Cleanup of test expect patterns

## Present Work (Current)

### WP010: Bazel Build Optimization
- Build caching
- Remote execution
- Incremental builds

## Future Work (Planned)

### WP020: Multi-Runtime Integration
- Codex runtime
- Claude runtime
- Gemini runtime
- Cursor runtime
- Copilot runtime

### WP021: thegent Orchestration
- Full thegent integration
- Agent lifecycle management

## Work Packages

| ID | Description | State |
|----|-------------|-------|
| WP001 | Expect cleanup | shipped |
| WP010 | Bazel optimization | in_progress |
| WP020 | Multi-runtime | specified |
| WP021 | thegent integration | specified |

## Traces

- Related: 001-spec-driven-development-engine
- Related: 007-thegent-completion
- Related: 021-polyrepo-ecosystem-stabilization

## Audit Update — 2026-04-02

### Current State
- **Active branch**: `refactor/decouple-harness-crates` (NOT on main)
- **Dirty files**: 8 (session docs, WORKLOG.md)
- **Open PRs**: 1 (PR #179, 90% complete)
- **Disk usage**: 39 GB (dominated by bazel artifacts)
- **Worktrees**: 4 active (governance-migration, codex-rs-core WIP, ci-failures, decompose-key-router)
- **Stale worktrees**: 1 (dep-drift-python — prunable)

### In-Progress Tasks
1. **Decouple harness crates** (90% complete):
   - PR #179 open
   - Left: Review and merge

2. **Rollout limit safety fix** (80% complete):
   - PR #130 (draft), branch `fix/rollout-limit-expect`
   - Left: Re-verify limit behavior, convert from draft, merge

3. **Governance migration** (50% complete):
   - Worktree `chore-govern-pi`, branch `chore/governance-migration-hc`
   - Left: Complete migration or close

4. **Codex-rs-core WIP** (30% complete):
   - Parked worktree `wip/codex-rs-core`
   - Left: Split into PRs or abandon

5. **CI failures fix** (40% complete):
   - Worktree `fix-ci-failures`
   - Left: Finish or close

6. **Key router decomposition** (40% complete):
   - Worktree `decompose-key-router`
   - Left: Finish or close

### Immediate Actions
- [ ] Commit 8 dirty session doc files
- [ ] Review and merge PR #179
- [ ] Convert PR #130 from draft, verify, merge
- [ ] Decide on 4 worktrees: finish or close each
- [ ] Delete prunable worktree (dep-drift-python)
- [ ] Clean bazel artifacts (saves ~30 GB)
- [ ] Merge `refactor/decouple-harness-crates` → main
- [ ] Add docs/sessions/ directory if missing

### Disk Optimization
- **Current**: 39 GB
- **Target**: 8 GB after bazel cleanup
- **Savings**: ~31 GB (79% reduction)
