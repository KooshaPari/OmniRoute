# Changelog

All notable changes to `pheno-otel` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- AGENTS.md, llms.txt, WORKLOG.md, CHANGELOG.md, LICENSE-MIT (T1.3 of v7 DAG, 2026-06-18)

## [0.1.0] - 2026-06-15

### Added
- Initial release of `pheno-otel`.
- `init(service_name)` — install OTLP/HTTP span exporter (env-driven endpoint)
- `init_with_stdout(service_name)` — install stdout span exporter for local dev
- `TelemetryGuard` — Drop-based guard that flushes and shuts down the global tracer provider
- `guard.shutdown()` — explicit shutdown that yields the underlying flush error (Drop becomes no-op)
- `OtelError` — typed error enum (ExporterInit, ResourceBuild, Shutdown)
- Integration tests in `tests/init_test.rs` with `INIT_LOCK` mutex serializing global state
- Pinned to OpenTelemetry 0.27 line with `http-proto`, `reqwest-client`, `reqwest-rustls`, `trace` features
