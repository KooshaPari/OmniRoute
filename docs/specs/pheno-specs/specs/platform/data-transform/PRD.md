# Datamold — Product Requirements Document

**Version:** 0.1.0  
**Status:** Draft  
**Date:** 2026-04-04

---

## Product Vision

Datamold is a high-performance, type-safe TypeScript library for declarative data transformation between domain models, API DTOs, and persistence entities. It redefines the model mapping layer by leveraging TypeScript 7's native type system to provide compile-time verification of transformations, eliminating runtime overhead while ensuring type safety across the entire data pipeline.

---

## Target Users

### Primary Users

- **Backend API developers** building type-safe REST/gRPC services who need to transform between domain models and network DTOs
- **Full-stack applications** with strict type contracts between frontend and backend
- **Data engineering teams** processing structured data with complex transformation pipelines
- **Library authors** building type-safe abstractions over external APIs

### Secondary Users

- **Enterprise teams** requiring audit-traversable data transformations
- **Testing engineers** needing deterministic data generation from schemas

---

## Problem Statement

### The Transformation Tax

In typical TypeScript applications, developers write explicit mapping code for every data transformation:

```typescript
// Manual mapping — error-prone, repetitive
function userToDTO(user: User): UserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email.value, // Extract value from ValueObject
    createdAt: user.createdAt.toISOString(),
    roles: user.permissions.map(p => p.name),
    managerId: user.manager?.id ?? null,
  };
}
```

This approach suffers from:
1. **Maintenance burden** — Every domain model change requires updating multiple mappers
2. **Type drift** — Runtime errors when DTOs don't match domain assumptions
3. **No reuse** — Similar transformations copied across codebases
4. **Testing overhead** — Every mapper requires its own test suite

### Existing Solutions Fall Short

| Library | Type Safety | Performance | Bundle Size | Learning Curve |
|---------|-------------|-------------|-------------|----------------|
| class-transformer | Runtime only | Medium | 15KB | Low |
| class-validator | Runtime only | Medium | 12KB | Low |
| zod | Runtime + infer | Medium | 12KB | Medium |
| io-ts | Runtime + codec | Medium | 10KB | High |
| Datamold | Compile-time | High | <5KB | Medium |

---

## Core Features

### F1: Declarative Schema Definition

**Requirement:** Developers define transformations as schemas, not imperative code.

**User Story:** As a developer, I want to define a transformation schema once and have the mapper enforce type correctness automatically.

**Acceptance Criteria:**
- [ ] Schemas can be defined for simple value types
- [ ] Schemas support nested object transformations
- [ ] Schemas support array transformations with element mappers
- [ ] Schema definitions are type-checked at compile time
- [ ] Schema definitions are reusable across the application

**Example:**
```typescript
const UserToDTOSchema = schema(User, UserDTO, {
  transformers: [
    map('email', (email: Email) => email.value),
    map('createdAt', (date: Date) => date.toISOString()),
    map('permissions', mapArray(permissionToName)),
    optional('managerId', (manager: User | undefined) => manager?.id),
  ],
});

const dto = mapper.transform(user, UserToDTOSchema);
```

### F2: Zero-Cost Type Safety

**Requirement:** Type safety is enforced at compile time, not runtime.

**User Story:** As a developer, I want the TypeScript compiler to catch transformation errors before runtime.

**Acceptance Criteria:**
- [ ] Transformation source and target types are inferred from schema
- [ ] Property name mismatches are caught at compile time
- [ ] Type coercion is explicit and type-checked
- [ ] No `as` casts or `any` types in transformation logic
- [ ] IDE integration for schema autocompletion

### F3: Composable Transformers

**Requirement:** Complex transformations are built from reusable, composable building blocks.

**User Story:** As a developer, I want to build complex transformations from simple, tested pieces.

**Acceptance Criteria:**
- [ ] Transformers can be chained in sequence
- [ ] Transformers can be conditionally applied
- [ ] Transformers can have fallbacks for missing data
- [ ] Transformer libraries can be shared across projects
- [ ] Transformer composition is type-safe

**Example:**
```typescript
const fullName = compose(
  takeFirst('firstName', 'lastName'),
  joinWith(' '),
  trim(),
  toUpperCase,
);

const userToDisplayName = schema(User, DisplayName, {
  transformers: [map('displayName', fullName)],
});
```

### F4: Circular Reference Handling

**Requirement:** Object graphs with circular references can be serialized and deserialized.

**User Story:** As a developer, I want to transform objects with circular references (e.g., parent/child relationships) without special handling.

**Acceptance Criteria:**
- [ ] Circular references are detected automatically
- [ ] Cycles are broken with configurable placeholders
- [ ] Deserialization restores original graph structure
- [ ] Cycle detection depth is configurable
- [ ] Performance impact is minimal (<10% overhead)

### F5: Validation Pipeline

**Requirement:** Data can be validated before and after transformation.

**User Story:** As a developer, I want to validate data at transformation boundaries to ensure data integrity.

