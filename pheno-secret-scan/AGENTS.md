# AGENTS.md — Onboarding for AI coding agents

Read this first; do not skim.

## Project structure

This crate is part of the **pheno-*** substrate family. Layout:

```
pheno-X/
├── Cargo.toml
├── src/lib.rs
├── src/<module>.rs
├── tests/
├── benches/         (where applicable)
├── fuzz/            (where applicable)
├── .github/workflows/{ci,deny,audit}.yml
├── .codespellrc, .editorconfig
├── CHANGELOG.md, CONTRIBUTING.md, SECURITY.md, LICENSE-MIT
└── README.md, AGENTS.md, CLAUDE.md, VERSION
```

## Build / test / lint commands

Per ADR-023 (device-fit), heavy work goes to a heavy runner. On the MacBook:

```bash
cargo build
cargo test --lib
cargo fmt --all -- --check
cargo clippy --lib -- -D warnings
```

On a heavy runner:

```bash
cargo test --workspace --all-features --locked
cargo bench --workspace
cargo fuzz run <target>
cargo +nightly miri run
```

## Conventions

- **Substrate quality bar (ADR-042B):** doc comments on every public item;
  `cargo clippy -- -D warnings` passes; tests cover at least 80% of statements.
- **No "random phenoShared" pattern (ADR-023 Rule 3):** no `shared/` or
  `utils/` directory; place reusable code in a new pheno-* crate.
- **Errors carry PHN-* codes (v23-T4):** every error enum variant has a
  stable code; `Display` is human-readable; `miette::Diagnostic` provides
  `code` + `help`.
- **Configuration is canonical (ADR-031):** read config via `pheno-config`.

## Cross-references

- ADR-023: device-fit (MacBook vs heavy-runner)
- ADR-031: Configra canonical config name
- ADR-040: test coverage gates per tier
- ADR-042B: substrate quality bar
- ADR-048: substrate graduation path
- `phenotype-tooling/templates/reusable-quality-gate.yml`: the CI gate
