# ADR-014: Hexagonal L4 ports pattern: `Port` trait + `Adapter` impl

**Status:** Accepted 2026-06-15
**Deciders:** PhenoRust 1.0 architecture circle
**Supersedes:** ad-hoc trait/object patterns; 17 inconsistent port-style abstractions across the fleet

## Context

The PhenoRust 1.0 plan (`plans/2026-06-14-phenorust-1.0-plan-1.0.md:40-200`) defines a 10-repo hex-port topology: each repo gets a `domain` trait, an `adapter` struct, and a `port` module. The trait is `dyn`-compatible. As of V5, the pattern is *partially* applied:

- `pheno-tracing`: 1 `Port` trait (`src/port.rs`), 5 adapters (`src/adapters.rs`), 8/8 tests, integration tests in `tests/port_integration.rs`. ✅
- `pheno-mcp-router` (Python, same pattern): 3 protocols, 3 ABCs, 6 adapters, 11/11 tests. ✅
- 17 other pheno-* repos: ad-hoc — each repo invents its own trait shape, adapter location, and test layout.

The divergence means a consumer that wants to swap an adapter (e.g. swap `pheno-errors`'s in-memory reporter for the OTLP one) must learn a per-crate layout.

## Decision

The hexagonal L4 pattern is fixed as follows:

1. **Every Rust pheno-* lib** exposes a `Port` trait in `src/port.rs`.
2. The lib exposes **at least 2 concrete adapters** in `src/adapters.rs`.
3. **Integration tests** live in `tests/port_integration.rs` (not in `src/`) and exercise the trait through at least 2 adapters.
4. The `Port` trait is the L4 hexagonal layer; **all 5 focus repos** consume it.
5. The pattern is enforced by a workspace-level `cargo xtask lint-ports` check (added in V6).

## Consequences

**Positive**
- Consumers learn one layout: `use pheno_x::port::Port; use pheno_x::adapters::Foo;`. Per-crate port discovery is zero.
- The integration test surface (`tests/port_integration.rs`) is the right place for cross-adapter contract tests.
- `dyn`-compatible traits enable runtime adapter selection — the L4 hex primitive.

**Negative**
- 17 repos need a one-time refactor to add `src/port.rs` + `src/adapters.rs` + `tests/port_integration.rs`. The refactor is mechanical (extract existing trait, move impls to `adapters.rs`, write 1 integration test per adapter).
- The `cargo xtask lint-ports` check is a new CI gate; it will be red until the 17 repos are migrated.

**Mitigation**
- A `pheno-port-adapter` template crate scaffolds `src/port.rs`, `src/adapters.rs`, and `tests/port_integration.rs` for any new repo.
- Migration is tracked per-repo in `L6_PHENO_REPOS_HEALTH_2026_06_15_DELTA.md`.

## Alternatives considered

- **Per-crate trait shape (status quo).** Rejected: 17 layouts is a 17× learning curve; the divergence *is* the problem.
- **One `pheno-port` mega-crate that re-exports every Port trait.** Rejected: creates a hub crate that every other crate must depend on; per-crate `src/port.rs` is the right granularity.
- **No trait, just concrete types and `Box<dyn Any>` swaps.** Rejected: loses type-safe `dyn`-dispatch that makes adapter swaps expressible at the type level.

## References

- `pheno-tracing/src/port.rs` — reference `Port` trait.
- `pheno-tracing/src/adapters.rs` — reference adapter module.
- `pheno-tracing/tests/port_integration.rs` — reference integration test.
- `V4 §5` — the L4 hexagonal layer definition.
- `V22 §92.3` — the hex-port subsection in the V22 retro.
