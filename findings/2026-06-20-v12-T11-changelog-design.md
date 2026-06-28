# v12 T11 — L67 CHANGELOG.md auto-generation design

**Date:** 2026-06-20
**Pillar:** L67 (Documentation — CHANGELOG auto-gen via git-cliff)
**Wave:** v12 71-pillar P0 remediation

## Tool

[`git-cliff`](https://git-cliff.org/) — single binary, no runtime deps, written in Rust.
Install: `cargo install git-cliff` (or `brew install git-cliff`).

## Why git-cliff (vs alternatives)

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| git-cliff | Single binary, TOML config, template-able, tag-aware | None for our use | **CHOSEN** |
| release-please | GitHub-native, no config | Opinionated about version bumping, hides commit history | No |
| semantic-release | Polyglot, conventional commits native | Heavy (node), more moving parts | No |
| Hand-written | Maximum control | Drift, stale, the problem we're solving | No |

## 5 fleet adopters

1. `pheno` (core, gates everything)
2. `pheno-errors`
3. `pheno-flags`
4. `pheno-port-adapter`
5. `pheno-tracing`

Order rationale: `pheno` is the substrate canonical, sets the convention; the
other 4 are leaf crates that consume the convention.

## Migration steps

For each adopter:

1. `cp ../../phenotype-apps/cliff.toml ./`
2. Append `CHANGELOG.md` to `.gitignore`
3. `cp ../../phenotype-apps/.github/workflows/changelog.yml ./.github/workflows/`
4. `git tag v0.1.0` to bootstrap the unreleased section
5. Open a one-off PR titled `chore: enable git-cliff CHANGELOG auto-gen (L67)`

## Acceptance criteria

- [x] `cliff.toml` present at monorepo root (52 lines, conventional commits parser)
- [x] `.github/workflows/changelog.yml` runs on `v*` tag push
- [x] 5 adopter repos identified and ordered
- [x] Convention doc at `docs/conventions/changelog-convention.md`
- [x] `CHANGELOG.md` is gitignored (regenerated, not stored)

## Effort estimate

- Authoring: 30 min (done)
- 5 adopter PRs: ~10 min each (1-hour wall, sequential)
- Verification (first tag release): 1 hour

Total: ~2 hours wall.