**Acceptance Criteria:**
- [ ] Pre-transformation validation catches invalid input
- [ ] Post-transformation validation ensures output correctness
- [ ] Validation errors are aggregated, not fail-fast
- [ ] Custom validators can be composed
- [ ] Validation rules are defined in schema

### F6: Type Projection

**Requirement:** Subsets of object properties can be selected via projections.

**User Story:** As a developer, I want to create multiple DTO variants from a single domain model.

**Acceptance Criteria:**
- [ ] Partial projections select a subset of properties
- [ ] Projections can rename properties
- [ ] Nested objects can be flattened
- [ ] Flattened objects can be expanded
- [ ] Projections compose with transformations

---

## Non-Functional Requirements

### Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Transformation throughput | > 100,000 ops/sec | Per core, simple schema |
| Memory allocation | < 2x source size | For typical transformations |
| Bundle size (core) | < 5KB gzipped | Core module only |
| Bundle size (full) | < 15KB gzipped | All features |

### Developer Experience

| Aspect | Target |
|--------|--------|
| IDE support | Full autocomplete for schemas |
| Error messages | Actionable, with location |
| Documentation | Inline TSDoc + examples |
| Learning curve | < 2 hours for core features |

### Compatibility

| Environment | Support |
|-------------|---------|
| TypeScript 7 | Primary (tsgo) |
| TypeScript 6 | Supported (tsc) |
| Node.js 22+ | Full |
| Bun 1.2+ | Full |
| Browser | Full (ES2022+) |

---

## User Journeys

### Journey 1: API DTO Transformation

**Actor:** Backend Developer  
**Goal:** Transform domain models to API DTOs

**Steps:**
1. Developer defines domain model with rich types
2. Developer defines DTO schema (flat, network-optimized)
3. Developer creates transformation schema
4. Mapper transforms requests/responses automatically
5. Type safety enforced at compile time

**Success Criteria:**
- Zero runtime type errors in production
- Transformation code is 80% shorter than manual mapping
- Schema changes trigger TypeScript errors across codebase

### Journey 2: Database Entity Mapping

**Actor:** Full-Stack Developer  
**Goal:** Map between ORM entities and domain models

**Steps:**
1. Developer defines entity schema (database columns)
2. Developer defines domain model (business logic)
3. Developer creates bidirectional transformation schemas
4. Mapper handles both directions automatically
5. Circular references in entities handled correctly

**Success Criteria:**
- Entity changes reflected in domain types
- Domain changes trigger entity validation
- Circular references in entity graphs handled

### Journey 3: Data Pipeline Transformation

**Actor:** Data Engineer  
**Goal:** Build transformation pipelines for data processing

**Steps:**
1. Developer defines source and target schemas
2. Developer composes transformers into pipeline
3. Developer adds validation at pipeline boundaries
4. Pipeline processes data with full type safety
5. Errors are aggregated with context

**Success Criteria:**
- Pipeline throughput > 50,000 records/sec
- Validation errors include source location
- Pipeline is testable in isolation

---

## Success Metrics

### Quantitative

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Lines of mapper code | 1000 | 200 | Per 100 entity pairs |
| Runtime type errors | 5/month | 0 | Production incidents |
| Transformation tests | 50 | 10 | Per feature |
| Bundle size | 15KB | <5KB | Core library |

### Qualitative

- Developer satisfaction score > 4.5/5
- Zero "type not assignable" errors after schema definition
- < 30 minutes to onboard new team member

---

## Out of Scope

The following are explicitly out of scope for v0.1.0:

- GraphQL resolver generation
- OpenAPI/Swagger integration
- Graph database adapters
- Real-time streaming transformations
- Distributed transformation pipelines

---

## Dependencies

### External Libraries

None — Datamold is a pure TypeScript library with zero runtime dependencies.

### Internal Dependencies

| Crate | Purpose |
|-------|---------|
| phenotype-types | Shared TypeScript types |
| phenotype-validation | Validation patterns |

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| TypeScript 7 adoption slow | Low | Support TypeScript 6 via tsc |
| Bundle size exceeds target | Medium | Aggressive tree-shaking, lazy loading |
| Complex schema debugging | Medium | Rich error messages, debugger support |
| Performance regression | Medium | Continuous benchmarks in CI |

---

## Milestones

### M1: Core Schema and Mapper (v0.1.0)
- Schema definition with type inference
- Basic transformations (simple + nested)
- Validation pipeline
- 100% test coverage

### M2: Advanced Features (v0.2.0)
- Circular reference handling
- Transformer composition
- Advanced projections
- Performance optimization

### M3: Ecosystem Integration (v0.3.0)
- zod adapter
- class-validator adapter
- TypeORM adapter
- Documentation site

---

## References

- [SPEC.md](./SPEC.md) — Technical specification
- [SOTA.md](./docs/research/SOTA.md) — Competitive landscape
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/)
- [Go-based TypeScript Compiler](https://devblogs.microsoft.com/typescript/announcing-typescript-7/)

---

**Document Owner:** Platform Architect  
**Last Updated:** 2026-04-04
