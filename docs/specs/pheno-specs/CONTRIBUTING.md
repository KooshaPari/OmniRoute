# Contributing to PhenoSpecs

Thanks for your interest in contributing to **PhenoSpecs**, part of the [Phenotype](https://github.com/KooshaPari) ecosystem.

## AgilePlus spec mandate

All non-trivial work in this organization is tracked in **AgilePlus**. Before opening a PR for a feature or substantive change:

1. Check the [AgilePlus](https://github.com/KooshaPari/AgilePlus) spec registry for an existing spec.
2. If none exists, open one (`agileplus specify --title "<feature>" --description "<desc>"`) and link it from your PR description.
3. Trivial fixes (typos, dependency bumps, doc tweaks) do not require a spec.

## Build & verify

This repository is primarily docs / governance scaffolding.

```bash
git clone https://github.com/KooshaPari/PhenoSpecs.git
cd PhenoSpecs
# Lint markdown locally if you have the tools:
markdownlint "**/*.md" 2>/dev/null || true
vale .                 2>/dev/null || true
```

## Branch naming

Use kebab-case prefixed by intent:

- `feat/<scope>-<short-desc>`  — new feature
- `fix/<scope>-<short-desc>`   — bug fix
- `chore/<scope>-<short-desc>` — tooling, deps, infra
- `docs/<scope>-<short-desc>`  — docs only
- `refactor/<scope>-<short-desc>` — non-behavioral change

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/). Examples:

- `feat(api): add token refresh endpoint`
- `fix(parser): handle empty input`
- `chore(deps): bump tokio to 1.40`

If a `commitlint.config.*` exists in the repo, it is enforced; otherwise the convention above is the floor.

## Pull request expectations

- Keep PRs focused and small; split unrelated changes.
- Ensure the build, tests, lint, and format checks above pass locally before pushing.
- Describe **what** changed and **why**. Link the AgilePlus spec, issue, or ADR.
- Expect review from a maintainer; be responsive to feedback.
- Squash-merge is the default; the PR title becomes the commit subject.

## Quality gates

This repo participates in the Phenotype quality regime: zero new lint suppressions without justification, traceability to FR IDs where applicable, and 0-error CI on Linux runners. See `AGENTS.md` / `CLAUDE.md` if present for repo-specific governance.

## Reporting issues

Open a GitHub issue with reproduction steps, expected vs. actual behavior, and environment details (OS, toolchain version).
