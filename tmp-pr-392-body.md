## Summary
First #392 slice for v4 compatibility-shell integrity:

- **Auth model:** production dashboard/tRPC/v1 accept Bearer/`x-api-key` **or** a non-empty `session` cookie from `/api/auth/*`. Browser never embeds `BFF_API_KEY`.
- **CORS:** `BFF_CORS_ORIGINS` drives a bounded allowlist (was hard-coded `:4321` only).
- **Origin:** shared `bffBaseUrl()` / `bffApiUrl()` for login, callback, API, and tRPC clients.
- **Honesty:** non-persistent tRPC mutations return `{ ok: false, status: 'unavailable', source: 'no-*-store' }`.
- **Tests:** security boundary (cookie + callback Set-Cookie chain), CORS parser, tRPC honesty (26 local BFF tests green).

## Out of scope (follow-on)
- KBridge deadline/inflight/Windows pipes
- Root Bun workspace/release gate
- Full dashboard page sweep of remaining hard-coded `:4322` fetches
- Cryptographic session validation beyond cookie presence

## Test plan
- [x] `apps/bff` vitest: security-boundary, cors-origins, index (incl. tRPC honesty)
- [ ] CI Build + PR Test Policy on this PR
- [ ] Spot-check login/callback still hit configured BFF origin
