# v29-T3 — L25.1 Exemplar-on-Error Adoption (P1→3.0)

## What
Verify all histogram recordings in pheno-otel + pheno-port-adapter attach an exemplar on error paths.

## Action
- Confirm `record_histogram().with_exemplar()` is called on every `AdapterError` return path in:
  - `pheno-port-adapter/src/adapters/tcp.rs`
  - `pheno-port-adapter/src/adapters/in_memory_cache.rs`
  - `pheno-tracing/src/lib.rs`
- File an issue if any error-path histogram is missing an exemplar.

Ref: `findings/2026-06-25-v27-T3-otel-exemplar-check.md` (spec from v27)
