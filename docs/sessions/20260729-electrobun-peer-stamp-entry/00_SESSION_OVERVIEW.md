# Electrobun peer-stamp entrypoint

## Goal

Ensure the Electrobun desktop shell uses the same standalone entrypoint policy as
the established Electron desktop runtime.

## Decision

Prefer `server-ws.mjs` when it is present in the standalone directory; fall
back to `server.js` for older standalone bundles. The wrapper is necessary for
local-only routes, while the fallback preserves compatibility with bundles that
predate it.

## Validation

- `node --import tsx/esm --test tests/unit/desktop-electrobun-server-entry.test.ts`
- `bun run typecheck` from `desktop-electrobun/`
- `bun run build` from `desktop-electrobun/`
