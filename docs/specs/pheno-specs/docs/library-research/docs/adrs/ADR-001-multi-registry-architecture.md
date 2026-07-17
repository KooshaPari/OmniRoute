# ADR-001: Multi-Registry Architecture

**Status**: Accepted  
**Date**: 2026-04-04  
**Deciders**: Phenotype Core Team  
**Technical Story**: As a developer, I need a unified way to discover specifications, patterns, and templates so that I can build software consistently across the organization.

---

## Context and Problem Statement

The Phenotype ecosystem requires a documentation and code generation system that spans multiple concerns:

1. **Specifications** (what to build): Requirements, ADRs, API contracts
2. **Patterns** (how to build): Design patterns, guidelines, methodologies
3. **Templates** (scaffolding): Code templates, project scaffolding

### Constraints

- Must support GitOps workflows (Git as source of truth)
- Must enable traceability from spec to code
- Must work with existing tooling (GitHub, Markdown, YAML)
- Must scale across multiple repositories
- Must allow independent evolution of each concern

### Forces

| Force | Description | Weight |
|-------|-------------|--------|
| Separation of Concerns | Each domain has different stakeholders and lifecycles | High |
| Cross-Domain Linking | Specifications reference patterns; patterns guide templates | High |
| Tooling Fit | Different domains need different tools (specs: YAML validation; docs: MkDocs) | Medium |
| Cognitive Load | Too many registries create confusion; too few create coupling | High |
| Evolution Speed | Patterns evolve faster than specs; templates must stay current | Medium |

---

## Considered Options

### Option 1: Single Monolithic Registry

**Description**: One repository containing specs, patterns, and templates

**Example Structure**:
```
phenotype-registry/
  specs/
  patterns/
  templates/
  docs/
```

**Pros**:
- Simple navigation (one place to look)
- Single CI/CD pipeline
- Easy cross-linking
- Unified search

**Cons**:
- Coupled release cycles
- Different domains require different tools (conflict)
- Blurs ownership boundaries
- Scalability concerns (repo size, clone time)
- Harder to adopt incrementally

### Option 2: Fully Separate Registries (No Coordination)

**Description**: Three independent repositories with no formal relationship

**Example Structure**:
```
PhenoSpecs/          # Independent
PhenoHandbook/       # Independent
HexaKit/            # Independent
```

**Pros**:
- Maximum autonomy
- Independent tooling choices
- Simple per-repo workflows

**Cons**:
- No cross-registry navigation
- Links break silently
- Duplicate metadata
- No unified discovery
- Traceability gaps

### Option 3: Hub-and-Spoke Model (Selected)

**Description**: Three specialized registries with a master index coordinating them

**Example Structure**:
```
phenotype-registry/   # Master index (hub)
PhenoSpecs/          # Specs registry (spoke)
PhenoHandbook/       # Patterns registry (spoke)
HexaKit/            # Templates registry (spoke)
```

**Pros**:
- Clear separation of concerns
- Cross-registry linking supported
- Independent tooling per domain
- Unified navigation via hub
- Scalable (add more spokes)
- GitOps-friendly

**Cons**:
- Requires maintaining the hub
- Link validation across repos
- Slightly more complex initial setup

### Option 4: Backstage-style Catalog

**Description**: Use Backstage as the unified registry interface

**Pros**:
- Mature developer portal
- Rich plugin ecosystem
- Entity model abstracts sources

**Cons**:
- Heavyweight (requires deployment)
- Overkill for documentation-only use case
- Requires JavaScript/TypeScript expertise
- Vendor lock-in (Spotify)

---

## Decision Outcome

**Chosen**: Option 3 (Hub-and-Spoke Model)

The hub-and-spoke model provides the best balance of separation and coordination:

1. **PhenoSpecs**: Specifications and ADRs
2. **PhenoHandbook**: Patterns, guidelines, methodologies
3. **HexaKit**: Templates and scaffolding
4. **phenotype-registry**: Master index linking all three

### Positive Consequences

- Each registry can use domain-appropriate tooling
- Cross-registry links are first-class and validated
- GitOps workflows work naturally per repo
- New domains can be added as new spokes
- Independent release cycles reduce friction

### Negative Consequences

- Link validation requires cross-repo CI coordination
- Hub must be kept in sync with spoke changes
- Users must understand the hub-and-spoke mental model

### Mitigation Strategies

| Risk | Mitigation |
|------|------------|
| Broken cross-links | Automated CI validation in phenotype-registry |
| Hub staleness | Require hub updates in spoke PR templates |
| Learning curve | Documentation and quick-start guides |

---

## Links

- Related ADR: ADR-002 (Traceability-First Documentation)
- Related ADR: ADR-003 (Automated Validation Strategy)
- PhenoSpecs: https://github.com/KooshaPari/PhenoSpecs
- PhenoHandbook: https://github.com/KooshaPari/PhenoHandbook
- HexaKit: https://github.com/KooshaPari/HexaKit

---

## Notes

This decision was informed by:
- Analysis of npm, PyPI, and crates.io (package registries)
- Study of Backstage and other developer portals
- Internal requirements gathering across teams

The hub-and-spoke model aligns with the Unix philosophy: do one thing well, and compose.
