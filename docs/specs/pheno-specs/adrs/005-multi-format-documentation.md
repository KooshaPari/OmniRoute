# ADR-005: Multi-Format Documentation Strategy

## Status

**Accepted** - 2026-04-04

---

## Context

### The Challenge

Specifications in the Phenotype ecosystem naturally take different forms depending on their purpose:

| Purpose | Natural Format | Example |
|---------|---------------|---------|
| Feature requirements | Structured Markdown | kitty-spec format |
| API contracts | OpenAPI | REST API definitions |
| Architecture decisions | ADR (Markdown) | MADR format |
| System overviews | Markdown | README/SPEC files |
| Integration specs | Markdown | Sequence diagrams |

### Problems with Format Fragmentation

Without a unification strategy, each format exists in isolation:

1. **No Cross-Reference**: An ADR cannot easily reference an OpenAPI spec
2. **Discovery Failure**: Engineers don't know which format to search
3. **Validation Silos**: Each format needs separate tooling
4. **Inconsistent Structure**: No common metadata or frontmatter
5. **Tooling Duplication**: Multiple parsers, validators, renderers

### Existing Format Analysis

#### Markdown Specifications (Current)

**Format (kitty-spec):**
```markdown
---
id: kitty-spec-001
title: Feature Name
description: Brief description
category: [category]
type: feature|bugfix|refactor
---

# Title

## Overview
...

## Requirements
...
```

**Strengths:**
- Human-readable
- Version control friendly
- Rich formatting options
- Easy authoring

**Weaknesses:**
- Limited structure enforcement
- Custom frontmatter schema
- No standard validation

**Count in ecosystem:** ~30 specs

#### OpenAPI Specifications

**Format (OpenAPI 3.1):**
```yaml
openapi: '3.1.0'
info:
  title: API Name
  version: '1.0.0'
paths:
  /endpoint:
    get:
      summary: Description
```

**Strengths:**
- Industry standard
- Rich tooling ecosystem
- Code generation support
- Validation available

**Weaknesses:**
- YAML/JSON only (less readable)
- API-focused (not general specs)
- Verbose for simple cases

**Count in ecosystem:** ~10 APIs (partially documented)

#### Architecture Decision Records

**Format (MADR):**
```markdown
# ADR-001: Decision Title

## Status
Accepted

## Context
...

## Decision
...

## Consequences
...
```

**Strengths:**
- Lightweight
- Clear decision capture
- Good tool support
- Time-proven format

**Weaknesses:**
- Limited to decisions
- No code linkage
- Manual maintenance

**Count in ecosystem:** ~15 ADRs (scattered)

### Requirements

From analysis of existing documentation and team feedback:

**Functional:**
- FR-001: Support Markdown-based specifications
- FR-002: Support OpenAPI for API contracts
- FR-003: Support MADR for architecture decisions
- FR-004: Enable cross-format references
- FR-005: Unified search across all formats
- FR-006: Consistent metadata extraction

**Non-Functional:**
- NFR-001: Zero overhead for existing formats
- NFR-002: Don't invent new formats unless necessary
- NFR-003: Allow format-specific tooling
- NFR-004: Common registry interface

### Options Considered

#### Option 1: Single Format Mandate

**Approach**: Standardize on one format (e.g., Markdown with embedded OpenAPI).

**Pros:**
- Ultimate simplicity
- Single toolchain
- Consistent experience

**Cons:**
- Massive migration effort
- Loses OpenAPI tooling benefits
- Poor fit for API documentation
- Team resistance

**Verdict**: Rejected - too disruptive, loses valuable ecosystem integration.

#### Option 2: Format Conversion

**Approach**: Store in canonical format, convert to others as needed.

**Pros:**
- Single source of truth
- Flexible output
- Could support any format

**Cons:**
- Round-trip fidelity concerns
- Complex conversion logic
- Loses format-specific features
- Debugging difficulty

**Verdict**: Rejected - conversion complexity outweighs benefits.

