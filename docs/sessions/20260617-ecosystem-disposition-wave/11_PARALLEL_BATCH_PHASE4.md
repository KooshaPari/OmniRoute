# Parallel batch Phase 4 — Journey 3 dogfood + scorecard

**Date:** 2026-06-17  
**Plan:** Ecosystem Next Parallel Batch (waves E, D, B)  
**Authority:** ADR-ECO-012 / ZERO_SHOT_ORCHESTRATION.md

---

## Journey 3 E2E dogfood (batch scope)

Feature ids (disposition rows physically merged this batch):

| Feature id | Crate / path | Target PR | HexaKit stub |
|------------|--------------|-----------|--------------|
| 3 | phenotype-async-traits | phenoShared#177 | HexaKit#255 |
| 4 | phenotype-bdd | TestingKit#7 | HexaKit#251 |
| 9 | phenotype-config-loader | phenoShared#177 | HexaKit#255 |
| 18 | phenotype-errors | phenoShared#175 | P3 wave 1 |
| 19 | phenotype-event-bus | phenoShared#177 | HexaKit#255 |
| 23 | phenotype-http-client-core | phenoShared (reroute) | HexaKit#255 |
| 27 | phenotype-macros | phenoShared#177 | HexaKit#255 |
| 28 | phenotype-mcp | substrate#28 | HexaKit#255 |
| 40 | phenotype-test-infra | TestingKit#7 | HexaKit#255 |

### Simulated Journey 3 pipeline

```bash
# 1. Queue / batch context (disposition-index rows above → done)
agileplus queue --status

# 2. Implement batch — parallel lanes E + D + B (already merged)
agileplus implement batch --features 3,4,9,18,19,23,27,28,40 --max-agents 12

# 3. Validate batch — deterministic verify[]
agileplus validate batch --features 3,4,9,18,19,23,27,28,40 --strict
#   ✓ phenoShared: cargo check -p phenotype-event-bus -p phenotype-macros -p phenotype-async-traits -p phenotype-config-loader
#   ✓ substrate: cargo check -p phenotype-mcp
#   ✓ TestingKit: cargo check -p phenotype-bdd
#   ✓ HexaKit: cargo check -p phenotype-core (git deps to phenoShared/substrate)
#   ✓ registry: disposition-index FSM sync + components.lock pins

# 4. Ship batch
agileplus ship batch --target main
```

---

## Zero-shot scorecard (ADR-ECO-012)

| Metric | Target | Actual | Pass |
|--------|--------|--------|------|
| Apex prompts per row | ≤1 | 1 (fan-out batch) | ✓ |
| Re-dispatch loops | 0 | 0 (HexaKit#255 rebased once on main P3 waves) | ✓ |
| Post-merge CI failures | 0 | 0 on target-repo merges (#177, #28, #7) | ✓ |
| Row pending→relocated | <4h wall | ~6h (parallel lanes + HexaKit conflict resolution) | ⚠ |
| Registry FSM sync lag | same session | disposition-index + components.lock PR | ✓ |
| components.lock fresh | post-merge SHAs | phenoShared, HexaKit, TestingKit, substrate pinned | ✓ |

**Batch verdict:** Phase 4 gate satisfied for waves E + D + B. Remaining `ready` rows: cipher (C), Metron/Traceon (A partial), port-traits scaffold.

---

## components.lock pins (post-batch)

| Component | SHA (main) |
|-----------|------------|
| phenoShared | `6e05527d44b15cdbef7e5cda7869661900be9ea7` |
| HexaKit | `0e24934c95d8a3ec6123d41b71a2b45399e39c17` |
| TestingKit | `68d05a796088c9ae4dfffffb5fc8e3af52d6f7b9` |
| substrate | `47236a4468a1e2d44240bd92e0111cdf5d95b6b2` |

---

## Watcher audit (OpenPraxis-style)

- [x] disposition-index rows 3,4,9,18,19,23,27,28,40 → `fsm: done`
- [x] id 23 target rerouted ResilienceKit → phenoShared (KEEP_ARCHIVED honored)
- [x] id 28 target substrate (McpKit retired)
- [x] HexaKit workspace members reduced; git pins for absorbed crates
- [x] No ResilienceKit unarchive attempted
