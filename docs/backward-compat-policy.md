# Backward Compatibility Policy (L34)

**Date:** 2026-06-22
**Owner:** substrate-quality-bar circle
**Status:** ACCEPTED
**Pillar:** L34 (Backward compatibility window + deprecation timeline)

## Compat window

| Bump type | Window | Deprecation required |
|-----------|--------|----------------------|
| MAJOR | 6mo support | N/A (breaking) |
| MINOR | 2 MINOR overlap | yes |
| PATCH | 1 PATCH backport | no |

## Deprecation timeline

- Deprecated in X.Y.Z → removable in X.Y+3.0 minimum
- Example: 0.4.0 deprecation → 0.7.0 removal

## Backporting

- Current MINOR + previous MINOR (6mo window)
- Security fixes: all supported MINORs

## Exceptions

- Security CVEs (with advisory)
- MSRV bumps
- Required dep upgrades

## Per-version compat test suite

```
tests/compat/
├── v0.3.x/    # oldest supported
├── v0.4.x/    # previous MINOR
└── v0.5.x/    # current
```

Each subdir exercises the API as it existed at that version. CI runs all three against the current code; if any fails, the change is flagged as a backward-compat regression.

## CI integration

`.github/workflows/compat-check.yml` runs `cargo test --test compat_v0.3 && cargo test --test compat_v0.4 && cargo test --test compat_v0.5` on every push + PR.

## See also

- `findings/2026-06-22-v21-T5-L34-backward-compat.md` — full rationale
- `docs/sdk-versioning.md` — versioning policy
