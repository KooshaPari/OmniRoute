# SPEC-MCP-003: Catalog wiring

**Status:** specified  
**ADR:** ADR-017, ADR-018  
**Registry:** PhenoMCPServers `catalog/registry.yaml`

## Functional requirements

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-001 | `registry.yaml` is SSOT for servers, skills, plugins, agents | `validate_catalog.py` passes |
| FR-002 | Plugin bundle `servers` list matches catalog server IDs | `validate_bundle_wiring.py` passes |
| FR-003 | Agent `skills` and `default_servers` resolve in registry | fleet-lead `agent.yaml` wired |
| FR-004 | `registry_version` bumps on wiring shape change | CI fails on drift |
| FR-005 | Submodule paths documented and init-able | `git submodule update --init --recursive` |

## Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-001 | Catalog CI ≤ 5 minutes |
| NFR-002 | Validators runnable locally without network (except fork_parent audit) |

## Traceability

| FR | Implementation |
|----|----------------|
| FR-001–004 | PhenoMCPServers/scripts/validate_catalog.py, validate_bundle_wiring.py |
| FR-005 | PhenoMCPServers/docs/edges/, servers/external/ submodules |
| Skill | PhenoMCPServers/skills/catalog-wiring/ |
