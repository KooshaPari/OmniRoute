---
id: ADR-019
title: MCP Runtime and Implementation Dependency Graph
status: accepted
date: 2026-06-17
author: KooshaPari
tags: [mcp, substrate, architecture]
---

# ADR-019: MCP Runtime ↔ Implementation Dependency Graph

## Status

Accepted (2026-06-17) — PhenoMCPServers server migrations landed; substrate PR #24 documents SSOT.

## Context

substrate absorbed dispatch-mcp (PR #21). PhenoMCPServers seeds substrate MCP
packages. Long-term we must avoid duplicating MCP tool definitions in both repos.

## Decision

```
PhenoMCPServers (implementations)
  └── servers/substrate/     ← deployable MCP stdio servers
  └── skills/, plugins/, agents/

substrate (runtime)
  └── driver-http            ← HTTP API for plan/route/dispatch
  └── driver-argv            ← cheap-llm CLI routing (no MCP server repo)
  └── imports/consumes       ← PhenoMCPServers packages for MCP surface (target)
```

### Rules

1. **cheap-llm:** substrate `driver-argv` only; no `cheap-llm-mcp` repo
2. **MCP tools:** defined in PhenoMCPServers; substrate runtime calls HTTP/argv edges
3. **Version pin:** bump `registry_version` when wiring between layers changes
4. **No framework code** in substrate or PhenoMCPServers — use PhenoFastMCP* deps

## Consequences

- Single owner for MCP tool schemas (catalog)
- substrate stays Rust runtime-focused
- Migration: remove duplicate `driver-mcp/` tree from substrate when import path stable

## Related

- ADR-017
- substrate PR #21 (merged)
- PhenoMCPServers servers/substrate/
