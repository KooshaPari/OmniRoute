# phenotype-infrakit Stabilization

## Meta

- **ID**: 013-phenotype-infrakit-stabilization
- **Title**: phenotype-infrakit — Consolidate 19 Infrastructure Crates
- **Created**: 2026-04-01
- **State**: specified
- **Scope**: phenotype-infrakit (Rust workspace)

## Context

phenotype-infrakit is a Rust workspace containing generic infrastructure crates extracted from the Phenotype ecosystem. Currently, the workspace and its related repositories contain 19 infrastructure crates spread across multiple languages and repositories, creating maintenance overhead, inconsistent API surfaces, and duplicated functionality.

The crates span Rust, Python, TypeScript, and Zig ecosystems, each with different maturity levels, testing coverage, and documentation quality. Many crates have unstable APIs that change without versioning discipline, making them unreliable for downstream consumers. Several crates lack proper test coverage, CI pipelines, or published artifacts.

This spec consolidates all 19 crates into a coherent, well-tested, and properly versioned infrastructure toolkit with stable API surfaces published to their respective package registries (crates.io, PyPI, npm).

## Problem Statement

19 infrastructure crates are scattered across the Phenotype ecosystem with:
- **Inconsistent API surfaces** — no unified design principles or naming conventions
- **Unstable versions** — crates change without semver discipline
- **Missing publications** — many crates are not published to their package registries
- **Duplicated functionality** — overlapping concerns between crates (e.g., config, auth, logging)
- **Poor test coverage** — many crates lack comprehensive tests
- **Inconsistent documentation** — ranging from comprehensive to non-existent

## Goals

- Consolidate 19 infrastructure crates into phenotype-infrakit workspace
- Stabilize API surfaces with proper semver versioning
- Publish all crates to their respective registries (crates.io, PyPI, npm)
- Achieve ≥80% test coverage across all crates
- Establish consistent documentation standards
- Eliminate duplicated functionality between crates

## Non-Goals

