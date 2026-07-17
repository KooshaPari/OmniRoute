# ADR-002: Traceability-First Documentation

**Status**: Accepted  
**Date**: 2026-04-04  
**Deciders**: Phenotype Core Team  
**Technical Story**: As an architect, I need to trace from requirements to implementation so that I can understand the impact of changes and ensure compliance with specifications.

---

## Context and Problem Statement

In complex software systems, critical knowledge is often lost between:
- **Requirements** (what we need to build)
- **Design decisions** (why we chose an approach)
- **Implementation** (the actual code)

This gap leads to:
1. **Knowledge silos**: Only authors understand why decisions were made
2. **Change impact blindness**: Modifying code breaks unknown requirements
3. **Compliance gaps**: Cannot prove requirements are met
4. **Onboarding friction**: New team members lack context

### Constraints

- Must work with existing codebases (no rewrite)
- Must not significantly slow development
- Must support multiple programming languages
- Must integrate with Git workflows

### Forces

| Force | Description | Weight |
|-------|-------------|--------|
| Visibility | Links must be discoverable | High |
| Maintainability | Links must not become stale | High |
| Minimal Intrusion | Should not disrupt coding flow | High |
| Tooling | Should work with existing tools | Medium |
| Standardization | Consistent format across repos | Medium |

---

## Considered Options

### Option 1: External Traceability Database

**Description**: Store traceability links in a separate database/tool

**Examples**: DOORS, Jama, Polarion, custom database

**Pros**:
- Rich query capabilities
- Dashboards and reporting
- Enterprise-grade features

**Cons**:
- Expensive (licensing)
- Requires separate workflow
- Sync issues with code changes
- Adoption barrier
- Vendor lock-in

### Option 2: Code Comments with Trace IDs

**Description**: Embed traceability directly in code comments

**Example**:
```python
# @trace SPEC-AUTH-001
# @implements PATTERN-OAUTH-PKCE
def authenticate():
    pass
```

**Pros**:
- Co-located with code
- Survives refactoring
- Language-agnostic
- Searchable with standard tools

**Cons**:
- Comment maintenance burden
- No centralized view
- Requires discipline
- Parsing required for reports

### Option 3: Git Commit Message Convention (Selected Hybrid)

**Description**: Use commit messages for high-level traceability, with optional code comments for precision

**Example**:
```
spec(AUTH): implement OAuth2 flow

Implements SPEC-AUTH-001 OAuth2 Authorization Code Flow
following PATTERN-OAUTH-PKCE for enhanced security.

@trace SPEC-AUTH-001
@implements PATTERN-OAUTH-PKCE
```

**Pros**:
- Git history as traceability log
- Standard tooling (git log)
- Works with any language
- PR reviews catch missing traces

**Cons**:
- Requires commit discipline
- Granularity limited to commits

### Option 4: Structured Metadata Files

**Description**: YAML/JSON files mapping specs to code locations

**Example**:
```yaml
# traceability.yaml
SPEC-AUTH-001:
  implementations:
    - file: src/auth/oauth.py
      lines: 10-50
  tests:
    - file: tests/test_oauth.py
```

**Pros**:
- Machine-readable
- Queryable
- Separate from code

**Cons**:
- Sync issues with refactoring
- Manual maintenance
- Easy to forget updates

### Option 5: Hybrid Approach (Selected)

**Description**: Combine commit messages for high-level traceability with optional inline comments for precision

**Commit Message**:
```
spec(AUTH): implement OAuth2 flow

Implements SPEC-AUTH-001
Closes SPEC-AUTH-001
```

**Code Comment (optional)**:
```python
# @trace SPEC-AUTH-001
def get_authorization_url():
    pass
```

**Registry Link**:
```yaml
# In PhenoSpecs/specs/auth/oauth.yaml
implemented_by:
  - repo: phenotype-auth-ts
    pattern: "spec\\(AUTH\\):.*SPEC-AUTH-001"
```

**Pros**:
- Multiple entry points for traceability
- Git history as audit trail
- Coarse-grained via commits, fine-grained via comments
- Works with existing workflows
- Validatable via CI

**Cons**:
- Multiple formats to learn
- Requires tooling to harvest links

