# ADR-001: Use Hexagonal Architecture as Default Pattern

## Status

**Accepted** - 2024-01-15

## Context

The Phenotype ecosystem consists of multiple services and libraries across different languages (Rust, Go, Python, TypeScript). We needed a consistent architectural pattern that:

1. Enables testability without heavy mocking
2. Allows swapping infrastructure (databases, queues, etc.) without changing business logic
3. Supports multiple deployment targets (bare metal, containers, serverless)
4. Is language-agnostic in concept

## Decision

We will use **Hexagonal Architecture (Ports and Adapters)** as the default pattern for all Phenotype components.

### Key Aspects

1. **Domain Layer** - Pure business logic, zero external dependencies
2. **Application Layer** - Use cases, orchestrates domain objects
3. **Adapter Layer** - Infrastructure implementations (HTTP, DB, message queues)

### Language-Specific Implementation

| Language | Hexagonal Term | Implementation |
|----------|---------------|----------------|
| Rust | Traits | `trait Repository`, `struct SqlRepository` |
| Go | Interfaces | `type Repository interface`, `type sqlRepository struct` |
| Python | Abstract Base Classes | `class Repository(ABC)`, `class SqlRepository(Repository)` |
| TypeScript | Interfaces | `interface Repository`, `class SqlRepository implements Repository` |

## Consequences

### Positive

- Testability: Domain logic tested without mocks
- Flexibility: Swap PostgreSQL for DynamoDB by changing one adapter
- Clarity: Business logic isolated from framework code
- Portability: Same domain runs on CLI, web server, or Lambda

### Negative

- Initial complexity: More files/abstractions than CRUD
- Learning curve: Team must understand ports/adapters concept
- Boilerplate: Interface definitions in each layer

## Mitigations

1. **Code Generation**: Use `phenotype-cli` to scaffold hexagonal structure
2. **Templates**: HexaKit provides language-specific hexagonal templates
3. **Documentation**: PhenoHandbook explains patterns with examples

## Examples

See [PhenoHandbook - Hexagonal Architecture](../../handbook/patterns/architecture/hexagonal.md)

## References

- Original: [Alistair Cockburn's Hexagonal Architecture](https://alistair.cockburn.us/hexagonal-architecture/)
- Related: [Clean Architecture by Robert Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- Related: [Ports and Adapters by Steve Freeman](https://martinfowler.com/articles/hexagonal/)
