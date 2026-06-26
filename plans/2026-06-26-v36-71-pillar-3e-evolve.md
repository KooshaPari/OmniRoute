# v36 Plan — Cycle-26 3e-Evolve

**Date:** 2026-06-26 | **Target:** Fleet mean **3.58 → 3.65** (+0.07)

## Wave A — 7 Evolve Workflows (Parallel)

| Track | Pillar | Workflow | Target Mean Lift |
|---|---|---|---|
| T1 | L25.1 Fuzz schedule | `.github/workflows/fuzz-weekly.yml` | +0.01 |
| T2 | L19.1 Perf gate | `.github/workflows/perf-weekly.yml` | +0.01 |
| T3 | L29.1 SBOM weekly | `.github/workflows/sbom-weekly.yml` | +0.01 |
| T4 | L52.1 mTLS weekly | `.github/workflows/mtls-weekly.yml` | +0.01 |
| T5 | L60.1 LFS weekly | `.github/workflows/lfs-weekly.yml` | +0.01 |
| T6 | L27.1 Contract weekly | `.github/workflows/contract-weekly.yml` | +0.01 |
| T7 | L46.1 Chaos weekly | `.github/workflows/chaos-weekly.yml` | +0.01 |

## CI Gate

- `.github/workflows/evolve-checks.yml` — validates all 7 workflows exist
- Fails if any evolve workflow is missing

## Target

Fleet mean **3.65** — the 3e framework complete cycle.
After v36, the fleet has a self-sustaining CI/IP loop.

Refs: v36 plan, ADR-095 pheno-context canonical, 3e framework
