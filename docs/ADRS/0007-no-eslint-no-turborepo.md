# ADR-0007: No ESLint. No turborepo. oxlint + oxfmt only.

**Status**: Accepted (2026-07-04)

## Context

ESLint is slow and full of legacy plugins; turborepo is overkill for a 5-package workspace.

## Decision

- `oxlint` for lint; `oxfmt` for format. Both from OXC.
- `tsgo` (TypeScript native) for typecheck + project-ref build.
- No `turborepo`, no `nx`, no `lerna`, no `nx-build`.
- `oxlint.json` pins rule set at the repo root.

## Consequences

- ~10x faster lint runs than ESLint.
- Single tool per concern (lint, format, typecheck).
