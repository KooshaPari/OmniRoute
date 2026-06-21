# Changelog

## [0.4.0] — 2026-06-20

### Added

- `CANONICAL_DEVICES` tuple (4 values: `macbook`, `heavy-runner`, `subagent`, `ci`) exported from the package root.
  Documents the canonical `device:` field values per ADR-015 + ADR-025 + ADR-026 (Factory AI Agent Readiness Model).
- Re-exported in `__all__` for public API stability.

### Changed

- Version bump `0.1.0` → `0.4.0` (pyproject.toml + `__version__`).
- `test_version` updated to assert `0.4.0`.

## [0.1.0] — 2026-06-20

### Added

- Initial release.
- `Row` dataclass (11 fields, v2.1 schema).
- `parse(text)` — handles v2.0 (6 col) and v2.1 (11 col).
- `to_markdown(rows)` — canonical v2.1 Markdown emit.
- `to_jsonl(rows)` — JSONL emit for tooling.
- `migrate_v20_to_v21(row_v20)` — v2.0 → v2.1 with `device="unknown"`.
- `__main__` CLI with `validate` and `migrate` subcommands.
- 18 unit tests covering parse/emit/migrate/JSONL.
- Meta-bundle: README, AGENTS, SPEC, llms.txt, CHANGELOG, WORKLOG (v2.1), dual license.
