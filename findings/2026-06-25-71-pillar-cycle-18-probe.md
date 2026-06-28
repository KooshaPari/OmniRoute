# 71-Pillar Cycle-18 Probe

**Date:** 2026-06-25
**Cumulative P0 closed:** 43 (cycles 1-17)
**P0 remaining:** 4

## Remaining P0

| Pillar | Current Score | Target | Notes |
|---|---|---|---|
| **L30** reproducible builds | 2.0 | 2.5 | nix flake adoption across fleet (v28 T1) |
| **L36** chaos-CI gate | 2.0 | 2.5 | chaostoolkit cron gate (v28 T2) |
| **L38** ADR index auto-refresh | 2.0 | 2.5 | CI gate for INDEX.md freshness (v28 T3) |
| **L53** cosign verify | 2.0 | 2.5 | CI gate for signature verification (v28 T4) |

## Cycle Mean Score

- **Starting fleet mean:** 3.12 (v26 closure)
- **Current fleet mean:** 3.18 (v27 closure)
- **Target (v28):** 3.22
- **Max theoretical:** 3.40 (all 47 P0 at 3.0)

## Cycle-18 Strategy

Wave A parallel (T1-T4, no cross-deps):
- T1 L30: `tools/reproducible-build/repro_build.sh` + nix config check in CI
- T2 L36: `tools/chaos-ci-gate/chaos_gate.py` + cron workflow
- T3 L38: `tools/adr-index-check/adr_index_check.py` + PR gate workflow
- T4 L53: `tools/cosign-verify/cosign_verify.sh` + verify workflow

Target: 4 P0 closed → 0 P0 remaining → fleet mean 3.22.
