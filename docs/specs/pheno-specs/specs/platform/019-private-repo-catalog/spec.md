# Private Repo Catalog

## Meta

- **ID**: 019-private-repo-catalog
- **Title**: Catalog and Map 19 Private Repositories
- **Created**: 2026-04-01
- **State**: specified
- **Scope**: Shelf-level (cross-repo)

## Context

The Phenotype ecosystem contains 19 private repositories that are not visible in the public GitHub organization. These private repos contain sensitive code, internal tools, and experimental projects that require different handling than public repositories.

Without a comprehensive catalog of private repos, there is no clear understanding of what exists, how private repos relate to public repos, or where duplication occurs. This creates maintenance burden, security risks, and inefficiencies in development workflows.

This spec catalogs all 19 private repos, maps their relationships to public repos, identifies duplicates, and establishes a governance model for private repository management.

## Problem Statement

Private repositories are unmanaged and undocumented:
- **No catalog** — no comprehensive list of private repos and their purposes
- **Unknown relationships** — unclear how private repos relate to public repos
- **Potential duplicates** — private repos may duplicate public repo functionality
- **Access management** — unclear who has access to which private repos
- **Maintenance burden** — private repos not included in regular maintenance cycles
- **Security risks** — sensitive code may be exposed or improperly managed

## Goals

- Catalog all 19 private repositories with purpose and ownership
- Map relationships between private and public repos
- Identify duplicates between private and public repos
- Establish access management for private repos
- Create governance model for private repo lifecycle
- Document security requirements for private repos

## Non-Goals

- Migrating private repos to public (security review required separately)
- Deleting any private repos (archive only)
- Changing access controls without stakeholder approval
- Auditing code quality in private repos (separate spec)

## Repositories Affected

| Repo | Language | Purpose | Public Equivalent | Action |
|------|----------|---------|-------------------|--------|
| template-lang-go | Go | Private Go templates | template-lang-go (public) | Evaluate duplicate, merge or archive |
| template-commons | Shared | Private shared templates | template-lang-commons (public) | Evaluate duplicate, merge or archive |
| Schemaforge | Rust | Schema generation | None | Document, maintain as private |
| Flagward | TypeScript | Feature flag service | None | Document, maintain as private |
| phenotype-docs-engine | Rust | Documentation engine | phenotype-docs-engine (public) | Evaluate duplicate, merge or archive |
| phenotype-evaluation | Python | Evaluation framework | None | Document, maintain as private |
| phenotype-skills | TypeScript | Agent skills | None | Document, maintain as private |
| Prismal | TypeScript | React component library (spec-only stub; src/index.ts is `export {};`; never published to npm) | None | Archived 2026-05-03; do not implement |
| Cursora | TypeScript | Cursor integration | None | Document, maintain as private |
| phenotype-patch | Rust | Patch management | None | Document, maintain as private |
| phenotype-sentinel | Rust | Security monitoring | None | Document, maintain as private |
| phenotype-agent-core | Rust | Agent core | phenotype-agent-core (public) | Evaluate duplicate, merge or archive |
| phenotype-vessel | Rust | Container utilities | None | Document, maintain as private |
| phenotype-config | Rust | Configuration | phenotype-config (public) | Evaluate duplicate, merge or archive |
| Parpoura | TypeScript | Data pipeline | None | Document, maintain as private |
| Civis | Go | Civic data tools | None | Document, maintain as private |
| phenotype-agents | Rust | Agent framework | phenotype-agents (public) | Evaluate duplicate, merge or archive |
| Holdr | Rust | Data holding | None | Document, maintain as private |
| Flowra | TypeScript | Workflow engine | None | Document, maintain as private |

## Technical Approach

### Phase 1: Discovery and Catalog (Week 1-2)
1. Query GitHub API for all private repos with metadata
2. Document each repo's purpose, ownership, and access controls
3. Map dependencies between private repos
4. Identify sensitive content requiring special handling

### Phase 2: Public-Private Mapping (Week 2-3)
1. Compare private repos with public repos
2. Identify duplicates between private and public repos
3. Document relationships and dependencies
4. Assess which private repos should remain private

### Phase 3: Duplicate Resolution (Week 3-4)
1. Evaluate each duplicate pair for merge or archive
2. Plan migration for repos to be merged
3. Archive repos that are superseded
4. Update references to archived repos

### Phase 4: Governance Model (Week 4-5)
1. Define private repo lifecycle management
2. Establish access control procedures
3. Create security requirements documentation
4. Define maintenance schedules for private repos

### Phase 5: Documentation and Verification (Week 5-6)
1. Document all private repos with purpose and ownership
2. Create comprehensive private repo catalog
3. Verify all access controls are correct
4. Establish ongoing governance process

## Success Criteria

- All 19 private repos cataloged with purpose and ownership
- Relationships between private and public repos mapped
- Duplicates identified and resolved
- Access management established for all private repos
- Governance model documented and operational
- Security requirements documented
- Comprehensive private repo catalog produced

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Accidental exposure of sensitive code | High | Careful handling, security review |
| Breaking dependencies during duplicate resolution | Medium | Thorough dependency mapping, testing |
| Access control misconfiguration | High | Careful review, stakeholder approval |
| Stakeholder disagreement on private/public status | Medium | Clear criteria, appeal process |
| Scope creep from additional private repos | Low | Strict scope enforcement, defer to future specs |

## Work Packages

| ID | Description | State |
|----|-------------|-------|
| WP001 | Discovery and catalog | specified |
| WP002 | Public-private mapping | specified |
| WP003 | Duplicate resolution | specified |
| WP004 | Governance model | specified |
| WP005 | Documentation and verification | specified |

## Traces

- Related: 012-github-portfolio-triage
- Related: 018-template-repo-cleanup
- Related: kooshapari-stale-repo-triage
