# SDK Versioning Policy (L32)

**Date:** 2026-06-22
**Status:** ACCEPTED
**Applies to:** All `phenotype-*-sdk` packages

All `phenotype-*-sdk` packages follow [SemVer 2.0.0](https://semver.org/) strictly.

## Stability levels

| Level | Path | Bump rule |
|-------|------|-----------|
| `stable` | root module | MAJOR = breaking |
| `unstable` | `::unstable::*` namespace | any change can be breaking |
| `deprecated` | marked with `#[deprecated]` | removal after 2 MINOR releases |

## Pre-1.0 deprecation rules

- `0.X.Y` (X > 0): MINOR = breaking change
- `0.0.X`: any change can be breaking
- 1.0.0: first stable release; thereafter strict SemVer

## Deprecation syntax

```rust
#[deprecated(since = "0.4.0", note = "use `new_method` instead")]
pub fn old_method() { /* ... */ }
```

## CHANGELOG required

```markdown
## [0.4.0] - 2026-06-22

### Deprecated
- `old_method` — use `new_method` instead (will be removed in 0.6.0)
```

## Package metadata

```toml
[package.metadata.phenotype]
api_stability = "stable"  # or "unstable" or "deprecated"
since = "0.4.0"
replacement = ""          # if deprecated, the replacement package
```

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

## See also

- `findings/2026-06-22-v21-T4-L32-sdk-versioning.md` — full rationale
- `findings/2026-06-22-v21-T5-L34-backward-compat.md` — deprecation windows
