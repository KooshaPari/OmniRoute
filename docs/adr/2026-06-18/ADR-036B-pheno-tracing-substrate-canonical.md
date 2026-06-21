# ADR-036B: `pheno-tracing` substrate canonical (re-affirmed)

**Status:** ACCEPTED
**Date:** 2026-06-18
**Author:** orchestrator (v8 wave A)
**L8-002** (v8 track T22)
**Refs:**
- ADR-012 (v5 predecessor — now SUPERSEDED by this ADR)
- ADR-023 (substrate placement Rule 3.1)
- ADR-038 (hexagonal port/adapter — `pheno-tracing` implements `TracingPort`)
- ADR-040 (coverage gates per tier)
- ADR-042B (substrate quality bar)
- ADR-048 (substrate graduation path)
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

| Tier | Crate | Current state | Target (L8 + L57) |
|------|-------|---------------|-------------------|
| lib | pheno-config | partial | full OTLP via pheno-tracing |
| lib | pheno-context | partial | full OTLP via pheno-tracing |
| lib | pheno-errors | partial | full OTLP via pheno-tracing |
| lib | pheno-flags | missing | adopt pheno-tracing |
| lib | pheno-port-adapter | full | maintained |
| lib | pheno-tracing | n/a (self) | n/a |
| lib | pheno-otel | full | maintained |
| lib | pheno-predict | missing | adopt pheno-tracing |
| lib | pheno-vessel | missing | archived |
| lib | pheno-profiling | missing | adopt pheno-tracing |
| framework | pheno-events | partial | full OTLP via pheno-tracing |
| framework | phenotype-bus | missing | adopt pheno-tracing |
| framework | phenotype-hub | partial | full OTLP via pheno-tracing |
| sdk | phenotype-go-sdk | n/a | uses pheno-go-ctxkit |
| sdk | phenotype-py-sdk | n/a | uses pheno-tracing analogue |
| sdk | phenotype-ts-sdk | n/a | uses pheno-otel-ts |
| sdk | phenotype-mcp-sdk-py | partial | full OTLP |
| sdk | phenotype-mcp-sdk-go | missing | adopt pheno-tracing |
| sdk | phenotype-mcp-sdk-ts | missing | adopt pheno-tracing |
| sdk | phenotype-mcp-sdk-cs | missing | adopt pheno-tracing |
| service | pheno-observability | partial | maintained |
| service | phenoMCP | partial | full OTLP via pheno-tracing |

### Why re-affirmed (not just continued from ADR-012)

- ADR-012 (2026-06-15, v5 SOTA sweep) was an **informal** finding without stable ADR numbering or enforcement machinery
- This ADR (036B) formalizes: tier-specific emission (lib vs framework vs service), coverage gate (ADR-040), quality bar (ADR-042B), graduation path (ADR-048)
- This ADR adds: lint enforcement via `scripts/check-otel-emit.sh` — fails CI if a pheno-* Rust crate does not emit OTLP via pheno-tracing

## Cross-references

- ADR-012 (v5 predecessor — SUPERSEDED by this ADR)
- ADR-013 (pheno-mcp-router canonical — also re-affirmed by ADR-037)
- ADR-014 (hexagonal L4 ports — re-affirmed by ADR-038)
- ADR-022 (config two-crate split — V6 predecessor; superseded by ADR-031 + ADR-035)
- ADR-038 (hexagonal port-adapter L4 policy)
- ADR-040 (coverage gates per tier)
- ADR-042B (substrate quality bar)
- ADR-048 (substrate graduation path)
- `findings/2026-06-17-L6-pheno-repos-health.md`
- `findings/2026-06-18-L8-002-pheno-tracing-adoption.md`