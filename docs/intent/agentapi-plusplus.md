# agentapi-plusplus -- Intent

## Intent Statement

agentapi-plusplus is the production HTTP API server for the Phenotype agent runtime. It exposes the standardized `agentapi/v1` REST + WebSocket surface used by phenoAI, OmniRoute, and external clients. Its core responsibility is request validation, auth, and rate limiting -- never agent logic.

## Role

`api-server` (per `phenotype-registry/ECOSYSTEM_MAP.md` section 6)

## Boundary

See [`../boundary/agentapi-plusplus.md`](../boundary/agentapi-plusplus.md) for the in-scope / out-of-scope
declaration.

## Curated prompts

See `_bindings.json` key `agentapi-plusplus` for the bound prompt-hash list
(per-source counts in `docs/registries.md` section 'Capability & Intent SSOT').

## Provenance

- Source-of-truth role: `phenotype-registry/ECOSYSTEM_MAP.md` section 6 role table
- Stub rendered: 2026-06-18 by `scripts/render-stubs.py`
- Prose filled: 2026-06-19 by `scripts/fill-intent-stubs.py`
- Refresh cadence: weekly per ADR-024
