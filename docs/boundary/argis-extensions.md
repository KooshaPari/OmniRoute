<!--
propagated-from: KooshaPari/phenotype-registry @ chore/l7-001-curation-snapshot
date: 2026-06-17
source-commit: a1aa44660
do-not-edit-locally: regenerate via scripts/propagate-intent-to-repos.py
                     or update in the source-of-truth registry repo
-->
# argis-extensions -- Boundary

> Boundary file for argis-extensions. Filled with real prose 2026-06-19.

## In Scope

Plugin manifest format; version negotiation; hot-reload protocol; capability declarations

## Out of Scope

The Argis host itself (lives in bifrost-extensions); plugin business logic

## Crossings

argis-extensions crosses into other Phenotype repos at the following seams:

- **Auth**: depends on AuthKit `typescript/packages/auth-ts/`
- **Telemetry**: emits OTel traces via pheno-otel
- **Config**: resolves from `phenotype-config` schema (Pydantic + Zod)
- **Versioning**: pinned to the pheno-standards `{major.minor}` channel

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo.

## Source-of-Truth

- `phenotype-registry/ECOSYSTEM_MAP.md` section 6 (role classification)
- `docs/intent/argis-extensions.md` (intent statement)
- `docs/registries.md` section 'Capability & Intent SSOT' (registry layer)
