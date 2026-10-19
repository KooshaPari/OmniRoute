# 02 — Usability State (live probes)

Every row below is an **observed** HTTP result, not an inference.

## The app runs

```
GET  /api/health                    -> 200  {"status":"ok","timestamp":"2026-10-17T00:44:43.705Z"}
GET  /login                         -> 200  745,663 bytes
                                             <title>OmniRoute — AI Gateway for Multi-Provider LLMs</title>
POST /api/auth/login                -> 200  {"success":true}   + auth_token cookie set
GET  /dashboard (with cookie)       -> 200
GET  /api/auth/status (with cookie) -> {"authenticated":true}
GET  /api/settings/require-login    -> 200  {"authenticated":false,"requireLogin":true,
                                            "hasPassword":true,"setupComplete":true,
                                            "nodeVersion":"v26.8.1","nodeCompatible":true}
GET  /api/v1/models                 -> {"object":"list","data":[{"id":"auto/best-coding",
                                            "context_length":1048576, ...}]}
GET  /                              -> 307  (auth redirect — correct)
GET  /setup                         -> 404  (already complete — correct)
GET  /api/status                    -> 401  (auth required — correct)
```

The dev server binds **port 20128** for the app; 20131 (embed WS proxy) and
20132 (LiveWS dashboard) are WebSocket endpoints and correctly return `426
Upgrade Required` to plain HTTP.

Startup does real work — this is not a stub server:

```
[DB] SQLite database ready: ~/.omniroute/storage.sqlite
[OpenRouterProviderStats] Initial sync complete: 135 providers
[Cleanup] Background cleanup scheduler started (every 6 hours).
[COMPLIANCE] Audit log table initialized
[MEMORY_MANAGER] Configured backends {"primary":"sqlite","fallbacks":[]}
```

## The gateway routes

```
POST /api/v1/chat/completions
  -> HTTP 503
  {"error":{"message":"Service temporarily unavailable: all targets were skipped
   by pre-dispatch filters","type":"service_unavailable",
   "code":"ALL_TARGETS_SKIPPED"},
   "diagnostics":{"poolSize":8,"attempted":0,"excluded":[],
   "terminalReason":"all_targets_skipped",
   "recovery":{"action":"switch-combo","next_step":"..."}}}
```

**This is the correct behaviour with no provider credentials.** The request was
accepted, authenticated, routed to combo `auto/best-coding`, and a pool of **8
targets** was built. It stopped because none of the 8 has credentials or quota.
The response even carries a `recovery.action` and `next_step` — the pipeline is
wired end to end.

## What was broken, and what fixed it

### Defect 1 — every page returned HTTP 500

Root cause was **server-only code leaking into the client bundle**:

```
src/app/login/page.ts
  -> src/shared/components
    -> ModelSelectModal
      -> src/shared/constants/models
        -> open-sse/config/providerModels
          -> open-sse/config/providers/index
            -> registry/codebuddy-cn/index
              -> src/lib/oauth/constants/oauth.ts
                -> open-sse/utils/cursorAgentCliVersion.ts   <-- node:fs at top level
```

`oauth.ts` needed only the **string** `CURSOR_AGENT_CLI_VERSION`, but importing
it dragged `node:fs` / `node:os` / `node:path` into the browser build. Webpack
failed with:

```
UnhandledSchemeError: Reading from "node:fs" is not handled by plugins
```

Turbopack reported the same failure differently (`ENOENT .../login/page/build-manifest.json`),
which is why it first looked like a manifest bug rather than an import leak.

**Fix (commit `42f50de195`):** the constant moved to a dependency-free module
(`open-sse/utils/cursorAgentCliVersion.constants.ts`); the original module
re-exports it so its public API is unchanged; `oauth.ts` imports the new module.
Result: `/login` went 500 → 200.

### Defect 2 — a truncated dependency

`node_modules/tailwind-merge/dist/bundle-mjs.mjs` was **1,669 bytes** (should be
~106 KB), causing `Error: Expected '}', got '<eof>'` — a parse failure, not a
code bug. Reinstalling produced 106,124 bytes and it imports cleanly.

Earlier the same cause corrupted `@swc/core-darwin-arm64`: a 23,789,788-byte
binary whose Mach-O header claimed 24,920,064 bytes, failing `dlopen` with
_"segment '\__TEXT' content extends beyond end of file"_.

**Both truncations were caused by disk pressure** — the volume was at 99% full
during install. This is a systemic hazard, not a one-off.

## What is NOT verified

- **The production build** (`npm run build`) has **never completed** on this
  machine. Turbopack's worker pool is killed under memory pressure (swap
  exhausted at 13.9 GB / 14.3 GB); `.build` froze at 1,428 KB with 0 workers
  alive. Attempted twice.
- **A real streaming completion** — needs a provider credential.
- **The Playwright/E2E suite** — not run.
- **Desktop builds** (`electron/`, `desktop-electrobun/`) — not exercised.

## Required secrets — the last mile

`.env` currently has **no provider credentials**. Every provider key name is
absent; only `API_KEY_SECRET` (64 chars) is set.

| Variable                 | State      | Consequence                                                                                                                                                                                                                                                                            |
| ------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `STORAGE_ENCRYPTION_KEY` | **EMPTY**  | `encrypt()` is a **silent passthrough** — provider keys would be written to the DB **in plaintext**. From the source: _"silent passthrough without STORAGE_ENCRYPTION_KEY, which is the default for a fresh install — so writing a service-account key would land it in [plaintext]"_. |
| `INITIAL_PASSWORD`       | `CHANGEME` | Default password still active                                                                                                                                                                                                                                                          |
| provider key (any)       | **absent** | Gateway has 0 usable targets                                                                                                                                                                                                                                                           |

**Set `STORAGE_ENCRYPTION_KEY` BEFORE adding any provider credential.**
`openssl rand -base64 32`.

## Verdict

**The app is usable.** It builds a real UI, authenticates, persists to SQLite,
syncs 135 providers, and routes gateway requests with structured diagnostics.
The remaining gap to a working end-to-end completion is **one provider
credential plus an encryption key** — operator-supplied secrets, not code.
