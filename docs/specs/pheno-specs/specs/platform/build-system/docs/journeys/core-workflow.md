# Core Workflow Journey

<UserJourney
    :steps="[
        { title: 'Project Setup', desc: 'Initialize project structure' },
        { title: 'Task Definition', desc: 'Define build tasks with dependencies' },
        { title: 'Execution', desc: 'Run and monitor task graph' },
        { title: 'Iteration', desc: 'Modify and re-run efficiently' }
    ]"
    :duration="10"
    :gif-src="'/gifs/phenotype-forge-core.gif'"
/>

## Step-by-Step

### 1. Project Initialization

Create a new phenotype-forge project with standard layout:

```bash
# Initialize project structure
forge init --template app

# Directory structure created:
# .
# ├── forge.toml          # Configuration
# ├── src/
# │   └── main.rs
# ├── tasks/
# │   └── mod.rs           # Task definitions
# └── tests/
#     └── integration.rs
```

### 2. Configuration Setup

Configure `forge.toml` for your project:

```toml
[project]
name = "my-app"
version = "0.1.0"

[build]
workers = 8
cache_dir = ".forge/cache"

[performance]
parallel_tasks = true
file_watcher = "notify"
```

### 3. Task Definition

Define tasks using the `#[task]` attribute macro:

```rust
// src/tasks/mod.rs
use phenotype_forge::prelude::*;

#[task]
fn clean() {
    sh!("rm -rf target/ .forge/cache/");
}

#[task]
fn build() {
    sh!("cargo build --release");
}

#[task]
#[deps(build)]
fn test() {
    sh!("cargo test --all-features");
}

#[task]
#[deps(test)]
fn lint() {
    sh!("cargo clippy -- -D warnings");
}
```

### 4. Task Graph Execution

Execute the full task graph:

```bash
# Run all tasks (automatic dependency resolution)
forge run

# Run specific task
forge run test

# Run with verbose output
forge run --verbose build

# Dry run (show what would execute)
forge run --dry-run
```

### 5. Monitoring Progress

Watch task execution in real-time:

```bash
# With progress indicators
forge run --progress

# Watch mode (auto-rebuild on changes)
forge watch test

# JSON output for tooling integration
forge run --format json build
```

## Expected Output

```
$ forge run test

  Tasks Starting
  ├─ clean        queued
  ├─ build        queued (depends on: clean)
  └─ test         queued (depends on: build)

  Executing Tasks
  ├─ clean        running   [===] 100%  45ms
  ├─ build        running   [===] 100%  12.3s
  └─ test         running   [===] 100%  8.7s

  Summary
  ├─ clean        done      45ms
  ├─ build        done      12.3s
  ├─ test         done      8.7s
  └─ Total        21.0s (parallel factor: 6.8)
```

## Verification

Verify successful execution:

```bash
# Check exit codes
forge run test && echo "All tasks completed successfully"

# Validate artifacts exist
test -f target/release/my-app && echo "Binary built"

# Run with specific number of workers
forge run --workers 4 build
```

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Task hangs | Missing dependency | Add `#[deps(...)]` |
| Cache miss | File not tracked | Check `forge.toml` includes |
| OOM | Too many workers | Reduce `--workers` count |

### Debug Mode

```bash
# Enable debug logging
FORGE_LOG=debug forge run build

# Trace task execution
forge run --trace build
```

## Next Steps

- [Advanced Setup](./advanced-setup) - Production configuration
- [Metrics](../architecture/metrics) - Performance monitoring
