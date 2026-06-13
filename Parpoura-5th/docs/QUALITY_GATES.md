# 9-Gate Quality System

The quality gate system enforces code quality through 9 sequential checks. Each gate validates a specific aspect of code quality, from basic syntax to dependency security.

## Gate Overview

| Gate | Name | Tools | Threshold | Fail Behavior |
|------|------|-------|-----------|---------------|
| 1 | Syntax Validation | python3 ast, node --check, go build, bash -n | Zero errors | Blocking |
| 2 | Linting | ruff, oxlint/eslint, golangci-lint, shellcheck, clippy | Zero errors | Blocking |
| 3 | Type Safety | ty/mypy/pyright, tsc, go vet | Zero errors | Blocking |
| 4 | Tests | pytest, vitest/jest, go test, cargo test | All pass | Blocking |
| 5 | Coverage | pytest-cov, go test -cover | >=80% | Blocking |
| 6 | Security | bandit, gosec, gitleaks, npm audit | Zero high/critical | Blocking |
| 7 | Complexity | radon, ruff C901, gocyclo | CC<=10, Cog<=15 | Blocking |
| 8 | Duplication | jscpd | <5% | Blocking |
| 9 | Dependencies | pip-audit, npm audit, govulncheck, cargo-audit | Zero vulnerabilities | Blocking |

## Gate Details

### Gate 1: Syntax Validation (Fast-Fail)

Catches parse errors before any other analysis runs.

- **Python**: `ast.parse()` on each changed `.py` file
- **JavaScript/TypeScript**: `node --check` on each changed file
- **Go**: `go build ./...` for compile errors
- **Rust**: `cargo check` for compile errors
- **Shell**: `bash -n` for syntax validation

**Fix**: Correct the syntax error shown in the output.

### Gate 2: Linting

Enforces code style and catches common mistakes.

| Language | Tool | Config |
|----------|------|--------|
| Python | ruff | `ruff.toml` or `pyproject.toml` |
| JS/TS | oxlint (preferred) or eslint | `oxlintrc.json` or `.eslintrc` |
| Go | golangci-lint | `.golangci.yml` |
| Shell | shellcheck | `.shellcheckrc` |
| Rust | clippy | `clippy.toml` |

**Fix**: Run `ruff check --fix`, `oxlint --fix`, or the appropriate fixer.

### Gate 3: Type Safety

Static type analysis to catch type errors before runtime.

| Language | Tool | Config |
|----------|------|--------|
| Python | ty (preferred), mypy, pyright | `ty-config.toml`, `mypy.ini` |
| TypeScript | tsc | `tsconfig.json` |
| Go | go vet | Built-in |

**Fix**: Add type annotations, fix type mismatches, or update type stubs.

### Gate 4: Tests

Runs the project test suite.

| Language | Tool | Command |
|----------|------|---------|
| Python | pytest | `pytest -q --tb=short` |
| JS/TS | vitest or jest | `npx vitest run` or `npx jest` |
| Go | go test | `go test ./... -count=1` |
| Rust | cargo test | `cargo test --quiet` |

**Fix**: Fix failing tests. Do not skip or disable them.

### Gate 5: Coverage (>=80%)

Ensures adequate test coverage. Threshold is configurable in `quality-gate.yml`.

| Language | Tool | Report |
|----------|------|--------|
| Python | pytest-cov | `--cov --cov-report=term-missing` |
| Go | go test -cover | Built-in |

**Fix**: Add tests for uncovered code paths. Focus on critical business logic first.

### Gate 6: Security

Multi-layer security scanning.

| Layer | Tool | Scope |
|-------|------|-------|
| Secrets | gitleaks | All files (detects API keys, passwords) |
| SAST | bandit (Python), gosec (Go) | Source code analysis |
| Audit | npm audit | Node dependency vulnerabilities |

**Fix**: Remove secrets from code (use env vars), fix SAST findings, update vulnerable deps.

### Gate 7: Complexity (CC<=10, Cognitive<=15)

Prevents overly complex functions that are hard to test and maintain.

| Metric | Max | Tool |
|--------|-----|------|
| Cyclomatic complexity | 10 | radon (Python), gocyclo (Go) |
| Cognitive complexity | 15 | ruff C901 (Python) |
| Function length | 40 lines | Per-language |

**Fix**: Extract helper functions, reduce nesting, simplify conditionals.

### Gate 8: Duplication (<5%)

Detects copy-paste code that should be refactored.

- **Tool**: jscpd (language-agnostic)
- **Min detection**: 5 lines / 50 tokens
- **Threshold**: 5% of codebase

**Fix**: Extract shared logic into functions or modules. Do not create premature abstractions for <3 occurrences.

### Gate 9: Dependencies

Scans for known vulnerabilities in project dependencies.

| Language | Tool | Scope |
|----------|------|-------|
| Python | pip-audit | PyPI vulnerability database |
| Node | npm audit | npm advisory database |
| Go | govulncheck | Go vulnerability database |
| Rust | cargo-audit | RustSec advisory database |

**Fix**: Update vulnerable dependencies. Pin versions if update breaks compatibility.

## Configuration

### quality-gate.yml

Place in project root to override defaults:

```yaml
thresholds:
  coverage: 80
  cyclomatic_complexity: 10
  cognitive_complexity: 15
  max_function_lines: 40
  duplication_pct: 5
  timeout_per_gate: 60
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `QUALITY_GATE_CONFIG` | `./quality-gate.yml` | Config file path |
| `QUALITY_GATE_FAIL_FAST` | `false` | Stop on first failure |
| `QUALITY_GATE_VERBOSE` | `false` | Show PASS gates |
| `QUALITY_GATE_ALL_FILES` | `false` | Check all files, not just changed |
| `PROJECT_DIR` | Git root | Project root directory |

## Usage

```bash
# Run all gates (changed files only)
./scripts/quality/quality-gate.sh

# Run all gates on all files
QUALITY_GATE_ALL_FILES=true ./scripts/quality/quality-gate.sh

# Fail fast on first gate failure
QUALITY_GATE_FAIL_FAST=true ./scripts/quality/quality-gate.sh

# Verbose output
QUALITY_GATE_VERBOSE=true ./scripts/quality/quality-gate.sh
```

## Integration

### Taskfile

```yaml
tasks:
  quality:
    desc: Run 9-gate quality system
    cmds:
      - ./scripts/quality/quality-gate.sh
  quality:all:
    desc: Run 9-gate quality system on all files
    env:
      QUALITY_GATE_ALL_FILES: "true"
    cmds:
      - ./scripts/quality/quality-gate.sh
```

### Pre-push Hook

```bash
#!/bin/bash
./scripts/quality/quality-gate.sh || exit 1
```

### CI Pipeline

```yaml
quality-gate:
  script:
    - QUALITY_GATE_ALL_FILES=true ./scripts/quality/quality-gate.sh
```
