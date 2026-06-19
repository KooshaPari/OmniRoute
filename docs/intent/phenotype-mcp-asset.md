---
repo: "phenotype-mcp-asset"
aliases:
  - "mcp-asset"
role: shared-lib
status: active
last_verified: 2026-06-18
bound_prompts: 0
bound_plans: 0
bound_responses: 0
device: macbook
origin: "KooshaPari/McpKit/McpKit/asset/ (extracted 2026-06-18, commit 4c538868)"
extracted_on: "2026-06-18"
disposition_wave: "McpKit-Absorption-2026-06-18"
consumers:
  - "Agentora"
depends_on:
  - "pheno-otel"
supersedes:
  - "KooshaPari/McpKit/McpKit/asset/"
---

# Intent — phenotype-mcp-asset

## Intent Statement

`phenotype-mcp-asset` is the canonical Phenotype-pack asset library extracted from the now-deprecated `KooshaPari/McpKit/McpKit/asset/` subdirectory on 2026-06-18 as part of the McpKit-Absorption-2026-06-18 wave (extraction commit `4c538868`). The library is responsible for reading, validating, packaging, and serving Phenotype-pack artifacts — the binary asset bundles that downstream MCP servers, agent runtimes, and skill registries consume at boot. It is classified as a `shared-lib` per `ECOSYSTEM_MAP.md` §1 (row 22 of the role table, added 2026-06-18) and occupies a pure-reusable-library position with no workspace-only assumptions, no transport dependencies, and no runtime daemon of its own. The boundary of "done" is: a stable, semver-versioned library with a narrow public API for `AssetReader`, `AssetWriter`, and `AssetValidator`, suitable for direct consumption by any fleet member that needs to read or write Phenotype-pack assets without depending on the legacy McpKit monorepo. This is the asset-layer sibling of the McpKit partition: `phenotype-mcp-asset` owns assets, `agentmcp-hex` owns the hex codec, and `Agentora` orchestrates the result.

## Bound Prompts

| Date | Source | File | Tag |
| ---- | ------ | ---- | --- |
| ?    | —      | —    | —   |

(No curated prompts are bound to this repo yet. The extraction is brand-new and the library starts with zero bound prompts; the L7 weekly refresh sweep will pick up any new bindings on the next cadence tick.)

## Bound Plans

| Date | Source | File | Status | Outcome |
| ---- | ------ | ---- | ------ | ------- |
| 2026-06-18 | forge subagent (L5-110.x) | `findings/2026-06-18-McpKit-source-inventory.md` | done | Extraction commit `4c538868` landed; library registered under docs/intent/ structure; disposition row 52 closed (ABSORB, fsm=done) |

## Bound Responses (specs, ideas, plans from agents)

| Date | Source | File | Kind | Outcome |
| ---- | ------ | ---- | ---- | ------- |
| 2026-06-18 | forge subagent | `findings/2026-06-18-McpKit-source-inventory.md` | audit | McpKit-Absorption-2026-06-18 wave — asset layer identified as one of three partition targets |

## Boundary

See: [`docs/boundary/phenotype-mcp-asset.md`](../boundary/phenotype-mcp-asset.md)

## Ecosystem Role

`shared-lib` per `ECOSYSTEM_MAP.md` §1, row 22 (added 2026-06-18). **Upstream reads:** `pheno-otel` for telemetry spans emitted during asset open/close and validation events. **Downstream emits:** `Agentora` (the orchestrator) for the validated asset handle and asset-bundle events. **Siblings in the McpKit partition:** `agentmcp-hex` (hex codec, the SDK sibling) and the now-deprecated `McpKit` monorepo (archived 2026-06-18 per ADR-017; retention deferred to allow historical reference and one-shot migration shims).

## Open Questions

- Final distribution channel (Cargo crates.io vs. internal index) — pending first external consumer request.
- Whether the asset schema should be promoted to a standalone JSON-Schema repo under `HexaKit/schemas/` — discussion deferred to next L7 sweep.

## Change Log

| Date | Change | Worklog |
| ---- | ------ | ------- |
| 2026-06-18 | Initial extraction (L7-001 reconciliation; new repo registered under docs/intent/ structure; commit `4c538868`) | `worklogs/L7-003-ecosystem-reconciliation-2026-06-18.json` |
| 2026-06-18 | Disposition row 52 added to `registry/disposition-index.json` (ABSORB, fsm=done) | commit `578af944` |
