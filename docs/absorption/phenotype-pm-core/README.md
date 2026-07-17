# Absorption Record — phenotype-pm-core

## Transfer Record

| Field | Value |
|-------|-------|
| Source repo | `KooshaPari/phenotype-pm-core` |
| Target repo | `KooshaPari/phenotype-tooling` |
| Target paths | `crates/traceability-core/`, `crates/traceability-decorators/`, `crates/trace-gate/` |
| Absorbed date | 2026-07-17 |
| Absorbed by | forge agent (batch absorption) |
| Verification | `cargo check` passes (doc warnings only) |

## What was absorbed

3 Rust crates (22 source files + tests):
- `traceability-core` — core data model, matrix, contract, progress, impact
- `traceability-decorators` — decorator patterns for link assertions
- `trace-gate` — governance gate binary with tests

## Workspace changes

- Added 3 members to `Cargo.toml` workspace
- Added `indexmap` to workspace dependencies
- Added `uuid` v5 feature
