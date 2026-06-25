# ADR-ECO-018: phenotype-infra path-dep hygiene — drop git-pinned `pheno-tracing`, use in-workspace stub

**Status:** Accepted (2026-06-23)
**Deciders:** forge session (Phase 1 of `plans/2026-06-22-compute-infra-dag-v1.md`)
**Refs:** monorepo ADR-014 (Hexagonal L4 ports + Adapters),
monorepo ADR-048 (substrate graduation path),
[ADR-ECO-014](./ADR-ECO-014-phenoshared-decompose.md) (Decompose phenoShared).

## Context

`phenotype-infra/iac/` is the central IaC for the Phenotype compute
mesh. As of 2026-06-22, the workspace had four path-dep defects and
one unpinned git-source dep:

1. `oci-lottery/Cargo.toml`, `oci-post-acquire/Cargo.toml`,
   `observability/Cargo.toml`, and `tailscale/tailscale-keygen/Cargo.toml`
   all referenced `../../../phenoShared-wtrees/version-align-latest-tag/
   crates/phenotype-logging` — a path that does not exist for downstream
   consumers (`cargo check --workspace` failed with "no such file or
   directory").
2. The `observability/Cargo.toml` declared a git-source dep on
   `pheno-tracing` with `branch = "main"` (no version pin). `pheno-tracing`
   transitively required an unpublished `pheno-otel` crate, so the
   workspace could not build offline.

The result was that no consumer could clone `phenotype-infra` and
build it without first setting up a `phenoShared-wtrees/` directory
in the right relative path. This violated the org's "no git-pinned
branch deps" baseline and the `phenotype-org-governance` deny.toml
`bans = ["git@*", "git+https*"]` rule.

## Decision

1. **Add `iac/phenotype-logging-stub/`** — a new in-workspace crate
   that re-exports `tracing` + `tracing-subscriber` +
   `tracing-bunyan-formatter` with the API surface needed by the
   4 daemons (just `init_tracing()` and `DEFAULT_FILTER`).

2. **Replace all 4 broken path deps** with `path = "../phenotype-logging-stub"`
   (relative to each consumer's directory).

3. **Drop the git-source `pheno-tracing` dep** from the workspace
   `[workspace.dependencies]` block. Keep the `pheno-tracing` import
   name in the *future* re-migration (ADR-036) but do not depend on
   it in production code yet.

4. **Update each daemon's call site** to use
   `phenotype_logging::init_tracing()` (zero-arg, defaults to INFO)
   or `phenotype_logging::init_tracing(filter)` (explicit
   `tracing_subscriber::EnvFilter`).

5. **No behavior change at runtime** — the stub uses the same
   `tracing-subscriber` registry + `tracing_bunyan_formatter` JSON
   layer as the original code path. The `pheno-tracing` crate was
   a thin wrapper around these primitives anyway.

## Rationale

- **Builds offline** — the stub has no git or registry dependencies
  outside of crates.io, so CI is hermetic.
- **No functional regression** — the runtime behavior is identical
  (same `tracing` macros, same JSON formatting, same env-var-driven
  log level).
- **Respects the substrate graduation path** — `phenotype-logging-stub`
  is a substrate that other repos (PhenoCompose, nanovms, BytePort)
  can consume without re-creating the same stub.
- **Tracks the `pheno-tracing v0.5.0` upstream** — when
  `pheno-otel` is published, the stub can be removed in a single
  follow-up PR (tracked as ADR-036).

## Consequences

- `cargo check --workspace --all-targets` GREEN.
- `cargo test --workspace --lib --bins` 5 tests pass.
- The stub is added to the iac/ workspace `members = [...]` list.
- All four daemons (`oci-lottery`, `oci-post-acquire`,
  `tailscale-keygen`, `observability`) build standalone.
- `phenotype-org-governance` deny.toml `bans` rule is now satisfied
  (no `git@*` or `git+https*`).
- Re-migration to `pheno-tracing v0.5.0` is tracked in ADR-036.

## Alternatives considered

- **A: Vendor `pheno-tracing` in a `third_party/` directory** — adds
  maintenance burden and skews the API over time. Rejected.
- **B: Pin `pheno-tracing` to a specific git tag** — fragile (tag
  force-pushes), and transitively requires unpublished `pheno-otel`.
  Rejected.
- **C: Migrate to `opentelemetry-rs` directly** — premature; the
  org does not yet have an OTel collector. Rejected for now.
