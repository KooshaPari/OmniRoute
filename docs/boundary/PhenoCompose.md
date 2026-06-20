# PhenoCompose -- Boundary

> Boundary file for PhenoCompose. Filled with real prose 2026-06-19.

## In Scope

YAML/JSON composition schemas; resolution engine for pheno* library references; runtime graph generation; dependency pinning

## Out of Scope

Library implementations (lives in pheno* repos); the agent runtime itself (lives in thegent)

## Crossings

PhenoCompose crosses into other Phenotype repos at the following seams:

- **Auth**: depends on AuthKit `typescript/packages/auth-ts/`
- **Telemetry**: emits OTel traces via pheno-otel
- **Config**: resolves from `phenotype-config` schema (Pydantic + Zod)
- **Versioning**: pinned to the pheno-standards `{major.minor}` channel

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo.

## Source-of-Truth

- `phenotype-registry/ECOSYSTEM_MAP.md` section 6 (role classification)
- `docs/intent/PhenoCompose.md` (intent statement)
- `docs/registries.md` section 'Capability & Intent SSOT' (registry layer)
