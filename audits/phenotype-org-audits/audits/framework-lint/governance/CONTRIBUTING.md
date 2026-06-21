# Contributing to pheno-framework-lint

Thank you for your interest in contributing. This document explains how
to set up a development environment, run the test suite, and submit
changes.

## Code of Conduct

All participants are expected to follow the
[`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). By participating, you agree
to abide by its terms.

## Project Overview

`pheno-framework-lint` is the canonical **L73 (Graduation discipline)**
tool in the v1.1 71-pillar framework. It is a 473-line stdlib-only Python
script that classifies a repo into one of four substrate tiers
(`pheno-*-lib`, `phenotype-*-sdk`, `phenotype-*-framework`,
`federated-service`) and applies tier-specific rules to check the
codebase for structural compliance.

**Constraints (non-negotiable for this repo):**

- The script imports only Python stdlib (`argparse`, `json`, `re`, `sys`,
  `dataclasses`, `pathlib`, `typing`).
- Zero third-party runtime dependencies.
- The substrate tier is `pheno-*-lib` (a single-concern library) — see
  `AGENTS.md` for the tier table.
- ADR-023 Rule 3.1 applies: 80% test coverage target, SOTA artifacts
  (CI, deny-equivalent, justfile, PR template, CODEOWNERS, etc.).

## Development Setup

```bash
# Clone the repo
git clone https://github.com/KooshaPari/pheno-framework-lint.git
cd pheno-framework-lint

# Create a virtualenv (Python 3.10+)
python3 -m venv .venv
source .venv/bin/activate

# Install in editable mode with test extras
pip install -e ".[test]"
```

The repo provides a `justfile` for the canonical recipes
(see [`justfile`](justfile)). Common commands:

```bash
just test         # run the smoke test suite
just check        # py_compile + lint
just fmt          # auto-format with ruff
just audit        # pip-audit
just ci           # all of the above in CI order
```

If you do not have [`just`](https://github.com/casey/just) installed, you
can run the commands directly:

```bash
python -m py_compile pheno_framework_lint.py
python -m unittest discover tests -v
pip install ruff && ruff check pheno_framework_lint.py tests
pip install pip-audit && pip-audit --no-deps
```

## Running the Linter Locally

The package installs a `pheno-framework-lint` console script:

```bash
# Single repo
pheno-framework-lint check --path /path/to/some-repo

# Fleet-wide
pheno-framework-lint check-all --root /path/to/fleet-root --out violations.json
```

Output is always JSON. Exit codes: `0` = clean, `2` = violations found.

## Branching & Commit Style

- Branch prefix conventions:
  - `feat/<short-name>` — new rules or new CLI subcommands
  - `fix/<short-name>` — bug fixes
  - `chore/<short-name>` — governance, tooling, CI, docs
  - `refactor/<short-name>` — code refactors (no behavior change)
  - `test/<short-name>` — test-only changes
  - `docs/<short-name>` — documentation-only changes
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
  `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`, `perf:`,
  `build:`, `ci:`.

## Pull Request Process

1. Open an issue first for non-trivial changes; reference it in the PR.
2. Fork the repo and create a feature branch.
3. Add tests for any new rule or behavior change. The existing
   `tests/test_smoke.py` is the canonical pattern.
4. Run `just ci` (or the manual equivalent) locally and ensure all
   checks pass.
5. Use the [PR template](.github/PULL_REQUEST_TEMPLATE.md).
6. Wait for a CODEOWNERS review (`@kooshapari`).
7. Squash-merge once CI is green and review is approved.

## Adding a New Rule

If you want to add a tier-specific rule:

1. Add a `Violation` (or extend an existing check function) in
   `pheno_framework_lint.py`.
2. Mirror the rule in the `tests/test_smoke.py` suite.
3. Update the rule table in `README.md` and `SPEC.md`.
4. Add a CHANGELOG entry under the `## [Unreleased]` section.

## Release Process

Releases are cut via the `release.yml` workflow when a tag matching
`v*.*.*` is pushed. See the [release workflow](.github/workflows/release.yml)
for the canonical steps. The CHANGELOG is generated from Conventional
Commits and the version in `pyproject.toml` is bumped via PR before
the tag is cut.

## Security Issues

Please **do not** open a public issue for security vulnerabilities. See
[`SECURITY.md`](SECURITY.md) for the private disclosure channel.
