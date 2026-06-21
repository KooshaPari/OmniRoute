# v21 T4 L32 SDK Versioning Policy

**Date:** 2026-06-22
**Pillar:** L32 (SDK versioning — SemVer 2.0 + deprecation policy)
**Status:** v21 Wave A track 4 of 5

## SemVer 2.0 strict adherence

All `phenotype-*-sdk` packages follow [SemVer 2.0.0](https://semver.org/) strictly:

- **MAJOR** (X.0.0): breaking API change
- **MINOR** (0.X.0): new backward-compatible feature
- **PATCH** (0.0.X): backward-compatible bug fix

## Pre-1.0 deprecation rules

- `0.X.Y` (X > 0): MINOR = breaking change
- `0.0.X`: any change can be breaking
- 1.0.0: first stable release; thereafter strict SemVer

## Deprecation policy

When deprecating an API symbol:

1. Mark with `#[deprecated(since = "X.Y.Z", note = "use replacement")]` attribute
2. Deprecation persists for **at least 2 MINOR releases** (e.g. deprecated in 0.4.0, removable in 0.6.0 minimum)
3. Document in CHANGELOG.md under "Deprecated" section
4. Issue a `PhenotypeSDKDeprecated` lint warning (custom clippy lint)

## Stable guarantees (1.0.0+)

- All public API symbols are part of the contract
- Removal requires MAJOR bump
- Type signatures are stable (parameter names are not)
- Trait implementations are stable
- Macro syntax is stable

## Unstable features

- `unstable` module path (e.g. `phenotype_sdk::unstable::*`) — may change without notice
- `_unstable` suffix on functions — same
- Documented with `// UNSTABLE` doc comment

## Versioning metadata

Each SDK package includes `[package.metadata.phenotype]` in `Cargo.toml`:

```toml
[package.metadata.phenotype]
api_stability = "stable"  # or "unstable" or "deprecated"
since = "0.4.0"          # version this stability was first declared
replacement = ""          # if deprecated, the replacement package
```

## Acceptance criteria

- [x] SemVer 2.0 strict (no MAJOR with breaking changes in MINOR)
- [x] 2-MINOR deprecation window
- [x] `#[deprecated(since, note)]` attribute required
- [x] CHANGELOG "Deprecated" section required
- [x] `unstable` namespace for in-development APIs
- [x] Package metadata for tooling integration