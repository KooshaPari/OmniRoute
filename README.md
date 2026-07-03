# sharecli

Shared CLI process manager for multi-project agent orchestration.

## Purpose

Centralized process management for Phenotype's multi-project agent infrastructure:
- Single control plane for all agent processes across repos
- Resource pooling to reduce memory overhead
- Unified monitoring and health checks
- Graceful lifecycle management
- Process-compose integration

## Quick Start

```bash
# Initialize configuration
sharecli config init

# Add a project
sharecli project add helios-cli ~/CodeProjects/Phenotype/repos/helios-cli

# Discover all projects in a directory
sharecli project discover ~/CodeProjects/Phenotype/repos

# List registered projects
sharecli project list

# List managed processes
sharecli ps

# Status with resource summary
sharecli status

# Start a harness process
sharecli start helios-cli --harness claude

# Stop by project
sharecli stop --project helios-cli

# Stop all processes
sharecli stop --all

# Generate process-compose.yml for registered projects
sharecli project generate

# Run with pooled runtime
sharecli run node --project my-project

# Set project resource limits
sharecli limits set helios-cli --memory 4096 --max-procs 10

# Check project limits
sharecli check helios-cli

# Optimize - analyze and suggest improvements
sharecli optimize

# Prune idle processes (dry-run by default)
sharecli prune --idle 30m --dry-run
```

## Install / Launch the Tray

Download the latest release archive from the [Releases page](https://github.com/KooshaPari/sharecli/releases) — no build tools required.

### macOS (Apple Silicon)

```bash
# Download
curl -LO https://github.com/KooshaPari/sharecli/releases/latest/download/sharecli-macos-arm64.tar.gz

# Extract
tar xzf sharecli-macos-arm64.tar.gz

# Install CLI to PATH
sudo cp sharecli-macos-arm64/sharecli /usr/local/bin/
sudo cp sharecli-macos-arm64/sharecli-ipc /usr/local/bin/

# Launch the tray
open sharecli-macos-arm64/ShareCLITray.app

# Or copy the .app to Applications for permanent install
cp -R sharecli-macos-arm64/ShareCLITray.app /Applications/
```

### macOS (Intel)

```bash
curl -LO https://github.com/KooshaPari/sharecli/releases/latest/download/sharecli-macos-x86_64.tar.gz
tar xzf sharecli-macos-x86_64.tar.gz
sudo cp sharecli-macos-x86_64/sharecli /usr/local/bin/
open sharecli-macos-x86_64/ShareCLITray.app
```

### Linux (x86_64)

```bash
# Download
curl -LO https://github.com/KooshaPari/sharecli/releases/latest/download/sharecli-linux-x86_64.tar.gz

# Extract
tar xzf sharecli-linux-x86_64.tar.gz

# Install CLI to PATH
sudo cp sharecli-linux-x86_64/sharecli /usr/local/bin/
sudo cp sharecli-linux-x86_64/sharecli-ipc /usr/local/bin/

# Launch the tray (StatusNotifierItem / AppIndicator)
./sharecli-linux-x86_64/sharecli-tray

# Or install the tray for auto-start
sudo cp sharecli-linux-x86_64/sharecli-tray /usr/local/bin/
```

> **Note:** The Linux tray requires a StatusNotifierItem host (GNOME, KDE, or via `snixembed`/`trayer` on other WMs). Run `sharecli-ipc` first in the background to provide the data socket.

### Windows (x86_64)

```powershell
# Download (PowerShell)
Invoke-WebRequest -Uri https://github.com/KooshaPari/sharecli/releases/latest/download/sharecli-windows-x64.zip -OutFile sharecli-windows-x64.zip

# Extract
Expand-Archive -Path sharecli-windows-x64.zip -DestinationPath sharecli-windows-x64

# Install CLI to PATH
# (Add sharecli-windows-x64 to your PATH environment variable)

# Launch the WinUI 3 tray
.\sharecli-windows-x64\ShareCLITray.exe
```

### Windows (arm64)

```powershell
Invoke-WebRequest -Uri https://github.com/KooshaPari/sharecli/releases/latest/download/sharecli-windows-arm64.zip -OutFile sharecli-windows-arm64.zip
Expand-Archive -Path sharecli-windows-arm64.zip -DestinationPath sharecli-windows-arm64
```

### Verify the install

```bash
sharecli --version
sharecli status
```

Each archive ships with a `VERSION` file matching the git tag.

## Commands

| Command | Description |
|---------|-------------|
| `sharecli ps` | List managed processes with filtering |
| `sharecli start` | Start harness process for a project |
| `sharecli stop` | Stop processes by PID, project, or harness |
| `sharecli status` | Health check with resource summary |
| `sharecli config` | Config init, validate, show, get, set |
| `sharecli project` | Add, remove, list, show, discover, generate projects |
| `sharecli run` | Run with pooled runtime (node/bun) |
| `sharecli pool` | Show shared runtime pool status |
| `sharecli health` | Probe shared runtime health (supports `--harness` hints) |
| `sharecli limits` | Set/get project resource limits |
| `sharecli check` | Check project resource limits |
| `sharecli optimize` | Analyze and suggest resource optimizations |
| `sharecli prune` | Kill idle processes |

## Architecture

```
sharecli/
├── src/
│   ├── main.rs          # CLI entry point
│   ├── lib.rs           # Library exports
│   ├── config.rs        # TOML config + CLI command enums
│   ├── runtime.rs       # ProcessPool + SharedRuntime
│   ├── monitoring.rs    # HealthStatus, ProcessStats
│   └── commands/
│       └── mod.rs       # All CLI command implementations
├── config/
│   ├── sharecli.toml.example
│   └── process-compose/
│       └── template.yml
└── Cargo.toml
```

## Configuration

Configuration is stored in `~/.config/sharecli/config.toml`:

```toml
[projects]
helios-cli = "~/CodeProjects/Phenotype/repos/helios-cli"
portage = "~/CodeProjects/Phenotype/repos/portage"

[runtime]
max_memory_mb = 4096
max_processes = 100
```

## Process-Compose Integration

Generate a `process-compose.yml` for your registered projects:

```bash
sharecli project generate
```

This creates services for each registered project with health probes and logging.

## Resource Limits

Set per-project resource limits to prevent runaway processes:

```bash
sharecli limits set my-project --memory 2048 --max-procs 5
sharecli check my-project
```

## Optimization

Analyze running processes and suggest optimizations:

```bash
sharecli optimize
```

## License

MIT

## Documentation

This repository includes the following cross-cutting documents:

- [`AGENTS.md`](AGENTS.md) — operating instructions for AI agents and human contributors
- [`SPEC.md`](SPEC.md) — formal specification of behavior and contracts
- [`docs/`](docs/) — design notes, ADRs, and supporting documentation (see [`docs/index.md`](docs/index.md))

