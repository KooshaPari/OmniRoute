# v21 T5 L34 Backward Compatibility Policy

**Date:** 2026-06-22
**Pillar:** L34 (Backward compatibility window + deprecation timeline)
**Status:** v21 Wave A track 5 of 5

## Compatibility window

For all `phenotype-*-sdk` and substrate libraries (`pheno-*`, `phenotype-*-framework`):

| Bump type | Compat window | Deprecate before remove? |
|-----------|---------------|--------------------------|
| MAJOR | 6 months support for old version | N/A (breaking by definition) |
| MINOR | 2 MINOR releases overlap | yes, `#[deprecated]` required |
| PATCH | 1 PATCH release backported | no |

## Deprecation timeline

A symbol can be removed only after:

1. First released as `#[deprecated]` in version X.Y.Z
2. Carried through MINOR versions X.Y+1.0, X.Y+2.0
3. Removable starting in X.Y+3.0 (typically)
4. Example: deprecated in 0.4.0 → removable in 0.7.0 minimum

## Backporting policy

Bug fixes are backported to:

- The current MINOR (e.g. 0.5.x → 0.5.6)
- The previous MINOR (e.g. 0.4.x → 0.4.7) — for 6 months after 0.5.0 release
- Security fixes backported to all supported MINORs

## Test matrix

Each `phenotype-*-sdk` provides a compatibility test suite:

```
tests/compat/
├── v0.3.x/    # oldest supported
├── v0.4.x/    # previous MINOR
└── v0.5.x/    # current
```

Each subdirectory contains a small example that exercises the API as it existed at that version. CI runs all three against the current code; if any fails, the change is flagged as a backward-compat regression.

## Documented exceptions

Some changes are documented exceptions to backward compat:

- **Security fixes** that require API change (CVE): immediate, with security advisory
- **Compiler upgrade** (MSRV bump): single MAJOR
- **Dependency CVEs**: minimum required upgrade

## CI integration

`.github/workflows/compat-check.yml`:

```yaml
name: compat-check
on: [push, pull_request]
jobs:
  compat:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          for v in 0.3 0.4 0.5; do
            cargo test --test compat_v$v
          done
```

## Acceptance criteria

- [x] 6-month MAJOR support window
- [x] 2-MINOR deprecation window (X.Y+3.0 minimum)
- [x] Backporting policy for current + previous MINOR
- [x] Per-version compat test suite
- [x] CI compat-check workflow
- [x] Documented exceptions (security, MSRV)
