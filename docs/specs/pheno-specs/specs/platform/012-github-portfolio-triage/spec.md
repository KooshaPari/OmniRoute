# GitHub Portfolio Triage

## Meta

- **ID**: 012-github-portfolio-triage
- **Title**: GitHub Portfolio Triage — Archive, Consolidate, Catalog
- **Created**: 2026-04-01
- **State**: specified
- **Scope**: Shelf-level (cross-repo)

## Context

The KooshaPari GitHub organization currently contains 226 repositories spanning multiple years of development, experimentation, and iteration. This portfolio has grown organically without systematic governance, resulting in significant maintenance burden, discoverability problems, and unclear ownership signals.

Many repositories are single-commit stubs that were created as placeholders for planned work that never materialized. Legacy Odin projects (from a previous technology stack) sit alongside active Rust/TypeScript/Python projects. Two orphaned database entries reference repositories that no longer exist on GitHub, causing failures in automated tooling that queries the portfolio.

This spec establishes a systematic triage process to reduce the portfolio from 226 to approximately 170 repositories through archival, consolidation, and cleanup — improving signal-to-noise ratio for both human developers and automated agents.

## Problem Statement

The 226-repo portfolio is unmanageable:
- **25 single-commit stub repos** (phenotype-rust-*, phenotype-*-sdk, etc.) were created as placeholders but never developed
- **~15 legacy Odin projects** are obsolete and no longer relevant to the current technology stack
- **2 orphaned DB entries** reference non-existent repos, breaking automated tooling
- **Discoverability** is poor — active projects are buried among stale ones
- **Maintenance burden** — CI, security scanning, and dependency alerts fire across all 226 repos

## Goals

- Reduce portfolio from 226 to ~170 repositories through systematic archival
- Archive all 25 single-commit stub repos with proper documentation
- Archive ~15 legacy Odin projects with migration notes where applicable
- Clean up 2 orphaned database entries referencing non-existent repos
- Produce a comprehensive portfolio manifest documenting every repo's status
- Establish ongoing triage policy to prevent future accumulation

## Non-Goals

- Migrating code from archived repos into active repos (separate spec)
- Rewriting or refactoring any active repository
- Changing repository visibility (private/public) decisions
- Deleting any repository (archive only, no destructive operations)

## Repositories Affected

### Single-Commit Stub Repos (Archive — 25 repos)

| Repo | Language | Action | Rationale |
|------|----------|--------|-----------|
| phenotype-rust-core | Rust | Archive | Placeholder, never developed |
| phenotype-rust-ffi | Rust | Archive | Placeholder, superseded by phenotype-infrakit |
| phenotype-rust-wasm | Rust | Archive | Placeholder, no Wasm work planned |
| phenotype-rust-async | Rust | Archive | Placeholder, functionality in other crates |
| phenotype-rust-cli | Rust | Archive | Placeholder, superseded by pheno-cli |
| phenotype-go-sdk | Go | Archive | Placeholder, no Go SDK work planned |
| phenotype-python-sdk | Python | Archive | Placeholder, no Python SDK work planned |
| phenotype-node-sdk | TypeScript | Archive | Placeholder, no Node SDK work planned |
| phenotype-rust-macros | Rust | Archive | Placeholder, macros in existing crates |
| phenotype-rust-proto | Rust | Archive | Placeholder, proto in phenotype-contracts |
| phenotype-rust-test | Rust | Archive | Test placeholder, no real content |
| phenotype-rust-bench | Rust | Archive | Placeholder, benchmarking in other crates |
| phenotype-rust-docs | Rust | Archive | Placeholder, docs in phenotype-docs-engine |
| phenotype-rust-auth | Rust | Archive | Placeholder, auth in Authvault |
| phenotype-rust-config | Rust | Archive | Placeholder, config in phenotype-config-core |
| phenotype-rust-logging | Rust | Archive | Placeholder, logging in helix-logging |
| phenotype-rust-metrics | Rust | Archive | Placeholder, metrics in thegent-metrics |
| phenotype-rust-tracing | Rust | Archive | Placeholder, tracing in tracely |
| phenotype-rust-health | Rust | Archive | Placeholder, health in phenotype-health |
| phenotype-rust-policy | Rust | Archive | Placeholder, policy in phenotype-policy-engine |
| phenotype-rust-cache | Rust | Archive | Placeholder, cache in phenotype-cache-adapter |
| phenotype-rust-events | Rust | Archive | Placeholder, events in phenotype-event-sourcing |
| phenotype-rust-state | Rust | Archive | Placeholder, state in phenotype-state-machine |
| phenotype-rust-errors | Rust | Archive | Placeholder, errors in phenotype-error-core |
| phenotype-rust-shared | Rust | Archive | Placeholder, shared in phenotype-contracts |

### Legacy Odin Projects (Archive — ~15 repos)

| Repo | Language | Action | Rationale |
|------|----------|--------|-----------|
| odin-auth-service | Odin | Archive | Legacy auth, replaced by Authvault |
| odin-api-gateway | Odin | Legacy gateway, replaced by current stack |
| odin-user-service | Odin | Archive | Legacy user management |
| odin-notification-service | Odin | Archive | Legacy notifications |
| odin-scheduler | Odin | Archive | Legacy scheduling, replaced by Temporal |
| odin-data-pipeline | Odin | Archive | Legacy data processing |
| odin-config-server | Odin | Archive | Legacy config, replaced by phenotype-config |
| odin-service-mesh | Odin | Archive | Legacy service mesh experiment |
| odin-monitoring | Odin | Archive | Legacy monitoring, replaced by observability stack |
| odin-cli-tool | Odin | Archive | Legacy CLI, replaced by heliosCLI |
| odin-web-framework | Odin | Archive | Legacy web framework experiment |
| odin-template-service | Odin | Archive | Legacy template, superseded |
| odin-event-bus | Odin | Archive | Legacy event bus, replaced by event-sourcing |
| odin-cache-layer | Odin | Archive | Legacy cache, replaced by phenotype-cache-adapter |
| odin-policy-engine | Odin | Archive | Legacy policy, replaced by phenotype-policy-engine |

