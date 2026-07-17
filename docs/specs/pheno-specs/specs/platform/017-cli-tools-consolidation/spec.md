# CLI Tools Consolidation

## Meta

- **ID**: 017-cli-tools-consolidation
- **Title**: Consolidate CLI Tools Across 7 Repositories
- **Created**: 2026-04-01
- **State**: specified
- **Scope**: Cross-repo (7 repositories)

## Context

The Phenotype ecosystem contains 7 CLI-related repositories with overlapping functionality, duplicated code, and inconsistent user experiences. These tools were developed independently over time without coordination, resulting in maintenance burden and confusing user experience.

cliproxyapi-plusplus provides an LLM proxy API but lacks integration with other CLI tools. agentapi-plusplus provides an agent API but duplicates functionality with cliproxyapi-plusplus. Cmdra provides a CLI framework but isn't used by other CLI tools. forgecode implements git workflows but operates independently. thegent-sharecli and thegent-cli-share are duplicate implementations of CLI sharing functionality. thegent-subprocess handles subprocess management but lacks integration with the CLI framework.

This spec consolidates CLI tools by completing the LLM proxy, agent API, CLI framework, and git workflows while deduplicating thegent-sharecli vs thegent-cli-share and establishing a unified CLI experience.

## Problem Statement

CLI tools are fragmented and duplicated:
- **LLM proxy** — incomplete implementation, missing features
- **Agent API** — duplicates LLM proxy functionality
- **CLI framework** — standalone, not adopted by other tools
- **Git workflows** — isolated implementation
- **Duplicate sharing tools** — thegent-sharecli and thegent-cli-share implement same functionality
- **Subprocess management** — not integrated with CLI framework

## Goals

- Complete LLM proxy implementation with full feature set
- Complete agent API implementation without duplicating LLM proxy
- Establish Cmdra as the unified CLI framework adopted by all tools
- Complete git workflow implementation
- Deduplicate thegent-sharecli and thegent-cli-share into single implementation
- Integrate subprocess management with CLI framework

## Non-Goals

- Creating new CLI tools beyond consolidation
- Migrating CLI tools to different languages
- Rewriting CLI tool internals (consolidation only)
- Deprecating any CLI functionality (consolidate, don't remove)

## Repositories Affected

| Repo | Language | Current State | Action |
|------|----------|---------------|--------|
| cliproxyapi-plusplus | TypeScript/Node | Partial LLM proxy | Complete proxy, integrate with agent API |
| agentapi-plusplus | TypeScript/Node | Partial agent API | Complete API, deduplicate with LLM proxy |
| Cmdra | Rust | CLI framework prototype | Complete framework, adopt across all CLI tools |
| forgecode | Rust | Git workflows | Complete workflows, integrate with CLI framework |
| thegent-sharecli | Go | CLI sharing tool | Merge with thegent-cli-share |
| thegent-cli-share | Go | CLI sharing tool (duplicate) | Merge with thegent-sharecli |
| thegent-subprocess | Go | Subprocess management | Integrate with CLI framework |

## Technical Approach

### Phase 1: Audit and Design (Week 1-2)
1. Audit all 7 CLI tools: features, APIs, dependencies, user experience
2. Identify duplicated functionality and overlapping concerns
3. Design unified CLI architecture
4. Plan deduplication of thegent-sharecli and thegent-cli-share

### Phase 2: LLM Proxy and Agent API (Week 2-4)
1. Complete cliproxyapi-plusplus LLM proxy implementation
2. Complete agentapi-plusplus agent API implementation
3. Deduplicate overlapping functionality between proxy and API
4. Establish clear boundaries between proxy and API layers

### Phase 3: CLI Framework Completion (Week 4-6)
1. Complete Cmdra CLI framework implementation
2. Add plugin system for CLI extensions
3. Implement consistent command patterns
4. Add comprehensive documentation

### Phase 4: Git Workflows and Subprocess (Week 6-8)
1. Complete forgecode git workflow implementation
2. Integrate git workflows with CLI framework
3. Integrate thegent-subprocess with CLI framework
4. Add subprocess management utilities

### Phase 5: Deduplication and Integration (Week 8-10)
1. Merge thegent-sharecli and thegent-cli-share into single implementation
2. Migrate all CLI tools to use Cmdra framework
3. Integrate all components into unified CLI experience
4. Comprehensive testing and documentation

## Success Criteria

- Complete LLM proxy with full feature set
- Complete agent API without duplicating LLM proxy
- Cmdra adopted as unified CLI framework
- Complete git workflow implementation
- Single CLI sharing tool (deduplicated)
- Subprocess management integrated with CLI framework
- Unified CLI experience across all tools
- Comprehensive documentation and examples

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking changes during consolidation | High | Careful API design, deprecation periods |
| User experience disruption | Medium | Migration guides, backward compatibility |
| Cross-language integration complexity | Medium | Clear interfaces, integration tests |
| Deduplication data loss | Low | Careful merge, preserve all functionality |
| Scope creep from additional CLI features | Medium | Strict scope enforcement, defer to future specs |

## Work Packages

| ID | Description | State |
|----|-------------|-------|
| WP001 | Audit and design | specified |
| WP002 | LLM proxy and agent API | specified |
| WP003 | CLI framework completion | specified |
| WP004 | Git workflows and subprocess | specified |
| WP005 | Deduplication and integration | specified |

## Traces

- Related: 006-helioscli-completion
- Related: 007-thegent-completion
- Related: 013-phenotype-infrakit-stabilization
