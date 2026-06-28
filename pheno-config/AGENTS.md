# AGENTS.md — Onboarding for AI coding agents

This file is the model-facing entry point for AI coding agents working on
`pheno-*` substrate crates. Read this first; do not skim.

## Project structure

This crate is part of the **pheno-*** substrate family — the canonical
low-level building blocks for the Phenotype fleet. Every pheno-* crate
follows the same layout:

```
pheno-X/
├── Cargo.toml              # single crate, single package
├── src/
│   ├── lib.rs              # public API + module declarations
│   ├── <module>.rs         # one module per major concern
│   └── tests/              # integration tests
├── tests/                  # additional integration tests
├── benches/                # criterion benchmarks (where applicable)
├── fuzz/                   # cargo-fuzz targets (where applicable)
├── examples/               # runnable examples (where applicable)
├── docs/                   # design notes (not user-facing)
├── .github/workflows/      # CI: ci.yml, deny.yml, audit.yml, scorecard.yml
├── .codespellrc            # codespell config
├── .editorconfig           # per-language formatting
├── CHANGELOG.md            # keep-a-changelog format
├── CONTRIBUTING.md         # dev setup + PR process
├── LICENSE-MIT             # MIT license (this repo)
├── LICENSE-APACHE          # Apache 2.0 license (dual-licensed)
├── SECURITY.md             # security reporting policy
└── README.md               # quickstart + API overview
```

## Build / test / lint commands

Per ADR-023 (device-fit), heavy work goes to a heavy runner. On the MacBook:

```bash
cargo build                                    # always OK
cargo test --lib                               # always OK (no network, no integration)
cargo fmt --all -- --check                     # always OK
cargo clippy --lib -- -D warnings              # OK (one crate)
```

On a heavy runner:

```bash
cargo test --workspace --all-features --locked
cargo bench --workspace
cargo fuzz run <target>
cargo +nightly miri run
```

## Conventions

- **Substrate quality bar (ADR-042B):** every public item has doc comments;
  `cargo clippy -- -D warnings` passes; tests cover at least 80% of statements.
- **No "random phenoShared" pattern (ADR-023 Rule 3):** do not introduce a
  `shared/` or `utils/` directory; place reusable code in a new pheno-* crate.
- **Errors carry PHN-* codes (v23-T4):** every variant of an error enum has
  a stable code; the `Display` impl is human-readable; the `miette::Diagnostic`
  impl provides `code` + `help`.
- **Configuration is canonical (ADR-031):** the crate reads its config from
  `pheno-config`; do not roll a private config loader.

## Cross-references

- ADR-023: device-fit (MacBook vs heavy-runner)
- ADR-031: Configra canonical config name
- ADR-040: test coverage gates per tier (80% lib / 70% framework / 60% service)
- ADR-042B: substrate quality bar
- ADR-048: substrate graduation path (4-tier gate table)
- `phenotype-tooling/templates/reusable-quality-gate.yml`: the CI gate
