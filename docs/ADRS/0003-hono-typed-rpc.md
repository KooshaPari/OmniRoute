# ADR-0003: Hono 4 + hono/client typed RPC

**Status**: Accepted (2026-07-04)

## Context

The web app needs to call the BFF for /api/*. The TS prototype used a hand-rolled `fetch` wrapper with ad-hoc types.

## Decision

- Hono 4 in `apps/web/src/lib/server/hono/app.ts`.
- `hono/client` `hc<AppType>` in `packages/sdk-js`.
- The SDK ships a placeholder `SdkAppType` until the real Hono app is wired; route shape stays identical so the swap is one line.

## Consequences

- TS clients get end-to-end type safety on the request/response shapes.
- One source of truth: the Hono route registrations.
