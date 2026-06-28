# ADR-096: Router Architecture Adoption (Option B per ADR-050)

**Status:** Accepted
**Date:** 2026-06-28
**Author:** forge orchestrator
**Cycle:** 39 (v53)

## Context

ADR-050 proposed three router architecture options in 2026-06-20. The §8
user decision resolved to **Option B**: Bifrost as a transport library +
Phenotype-owned decision layer (`phenotype-router`).

Since then:
- `phenotype-router` has been bootstrapped as a Rust crate on
  `KooshaPari/phenotype-router` with full governance envelope:
  - `src/` — core router, types, selector/plugin/fallback interfaces
  - `tests/` — unit + integration test suites
  - `benches/` — Go benchmark harness
  - `AGENTS.md`, `Justfile`, `deny.toml`, `SPEC.md`, `CHANGELOG.md`, `WORKLOG.md`
- ADR-051 (Bifrost as library) and ADR-052 (Plugin SDK spec) remain
  **Proposed** — they depend on the first production integration of
  `phenotype-router` with the OmniRoute/Bifrost transport layer.

## Decision

Adopt Option B as the canonical router architecture:

1. **`phenotype-router`** is the sole decision-layer crate for the fleet.
   It resolves provider selectors, applies plugins, picks a primary provider,
   dispatches with fallback, and returns a `Decision`.
2. **Bifrost** is called as a transport library — `phenotype-router` does
   NOT embed Bifrost; it calls it as a dependency for the actual LLM endpoint
   dispatch.
3. **Plugin SDK** (ADR-052) is deferred until the first integration is
   production-validated. The plugin `Plugin` interface already exists in
   `phenotype-router/src/` as a trait; the SDK specification is a refinement
   of this trait.
4. **Fallback strategy** defaults to round-robin over provider candidates,
   with configurable max depth. Custom fallback strategies implement the
   `FallbackStrategy` interface.

## Status

- **Accepted**: This ADR formalizes the Option B decision. No further
  ADR needed for architecture direction.
- **Active**: `phenotype-router` v0.1.0 is the current crate version.

## References

- ADR-050: Router rebuild (2026-06-20)
- ADR-051: Bifrost as library (Proposed)
- ADR-052: Plugin SDK spec (Proposed)
- `KooshaPari/phenotype-router` — canonical crate
- `plans/2026-06-28-v53-execution.md` — v53 plan
