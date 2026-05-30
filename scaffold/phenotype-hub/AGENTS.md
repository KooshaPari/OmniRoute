# AGENTS.md — phenotype-hub

This file governs work inside the phenotype-hub repository.

## Identity

phenotype-hub is the Phenotype org hub scaffold for governance, repository
discovery, future service-routing decisions, and cross-project coordination.

Do not apply parent shelf instructions (`/Users/kooshapari/CodeProjects/Phenotype/repos/AGENTS.md`) unless explicitly referenced. Work from this directory and treat paths as local to phenotype-hub.

## Required Operating Loop

1. Check AgilePlus for existing specs before implementation
2. Research code and tests before editing
3. Keep changes scoped to a single feature or bug fix
4. Validate with quality-gate checks (see below)
5. Do not leave incomplete work or stub implementations

## Canonical Surfaces

- **Spec tracking:** AgilePlus at `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus`
- **Work audit:** `docs/worklogs/README.md`
- **Quality gates:** See `Governance Reference` below
- **Build/test:** See project-specific targets (Makefile, Cargo.toml, package.json, etc.)

## Quality Rules

### Linting & Formatting

All code MUST pass linting and formatting checks before commit:
- Run linters and formatters locally (see CLAUDE.md for commands)
- Fix errors; do not suppress or ignore warnings
- Commit all formatting changes before feature changes

### Testing & Specification Traceability

- All tests MUST reference a Functional Requirement (FR) if FUNCTIONAL_REQUIREMENTS.md exists
- Every FR MUST have at least 1 test
- Run tests locally and verify pass before pushing

### Documentation

- Use Vale for Markdown validation where available
- Keep docs organized per global structure: `docs/guides/`, `docs/reports/`, `docs/research/`, `docs/reference/`, `docs/checklists/`
- Never create `.md` files at root level (except `README.md`, `CLAUDE.md`, `AGENTS.md`)

## Governance Reference

- **Global baseline:** `~/.claude/CLAUDE.md` (Dependency preferences, Prose quality, Context management, Failure behavior)
- **Phenotype-org scripting:** `repos/docs/governance/scripting_policy.md` (Rust default; no new shell)
- **CI/GitHub Actions:** See parent CLAUDE.md (billing constraint; skip macOS/Windows runners)
- **Git discipline:** Phenotype Git and Delivery Workflow Protocol (parent CLAUDE.md)
- **Child agents & delegation:** See parent CLAUDE.md (prefer subagents for multi-file work)

## Worktree Pattern

- **Feature work:** Use repo worktrees at `repos/[PROJECT]-wtrees/<topic>/`
- **Canonical repo:** Always on `main` except during merge operations
- **No feature branches in canonical:** All work isolated in worktrees until integration

## Integration & Handoff

When feature work is complete:
1. Ensure all tests pass and quality gates are clean
2. Create a pull request or squash-commit to `main`
3. Update AgilePlus work package status
4. Archive worktree or keep for reference

---

**Parent contract:** See `AGENTS.md` at `/Users/kooshapari/CodeProjects/Phenotype/repos/AGENTS.md` for cross-project agent coordination and parent shelf governance.
