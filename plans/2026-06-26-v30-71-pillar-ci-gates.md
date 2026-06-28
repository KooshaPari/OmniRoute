# V30: 71-Pillar Cycle-20 — CI Gates for All 12 P1 Pillars

**Goal:** Land CI gate workflows for each of the 12 P1 pillars documented in v29.
**Target fleet mean:** 3.28 → 3.42 (+0.14)
**Track structure:** 3 parallel waves × 4 CI gate workflows per wave.

## Wave A (12 parallel CI gates)

| Track | Pillar | CI Gate File | Tool Invoked |
|---|---|---|---|
| GA-1 | L11.1 cargo-fuzz | `.github/workflows/cargo-fuzz-ci.yml` | `cargo fuzz check --fuzz-dir <path>` |
| GA-2 | L19.1 perf-gate | `.github/workflows/perf-gate-ci.yml` | `python3 tools/perf-gate/perf_gate.py` |
| GA-3 | L25.1 exemplar on error | audit check (cargo doc) |
| GA-4 | L27.1 contract fleet | `.github/workflows/pact-ci.yml` | `pact verify` |
| GA-5 | L29.1 SBOM cyclonedx | `.github/workflows/sbom-cyclonedx-ci.yml` | `cargo cyclonedx` |
| GA-6 | L46.1 SBOM drift | `.github/workflows/sbom-diff-ci.yml` | `python3 tools/sbom-diff/sbom_diff.py` |
| GA-7 | L30.1 reproducible build | audit CI |
| GA-8 | L36.1 chaos CI fleet | `.github/workflows/chaos-ci-gate.yml` | `python3 tools/chaos-ci-gate/gate.py` |
| GA-9 | L38.1 ADR auto-refresh | `.github/workflows/adr-index-ci.yml` | `python3 tools/adr-index-check/regen.py` |
| GA-10 | L44.1 flamegraph diff | `.github/workflows/flamegraph-ci.yml` | `cargo flamegraph` |
| GA-11 | L52.1 mTLS fleet full | audit check |
| GA-12 | L60.1 LFS audit cron | ✅ DONE (v29) |

## Closure

- findings/2026-06-26-v30-closure.md
- findings/2026-06-26-71-pillar-cycle-21-probe.md
- plans/2026-06-26-v31-71-pillar-automation.md

## Target

12 P1 → 12 CI gates, fleet mean 3.28 → 3.42 (+0.14)
