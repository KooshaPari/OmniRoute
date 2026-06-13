# CLAUDE.md — Phenotype Repo Template

This is the shared governance template. Each Phenotype repository's
`CLAUDE.md` references this template and adds a short repo-specific addendum
that names the project, its stack, and any deviations from the baseline.

## Canonical References

This file extends parent governance. See the following for canonical definitions:
- **Global baseline:** `~/.claude/CLAUDE.md`
- **Phenotype root:** `/Users/kooshapari/CodeProjects/Phenotype/repos/CLAUDE.md`
- **AgilePlus mandate:** `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus`
- **Governance reference:** `AGENTS.md` (local, repository-specific)
- **Shared template:** `repos/docs/governance/CLAUDE_TEMPLATE.md`

## Project Overview

This template applies to a Phenotype-org repository. Each repo's `CLAUDE.md`
addendum fills in:
- **Name** — repository name
- **Description** — one-line purpose
- **Location** — absolute path under `/Users/kooshapari/CodeProjects/Phenotype/repos/`
- **Language Stack** — primary language(s) and tooling
- **Status** — `Active` / `Active scaffold` / `Archived` / `Experimental`

## AgilePlus Mandate

All work MUST be tracked in AgilePlus:
- Reference: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus`
- CLI: `cd /Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus && agileplus <command>`
- Check for existing specs before implementing
- Create spec for new work: `agileplus specify --title "<feature>" --description "<desc>"`
- Update work package status: `agileplus status <feature-id> --wp <wp-id> --state <state>`
- No code without corresponding AgilePlus spec

## Quality Checks

From the repository root, the language-appropriate baseline is:

```bash
# Linting and formatting (Rust baseline; adapt per stack)
cargo clippy --workspace -- -D warnings
cargo fmt --check

# Testing
cargo test --workspace

# Documentation validation
vale docs/
```

For non-Rust repos, replace the commands with the equivalent for the stack
(`go build ./... && go test ./... && golangci-lint run`, `pnpm test && pnpm lint`,
`pytest && ruff check`, etc.). State the actual commands in the addendum.

## Worktree & Git Discipline

- Feature work uses repo-specific worktrees: `repos/<project>-wtrees/<topic>/`
- Canonical repo stays on `main` except during explicit merge operations
- All feature branches are temporary; integrate via pull request or squash commit
- See parent governance for the non-destructive change protocol
- Never use `git reset --hard` against shared branches
- Commit in provenance batches when multiple actors share a worktree

## Cross-Project Reuse

During development, proactively identify code that is sharable across
Phenotype repositories. Prefer extraction into existing shared modules;
propose new shared packages when appropriate. See the Phenotype Org
Cross-Project Reuse Protocol in `~/.claude/CLAUDE.md`.

## Related Documents

- `AGENTS.md` — Local agent contract and operating loop
- `FUNCTIONAL_REQUIREMENTS.md` — Functional requirements and test traceability (if present)
- `docs/worklogs/README.md` — Work audit and decision log
- Parent `README.md` — Project-specific documentation

---

For CI, scripting language hierarchy, design system (Impeccable), and other
policies, see the canonical sources listed above.
