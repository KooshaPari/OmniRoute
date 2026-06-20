# phenoObservability -- Boundary

> Boundary file for phenoObservability. Filled with real prose 2026-06-19.

## In Scope

OTel collector config; PII redaction rules; tenant routing; Grafana dashboards; alert rules

## Out of Scope

Application telemetry emission (lives in pheno-otel); log storage backends; on-call rotations

## Crossings

phenoObservability crosses into other Phenotype repos at the following seams:

- **Auth**: depends on AuthKit `typescript/packages/auth-ts/`
- **Telemetry**: emits OTel traces via pheno-otel
- **Config**: resolves from `phenotype-config` schema (Pydantic + Zod)
- **Versioning**: pinned to the pheno-standards `{major.minor}` channel

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo.

## Source-of-Truth

- `phenotype-registry/ECOSYSTEM_MAP.md` section 6 (role classification)
- `docs/intent/phenoObservability.md` (intent statement)
- `docs/registries.md` section 'Capability & Intent SSOT' (registry layer)
