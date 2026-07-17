# Datamold — Architecture Decision Records

**Version:** 0.1.0  
**Status:** Draft  
**Updated:** 2026-04-04

---

## ADR-DM-001: TypeScript-First Model Transformation Library

**Date:** 2026-04-04  
**Status:** Proposed  
**Context:** TypeScript applications require transforming data between domain models, API DTOs, and persistence entities. Existing solutions either rely on runtime reflection (class-transformer), require separate schema definitions (zod, io-ts), or lack composable transformation building blocks. None provide compile-time type safety with zero runtime overhead.

**Decision:** Build Datamold as a pure TypeScript 7 library that uses the type system for compile-time transformation verification. Key architectural choices:

1. **Schema-first design** — Transformations defined as declarative schemas, not imperative code
2. **Type-level validation** — TypeScript's type system verifies schema correctness at compile time
3. **Zero runtime overhead** — Transformations compile to direct property access, no reflection
4. **Composable transformers** — Build complex transformations from reusable transformer functions
5. **Zero dependencies** — Pure TypeScript with no runtime dependencies

**Consequences:** 
- TypeScript 7 (tsgo or tsc 7+) is required for full compile-time verification
- Learning curve for developers accustomed to runtime-only solutions
- Schema definitions add initial overhead that pays off in type safety
- No decorator support (by design — avoids experimentalDecorators dependency)

**Alternatives Considered:**
- Decorator-based approach (class-transformer): Rejected — runtime only, requires experimentalDecorators
- Runtime schema approach (zod, io-ts): Rejected — no compile-time verification, runtime overhead
- Code generation (automapper): Rejected — build complexity, generated code maintenance

---

## ADR-DM-002: Zero-Dependency Architecture

**Date:** 2026-04-04  
**Status:** Proposed  
**Context:** Transformation libraries should have minimal impact on application bundle size and dependency graph. Many libraries pull in validation, reflection, or polyfill dependencies that increase bundle size.

**Decision:** Datamold has zero runtime dependencies. All functionality is implemented in pure TypeScript using only the standard library.

**Consequences:**
- Bundle size <5KB gzipped for core module
- No transitive dependency vulnerabilities
- All type system features use native TypeScript
- Performance depends solely on JavaScript engine optimization

**Alternatives Considered:**
- Validation adapter for zod: Deferred — could be added as optional peer dependency
- Reflection polyfill: Rejected — would increase bundle size significantly

---

## ADR-DM-003: Schema Composition Model

**Date:** 2026-04-04  
**Status:** Proposed  
**Context:** Complex applications need to transform between many different model types. Schemas should be composable to avoid duplication and enable reuse.

**Decision:** Schemas are composed from:
1. **Source/target type pairs** — Compile-time type constraints
2. **Transformer chains** — Ordered list of transformation functions
3. **Validator chains** — Ordered list of validation predicates
4. **Projection rules** — Property selection and renaming

```typescript
const schema = schema(Source, Target, {
  transformers: [/* composable transformers */],
  validators: [/* composable validators */],
  projections: [/* property rules */],
});
```

**Consequences:**
- Schema definitions can be reused and extended
- Transformer libraries can be shared across projects
- Composition is type-safe (TypeScript infers types)

**Alternatives Considered:**
- Class-based schemas: Rejected — couples to class system
- Functional composition only: Rejected — lacks declarative structure

---

## ADR-DM-004: Circular Reference Handling Strategy

**Date:** 2026-04-04  
**Status:** Proposed  
**Context:** Object graphs with bidirectional relationships (parent/child, user/roles) cause serialization failures in most transformation libraries.

**Decision:** Datamold handles circular references through:
1. **Cycle detection** — Traverse graph with visited set, detect cycles
2. **Placeholder substitution** — Replace circular references with placeholders
3. **Restoration on deserialization** — Reconstruct original graph from placeholders

```typescript
// Serialization with cycle breaking
const serialized = mapper.serialize(graph, {
  placeholder: '__circular__:{id}',
  maxDepth: 10,
});

// Deserialization with cycle restoration
const restored = mapper.deserialize(serialized, {
  placeholders: /__circular__:(\w+)/,
  resolve: (id) => nodeMap.get(id),
});
```

**Consequences:**
- Automatic handling of parent/child, user/roles, and similar patterns
- Configurable placeholder format for integration compatibility
- Slight performance overhead (<10%) for cycle detection

**Alternatives Considered:**
- Ref counting: Rejected — requires schema annotations
- Property exclusion: Rejected — loses information
- Manual cycle breaking: Rejected — developer burden

---

## References

- [SPEC.md](./SPEC.md) — Technical specification
- [PRD.md](./PRD.md) — Product requirements
- [SOTA.md](./docs/research/SOTA.md) — Competitive landscape analysis

---

**Document Owner:** Architecture Team  
**Last Updated:** 2026-04-04
