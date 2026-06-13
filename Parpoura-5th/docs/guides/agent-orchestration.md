# Agent Orchestration

Run autonomous agents and coordinate multi-agent workflows for parpour development.

## Overview

The `scripts/agent-orchestrator.sh` script provides bash-native introspection and control of CLI agents (cursor-agent, codex), enabling DAG-based parallel orchestration without relying on client-specific background task handling.

## Basic Usage

### Start an Agent

```bash
./scripts/agent-orchestrator.sh start <name> <cli> "<prompt>"
```

**Arguments**:
- `<name>` — Agent identifier (e.g., `researcher`, `builder`)
- `<cli>` — CLI tool: `cursor` or `codex`
- `<prompt>` — Task prompt (quoted string)

**Examples**:

```bash
# Start a research agent
./scripts/agent-orchestrator.sh start researcher cursor "Analyze the codebase architecture"

# Start a builder agent
./scripts/agent-orchestrator.sh start builder codex "Implement feature X with tests"
```

### Check Status

```bash
# Status of all agents
./scripts/agent-orchestrator.sh status

# Status of a specific agent
./scripts/agent-orchestrator.sh status researcher
```

Output includes:
- Agent name and CLI tool
- Current status (starting, running, completed, failed)
- PID if running
- Exit code if completed

### View Logs

```bash
# View agent logs
./scripts/agent-orchestrator.sh logs researcher

# Follow logs in real-time
./scripts/agent-orchestrator.sh logs researcher --follow
```

### Wait for Completion

```bash
# Wait for specific agents
./scripts/agent-orchestrator.sh wait researcher builder

# Wait for all agents
./scripts/agent-orchestrator.sh wait
```

Blocks until all specified agents complete. Prints final status summary.

### Stop an Agent

```bash
./scripts/agent-orchestrator.sh stop researcher
```

Gracefully stops the agent (SIGTERM), then force-kills if needed (SIGKILL).

### Cleanup

```bash
./scripts/agent-orchestrator.sh cleanup
```

Stops all running agents and removes all artifacts (.pid, .log, .status files).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_DIR` | `./.agents` | Directory for agent files (PID, logs, status) |
| `CURSOR_MODEL` | `auto` | LLM model for cursor-agent |
| `CODEX_SANDBOX` | `workspace-write` | Sandbox level for codex |

**Example**:

```bash
AGENT_DIR=/tmp/agents CURSOR_MODEL=claude-opus-4.6 ./scripts/agent-orchestrator.sh start researcher cursor "Research task"
```

## DAG Execution

Run multiple agents in phases with blocking/non-blocking dependencies:

```bash
./scripts/agent-orchestrator.sh run-dag <spec.json>
```

### DAG Specification Format

```json
{
  "phases": [
    {
      "blocking": true,
      "agents": {
        "researcher": {
          "cli": "cursor",
          "prompt": "Analyze the codebase and document architecture"
        }
      }
    },
    {
      "blocking": true,
      "agents": {
        "builder": {
          "cli": "cursor",
          "prompt": "Implement the feature based on research"
        },
        "tester": {
          "cli": "codex",
          "prompt": "Write comprehensive tests"
        }
      }
    }
  ]
}
```

**Phase Structure**:
- `blocking` (boolean) — If true, wait for all agents in this phase to complete before starting next phase
- `agents` (object) — Map of agent names to their configurations
  - `cli` — `cursor` or `codex`
  - `prompt` — Task prompt for the agent

**Example Workflow**:
1. Phase 1: Researcher analyzes codebase (blocking: true, wait for completion)
2. Phase 2: Builder and Tester work in parallel (blocking: true, both must complete)
3. Continue to next phases...

## Architecture

### File Organization

```
.agents/
  researcher.pid          # Process ID
  researcher.log          # Raw agent output
  researcher.status       # JSON status ({"status":"running",...})
  researcher.output.md    # Final output (if applicable)
```

### Status Flow

```
starting → running → completed/failed
```

Status JSON examples:

```json
{"status":"starting","started_at":"2026-02-21T10:30:00Z"}
{"status":"running","cli":"cursor-agent","model":"claude-opus-4.6"}
{"status":"completed","exit_code":0,"finished_at":"2026-02-21T10:45:00Z"}
{"status":"failed","exit_code":1,"finished_at":"2026-02-21T10:45:00Z"}
```

## Integration with Taskfile

Add to `Taskfile.yml`:

```yaml
tasks:
  agents:start:researcher:
    desc: Start researcher agent
    cmds:
      - ./scripts/agent-orchestrator.sh start researcher cursor "Analyze the codebase"

  agents:status:
    desc: Check status of all agents
    cmds:
      - ./scripts/agent-orchestrator.sh status

  agents:wait:
    desc: Wait for all agents to complete
    cmds:
      - ./scripts/agent-orchestrator.sh wait

  agents:cleanup:
    desc: Stop all agents and cleanup
    cmds:
      - ./scripts/agent-orchestrator.sh cleanup

  agents:run-dag:
    desc: Run DAG from spec.json
    cmds:
      - ./scripts/agent-orchestrator.sh run-dag spec.json
```

## Common Workflows

### Single Agent Task

```bash
# Start an agent and wait for it
./scripts/agent-orchestrator.sh start researcher cursor "Your task"
./scripts/agent-orchestrator.sh wait researcher

# Check final status
./scripts/agent-orchestrator.sh logs researcher
```

### Parallel Research and Build

```bash
# Start both
./scripts/agent-orchestrator.sh start researcher cursor "Research architecture"
./scripts/agent-orchestrator.sh start builder cursor "Implement feature"

# Wait for both
./scripts/agent-orchestrator.sh wait researcher builder

# Review results
./scripts/agent-orchestrator.sh status
```

### Sequential Phases (Use DAG)

Create `agent-spec.json`:

```json
{
  "phases": [
    {
      "blocking": true,
      "agents": {
        "research": {"cli": "cursor", "prompt": "Research..."}
      }
    },
    {
      "blocking": true,
      "agents": {
        "build": {"cli": "cursor", "prompt": "Build..."}
      }
    }
  ]
}
```

Run:
```bash
./scripts/agent-orchestrator.sh run-dag agent-spec.json
```

## Troubleshooting

### Agent not starting

Check if CLI is installed:
```bash
which cursor-agent
which codex
```

### Zombie processes

Clean up properly:
```bash
./scripts/agent-orchestrator.sh cleanup
```

### View raw logs

```bash
tail -f .agents/researcher.log
```

### Check exit code

```bash
cat .agents/researcher.status | jq '.exit_code'
```

## Best Practices

1. **Use meaningful names**: `researcher`, `architect`, `implementer` (not `agent1`, `agent2`)
2. **Clear prompts**: Specific, actionable, with context
3. **Sequential when needed**: Use `blocking: true` in DAG phases for dependencies
4. **Parallel when safe**: Use `blocking: false` for independent work
5. **Always wait**: Use `wait` before assuming agent completed
6. **Review logs**: Check logs and status before moving to next phase
7. **Cleanup between runs**: Use `cleanup` to avoid confusion with stale agents
