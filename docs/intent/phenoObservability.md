# phenoObservability -- Intent

## Intent Statement

phenoObservability is the OTel + Prometheus + Grafana + Loki stack for the Phenotype ecosystem. It ingests traces from every pheno* service via pheno-otel, ships metrics to the shared Prometheus, and renders dashboards in Grafana. PII redaction and tenant isolation are baked into the collector layer.

## Role

`observability-stack` (per `phenotype-registry/ECOSYSTEM_MAP.md` section 6)

## Boundary

See [`../boundary/phenoObservability.md`](../boundary/phenoObservability.md) for the in-scope / out-of-scope
declaration.

## Curated prompts

See `_bindings.json` key `phenoObservability` for the bound prompt-hash list
(per-source counts in `docs/registries.md` section 'Capability & Intent SSOT').

## Provenance

- Source-of-truth role: `phenotype-registry/ECOSYSTEM_MAP.md` section 6 role table
- Stub rendered: 2026-06-18 by `scripts/render-stubs.py`
- Prose filled: 2026-06-19 by `scripts/fill-intent-stubs.py`
- Refresh cadence: weekly per ADR-024
