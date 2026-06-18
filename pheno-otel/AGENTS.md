# pheno-otel

**Date:** 2026-06-18
**Status:** ACTIVE
**MSRV:** 1.82 (see `Cargo.toml`)

## Purpose

Canonical OpenTelemetry initialization for the Phenotype monorepo.
A one-liner `init()` that installs an OTLP HTTP/protobuf span exporter
behind a `Drop`-based guard that flushes+shuts down the global tracer
provider on scope exit.

## Build

```bash
cargo build --release
cargo test --workspace
cargo clippy --all-targets -- -D warnings
```

## Substrate Placement

`pheno-*-lib` (ADR-023) — pure reusable Rust library. Pinned to the
OpenTelemetry 0.27 stack. Fleet-critical substrate (L1 Architecture +
L4 Observability in the 71-pillar framework).

## Authority

phenotype-org-governance/SUPERSEDED.md
