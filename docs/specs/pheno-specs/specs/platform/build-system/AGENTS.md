# AGENTS.md - phenotype-forge

## Project Overview

- **Name**: phenotype-forge
- **Description**: CLI task runner and build orchestrator
- **Language**: Rust (edition 2021)
- **Type**: Standalone CLI product (NOT a library)
- **Location**: Phenotype repos shelf

## Features

- **Parallel Execution**: Run tasks concurrently with automatic topological sort
- **Dependency Graph**: Automatic resolution of task dependencies
- **Hot Reload**: Watch files and restart on changes
- **Plugin System**: Extend with custom task definitions

## Agent Rules

### Project-Specific Rules

1. **CLI Tool Focus**
   - This is a standalone CLI product, not a library
   - Keep `phenotype-` prefix as brand identifier
   - Focus on user experience and performance

2. **Task System**
   - Task functions use `#[task]` attribute
   - Dependencies declared with `#[deps(...)]`
   - Automatic dependency graph resolution

3. **Architecture**
   - Clean error handling with descriptive types
   - Structured logging for debugging
   - Configuration via TOML/YAML

### Phenotype Org Standard Rules

1. **UTF-8 encoding** in all text files
2. **Worktree discipline**: canonical repo stays on `main`
3. **CI completeness**: fix all CI failures before merging
4. **Never commit** agent directories (`.claude/`, `.codex/`, `.cursor/`)
5. **Branch naming**: `<type>/<description>`

## Quality Standards

```bash
# Build
cargo build

# Test
cargo test --all-features

# Lint
cargo clippy -- -D warnings

# Format
cargo fmt --check
```

## Git Workflow

1. Create feature branch: `git checkout -b feat/my-feature`
2. Implement task with tests
3. Ensure all checks pass
4. Create PR with usage examples
5. Publish on tag: `v*.*.*`
