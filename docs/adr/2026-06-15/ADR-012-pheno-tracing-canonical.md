# ADR-012: `pheno-tracing` as the canonical tracing crate across all pheno-* repos

**Status:** Accepted 2026-06-15
**Deciders:** PhenoRust 1.0 architecture circle
**Supersedes:** ad-hoc `log` + `env_logger` patterns in 8+ pheno-* repos

## Context

The pheno-* Rust fleet (pheno-errors, pheno-config, pheno-cargo-template, pheno-tracing, phenorust, pheno-zod-schemas, pheno-llms-txt, pheno-fastapi-base, pheno-vibecoding-guard) has accumulated three distinct observability stacks:

1. `log` + `env_logger` (the pre-`tracing` baseline; present in 8+ repos).
2. Bare `tracing` + `tracing-subscriber` (introduced piecemeal in pheno-errors and phenorust).
3. The purpose-built `pheno-tracing` crate (1× `Port` trait, 5 adapters, 8/8 tests passing).

The divergence forces every consumer to know which init pattern the producing crate used. Cross-repo JSON spans, request-id propagation, and OTLP export all require hand-rolled glue that `pheno-tracing` already provides.

## Decision

All pheno-* Rust repos use `pheno-tracing` for observability. The rules:

1. `pheno-tracing` is the only `tracing` facade re-export allowed in non-binary crates.
2. `tracing-subscriber` is permitted as a direct dependency **only** in main binary crates (where the subscriber is initialised once at startup).
3. No other tracing crates are permitted in the pheno-* workspace (no `log`, no `env_logger`, no `slog`, no custom macros).
4. The `Port` trait from `pheno-tracing` is the integration point for cross-repo span context.

## Consequences

**Positive**
- One init path, one set of env vars (`PHENO_TRACING_LEVEL`, `PHENO_TRACING_FORMAT`).
- Request-id and OTLP propagation are correct by default (the `OtlpAdapter` in `pheno-tracing` handles it).
- The 8/8 adapter tests in `pheno-tracing` cover failure modes that previously caused production incidents.

**Negative**
- Repos that currently use `log`/`env_logger` need a one-time migration; it is mechanical (`log::info!` → `tracing::info!` via the `pheno-tracing` `log` compat feature).
- `tracing-subscriber` is not a transitive dep we can hide; binary crates still compile it directly.

**Mitigation**
- Migration is tracked in `L6_PHENO_REPOS_HEALTH_2026_06_15_DELTA.md`; each repo carries a per-crate checklist.
- `pheno-tracing` exposes a `log` feature flag that auto-shims legacy `log::*!` calls into `tracing` events, so binary crates adopt without touching library callers.

## Alternatives considered

- **Status quo (per-repo init).** Rejected: 3 init patterns across 9 repos is a 3× test matrix and the source of cross-repo incident class.
- **`tracing` + `tracing-subscriber` direct in every repo.** Rejected: re-creates the same boilerplate per repo; loses the `pheno-tracing` adapter suite.
- **A `pheno-observability` meta-crate that wraps `tracing` + `opentelemetry` + `prometheus`.** Deferred: out of scope for V5. `pheno-tracing` is the L3 substrate; a future L4 crate can compose it.

## References

- `pheno-tracing/src/lib.rs` — crate root, `Port` trait, 5 adapters.
- `V4 §6` — V4 plan's L3 observability layer.
- `L6_PHENO_REPOS_HEALTH_2026_06_15_DELTA.md` — per-repo migration checklist.
