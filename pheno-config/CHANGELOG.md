# Changelog

All notable changes to `pheno-config` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- v0.3.0: Macros for derive-style `Config` field annotations (eliminate hand-written `load_from_env`).

## [0.2.0] - 2026-06-15

### Added
- `load_from_toml_file(path)`: read a `Config` from a TOML file. Validates required
  fields (`url`, `db_path`) with field-specific error reporting.
- `Config::merge(&mut self, other)`: in-place overlay merge. Other wins on
  non-empty/non-zero scalars; flags are concatenated with dedup (preserves order).
- `combine(file, env_prefix)`: canonical 12-factor entrypoint. Loads file, then
  overlays env. File fills required-field gaps; env is the runtime override layer.
- `load_from_env_full(prefix)`: like `load_from_env` but returns empty/zero for
  unset fields (used internally by `combine()`).
- `tests/toml_merge_test.rs`: 11 new tests covering TOML parsing, merge semantics,
  and combine precedence. Process-wide `Mutex<()>` serializes env-var access
  across parallel cargo test threads.
- `docs/twelve-factor.md`: deep-dive on the 12-factor contract, conflict
  resolution, Figment/Config-rs/dotenvy comparison.
- `README.md`: API surface, env-var names, error type, versioning, quick-start.

### Changed
- `Cargo.toml`: version bumped to 0.2.0; `toml = "0.8"` added to dependencies.
- `Cargo.toml`: license-field clarified; `description` and `keywords` fields added
  (per ADR-012 PR-10 publish prep).

## [0.1.0] - 2026-06-12

### Added
- Initial release of `pheno-config` umbrella crate.
- `Config` struct with `url`, `port`, `log_level`, `db_path`, `feature_flags`.
- `load_from_env(prefix)`: read all fields from `<PREFIX>_*` env vars.
- `load_from_file(path)`: read a JSON config file (URL/path/port/log_level/db_path).
- `ConfigError`: typed error enum (`MissingField`, `ParseError`, `IoError`).
- 4 inline unit tests.
