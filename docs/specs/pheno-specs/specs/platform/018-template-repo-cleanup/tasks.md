# Work Packages: Template Repo Cleanup — Consolidate 27 Template Repositories

**Inputs**: Design documents from `kitty-specs/018-template-repo-cleanup/`
**Prerequisites**: spec.md, access to all 27 template repositories
**Scope**: Shelf-level (cross-repo) — 27 template repos → ~13 repos + generator

---

## WP-001: Audit All 14 hexagon-* and Hexa* Repos — Identify Duplicates

- **State:** planned
- **Sequence:** 1
- **File Scope:** 14 hexagonal architecture template repos (hexagon-rust, HexaRust, hexagon-go, HexaGo, hexagon-python, HexaPython, hexagon-typescript, HexaTS, hexagon-zig, HexaZig, hexagon-odin, hexagon-cpp, HexaCPP, hexagon-shared)
- **Acceptance Criteria:**
  - Detailed audit report for all 14 repos: structure, dependencies, language, last update
  - Duplicate pairs identified with merge recommendations
  - hexagon-odin flagged for archival (legacy language)
  - hexagon-shared analyzed for generator migration
  - Merge plan for each duplicate pair with conflict resolution strategy
- **Estimated Effort:** M

Conduct a comprehensive audit of all 14 hexagonal architecture template repositories. Identify duplicate pairs (hexagon-* vs Hexa* for each language), assess their differences, and plan merges. This audit produces the blueprint for WP-002's consolidation work.

### Subtasks
- [ ] T001 Clone all 14 hexagonal template repos
- [ ] T002 Analyze each repo: file structure, dependencies, build tools, configuration
- [ ] T003 Compare hexagon-rust vs HexaRust: identify differences, recommend merge target
- [ ] T004 Compare hexagon-go vs HexaGo: identify differences, recommend merge target
- [ ] T005 Compare hexagon-python vs HexaPython: identify differences, recommend merge target
- [ ] T006 Compare hexagon-typescript vs HexaTS: identify differences, recommend merge target
- [ ] T007 Compare hexagon-zig vs HexaZig: identify differences, recommend merge target
- [ ] T008 Compare hexagon-cpp vs HexaCPP: identify differences, recommend merge target
- [ ] T009 Assess hexagon-odin: confirm no active use, recommend archival
- [ ] T010 Analyze hexagon-shared: identify shared config to migrate to generator
- [ ] T011 Produce audit report with duplicate pairs, merge targets, and conflict resolution
- [ ] T012 Create merge plan: order of merges, branch strategy, verification steps

### Dependencies
- None (starting WP for this spec)

### Risks & Mitigations
- Hidden differences between duplicates: Deep file-level comparison, not just structure
- Active projects using old templates: Document all known consumers before merge

---

## WP-002: Merge hexagon-* + Hexa* Duplicates into Single Template Set

- **State:** planned
- **Sequence:** 2
- **File Scope:** 7 merged hexagonal template repos (Rust, Go, Python, TypeScript, Zig, C++, shared→generator)
- **Acceptance Criteria:**
  - 14 repos reduced to 7 merged repos (one per language)
  - Each merged repo contains the best of both originals
  - hexagon-odin archived with documentation
  - hexagon-shared content migrated to template generator (WP-004)
  - All merged templates build and generate valid projects
  - Migration guides for projects using old template repos
  - All quality checks passing on merged templates
- **Estimated Effort:** L

Merge each hexagon-* / Hexa* duplicate pair into a single, unified template. The best features from both originals are preserved, conflicts are resolved, and the result is a clean, well-documented template. hexagon-odin is archived, and hexagon-shared content moves to the template generator.

### Subtasks
- [ ] T013 Merge hexagon-rust + HexaRust → single hexagon-rust template
- [ ] T014 Merge hexagon-go + HexaGo → single hexagon-go template
- [ ] T015 Merge hexagon-python + HexaPython → single hexagon-python template
- [ ] T016 Merge hexagon-typescript + HexaTS → single hexagon-typescript template
- [ ] T017 Merge hexagon-zig + HexaZig → single hexagon-zig template
- [ ] T018 Merge hexagon-cpp + HexaCPP → single hexagon-cpp template
- [ ] T019 Archive hexagon-odin with migration note
- [ ] T020 Extract hexagon-shared content for generator migration (document for WP-004)
- [ ] T021 Verify each merged template: generate project, build, run tests
- [ ] T022 Create migration guides: how to migrate from old repos to merged templates
- [ ] T023 Update all references to old template repos
- [ ] T024 Archive superseded repos with migration READMEs
- [ ] T025 Verify no broken references in active tooling

### Dependencies
- WP-001 (audit complete, merge plan established)

### Risks & Mitigations
- Merge conflicts: Careful file-level comparison, preserve all unique functionality
- Breaking changes for consumers: Migration guides, backward-compatible transition period

---

## WP-003: Audit All 13 template-lang-* Repos — Consolidate Generators

- **State:** planned
- **Sequence:** 3
- **File Scope:** 13 language-specific template repos (template-lang-rust, template-lang-go, template-lang-python, template-lang-typescript, template-lang-zig, template-lang-cpp, template-lang-java, template-lang-swift, template-lang-kotlin, template-lang-ruby, template-lang-php, template-lang-commons, template-lang-web)
- **Acceptance Criteria:**
  - Audit report for all 13 repos: structure, overlap with hexagon templates, active usage
  - Active language templates identified for consolidation (Rust, Go, Python, TS, Zig, C++, Web)
  - Inactive language templates flagged for archival (Java, Swift, Kotlin, Ruby, PHP)
  - template-lang-commons analyzed for generator migration
  - Consolidation plan for active templates
