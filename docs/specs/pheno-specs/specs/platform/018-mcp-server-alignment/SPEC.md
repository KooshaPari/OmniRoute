# MCP Server Alignment — heliosCLI & phenotype

## Meta

- **ID**: 018-mcp-server-alignment
- **Title**: MCP Server Alignment — Unify helios-mcp-server with phenotype-mcp-*
- **Created**: 2026-04-04
- **State**: specified
- **Scope**: heliosCLI, phenotype-mcp-* crates (cross-project integration)

## Context

heliosCLI includes `helios-mcp-server` — a Model Context Protocol server for external tool integration. Separately, the phenotype crates include `phenotype-mcp-core`, `phenotype-mcp-asset`, and `phenotype-mcp-testing` for MCP functionality.

Currently, these implementations may have overlapping concerns and duplicated types. This spec establishes a unified MCP type system to eliminate duplication and ensure compatibility between heliosCLI and phenotype ecosystem MCP implementations.

## Problem Statement

Potential duplication between MCP implementations:
- **Type duplication**: helios-mcp-server and phenotype-mcp-core may define overlapping types
- **Incompatible serialization**: Different JSON schemas for MCP messages
- **Wasted maintenance**: Two teams maintaining similar MCP code
- **Integration friction**: Projects using both systems face impedance mismatch

## Goals

- Audit current MCP implementations for duplication
- Extract shared MCP types to unified crate
- Establish `phenotype-mcp-core` as canonical MCP types crate
- Align helios-mcp-server on phenotype-mcp-core types
- Eliminate duplication while maintaining functionality

## Non-Goals

- Rewriting helios-mcp-server protocol logic
- Removing helios-mcp-server (keep as implementation)
- Changing MCP protocol semantics
- Forcing phenotype-mcp-* on heliosCLI if incompatible

## Architecture

```
Before (Duplicated):
┌─────────────────────────┐     ┌─────────────────────────┐
│     heliosCLI           │     │  phenotype-mcp-*        │
│  ┌─────────────────┐    │     │  ┌─────────────────┐    │
│  │ helios-mcp-server│    │     │  │phenotype-mcp-core│   │
│  │                 │    │     │  │  (MCP types)    │    │
│  │ - MCP types     │◄───┼─────┼──┤  - MCP types    │    │
│  │ - Server impl   │    │     │  │ - Shared traits │    │
│  │ - Tool handlers │    │     │  └─────────────────┘    │
│  └─────────────────┘    │     │                         │
│                         │     │  ┌─────────────────┐    │
│                         │     │  │phenotype-mcp-asset│  │
│                         │     │  │  (resources)    │    │
│                         │     │  └─────────────────┘    │
└─────────────────────────┘     └─────────────────────────┘

After (Unified):
┌─────────────────────────────────────────────────────────┐
│              phenotype-mcp-core (canonical)             │
│           ┌─────────────────────────┐                   │
│           │   Shared MCP Types      │                   │
│           │ - JSON-RPC messages     │                   │
│           │ - Tool definitions      │                   │
│           │ - Resource schemas      │                   │
│           │ - Content types         │                   │
│           └─────────────────────────┘                   │
└─────────────────────────┬───────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
 ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
 │ heliosCLI    │  │phenotype-mcp-│  │ Other Pheno  │
 │ helios-mcp-  │  │    asset     │  │   Projects   │
 │   server     │  │              │  │              │
 │ (implementation│  │ (resources)  │  │              │
 └──────────────┘  └──────────────┘  └──────────────┘
```

## Audit Plan

### Step 1: Type Inventory
Inventory MCP types in both implementations:

**helios-mcp-server types:**
- `McpMessage`, `McpRequest`, `McpResponse`
- `Tool`, `ToolCall`, `ToolResult`
- `Resource`, `ResourceTemplate`
- `Content`, `TextContent`, `ImageContent`

**phenotype-mcp-core types:**
- (Need to audit actual contents)

### Step 2: Compare & Map
- Identify exact duplicates
- Identify semantic equivalents (same purpose, different names)
- Identify unique types (only in one implementation)

### Step 3: Unification Strategy
For each type group:
- **Exact duplicates**: Use phenotype-mcp-core version
- **Semantic equivalents**: Choose best design, migrate both
- **Unique types**: Move to phenotype-mcp-core if generally useful

## Work Packages

| WP | Title | Owner | State | Est |
|----|-------|-------|-------|-----|
| WP1 | Audit helios-mcp-server types | TBD | planned | 2d |
| WP2 | Audit phenotype-mcp-core types | TBD | planned | 2d |
| WP3 | Compare and map types | TBD | planned | 2d |
| WP4 | Unify to phenotype-mcp-core | TBD | planned | 4d |
| WP5 | Migrate helios-mcp-server | TBD | planned | 3d |
| WP6 | Update phenotype-mcp-asset | TBD | planned | 2d |
| WP7 | Integration tests | TBD | planned | 2d |
| WP8 | Documentation | TBD | planned | 1d |

## Acceptance Criteria

- [ ] Complete audit of both MCP type systems
- [ ] Duplication analysis published
- [ ] phenotype-mcp-core contains all shared MCP types
- [ ] helios-mcp-server uses phenotype-mcp-core types
- [ ] phenotype-mcp-asset aligned on shared types
- [ ] No breaking changes to MCP protocol
- [ ] Integration tests pass

## Dependencies

- Access to helios-mcp-server source code
- phenotype-mcp-core published to crates.io
- Coordination with heliosCLI maintainers

## Related

- worklogs/INTEGRATION.md — Cross-project integration analysis
- worklogs/DUPLICATION.md — Duplication tracking
- heliosCLI AGENTS.md — heliosCLI architecture
- phenotype-mcp-core README (if exists)

## FR Traceability

| FR | Description | WP |
|----|-------------|----|
| FR-018-001 | helios-mcp-server type audit | WP1 |
| FR-018-002 | phenotype-mcp-core audit | WP2 |
| FR-018-003 | Type comparison mapping | WP3 |
| FR-018-004 | phenotype-mcp-core unification | WP4 |
| FR-018-005 | helios-mcp-server migration | WP5 |
| FR-018-006 | phenotype-mcp-asset update | WP6 |
