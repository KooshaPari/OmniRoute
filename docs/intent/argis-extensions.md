# argis-extensions -- Intent

## Intent Statement

argis-extensions is the Argis plugin registry for the Phenotype ecosystem. It packages third-party and internal Argis plugins (the same plugins Bifrost-Extensions hosts) and provides a typed manifest format, version negotiation, and hot-reload capabilities for the Argis plugin host.

## Role

`extensibility-plugin` (per `phenotype-registry/ECOSYSTEM_MAP.md` section 6)

## Boundary

See [`../boundary/argis-extensions.md`](../boundary/argis-extensions.md) for the in-scope / out-of-scope
declaration.

## Curated prompts

See `_bindings.json` key `argis-extensions` for the bound prompt-hash list
(per-source counts in `docs/registries.md` section 'Capability & Intent SSOT').

## Provenance

- Source-of-truth role: `phenotype-registry/ECOSYSTEM_MAP.md` section 6 role table
- Stub rendered: 2026-06-18 by `scripts/render-stubs.py`
- Prose filled: 2026-06-19 by `scripts/fill-intent-stubs.py`
- Refresh cadence: weekly per ADR-024
