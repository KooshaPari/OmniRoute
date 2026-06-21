# ADR-018: PRCP pattern (Polyglot Reuse via Canonical Ports)

**Status:** SUPERSEDED
**Date:** 2026-06-15
**Superseded by:** ADR-038 (Hexagonal port-adapter L4 policy, 2026-06-18 v8 wave A) + ADR-046 (Federation mTLS + OIDC, 2026-06-18 v8 wave C — federation-level PRCP)
**Author:** orchestrator (v6 Track 5 closure)
**Refs:**
- ADR-038 (canonical successor for v8+; port/adapter as the implementation shape)
- ADR-046 (federation-level PRCP for cross-org service-to-service)
- ADR-036B (pheno-tracing substrate — observability layer for port telemetry)
- ADR-012, ADR-013, ADR-014 (v5 substrate decisions PRCP was meant to unify)

---

## Context (historical)

In the v6 Track 5 closure (2026-06-15), the PRCP (Polyglot Reuse via Canonical Ports) pattern was formalized as the cross-language substrate strategy. PRCP says:

- **P**ort — a single canonical interface (e.g., `LlmPort`, `ConfigPort`, `TracingPort`) lives in the lowest-common substrate crate (`pheno-*` family)
- **C**anonical — exactly one Port trait per concern; never two competing implementations
- **P**olyglot — every language SDK (`phenotype-*-sdk-{go,py,ts,cs,swift}`) implements the same Port via its native idiom (Go interface, Python Protocol, TypeScript interface, C# interface, Swift protocol)

This was v6's strategy to avoid "N implementations of M concerns" sprawl that had plagued the v3-v5 fleet (e.g., 4 different tracing wrappers, 3 different MCP routers, 2 different config cascades).

## Decision (historical)

Every concern shared across ≥ 2 languages ships as:

1. A canonical Port trait in the `pheno-*` family
2. A `phenotype-*-sdk-{lang}` SDK per language implementing the Port
3. A `phenotype-*-framework` framework crate that consumes the SDKs (only if inversion-of-control is needed)
4. Per-concern test suite: `pheno-X/tests/port_contract.rs` — runs in CI, validates every SDK implements the same contract

## Why superseded

- ADR-038 (2026-06-18) is the implementation-shape successor: every substrate crate uses Port trait + Adapter impl pattern, with `scripts/check-hex-ports.sh` lint enforcement
- ADR-046 (2026-06-18) is the federation-level successor: cross-org service-to-service calls use the same Port pattern (extended with mTLS + OIDC for trust)
- ADR-038 adds: tier-specific port surface rules, observability via ADR-036B, coverage gate via ADR-040, quality bar via ADR-042B
- The v6 PRCP principle remains valid — v8 simply made it the substrate default and added the enforcement machinery

## Cross-references

- ADR-038 (canonical implementation shape)
- ADR-046 (federation-level PRCP — mTLS + OIDC for cross-org trust)
- ADR-036B (pheno-tracing substrate — observability for port telemetry)
- ADR-012, ADR-013, ADR-014 (v5 substrate decisions PRCP was meant to unify)
- ADR-040 (coverage gates per tier)
- ADR-042B (substrate quality bar)