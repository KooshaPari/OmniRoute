# agentmcp-hex -- Intent

## Intent Statement

agentmcp-hex is the hex-grid testing harness extracted from McpKit. It provides deterministic, reproducible agent-task tests using a fixed-decimal floating-point game board. The 16-task test fleet lives in `agentmcp-hex/test/fleet/`.

## Role

`extraction-target` (per `phenotype-registry/ECOSYSTEM_MAP.md` section 6)

## Boundary

See [`../boundary/agentmcp-hex.md`](../boundary/agentmcp-hex.md) for the in-scope / out-of-scope
declaration.

## Curated prompts

See `_bindings.json` key `agentmcp-hex` for the bound prompt-hash list
(per-source counts in `docs/registries.md` section 'Capability & Intent SSOT').

## Provenance

- Source-of-truth role: `phenotype-registry/ECOSYSTEM_MAP.md` section 6 role table
- Stub rendered: 2026-06-18 by `scripts/render-stubs.py`
- Prose filled: 2026-06-19 by `scripts/fill-intent-stubs.py`
- Refresh cadence: weekly per ADR-024
