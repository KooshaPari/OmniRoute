# ADR-0005: Zod schemas canonical; Rust serde via progenitor

**Status**: Accepted (2026-07-04)

## Context

Frontend + backend + native shell need to agree on the wire shape. v3 used `any` and ad-hoc TS interfaces that drifted.

## Decision

- `packages/shared-types` is the canonical Zod 4.4 source.
- All TS types derive from `z.infer<typeof Schema>`.
- Backend Rust enums/structs are mirrored exactly (kbridge Request, Provider, Combo, etc.).
- A parity script (`tools/scripts/src/parity-check.ts`) diffs Rust JSON schema exports vs Zod-derived JSON schemas; CI gate.

## Consequences

- One source of truth, even across language boundaries.
- Adding a field is a two-step PR: Zod schema + Rust struct + parity regen.
