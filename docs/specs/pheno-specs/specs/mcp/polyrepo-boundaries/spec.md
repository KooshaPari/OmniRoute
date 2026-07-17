# SPEC-MCP-001: MCP Polyrepo Boundaries

**Status:** specified  
**ADR:** ADR-017  
**Registry:** PhenoMCPServers `catalog/registry.yaml`

## Functional requirements

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-001 | Three layers: Framework, Implementations, Runtime | ADR-017 Accepted; LANGUAGE-TIERS published |
| FR-002 | Each framework entry lists `fork_parent` in catalog | `validate_catalog.py` passes |
| FR-003 | Rust framework parent is `fastmcp_rust`; spec SDK is PhenoRMCP | `gh api` parent check |
| FR-004 | Forks created via `gh repo fork` only | FORK-NOTES in each PhenoFastMCP* repo |
| FR-005 | Deployable servers live only under PhenoMCPServers/servers | No new server dirs in framework forks |
| FR-006 | Agent pre-flight reads ADR-017 + registry before edits | ADR-018 skills published |

## Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-001 | Agent can determine correct repo in ≤ 5 minutes reading SSOT |
| NFR-002 | Catalog validation CI ≤ 30s |
| NFR-003 | registry_version bumps on any wiring shape change |

## Traceability

| FR | Implementation |
|----|----------------|
| FR-001–002 | PhenoMCPServers/catalog/registry.yaml |
| FR-003 | PhenoFastMCP-rust, PhenoRMCP PHENO.md |
| FR-004 | PhenoFastMCP*/FORK-NOTES.md |
| FR-005 | PhenoMCPServers/servers/ |
| FR-006 | PhenoMCPServers/skills/mcp-boundary-guard/ |
