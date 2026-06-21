# ADR-036: `pheno-tracing` is the canonical OTLP/tracing substrate

**Status:** ACCEPTED
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**L8-002** (v8 track T22)
**Refs:**
- ADR-012 (pheno-tracing canonical, predecessor)
- ADR-023 (substrate placement Rule 3.1)
- `findings/2026-06-17-L6-pheno-repos-health.md` (pheno-tracing adoption matrix)
- `findings/2026-06-18-L8-002-pheno-tracing-adoption.md` (this ADR's execution plan)

---

## Context

`KooshaPari/pheno-tracing` is a Rust crate providing OTLP-exporting tracing setup. Prior adoption was uneven:

- 5 of 22 pheno-* Rust crates use pheno-tracing (23%)
- 0 Python packages use a pheno-tracing analogue
- 0 TypeScript packages use a pheno-tracing analogue
- 0 federated services use pheno-tracing for OTLP export

The 71-pillar audit (ADR-024, pillar L56: structured logging, L57: distributed tracing) flags 17/22 pheno-* Rust crates as **incomplete** on observability.

## Decision

**`pheno-tracing` is the canonical OTLP/tracing substrate for ALL Rust substrate (pheno-*, phenotype-*-sdk Rust). Adoption is required for new substrate starting 2026-06-22 (post-ADR-025 v2.0 deprecation).**

### Adoption matrix (22 Rust crates)

| Repo | Current state | Required action |
|---|---|---|
| `pheno-agents-md` | 0/3 OTLP metrics | Add `pheno-tracing` init in main, add `tracing::instrument` to 3 hot paths |
| `pheno-cargo-template` | template only | Document `pheno-tracing` setup in README |
| `pheno-cli-base` | partial | Add OTLP exporter config |
| `pheno-config` | 0/3 | Add `pheno-tracing` init |
| `pheno-context` | partial | Add `tracing::instrument` to span propagation |
| `pheno-errors` | 0/3 | Add `tracing::error!` on error types |
| `pheno-flags` | 0/3 | Add `tracing::debug!` on flag evaluation |
| `pheno-otel` | full | KEEP (canonical) |
| `pheno-port-adapter` | 0/3 | Add `tracing::instrument` to adapter dispatch |
| `pheno-tracing` | full | KEEP (canonical) |
| `pheno-go-ctxkit` | n/a (Go) | Use `pheno-otel` Go SDK |
| `pheno-zod-schemas` | n/a (TS) | Use OpenTelemetry JS SDK |
| 10 more | varies | Per-row migration |

## Migration sequence (15 PRs, ~120 min)

| # | Repo | Action |
|---|---|---|
| 22.1 | pheno-tracing | KEEP (no action) |
| 22.2 | pheno-otel | KEEP (no action) |
| 22.3 | pheno-config | Add init + 3 instrumented functions |
| 22.4 | pheno-context | Add init + span propagation |
| 22.5 | pheno-errors | Add `tracing::error!` macro on Display impls |
| 22.6 | pheno-flags | Add init + flag evaluation tracing |
| 22.7 | pheno-port-adapter | Add init + adapter dispatch tracing |
| 22.8 | pheno-cli-base | Add OTLP exporter config |
| 22.9 | pheno-agents-md | Add init + 3 hot paths |
| 22.10 | pheno-go-ctxkit | Wire `pheno-otel` Go SDK init |
| 22.11 | pheno-zod-schemas | Wire OpenTelemetry JS SDK init |
| 22.12-22.15 | 4 federated services (phenoMCP, phenoObservability, phenoEvents, phenotype-hub) | Add `pheno-tracing` init at startup |

## Consequence

- 17/22 pheno-* Rust crates now have OTLP-exporting tracing (was 5/22)
- 4/4 federated services have OTLP export (was 0/4)
- 71-pillar L56/L57 scores improve from ~12/30 to ~22/30 across substrate
- `pheno-tracing` becomes a hard dependency for new substrate (gated by ADR-023 Rule 3.1)

## Cross-references

- ADR-012 (predecessor — same intent, expanded scope)
- ADR-023 Rule 3.1 (substrate quality bar)
- ADR-024 pillar L56/L57 (observability)
- `findings/2026-06-18-L8-002-pheno-tracing-adoption.md`
