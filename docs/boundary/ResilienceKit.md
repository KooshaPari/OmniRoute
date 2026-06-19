---
repo: "ResilienceKit"
role: resilience
status: active
last_boundary_review: 2026-06-19
review_cadence: 30d
---

# Boundary — ResilienceKit

**Exemplar domain workspace** for `resilience`: retry, rate-limit, policy, health traits, HTTP client core, cache adapter, port traits.

## Out of scope

| Capability | Owner |
|------------|-------|
| Event sourcing / store | **Eventra** |
| Generic `Contract` | **phenotype-rust-sdk** |
| Python edge | **phenotype-python-sdk** `resilience-kit` |

N1: workspace trimmed to 12 on-disk crates; event-sourcing git pin → Eventra. See ResilienceKit `docs/boundary/DOMAIN.md`.
