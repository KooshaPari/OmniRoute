# SSOT — Single Source of Truth (focalpoint)

This document records the canonical authority for cross-cutting facts in the
focalpoint repository. When a fact conflicts across docs, the source listed
here wins.

## Scope

| Domain | Authoritative source |
| --- | --- |
| Build & test commands | `justfile` (root) and per-crate `Cargo.toml` |
| Release & versioning | `cliff.toml` + `CHANGELOG.md` (git-cliff generated) |
| Security disclosure process | `SECURITY.md` |
| Dependency updates | `.github/dependabot.yml` |
| Branch & commit policy | `.github/workflows/governance.yml` |
| Repository health score | `.github/workflows/scorecard.yml` (OpenSSF) |
| Editor / formatting baseline | `.editorconfig` |
| Workspace architecture | `ARCHITECTURE.md` (per-crate breakdown) |
| Agent operating model | `AGENTS.md` |

## Precedence order

1. Executable config (workflows, `justfile`, `Cargo.toml`, `deny.toml`) — observed behavior.
2. `*.md` governance files in this SSOT table.
3. `ARCHITECTURE.md` crate-level contracts.
4. Anything else.

## Updating this file

- Keep the table narrow and unambiguous.
- Cite the canonical file by path; do not duplicate content.
- Update via a `chore(governance):` commit referencing the change.
