# forgecode -- Intent

## Intent Statement

forgecode is the upstream Forge CLI binary, vendored as a PhenoCliBase-compatible plugin. It is consumed by thegent and OmniRoute as a primary agent-coding model provider. Local wrapper provides the Phenotype ecosystem shim (config, telemetry, auth) on top of the upstream binary.

## Role

`external-tool` (per `phenotype-registry/ECOSYSTEM_MAP.md` section 6)

## Boundary

See [`../boundary/forgecode.md`](../boundary/forgecode.md) for the in-scope / out-of-scope
declaration.

## Curated prompts

See `_bindings.json` key `forgecode` for the bound prompt-hash list
(per-source counts in `docs/registries.md` section 'Capability & Intent SSOT').

## Provenance

- Source-of-truth role: `phenotype-registry/ECOSYSTEM_MAP.md` section 6 role table
- Stub rendered: 2026-06-18 by `scripts/render-stubs.py`
- Prose filled: 2026-06-19 by `scripts/fill-intent-stubs.py`
- Refresh cadence: weekly per ADR-024
