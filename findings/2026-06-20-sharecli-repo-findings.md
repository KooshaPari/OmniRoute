# sharecli — Repository Findings

**Date:** 2026-06-20
**Device:** macbook
**Layer:** L5 (substrate-level audit)
**Repo:** `sharecli/` — **ACTIVE** (Rust)
**Status:** Active — shared CLI process manager for multi-project agent orchestration

---

## 1. Overview

`sharecli` is a **shared CLI process manager** written in Rust that provides centralized process management for Phenotype's multi-project agent infrastructure. It serves as a single control plane for all agent processes across repos — offering process lifecycle management, resource pooling (node/bun runtimes), health monitoring, and process-compose integration.

Sharecli is the **active Rust implementation**, distinct from the now-archived Python-based `thegent-sharecli` project. There is no code or dependency relationship between the two repos — they share only the conceptual `share` name.

## 2. Repository Structure

```
sharecli/
├── src/
│   ├── main.rs               # CLI entry point (clap derive, 14 commands)
│   ├── lib.rs                # Public API exports
│   ├── config.rs             # TOML config + CLI command enums (~347 lines)
│   ├── runtime.rs            # ProcessPool + SharedRuntime (~510 lines)
│   ├── monitoring.rs         # HealthStatus, ProcessStats, MonitoringReport (~121 lines)
│   └── commands/
│       └── mod.rs            # All CLI command implementations (~461 lines)
├── config/
│   ├── sharecli.toml.example
│   └── process-compose/
│       └── template.yml
├── tests/
├── docs/
├── Cargo.toml
├── Cargo.lock
├── README.md
├── AGENTS.md
├── SPEC.md
├── PRD.md
├── PLAN.md
├── BOUNDARY.md
├── FUNCTIONAL_REQUIREMENTS.md
├── TEST_COVERAGE_MATRIX.md
└── CHANGELOG.md
```

## 3. Architecture

```
┌──────────────────────────────────────────────────────┐
│              CLI (clap derive)                        │
│  ps | start | stop | status | config | project | run │
├────────┬──────────┬───────────┬──────────────────────┤
│ Process│ Project  │ Runtime   │ Monitoring           │
│ Pool   │ Registry │ Pool      │ (health checks)      │
│        │          │ (node/    │                      │
│        │          │  bun)     │                      │
├────────┴──────────┴───────────┴──────────────────────┤
│              Substrate ProcessPort                    │
│         (process spawning via substrate SDK)          │
├────────┬─────────────────────────────────────────────┤
│ OS     │  Process-Compose                            │
│ Process│  YAML generation for                         │
│ APIs   │  multi-project orchestration                 │
└────────┴─────────────────────────────────────────────┘
```

## 4. CLI Commands (14 total)

| Command | Description | Status |
|---------|-------------|--------|
| `sharecli ps` | List managed processes with filtering | Done |
| `sharecli start` | Start harness process for a project | Done |
| `sharecli stop` | Stop processes by PID, project, or harness | Done |
| `sharecli status` | Health check with resource summary | Done |
| `sharecli config` | Config init, validate, show, get, set | Done (partial) |
| `sharecli project` | Add, remove, list, show, discover, generate | Done |
| `sharecli run` | Run with pooled runtime (node/bun) | Done |
| `sharecli pool` | Show shared runtime pool status | Done |
| `sharecli health` | Probe shared runtime health | Done |
| `sharecli limits` | Set/get project resource limits | Done |
| `sharecli check` | Check project resource limits | Done |
| `sharecli optimize` | Analyze and suggest resource optimizations | Done |
| `sharecli prune` | Kill idle processes (dry-run by default) | Done |

## 5. Key Components

### ProcessPool (`src/runtime.rs`)
- Wraps substrate's `ProcessPort` for cross-platform process spawning
- Maintains in-memory `HashMap<u32, ManagedProcess>` for tracked processes
- Supports spawn, kill, kill_all, list, find (by project/harness filter)
- Uses sysinfo for system memory and process metrics
- **510 lines** — the largest module

### SharedRuntime (`src/runtime.rs`)
- Separate pools for node and bun runtimes
- Configurable max per type (default: 5)
- Acquire/release model with in_use tracking
- Health checks with per-process memory threshold warnings
- Pool exhaustion handling with clear error messages

### Config (`src/config.rs`)
- TOML-based configuration at `~/.config/sharecli/config.toml`
- 9 sub-config sections: projects, runtime, defaults, pool, monitoring, port, paths, project_limits, spawn
- Global `OnceLock` singleton pattern
- Default project registrations: helios-cli, portage, agentapi, cliproxy, colab
- Config commands: init, validate, show, get, set

