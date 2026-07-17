# AGENTS.md — phenotype-validation-go

## Project Overview

- **Name**: phenotype-validation-go
- **Description**: Go implementation of Phenotype validation framework
- **Location**: `/Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-validation-go`
- **Language Stack**: Go
- **Published**: Internal (Phenotype ecosystem)

## Quick Start Commands

```bash
# Navigate to project
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-validation-go

# When go.mod present:
go mod tidy
go build ./...
go test ./...
```

## Architecture

```
phenotype-validation-go/
[Minimal/placeholder - check for go.mod]
```

## Quality Standards

### Go Standards
- **Line length**: 100 characters
- **Formatter**: `gofmt`, `goimports`
- **Linter**: `golangci-lint`
- **Tests**: `go test ./...`

## Git Workflow

### Branch Naming
Format: `validation-go/<type>/<description>`

Examples:
- `validation-go/feat/schema-validator`
- `validation-go/fix/error-messages`

## File Structure

```
phenotype-validation-go/
├── go.mod                    # If implemented
├── go.sum                    # Dependencies
└── [Go source files]
```

## CLI Commands

```bash
# Standard Go workflow
go mod tidy
go build ./...
go test ./...
go vet ./...
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No go.mod | Project is minimal/placeholder |
| Import errors | Check module path |

## Dependencies

- **phenotype-validation-python**: Python equivalent
- **phenotype-validation-ts**: TypeScript equivalent
- **PhenoProc/phenotype-validation**: Related validation

## Agent Notes

When working in phenotype-validation-go:
1. Go equivalent of validation framework
2. Coordinate with other validation projects
3. Align with PhenoProc validation work