---

## Decision Outcome

**Chosen**: Option 5 (Hybrid Approach)

### Traceability Protocol

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TRACEABILITY PROTOCOL                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LEVEL 1: Registry-Level Links                                              │
│  ┌────────────────┐      ┌────────────────┐      ┌────────────────┐        │
│  │  PhenoSpecs    │◀────▶│ PhenoHandbook  │◀────▶│   HexaKit      │        │
│  │  SPEC-XXX      │      │ PATTERN-XXX    │      │ TEMPLATE-XXX   │        │
│  └────────────────┘      └────────────────┘      └────────────────┘        │
│           │                    │                    │                      │
│           └────────────────────┼────────────────────┘                      │
│                                ▼                                           │
│                     ┌────────────────────┐                                 │
│                     │ phenotype-registry │                                 │
│                     │   (hub/index)      │                                 │
│                     └────────────────────┘                                 │
│                                                                             │
│  LEVEL 2: Commit-Level Links                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  Commit Message Format                                               │  │
│  │                                                                      │  │
│  │  type(scope): description                                            │  │
│  │                                                                      │  │
│  │  Implements SPEC-XXX                                                │  │
│  │  Follows PATTERN-YYY                                                │  │
│  │  Generated from TEMPLATE-ZZZ                                        │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  LEVEL 3: Code-Level Links (Optional)                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │  # @trace SPEC-XXX                                                    │  │
│  │  # @implements PATTERN-YYY                                            │  │
│  │  def function():                                                      │  │
│  │      pass                                                            │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Trace Comment Syntax

| Syntax | Meaning | Example |
|--------|---------|---------|
| `@trace SPEC-XXX` | Implements this spec | `@trace SPEC-AUTH-001` |
| `@implements PATTERN-XXX` | Follows this pattern | `@implements PATTERN-OAUTH-PKCE` |
| `@from TEMPLATE-XXX` | Generated from template | `@from TEMPLATE-GO-SERVICE` |
| `@see ADR-XXX` | Related decision | `@see ADR-001` |

### Validation Rules

1. **All commits to implementation repos SHOULD reference specs**
2. **Commits implementing new features MUST reference specs**
3. **Cross-registry links MUST be bidirectional**
4. **Stale links (spec deleted, code removed) MUST be detected in CI**

### Positive Consequences

- Full bidirectional traceability from spec to code
- Git history serves as audit trail
- Multiple granularity levels supported
- Validatable via automated tools

### Negative Consequences

- Requires team discipline with commit messages
- CI complexity for cross-repo validation
- Learning curve for new team members

### Mitigation Strategies

| Risk | Mitigation |
|------|------------|
| Commit discipline | Commit linting in CI, PR templates |
| CI complexity | Shared GitHub Actions workflow |
| Learning curve | Documentation, IDE snippets |

---

## Implementation

### Phase 1: Registry Links (Complete)

- [x] Establish PhenoSpecs → PhenoHandbook links
- [x] Establish PhenoSpecs → HexaKit links
- [x] Document link syntax in each registry

### Phase 2: Commit Convention (In Progress)

- [ ] Define commit message format
- [ ] Add commit linting to repos
- [ ] Create PR templates

### Phase 3: Code Comments (Planned)

- [ ] Define comment syntax per language
- [ ] Create IDE snippets
- [ ] Implement trace harvester tool

### Phase 4: Validation (Planned)

- [ ] Cross-repo link checker
- [ ] Orphan detection
- [ ] Coverage reporting

---

## Links

- Parent ADR: ADR-001 (Multi-Registry Architecture)
- Related ADR: ADR-003 (Automated Validation Strategy)
- Conventional Commits: https://www.conventionalcommits.org/
- Git notes: https://git-scm.com/docs/git-notes

---

## Notes

This decision prioritizes:
1. **Git-native**: Works with existing tools
2. **Non-blocking**: Doesn't slow down development
3. **Validatable**: Can be checked automatically
4. **Evolvable**: Can start simple and add rigor

The hybrid approach acknowledges that:
- Not all code needs fine-grained traceability
- Commit-level traceability provides 80% of value
- Code-level comments handle the remaining 20%
