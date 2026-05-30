# CLAUDE.md — phenotype-hub

Extends parent governance. See the following for canonical definitions:
- **Global baseline:** `~/.claude/CLAUDE.md`
- **Phenotype root:** `/Users/kooshapari/CodeProjects/Phenotype/repos/CLAUDE.md`
- **AgilePlus mandate:** `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus`
- **Governance reference:** `AGENTS.md` (local, this repository)

## Project Overview

- **Name:** phenotype-hub
- **Description:** Phenotype org hub scaffold for governance, repository
  discovery, and future service-routing decisions
- **Location:** `/Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-hub`
- **Language Stack:** Governance/docs scaffold; implementation stack not yet
  populated
- **Status:** Active scaffold

## AgilePlus Mandate

All work MUST be tracked in AgilePlus:
- CLI: `cd /Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus && agileplus <command>`
- Check for existing specs before implementing
- Create spec for new work: `agileplus specify --title "<feature>" --description "<desc>"`
- No code without corresponding AgilePlus spec

## Quality Checks

From this repository root:
```bash
# Linting and formatting (adjust for project language)
cargo clippy --workspace -- -D warnings
cargo fmt --check

# Testing
cargo test --workspace

# Documentation validation
vale docs/
```

## Worktree & Git Discipline

- Feature work uses repo-specific worktrees: `repos/[PROJECT]-wtrees/<topic>/`
- Canonical repo stays on `main` except during explicit merge operations
- All feature branches are temporary; integrate via pull request or squash commit
- See parent governance for non-destructive change protocol

## Cross-Project Reuse

During development, proactively identify code that is sharable across Phenotype repositories. Prefer extraction into existing shared modules; propose new shared packages when appropriate.

## Related Documents

- `AGENTS.md` — Local agent contract and operating loop
- `FUNCTIONAL_REQUIREMENTS.md` — Functional requirements and test traceability (if present)
- `docs/worklogs/README.md` — Work audit and decision log
- Parent `README.md` — Project-specific documentation

---

For CI, scripting language hierarchy, and other policies, see the canonical sources listed above.
