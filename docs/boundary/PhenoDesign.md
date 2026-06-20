# PhenoDesign -- Boundary

> Boundary file for PhenoDesign. Filled with real prose 2026-06-19.

## In Scope

Design tokens (color, type, space, motion); component recipes; accessibility primitives; Figma <-> code sync

## Out of Scope

Component implementations (lives in each consumer repo); brand strategy; logo design

## Crossings

PhenoDesign crosses into other Phenotype repos at the following seams:

- **Auth**: depends on AuthKit `typescript/packages/auth-ts/`
- **Telemetry**: emits OTel traces via pheno-otel
- **Config**: resolves from `phenotype-config` schema (Pydantic + Zod)
- **Versioning**: pinned to the pheno-standards `{major.minor}` channel

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo.

## Source-of-Truth

- `phenotype-registry/ECOSYSTEM_MAP.md` section 6 (role classification)
- `docs/intent/PhenoDesign.md` (intent statement)
- `docs/registries.md` section 'Capability & Intent SSOT' (registry layer)