- Creating new infrastructure crates (consolidation only)
- Migrating crates to different languages
- Rewriting crate internals (API stabilization only)
- Deprecating any crate functionality (consolidate, don't remove)

## Repositories Affected

| Repo | Language | Action | Priority |
|------|----------|--------|----------|
| phenotype-go-kit | Go | Consolidate into infrakit | High |
| phenotype-config | Rust | Stabilize API, publish | High |
| phenotype-shared | Rust | Merge with phenotype-contracts | High |
| phenotype-gauge | Rust | Stabilize metrics API | Medium |
| phenotype-nexus | Rust | Stabilize service discovery | Medium |
| phenotype-forge | Rust | Stabilize build utilities | Medium |
| phenotype-cipher | Rust | Stabilize crypto primitives | High |
| phenotype-xdd-lib | Rust | Stabilize data structures | Medium |
| Authvault | Rust | Stabilize auth primitives | High |
| Tokn | Rust | Stabilize token management | High |
| Zerokit | Rust | Stabilize zero-trust utilities | Medium |
| PolicyStack | Rust | Merge with phenotype-policy-engine | High |
| Quillr | Rust | Stabilize document generation | Low |
| Httpora | Rust | Stabilize HTTP utilities | High |
| Apisync | Rust | Stabilize API sync utilities | Medium |
| phenotype-cli-core | Rust | Stabilize CLI framework | High |
| phenotype-middleware-py | Python | Stabilize, publish to PyPI | Medium |
| phenotype-logging-zig | Zig | Stabilize, evaluate language fit | Low |
| phenotype-auth-ts | TypeScript | Stabilize, publish to npm | Medium |

## Technical Approach

### Phase 1: Audit and Inventory (Week 1-2)
1. Inventory all 19 crates: API surface, dependencies, test coverage, documentation
2. Identify duplicated functionality and overlapping concerns
3. Map crate dependencies (internal and external)
4. Assess language fit for each crate (especially Zig and Python crates)

### Phase 2: Consolidation Design (Week 2-3)
1. Design unified workspace structure for phenotype-infrakit
2. Define API stabilization targets for each crate
3. Plan crate merges (phenotype-shared → phenotype-contracts, PolicyStack → phenotype-policy-engine)
4. Design consistent error handling patterns across all crates

### Phase 3: Implementation (Week 3-8)
1. Migrate crates into unified workspace structure
2. Stabilize API surfaces with proper semver
3. Merge duplicate crates
4. Implement missing test coverage
5. Add comprehensive documentation

### Phase 4: Publication and Verification (Week 8-10)
1. Publish Rust crates to crates.io
2. Publish Python crate to PyPI
3. Publish TypeScript crate to npm
4. Verify all publications work correctly
5. Update downstream consumers

## Success Criteria

- All 19 crates consolidated into phenotype-infrakit workspace
- All crates have stable, semver-versioned APIs
- All crates published to their respective registries
- ≥80% test coverage across all crates
- Comprehensive documentation for all public APIs
- Zero clippy warnings across all Rust crates
- All downstream consumers updated and verified

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking changes during consolidation | High | Careful API design, deprecation periods |
| Downstream consumer breakage | High | Comprehensive testing, migration guides |
| Language ecosystem mismatch (Zig) | Medium | Evaluate language fit early, consider rewrite |
| Publication registry issues | Low | Test publication process early |
| Scope creep from additional crates | Medium | Strict scope enforcement, defer to future specs |

## Work Packages

| ID | Description | State |
|----|-------------|-------|
| WP001 | Audit and inventory | specified |
| WP002 | Consolidation design | specified |
| WP003 | Rust crate consolidation | specified |
| WP004 | Python/TypeScript/Zig crate handling | specified |
| WP005 | API stabilization | specified |
| WP006 | Test coverage improvement | specified |
| WP007 | Publication to registries | specified |

## Traces

- Related: 001-spec-driven-development-engine
- Related: 004-modules-and-cycles
- Related: 014-observability-stack-completion
- Related: 021-polyrepo-ecosystem-stabilization

## Audit Update — 2026-04-02

Comprehensive audit of phenotype-infrakit completed. Key findings:

### Current State
- **Workspace**: 19 crates in Rust workspace
- **Open PRs**: 10 (PRs #544-563, all 90-95% complete)
- **Active branch**: `fix/http-client-core-simplify`
- **Dirty files**: 8 (session docs, worklog, 3 new source files)
- **Worktrees**: 2 active (cache-adapter-impl detached HEAD, phenotype-crypto-complete-v2)
- **Stale branches**: ~20 without PRs

### Immediate Actions Required
1. **Merge 10 open PRs** (P1.1 in spec 021):
   - PR #544: Workspace stabilization
   - PR #553: Gitignore + test-infra
   - PR #554: Workspace restructuring
   - PR #557: String compression (zstd)
   - PR #558: Builder derive macro
   - PR #559: Shared config implementation
   - PR #560: ADR-015 crate org guidelines (docs only)
   - PR #561: Health checker with timeout
   - PR #562: Error core layered types
   - PR #563: Test infrastructure utilities

2. **Resolve worktrees**:
   - cache-adapter-impl: Rebase onto main, create PR
   - phenotype-crypto-complete: Merge v2 branch

3. **Clean stale branches**: ~20 branches without PRs

### Crate Consolidation Opportunities
Based on audit findings, the following crates should be consolidated:
- **phenotype-contract** + **phenotype-contracts** → phenotype-contracts
- **phenotype-error-core** + **phenotype-errors** + **phenotype-error-macros** → phenotype-error-core
- **phenotype-ports-canonical** + **phenotype-port-traits** → phenotype-contracts
- **phenotype-async-traits** → phenotype-contracts

### Workspace Split Consideration
19 crates may be large for a single workspace. Consider splitting into 3 workspaces:
- **core**: contracts, errors, config-core
- **runtime**: event-sourcing, cache-adapter, state-machine, health
- **tools**: policy-engine, validation, http-client

### Disk Usage
- **Current**: 1.8 GB (source + target)
- **Target**: 0.5 GB after `cargo clean`
- **Build artifacts**: ~1.3 GB in target/
