# ADR-ECO-021: PhenoCompose dead `cuda` feature flag removal

**Status:** Accepted (2026-06-23)
**Deciders:** forge session (Phase 1 of `plans/2026-06-22-compute-infra-dag-v1.md`)
**Refs:** monorepo ADR-014 (Hexagonal L4 ports + Adapters),
[ADR-ECO-014](./ADR-ECO-014-phenoshared-decompose.md) (Decompose phenoShared),
`PhenoCompose/CONSOLIDATION.md` (2026-06-08 audit).

## Context

`PhenoCompose/bindings/rust-ffi/Cargo.toml` declared
`[features] cuda = []` but no `#[cfg(feature = "cuda")]`
gate exists anywhere in the crate's source. The CONSOLIDATION.md
audit (2026-06-08) had already identified this as item #4 in its
list of dead surface:

> "Dead `[features] cuda = []` in `bindings/rust-ffi/Cargo.toml` —
> no `#[cfg(feature = "cuda")]` anywhere."

The flag was a historical placeholder for a future CUDA-specific
codegen (e.g. for `nvml` or `cudart` device memory allocation) that
was never written. Carrying it forward is dead surface: the
presence of the flag implies the existence of a feature-gated code
path that does not exist, and the CI matrix does not exercise it
(no test calls `--features cuda`).

## Decision

1. **Remove `[features] cuda = []`** from
   `bindings/rust-ffi/Cargo.toml`.
2. **Add a comment** explaining the history and the future
   revival pattern: when CUDA-specific codegen is added, the
   feature should be `[features] cuda = ["dep:cudarc"]` with
   an optional `cudarc` dep, not a bare `cuda = []` flag.
3. **No behavior change** — the FFI surface (12 `extern "C"`
   functions + the in-process `shim` reference impl at
   `bindings/rust-ffi/src/lib.rs:398-598`) is unchanged.
4. **`cargo check -p nvms-ffi --offline` GREEN** — verified.

## Rationale

- **Reduce cognitive load** — every dead flag in a Cargo.toml is
  a 30-second distraction for new contributors trying to
  understand the build matrix.
- **Match the `CONSOLIDATION.md` audit** — the audit identified
  this in 2026-06-08; we close the loop now.
- **SOTA alignment** — the 2026 Cargo idiom is
  `[features] foo = ["dep:foo"]` (explicit optional dep), not
  a bare `foo = []` flag. Bare flags are an anti-pattern.

## Consequences

- `PhenoCompose/bindings/rust-ffi/Cargo.toml` is 3 lines
  shorter.
- The `shim` module (in-process reference impl) is unaffected.
  It is **not** feature-gated; the `cuda` removal does not
  change what is exposed.
- `pheno-compose-driver` consumers (which depend on
  `nvms-ffi`) are unaffected.
- The Mojo/Zig experimental bindings are unaffected.

## Alternatives considered

- **A: Add a real `cuda` feature with `dep:cudarc`** — would
  require a new optional dep, a new code path, and a new
  test. The audit window did not include the engineering time
  to design the CUDA surface. Deferred to Phase 2.
- **B: Mark the feature as `default-features = false` with a
  warning** — adds complexity without value. Rejected.
- **C: Move the flag to a workspace `[features]` table** —
  would require all 7 port-trait crates to participate. Out
  of scope.
