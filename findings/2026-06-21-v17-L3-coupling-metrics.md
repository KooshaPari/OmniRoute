# v17 — L3 Coupling Metric Enforcement

**Date:** 2026-06-21
**Cycle:** 7 (P0 reduction)
**Pillar:** L3 (Coupling Metric Enforcement)
**Wave:** A

## Purpose

L3 (Coupling Metric Enforcement) is at 0.00. Without enforced metrics,
the fleet's coupling drift goes undetected and technical debt
accumulates. The pillar requires a CI gate that fails the build when
coupling metrics exceed threshold.

## Metrics

| Metric | Definition | Target | Hard limit |
|--------|------------|--------|------------|
| **Afferent coupling (Ca)** | Incoming cross-crate deps | ≤ 8 | 12 |
| **Efferent coupling (Ce)** | Outgoing cross-crate deps | ≤ 5 | 8 |
| **Instability (I)** | Ce / (Ca + Ce) | ≤ 0.40 | 0.60 |
| **Distance from main seq** | |I + A - 1| | ≤ 0.20 | 0.40 |
| **Cross-crate `pub use`** | Re-exports leaking surface | ≤ 3 | 6 |

## Tool

`cargo-modules` provides `cargo modules metrics` (already shipped in
v15 L6). New wrapper: `scripts/check-coupling.sh`.

## CI gate

`.github/workflows/coupling-gate.yml`:

```yaml
name: coupling-gate
on: [push, pull_request]

jobs:
  coupling:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: cargo install cargo-modules --locked
      - run: bash scripts/check-coupling.sh
        env:
          CA_MAX: 12
          CE_MAX: 8
          I_MAX: 0.60
```

## Script

`scripts/check-coupling.sh` (60 lines):
- Runs `cargo modules metrics --all -o json` per crate
- Parses JSON with `jq`
- Compares each metric to threshold
- Emits a Markdown report to `$GITHUB_STEP_SUMMARY`
- Exits 1 on hard-limit violation

## Acceptance

- `scripts/check-coupling.sh` exists and is executable
- `.github/workflows/coupling-gate.yml` runs on every PR
- 1 cycle-7 PR demonstrates the gate failing then passing after a
  refactor that breaks a Ce limit

## Closure criterion for L3

L3 score moves from 0.00 → 3.00 once the gate is wired and the
first cycle demonstrates enforcement.

Refs: `findings/2026-06-21-v17-L2-module-boundaries.md`
