# Plan — FocalPoint

> **Status:** Phased roadmap. See [`docs/roadmap_v2.md`](./docs/roadmap_v2.md) for the detailed version.
> **Last updated:** 2026-06-14

## Phase 1: Core Platform (IN PROGRESS ~85%)

**Goal:** Portable Rust core + iOS shell that compiles and runs in simulator.

- [x] Domain layer: events, rules, wallet, penalties, audit chain
- [x] Connector runtime: trait + registry + Canvas OAuth
- [x] iOS app shell: SwiftUI, 5 tabs, rule authoring wizard
- [x] CLI (`focus`): demo seed, tasks, rules, wallet, audit
- [ ] **BLOCKER:** Fix 5 E-series compilation errors (backup, rituals, 3× connectors)
- [ ] **BLOCKER:** Apple FamilyControls entitlement approval

## Phase 2: Connector Ecosystem

**Goal:** 4+ working connectors with real-world data ingestion.

- [ ] Complete GCal OAuth flow
- [ ] Complete GitHub OAuth flow
- [ ] Fitbit / Strava connector stubs → full implementations
- [ ] Readwise / Notion / Linear event mapping

## Phase 3: Multi-Device & Sync

**Goal:** iPhone + iPad + Apple Watch companion.

- [ ] Multi-device CRDT sync (see ADR-009)
- [ ] Watch companion app (scaffolded in design docs)
- [ ] Cloud sync layer (optional PostgreSQL backend)

## Phase 4: Production Hardening

**Goal:** App Store submission readiness.

- [ ] Onboarding UX (0 → 5+ screens)
- [ ] Designer assets: Coachy Rive animation
- [ ] Real-device QA with approved entitlement
- [ ] External security audit
- [ ] App Store metadata, screenshots, privacy policy

## Phase 5: Backend Services

**Goal:** Optional hosted backend for power users.

- [ ] Auth broker (OAuth2 proxy)
- [ ] Sync API (REST + GraphQL)
- [ ] Webhook ingest service

## Phase 6: Expansion

**Goal:** Android, enterprise, and marketplace.

- [ ] Android Kotlin/Compose app (JNI bindings exist)
- [ ] Connector marketplace (in-app purchases)
- [ ] Enterprise: MDM integration, SSO

## Honest Gaps (Blocking Any Release)

1. **Workspace compilation** — 5 crates fail to compile
2. **FamilyControls entitlement** — Apple review SLA 1–4 weeks
3. **Onboarding UX** — zero screens shipped
4. **GCal/GitHub OAuth** — scaffolded but non-functional

## References

- [`docs/roadmap_v2.md`](./docs/roadmap_v2.md) — detailed 6-phase roadmap with effort estimates
- [`docs/reference/honest_coverage.md`](./docs/reference/honest_coverage.md) — shipped vs scaffold audit
- [`docs/research/open_questions.md`](./docs/research/open_questions.md) — tracked unknowns
- [`PRD.md`](./PRD.md) — product requirements
- [`SPEC.md`](./SPEC.md) — system specification
