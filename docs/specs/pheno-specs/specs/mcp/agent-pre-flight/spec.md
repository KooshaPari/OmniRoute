# SPEC-MCP-002: Agent pre-flight (MCP fleet)

**Status:** specified  
**ADR:** ADR-018  
**Registry:** PhenoMCPServers `catalog/registry.yaml`, `agents/fleet-lead/agent.yaml`

## Functional requirements

| ID | Requirement | Acceptance |
|----|-------------|------------|
| FR-001 | Agent reads ADR-017 + ADR-018 before MCP edits | Skills `mcp-boundary-guard`, `github-fork-policy` published |
| FR-002 | Agent reads `catalog/registry.yaml` for target IDs | `validate_catalog.py` passes |
| FR-003 | Agent reads target repo `PHENO.md` + `FORK-NOTES.md` before fork work | Documented in DOGFOOD.md pre-flight |
| FR-004 | Agent claims work via phenodag before parallel lanes | `phenodag pick --agent <id>` documented |
| FR-005 | Session outcome filed when dogfood completes | `specs/mcp/session-metrics/sessions/*.yaml` with `outcome: zero_loop` |

## Non-functional requirements

| ID | Requirement |
|----|-------------|
| NFR-001 | Pre-flight readable in ≤ 10 minutes |
| NFR-002 | Zero user correction loops per fleet session (ADR-018 KPI) |

## Traceability

| FR | Implementation |
|----|----------------|
| FR-001–003 | PhenoMCPServers/docs/DOGFOOD.md |
| FR-004 | phenodag `mcp-fleet-60` / `mcp-fleet-90` presets |
| FR-005 | PhenoSpecs `specs/mcp/session-metrics/schema.yaml` |
