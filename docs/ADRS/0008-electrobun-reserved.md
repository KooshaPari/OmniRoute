# ADR-0008: Electrobun reserved for future macOS-lite

**Status**: Accepted (2026-07-04)

## Context

Electrobun (Bun + native macOS webview) is promising for a future slim macOS-only build, but it is too immature for v4.0 GA.

## Decision

- v4.0 ships Tauri 2.
- We track Electrobun in `apps/desktop` as a deferred lane.
- If Electrobun reaches GA in 2026, v4.1 will add an `apps/desktop-mac` shell.

## Consequences

- We get a working v4.0 on all 3 desktop platforms now.
- Future macOS-lite is an additive swap, not a rewrite.
