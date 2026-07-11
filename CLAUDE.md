# CLAUDE.md — nanovms

Extends parent governance. See:
- Global baseline: `~/.claude/CLAUDE.md`
- Phenotype root: `/Users/kooshapari/CodeProjects/Phenotype/repos/CLAUDE.md`
- AgilePlus mandate: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus`
- Local agent guidance: `AGENTS.md`

## Project Overview

- **Name:** nanovms
- **Description:** Go-based NanoVM Service runtime and CLI for 3-tier isolation (WASM, gVisor, Firecracker)
- **Language Stack:** Go 1.23+; Node.js only for VitePress docs tooling
- **Key Areas:** `cmd/`, `go/`, `sdk/`, `api/`, `docs/`, `tests/`, `.github/workflows/`
- **Status:** Active

## AgilePlus Mandate

All work MUST be tracked in AgilePlus:
- CLI: `cd /Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus && agileplus <command>`
- Check for existing specs before implementing
- Create spec for new work: `agileplus specify --feature <feature>`
- No code without corresponding AgilePlus spec

## Repository Layout

- `cmd/` — CLI entrypoints
- `go/` — Go runtime/library code
- `sdk/` — shared SDK/client helpers
- `api/` — API contracts and generated surfaces
- `docs/` — VitePress docs and reference material
- `tests/` — test fixtures and integration coverage
- `.github/workflows/` — CI and security workflows
- `scripts/` — repository automation

## Quality Checks

From this repository root:

```bash
# Format Go code
go fmt ./...

# Static checks
go vet ./...

# Linting (if installed)
golangci-lint run ./...

# Testing
go test ./...
go test -race ./...

# Build
go build ./...

# Docs
npm run docs:build
```

## Worktree & Git Discipline

- Feature work uses repo-specific worktrees: `repos/nanovms-wtrees/<topic>/`
- Canonical repo stays on `main` except during explicit merge operations
- All feature branches are temporary; integrate via pull request or squash commit

## Related Documents

- `README.md` — project overview and quick start
- `SPEC.md` — system specification and architecture notes
- `PLAN.md` — implementation plan
- `ADR.md` — architecture decisions
- `AGENTS.md` — agent-facing repository guidance
- `CHANGELOG.md` — version history
- `package.json` — docs tooling and VitePress scripts

---

For CI, scripting language hierarchy, and other policies, see the canonical sources listed above.
