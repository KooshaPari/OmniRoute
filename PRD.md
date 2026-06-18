# Product Requirements Document (PRD) — FocalPoint

> **Status:** Living document — updated as features ship or pivot.
> **Last updated:** 2026-06-14

## 1. Product Vision

FocalPoint is a **connector-first screen-time management platform** that turns behavioral signals from productivity, education, and health platforms into context-aware enforcement rules. Parents set policies; the system enforces them on a child's iOS device using native FamilyControls APIs.

## 2. Target Users

| Persona | Primary need |
|---------|-------------|
| **Parent (primary)** | Enforce screen-time policies on child's iOS device, track compliance, manage rewards/penalties |
| **Individual (future)** | Self-directed behavioral coaching with calendar-synced focus sessions |

## 3. Core Feature Areas

### 3.1 Rules Engine
- DSL for authoring conditions, triggers, and actions
- 12 condition primitives, 6 actions, schedule triggers, cooldowns
- Explainability: every decision includes a human-readable rationale

### 3.2 Connector Runtime
- OAuth2-based ingestion from Canvas LMS, Google Calendar, GitHub, fitness trackers
- Polling + webhook hybrid sync
- Verification tiers: Official > Verified > MCPBridged > Private

### 3.3 Reward / Penalty Ledger
- Dual-ledger: credits earned/spent, streaks, multipliers
- Penalty tiers: Hard (cannot bypass), Semi (warning + grace), Soft (notification only)
- Bypass budget tracking and escalation

### 3.4 Audit Chain
- SHA256-chained, tamper-evident log
- Verification on startup; any mismatch = tamper detected

### 3.5 iOS Enforcement
- SwiftUI app shell (5 tabs: Home, Tasks, Rules, Activity, Settings)
- FamilyControls integration (`ManagedSettingsStore` / `DeviceActivityCenter`)
- Coachy mascot (SwiftUI render, Rive animation pending)

## 4. Out of Scope (Deferred)

- Android native app (JNI stubs exist; no runtime)
- Backend services beyond webhook-ingest placeholder
- Full production OAuth flows for GCal and GitHub (scaffolded only)
- External security audit

## 5. Release Criteria

- [ ] Workspace compiles green (`cargo build --workspace`)
- [ ] All unit tests pass (`cargo test --workspace`)
- [ ] Clippy lint clean (`cargo clippy --workspace -- -D warnings`)
- [ ] iOS app compiles in Xcode 15.2+
- [ ] FamilyControls entitlement approved by Apple

## 6. References

- [`SPEC.md`](./SPEC.md) — implementation-level specification
- [`docs/roadmap_v2.md`](./docs/roadmap_v2.md) — phased roadmap
- [`docs/reference/honest_coverage.md`](./docs/reference/honest_coverage.md) — feature-by-feature audit