#### Option 3: Polyglot Registry (Selected)

**Approach**: Support multiple formats with unified indexing.

**Pros:**
- Zero migration (existing docs remain)
- Retains format strengths
- Gradual adoption possible
- Flexible for future formats

**Cons:**
- More complex registry
- Format-specific validators needed
- Potential inconsistency

**Verdict**: Accepted - best balance of pragmatism and power.

---

## Decision

We will adopt a **Multi-Format Documentation Strategy** with unified indexing through the registry.

### 5.1 Supported Formats

| Format | Extension | Purpose | Schema Version |
|--------|-----------|---------|----------------|
| **Spec Markdown** | `.md` | Feature specifications | kitty-spec v2 |
| **OpenAPI** | `.yaml`, `.json` | API contracts | 3.1.0 |
| **MADR** | `.md` | Architecture decisions | MADR v3 |
| **Integration Spec** | `.md` | Cross-system specs | Phenotype v1 |

### 5.2 Unified Metadata Schema

All documents must include frontmatter/metadata with these fields:

```yaml
# Required for all
title: "Human-readable title"
id: "SPEC-XXX-NNN" | "ADR-NNN" | "API-XXX-VN"
status: draft | proposed | specified | accepted | implementing | implemented | deprecated

# Optional
domain: "auth|crypto|api|..."
created: "YYYY-MM-DD"
updated: "YYYY-MM-DD"
author: "@username"
tags: ["tag1", "tag2"]
implements: ["SPEC-XXX-NNN", "ADR-NNN"]  # What this implements/enables
implemented_by:  # What implements this (auto-populated in registry)
  - repo: "org/repo"
    path: "src/..."
```

### 5.3 Format-Specific Schemas

#### Spec Markdown Frontmatter

```yaml
---
id: SPEC-AUTH-001
title: OAuth 2.0 Implementation
domain: auth
status: implemented
created: 2024-01-15
updated: 2024-03-20
author: @kooshapari
tags: [auth, oauth, security]
implements: [ADR-012]
---

# Specification Title

## Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-001 | Support authorization code flow | P0 |
| FR-002 | Support PKCE extension | P0 |

## Technical Requirements
| ID | Requirement | Target |
|----|-------------|--------|
| TR-001 | Token lifetime | 15 min |

## Data Model
```typescript
interface AuthSession { ... }
```

## Implementation Links
- phenotype-auth-ts: `src/oauth/`
```

#### OpenAPI Extension Fields

```yaml
openapi: '3.1.0'
info:
  title: Auth API
  version: '1.0.0'
  x-phenotype-spec-id: SPEC-AUTH-001  # Extension for linking
  x-phenotype-domain: auth
  x-phenotype-status: implemented
  x-phenotype-implements: [SPEC-AUTH-001, SPEC-AUTH-002]

paths:
  /oauth/token:
    post:
      summary: Token endpoint
      x-phenotype-fr: FR-001  # Links to functional requirement
```

#### MADR Frontmatter

```markdown
---
id: ADR-005
title: Multi-Format Documentation Strategy
status: accepted
date: 2026-04-04
author: @kooshapari
tags: [documentation, process]
implements: []
---

# ADR-005: Multi-Format Documentation Strategy

## Status
Accepted

## Context
...

## Decision
...

## Consequences
...
```

### 5.4 Registry Integration

The `registry.yaml` normalizes all formats:

```yaml
specs:
  SPEC-AUTH-001:
    title: "OAuth 2.0 Implementation"
    path: "specs/auth/oauth-pkce/spec.md"
    format: "markdown"
    domain: auth
    status: implemented
    
openapi:
  auth-api-v1:
    title: "Authentication API v1"
    path: "openapi/auth-api.yaml"
    format: "openapi"
    version: "1.0.0"
    implements: [SPEC-AUTH-001, SPEC-AUTH-002]
    
adrs:
  ADR-005:
    title: "Multi-Format Documentation Strategy"
    path: "adrs/005-multi-format-documentation.md"
    format: "madr"
    status: accepted
    date: "2026-04-04"
```

