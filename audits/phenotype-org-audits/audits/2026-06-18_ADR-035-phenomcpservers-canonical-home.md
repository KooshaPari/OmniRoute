# ADR-035: PhenoMCPServers is the canonical home for MCP server, skill, client, and tool registries

`KooshaPari/PhenoMCPServers` is the canonical registry for all Phenotype MCP implementations: servers, skills, clients, tools, and the `catalog/registry.yaml` index. House style: `from fastmcp import FastMCP`, flat module layout, `pyproject.toml` + `README.md` + `requirements.txt` + `tests/` per artifact.

**Status:** Accepted
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**Track:** v8 T14 (governance backlog)
**L8-015** (T14.6)

## Context

The fleet has accumulated MCP implementations across many repos:

- **Servers** — `dispatch-mcp`, `cheap-llm-mcp`, `pheno-mcp-router`, `phenoMCP`, `AgilePlus/mcp-bridge`, etc.
- **Skills** — `pheno-vibecoding-guard`, `pheno-scaffold-kit`, `pheno-prompt-test`, etc.
- **Clients** — `forge-runner-scripts/bin/`, `phenotype-cli`, `phenotype-agents-md`, etc.
- **Tools** — `pheno-secret-scan`, `pheno-cost-card`, `pheno-worklog-schema`, etc.

Until 2026-06-17 there was no canonical registry; consumers had to grep across 50+ repos. The fleet-wide `phenotype-registry` repo (per ADR-030) holds an index but is read-only / archival (per AGENTS.md **Decision D**). A **canonical home for MCP artifacts** — where each artifact is checked in, versioned, and discoverable — was missing.

## Decision

**`KooshaPari/PhenoMCPServers` is the canonical registry for all Phenotype MCP implementations.**

- **Repo description:** "Phenotype MCP implementations registry — servers, skills, plugins, and agent artifacts"
- **Visibility:** public
- **License:** MIT (per fleet convention)

### Layout

```
KooshaPari/PhenoMCPServers/
├── servers/<id>/          # one directory per MCP server
├── skills/<id>/           # one directory per skill
├── clients/<id>/          # one directory per client
├── tools/<id>/            # one directory per standalone tool
└── catalog/
    └── registry.yaml      # the index (per ADR-038: minor-bump on every server/skill add)
```

Each artifact directory MUST contain:

- `pyproject.toml` (Poetry) — package metadata, dependencies
- `README.md` — what, when, when **not**, 5-line quickstart
- `requirements.txt` — pinned runtime deps (for `pip install -r` consumers)
- `tests/` — unit + integ minimum; e2e + perf strongly preferred for fleet-critical artifacts
- The artifact source itself (`server.py`, `skill.py`, `client.py`, `tool.py`)

### House style (Python)

Every Python MCP artifact in `PhenoMCPServers` uses the `fastmcp` import:

```python
from fastmcp import FastMCP

mcp = FastMCP("phenotype-<artifact-name>")

@mcp.tool()
def example_tool(x: int) -> int:
    """One-line docstring; the docstring is the schema."""
    return x * 2

if __name__ == "__main__":
    mcp.run()
```

Layout: **flat module**, not nested `src/phenotype_mcp_xyz/` packages. The flat layout reduces import-path drift across the fleet and matches the `fastmcp` examples in the upstream docs.

### Discovery

Consumers query `catalog/registry.yaml` (the index) to discover what artifacts are available. The catalog entry per artifact has:

```yaml
- id: pheno-cost-card
  kind: tool               # server | skill | client | tool
  path: tools/pheno-cost-card/
  version: 0.4.2
  status: stable           # experimental | beta | stable | deprecated
  owner: phenodocs
  description: Estimate USD cost of an LLM call given model + prompt + completion tokens.
  tags: [cost, llm, telemetry]
```

The catalog is the authoritative discovery surface; the `phenotype-registry` (read-only spine per Decision D) mirrors a subset for archival.

## Consequences

*Positive:*
- One canonical home for MCP artifacts. Consumers grep one repo, not 50.
- The `fastmcp` house style ensures all artifacts share the same import + layout — easy to onboard a new artifact author.
- The `catalog/registry.yaml` index is a machine-parseable discovery surface.
- The flat module layout + 4 required files (`pyproject.toml`, `README.md`, `requirements.txt`, `tests/`) is a minimal quality bar; it catches obvious gaps (e.g. an artifact with no `tests/` directory) at PR time.

*Negative / Risks:*
- The 50+ existing MCP artifacts must be migrated in; that's a multi-PR wave. Mitigation: the migration is opt-in per artifact; artifacts stay in their original repo until an author migrates them.
- A new repo adds a 71-pillar audit target; the 71-pillar delta in every PR (per ADR-030) is the enforcement mechanism.
- The `fastmcp` import assumption breaks for non-Python MCP implementations (TypeScript `mcp-ts`, etc.). Mitigation: the layout is Python-first; TS / Go / Rust artifacts get their own `servers/<id>/` sub-conventions documented as the fleet grows.

## Refs

- ADR-030 (PR template 71-pillar delta)
- ADR-038 (registry versioning — minor-bump per server/skill)
- AGENTS.md § "Decision D — Spine repos are LIGHTLY USED" (PhenoMCPServers is **not** a spine; it is an active canonical repo)
- `KooshaPari/PhenoMCPServers` repo (canonical home)
- v8 plan § 3.6 Track T14 (ADR backlog)
