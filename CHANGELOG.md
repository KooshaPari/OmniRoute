## [0.2.0] - 2026-07-04

See GitHub releases for full list.

# Changelog

All notable changes to **sharecli** are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
(`MAJOR.MINOR.PATCH`).

> The latest unreleased changes live under `[Unreleased]`. On release, the
> `just changelog` recipe (`git-cliff`) slices conventional commits into the
> appropriate section.

---

## [Unreleased]

### Added
- **justfile** with grouped recipes: `setup`, `fmt`, `lint`, `build`, `test`,
  `coverage`, `security` (audit, deny), `doc`, `gate`, `hygiene`, `ci`, and
  `release`. Local `just ci` mirrors the GitHub Actions pipeline.
- **`.gitattributes`** normalizing line endings (LF default) and marking
  generated/lock files as `linguist-generated` for cleaner GitHub stats.
- **`.github/ISSUE_TEMPLATE/bug_report.md`** and **`feature_request.md`** (Markdown
  form) plus **`config.yml`** (chooser + blank-issue lockdown).
- **`.github/PULL_REQUEST_TEMPLATE.md`** (rewritten with tier-0 sections:
  Summary, Type, FRs, Testing, Checklist, Risks).
- **`.github/workflows/audit.yml`** — scheduled + push-triggered `cargo audit`
  with SARIF upload to the Security tab.
- **`.github/workflows/deny.yml`** — scheduled + push-triggered `cargo deny check`.
- **`.github/workflows/scorecard.yml`** — OSSF Scorecard with SARIF publish.
- **`.github/workflows/release.yml`** — full SLSA Build L2 attestation pipeline
  (build → attest → publish) with SHA-pinned actions and `workflow_dispatch`
  dry-run toggle.
- **`.github/workflows/ci.yml`** — upgraded to SHA-pinned actions and explicit
  per-job naming.
- **`.github/CODEOWNERS`** — explicit (not "auto-generated") ownership table
  for `src/`, `tests/`, `Cargo.*`, governance files, and `.github/`.
- **Threat model** in `SECURITY.md`.
- **Conventional Commits** guidance in `CONTRIBUTING.md`.

### Changed
- **`CONTRIBUTING.md`** — removed terminal escape codes, expanded with quick-start,
  local quality gates, commit message conventions, and release process.
- **`SECURITY.md`** — removed terminal escape codes, added reporting SLA,
  threat model, and dependency scanning summary.
- **`CHANGELOG.md`** — populated with historical and current entries.
- **`.github/CODEOWNERS`** — replaced auto-generated stub with curated, per-path
  ownership tied to `@KooshaPari`.

### Fixed
- **`release.yml`** — repaired broken template syntax (`${{ }}` was previously
  written as `$123...125` placeholders that would never expand).

### Security
- All third-party GitHub Actions pinned to commit SHAs (defense against
  upstream tag-rebinding attacks).
- `permissions:` blocks tightened to least-privilege per job.

---

## [0.1.0] — 2024-XX-XX (initial scaffold)

### Added
- Initial CLI scaffold (`sharecli ps`, `start`, `stop`, `status`, `config`,
  `project`, `run`, `pool`, `health`, `limits`, `check`, `optimize`, `prune`).
- `substrate` SDK + `runtime-process` adapter for cross-platform process
  management.
- `sysinfo`-backed resource monitoring and `ProcessPool` / `SharedRuntime`
  pooling layer.
- `config init | validate | show | get | set` subcommands with TOML storage
  at `~/.config/sharecli/config.toml`.
- `project discover` for recursive registration of sibling repos.
- `process-compose.yml` generation from registered projects.
- CLI: `clap` 4.5 (derive + env), async: `tokio` (full feature set),
  logging: `tracing` + `tracing-subscriber` + `tracing-appender`.
- CI workflows: `ci.yml`, `quality-gate.yml`, `release.yml`,
  `release-attestation.yml`, `sast.yml`, `coverage.yml`, `deploy-docs.yml`.
- Documentation: `README.md`, `SPEC.md`, `PRD.md`, `PLAN.md`, `AGENTS.md`,
  `CLAUDE.md`, `BOUNDARY.md`, `FUNCTIONAL_REQUIREMENTS.md`,
  `TEST_COVERAGE_MATRIX.md`, `docs/`.
- Governance: `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`, `SECURITY.md`,
  `.github/CODEOWNERS`, `.github/dependabot.yml`, `.github/ISSUE_TEMPLATE/`.
- Repo-local config: `deny.toml`, `rustfmt.toml`, `clippy.toml`, `mise.toml`,
  `cliff.toml`, `_typos.toml`, `audit_scorecard.json`.

---

## Versioning & Cadence

- **Major (`x.0.0`)** — breaking CLI/flag changes; removed commands.
- **Minor (`0.x.0`)** — new commands, new subcommands, new flags, deprecations.
- **Patch (`0.0.x`)** — bug fixes, dependency updates, security backports.

Tags follow `vMAJOR.MINOR.PATCH` (e.g. `v0.1.0`).