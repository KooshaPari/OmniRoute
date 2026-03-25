# sharecli

Shared CLI process manager for multi-project agent orchestration.

## Stack

- Language: Rust
- Build: Cargo

## Development

```bash
cargo build
cargo test
cargo clippy
```

## Phenotype Org Rules

- UTF-8 encoding only in all text files. No Windows-1252 smart quotes or special characters.
- Worktree discipline: canonical repo stays on `main`; feature work in worktrees.
- CI completeness: fix all CI failures on PRs, including pre-existing ones.
- Never commit agent directories (`.claude/`, `.codex/`, `.gemini/`, `.cursor/`).