### 5.5 Cross-Format Referencing

Enable references between formats:

**From Markdown spec to OpenAPI:**
```markdown
## API Contract

See [Auth API v1](../openapi/auth-api-v1.yaml) for OpenAPI specification.

See {{< openapi "auth-api-v1" >}} for embedded API docs.
```

**From OpenAPI to spec:**
```yaml
paths:
  /oauth/token:
    x-phenotype-spec: SPEC-AUTH-001
    x-phenotype-fr: FR-002
```

**From ADR to specs:**
```markdown
## Related Specifications

- [SPEC-AUTH-001: OAuth 2.0](../specs/auth/oauth-pkce/spec.md)
- API: [auth-api-v1](../openapi/auth-api-v1.yaml)
```

### 5.6 Validation Strategy

| Format | Validator | Integration |
|--------|-----------|-------------|
| Markdown | custom (phenospecs) | CLI + CI |
| OpenAPI | Spectral | CLI + CI |
| MADR | custom (phenospecs) | CLI + CI |
| YAML | yamllint | CI |

### 5.7 Tooling Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Unified Interface                         │
│                   (phenospecs CLI)                           │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│   Markdown   │ │ OpenAPI  │ │    MADR      │
│   Parser     │ │ Spectral │ │   Parser     │
└──────┬───────┘ └────┬─────┘ └──────┬───────┘
       │              │              │
       └──────────────┼──────────────┘
                      │
                      ▼
            ┌─────────────────┐
            │  Registry Index │
            │  (registry.yaml)│
            └─────────────────┘
```

---

## Consequences

### Positive Consequences

1. **Zero Migration**: Existing documents require only frontmatter additions
2. **Format Retention**: OpenAPI specs remain OpenAPI (tooling intact)
3. **Unified Discovery**: Single registry enables cross-format search
4. **Flexible Evolution**: New formats can be added without disruption
5. **Team Autonomy**: Teams use the right tool for the job
6. **Incremental Adoption**: No big-bang migration required

### Negative Consequences

1. **Complexity**: Multiple parsers and validators to maintain
2. **Inconsistency Risk**: Different formats may diverge in style
3. **Tooling Overhead**: Each format needs specific tooling
4. **Learning Curve**: Engineers must know which format to use when

### Mitigations

| Concern | Mitigation |
|---------|------------|
| Complexity | Start with 3 formats, add carefully |
| Inconsistency | Style guides per format + linting |
| Tooling | Shared infrastructure (CI templates) |
| Learning | Decision matrix in handbook |

### Format Selection Guide

| If you need to document... | Use Format |
|---------------------------|------------|
| Feature requirements | Spec Markdown |
| REST/HTTP API | OpenAPI |
| Architecture decision | MADR |
| Integration between systems | Integration Spec |
| High-level system overview | Spec Markdown |
| Database schema | Spec Markdown + diagrams |

---

## Related Decisions

- **ADR-004**: Unified Specification Registry - This strategy implements the registry's multi-format support
- **ADR-001**: Hexagonal Architecture - Spec formats document hexagonal boundaries

---

## References

1. [MADR Specification](https://adr.github.io/madr/) - Markdown ADR format
2. [OpenAPI 3.1.0](https://spec.openapis.org/oas/v3.1.0) - API specification standard
3. [Spectral](https://stoplight.io/open-source/spectral) - OpenAPI linter
4. [kitty-spec format](https://github.com/KooshaPari/AgilePlus/tree/main/kitty-specs) - Internal spec format
5. [RESEARCH.md](../RESEARCH.md) - Documentation system comparison

---

## Notes

This decision enables the registry to work with existing documentation while providing a path for unification. The key insight is that the registry provides the unified interface while allowing format diversity.

Future formats to consider:
- AsyncAPI for event-driven APIs
- C4 models for architecture diagrams
- JSON Schema for data models

---

*Last updated: 2026-04-04*
