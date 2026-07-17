# AGENTS.md — phenotype-validation-python

## Project Overview

- **Name**: phenotype-validation-python
- **Description**: Python implementation of Phenotype validation framework
- **Location**: `/Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-validation-python`
- **Language Stack**: Python
- **Published**: Internal (Phenotype ecosystem)

## Quick Start Commands

```bash
# Navigate to project
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-validation-python

# When implemented:
pip install -e ".[dev]"
pytest
ruff check .
```

## Architecture

```
phenotype-validation-python/
[Minimal/placeholder - check for pyproject.toml]
```

## Quality Standards

### Python Standards
- **Line length**: 100 characters
- **Formatter**: `ruff format` or `black`
- **Linter**: `ruff check`
- **Type checker**: `mypy`
- **Tests**: `pytest`

## Git Workflow

### Branch Naming
Format: `validation-py/<type>/<description>`

Examples:
- `validation-py/feat/schema-validation`
- `validation-py/fix/rule-engine`

## File Structure

```
phenotype-validation-python/
├── pyproject.toml            # If implemented
└── [Python source files]
```

## CLI Commands

```bash
# Standard Python workflow
pip install -e ".[dev]"
pytest
ruff check .
ruff format .
mypy .
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No pyproject.toml | Project is minimal/placeholder |
| Import errors | Check package structure |

## Dependencies

- **phenotype-validation-go**: Go equivalent
- **phenotype-validation-ts**: TypeScript equivalent
- **PhenoProc/phenotype-validation**: Related validation

## Agent Notes

When working in phenotype-validation-python:
1. Python equivalent of validation framework
2. Coordinate with other validation projects
3. Align with PhenoProc validation work
