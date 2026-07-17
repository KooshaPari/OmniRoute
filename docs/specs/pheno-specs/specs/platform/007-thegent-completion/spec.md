# Spec: thegent Completion and Decomposition

## Meta

- **ID**: 007-thegent-completion
- **Title**: thegent Agent Framework Completion
- **Created**: 2026-03-25
- **State**: in_progress
- **Repo**: /Users/kooshapari/CodeProjects/Phenotype/repos/thegent

## Overview

Complete decomposition and stabilization of thegent agent framework (1027 commits since 2025-01-01).

## Past Work (Completed)

### WP001: Domain Extraction - MODELS
- State: shipped
- Commit: refactor: extract MODELS domain from CLI

### WP002: Domain Extraction - PLAN
- State: shipped
- Commit: refactor(cli): extract plan domain subpackage

### WP003: Domain Extraction - GOVERNANCE
- State: shipped
- Commit: refactor(cli): extract governance domain subpackage

### WP004: Domain Extraction - TEAM
- State: shipped
- Commit: refactor(cli): extract TEAM domain subpackage

### WP005: Cache Migration
- State: shipped
- Feature: phenotype-cache-adapter TieredCache migration

### WP006: Atlas Generation
- State: shipped
- Feature: codebase atlas generation system

### WP007: UUID Serde Feature
- State: shipped
- Fix: offload uuid serde feature

## Present Work (Current)

### WP010: Remaining Port Interfaces
- State: merged
- PR: #740

### WP011: GitOps Refactor
- State: in_progress
- Track remaining gitops refactor
- Shim split

## Future Work (Planned)

### WP020: Phench Wave 3
- State: specified
- Shared-modules rollout

### WP021: Full Domain Decomposition
- Complete CLI god package extraction
- All domains separated

### WP022: Integration Testing
- Full E2E coverage
- Contract testing

## Work Packages

| ID | Description | State |
|----|-------------|-------|
| WP001-WP007 | Domain extractions | shipped |
| WP010 | Remaining port interfaces | shipped |
| WP011 | GitOps refactor | in_progress |
| WP020 | Phench Wave 3 | specified |
| WP021 | Full decomposition | specified |
| WP022 | Integration testing | specified |

## Traces

- Related: 001-spec-driven-development-engine
- Related: 004-modules-and-cycles
- Related: 021-polyrepo-ecosystem-stabilization

## Audit Update — 2026-04-02

### Current State
- **Active branch**: `refactor/cleanup-error-variants` (NOT on main)
- **Dirty files**: 4 (WORKLOG.md, crates/thegent-offload/Cargo.toml, docs/WORKLOG.md, CODEOWNERS)
- **Open PRs**: 5 (PRs #908-912)
- **Disk usage**: 8.1 GB (node_modules, .venv)
- **Worktrees**: 3 checked out (bun-migrate, dotagents + primary)

### In-Progress Tasks
1. **Error variant cleanup** (85% complete):
   - PR #908 open, dirty Cargo.toml
   - Left: Commit dirty Cargo.toml, review and merge PR

2. **Convoy methodology specs** (95% complete):
   - PRs #910-911 open
   - Left: Review and merge

3. **Planning/security modules** (90% complete):
   - PR #912 open
   - Left: Review and merge

4. **Dependabot aiohttp bump** (100% complete):
   - PR #909 open
   - Left: Merge

5. **Distribution automation** (60% complete):
   - Branch `chore/distribution-automation` exists
   - Left: Finish or merge

6. **GitOps refactor (WP011)** (50% complete):
   - AgilePlus spec 007 tracking
   - Left: Track remaining gitops refactor

7. **BytePort** (40% complete):
   - docs/WORKLOG.md says "ACTIVE — NOT archived"
   - Left: Feature implementation needed

### Immediate Actions
- [ ] Commit 4 dirty files (WORKLOG.md, Cargo.toml, docs/WORKLOG.md, CODEOWNERS)
- [ ] Merge PR #909 (dependabot)
- [ ] Review and merge PRs #908, #910, #911, #912
- [ ] Decide on distribution automation: finish or close
- [ ] Merge or close sibling worktrees (bun-migrate, dotagents)
- [ ] Merge `refactor/cleanup-error-variants` → main
- [ ] Clean node_modules and .venv (saves ~5 GB)

### Merge Opportunity
- **thegent-plugin-host** should be merged into `thegent/apps/plugin-host`
- Reduces repo count by 1

### Disk Optimization
- **Current**: 8.1 GB
- **Target**: 3 GB after cleanup
- **Savings**: ~5.1 GB (63% reduction)
