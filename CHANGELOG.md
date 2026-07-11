# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `Adapter.Logs` and `Adapter.Exec`: implemented with native sandbox delegation
- `gvisorAdapter.Logs` and `gvisorAdapter.Exec`: implemented via runsc log/exec commands
- `landlockAdapter`, `seccompAdapter`, `wasmtimeAdapter`: implemented Get/Logs/Exec/Metrics with runtime-appropriate mechanisms
- `nativeSandboxAdapter`: implemented Get/Logs/Exec/Metrics with nsenter and journald
- Helper functions `logsForSandbox`, `execInSandbox`, `metricsForSandbox` for per-sandbox operations

### Changed
- `generateID`: replaced timestamp-based IDs with cryptographically random UUIDs (crypto/rand)
- `checkLandlockSupport`: replaced stub with real kernel version check (/proc/sys/kernel/osrelease >= 5.13 and /sys/kernel/security/landlock)
- `Adapter.Get`: now performs proper map lookup instead of always returning "not found"
- `Adapter.Metrics`: now performs proper map lookup and returns real metrics
- `linux.execNative`: fixed hardcoded `"cmd[0]"` string literal bug (was using string literal instead of actual command)

### Fixed
- `linux/execNative`: WASM sandbox command execution now passes correct arguments instead of literal string `"cmd[0]"`

[Unreleased]: https://github.com/KooshaPari/nanovms/compare/main...HEAD

