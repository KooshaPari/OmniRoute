# Template Repo Cleanup

## Meta

- **ID**: 018-template-repo-cleanup
- **Title**: Consolidate 27 Template Repositories
- **Created**: 2026-04-01
- **State**: specified
- **Scope**: Shelf-level (cross-repo)

## Context

The Phenotype ecosystem contains 27 template repositories used for bootstrapping new projects. These templates have grown organically over time, resulting in significant duplication, inconsistent structures, and maintenance burden.

The hexagon-* and Hexa* template families (14 repos) implement similar hexagonal architecture patterns but with inconsistent naming, structure, and tooling. The template-lang-* family (13 repos) provides language-specific project scaffolding but duplicates common configuration and setup logic.

This spec consolidates template repos by merging duplicate hexagonal architecture templates, consolidating language-specific templates, creating a single template generator, and documenting the remaining template ecosystem.

## Problem Statement

Template repositories are duplicated and inconsistent:
- **Hexagonal architecture templates** — 14 repos implementing similar patterns with inconsistent naming (hexagon-* vs Hexa*)
- **Language-specific templates** — 13 repos duplicating common configuration and setup
- **No template generator** — templates maintained manually, no automation
- **Inconsistent structures** — similar templates have different file layouts
- **Outdated dependencies** — templates not updated with current best practices
- **Poor documentation** — unclear which template to use for what purpose

## Goals

- Merge hexagon-* and Hexa* duplicate templates (14 repos → ~7 repos)
- Consolidate template-lang-* repos (13 repos → ~6 repos)
- Create single template generator for automated scaffolding
- Document remaining templates with clear usage guidance
- Establish template maintenance process

## Non-Goals

- Creating new template types beyond consolidation
- Migrating templates to different languages
- Rewriting template internals (consolidation only)
- Deprecating any template functionality (consolidate, don't remove)

## Repositories Affected

### Hexagonal Architecture Templates (Merge — 14 repos)

| Repo | Language | Action | Rationale |
|------|----------|--------|-----------|
| hexagon-rust | Rust | Merge with HexaRust | Duplicate hexagonal Rust template |
| HexaRust | Rust | Merge with hexagon-rust | Duplicate hexagonal Rust template |
| hexagon-go | Go | Merge with HexaGo | Duplicate hexagonal Go template |
| HexaGo | Go | Merge with hexagon-go | Duplicate hexagonal Go template |
| hexagon-python | Python | Merge with HexaPython | Duplicate hexagonal Python template |
| HexaPython | Python | Merge with hexagon-python | Duplicate hexagonal Python template |
| hexagon-typescript | TypeScript | Merge with HexaTS | Duplicate hexagonal TS template |
| HexaTS | TypeScript | Merge with hexagon-typescript | Duplicate hexagonal TS template |
| hexagon-zig | Zig | Merge with HexaZig | Duplicate hexagonal Zig template |
| HexaZig | Zig | Merge with hexagon-zig | Duplicate hexagonal Zig template |
| hexagon-odin | Odin | Archive | Legacy language, no active use |
| hexagon-cpp | C++ | Merge with HexaCPP | Duplicate hexagonal C++ template |
| HexaCPP | C++ | Merge with hexagon-cpp | Duplicate hexagonal C++ template |
| hexagon-shared | Shared | Merge into generator | Shared config, move to generator |

### Language-Specific Templates (Consolidate — 13 repos)

| Repo | Language | Action | Rationale |
|------|----------|--------|-----------|
| template-lang-rust | Rust | Consolidate | Language-specific Rust template |
| template-lang-go | Go | Consolidate | Language-specific Go template |
| template-lang-python | Python | Consolidate | Language-specific Python template |
| template-lang-typescript | TypeScript | Consolidate | Language-specific TS template |
| template-lang-zig | Zig | Consolidate | Language-specific Zig template |
| template-lang-cpp | C++ | Consolidate | Language-specific C++ template |
| template-lang-java | Java | Archive | No active Java projects |
| template-lang-swift | Swift | Archive | No active Swift projects |
| template-lang-kotlin | Kotlin | Archive | No active Kotlin projects |
| template-lang-ruby | Ruby | Archive | No active Ruby projects |
| template-lang-php | PHP | Archive | No active PHP projects |
| template-lang-commons | Shared | Merge into generator | Shared config, move to generator |
| template-lang-web | Web | Consolidate | Web-specific template |

## Technical Approach

### Phase 1: Audit and Design (Week 1-2)
1. Audit all 27 template repos: structure, dependencies, usage patterns
2. Identify duplicated functionality and overlapping concerns
3. Design unified template architecture
4. Plan template generator architecture

### Phase 2: Hexagonal Template Merges (Week 2-4)
1. Merge hexagon-rust and HexaRust into single template
2. Merge hexagon-go and HexaGo into single template
3. Merge hexagon-python and HexaPython into single template
4. Merge hexagon-typescript and HexaTS into single template
5. Merge hexagon-zig and HexaZig into single template
6. Merge hexagon-cpp and HexaCPP into single template
7. Archive hexagon-odin (legacy language)
8. Move hexagon-shared into template generator

### Phase 3: Language Template Consolidation (Week 4-6)
1. Consolidate active language templates (Rust, Go, Python, TS, Zig, C++, Web)
2. Archive inactive language templates (Java, Swift, Kotlin, Ruby, PHP)
3. Move template-lang-commons into template generator

### Phase 4: Template Generator (Week 6-8)
1. Design template generator architecture
2. Implement generator with support for all template types
3. Add configuration management for template customization
4. Add validation for generated projects

### Phase 5: Documentation and Migration (Week 8-10)
1. Document all remaining templates with clear usage guidance
2. Create migration guides for projects using old templates
3. Update all references to old template repos
4. Establish template maintenance process

## Success Criteria

- 27 template repos reduced to ~13 repos plus generator
- All hexagonal architecture duplicates merged
- All language-specific templates consolidated
- Template generator operational and documented
- Comprehensive documentation for all templates
- Migration guides for projects using old templates
- Template maintenance process established

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking changes to existing projects | High | Migration guides, backward compatibility |
| Template generator complexity | Medium | Phased implementation, thorough testing |
| Loss of template functionality during merge | Medium | Careful merge, preserve all functionality |
| User confusion during transition | Low | Clear documentation, communication |
| Scope creep from additional template features | Medium | Strict scope enforcement, defer to future specs |

## Work Packages

| ID | Description | State |
|----|-------------|-------|
| WP001 | Audit and design | specified |
| WP002 | Hexagonal template merges | specified |
| WP003 | Language template consolidation | specified |
| WP004 | Template generator | specified |
| WP005 | Documentation and migration | specified |

## Traces

- Related: 012-github-portfolio-triage
- Related: 019-private-repo-catalog
- Related: 001-spec-driven-development-engine
