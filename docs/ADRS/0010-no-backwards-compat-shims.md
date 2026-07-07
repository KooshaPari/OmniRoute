# ADR-0010: No backwards-compat shims

**Status**: Accepted (2026-07-04)

## Context

The v3 prototype had a year of "we'll deprecate that later" code paths. Most were never deprecated.

## Decision

- When replacing, replace fully.
- No feature flags for old vs new behavior.
- No dual-export paths.
- Migration windows are documented in CHANGELOG.md only.

## Consequences

- Codebase stays simple and performant.
- Each breaking change is a single PR.
