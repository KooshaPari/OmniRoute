# Boundary — AgilePlus

## In Scope

- **BLOCK-A platform spine** — 94-crate workspace, 27G total, 454 source files
- **Federation of sub-workspaces** (~12 nested Cargo.toml-bearing dirs):
  - `agileplus/` (core, 24+ agileplus-* crates)
  - `agent-user-status/`, `agent-user-status-wtrees/`
  - `agentapi-plusplus-wtrees/`
  - `AgentMCP/`, `AgentMCP-wtrees/`
  - `agentops-policy-federation/`
  - `Agentora/` (also a separate standalone repo, nested here)
  - `agileplus-agents/`
  - `agileplus-landing/`, `agileplus-landing-wtrees/`
  - `agileplus-mcp/`
- **Scaffolding state machine** — workspace member filtering excludes ~44
  crates/19 libs until source is implemented (per
  `kitty-specs/003-agileplus-platform-completion`)

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Registry metadata | `phenotype-registry` | INDEX spine role |
| ADRs / contracts | `PhenoSpecs` → `phenotype-registry/docs/specs/pheno-specs/` | ADRs spine role (spine integrity flagged) |
| Style/conventions | `PhenoHandbook` → `phenodocs/docs/handbook/` | CONVENTIONS spine role (spine integrity flagged) |
| MCP implementations | `PhenoMCPServers` | IMPLEMENTATIONS (proposed 5th spine role) |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| agileplus-cli (binary) | AgilePlus → consumer binaries | `cargo install agileplus-cli` | green |
| agileplus-mcp-intent | AgilePlus → MCP clients | MCP protocol | green |
| Agentora satellite | Agentora standalone ← → AgilePlus/Agentora sub-workspace | both consume same crates (one in-tree, one out) | amber (causes duplication) |
| agileplus-pipeline | AgilePlus → platform pipelines | CI artifact path | green |

## Audit Findings (2026-07-17)

- **Size**: 27G (mega-workspace)
- **Crates**: 94 in workspace; 24 actively built; rest are scaffolding
- **Decision**: ARCHIVE_ONLY with **proposed spine promotion**
- **Reason**: Too cross-coupled (94 crates) for naive absorption; self-declared
  scope via `kitty-specs/003-agileplus-platform-completion` roadmap
- **Recommended action**: **promote AgilePlus to the 5/6-role spine role
  `PLATFORM` (BLOCK-A spine)** rather than absorb. See
  `docs/spine/PhenoMCPServers.md` for the proposed 5/6-role spine layout.

## Last Boundary Review

**Date:** 2026-07-17
**Reviewer:** registry spine audit (deep-workspace audit, 2026-07-17 batch3)
**Disposition-index row:** DSPI-20
**Decisions:**
- ARCHIVE_ONLY (not absorption).
- Proposed spine promotion to PLATFORM role — pending human ratification.

**Next review:** when `kitty-specs/003-agileplus-platform-completion` reaches
phase-1 milestone (estimated Q4 2026)
