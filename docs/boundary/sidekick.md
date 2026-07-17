---
repo: "sidekick"
role: absorbed
status: absorbed
absorbed_at: 2026-07-17
absorbed_into: PhenoObservability
wave: 2026-07-17-queue-refresh-2
disposition: ABSORB
last_boundary_review: 2026-07-17
review_cadence: 30d
in_scope:
  - sidekick-messaging (messaging patterns/contracts)
  - sidekick-obs-core (correlation, health, metrics, log-levels)
  - sidekick-observability (tracing initialization)
out_of_scope:
  - any future sidekick-* crates (must target PhenoObservability or be
    re-justified as a separate spine)
---

# Boundary — sidekick (absorbed)

The Sidekick repository has been absorbed into PhenoObservability as three
workspace crates. Source repo archived 2026-07-17.

## In Scope

- crates/sidekick-messaging — messaging patterns/contracts
- crates/sidekick-obs-core — correlation, health, metrics, log-levels
- crates/sidekick-observability — tracing initialization

## Out of Scope

- Any future sidekick-* crate that doesn't fit PhenoObservability scope
  (must be re-justified or absorbed elsewhere).