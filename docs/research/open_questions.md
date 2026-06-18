# Open Questions — FocalPoint

> **Tracked unknowns** that may impact Phase 1.5+ timing.
> **Last updated:** 2026-06-14

## Phase 1.5 Blockers

| # | Question | Risk | Owner | Status |
|---|----------|------|-------|--------|
| Q1 | Will Apple approve FamilyControls entitlement? | HIGH — blocks all real-device testing | External | Submitted, 1–4 week SLA |
| Q2 | Can the 5 E-series compilation errors be fixed without redesign? | MEDIUM — `focus-backup` E0505 may need API change | @KooshaPari | In progress |
| Q3 | Does `phenotype-observably-macros` cross-repo path-dep scale? | LOW — 11 crates depend on `../PhenoObservability` | @KooshaPari | Watching |

## Phase 2+ Unknowns

| # | Question | Risk | Owner | Status |
|---|----------|------|-------|--------|
| Q4 | Which LLM provider for CoachingProvider in production? | MEDIUM — cost, latency, privacy | TBD | Not started |
| Q5 | Should GCal/GitHub OAuth be in-app or server-brokered? | MEDIUM — security vs UX tradeoff | TBD | Not started |
| Q6 | Can CRDT sync handle offline-first without cloud backend? | MEDIUM — complexity vs local-first tenet | TBD | Not started |
| Q7 | What is the App Store review timeline for screen-time apps? | HIGH — precedent risk (Apple may reject) | External | Unknown |
| Q8 | Should Android reuse the iOS SwiftUI shell via Compose? | LOW — ADR-001 already rejected cross-platform frameworks | TBD | Not started |
| Q9 | Is the `focus-builder` web editor worth integrating to iOS? | LOW — nice-to-have, not blocking | TBD | Not started |

## Resolved Questions

| # | Question | Resolution | Date |
|---|----------|------------|------|
| R1 | Tauri / RN / Flutter for cross-platform? | **Rejected** — native iOS + Android per ADR-001 | 2026-01 |
| R2 | SQLite vs Core Data for iOS? | **SQLite** — local-first, UniFFI-compatible | 2026-01 |
| R3 | Spline vs Rive for mascot animation? | **Both** — Spline runtime primary, Rive fallback | 2026-02 |

## How to Add a Question

1. Open a PR that adds a row to the appropriate table above.
2. Include context: why the question matters, what options have been considered, and what data would resolve it.
3. Link the PR to an AgilePlus spec or issue.

## References

- [`PLAN.md`](../PLAN.md) — phased roadmap
- [`docs/roadmap_v2.md`](../docs/roadmap_v2.md) — detailed roadmap with effort estimates
- [`docs/adr/`](../docs/adr/) — architecture decisions that may answer some questions
