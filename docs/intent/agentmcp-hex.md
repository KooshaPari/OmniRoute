---
repo: "agentmcp-hex"
aliases:
  - "agentmcp"
  - "mcpkit-python-agentmcp"
  - "agentmcp-hex-sdk"
role: SDK
status: active
last_verified: 2026-06-18
bound_prompts: 0
bound_plans: 0
bound_responses: 0
device: macbook
adr_023_substrate: "phenotype-*-sdk"
origin: "KooshaPari/McpKit/python/agentmcp/ (McpKit archived 2026-06-17 per ADR-017; original pyproject.toml name was 'agentmcp' v0.1.0 from 2026-06-08)"
extracted_on: "2026-06-18"
disposition_row_id: 54
disposition_wave: "McpKit-Absorption-2026-06-18"
source_pr: "KooshaPari/phenotype-python-sdk#21 (OPEN, awaiting review)"
package_path: "phenotype-python-sdk/packages/agentmcp-hex/"
distribution_name: "agentmcp-hex"
python_import: "agentmcp_hex"
version: "0.3.0"
requires_python: ">=3.11"
license: "MIT"
supersedes:
  - "KooshaPari/McpKit/python/agentmcp/"
---

# Intent — agentmcp-hex

## Intent Statement

`agentmcp-hex` is the Python SDK package extracted from the now-archived `KooshaPari/McpKit/python/agentmcp/` crate on 2026-06-18 and absorbed into `phenotype-python-sdk` as `phenotype-python-sdk/packages/agentmcp-hex/` — the canonical home for the fleet's hexagonal Domain-Driven Design (DDD) agent framework. The package provides a clean, framework-agnostic core for building MCP-aware agent applications organized as a Ports & Adapters (hexagonal) layout: `domain/` (pure logic — `Agent`, `McpTool`, `McpResource`, `AgentEngine`), `ports/` (trait contracts — `McpServerPort`, `ResourcePort`), `adapters/` (concrete impls — `FastMcpAdapter`, `CliAdapter`), and `app/` (composition root — `App` wires adapters to domain). It is published under the `phenotype-python-sdk` namespace for fleet-wide consumption; the Python import is `agentmcp_hex` and the distribution name is `agentmcp-hex`. Per ADR-023, this is a `phenotype-*-sdk` (cross-language SDK; polyglot facade; the Python edge of the agent framework — the Rust edge lives in `KooshaPari/Agentora`). The boundary of "done" is: a published PyPI package installable as `uv add agentmcp-hex` (or the package's final distribution name), with the hexagonal DDD pattern preserved end-to-end, all 6 dependencies (`fastmcp>=0.4.0`, `pydantic>=2.0`, `structlog>=24.0`, plus `pytest`, `pytest-cov`, `ruff`, `mypy` for dev) declared in `pyproject.toml`, and the original `McpKit/python/agentmcp/` test suite passing against the new home. P1 patch from the McpKit absorption audit; currently awaiting PR `phenotype-python-sdk#21` review (fsm=open per `registry/disposition-index.json` row 54).

## Bound Prompts

| Date | Source | File | Tag |
| ---- | ------ | ---- | --- |
| ?    | —      | —    | —   |

(No curated prompts are bound to this package yet. The original 21 prompts that bound to `McpKit` are listed in `docs/intent/AgentMCP.md` and remain re-attributed to `PhenoFastMCP` per ADR-017; this new SDK package starts with zero bound prompts.)

## Bound Plans

| Date | Source | File | Status | Outcome |
| ---- | ------ | ---- | ------ | ------- |
| 2026-06-18 | forge subagent (L5-110.x) | `findings/2026-06-18-McpKit-source-inventory.md` | open | P1 patch in flight; PR `phenotype-python-sdk#21` awaiting review |
| 2026-06-17 | forge subagent (L5-099) | `findings/2026-06-17-L5-099-mcpkit-absorption.md` | done | McpKit absorption audit identified `python/agentmcp/` as "the cleanest code in the repo" and a textbook hexagonal-DDD layout — extract before archive loss |

## Bound Responses (specs, ideas, plans from agents)

| Date | Source | File | Kind | Outcome |
| ---- | ------ | ---- | ---- | ------- |
| 2026-06-18 | forge subagent | `findings/2026-06-18-McpKit-source-inventory.md` | audit | McpKit absorption audit — P1 extraction row for `python/agentmcp` |
| 2026-06-18 | forge subagent | `phenotype-python-sdk/packages/agentmcp-hex/ORIGIN.md` | provenance | Full chain-of-custody from `McpKit/python/agentmcp/` v0.1.0 → `phenotype-python-sdk/packages/agentmcp-hex/` v0.3.0; supersession path per `PhenoFastMCP/FORK-NOTES.md:121` realized |

## Boundary

See: [`docs/boundary/agentmcp-hex.md`](../boundary/agentmcp-hex.md)

## Ecosystem Role

`SDK` per `ECOSYSTEM_MAP.md` §1 row 9 (`phenotype-*-sdk` per ADR-023 substrate placement). **Consumers:** `PhenoFastMCP` (the framework that documents the supersession path; absorbs the Python edge of the MCP layer). **Cross-references:** the deprecated source `KooshaPari/McpKit/python/agentmcp/` (archived 2026-06-17 per ADR-017), the SDK parent `KooshaPari/phenotype-python-sdk`, the framework sibling `PhenoFastMCP`, and the Rust edge of the same pattern at `KooshaPari/Agentora` (47-crate Rust workspace; `phenotype-mcp-asset` is the other McpKit extraction). The package realizes the supersession intent documented in `PhenoFastMCP/FORK-NOTES.md:121` — the originally-targeted `python/pheno/` layer was never built; this package IS that layer.

## Open Questions

- Awaiting PR `phenotype-python-sdk#21` review and merge; package not yet published to PyPI.
- Distribution name (`phenotype-python-sdk` namespace vs. standalone) — final call pending SDK maintainers.
- Hex codec encode/decode surface (`agentmcp_hex.codec.*`) is currently in design — the hex MCP codec pattern is the same pattern as `phenotype-mcp-asset` on the Rust side, but the wire format and schema for the Python edge have not been finalized.

## Change Log

| Date | Change | Worklog |
| ---- | ------ | ------- |
| 2026-06-08 | `KooshaPari/AgentMCP` merged into `KooshaPari/McpKit` at `python/agentmcp/` (v0.1.0) | `McpKit/python/agentmcp/docs/SSOT.md` |
| 2026-06-17 | `KooshaPari/McpKit` archived per ADR-017 | `findings/2026-06-17-L5-099-mcpkit-absorption.md` |
| 2026-06-18 | Package extracted to `phenotype-python-sdk/packages/agentmcp-hex/`, renamed `agentmcp` → `agentmcp-hex`, import `agentmcp_hex`, version bumped 0.1.0 → 0.3.0 | `phenotype-python-sdk/packages/agentmcp-hex/ORIGIN.md` |
| 2026-06-18 | PR `phenotype-python-sdk#21` opened (status: OPEN, awaiting review) | GitHub |
| 2026-06-18 | Initial extraction (L7-001 reconciliation; new package registered under docs/intent/ structure) | `worklogs/L7-003-ecosystem-reconciliation-2026-06-18.json` |
| 2026-06-18 | Disposition row 54 added to `registry/disposition-index.json` (ABSORB, fsm=open) | commit `578af944` |
