# Work Packages: Private Repo Catalog — Catalog and Map 19 Private Repositories

**Inputs**: Design documents from `kitty-specs/019-private-repo-catalog/`
**Prerequisites**: spec.md, access to private repositories, GitHub API access
**Scope**: Shelf-level (cross-repo) — 19 private repositories

---

## WP-001: Catalog All 19 Private Repos — Map Functionality and Dependencies

- **State:** planned
- **Sequence:** 1
- **File Scope:** 19 private repositories (template-lang-go, template-commons, Schemaforge, Flagward, phenotype-docs-engine, phenotype-evaluation, phenotype-skills, Prismal, Cursora, phenotype-patch, phenotype-sentinel, phenotype-agent-core, phenotype-vessel, phenotype-config, Parpoura, Civis, phenotype-agents, Holdr, Flowra)
- **Acceptance Criteria:**
  - Complete catalog of all 19 private repos with: name, language, purpose, owner, access controls
  - Dependency map showing relationships between private repos
  - Sensitive content inventory for each repo (credentials, keys, internal data)
  - Public equivalent mapping for each private repo
  - Catalog published as structured document (JSON + markdown)
- **Estimated Effort:** M

Conduct a comprehensive catalog of all 19 private repositories. Each repo is documented with its purpose, ownership, access controls, dependencies, and relationship to public repos. Sensitive content is inventoried for security review.

### Subtasks
- [ ] T001 Query GitHub API for all private repos with metadata (size, language, last activity)
- [ ] T002 Document each repo's purpose and functionality from README and code analysis
- [ ] T003 Identify ownership and access controls for each repo (who has access, permission levels)
- [ ] T004 Map dependencies between private repos (imports, references, shared config)
- [ ] T005 Inventory sensitive content: credentials, API keys, internal data, proprietary algorithms
- [ ] T006 Map each private repo to its public equivalent (if any)
- [ ] T007 Assess which private repos should remain private vs. candidates for public release
- [ ] T008 Produce structured catalog: JSON data file + markdown documentation
- [ ] T009 Validate catalog accuracy: cross-reference with repo owners

### Dependencies
- None (starting WP for this spec)

### Risks & Mitigations
- Access limitations: Ensure proper credentials for all private repos before starting
- Sensitive content exposure: Handle with care, document findings securely, do not log sensitive data

---

## WP-002: phenotype-agent-core, phenotype-vessel, phenotype-sentinel — Complete Core Agent Infrastructure

- **State:** planned
- **Sequence:** 2
- **File Scope:** phenotype-agent-core (private), phenotype-vessel (private), phenotype-sentinel (private)
- **Acceptance Criteria:**
  - phenotype-agent-core: complete agent core with dispatch, lifecycle, and communication
  - phenotype-vessel: complete container utilities with build, run, and management
  - phenotype-sentinel: complete security monitoring with threat detection and alerting
  - All three repos have ≥80% test coverage
  - All three repos have comprehensive documentation
  - All quality checks passing
- **Estimated Effort:** L

Complete the three core agent infrastructure private repositories. phenotype-agent-core provides agent dispatch and lifecycle management, phenotype-vessel provides container utilities, and phenotype-sentinel provides security monitoring. These are foundational private repos that other private and public repos depend on.

### Subtasks
- [ ] T010 Audit phenotype-agent-core: existing code, gaps, dependencies
- [ ] T011 Complete agent dispatch: create, start, stop, monitor agents
- [ ] T012 Complete agent lifecycle management: state machine, health checks, recovery
- [ ] T013 Complete agent communication: inter-agent messaging, event routing
- [ ] T014 Audit phenotype-vessel: existing container utilities, gaps
- [ ] T015 Complete container build utilities: Dockerfile generation, image building
- [ ] T016 Complete container run utilities: container lifecycle, resource management
- [ ] T017 Audit phenotype-sentinel: existing security monitoring, gaps
- [ ] T018 Complete threat detection: rule-based detection, anomaly detection
- [ ] T019 Complete alerting: notification channels, alert routing, escalation
- [ ] T020 Write tests for all three repos (target: ≥80% coverage each)
- [ ] T021 Add comprehensive documentation for all three repos
- [ ] T022 Run quality checks across all three repos

### Dependencies
- WP-001 (catalog complete, understanding of repo purposes and dependencies)

### Risks & Mitigations
- Scope creep in core repos: Strict scope enforcement, defer additional features to future specs
- Security sensitivity in sentinel: Handle threat detection rules carefully, review before committing

---

## WP-003: Schemaforge, Flagward, Prismal, Cursora, Civis — Complete App/Tool Implementations

- **State:** planned
- **Sequence:** 3
- **File Scope:** Schemaforge (private, Rust), Flagward (private, TypeScript), Prismal (private, TypeScript, archived 2026-05-03), Cursora (private, TypeScript), Civis (private, Go)
- **Acceptance Criteria:**
  - Schemaforge: complete schema generation with validation and export
  - Flagward: complete feature flag service with UI and API
  - Prismal: SKIPPED — archived TypeScript spec-only stub; no implementation to complete (see audit 2026-06-12)
  - Cursora: complete Cursor integration with extension support
  - Civis: complete civic data tools with data processing and visualization
  - All five repos have ≥80% test coverage
  - All five repos have comprehensive documentation
  - All quality checks passing
- **Estimated Effort:** L

Complete the five application/tool private repositories. Each provides distinct functionality: schema generation, feature flags, database utilities, Cursor integration, and civic data tools. These are standalone tools that serve specific purposes within the Phenotype ecosystem.

