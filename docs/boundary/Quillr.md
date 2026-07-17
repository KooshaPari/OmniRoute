# Quillr + Httpora Boundary (absorbed)

## Status

**Absorbed 2026-07-17** into two spine targets:

| Half | Language | Spine Target | Path |
|------|----------|--------------|------|
| `crates/httpora-core` | Rust | `pheno` monorepo | `crates/httpora-core/` |
| `src/` (`@kooshapari/quillts`) | TypeScript | `phenodocs` | `packages/quillts/` |

The original `KooshaPari/Httpora` and `KooshaPari/Quillr` repos no
longer exist (Quillr was archived 2026-07-17; Httpora was already
SUPERSEDED in the disposition-index).

## Boundary

The HTTP middleware boundary covers:

1. **Tower-compatible Rust middleware** (`httpora-core`):
   - Rate limiting (token bucket, sliding window)
   - Retries with exponential backoff + jitter
   - Circuit breakers (closed/open/half-open FSM)
   - CORS handling
   - OTEL bindings (W3C trace-context propagation)
   - Clock abstraction for testability

2. **TypeScript HTTP client** (`@phenotype/quillts`):
   - Fetch-based client with interceptor hooks
   - Retry policy engine
   - Mock transport for tests
   - Trace correlation IDs (`X-Trace-Id` injection)
   - Type-safe response wrappers

## Consumer surface

| Consumer | Language | Pattern |
|----------|----------|---------|
| `pheno` monorepo Rust crates | Rust | `tower::Layer` middleware composition |
| `phenotype-go-sdk` Go services | Go | gRPC interceptor mirroring httpora patterns |
| `phenodocs` TS docs site | TypeScript | `@phenotype/quillts` for client-side fetches |

## Rationale

Quillr was chosen as the reconciliation name because:

1. The KooshaPari/Quillr repo already subsumed Httpora (2026-06-20)
2. The README's "Restored: Quillr" header documents the consolidation
3. The Rust crate kept `httpora-core` (descriptive) while the TS
   client kept `quillts` (brand-flavored)
4. Both halves carry complementary responsibilities — not duplicate
   concerns

## Replacement

| Old | New | Notes |
|-----|-----|-------|
| `KooshaPari/Quillr` | (archived) | Source archived 2026-07-17 |
| `KooshaPari/Httpora` | (already SUPERSEDED) | Was merged into Quillr in 2026-06-20 |
| `crates/httpora-core` (in Quillr) | `pheno/crates/httpora-core` | New home in the central Rust monorepo |
| `@kooshapari/quillts` (npm) | `@phenotype/quillts` (in phenodocs) | New home + org scope normalized |