# pheno-flake-template

Nix flake template for Phenotype substrate (pheno-*) crate development
environments. Part of ADR-039 (pheno-flake refresh template).

## Why

Per ADR-039 and ADR-023 (device-fit), the MacBook is for planning + small focused
PRs. Heavy work (`cargo test --workspace`, `cargo bench --workspace`, fuzzing,
MIR interpreter) goes to a heavy runner. The trouble: the MacBook and the
heavy runner have **different toolchain versions**, which causes "works for me"
bugs that only show up on the runner.

**Solution:** ship a pinned Nix flake so the MacBook (with Nix installed) and
the heavy runner use the *exact same* Rust toolchain, OS packages, and CI
tooling. Same commit hash on `Cargo.lock` → same compiled binary on both.

## What's included

| Tool | Version | Purpose |
|------|---------|---------|
| Rust | 1.81.0 (stable) | The actual compiler |
| `rustfmt` | 1.81.0 | Code formatting |
| `clippy` | 1.81.0 | Lints |
| `rust-analyzer` | 1.81.0 | IDE support |
| `cargo-audit` | latest | CVE scanning |
| `cargo-deny` | latest | License + supply chain |
| `cargo-outdated` | latest | Dep version drift |
| `cargo-udeps` | latest | Unused dep detection |
| `cargo-machete` | latest | Same, faster |
| `cargo-bloat` | latest | Binary size |
| `cargo-nextest` | latest | 2-3x faster test runner |
| `cargo-mutants` | latest | Mutation testing |
| `cargo-fuzz` | latest | libFuzzer integration |
| `cargo-miri` | latest | MIR interpreter for unsafe |
| `mdbook` | latest | Doc site generator |
| `act` | latest | Run GitHub Actions locally |
| `actionlint` | latest | GH Actions workflow lint |
| `shellcheck` | latest | Shell script lint |

All pinned via `flake.lock` (commit hash). Once you run `nix develop` the
first time, the lock is committed and the environment is reproducible.

## Usage

```bash
# In a pheno-* repo:
nix develop                    # enter the dev shell
cargo test --workspace         # now uses the pinned toolchain

# One-shot command without entering the shell:
nix develop -c cargo test

# Update the lock (e.g., to pick up a new cargo-audit version):
nix flake update
git add flake.lock
git commit -m "chore: bump nix flake lock"
```

## Adoption

Per ADR-039, every pheno-* crate SHOULD adopt this flake. The adoption
script (`adopt.sh` in this repo) automates the boilerplate:

```bash
# From the root of a pheno-* crate:
curl -fsSL https://raw.githubusercontent.com/phenotype/pheno-flake-template/main/adopt.sh | bash
```

This copies the flake to `.`, generates a default `devShells.default` for the
crate's specific dependencies, and runs `nix flake lock` to produce the initial
`flake.lock`.

## See also

- ADR-039 (pheno-flake refresh template) — the canonical decision
- ADR-023 (device-fit) — why the MacBook + heavy runner split exists
- ADR-042B (substrate quality bar) — the gates this environment helps enforce
- `phenotype-tooling/templates/reusable-quality-gate.yml` — the CI side
- `pheno-ci-templates/` — the GitHub Actions workflows that mirror this
