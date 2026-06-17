# sd-retire side-DAG audit close — 2026-06-17

**Lane:** phenodag `sd-retire` (legacy MCP retire)  
**Authority:** ECOSYSTEM_MAP.md, DOMAIN_ROLES.md

## Task completion

| Task | Description | Status | Evidence |
|------|-------------|--------|----------|
| sd-retire-01 | ECOSYSTEM_MAP legacy MCP rows cleanup | **DONE** | §1 role table, §2 edges, Cluster I/L, §4 #8, §6 retirements |
| sd-retire-02 | McpKit row retire | **DONE** | Moved to superseded/archived; Cluster I → SUPERSEDED |
| sd-retire-03 | PhenoMCP row retire | **DONE** | Moved to superseded/archived; dependency edge updated |
| sd-retire-04 | Link check | **DONE** | PhenoFastMCP, PhenoMCPServers, substrate URLs verified via `gh repo view` |
| sd-retire-05 | Audit close | **DONE** | This document |

## Supersession map

| Retired repo | Successor(s) | ADR |
|--------------|--------------|-----|
| McpKit | PhenoFastMCP, PhenoMCPServers, phenotype-python-sdk `[connect]` | ADR-017 |
| PhenoMCP | PhenoMCPServers, PhenoFastMCP*, substrate | ADR-017 |
| cheap-llm-mcp | substrate, PhenoMCPServers `servers/substrate/` | ADR-019 |

## Link check (sd-retire-04)

| URL | Reachable |
|-----|-----------|
| https://github.com/KooshaPari/PhenoFastMCP | yes |
| https://github.com/KooshaPari/PhenoMCPServers | yes |
| https://github.com/KooshaPari/substrate | yes |

## Validation

- `task validate` / `scripts/validate-ecosystem.sh`
- `bun run tools/check-ecosystem.ts --map-only`
