# agentapi-plusplus -- Boundary

> Boundary file for agentapi-plusplus. Filled with real prose 2026-06-19.

## In Scope

HTTP/WS routing; JWT validation; rate limiting; OpenAPI spec generation; metrics emission

## Out of Scope

Agent reasoning (lives in thegent); persistent storage (lives in phenoData); gateway concerns (lives in phenotype-gateway)

## Crossings

agentapi-plusplus crosses into other Phenotype repos at the following seams:

- **Auth**: depends on AuthKit `typescript/packages/auth-ts/`
- **Telemetry**: emits OTel traces via pheno-otel
- **Config**: resolves from `phenotype-config` schema (Pydantic + Zod)
- **Versioning**: pinned to the pheno-standards `{major.minor}` channel

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo.

## Source-of-Truth

- `phenotype-registry/ECOSYSTEM_MAP.md` section 6 (role classification)
- `docs/intent/agentapi-plusplus.md` (intent statement)
- `docs/registries.md` section 'Capability & Intent SSOT' (registry layer)
