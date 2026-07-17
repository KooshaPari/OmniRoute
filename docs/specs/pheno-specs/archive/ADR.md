# phenoSDK — Architecture Decision Records (ADR)

## ADR-001: Hexagonal Architecture Pattern

**Status**: Accepted  
**Date**: 2026-04-04  
**Deciders**: Phenotype Core Team

### Context
phenoSDK needs to integrate with multiple backends (MCP servers, LLM providers, vector databases) while maintaining testability and clean boundaries.

### Decision
Adopt **Hexagonal Architecture** (Ports & Adapters) with:
- **Domain Layer**: Core business logic, independent of frameworks
- **Port Layer**: Interfaces defining what the domain needs
- **Adapter Layer**: Concrete implementations for external services

### Consequences
**Positive**:
- Easy to swap LLM providers without changing domain code
- Testability via mock adapters
- Clear separation of concerns

**Negative**:
- More boilerplate than simple layered architecture
- Learning curve for contributors

---

## ADR-002: Async-First Design

**Status**: Accepted  
**Date**: 2026-04-04

### Context
AI operations are inherently I/O-bound (LLM calls, MCP requests).

### Decision
Design all APIs as async-first with `async`/`await`. Provide sync wrappers for convenience.

### Consequences
- Better resource utilization
- Natural fit for streaming responses
- Requires Python 3.11+ for proper async support

---

## ADR-003: Pydantic for Data Validation

**Status**: Accepted  
**Date**: 2026-04-04

### Context
Need runtime validation with type hints.

### Decision
Use Pydantic v2 for:
- Request/response models
- Configuration validation
- API schema generation

---

## ADR-004: Repository Pattern for Persistence

**Status**: Proposed  
**Date**: 2026-04-04

### Context
Need consistent data access across different storage backends.

### Decision
Implement Repository Pattern with port interfaces for:
- Vector store operations
- Configuration storage
- Cache management

---

## ADR-005: Error Code System

**Status**: Accepted  
**Date**: 2026-04-04

### Decision
All errors use format: `PHENO-{DOMAIN}{SEQUENCE}`
- E1XX: Configuration errors
- E2XX: MCP errors  
- E3XX: LLM provider errors
- E4XX: Vector search errors
- E5XX: Auth errors

---

## References

- [PRD.md](./PRD.md)
- [CLAUDE.md](./CLAUDE.md)
