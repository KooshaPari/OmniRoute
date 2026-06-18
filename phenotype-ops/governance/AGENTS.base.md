# AGENTS.md — Base Template for Phenotype Repos
# Copy to repo root and customize per-repo sections marked with ⚙️

## Identity

⚙️ **REPLACE:** One-line purpose of this repo in the fleet.

## Responsibilities

- ⚙️ **REPLACE:** Primary responsibility
- ⚙️ **REPLACE:** Secondary responsibility
- Consumes `phenotype/phenotype-ops` for CI, attestation, review

## Key Commands

```bash
# Build
⚙️ cargo build --release

# Test (fast)
⚙️ cargo nextest run

# Lint
⚙️ cargo clippy --all-targets --all-features -- -D warnings
⚙️ cargo fmt --all -- --check

# Manifest
phenotype-manifest generate --key ~/.ssh/manifest --output .manifest.signed.json
phenotype-manifest verify --manifest .manifest.signed.json
```

## Layout

```
⚙️ repo-root/
├── src/              # Source code
├── tests/            # Integration tests
├── benches/          # Benchmarks
├── Cargo.toml        # Manifest
├── lefthook.yml      # From phenotype-ops/governance/lefthook.yml
├── AGENTS.md         # This file
├── CLAUDE.md         # From phenotype-ops/governance/CLAUDE.base.md
├── deny.toml         # From phenotype-ops/templates/deny.toml
├── .github/
│   └── workflows/
│       └── ci.yml    # Consumes phenotype-ops workflows
└── target/           # Build artifacts (gitignored)
```

## Fleet Conventions

- **Commits:** Conventional + Signed-off-by (enforced by lefthook)
- **Branches:** `dev/*` → `alpha/*` → `beta/*` → `rc/*` → `stable/*` → `sunset/*`
- **Manifest:** Required on every push (pre-push hook)
- **Review:** Unified surface picks ONE backend per PR
- **Dependencies:** `deny.toml` from phenotype-ops, `cargo deny` in CI

## Testing

- Unit: `cargo nextest run --lib`
- Integration: `cargo nextest run --test integration`
- Bench: `cargo bench` (perf pillar)
- No `cargo test` — use `nextest`

## CI Contract

This repo's `.github/workflows/ci.yml` MUST:

```yaml
jobs:
  gate:
    uses: phenotype/phenotype-ops/.github/workflows/manifest-gate.yml@main
    with:
      fallback: warn   # warn|full|fail — org variable controls
```

## Local Overrides

Per-repo customization goes in:
- `CLAUDE.md` — Project context for agents
- `AGENTS.md` — This file (agent instructions)
- `deny.toml` — Dependency exceptions
- `.github/codespell-ignore.txt` — Spellcheck exceptions

## Troubleshooting

See `CLAUDE.md` Troubleshooting section.