# Agentora -- Intent

## Intent Statement

Agentora is an extracted agent-orchestration runtime that originated inside McpKit and was split out in the McpKit-Absorption wave (T23, 2026-06-19). It owns the message-routing, task-dispatch, and cancellation-protocol layer for agentic workflows. Its primary consumers are thegent and OmniRoute.

## Role

`extraction-target` (per `phenotype-registry/ECOSYSTEM_MAP.md` section 6)

## Boundary

See [`../boundary/Agentora.md`](../boundary/Agentora.md) for the in-scope / out-of-scope
declaration.

## Curated prompts

See `_bindings.json` key `Agentora` for the bound prompt-hash list
(per-source counts in `docs/registries.md` section 'Capability & Intent SSOT').

## Provenance

- Source-of-truth role: `phenotype-registry/ECOSYSTEM_MAP.md` section 6 role table
- Stub rendered: 2026-06-18 by `scripts/render-stubs.py`
- Prose filled: 2026-06-19 by `scripts/fill-intent-stubs.py`
- Refresh cadence: weekly per ADR-024
