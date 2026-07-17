# Logify (absorbed)

> **Absorbed 2026-07-17**: `KooshaPari/Logify` v0.1.0 overlaid into
> `KooshaPari/PhenoObservability/crates/logkit/`. See
> `docs/absorption/Logify/README.md` for the full transfer record.

## Identity

- **Crate name**: `logkit` (Rust crate, part of PhenoObservability workspace)
- **Path in workspace**: `crates/logkit/`
- **Workspace**: `KooshaPari/PhenoObservability` (main spine for observability)
- **Prior home**: `KooshaPari/Logify` (archived)

## Responsibility

Provides the **org-shared logging surface** for all Phenotype Rust crates:

- Zero-cost structured logging framework
- Hexagonal architecture: domain / application / adapters / infrastructure
- Multiple sinks (console, file, structured)
- Async-aware (`tokio`)
- Field-based structured entries with correlation IDs
- Thread-safe primitives (`parking_lot`, `Send + Sync` enforced)

## Boundary (post-overlay)

In scope:

- `LoggerBuilder`, `Logger`, `LogEntry`, `Level`, `Sink` port
- Console + structured sinks (current adapters)
- Acceptance test stubs for FR-01..FR-09, NFR-01..NFR-05

Out of scope:

- Distributed tracing (handled by `tracingkit` in PhenoObservability)
- Metrics / OTLP (handled by `phenotype-observably-logging`)
- External sink integrations beyond console/structured

## Migration

External callers that depend on `KooshaPari/Logify` should update their
`Cargo.toml` to:

```toml
logkit = { workspace = true }
```

via PhenoObservability's workspace dependency declaration. The crate
name (`logkit`) is unchanged; only the source location moved from a
standalone GitHub repo to the PhenoObservability workspace.

## See also

- `docs/absorption/Logify/README.md` — full absorption record
- `KooshaPari/PhenoObservability/crates/logkit/STANDARDS.md` — logging
  standards preserved from prior absorption
- `KooshaPari/PhenoObservability/crates/logkit/docs/specs/acceptance/stubs/`
  — FR/NFR acceptance test oracle