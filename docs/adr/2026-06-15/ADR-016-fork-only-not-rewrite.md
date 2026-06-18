# ADR-016: Fork-only-not-rewrite policy for SOTA libraries

**Status:** Accepted 2026-06-15
**Deciders:** PhenoRust 1.0 architecture circle
**Supersedes:** ad-hoc "rewrite from scratch" attempts on 3 SOTA libraries in V3/V4

## Context

During V3 and V4, three pheno-* crates attempted to *rewrite* a well-maintained SOTA library from scratch:

1. `pheno-config` (V3) — rewrote `figment`'s layered-config model. Result: 2.1k LoC, 4 latent bugs, abandoned.
2. `pheno-llms-txt` (V4) — rewrote `reqwest`'s middleware pipeline. Result: 1.4k LoC, no async support, abandoned.
3. `pheno-mcp-router` (V4, Python) — initially tried to rewrite `mcp`'s protocol layer. Result: 0.8k LoC, broken on the v0.2 protocol change.

The common pattern: rewriting 100k+ LoC of well-tested SOTA libraries is a maintenance trap. The bugs the rewrites tried to fix were either upstream issues with a known fix in a later release, or real but minor and not worth a 2k-LoC fork.

## Decision

For well-maintained SOTA libraries, the pheno-* crates do not rewrite the functionality. They:

1. **Fork the API surface** — re-export a curated subset of the upstream API, named with the `pheno_*` prefix where appropriate.
2. **Wrap with a project-friendly trait** — the trait is the *interface*; the upstream is the *implementation*.
3. **Publish as a path-only dep** — the pheno-* crate is consumed via a Cargo path or workspace dep, not crates.io. The upstream remains the source of truth for the implementation.
4. **Re-export the upstream, not the rewrite** — `pheno-x` re-exports the upstream (e.g. `figment`, `axum`, `tokio`, `sqlx`) and adds a thin trait layer on top.

**SOTA libraries covered by this policy** (illustrative, not exhaustive): `cargo-dist`, `miso`, `sqlx`, `axum`, `tokio`, `figment`, `reqwest`, `serde`, `mcp`, `pydantic`, `fastapi`, `clap`, `anyhow`, `thiserror`.

## Consequences

**Positive**
- The pheno-* layer's value is in the *interface*, not the implementation. A 50-LoC trait over a 100k-LoC upstream is the right cost ratio.
- Upstream fixes (security, perf, API) flow through automatically via the re-export; the pheno-* crate does not re-derive them.
- Maintenance burden is bounded: the trait + the re-export glue is all that must be kept current.

**Negative**
- The pheno-* crate cannot fix a bug *inside* the upstream; it must work around the bug at the trait boundary.
- Upstream breaking changes propagate; the trait layer is a stabiliser, not a freeze.

**Mitigation**
- A `pheno_x::vendored` module re-exports the exact upstream version pinned in `Cargo.lock` so consumers can lock to a specific revision.
- The trait boundary is the right place for an adapter that papers over the upstream bug; the adapter is local, the upstream fix is upstream.

## Alternatives considered

- **Status quo (rewrite when convenient).** Rejected: 3 abandoned rewrites in V3/V4 are the evidence; the pattern does not pay back.
- **Vendor the upstream into the pheno-* crate (copy-paste the source).** Rejected: bloats the pheno-* crate, breaks the upstream license trail, and re-introduces the maintenance trap on every upstream release.
- **Wait for upstream to fix the bug; do not wrap until then.** Rejected: the trait layer is the *interface*; the bug is in the *implementation*. A stable interface over a buggy implementation is workable, and the implementation switches when the upstream fixes the bug.

## References

- `V4 §6 (L2 SOTA)` — the L2 SOTA library inventory.
- `V22 retro` — the section that names the 3 abandoned rewrites as the trigger for this policy.
- `pheno-tracing/src/lib.rs` — the reference "re-export upstream + add a `Port` trait" pattern.
