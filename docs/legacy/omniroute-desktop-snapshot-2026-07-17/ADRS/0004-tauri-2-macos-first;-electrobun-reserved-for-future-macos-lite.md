# ADR-0004: Tauri 2 macOS-first; Electrobun reserved for future macOS-lite

**Status**: Accepted (2026-07-04)
**Deciders**: argismonitor core
**Supersedes**: —
**Superseded by**: —

## Context

UTauri 2 macOS-first; Electrobun reserved for future macOS-lite matters in this fork because the prior prototype
(2026) used a different stack and accumulated tech debt that needs replacement.

## Decision

We adopt the policy above for v4.0 and beyond.

## Consequences

**Positive**
- Aligns the codebase with the rest of the Phenotype/OmniRoute fleet.
- Removes a class of subtle bugs and migration debt.

**Negative**
- Initial PRs are larger because no shims/back-compat layers are allowed.
- New contributors must learn the conventions in this ADR.

## Alternatives considered

1. Status quo with shims — rejected per the no-back-compat-shims ADR.
2. Full rewrite from scratch — rejected; existing primitives are sound.

## References

- ../sessions/20260705-argismonitor-monorepo-bootstrap/00_SESSION_OVERVIEW.md
