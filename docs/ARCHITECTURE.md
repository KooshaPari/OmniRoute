# argismonitor Architecture

## High level

```
┌──────────────────────────┐    HTTP / WS      ┌────────────────────────┐
│ apps/web (SvelteKit 2)   │ ────────────────► │ apps/web BFF (Hono 4) │
│  + Svelte 5 runes        │                   │  /api/* + /api/kbridge│
│  + Tailwind v4 + bits-ui │                   └─────────┬──────────────┘
└──────────┬───────────────┘                             │ Unix socket
           │ Tauri webview (WebKit/WKWebView)            ▼
┌──────────▼───────────────┐                   ┌────────────────────────┐
│ apps/desktop (Tauri 2)   │ ◄─── Tauri IPC ──►│ crates/gateway         │
│  + tray + menu + plugins │                   │  KbridgeClient +       │
│  + stronghold + updater  │                   │  GatewayProcess        │
└──────────────────────────┘                   └─────────┬──────────────┘
                                                         │ spawns + supervises
                                                         ▼
                                              ┌────────────────────────┐
                                              │ omniroute-server (Rust)│
                                              │  /v1/chat/completions  │
                                              │  /api/dashboard/gateway│
                                              │  + kbridge daemon      │
                                              └────────────────────────┘
```

## Data flow: chat completion

1. Browser: `fetch('/api/chat/completions', { body: ChatRequestEnvelope, stream: true })`.
2. SvelteKit `hooks.server.ts` `handle` dispatches `/api/*` to Hono.
3. Hono `chatRoute.post('/completions')` calls `dispatchStream(env)`.
4. v1: stub (returns canned chunks).
5. v2: `callKbridge(KbridgeRequest::ComboResolve)` → `omniroute-server` → returns resolved steps → `pipeline::run` → SSE back to client.
6. SvelteKit `streamSSE` writes events; client `consumeSse` parses `ChatChunk`.

## Data flow: kbridge from Tauri webview

1. Webview calls `invoke('plugin:omniroute-gateway|health_kbridge')`.
2. Tauri command hits `KbridgeClient::call(KbridgeRequest::Health)`.
3. `KbridgeClient` opens `/var/run/omniroute/gateway.sock`, frames request as 4-byte BE length + msgpack.
4. `omniroute-server`'s `kbridge` listener replies with `KbridgeResponse`.
5. `KbridgeClient` parses and returns to Tauri command; webview gets a typed JS object.

## Canonical types

`packages/shared-types/src/index.ts` exports all Zod schemas. Both TS and Rust code reference these via mirror (Zod → Rust serde derives). Parity CI gate (`tools/scripts/src/parity-check.ts`) catches drift.
