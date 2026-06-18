# Finding — `pheno-profiling` replaces `Profila` (L5-100)

**Date:** 2026-06-15
**Task:** L5-100
**ADR:** ADR-021
**Worklog:** `worklogs/L5-100-profila-replaced-2026-06-15.json`

## Headline

The `Profila` Python profiler wrapper (a thin shim around `py-spy`)
is replaced by the native Rust `pheno-profiling` crate that ships
flamegraph + tracing integration out of the box. `pheno-profiling`
depends on `pprof` (Rust port of Google pprof) and integrates
directly with `pheno-tracing` (so the flamegraph + structured logs
share a common span context).

## Why

- `Profila` was a 200-LOC Python shim that called `py-spy dump` and
  re-rendered the output. Half the time spent on the shim was
  re-formatting output that already existed in better shape inside
  `py-spy` itself.
- The `pheno-profiling` crate is Rust-native and so benefits from
  the same observability stack as the rest of the pheno-* services:
  shared request IDs, structured logging, OTLP export.
- The 2 services that used `Profila` (PhenoAgent daemon + a sidecar
  in PhenoCompose) had divergent output formats; both now write
  the same flamegraph HTML + collapsed stack JSON.

## Implementation

- `pheno-profiling/src/lib.rs`: 5 public functions
  - `start_session(name: &str) -> SessionId`
  - `mark_span(id: SessionId, name: &str)` (integrates with
    `pheno-tracing`'s current span)
  - `dump_flamegraph(id: SessionId) -> Vec<u8>` (SVG, collapsed,
    or pprof binary)
  - `end_session(id: SessionId) -> Report`
  - `enable_continuous(interval: Duration)` (background sampler
    that writes to `$PHENO_PROFILING_DIR/session-{ts}.json`)
- 12 unit tests + 1 integration test against `pprof` round-trip
- 2 consumers migrated:
  - PhenoAgent daemon: `--profile` flag → `pheno-profiling`
  - PhenoCompose sidecar: dropped, replaced with the daemon's
    built-in profiler endpoint

## Verification

- `cargo test -p pheno-profiling` → 13/13 pass
- 0 references to `Profila` (Python) in any active repo
- ADR-021 INDEX entry added

## Follow-ups

- None — closure is final.
