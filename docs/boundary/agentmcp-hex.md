---
repo: "agentmcp-hex"
role: SDK
status: active
last_boundary_review: 2026-06-18
review_cadence: 30d
adr_023_substrate: "phenotype-*-sdk"
adr_023_substrate_neighbors:
  - "KooshaPari/Agentora (phenotype-*-framework, Rust edge of the same pattern)"
  - "phenotype-mcp-asset (pheno-*-lib, sibling McpKit extraction on the Rust side)"
origin: "KooshaPari/McpKit/python/agentmcp/ (McpKit archived 2026-06-17 per ADR-017)"
extracted_on: "2026-06-18"
disposition_row_id: 54
disposition_wave: "McpKit-Absorption-2026-06-18"
package_path: "phenotype-python-sdk/packages/agentmcp-hex/"
distribution_name: "agentmcp-hex"
python_import: "agentmcp_hex"
version: "0.3.0"
requires_python: ">=3.11"
license: "MIT"
in_scope:
  - "Hexagonal DDD agent framework (domain/ + ports/ + adapters/ + app/ layout)"
  - "Domain types: Agent (pydantic), McpTool, McpResource, AgentEngine"
  - "Port contracts: McpServerPort, ResourcePort (abstract base classes)"
  - "Adapter implementations: FastMcpAdapter (exposes agent via fastmcp), CliAdapter (interactive REPL)"
  - "App composition root: App(agent) wires AgentEngine + FastMcpAdapter + CliAdapter; run_server(), run_cli() entry points"
  - "Stable Python import surface (agentmcp_hex) published under phenotype-python-sdk namespace"
  - "Test suite compatibility with the original McpKit/python/agentmcp/ tests (pytest 8+)"
  - "Domain logic with zero framework dependencies; framework coupling isolated in adapters"
  - "Re-export of PhenoFastMCP framework primitives for the Python edge (planned, not yet implemented)"
out_of_scope:
  - "MCP transport implementation (HTTP/SSE/stdio wire formats) — lives in PhenoFastMCP (the framework) and PhenoMCPServers (the implementations)"
  - "FastMCP server registration mechanics — lives in PhenoFastMCP (the framework owns the registration lifecycle)"
  - "Skill execution / runtime — lives in PhenoMCPServers (deployable server implementations)"
  - "Rust agent runtime — lives in KooshaPari/Agentora (this is the Python edge of the same pattern; not a polyglot bridge)"
  - "Cross-language polyglot facade (Rust ↔ Python) — deferred to phenotype-hub per ADR-023 (only materializes on 2+ cross-language consumers)"
  - "The other McpKit Python packages — absorbed to phenotype-python-sdk/packages/* per McpKit absorption audit (not this package's concern)"
  - "The 4 McpKit Rust crates (phenotype-mcp-core, -framework, -fast, -fast-macros) — absorbed to PhenoFastMCP-rust"
  - "Asset packing/validation — lives in phenotype-mcp-asset (sibling extraction, Rust side)"
  - "Cryptography, signing, transport encryption — lives in pheno-crypto (HexaKit crate)"
---

# Boundary — agentmcp-hex

## In Scope

