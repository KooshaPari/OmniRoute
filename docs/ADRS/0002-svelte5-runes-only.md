# ADR-0002: Svelte 5 runes only

**Status**: Accepted (2026-07-04)

## Context

The v3 prototype mixed Svelte 3/4 stores (`writable()`, `$:`) with the new Svelte 5 runes. This created two reactivity models in one file and conflated store semantics with component state.

## Decision

- Runes (`$state`, `$derived`, `$effect`, `$props`) ONLY.
- `compilerOptions.runes: true` in `svelte.config.js`.
- `$lib/server/*` runs only on the server; client bundles never include server code.

## Consequences

- Smaller, faster, more predictable reactivity model.
- Migration cost is concentrated in the v3→v4 PR.

## Alternatives

- Dual mode (runes + stores) — rejected for the consistency reasons above.
