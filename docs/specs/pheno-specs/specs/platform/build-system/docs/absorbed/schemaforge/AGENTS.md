// =============================================================================
// PHENO AGENTS.md - Template for all Phenotype Projects
// =============================================================================
// This is the base AGENTS.md that all Phenotype projects extend.
// Copy to your project and customize the project-specific sections.
//
// =============================================================================

# AGENTS.md — Project Name

Extends: `phenotype-governance/AGENTS.md`

---

## Project Identity

| Field | Value |
|-------|-------|
| **Name** | PROJECT_NAME |
| **Description** | PROJECT_DESCRIPTION |
| **Language** | PRIMARY_LANGUAGE |
| **Location** | `/Users/kooshapari/CodeProjects/Phenotype/repos/PROJECT_NAME` |
| **Language Stack** | Rust/Python/Go/TypeScript (edition 2021) |
| **Published** | Internal / crates.io / npm |

---

## AgilePlus Integration

All work MUST be tracked in AgilePlus:

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/.agileplus
agileplus <command>
```

**Requirements**:

1. Check for AgilePlus spec before implementing
2. Create spec for new work: `agileplus specify --title "<feature>"`
3. Update work package status as work progresses
4. No code without corresponding AgilePlus spec

---

## Agent Expectations

### Primary Agent Selection

| Task type | Primary agent |
|-----------|---------------|
| Feature implementation | Forge |
| Code review | Muse |
| Bug investigation | Sage |
| Testing/runtime | Helios |
| Cross-project architecture | Forge + Sage |
| Research/investigation | Sage |
| Documentation | Forge (with Muse review) |

### Session Naming

Format: `<project>:<brief-task-description>`

Good: `PROJECT_NAME:auth-refactor`, `shelf:duplication-audit`
Bad: `fix`, `implementation`, `agent work`

---

## Quality Standards

### Code Quality Mandate

- **All linters must pass**: `cargo clippy --workspace -- -D warnings`
- **All tests must pass**: `cargo test --workspace`
- **No AI slop**: Avoid placeholder TODOs, lorem ipsum, generic comments
- **Backwards incompatibility**: No shims, full migrations, clean breaks

### Test-First Mandate

- **For NEW modules**: test file MUST exist before implementation file
- **For BUG FIXES**: failing test MUST be written before the fix
- **For REFACTORS**: existing tests must pass before AND after

### FR Traceability

All tests MUST reference a Functional Requirement (FR):

```rust
// Traces to: FR-XXX-NNN
#[test]
fn test_feature_name() {
    // Test body
}
```

---

## Project-Specific Rules

### Build Commands

```bash
# Run all quality checks
cargo test --workspace
cargo clippy --workspace -- -D warnings
cargo fmt --check

# Auto-format code
cargo fmt

# Build specific crate
cargo build -p <crate-name>
```

### Test Commands

```bash
# Run all tests
cargo test --workspace

# Run specific test
cargo test --package <crate-name> --lib <test_name>

# Run with coverage
cargo llvm-cov --workspace
```

### Documentation

```bash
# Build documentation
cargo doc --open

# Serve docs locally
cargo doc --serve
```

---

## Tool Chain

This project uses the following tools (from `phenotype-governance/configs/tools.toml`):

| Tool | Purpose | Config |
|------|---------|--------|
| clippy | Rust linter | `clippy.toml` |
| rustfmt | Rust formatter | `rustfmt.toml` |
| cargo-deny | Security advisories | `deny.toml` |
| typos | Spell checking | `_typos.toml` |
| semgrep | Security scanning | `.semgrep-rules/` |

---

## Code Review Protocol

### PR Requirements

1. One logical change per PR
2. PR title matches commit format
3. Description explains WHY, not just WHAT
4. Always link related issues

### Commit Messages

Format: `<type>(<scope>): <description>`

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`

Good: `feat(PROJECT_NAME): add token refresh with exponential backoff`
Bad: `fix stuff`, `update`, `WIP`

---

## Error Handling

### Rate Limits (429)

When encountering API rate limits:

1. Stop immediately — do not retry
2. Report the limit type to user
3. Wait for user instruction

### Crashes

If an agent crashes mid-task:

1. Save state to conversation
2. Report what was in progress
3. Wait for user or another agent to resume

---

## Onboarding

When starting work on this project:

1. Run `cargo test --workspace` to verify tests pass
2. Run `cargo clippy --workspace -- -D warnings` to verify no warnings
3. Run `cargo fmt -- --check` to verify formatting
4. Read `CLAUDE.md` for project-specific context

---

## Governance Reference

- Base rules: `platforms/thegent/governance/AGENTS.base.md`
- Tool registry: `phenotype-governance/configs/tools.toml`
- CI templates: `phenotype-governance/.github/workflows/`
- Pre-commit hooks: `phenotype-governance/hooks/pre-commit-config.yaml`
