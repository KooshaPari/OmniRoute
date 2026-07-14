---
repo: "phenoEvents"
role: canonical-runtime-event-bus
status: active
last_boundary_review: 2026-07-14
review_cadence: 30d
in_scope:
  - "Durable SQLite outbox, retry, DLQ, idempotency, and projection runtime"
  - "Reusable event envelopes and OTLP tracing integration"
out_of_scope:
  - "Eventra historical CQRS/event-sourcing workspace maintenance"
---

# Boundary — phenoEvents

## In Scope

Reusable Rust runtime event delivery: event envelopes, in-memory and SQLite
delivery, durable outbox relay, retry/DLQ, projections, and OTLP tracing.

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Historical Eventra workspace | `KooshaPari/Eventra` (archived) | Runtime-bus work migrated here. |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| `<capability or interface>` | `<this-repo→other|other→this-repo>` || `<this-repo→other|other→this-repo>` | `<Trait / HTTP / CLI / file / event>` | `<green|amber|red>` || `<green|amber|red>` || `<green|amber|red>` |

## Last Boundary Review

**Date:** 2026-07-14
**Reviewer:** migration completion audit
**Worklog / finding:** phenoEvents #30/#33; Eventra #78
**Decisions:**
- Canonical runtime-bus boundary established and Eventra archived.

**Next review:** 2026-10-14
