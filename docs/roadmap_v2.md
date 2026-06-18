# Roadmap v2 — FocalPoint

> **Honest 6-phase roadmap** with effort estimates, dependencies, and known gaps.
> **Last updated:** 2026-06-14

## Phase 1: Core Platform (IN PROGRESS ~85%)

**Goal:** Portable Rust core + iOS shell that compiles and runs in simulator.
**Effort estimate:** 6–8 weeks (already ~5 weeks in)

| Deliverable | Status | Blocking Issues |
|-------------|--------|-----------------|
| Rust workspace: 67 crates | SHIPPED | 5 crates fail to compile (E-series errors) |
| Domain: events, rules, wallet, penalties, audit | SHIPPED | Tests pass when workspace compiles |
| Connector runtime: trait + Canvas OAuth | SHIPPED | 44 wiremock tests |
| iOS app shell: SwiftUI, 5 tabs | SHIPPED | Simulator only |
| CLI (`focus`): demo, tasks, rules, wallet | SHIPPED | `cargo build -p focus-cli` works |
| FamilyControls enforcement | SCAFFOLD | **BLOCKED:** Apple entitlement approval |
| Onboarding UX | SCAFFOLD | **0 screens shipped** |

**Must-fix before Phase 1 complete:**
1. Fix 5 E-series compilation errors
2. Apple entitlement approval (1–4 week SLA)
3. Onboarding UX (5+ screens)

## Phase 2: Connector Ecosystem (NOT STARTED)

**Goal:** 4+ working connectors with real-world data ingestion.
**Effort estimate:** 4–6 weeks
**Dependencies:** Phase 1 complete, OAuth2 credentials

| Deliverable | Status | Notes |
|-------------|--------|-------|
| GCal OAuth + event sync | SCAFFOLD | OAuth2 scaffold exists; flow incomplete |
| GitHub OAuth + event sync | SCAFFOLD | Auth scaffold exists; event mapping pending |
| Fitbit / Strava connectors | SCAFFOLD | OAuth2 stubs only |
| Readwise / Notion / Linear | SCAFFOLD | Event mapping stubs only |
| Connector marketplace UI | SHIPPED | `ConnectorRegistry` tier-ordered catalog |

## Phase 3: Multi-Device & Sync (NOT STARTED)

**Goal:** iPhone + iPad + Apple Watch companion.
**Effort estimate:** 6–8 weeks
**Dependencies:** Phase 2 complete, cloud sync backend

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Multi-device CRDT sync | SCAFFOLD | Design doc exists; implementation deferred |
| Watch companion app | NOT STARTED | Design doc exists; no code |
| Cloud sync (PostgreSQL) | NOT STARTED | Backend deferred to Phase 5 |
| Backup/restore (age encryption) | SCAFFOLD | CLI works; iOS FFI E0505 error |

## Phase 4: Production Hardening (NOT STARTED)

**Goal:** App Store submission readiness.
**Effort estimate:** 4–6 weeks
**Dependencies:** Phase 3 complete, real-device QA

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Onboarding UX (complete) | SCAFFOLD | 0 screens → 5+ screens |
| Designer assets: Coachy Rive | PARTIAL | SwiftUI placeholder in use; `.riv` pending |
| Real-device QA | NOT STARTED | Simulator only; entitlement required |
| External security audit | NOT STARTED | Budget and vendor selection pending |
| App Store metadata | NOT STARTED | Privacy policy, screenshots, description |

## Phase 5: Backend Services (NOT STARTED)

**Goal:** Optional hosted backend for power users.
**Effort estimate:** 8–10 weeks
**Dependencies:** Phase 4 complete, infrastructure budget

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Auth broker (OAuth2 proxy) | SCAFFOLD | Placeholder only |
| Sync API (REST + GraphQL) | SCAFFOLD | Placeholder only |
| Webhook ingest service | SCAFFOLD | Placeholder only |
| Sentry monitoring | SHIPPED | SDK integrated; no live deploy |

## Phase 6: Expansion (NOT STARTED)

**Goal:** Android, enterprise, and marketplace.
**Effort estimate:** 12+ weeks
**Dependencies:** Phase 5 complete, team expansion

| Deliverable | Status | Notes |
|-------------|--------|-------|
| Android Kotlin/Compose app | NOT STARTED | JNI bindings exist; no Kotlin runtime |
| Connector marketplace (IAP) | NOT STARTED | Tier system shipped; no purchase flow |
| Enterprise: MDM + SSO | NOT STARTED | No design doc |

## Known Deviations from Earlier Claims

| Earlier Claim | Reality | Adjustment |
|---------------|---------|------------|
| "Workspace compiles" (2026-04) | 5 crates fail since 2026-04-23 | Compilation repair is P0 |
| "17 crates" (2026-01) | Now 67 crates | Scope expanded organically |
| "Android Phase 2" | Deferred beyond Phase 2 | iOS is the only mobile target until Phase 6 |
| "Backend Phase 3" | Deferred to Phase 5 | Local-first only until then |

## References

- [`PLAN.md`](../PLAN.md) — high-level plan
- [`FUNCTIONAL_REQUIREMENTS.md`](../FUNCTIONAL_REQUIREMENTS.md) — FR traceability
- [`SPEC.md`](../SPEC.md) — system specification
