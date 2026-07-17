---
repo: "phenoUtils"
role: utility-crate-family
status: absorbed
absorbed_into: pheno/crates/pheno-utils-*/
absorbed_on: 2026-07-17
wave: 2026-07-17-queue-refresh-2
last_boundary_review: 2026-07-17
review_cadence: 30d
in_scope:
  - "Substrate-utility primitives shared across the pheno monorepo"
  - "tokio-based async shell exec, fs walking, http helpers"
  - "Crypto primitives (AES-GCM, HMAC, base64)"
  - "Async patterns (barrier, latch, pool)"
  - "Testing harness (wiremock fixtures)"
  - "Chaos fault injection"
out_of_scope:
  - "High-level business logic (lives in feature crates)"
  - "Language SDK surfaces (lives in phenotype-{python,go,ts}-sdk)"
---

# Boundary — phenoUtils

## In Scope

The `pheno-utils-*` crate family provides substrate-utility primitives:

- **pheno-utils-shell**: tokio-based async shell exec, command builders
- **pheno-utils-fs**: async file walker, hashing, fs operations
- **pheno-utils-net**: reqwest wrapper, URL helpers, retry semantics
- **pheno-utils-async**: async patterns (barrier, latch, pool)
- **pheno-utils-crypto**: AES-GCM, HMAC, base64 primitives
- **pheno-utils-testing**: wiremock harness, fixtures
- **pheno-utils-chaos**: `FaultInjector` chaos testing primitive

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Business logic | feature crates (`phenotype-*`) | Different layer |
| Language SDKs | `phenotype-{python,go,ts}-sdk` | Cross-language boundary |
| Observability primitives | `PhenoObservability` | Distinct domain |
| Workspace orchestration | `pheno` root | Different abstraction |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| `tokio` deps | external→pheno | Cargo.toml | green |
| `reqwest` wrapper | external→pheno | Cargo.toml | green |
| `wiremock` test harness | external→pheno (test-only) | Cargo.toml dev-deps | green |
| Chaos injection API | internal pheno crates | `pheno_utils_chaos::FaultInjector` | green |

## Last Boundary Review

**Date:** 2026-07-17
**Reviewer:** forge subagent (wave 2026-07-17-queue-refresh-2)
**Decision:** ABSORBED into `pheno/crates/pheno-utils-*/`
**Source repo:** `KooshaPari/phenoUtils` archived 2026-07-17

**Next review:** 2026-08-17