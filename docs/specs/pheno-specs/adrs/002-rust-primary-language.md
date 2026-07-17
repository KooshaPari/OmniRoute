# ADR-002: Rust as Primary Systems Language

## Status

**Accepted** - 2024-02-01

## Context

The Phenotype ecosystem requires a primary systems programming language for:
- High-performance services
- CLI tools
- Systems-level libraries
- Cross-platform compatibility

We evaluated options based on:
- Performance characteristics
- Memory safety
- Developer productivity
- Ecosystem maturity
- Team expertise

## Decision

We will use **Rust** as the primary systems programming language for the Phenotype ecosystem.

## Consequences

### Positive

- Memory safety without garbage collection
- High performance comparable to C/C++
- Strong type system prevents many runtime errors
- Excellent tooling (cargo, rustfmt, clippy)
- Growing ecosystem of high-quality crates
- Cross-platform support

### Negative

- Steeper learning curve than Go or Python
- Longer compile times
- Smaller talent pool for hiring
- Some libraries still maturing

### Mitigations

1. **Training budget**: Allocate resources for team Rust education
2. **Mentorship**: Pair experienced Rust developers with newcomers
3. **Hybrid approach**: Use Go for rapid prototyping when appropriate
4. **Documentation**: Invest in internal Rust best practices guide

## Related

- Related: ADR-001 (Hexagonal Architecture - Rust traits enable this pattern)
- Affected specs: All systems-level specifications
