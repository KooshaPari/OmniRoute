# Architecture Decision Records (ADR) — Index

> **Status:** Living index — new ADRs are appended, old ones are never deleted.
> **Last updated:** 2026-06-14

## Format

We follow the Nygard ADR format: each decision is a numbered Markdown file in `docs/adr/` with Context, Decision, Consequences, and Status sections.

## Recorded Decisions

| # | Title | Status | File |
|---|-------|--------|------|
| 001 | Record Architecture Decisions | Accepted | [`docs/adr/0001-record-architecture-decisions.md`](./docs/adr/0001-record-architecture-decisions.md) |
| 002 | Stack: Native iOS + Rust core (reject Tauri/RN/Flutter) | Accepted | `docs/adr/0002-stack-native-ios-rust.md` |
| 003 | Privacy: local-first SQLite, optional cloud sync | Accepted | `docs/adr/0003-privacy-local-first.md` |
| 004 | Connectors: trait-based runtime with OAuth2 | Accepted | `docs/adr/0004-connectors-trait-runtime.md` |
| 005 | Auth: OAuth2 + keychain, no custom auth server | Accepted | `docs/adr/0005-auth-oauth2-keychain.md` |
| 006 | Rules: DSL with JSON serialization, no WASM | Accepted | `docs/adr/0006-rules-dsl-json.md` |
| 007 | iOS: FamilyControls over Screen Time API | Accepted | `docs/adr/0007-ios-familycontrols.md` |
| 008 | Mascot: Spline runtime, Rive fallback | Accepted | `docs/adr/0008-mascot-spline.md` |
| 009 | Sync: CRDT for multi-device, deferred to Phase 3 | Accepted | `docs/adr/0009-sync-crdt.md` |

## How to Add a New ADR

1. Pick the next sequential number.
2. Create `docs/adr/NNNN-<short-title>.md`.
3. Update this index.
4. Open a PR; link the ADR in the PR description.

## References

- [ADR-001: Record Architecture Decisions](./docs/adr/0001-record-architecture-decisions.md)
- [`SPEC.md`](./SPEC.md) — system architecture
