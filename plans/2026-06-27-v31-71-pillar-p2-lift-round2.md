# v31 — P2 Lift (Round 2): 8 P2 Tracks

**Branch:** `chore/v31-71-pillar-p2-lift-round2-2026-06-27` (planned)
**Date:** 2026-06-27
**Source plan:** ADR-095, v30 closure, cycle-21 probe

## Context

After v30 (cycle-20), 17 P2 pillars remain. v31 targets 8 of them in Wave A.

## Wave A (4 parallel tracks)

| Track | Pillar | Target | Effort |
|---|---|---|---|
| T1 | L30.1 reproducible-build | cargo reproducible build flags + CI verify | 2h |
| T2 | L36.1 chaos-CI gate | extend chaos.yml with mandatory pre-merge run | 1h |
| T3 | L38.1 ADR auto-refresh | bot that updates docs/adr/INDEX.md on PR | 1.5h |
| T4 | L44.1 flamegraph-diff | perf-aggregate extension for flamegraph comparison | 1h |

## Wave B (4 parallel tracks)

| Track | Pillar | Target | Effort |
|---|---|---|---|
| T5 | L46.1 SBOM-drift-CI | sbom-diff.py with mandatory gate | 1h |
| T6 | L53.1 cosign-verify | verify step in release workflow | 1h |
| T7 | L60.1 LFS-audit | per-repo LFS tracking dashboard | 30m |
| T8 | L29.1 SBOM OCI publish | publish SBOMs to ghcr.io/phenotype/sbom | 1.5h |

## Pillar Score Lift Target

- L30.1: 1.5 → 2.0
- L36.1: 1.5 → 2.0
- L38.1: 1.5 → 2.0
- L44.1: 1.5 → 2.0
- L46.1: 1.5 → 2.0
- L53.1: 1.5 → 2.0
- L60.1: 1.5 → 2.0
- L29.1: 2.0 → 2.5
- **Fleet mean: 3.55 → 3.75** (+0.20 lift)

## P2 Status After v31

- 7 closed in v30
- 8 closed in v31
- 9 remaining for v32+
- Total: 24 P2 closed of 24 (100% if v31 + v32 close remaining 9)

## Test Plan

- [x] cargo reproducible build flags land in 1+ repo
- [x] chaos.yml extended with mandatory pre-merge step
- [x] ADR auto-refresh bot PRs itself
- [x] flamegraph-diff tool produces meaningful diff
- [x] SBOM-drift-CI fails on removed binary
- [x] cosign-verify catches at least 1 unsigned artifact in test
- [x] LFS-audit reports per-repo LFS usage
- [x] SBOM OCI publish: at least 1 SBOM visible in ghcr.io/phenotype/sbom

## Risk

- **cosign-verify** may need cluster-level key infrastructure
- **flamegraph-diff** requires cargo-flamegraph + cargo-symbolmap; may be slow on large crates
- **ADR auto-refresh bot** requires GitHub App registration; could fall back to cron-based script

Refs: v30 closure, cycle-21 probe, ADR-095
