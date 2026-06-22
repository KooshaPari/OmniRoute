# Contributing

Thanks for your interest in contributing to `pheno-*`! This document covers
the development workflow, code style, and review process.

## Development setup

This crate uses the standard Rust toolchain (1.81+) plus a few extra tools.
The recommended way to get a pinned, reproducible environment is the
`pheno-flake-template` Nix flake (per ADR-039):

```bash
curl -fsSL https://raw.githubusercontent.com/phenotype/pheno-flake-template/main/adopt.sh | bash
nix develop
```

If you do not have Nix, install the following:

```bash
cargo install cargo-audit cargo-deny cargo-nextest cargo-machete cargo-fuzz
rustup component add rustfmt clippy rust-analyzer
```

## Running tests

```bash
cargo test --workspace --all-features --locked
cargo test --doc
cargo bench --workspace             # only on a heavy runner (per ADR-023)
cargo fuzz run <target>             # only on a heavy runner
cargo +nightly miri run             # only on a heavy runner
```

## Code style

- `cargo fmt --all` (CI enforces)
- `cargo clippy --workspace --all-targets -- -D warnings` (CI enforces)
- 80-column soft limit (allow overflow for tables, URLs, long type names)
- Doc comments on every public item

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` for new features
- `fix:` for bug fixes
- `chore:` for maintenance
- `docs:` for documentation only
- `refactor:` for code changes that neither fix a bug nor add a feature
- `test:` for test additions or fixes
- `build:` for build system changes
- `ci:` for CI configuration changes

Scope is optional but encouraged (`feat(tracing): add OTLP exporter`).

## Pull request process

1. Fork the repo and create a feature branch off `main`.
2. Make your changes; ensure all CI checks pass locally.
3. Open a PR; the CI gate runs the full test matrix.
4. Wait for CODEOWNERS review (at least 1 approval required).
5. Squash-merge once approved; the commit message becomes the changelog entry.

## Release process

See `docs/release-train.md` for the 6-week release cadence. Substrate crates
follow semver; breaking changes require a migration note in `docs/migrations/`.

