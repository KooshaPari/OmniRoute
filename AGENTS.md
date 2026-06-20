# AGENTS.md — sharecli

Extends shelf-level AGENTS.md rules for sharecli.

## Project Identity

- **Name**: sharecli
- **Language**: Rust

## Relationship with thegent-sharecli

[`thegent-sharecli`](https://github.com/KooshaPari/thegent-sharecli) was a
separate Python-based project that explored CLI share/directory functionality
for multi-agent orchestration. **It is now archived** (public, read-only).

Sharecli (this repo) is the active Rust implementation for process management.
`thegent-sharecli` was an earlier Python prototype with a different scope
(command deduplication, task queue, coordination) and a different architecture.
There is no code or dependency relationship between the two repos.

### Boundary

| Aspect | sharecli (this repo) | thegent-sharecli (archived) |
|--------|----------------------|-----------------------------|
| Status | **Active** | **Archived** |
| Language | Rust | Python |
| Purpose | Process management, pooling, resource limits | CLI share / dedup / coordination |
| Architecture | ProcessPool, SharedRuntime, ResourceManager | Ports & Adapters (Hexagonal) |
| Dependency | substrate, sysinfo, tokio | Independent (no shared deps) |

## Project-Specific Rules

### Test-First Mandate

- **For NEW modules**: test file MUST exist before implementation file
- **For BUG FIXES**: failing test MUST be written before the fix
- **For REFACTORS**: existing tests must pass before AND after

### Quality Gates

All PRs must pass:
- Format check
- Linting
- Tests
- Type checking (if applicable)

### Commit Messages

Format: `<type>(<scope>): <description>`

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`

## Naming Conventions

- Types: `PascalCase`
- Functions/methods: `snake_case`
- Constants: `SCREAMING_SNAKE_CASE`
- Modules: `snake_case`

## Error Handling

- Use language-appropriate error handling patterns
- Never use unwrap/expect in production code
- Log all errors with structured logging
