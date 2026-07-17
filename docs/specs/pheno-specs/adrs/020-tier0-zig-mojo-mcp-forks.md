---
status: draft
adr: ADR-020
title: Tier-0 Zig/Mojo MCP framework forks
date: 2026-06-17
depends_on:
  - ADR-017
  - ADR-018
---

# ADR-020: Tier-0 Zig/Mojo MCP framework forks

## Status

Draft (stub) — **defer implementation** until rmcp superset gate clears.

## Context

[PhenoMCPServers issue #8](https://github.com/KooshaPari/PhenoMCPServers/issues/8) reserves parallel tier-0 framework lanes for Zig and Mojo. Registry v1.1.0+ stubs `framework.zig` and `framework.mojo` at `status: future`. Spike: [zig-mojo-mcp.md](https://github.com/KooshaPari/PhenoMCPServers/blob/main/docs/spikes/zig-mojo-mcp.md).

## Decision

1. **Defer** fork creation until gate G1–G6 in spike doc are satisfied.
2. **Leading candidates** when gate opens:
   - Zig: `muhammad-fiaz/mcp.zig`
   - Mojo: `nowex35/mojo_mcp`
3. **Reject** `Dicklesworthstone/fastmcp_rust` as Zig/Mojo parent (wrong layer per ADR-017).
4. **Fork procedure** follows [github-fork-policy](https://github.com/KooshaPari/PhenoMCPServers/blob/main/skills/github-fork-policy/SKILL.md); update `fork_parent` in catalog before `status: active`.

## Gates (summary)

| ID | Gate |
|----|------|
| G1 | PhenoRMCP rmcp superset stable on `phenotype/superset` |
| G2 | PhenoFastMCP-rust integration RC (2026-07-28 target) |
| G3 | ADR-020 Accepted in PhenoSpecs |
| G4 | Verified native upstream fork parent (not rust-sdk placeholder) |
| G5 | CI `validate_fork_parents.py` extended for zig/mojo |
| G6 | Registry sync + PhenoHandbook tier-0 page |

## Consequences

- No `KooshaPari/PhenoFastMCP-zig` or `-mojo` repos until gates clear.
- `validate_fork_parents.py` continues to skip zig/mojo future entries.

## References

- ADR-017 polyrepo boundaries
- ADR-018 fork policy / zero-loop
- PhenoMCPServers `docs/spikes/zig-mojo-mcp.md`
