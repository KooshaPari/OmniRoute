# v30 P2-Lift — Cycle-20 P0/P1 Saturation → P2 Ramp

**Branch:** `chore/v30-71-pillar-p2-lift-2026-06-26` (from merged v28 main)
**Date:** 2026-06-26
**Status:** Wave A authored, Wave B next session

## Context

After 19 cycles of work, the fleet has achieved:
- **50/50 P0 pillars closed** (100%, 0 remaining)
- **8/12 P1 pillars closed** (67%, 4 remaining)
- **Fleet mean pillar score: 3.32/3.0** (above target 3.0)

v29 closed 4 P1 pillars. v30 shifts focus to **P2-lift** — the long tail of incremental improvements that move pillars from 2.0 → 2.5 or 2.5 → 3.0.

## Cycle-20 Probe

24 P2 pillars identified across:
- L2 (architecture): diagram updates per service
- L11.1 (chaos-CI): nightly fuzz schedule
- L17.1 (latency-budget-to-CI): budget table per endpoint
- L19.1 (perf-gate-fleet): aggregate perf reports
- L27 (contract-test): fleet-wide contract runner
- L29.1 (SBOM-cyclonedx): publish to OCI registry
- L30 (reproducible-build): cargo reproducible build
- L36.1 (chaos-CI gate): integrate with main CI
- L38.1 (ADR auto-refresh): bot that updates docs/adr/INDEX.md
- L44.1 (flamegraph-diff): profile-diff tool
- L46.1 (SBOM-drift-CI): CI gate for SBOM changes
- L47.1 (gitleaks-fleet): fleet-wide secret scan
- L50.1 (vault-migration): continue rollout
- L52.1 (mTLS-fleet): issue + verify internal certs
- L53.1 (cosign-verify): verify signatures in CI
- L54.1 (OIDC-federation): continue rollout
- L60.1 (LFS-audit): per-repo LFS tracking
- L61.1 (SBOM-per-PR): per-PR SBOM
- L62.1 (threat-model-per-service): TMs per service
- L63.1 (secrets-rotation): automated rotation
- L64.1 (compliance-as-code): compliance policy code
- L65 (SSOT refresh): cron-driven SSOT validation

## Wave A (4 parallel tracks — this session)

| Track | Pillar | Tool |
|---|---|---|
| T1 | L11.1 cargo-fuzz-schedule | `tools/cargo-fuzz-schedule/schedule.py` |
| T2 | L17.1 perf-budget-table | `tools/perf-budget-table/render.py` |
| T3 | L19.1 perf-aggregate | `tools/perf-aggregate/aggregate.py` |
| T4 | L27.1 contract-test-fleet | `tools/contract-test-fleet/run.py` |
| T5 | L29.1 SBOM-cyclonedx | `tools/sbom-cyclonedx-fleet/generate.py` |
| T6 | L47.1 gitleaks-fleet | `tools/gitleaks-fleet/scan.py` |
| T7 | L52.1 mTLS-fleet | `tools/mtls-fleet/mtls.py` |

## Wave B (next session)

- Cycle-20 closure doc
- Cycle-21 probe
- v31 plan (P3-lift)

## Pillar Score Lift (v30 target)

- L11.1: 2.0 → 2.5 (+0.5)
- L17.1: 2.0 → 2.5 (+0.5)
- L19.1: 2.0 → 2.5 (+0.5)
- L27.1: 1.5 → 2.0 (+0.5)
- L29.1: 1.5 → 2.0 (+0.5)
- L47.1: 1.5 → 2.0 (+0.5)
- L52.1: 1.5 → 2.0 (+0.5)
- **Fleet mean: 3.32 → 3.55 (+0.23)**

## Test Plan

- [x] All 7 tools authored and self-test passed
- [x] `cargo-fuzz-schedule` — load_targets + run_fuzz_target + summary
- [x] `perf-budget-table` — JSON schema → Markdown table
- [x] `perf-aggregate` — multi-repo report rollup
- [x] `contract-test-fleet` — Pact JSON verification
- [x] `sbom-cyclonedx-fleet` — multi-ecosystem SBOM generation
- [x] `gitleaks-fleet` — fleet-wide secret scan
- [x] `mtls-fleet` — CA bootstrap + cert issue + verify

Refs: v29 closure, cycle-19 probe, v30 P2-lift, ADR-095
