# 02_SPECIFICATIONS

## Functional spec

| Endpoint / page | Method | Path | Auth | Notes |
|---|---|---|---|---|
| List providers | GET | /api/providers | yes | Returns ProviderPublic[] (no auth secrets) |
| Create provider | POST | /api/providers | editor+ | Creates ProviderConfig; status starts as `provisioning` |
| Update provider | PATCH | /api/providers/:id | editor+ | Patches fields; bumps updatedAt |
| Delete provider | DELETE | /api/providers/:id | owner | Soft-delete; sets `status: 'disabled'` |
| Ping provider health | POST | /api/providers/:id/health | yes | Proxies to kbridge health |
| List combos | GET | /api/combos | yes | |
| Create combo | POST | /api/combos | editor+ | |
| Resolve combo | POST | /api/combos/resolve | yes | Calls kbridge.combo_resolve |
| List API keys | GET | /api/apikeys | yes | Last-4 fingerprint only |
| Create API key | POST | /api/apikeys | editor+ | Returns plain secret ONCE |
| Revoke API key | DELETE | /api/apikeys/:id | editor+ | |
| Chat completions | POST | /api/chat/completions | yes | SSE when stream=true |
| List usage | GET | /api/usage | yes | cursor-paginated |
| Usage aggregate | GET | /api/usage/aggregate | yes | |
| Health | GET | /api/health | yes | Proxies kbridge.health |
| Login | POST | /api/auth/login | no | password or oauth |
| Logout | POST | /api/auth/logout | yes | |
| Me | GET | /api/auth/me | yes | |
| Kbridge (browser) | WS | /api/kbridge | yes | Frames proxied to Unix socket |
| Kbridge (Tauri) | command | `kbridge::ping` etc | yes | Native → Unix socket |

## ARUs

| Risk | Mitigation |
|---|---|
| Paragon kbridge drift | Parity CI gate (`tools/scripts/src/parity-check.ts`) |
| SvelteKit 2 ↔ Hono 4 dispatcher edge cases | Integration tests via Playwright |
| Tauri 2 WebKitGTK on Linux | Out of scope for v4.0 macOS GA |
| Auth provider (Arctic 3.7) breaking change | Pin in `package.json` engines |
