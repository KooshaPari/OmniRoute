# CHANGELOG.md auto-generation convention (v12 T11 / L67)
# Date: 2026-06-20
# Pillar: L67 (Documentation — CHANGELOG auto-gen via git-cliff)

## Overview

All fleet repos that publish releases use [git-cliff](https://git-cliff.org/) to
auto-generate `CHANGELOG.md` from conventional commits. The config lives at
`./cliff.toml` in the monorepo root and is symlinked (or vendored) into each
adopter repo.

## The 5 commit types

| Type | Section in CHANGELOG | Triggers minor bump |
|------|----------------------|---------------------|
| `feat` | ✨ Features | YES |
| `fix` | 🐛 Bug Fixes | NO |
| `refactor` | 📦 Refactoring | NO |
| `perf` | ⚡ Performance | NO |
| `docs` / `test` / `chore` / `ci` / `build` | (skipped or grouped) | NO |

`BREAKING CHANGE:` in the commit body → major bump.

## The `[unreleased]` section

Commits since the last tag accumulate under `## [unreleased]`. A new tag
triggers git-cliff to collapse them into `## [vX.Y.Z] - YYYY-MM-DD`.

## Tag-triggered workflow

`.github/workflows/changelog.yml` runs on push of tags matching `v*`:
1. Installs git-cliff (`taiki-e/install-action`)
2. Runs `git-cliff --tag ${TAG} --output CHANGELOG.md`
3. Commits `CHANGELOG.md` back with `[skip ci]`
4. Posts a job summary with the new section headings

## Adopter list (5 fleet repos)

1. `pheno` (core)
2. `pheno-errors`
3. `pheno-flags`
4. `pheno-port-adapter`
5. `pheno-tracing`

## Migration steps per adopter

1. Copy `cliff.toml` from monorepo root
2. Add `.gitignore` entry: `CHANGELOG.md`
3. Copy `.github/workflows/changelog.yml`
4. Tag `v0.1.0` to bootstrap
5. Verify next `feat:` commit shows under `## [unreleased]`
