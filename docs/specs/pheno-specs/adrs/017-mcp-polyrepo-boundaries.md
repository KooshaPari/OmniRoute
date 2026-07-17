---
id: ADR-017
title: MCP Polyrepo Boundaries (Framework / Implementations / Runtime)
status: accepted
date: 2026-06-17
author: KooshaPari
tags: [mcp, governance, polyrepo, architecture]
---

# ADR-017: MCP Polyrepo Boundaries

## Status

Accepted (2026-06-17)

## Context

The Phenotype MCP fleet grew across PhenoMCP, McpKit, AgentMCP, substrate driver-mcp,
and language-bucket SDK repos. Agent sessions (e.g. transcript `40d15363`) repeatedly
re-debated settled questions:

- Official `rmcp` was forked as **PhenoFastMCP-rust** (wrong analogue — SDK ≠ fastmcp)
- Mirror-push to empty repos broke `fork: true` on GitHub
- Go and Python tiers were conflated with tier-0 protocol core

We need a **domain-first** boundary that agents can read once and execute without loops.

## Decision

### Three layers

| Layer | Canonical repos | Owns |
|-------|-----------------|------|
| **Framework** | PhenoFastMCP (py), PhenoFastMCP-go, PhenoFastMCP-rust, PhenoRMCP | Fork policy, transports, macros, CLI, upstream sync |
| **Implementations** | PhenoMCPServers | `servers/`, `skills/`, `plugins/`, `agents/`, `catalog/registry.yaml` |
| **Runtime** | substrate | driver-http, driver-argv, cheap-llm CLI routing, fleet mailbox — not MCP framework |

### Framework fork parents (normative)

| Phenotype repo | Upstream parent | Role |
|----------------|-----------------|------|
| PhenoFastMCP | PrefectHQ/fastmcp | fastmcp binding (tier 2) |
| PhenoFastMCP-go | mark3labs/mcp-go | fastmcp-like Go edge (tier 1, justified) |
| PhenoFastMCP-rust | Dicklesworthstone/fastmcp_rust | fastmcp-equivalent Rust framework (tier 0) |
| PhenoRMCP | modelcontextprotocol/rust-sdk | Official rmcp spec SDK (tier 0) — **not** PhenoFastMCP branding |

### Language tiers

Normative detail: [PhenoMCPServers/docs/LANGUAGE-TIERS-AND-ROLES.md](https://github.com/KooshaPari/PhenoMCPServers/blob/main/docs/LANGUAGE-TIERS-AND-ROLES.md)

- **Tier 0:** Rust, Zig, Mojo — protocol core, hot paths
- **Tier 1:** Go — HTTP/SSE MCP edges only (written justification required)
- **Tier 2:** Python 3.14+/uv, Bun, TS 7, C#, Java — bindings and apps
- **Tier 3:** Shell, PowerShell — glue only

### Anti-patterns (do not create)

- `phenotype-rust-sdk`, `phenotype-go-sdk` as MCP framework homes
- McpKit as lib warehouse (framework → PhenoFastMCP* forks)
- Mirror-push into empty repo instead of `gh repo fork`
- Deployable MCP servers inside framework fork repos
- cheap-llm as separate MCP server repo (substrate `driver-argv` only)

### Bootstrap

HexaKit owns **templates only** (`hexakit init mcp-server` → PhenoMCPServers layout).

## Consequences

### Positive

- Agents select correct repo from ADR + catalog without user correction
- Parallel framework lanes (py/go/rust) with weekly registry sync only
- Clear retirement path for PhenoMCP, McpKit overlap

### Negative

- Migration cost from legacy repos and stale docs
- fastmcp_rust uses asupersync (not tokio) — bridge at server boundary

## Mitigations

- PhenoMCPServers `catalog/registry.yaml` as wiring SSOT
- ADR-018 agent pre-flight checklist and skills
- phenotype-registry DOMAIN_ROLES row updated in same release wave

## Related

- Spec: `specs/mcp/polyrepo-boundaries/spec.md`
- Supersedes: ADR-011 MCP kit rows (see ADR-011 appendix)
- ADR-018: Agent session zero-loop SSOT
- ADR-019: Runtime ↔ implementation dependency graph
