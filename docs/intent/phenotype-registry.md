# phenotype-registry -- Intent

## Intent Statement

phenotype-registry is the single source of truth (SSOT) layer for the entire Phenotype ecosystem. It owns the curated inventory of every bound repo (the `_bindings.json` index), the per-repo intent and boundary declarations under `docs/intent/` and `docs/boundary/`, the `ALIASES.md` canonical-name map, the `ECOSYSTEM_MAP.md` role taxonomy, and the curation pipeline (`scrape.py`, `run-*`, `render-per-repo`, `propagate`, `resolve-collision`, `render-stubs`, `fill-intent-stubs`). It exists so that any repo, agent, or human can answer "which repo owns capability X?" in one query against the registry instead of grepping the whole monorepo. Done looks like: every repo bound to a `docs/intent/<repo>.md` + `docs/boundary/<repo>.md` pair, refreshed weekly, with zero orphan `_bindings.json` entries.

## Role

`registry/ssot` (per `phenotype-registry/ECOSYSTEM_MAP.md` section 6)

## Boundary

See [`../boundary/phenotype-registry.md`](../boundary/phenotype-registry.md) for the in-scope / out-of-scope
declaration.

## Curated prompts

See `_bindings.json` key `phenotype-registry` for the bound prompt-hash list
(per-source counts in `docs/registries.md` section 'Capability & Intent SSOT').
Currently the largest single binding in the fleet (18,119 prompts, 9 plans, 8 responses,
2025-08 → 2026-06-17).

## Provenance

- Source-of-truth role: `phenotype-registry/ECOSYSTEM_MAP.md` section 6 role table
- Stub rendered: 2026-06-18 by `scripts/render-stubs.py`
- Prose filled: 2026-06-20 by `scripts/fill-intent-stubs.py` (this revision)
- Refresh cadence: weekly per ADR-024 (every Monday 09:00 PDT)
- Provenance trail:
  - **L7-001** (2026-06-17): initial intent + boundary sweep, 45,091 records bound to 82 repos
  - **L7-002** (2026-06-18): stub-render pass via `scripts/render-stubs.py` produced `docs/intent/<repo>.md` for all 82 repos
  - **L7-003** (2026-06-19): first `fill-intent-stubs.py` pass filled prose for Paginary, PhenoCompose, agentapi-plusplus, agentmcp-hex, vibeproxy-monitoring-unified, phenotype-mcp-asset, PhenoDesign, phenoObservability, Argis-Extensions, Agentora, forgecode (sample of 11 stubs)
  - **L7-004** (2026-06-19): `resolve-collision.py` + `propagate` cascade merged per-repo aliases into `ALIASES.md` and `_bindings.json`
  - **L7-005** (2026-06-20): registry self-fill — `phenotype-registry.md` intent + boundary filled (this turn) so the SSOT repo carries the same curated structure as the 82 repos it indexes
