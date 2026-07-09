# Tier 2.6 — BytePort Agent Platform

**Target**: `BytePort/agents/` directory + MCP server + A2A skill bindings  
**Depends**: `backend/` Gin server (shipped), `byteport-engine` crate (shipped Phase 3), OmniRoute A2A protocol

## Surface

BytePort's sixth surface (per `ecosystem-unified-vision-v1.md §4`): "Agent Platform — runs agents as deployable units with MCP tool bindings."

## Architecture

```
BytePort Gin API → AgentRegistry → AgentRuntime
                                    ├── DockerEngine (existing)
                                    ├── NVMS sandbox (existing)
                                    ├── MCP server (new)
                                    └── A2A skill bridge (new)
```

## New files

| File | Purpose | Est. lines |
|------|---------|-----------|
| `agents/agent.go` | `Agent` struct + `AgentSpec` YAML config | ~80 |
| `agents/registry.go` | `AgentRegistry` — list/deploy/stop agents | ~100 |
| `agents/runtime.go` | `AgentRuntime` — env injection + tool binding | ~120 |
| `agents/mcp.go` | MCP server that exposes deployed agents as tools | ~80 |
| `agents/a2a.go` | A2A skill adapter — OmniRoute can query BytePort agents | ~60 |
| `internal/infrastructure/http/api/agents.go` | Gin handlers (CRUD + logs) | ~100 |

## AgentSpec YAML format

```yaml
apiVersion: byteport.dev/v1
kind: Agent
spec:
  name: code-reviewer
  image: ghcr.io/phenotype/code-review-agent:latest
  mcp_tools:
    - lint
    - unit-test
    - dependency-check
  a2a_skills:
    - smartRouting
  resources:
    cpu: 1
    memory: 512Mi
  environment:
    OPENAI_API_KEY: $BYTEPORT_SECRETS_OPENAI_KEY
```

## Router endpoints

| Method | Path | Handler |
|--------|------|---------|
| POST | `/v1/agents` | CreateAgent |
| GET | `/v1/agents` | ListAgents |
| GET | `/v1/agents/:id` | GetAgent |
| POST | `/v1/agents/:id/deploy` | DeployAgent (calls engine.deploy) |
| POST | `/v1/agents/:id/stop` | StopAgent |
| GET | `/v1/agents/:id/logs` | AgentLogs |
| POST | `/v1/agents/:id/mcp/tools` | ListAgentTools (MCP bridge) |

## Phased rollout

| Phase | Scope | Est. sessions |
|-------|-------|--------------|
| 1 | Agent CRUD + Docker deploy (reuses engine) | 1 |
| 2 | MCP tool bridge + NVMS sandbox | 1 |
| 3 | A2A skill bridge + OmniRoute integration | 1 |
| 4 | Agent marketplace (portfolio surface) | 1 |