### Subtasks
- [ ] T023 Audit Schemaforge: existing schema generation code, gaps
- [ ] T024 Complete Schemaforge: schema validation, export formats (JSON Schema, Protobuf, OpenAPI)
- [ ] T025 Audit Flagward: existing feature flag code, gaps
- [ ] T026 Complete Flagward: flag management, targeting rules, API, basic UI
- [ ] T027 ~~Audit Prismal: existing database utilities, gaps~~ — REMOVED; Prismal is archived, nothing to audit
- [ ] T028 ~~Complete Prismal: migration tools, query builder, schema introspection~~ — REMOVED; Prismal is archived, no scope to complete
- [ ] T029 Audit Cursora: existing Cursor integration code, gaps
- [ ] T030 Complete Cursora: extension support, custom commands, workspace integration
- [ ] T031 Audit Civis: existing civic data tools, gaps
- [ ] T032 Complete Civis: data processing pipelines, visualization, export
- [ ] T033 Write tests for all five repos (target: ≥80% coverage each)
- [ ] T034 Add comprehensive documentation for all five repos
- [ ] T035 Run quality checks across all five repos

### Dependencies
- WP-001 (catalog complete, understanding of repo purposes)

### Risks & Mitigations
- Multi-language complexity: Rust (Schemaforge), TypeScript (Flagward, Cursora), Go (Civis). (Prismal removed from WP-003 scope — archived 2026-05-03.)
- UI components in Flagward: Keep UI minimal, focus on API completeness first

---

## WP-004: Identify Duplicates with Public Repos

- **State:** planned
- **Sequence:** 4
- **File Scope:** All 19 private repos cross-referenced with public repos
- **Acceptance Criteria:**
  - Duplicate analysis for each private repo with public equivalent
  - Specific duplicates identified: template-lang-go, template-commons, phenotype-docs-engine, phenotype-agent-core, phenotype-config, phenotype-agents
  - For each duplicate: recommendation (merge, archive private, archive public, or keep both)
  - Rationale documented for each recommendation
  - Stakeholder review of duplicate resolution plan
- **Estimated Effort:** M

Identify and analyze duplicates between private and public repositories. Six private repos have public equivalents that may contain overlapping functionality. Each duplicate pair is analyzed and a resolution recommendation is made.

### Subtasks
- [ ] T036 Compare template-lang-go (private) vs template-lang-go (public): overlap analysis
- [ ] T037 Compare template-commons (private) vs template-lang-commons (public): overlap analysis
- [ ] T038 Compare phenotype-docs-engine (private) vs phenotype-docs-engine (public): overlap analysis
- [ ] T039 Compare phenotype-agent-core (private) vs phenotype-agent-core (public): overlap analysis
- [ ] T040 Compare phenotype-config (private) vs phenotype-config (public): overlap analysis
- [ ] T041 Compare phenotype-agents (private) vs phenotype-agents (public): overlap analysis
- [ ] T042 For each duplicate pair: recommend merge, archive private, archive public, or keep both
- [ ] T043 Document rationale for each recommendation
- [ ] T044 Present duplicate analysis to stakeholders for review
- [ ] T045 Incorporate stakeholder feedback into resolution plan

### Dependencies
- WP-001 (catalog complete, all repos documented)

### Risks & Mitigations
- Stakeholder disagreement: Clear rationale, data-driven recommendations, appeal process
- Hidden functionality differences: Deep code comparison, not just surface-level analysis

---

## WP-005: Create Sync Plan for Private ↔ Public Repo Parity

- **State:** planned
- **Sequence:** 5
- **File Scope:** Sync plan documentation, governance model for private repos
- **Acceptance Criteria:**
  - Sync plan for each private-public repo pair with: direction, frequency, conflict resolution
  - Governance model for private repo lifecycle management
  - Access control procedures documented
  - Security requirements documented for private repos
  - Maintenance schedules defined for all private repos
  - Comprehensive private repo catalog published
- **Estimated Effort:** M

Create a governance model and sync plan for managing private repositories going forward. This includes sync strategies for private-public repo pairs, access control procedures, security requirements, and maintenance schedules. The comprehensive private repo catalog is published as the final deliverable.

### Subtasks
- [ ] T046 Design sync plan for each private-public pair: one-way sync, two-way sync, or manual
- [ ] T047 Define sync frequency: per-repo schedule based on change velocity
- [ ] T048 Define conflict resolution: how to handle divergent changes between private and public
- [ ] T049 Establish access control procedures: who can access, how to request, approval process
- [ ] T050 Document security requirements: credential handling, code review, audit logging
- [ ] T051 Define maintenance schedules: update cadence, dependency updates, security patches
- [ ] T052 Define private repo lifecycle: creation, active maintenance, archival criteria
- [ ] T053 Publish comprehensive private repo catalog with all findings
- [ ] T054 Present governance model to stakeholders for approval
- [ ] T055 Implement approved governance procedures

### Dependencies
- WP-004 (duplicate analysis complete, sync targets identified)

### Risks & Mitigations
- Sync complexity: Start with manual sync, automate incrementally
- Security requirements: Involve security team in requirements definition
- Governance adoption: Clear documentation, training for team members

---

## Dependency & Execution Summary

```
WP-001 (Catalog 19 private repos) ───────────── first, no deps
WP-002 (Complete core agent infra) ──────────── depends on WP-001
WP-003 (Complete apps/tools) ────────────────── depends on WP-001 (parallel with WP-002)
WP-004 (Identify duplicates with public) ────── depends on WP-001
WP-005 (Sync plan + governance) ─────────────── depends on WP-004
```

**Parallelization**: WP-002 and WP-003 can run in parallel (different repo sets). WP-004 can start after WP-001. WP-005 is the final step.

**MVP Scope**: WP-001 alone produces the private repo catalog. WP-004 adds duplicate analysis.
