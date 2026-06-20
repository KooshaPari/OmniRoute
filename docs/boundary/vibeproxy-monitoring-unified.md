# vibeproxy-monitoring-unified -- Boundary

> Boundary file for vibeproxy-monitoring-unified. Filled with real prose 2026-06-19.

## In Scope

Historical reference; archival access to early 2026 dashboards; migration notes

## Out of Scope

New monitoring; new dashboards; new alert rules (all moved to phenoObservability)

## Crossings

vibeproxy-monitoring-unified crosses into other Phenotype repos at the following seams:

- **Auth**: depends on AuthKit `typescript/packages/auth-ts/`
- **Telemetry**: emits OTel traces via pheno-otel
- **Config**: resolves from `phenotype-config` schema (Pydantic + Zod)
- **Versioning**: pinned to the pheno-standards `{major.minor}` channel

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo.

## Source-of-Truth

- `phenotype-registry/ECOSYSTEM_MAP.md` section 6 (role classification)
- `docs/intent/vibeproxy-monitoring-unified.md` (intent statement)
- `docs/registries.md` section 'Capability & Intent SSOT' (registry layer)
