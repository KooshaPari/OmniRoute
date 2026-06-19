# phenoObservability — Boundary

> Stub boundary file generated on 2026-06-18 by `scripts/render-stubs.py`
> for canonical repos with no curated prompts yet.

## In Scope

- Rust workspace members: `pheno-dragonfly`, `pheno-questdb`, `tracely-core`, `tracely-sentinel`, `helix-logging`, `tracingkit`, `phenotype-observably-{tracing,logging,sentinel,macros,ports}`
- OpenTelemetry tracing (W3C Trace Context, Jaeger propagation, deterministic + probabilistic sampling, custom span attrs)
- Prometheus-compatible metrics: histogram, counter, gauge, distribution collectors
- Structured JSON logging with span-to-log correlation and context propagation
- Backends: Jaeger, Datadog, Prometheus, Grafana, SurrealDB, QuestDB
- Caching observability: Dragonfly (Redis-compatible)
- Polyglot binding: PyO3 Python integration alongside the Rust crates
- 80%+ code coverage target enforced per `docs/FUNCTIONAL_REQUIREMENTS.md`

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| The hexagonal `phenotype-observability` crate (sibling) | `HexaKit/crates/phenotype-observability` | per `plans/2026-06-09-hexakit-phenotype-observability-plan-v1.md`; lifts working OTel init out of `phenotype-logging/src/otel.rs` into a HexaKit-twin crate |
| The `pheno-tracing` crate (canonical per ADR-012) | `HexaKit/crates/pheno-tracing` | ADR-012 makes pheno-tracing canonical across pheno-* repos; phenoObservability consumes it |
| Service mesh / request routing observability | `Tracera` | Tracera is the primary consumer of phenoObservability's tracing init |
| Pipeline / CI observability | `PhenoDevOps` | Different domain; phenoObservability doesn't own CI metrics |
| LLM-specific observability (token cost, prompt/response capture) | `Tokn` `tokenledger` | Cost / usage tracking is the Tokn domain; phenoObservability covers the generic tracing layer only |

## Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| Canonical tracing init | `HexaKit/pheno-tracing` → this-repo | Crate path | green — ADR-012 reorg complete |
| OTel init source | this-repo→`HexaKit/phenotype-observability` | Crate path | amber — twin-crate migration in progress |
| Service-consumer tracing | `Tracera` → this-repo | Crate path | green |
| CI/CD metrics | `PhenoDevOps` → this-repo | OTel collector | green |
| Subtree absorption (Logify/logkit, ObservabilityKit) | this-repo→upstream | Squashed subtree under `crates/logkit/` + `ObservabilityKit/rust/` | green — preserved for traceability |

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo.

## Source-of-Truth

- ECOSYSTEM_MAP.md § 6 (role classification)
- docs/intent/phenoObservability.md (intent statement)
- docs/registries.md (Capability & Intent SSOT layer)
