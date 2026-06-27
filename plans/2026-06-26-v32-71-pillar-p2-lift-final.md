# v32 Plan — Cycle-22 P2-Lift Final

**Date:** 2026-06-26 | **Target:** 8 P2 closed → fleet mean 3.55

## Wave A (T1-T4 parallel)

| Track | Pillar | Artifact | Owner |
|---|---|---|---|
| T1 | L11.1 cargo-fuzz schedule | R+ RUSTSEC-2023-0071 carve-out merged | orch |
| T2 | L17.1 perf budget table + aggregate | All 5 crates have `perf/` dir | sub |
| T3 | L19.1 fleet-wide perf gate | `.perf-gate.yaml` in top 10 repos | sub |
| T4 | L25.1 exemplar-on-error | `#[instrument(err)]` on all handlers | sub |

## Wave B (T5-T8 parallel)

| Track | Pillar | Artifact | Owner |
|---|---|---|---|
| T5 | L27.1 contract test fleet | `pact-consumer/` in every subscriber repo | sub |
| T6 | L29.1 SBOM cyclonedx-fleet | `cargo-cyclonedx` in all 47 Rust crates | sub |
| T7 | L47.1 gitleaks-fleet | `gitleaks detect` in CI for all repos | sub |
| T8 | L52.1 mTLS fleet config | `tools/mtls-fleet/` config at root | sub |

## Deliverables

- 8 P2 → 0 remaining (100% of 24 P2 closed)
- Fleet mean 3.46 → 3.55 (+0.09)
- 4 P1 deferred to v33+

## CI Gate

- `scripts/v32-checks.sh` — validates all 8 track artifacts exist
- Fails (`exit 1`) if any track's deliverable is missing

Refs: v32 plan, ADR-095, cycle-22 probe