- **Hexagonal DDD agent framework**: Four-layer package layout — `domain/` (pure logic, no framework deps), `ports/` (trait contracts), `adapters/` (concrete impls, framework-coupled), `app/` (composition root). Layer dependency rules are enforced by review: `domain/` → stdlib + pydantic only; `ports/` → stdlib + abc only; `adapters/` → ports + domain + framework (e.g. fastmcp); `app/` → everything.
- **Domain types** (`agentmcp_hex.domain`): `Agent(name, instructions, tools=[], resources=[])` pydantic model; `McpTool(name, description, parameters)` pydantic tool descriptor; `McpResource(uri, mime_type, contents)` pydantic resource descriptor; `AgentEngine(agent)` pure-logic engine with `can_handle`, `list_tools`, `add_tool` methods.
- **Port contracts** (`agentmcp_hex.ports`): `McpServerPort` (abstract — `start()`, `register_tool(name, handler)`, `register_resource(uri, handler)`); `ResourcePort` (abstract — `fetch(uri)`, `list()`). All transport concerns plug in behind these ports.
- **Adapter implementations** (`agentmcp_hex.adapters`): `FastMcpAdapter(agent)` exposes an agent as an MCP server via the `fastmcp` library (>=0.4.0); `CliAdapter(engine)` provides an interactive REPL shell for an `AgentEngine`. Both adapters are framework-coupled but isolated from `domain/` and `ports/`.
- **App composition root** (`agentmcp_hex.app`): `App(agent)` wires `AgentEngine` + `FastMcpAdapter` + `CliAdapter`. Entry points: `App.run_server()` (blocking, starts the MCP server) and `App.run_cli()` (blocking, starts the interactive shell). The composition root is the ONLY place where all layers meet.
- **Stable Python API**: installable as `uv add agentmcp-hex` from the `phenotype-python-sdk` workspace; importable as `from agentmcp_hex.domain import Agent, McpTool, McpResource, AgentEngine`, `from agentmcp_hex.ports import McpServerPort, ResourcePort`, `from agentmcp_hex.adapters import FastMcpAdapter, CliAdapter`, `from agentmcp_hex.app import App`. Package distribution name `agentmcp-hex` (was `agentmcp` in the source `pyproject.toml`).
- **Test parity**: original `McpKit/python/agentmcp/tests/` test suite passes against the new home unchanged (or with a thin re-export layer). Tests live at `phenotype-python-sdk/packages/agentmcp-hex/tests/test_domain.py` and `tests/test_ports.py`. `pyproject.toml` declares `pytest>=8.0` + `pytest-cov>=5.0` as dev deps and configures `testpaths = ["tests"]`.
- **Hex codec encode/decode** (planned): the hex MCP codec pattern is the Python analog of `phenotype-mcp-asset`'s asset graph on the Rust side — same hexagonal pattern, Python wire format. Currently in design; will land in `agentmcp_hex.codec.*` once the wire format is finalized.
- **Re-export of framework primitives** (planned): convenience re-exports of `PhenoFastMCP` MCP primitives for the Python edge so consumers don't need to import from two packages.
- **Polyglot parity markers**: package version `0.3.0` (bumped from source `0.1.0` because this is now an SDK package, not a McpKit workspace member); `requires-python = ">=3.11"`; `python 3.11, 3.12, 3.13, 3.14` all classified as supported.

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| MCP transport (HTTP/SSE/stdio) | `PhenoFastMCP` | This package is transport-agnostic; the framework owns transport |
| FastMCP server registration | `PhenoFastMCP` | Framework concern, not agent concern — registration lifecycle is the framework's job |
| Skill execution runtime | `PhenoMCPServers` | Deployable server implementations, not agent framework primitives |
| Rust agent runtime | `KooshaPari/Agentora` | Rust edge of the same pattern; this is the Python edge — no cross-language bridge here |
| Cross-language polyglot facade (Rust ↔ Python) | `phenotype-hub` (future) | Not yet needed; deferred per ADR-023 until 2+ cross-language consumers materialize |
| The other McpKit Python packages | `phenotype-python-sdk/packages/*` | Per McpKit absorption audit, sibling Python packages absorbed to `phenotype-python-sdk` workspace |
| The 4 McpKit Rust crates | `PhenoFastMCP-rust` (Dicklesworthstone/fastmcp_rust fork) | Per McpKit absorption audit, sibling Rust crates absorbed to `PhenoFastMCP-rust` |
| Asset packing/validation | `phenotype-mcp-asset` | Sibling McpKit extraction; handles `.phenotype` pack I/O on the Rust side |
| Cryptography / signing / transport encryption | `pheno-crypto` (HexaKit crate) | Cryptography belongs in the canonical crypto crate, not duplicated per-SDK |
| Hex MCP codec wire format design | n/a (in flight) | Wire format not yet finalized; codec surface is planned but the actual schema is open |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| Agent API | consumer → `agentmcp-hex` | Python import (`from agentmcp_hex.domain import Agent, McpTool, McpResource, AgentEngine`) | amber — pending PR `phenotype-python-sdk#21` merge |
| Port contracts | consumer → `agentmcp-hex` | Python import (`from agentmcp_hex.ports import McpServerPort, ResourcePort`) | amber — pending PR merge |
| Adapter impls | consumer → `agentmcp-hex` | Python import (`from agentmcp_hex.adapters import FastMcpAdapter, CliAdapter`) | amber — pending PR merge |
| App composition root | consumer → `agentmcp-hex` | Python import (`from agentmcp_hex.app import App`) | amber — pending PR merge |
| FastMCP framework dependency | `agentmcp-hex` → `fastmcp` (PyPI) | runtime dep `fastmcp>=0.4.0` | green |
| Pydantic model layer | `agentmcp-hex` → `pydantic` (PyPI) | runtime dep `pydantic>=2.0` | green |
| Structured logging | `agentmcp-hex` → `structlog` (PyPI) | runtime dep `structlog>=24.0` | green |
| Framework re-exports | `agentmcp-hex` → `PhenoFastMCP` | Python import (re-export, planned) | not started — pending PhenoFastMCP Python edge stabilization |
| Polyglot parity | `agentmcp-hex` ↔ `KooshaPari/Agentora` | n/a (deliberately no bridge) | n/a (deferred per ADR-023) |
| Migration from McpKit | `McpKit (archived) → agentmcp-hex` | n/a (one-shot extraction) | green |
| Provenance | `agentmcp-hex` → `McpKit/python/agentmcp/` | n/a (documented in `docs/intent/`, `ORIGIN.md`) | green |
| Test suite | test runner → `agentmcp-hex` | pytest (`pyproject.toml`: `testpaths = ["tests"]`, `addopts = "-v --tb=short"`) | amber — port-in-progress |
| Hex codec (planned) | consumer → `agentmcp-hex` | Python import (`agentmcp_hex.codec.*`, TBD) | not started — wire format design open |
| Asset composition | `agentmcp-hex` → `phenotype-mcp-asset` (sibling) | n/a (no direct dep) | n/a (parity pattern, not a runtime crossing) |

