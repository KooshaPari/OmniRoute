# Functional Requirements — FocalPoint

> **Status:** Living traceability matrix.
> **Last updated:** 2026-06-14

## Conventions

- Every requirement has a stable ID: `FR-{DOMAIN}-{NNN}`.
- IDs are referenced in tests, code comments, and PR descriptions.
- A requirement is **SHIPPED** when the feature works and has test coverage.
- A requirement is **SCAFFOLD** when types/interfaces exist but behavior is incomplete.
- A requirement is **DEFERRED** when it is explicitly out of scope for the current phase.

## Domain Index

| Domain | Prefix | Count |
|--------|--------|-------|
| Connectors | `FR-CONN` | 004 |
| Events | `FR-EVT` | 003 |
| Rules | `FR-RULE` | 005 |
| State / Wallet | `FR-STATE` | 005 |
| Enforcement | `FR-ENF` | 003 |
| Data / Sync | `FR-DATA` | 003 |
| UX / Onboarding | `FR-UX` | 003 |

## Connector Requirements (FR-CONN)

| ID | Requirement | Status | Test Trace |
|----|-------------|--------|------------|
| FR-CONN-001 | Canvas OAuth2 handshake and token refresh | SHIPPED | `connector-canvas` wiremock tests |
| FR-CONN-002 | Connector trait contract: `manifest`, `health`, `sync` | SHIPPED | `focus-connectors` trait tests |
| FR-CONN-003 | Webhook signature verification and dispatch | SHIPPED | `focus-connectors` webhook tests |
| FR-CONN-004 | Canvas sync cursor persistence and conflict resolution | SCAFFOLD | `unimplemented!()` in source |

## Event Requirements (FR-EVT)

| ID | Requirement | Status | Test Trace |
|----|-------------|--------|------------|
| FR-EVT-001 | SHA256-chained event deduplication | SHIPPED | `focus-events` unit tests |
| FR-EVT-002 | Normalized event schema v3 | SHIPPED | `focus-events` schema validation |
| FR-EVT-003 | Event sourcing replay from audit chain | SHIPPED | `focus-audit` integration tests |

## Rules Requirements (FR-RULE)

| ID | Requirement | Status | Test Trace |
|----|-------------|--------|------------|
| FR-RULE-001 | 12 condition primitives | SHIPPED | `focus-rules` 60+ tests |
| FR-RULE-002 | 6 action kinds (GrantCredit, DeductCredit, Block, Unblock, StreakIncrement, StreakReset) | SHIPPED | `focus-rules` action tests |
| FR-RULE-003 | Schedule triggers and cooldowns | SHIPPED | `focus-rules` schedule tests |
| FR-RULE-004 | Priority conflict resolution | SHIPPED | `focus-rules` conflict tests |
| FR-RULE-005 | LLM-assisted rule authoring | SCAFFOLD | `focus-coaching` trait only |

## State / Wallet Requirements (FR-STATE)

| ID | Requirement | Status | Test Trace |
|----|-------------|--------|------------|
| FR-STATE-001 | Credit balance invariants (>= 0, spent <= earned) | SHIPPED | `focus-rewards` invariant tests |
| FR-STATE-002 | Streak tracking with multipliers | SHIPPED | `focus-rewards` streak tests |
| FR-STATE-003 | Penalty lockout tiers (Hard / Semi / Soft) | SHIPPED | `focus-penalties` tier tests |
| FR-STATE-004 | Bypass budget tracking and escalation | SHIPPED | `focus-penalties` escalation tests |
| FR-STATE-005 | Audit line on every wallet mutation | SHIPPED | `focus-audit` + `focus-rewards` integration |

## Enforcement Requirements (FR-ENF)

| ID | Requirement | Status | Test Trace |
|----|-------------|--------|------------|
| FR-ENF-001 | FamilyControls block/unblock via ManagedSettingsStore | SCAFFOLD | Awaiting Apple entitlement |
| FR-ENF-002 | iOS rule authoring wizard (4-step) | SHIPPED | SwiftUI tests |
| FR-ENF-003 | Onboarding flow (0 screens) | SCAFFOLD | No UI shipped |

## Data / Sync Requirements (FR-DATA)

| ID | Requirement | Status | Test Trace |
|----|-------------|--------|------------|
| FR-DATA-001 | SQLite local-first persistence | SHIPPED | `focus-storage` tests |
| FR-DATA-002 | Multi-device sync cursor | SCAFFOLD | `focus-sync` scaffolded |
| FR-DATA-003 | Backup/restore with age encryption | SCAFFOLD | `focus-backup` E0505 error |

## UX / Onboarding Requirements (FR-UX)

| ID | Requirement | Status | Test Trace |
|----|-------------|--------|------------|
| FR-UX-001 | SwiftUI tab shell (Home, Tasks, Rules, Activity, Settings) | SHIPPED | UI tests |
| FR-UX-002 | Coachy mascot render (SwiftUI placeholder) | PARTIAL | `.riv` Rive pending |
| FR-UX-003 | i18n: Spanish + Japanese (122 strings) | SHIPPED | `Localizable.xcstrings` |

## References

- [`SPEC.md`](./SPEC.md) — interface specification
- [`PRD.md`](./PRD.md) — product requirements
- [`docs/adr/`](./docs/adr/) — architecture decisions
- [`docs/reference/honest_coverage.md`](./docs/reference/honest_coverage.md) — honest feature audit
