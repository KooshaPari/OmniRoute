# Contributing

Thanks for your interest in contributing to this Phenotype repository. This
document describes the workflow, conventions, and quality gates every change is
expected to clear before it can be merged.

By participating, you agree to abide by our
[Code of Conduct](CODE_OF_CONDUCT.md).

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Bug Reports](#bug-reports)
- [Feature Requests](#feature-requests)
- [Pull Request Process](#pull-request-process)
- [Commit Messages (Conventional Commits)](#commit-messages-conventional-commits)
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Style](#style)

## Code of Conduct

All contributors, maintainers, and users are expected to follow the project
[Code of Conduct](CODE_OF_CONDUCT.md). Reports of unacceptable behavior may be
sent to the maintainers listed in [`CODEOWNERS`](../CODEOWNERS). We will not
tolerate harassment, discrimination, or abusive language of any kind.

## Bug Reports

Bugs are tracked as GitHub issues. Before opening a new one:

1. Search existing issues (open and closed) to avoid duplicates.
2. Reproduce the bug on the latest `main` branch.
3. Collect a minimal reproduction, including:
   - The exact command, code path, or input that triggered the bug.
   - The expected behavior and the actual behavior.
   - The version, commit SHA, platform, and runtime (OS, language version,
     relevant service versions).
   - Relevant logs, stack traces, or screenshots (sanitize any secrets).

Open the issue using the **Bug report** template and tag it appropriately.
Security issues must **not** be filed as public issues; follow
[`SECURITY.md`](../SECURITY.md) for private disclosure.

## Feature Requests

Feature requests are also tracked as GitHub issues. Open one with the
**Feature request** template and include:

- The problem you are trying to solve and the user impact.
- A short description of the proposed solution.
- Alternatives considered, with trade-offs.
- Whether you are willing to submit a pull request.

Large design changes should go through a design doc / RFC before any code is
written. Link the doc from the issue.

## Pull Request Process

1. **Branch off `main`** (or the canonical development branch documented in
   [`CLAUDE.md`](../CLAUDE.md)). Use a descriptive branch name such as
   `feat/<scope>-<short-desc>`, `fix/<scope>-<short-desc>`, or
   `chore/<scope>-<short-desc>`.
2. **Keep changes focused.** One logical change per pull request. Split
   unrelated cleanups into separate PRs.
3. **Update the changelog.** Add an entry under `## Unreleased` in
   `CHANGELOG.md` for any user-facing change.
4. **Pass local quality gates** (see [Testing](#testing) and [Style](#style))
   before requesting review.
5. **Open the pull request** using the PR template. Fill in the summary,
   motivation, testing notes, and any breaking-change callouts.
6. **Address review feedback** by pushing additional commits; do not force-push
   during review unless asked.
7. **Squash-merge** is the default. The PR title becomes the squashed commit
   subject and must follow Conventional Commits (see below).
8. **CI must be green** and at least one approving review from a
   [`CODEOWNERS`](../CODEOWNERS) entry is required before merge.

## Commit Messages (Conventional Commits)

This repository follows the
[Conventional Commits 1.0.0](https://www.conventionalcommits.org/) spec. The
commit subject line is structured as:

```
<type>(<scope>): <short imperative summary>
```

Common types:

| Type       | Purpose                                                          |
| ---------- | ---------------------------------------------------------------- |
| `feat`     | A new user-facing feature.                                       |
| `fix`      | A bug fix.                                                       |
| `docs`     | Documentation-only changes.                                      |
| `style`    | Formatting / whitespace changes that do not affect code meaning. |
| `refactor` | A code change that neither fixes a bug nor adds a feature.       |
| `perf`     | A code change that improves performance.                         |
| `test`     | Adding or fixing tests.                                          |
| `build`    | Build system or external dependency changes.                     |
| `ci`       | CI configuration or script changes.                              |
| `chore`    | Tooling, maintenance, or other non-src changes.                  |
| `revert`   | Reverts a previous commit.                                       |

Rules:

- The subject is **imperative present tense** ("add", not "added" or "adds").
- The subject is **at most 72 characters**; no trailing period.
- The **scope** is a short noun describing the affected module, package, or
  surface (e.g. `cli`, `api`, `mcp`, `justfile`).
- The **body** (separated by a blank line) explains *what* and *why*, not *how*.
  Wrap at 72 columns.
- A **footer** may reference issues (`Closes #123`, `Refs #456`) and is
  required for breaking changes:
  `BREAKING CHANGE: <description>`.
- A commit that introduces a breaking change may append `!` after the
  type/scope: `feat(api)!: drop legacy v1 endpoints`.

Examples:

```
feat(cli): add --json output to `phenotype status`

Previously the status command only printed a human-readable table, which
made it hard to consume from scripts. Add a --json flag that emits the
same data as a stable JSON object.

Closes #142
```

```
fix(mcp): guard against nil tool handler in registry
```

## Development Setup

1. **Clone the repository** and enter it:

   ```bash
   git clone <repo-url>
   cd <repo>
   ```

2. **Install toolchain** versions from the repo's pinned manifests
   (e.g. `rust-toolchain.toml`, `.nvmrc`, `pyproject.toml`, `go.mod`,
   `package.json`). Do not introduce un-pinned versions.
3. **Install dependencies** using the repo's package manager. Examples:

   ```bash
   # Rust
   cargo fetch
   # Node
   npm ci        # or pnpm install --frozen-lockfile
   # Python
   pip install -e '.[dev]'
   # Go
   go mod download
   ```

4. **Bootstrap project-level hooks and tasks.** If the repo ships a
   [`Justfile`](Justfile), prefer `just <recipe>` over ad-hoc commands. If it
   ships a [`Taskfile.yml`](Taskfile.yml), use `task <target>`. If both are
   present, the `Justfile` is canonical and the `Taskfile.yml` should be
   removed in a follow-up.
5. **Verify the environment** by running the project's `doctor` / bootstrap
   recipe (e.g. `just doctor`, `task doctor`, `./scripts/doctor.sh`) and
   resolving any reported drift before continuing.

## Testing

- **All tests must pass locally** before opening a pull request.
- **Add or update tests** for every behavior change. A pull request that
  changes behavior without changing tests is incomplete.
- Use the project's test runner via the `Justfile` / `Taskfile` recipe
  (e.g. `just test`, `task test`, `cargo test`, `pytest`, `npm test`).
- For changes that touch a public API, CLI surface, schema, or wire format,
  run the **integration** or **smoke** recipe in addition to unit tests
  (e.g. `just test-integration`, `./tests/smoke/smoke.sh`).
- When fixing a bug, add a **regression test** that fails on `main` and passes
  on the fix branch.
- Do not disable, skip, or `.skip` failing tests to make CI green. If a test
  is flaky, fix the flake and link the investigation in the PR.

## Style

- Match the language / framework conventions already used in the repository.
  If you are unsure, look at neighboring files before introducing a new
  pattern.
- **Rust:** `cargo fmt --all`, `cargo clippy --all-targets --all-features
  -- -D warnings`. Respect [`clippy.toml`](../clippy.toml) and
  [`deny.toml`](../deny.toml).
- **Go:** `gofmt -s -w .` and `go vet ./...`. Follow the local package layout
  and error-handling conventions.
- **TypeScript / JavaScript:** rely on the repo's `eslint` and `prettier`
  configs (`npm run lint`, `npm run format`). Do not commit formatting-only
  churn in unrelated files.
- **Python:** `ruff format` and `ruff check` (or the configured `black` /
  `flake8` / `mypy` equivalents). Type hints are required for new public
  functions.
- **Shell:** POSIX-friendly scripts unless the shebang says otherwise;
  `shellcheck` clean.

General rules:

- Public functions, types, and modules must have a doc comment describing
  intent, inputs, and outputs.
- Names should be self-describing. Avoid abbreviations except for well-known
  ones (`id`, `url`, `ctx`).
- Prefer small, composable functions. If a function does not fit on a screen
  and has more than one responsibility, split it.
- Do not introduce new top-level dependencies without justification in the
  PR description and (when relevant) a `CHANGELOG.md` entry.

---

If anything in this guide is unclear or out of date, please open an issue or
PR against this file.