## Last Boundary Review

**Date:** 2026-06-18
**Reviewer:** forge subagent (L7-003 reconciliation + McpKit absorption audit, L5-099 + L5-110.x)
**Worklog / finding:** `worklogs/L7-003-ecosystem-reconciliation-2026-06-18.json`; `findings/2026-06-18-McpKit-source-inventory.md`; `phenotype-python-sdk/packages/agentmcp-hex/ORIGIN.md`
**Decisions:**
- New canonical home for the Python `agentmcp` package, extracted from `McpKit/python/agentmcp/` to `phenotype-python-sdk/packages/agentmcp-hex/`.
- ADR-023 classification: `phenotype-*-sdk` (cross-language SDK; the Python edge of the agent framework; polyglot facade deferred per ADR-023 until 2+ cross-language consumers materialize).
- Package name `agentmcp` → `agentmcp-hex`; Python import `agentmcp` → `agentmcp_hex`; version 0.1.0 → 0.3.0 (bumped because this is now an SDK package, not a McpKit workspace member).
- Hexagonal DDD pattern preserved end-to-end — four-layer layout (`domain/`, `ports/`, `adapters/`, `app/`) with the layer dependency rules documented in `README.md`.
- fsm=open: awaiting PR `phenotype-python-sdk#21` review; amber status on the Agent/Port/Adapter/App API crossings until PR merge lands.
- Realizes the supersession path documented in `PhenoFastMCP/FORK-NOTES.md:121` — the originally-targeted `python/pheno/` layer was never built; this package IS that layer.
- 30-day review cadence; align with L7-001 sweep rhythm; final disposition on PR merge.

**Next review:** 2026-07-18 (or on PR `phenotype-python-sdk#21` merge, whichever is first)