### Orphaned Database Entries (Clean up — 2 entries)

| DB Entry | Referenced Repo | Action |
|----------|----------------|--------|
| DB-0047 | phenotype-legacy-adapter | Remove entry, repo was deleted |
| DB-0089 | odin-migration-tool | Remove entry, repo was archived and deleted |

## Technical Approach

### Phase 1: Discovery and Classification (Week 1)
1. Query GitHub API for all 226 repos with metadata (commits, last activity, size, language)
2. Classify each repo into: active, stub, legacy, duplicate, or unknown
3. Cross-reference with local repos shelf to identify mirrored vs. GitHub-only repos
4. Identify the 2 orphaned DB entries and document their impact

### Phase 2: Stakeholder Review (Week 1-2)
1. Present classification results for review
2. Confirm archival decisions for stub and legacy repos
3. Flag any repos that should be preserved despite classification

### Phase 3: Archival Execution (Week 2-3)
1. Archive 25 single-commit stub repos via GitHub API
2. Archive ~15 legacy Odin projects via GitHub API
3. Update portfolio manifest with new status for each archived repo
4. Clean up 2 orphaned DB entries

### Phase 4: Verification and Documentation (Week 3-4)
1. Verify all archival operations succeeded
2. Update any internal tooling that references archived repos
3. Produce final portfolio manifest (170 repos)
4. Document triage policy for ongoing maintenance

## Success Criteria

- Portfolio reduced from 226 to ~170 repositories
- All 25 single-commit stub repos archived with documentation
- All ~15 legacy Odin projects archived with migration notes
- 2 orphaned DB entries cleaned up
- Comprehensive portfolio manifest produced
- No accidental deletions (archive only, no destructive operations)
- CI/CD pipelines updated to exclude archived repos
- Triage policy documented for ongoing maintenance

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Accidental archival of active repo | High | Manual review of classification before execution |
| Broken references in tooling | Medium | Audit all tooling references before archival |
| DB entry cleanup breaks dependent systems | Medium | Test DB cleanup in staging first |
| Stakeholder disagreement on archival | Low | Clear rationale documentation, appeal process |
| GitHub API rate limits during bulk operations | Low | Batch operations with delays, use authenticated API |

## Work Packages

| ID | Description | State |
|----|-------------|-------|
| WP001 | Discovery and classification | specified |
| WP002 | Stakeholder review | specified |
| WP003 | Archival execution | specified |
| WP004 | Verification and documentation | specified |

## Traces

- Related: kooshapari-stale-repo-triage
- Related: 019-private-repo-catalog
- Related: 018-template-repo-cleanup
- Related: 021-polyrepo-ecosystem-stabilization

## Audit Update — 2026-04-02

Comprehensive audit of 247 repos completed. Key updates to this spec:

### Revised Repo Count
- **Total repos**: 247 (updated from 226)
- **Languages**: 15+ (Rust 65, Python 45, TypeScript 30, Go 25, others 82)
- **Activity**: 45 updated in last 24h, 67 stale (30+ days)

### Revised Archive List
Based on audit findings, the following repos are confirmed archive candidates:

**Immediate deletes (8)**:
- agentapi-deprec, tehgent, BytePort-TestPortfolio, Byteport-TestZip, P2, Tokn, argisexec, acp

**Course exercises (4)**:
- odin-dash, odin-TTT, odin-library, odin-recipes

**Low-signal personal (11)**:
- heliosBench, QuadSGM, Kogito, Tossy, Frostify, AppGen, TripleM, Project-Spyn, ssToCal-front, BytePortfolio, agentapi

**Language variants (5)**:
- FixitGo, FixitRs (merge to fixit), hexagon-rust (merge to hexagon-rs), router-docs (merge to hub), vibeproxy-monitoring-unified (already archived)

### Merge Opportunities (NEW)
15 repos can be merged into 8 targets:
- phenotype-contract + phenotype-contracts → phenotype-contracts
- phenotype-error-core + errors + error-macros → phenotype-error-core
- phenotype-ports-canonical + phenotype-port-traits → phenotype-contracts
- thegent-plugin-host → thegent/apps/plugin-host
- forgecode-fork → forgecode (or delete)
- hexagon-rust → hexagon-rs
- agileplus-agents → AgilePlus/packages/agents
- agileplus-mcp → AgilePlus/packages/mcp
- router-docs → phenotype-hub/docs/
- FixitGo + FixitRs → fixit
- phenotype-config-loader → phenotype-config-core
- phenotype-shared-config → phenotype-config-core
- phenotype-async-traits → phenotype-contracts
- bifrost-routing + bifrost-routing-backup → bifrost
- vibeproxy-monitoring-unified (already archived)

**Net reduction**: 15 → 8 = 7 fewer repos

### Disk Usage Findings
- **Current**: 89 GB (9 cloned repos)
- **Build artifacts**: 22 GB (77% of usage)
- **Target**: 20 GB after cleanup (77% reduction)
- **Primary consumers**: heliosCLI (39 GB bazel), AgilePlus (20 GB venv), thegent (8.1 GB node_modules)
