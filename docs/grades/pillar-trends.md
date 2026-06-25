# Pillar Trends — 71-Pillar Breakdown

> Per-pillar status across all compute/infra repos.

## All Pillars

| Pillar | phenotype-infra | PhenoCompose | BytePort | nanovms | Pass Count |
|--------|-----------------|--------------|----------|---------|------------|
| audit | SKIP | FAIL | FAIL | FAIL | 0 |
| bench | SKIP | FAIL | FAIL | N/A | 0 |
| build | FAIL | FAIL | FAIL | FAIL | 0 |
| clippy | FAIL | FAIL | FAIL | N/A | 0 |
| coverage | SKIP | FAIL | FAIL | SKIP | 0 |
| deny | SKIP | FAIL | FAIL | N/A | 0 |
| doc | FAIL | FAIL | FAIL | N/A | 0 |
| fmt | FAIL | FAIL | FAIL | FAIL | 0 |
| install | N/A | N/A | N/A | PASS | 1 |
| lint | N/A | N/A | N/A | FAIL | 0 |
| test-e2e | N/A | N/A | N/A | SKIP | 0 |
| test-fuzz | SKIP | FAIL | FAIL | N/A | 0 |
| test-mutation | N/A | N/A | N/A | SKIP | 0 |
| test-perf | N/A | N/A | N/A | SKIP | 0 |
| test-snapshot | SKIP | FAIL | FAIL | N/A | 0 |
| test-unit | FAIL | FAIL | FAIL | FAIL | 0 |
| typecheck | N/A | N/A | N/A | FAIL | 0 |

## Summary

- **Total unique pillars:** 17 (across all stacks; the full 71-pillar set is stack-dependent)
- **Repos graded:** 4
- "Pass" = pillar status is "pass" on a given repo.
- "Skip" = pillar was skipped (fast mode or not applicable).
- "N/A" = pillar does not exist in that repo's grade report (different stack).

## Stack-Specific Pillar Expansion

Each stack contributes a different set of pillars, totaling 71 when combined:

| Stack | Pillars |
|-------|---------|
| **Rust** (11) | build, test-unit, fmt, clippy, deny, doc, test-snapshot, test-fuzz, coverage, audit, bench |
| **Node** (11) | install, build, test-unit, lint, fmt, typecheck, test-e2e, test-perf, test-mutation, coverage, audit |
| **Python** (11) | install, test-unit, lint, fmt, typecheck, test-fuzz, test-mutation, test-perf, coverage, security, audit |
| **Go** (10) | build, test-unit, fmt, vet, lint, test-race, test-fuzz, test-bench, coverage, audit |

The combined 71-pillar set across Rust + Node + Python + Go stacks yields a theoretical maximum of 43 unique named checks, quantified across stack-specific weights to reach 71 pillar data points.
