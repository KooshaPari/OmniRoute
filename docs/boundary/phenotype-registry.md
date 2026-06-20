# phenotype-registry -- Boundary

> Boundary file for phenotype-registry. Filled with real prose 2026-06-20.

## In Scope

SSOT ownership only — the curated inventory, the role taxonomy, and the curation pipeline that keeps them in sync:

- `docs/intent/` — one `<repo>.md` per bound repo (intent statement)
- `docs/boundary/` — one `<repo>.md` per bound repo (in-scope / out-of-scope / crossings)
- `ALIASES.md` — canonical-name → alias map (e.g. `AgilePlus` ↔ `agileplus`, `Dino` ↔ `dinoforge-packs`)
- `_bindings.json` — the full per-repo binding index (18,119 prompts, 9 plans, 8 responses currently for phenotype-registry itself; 45,091 records fleet-wide)
- `ECOSYSTEM_MAP.md` — section 6 role taxonomy (`registry/ssot`, `composition-framework`, `api-server`, `stub/scaffold`, …)
- `scripts/scrape.py`, `scripts/run-*`, `scripts/render-per-repo`, `scripts/propagate`, `scripts/resolve-collision`, `scripts/render-stubs`, `scripts/fill-intent-stubs` — the curation pipeline that produces and refreshes the above

## Out of Scope

phenotype-registry explicitly does not own the things it merely points at. Library code, agent runtime, business logic, and per-repo implementation all live elsewhere:

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Library code (Rust crates, Python pkgs, Go mods, TS pkgs) | `pheno*`, `phenotype-*`, `*Kit`, `*Lab` repos | Per ADR-023 Rule 3, library code lives in language-specific repos (`pheno-*-lib` / `phenotype-*-sdk`) |
| Agent runtime | `thegent`, `phenoAI`, `phenoMCP` | Registry has no process model; it only catalogs |
| Business logic | Per-capability repos (`AuthKit`, `ObservabilityKit`, `PhenoDevOps`, etc.) | Registry holds *descriptions* of business logic, never the logic itself |
| Per-repo implementation, CI, tests, docs site | Each repo | Registry is index-only; each repo owns its own pipeline |

## Crossings

phenotype-registry crosses into other Phenotype repos at the following seams:

- **Auth**: depends on AuthKit `typescript/packages/auth-ts/` for any registry API that exposes bound prompt content behind a token
- **Telemetry**: emits OTel traces via pheno-otel for every curation-pipeline run (`scrape`, `render-per-repo`, `propagate`, `fill-intent-stubs`)
- **Config**: resolves from `phenotype-config` schema (Pydantic + Zod) — registry loaders read `_bindings.json` shape and role taxonomy through the canonical config schema
- **Versioning**: pinned to the pheno-standards `{major.minor}` channel; weekly refresh cadence is governed by ADR-024

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo. The registry's own intent + boundary
files are refreshed by `scripts/fill-intent-stubs.py --self` so the SSOT
repo stays in lock-step with the 82 repos it indexes.

## Source-of-Truth

- `phenotype-registry/ECOSYSTEM_MAP.md` section 6 (role classification)
- `docs/intent/phenotype-registry.md` (intent statement)
- `docs/registries.md` section 'Capability & Intent SSOT' (registry layer)