- **Estimated Effort:** M

Audit all 13 language-specific template repositories, identify which are actively used, and plan consolidation. Inactive language templates are archived, active ones are consolidated, and shared configuration moves to the template generator.

### Subtasks
- [ ] T026 Clone all 13 template-lang-* repos
- [ ] T027 Analyze each repo: structure, dependencies, overlap with hexagon templates
- [ ] T028 Assess active usage: check for projects generated from each template
- [ ] T029 Flag inactive templates for archival: Java, Swift, Kotlin, Ruby, PHP
- [ ] T030 Identify active templates for consolidation: Rust, Go, Python, TS, Zig, C++, Web
- [ ] T031 Analyze template-lang-commons: extract shared config for generator migration
- [ ] T032 Compare active templates with hexagon templates: identify overlap, decide consolidation approach
- [ ] T033 Produce audit report with consolidation recommendations
- [ ] T034 Create consolidation plan: merge strategy, archival order, verification steps

### Dependencies
- WP-001 (can start in parallel, but benefits from hexagon audit findings)

### Risks & Mitigations
- Unknown active usage: Search codebase for template references, check git history
- Overlap with hexagon templates: Decide whether to merge or keep separate based on use case

---

## WP-004: Create Single Template Generator Tool

- **State:** planned
- **Sequence:** 4
- **File Scope:** New template-generator repository (or existing shared config repo)
- **Acceptance Criteria:**
  - Template generator CLI tool supporting all template types (hexagonal + language-specific)
  - Configuration management for template customization (language, architecture, tools)
  - Validation for generated projects (build verification, test execution)
  - Migrated content from hexagon-shared and template-lang-commons
  - ≥80% test coverage on generator core
  - All quality checks passing
- **Estimated Effort:** L

Create a single template generator tool that replaces manual template maintenance. The generator supports all template types (hexagonal architecture and language-specific), allows customization through configuration, and validates generated projects. Shared configuration from hexagon-shared and template-lang-commons is migrated into the generator.

### Subtasks
- [ ] T035 Design generator architecture: template engine, configuration schema, output format
- [ ] T036 Implement template engine: parse templates, apply variables, generate files
- [ ] T037 Implement configuration schema: language, architecture, tools, dependencies
- [ ] T038 Migrate hexagon-shared content into generator configuration
- [ ] T039 Migrate template-lang-commons content into generator configuration
- [ ] T040 Implement template catalog: discover available templates, list options
- [ ] T041 Implement project generation: select template, apply config, generate project
- [ ] T042 Implement validation: build generated project, run tests, verify structure
- [ ] T043 Write unit tests for template engine and configuration (target: ≥80%)
- [ ] T044 Write integration tests: generate projects for each template type, validate
- [ ] T045 Add documentation: generator usage, template configuration, customization guide
- [ ] T046 Run quality checks: `cargo test` / `npm test`, linter, formatter

### Dependencies
- WP-002 (hexagon-shared content extracted)
- WP-003 (template-lang-commons content extracted)

### Risks & Mitigations
- Generator complexity: Start with simple variable substitution, add advanced features incrementally
- Template validation: Use actual build tools for each language, handle toolchain requirements

---

## WP-005: Document Remaining Templates and Create Registry

- **State:** planned
- **Sequence:** 5
- **File Scope:** Template registry documentation, all remaining template repos
- **Acceptance Criteria:**
  - Template registry documenting all remaining templates with clear usage guidance
  - Each template documented with: purpose, language, architecture pattern, when to use
  - Migration guides for projects using old template repos
  - Template maintenance process documented
  - All references to old template repos updated
  - Template registry accessible (markdown, web, or CLI)
- **Estimated Effort:** S

Document all remaining templates with clear usage guidance, create a template registry, and establish a maintenance process. This is the final deliverable that makes the consolidated template ecosystem discoverable and usable.

### Subtasks
- [ ] T047 Inventory all remaining templates: merged hexagon, consolidated lang-specific, generator
- [ ] T048 Document each template: purpose, language, architecture, when to use, getting started
- [ ] T049 Create template registry: structured index of all templates with metadata
- [ ] T050 Create migration guides for all archived template repos
- [ ] T051 Update all references to old template repos in active projects
- [ ] T052 Document template maintenance process: update cadence, review process, deprecation policy
- [ ] T053 Verify template registry accuracy: generate project from each template, verify docs
- [ ] T054 Publish template registry (markdown in docs/, or CLI command)

### Dependencies
- WP-002 (hexagon merges complete)
- WP-003 (lang template consolidation complete)
- WP-004 (generator complete)

### Risks & Mitigations
- Documentation drift: Link docs to actual templates, validate during CI
- Missed references: Comprehensive search across all repos before finalizing

---

## Dependency & Execution Summary

```
WP-001 (Audit hexagon templates) ──────── first, no deps
WP-002 (Merge hexagon duplicates) ─────── depends on WP-001
WP-003 (Audit lang templates) ─────────── first, no deps (parallel with WP-001)
WP-004 (Template generator) ───────────── depends on WP-002, WP-003
WP-005 (Document + registry) ──────────── depends on WP-002, WP-003, WP-004
```

**Parallelization**: WP-001 and WP-003 can run in parallel (independent audits). WP-002 depends on WP-001. WP-004 depends on both audits. WP-005 is the final step.

**MVP Scope**: WP-001 + WP-002 reduces 14 hexagon repos to 7. WP-003 + WP-004 adds the generator.
