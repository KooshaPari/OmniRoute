# Architecture

## Overview
- FocalPoint is a large Rust workspace with desktop, service, tooling, and integration crates.
- The current shape centers on the iOS app, shared focus domain libraries, and supporting services.
- This document is a skeleton that should be expanded with crate-level ownership and boundaries.

## Components
## apps/ios/FocalPoint
- iOS application entrypoint and platform integration surface.

## crates/*
- Shared focus domain crates, connectors, policy, telemetry, storage, and UI support.

## services/*
- Service-level crates such as the GraphQL gateway and templates registry.

## tooling/*
- Maintenance, release, validation, and repository support tooling.

## tests/e2e
- End-to-end validation harness for repo-level workflows.

## Data flow
```text
client input -> app layer -> shared crates -> services/tooling -> external APIs and storage
```

## Key invariants
- Keep domain logic in shared crates rather than in application shells.
- Treat connector and policy boundaries as explicit contracts.
- Maintain consistent behavior between local tooling and shipped binaries.

## Cross-cutting concerns (config, telemetry, errors)
- Config: use shared configuration patterns across crates and apps.
  - Rust: `phenoShared/phenotype-config-core` (canonical, ADR-012 PR-1/2/3)
  - Python: `pheno-config/` (canonical, ADR-012 PR-6/7)
  - TS: `phenotype-ts-utils/`
  - Go: `pheno-cli-base/` provides loader shims
- Telemetry: propagate structured logs and traces across the workspace.
  - `pheno-tracing` (ADR-012) is the canonical crate across all pheno-* repos
  - OpenTelemetry-compatible, exports to pheno-otel
- Errors: normalize failure handling so boundaries can report actionable messages.
  - `phenotype-error-core` (phenoShared) — `PhenotypeErrorKind` is the canonical enum
  - Each language crate has a local `From<phenotype_error_core::Error>` impl

## Polyglot pattern (v6)
- Each language surface (Rust, Python, Go, TS) gets a thin adapter crate in
  phenoShared that re-exports the canonical core with language-idiomatic
  types (e.g. `PyResult<T>` in Python, `Result<T, thiserror::Error>` in Rust).
- See ADR-014 (hexagonal L4 ports: `Port` trait + `Adapter` impl) for the
  dispatch pattern. Per-method modality/adapter selection lives in
  PlayCua's `modality/` and is the model for future SOTA work.

## Future considerations
- Replace crate group placeholders with a concrete per-crate breakdown.
- Add startup and sync diagrams for the desktop, service, and tooling paths.
- Capture release and integration assumptions as the workspace evolves.
