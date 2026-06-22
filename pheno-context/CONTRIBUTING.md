# Contributing

Thanks for your interest in contributing to `pheno-*`! This document covers
the development workflow, code style, and review process.

## Development setup

Recommended: use the `pheno-flake-template` Nix flake (per ADR-039) for a
pinned, reproducible environment:

```bash
curl -fsSL https://raw.githubusercontent.com/phenotype/pheno-flake-template/main/adopt.sh | bash
nix develop
```

Without Nix:

```bash
cargo install cargo-audit cargo-deny cargo-nextest cargo-machete cargo-fuzz
rustup component add rustfmt clippy rust-analyzer
```

## Running tests

```bash
cargo test --workspace --all-features --locked    # on heavy runner (ADR-023)
cargo test --lib                                   # on MacBook
cargo test --doc
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
```

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `build:`, `ci:`.
Scope is encouraged (`feat(tracing): add OTLP exporter`).

## Pull request process

1. Fork and create a feature branch off `main`.
2. Ensure all CI checks pass locally.
3. Open a PR; the CI gate runs the full test matrix.
4. Wait for CODEOWNERS review (at least 1 approval).
5. Squash-merge once approved.

## Release process

See `docs/release-train.md` for the 6-week release cadence. Substrate
crates follow semver; breaking changes require a migration note in
`docs/migrations/`.
