# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) for the Phenotype ecosystem.

## What is an ADR?

An Architecture Decision Record (ADR) captures an important architectural decision made along with its context and consequences. ADRs help teams:

- Remember why decisions were made
- Onboard new team members with context
- Avoid revisiting settled decisions
- Document technical debt and trade-offs

We use the [MADR](https://adr.github.io/madr/) (Markdown ADR) format with Phenotype-specific extensions.

## ADR Index

| ID | Title | Status | Date |
|----|-------|--------|------|
| [ADR-001](001-hexagonal-architecture.md) | Hexagonal Architecture Adoption | Accepted | 2024-01-15 |
| [ADR-002](002-rust-primary-language.md) | Rust as Primary Systems Language | Accepted | 2024-02-01 |
| [ADR-003](003-spec-driven-development.md) | Spec-Driven Development via AgilePlus | Accepted | 2024-03-01 |
| [ADR-004](004-unified-specification-registry.md) | Unified Specification Registry | Accepted | 2026-04-04 |
| [ADR-005](005-multi-format-documentation.md) | Multi-Format Documentation Strategy | Accepted | 2026-04-04 |
| [ADR-006](006-traceability-first-development.md) | Traceability-First Development | Accepted | 2026-04-04 |
| [ADR-007](007-evaluation.md) | Evaluation Strategy | Accepted | 2026-04-04 |
| [ADR-008](008-realtime-sync.md) | Real-Time Synchronization Strategy | Accepted | 2026-04-05 |
| [ADR-009](009-audit-hash-chain.md) | Audit Logging | Accepted | 2026-04-04 |
| [ADR-010](010-storage-dual-engine.md) | Storage Engine | Accepted | 2026-04-04 |
| [ADR-011](011-sdk-kit-matrix.md) | Canonical SDK Kit Taxonomy and Cross-Language Tiering | Proposed | 2026-06-02 |
| [ADR-012](012-architecture-foundation.md) | Architecture Foundation and Core Principles | Accepted | 2024-01-15 |
| [ADR-013](013-data-storage-strategy.md) | Data Storage and Persistence Strategy | Accepted | 2024-01-15 |
| [ADR-014](014-api-design-versioning.md) | API Design Standards and Versioning Strategy | Accepted | 2024-01-15 |
| [ADR-015](015-authn-authz-architecture.md) | Authentication and Authorization Architecture | Accepted | 2024-01-15 |
| [ADR-016](016-deployment-pipeline.md) | Deployment Pipeline and Infrastructure Strategy | Accepted | 2024-01-15 |
| [ADR-017](017-mcp-polyrepo-boundaries.md) | MCP Polyrepo Boundaries | Accepted | 2026-06-17 |
| [ADR-018](018-agent-session-zero-loop-ssot.md) | Agent Session Zero-Loop SSOT | Accepted | 2026-06-17 |
| [ADR-019](019-mcp-runtime-implementation-deps.md) | MCP Runtime ↔ Implementation Dependencies | Accepted | 2026-06-17 |

## ADR Categories

### Architecture & Design
- ADR-001: Hexagonal Architecture Adoption
- ADR-004: Unified Specification Registry
- ADR-012: Architecture Foundation and Core Principles
- ADR-013: Data Storage and Persistence Strategy
- ADR-014: API Design Standards and Versioning Strategy
- ADR-015: Authentication and Authorization Architecture
- ADR-016: Deployment Pipeline and Infrastructure Strategy

### Process & Workflow
- ADR-003: Spec-Driven Development via AgilePlus
- ADR-005: Multi-Format Documentation Strategy
- ADR-006: Traceability-First Development

### Technology Choices
- ADR-002: Rust as Primary Systems Language
- ADR-007: Evaluation Strategy
- ADR-008: Real-Time Synchronization Strategy
- ADR-009: Audit Logging
- ADR-010: Storage Engine
- ADR-011: Canonical SDK Kit Taxonomy and Cross-Language Tiering

## ADR Template

```markdown
---
id: ADR-NNN
title: Decision Title
status: proposed
date: YYYY-MM-DD
author: @username
tags: [category, tags]
---

# ADR-NNN: Decision Title

## Status

Proposed / Accepted / Deprecated / Superseded

## Context

What is the issue that we're seeing that is motivating this decision or change?

## Decision

What is the change that we're proposing or have agreed to implement?

## Consequences

What becomes easier or more difficult to do because of this change?

### Positive
- Benefit 1
- Benefit 2

### Negative
- Cost 1
- Cost 2

## Mitigations

How will we address the negative consequences?

## Related

- Related ADRs: ADR-NNN
- Affected specs: SPEC-XXX-NNN
- Supersedes: ADR-NNN (if applicable)
```

## Status Definitions

| Status | Meaning | Can Change To |
|--------|---------|---------------|
| **Proposed** | Under discussion | Accepted, Rejected |
| **Accepted** | Decision agreed | Deprecated |
| **Deprecated** | No longer recommended | Superseded |
| **Superseded** | Replaced by another ADR | (terminal) |

## Best Practices

1. **One decision per ADR**: Keep focused on a single architectural choice     
2. **Include context**: Explain the forces and constraints that led to this decision
3. **Document consequences**: Every decision has trade-offs
4. **Link related decisions**: Use the Related section to connect ADRs
5. **Review before accepting**: ADRs should be reviewed by the Architecture Team
6. **Update registry**: Always update registry.yaml when adding/modifying ADRs  

## References

- [MADR](https://adr.github.io/madr/) - Markdown ADR format
- [ADR Organization](https://adr.github.io/) - ADR resources and tools
- [Documenting Architecture Decisions](http://thinkrelevance.com/blog/2011/11/15/documenting-architecture-decisions) - Original blog post by Michael Nygard     
- [PhenoSpecs SPEC](../SPEC.md) - System specification

---

*For questions about ADRs, contact the Architecture Team.*
