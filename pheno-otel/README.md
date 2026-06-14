# pheno-otel

Canonical OpenTelemetry initialization for the Phenotype monorepo.

A one-liner `init()` that installs an OTLP HTTP/protobuf span
exporter behind a `Drop`-based guard. The guard flushes and shuts
down the global tracer provider when it goes out of scope, so a
service's main can just write:

```rust
fn main() -> Result<(), pheno_otel::OtelError> {
    let _guard = pheno_otel::init("my-service")?;
    // ...do work...
    Ok(())
    // guard drops here, flushing the last batch of spans.
}
```

## API

| Function | Purpose |
|---|---|
| `init(service_name)` | Install an OTLP/HTTP span exporter (env-driven endpoint). |
| `init_with_stdout(service_name)` | Install a stdout span exporter for local dev. |

Both return a `TelemetryGuard` whose `Drop` impl calls
`opentelemetry::global::shutdown_tracer_provider()` and force-flushes
the underlying span exporter. Calling `guard.shutdown()` explicitly
yields the underlying flush error and makes the Drop a no-op.

## Errors

`OtelError` is a `thiserror` enum with three variants:

- `ExporterInit` — the OTLP exporter builder rejected the
  configuration (e.g. invalid endpoint).
- `ResourceBuild` — the `Resource` for the tracer provider could not
  be built.
- `Shutdown` — flushing the exporter on shutdown returned an error.

All variants implement `std::error::Error + Send + Sync + 'static`
and produce useful `Display` strings (variant name + context).

## Build features

- `opentelemetry 0.27`
- `opentelemetry-otlp 0.27` with `http-proto`, `reqwest-client`,
  `reqwest-rustls`, and `trace` features enabled.
- `opentelemetry_sdk 0.27` with the `trace` feature.
- `thiserror 2`
- `futures-util 0.3` (for the `BoxFuture` re-export in the
  custom stdout exporter).

## Testing

```bash
cargo test -p pheno-otel
cargo clippy -p pheno-otel --all-targets -- -D warnings
```

The integration tests in `tests/init_test.rs` cover the public API
end-to-end; the unit tests in `src/{error,guard,exporter/stdout}.rs`
cover the implementation.
