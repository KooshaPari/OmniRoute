# phenotype-mcp-asset -- Boundary

> Boundary file for phenotype-mcp-asset. Filled with real prose 2026-06-19.

## In Scope

Static asset bundling; CDN upload; image optimization; brand assets

## Out of Scope

Component implementation; design tokens (lives in PhenoDesign); content authoring

## Crossings

phenotype-mcp-asset crosses into other Phenotype repos at the following seams:

- **Auth**: depends on AuthKit `typescript/packages/auth-ts/`
- **Telemetry**: emits OTel traces via pheno-otel
- **Config**: resolves from `phenotype-config` schema (Pydantic + Zod)
- **Versioning**: pinned to the pheno-standards `{major.minor}` channel

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo.

## Source-of-Truth

- `phenotype-registry/ECOSYSTEM_MAP.md` section 6 (role classification)
- `docs/intent/phenotype-mcp-asset.md` (intent statement)
- `docs/registries.md` section 'Capability & Intent SSOT' (registry layer)