### Monitoring (`src/monitoring.rs`)
- `HealthStatus` with check counters pass/fail
- `ProcessStats` with idle detection (< 1% CPU, uptime > threshold)
- `MonitoringReport` with by-project/by-harness breakdown
- High-memory warnings at configurable threshold (default: 4096 MB)
- Idle process recommendations at configurable threshold (default: 5)

## 6. Configuration Model

```toml
[projects]
helios-cli = "~/CodeProjects/Phenotype/repos/helios-cli"
portage = "~/CodeProjects/Phenotype/repos/portage"

[runtime]
max_memory_mb = 4096
max_processes = 100

[pool]
enabled = true
max_per_type = 5
idle_timeout_secs = 300
max_age_secs = 3600

[monitoring]
health_check_interval_secs = 30
idle_threshold_secs = 300
high_memory_threshold_mb = 4096

[spawn]
default_harness = "claude"
prune_idle_seconds = 300
```

### Default Harness Configurations

| Harness | Max Instances | Memory Limit (MB) |
|---------|--------------|-------------------|
| claude | 11 | 512 |
| forge | 20 | 256 |
| node | 30 | 256 |
| bun | 10 | 384 |

## 7. Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| clap | 4.5 (derive) | CLI argument parsing |
| tokio | 1 (full) | Async runtime |
| substrate (git) | — | ProcessPort abstraction (from KooshaPari/substrate) |
| runtime-process (git) | — | Substrate process implementation (CommandGroupProcess) |
| sysinfo | 0.30 | System process/memory information |
| serde / serde_json / toml | — | Configuration serialization |
| tracing / tracing-subscriber | — | Structured logging |
| chrono | 0.4 (serde) | Timestamps |
| dirs | 5 | Config directory resolution |

## 8. Performance Targets

| Operation | Target |
|-----------|--------|
| Process list | <100ms |
| Health check | <500ms |
| Project discovery | <2s for 50 repos |
| Config load | <50ms |
| Process start | <2s |
| sharecli memory overhead | <32MB |
| Idle prune scan | <1s |

## 9. Process-Compose Integration

Sharecli can generate a `process-compose.yml` file for all registered projects:

```yaml
# Generated by sharecli
version: "0.5"
services:
  helios-cli-agent:
    command: sharecli run --harness helios-cli --project helios-cli
    log_location: .sharecli/logs/helios-cli.log
    readiness_probe:
      exec:
        command: sharecli health --harness helios-cli
```

Each service gets a readiness probe, log location, and configurable dependencies — enabling multi-project agent orchestration with a single generated file.

## 10. Key Observations

1. **Rust for performance-critical orchestration**: The choice of Rust over the Python prototype (`thegent-sharecli`) reflects a need for low overhead (<32MB memory, <100ms list operations) in a control-plane tool that may manage dozens of agent processes.

2. **Substrate SDK integration**: Using `substrate`'s `ProcessPort` abstraction decouples sharecli from OS-specific process management — the same code works on macOS and Linux without conditional compilation for syscalls.

3. **Global config singleton**: The `OnceLock` pattern for global config is pragmatic — prevents re-reading the config file on every command invocation while being thread-safe.

4. **Comprehensive but early-stage**: The 14 CLI commands cover a broad surface area, but several are thin wrappers:
   - `health` and `pool` essentially duplicate status information
   - `config set` is marked "not implemented yet"
   - `optimize` analyzes but doesn't actually apply changes
   - `run_with_pool` spawns a `--version` probe rather than actually running the target project's harness

5. **No `thegent-sharecli` relationship**: Per `AGENTS.md`, the two repos share only the `share` naming convention — different language (Rust vs Python), different purpose (process management vs command dedup), no shared code or deps.

## 11. Recommendations

1. **Implement `config set`**: The only unimplemented command — users must edit config TOML manually.
2. **Fix `run_with_pool`**: Currently spawns `node --version` / `bun --version` as a health probe rather than actually running the target project. This appears to be a stub.
3. **Wire `optimize --apply`**: Currently prints suggestions but doesn't act on them — should prune idle processes or adjust pool size.
4. **Add integration tests**: Only one unit test exists (process pool spawn). The command dispatch logic and config loading have no test coverage.
5. **Handle `harness` argument in `start` command**: The `_args` parameter is unused — the harness type is the binary name, but no actual arguments are passed to the started process.
