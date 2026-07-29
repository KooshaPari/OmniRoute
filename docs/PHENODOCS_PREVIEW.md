# Phenodocs Preview (Publication-Ready)

This document is the public-facing, publication-ready preview of OmniRoute.
It is the artifact that would ship to docs.phenotype.io, internal wiki, or
external documentation sites.

## Product identity

- **Name:** OmniRoute (fork: `@kooshapari/omniroute`)
- **Version:** 3.8.49-koosha.0
- **Release channel:** stable
- **Fork point:** v3.8.43 (upstream `omniroute/omniroute`)
- **Tagline:** Multi-provider LLM routing gateway with strict mode.

## One-paragraph pitch

OmniRoute is a unified API gateway for large-language-model providers. It
exposes a single OpenAI-compatible chat-completions endpoint that fans out to
multiple upstream providers (OpenAI, Anthropic, Google, Mistral, etc.) with
per-provider quota tracking, circuit-breaker failover, and cryptographic auth
caching. Operated as a long-running service with strict mode, Open SSE
streaming, and a fully embedded runtime — no sidecars required.

## What ships in this fork

### Modernized runtime

- **oxlint** replaces ESLint (3s on 3,148 files vs 90s+)
- **oxfmt** replaces Prettier (Prettier-compatible config)
- **TypeScript 6.x** with strict typed lint rules (`strict:true`)
- **Vitest 4.x** as the test runner (with `node:test` compatibility)
- **lru-cache 11** for in-process caching
- **opossum 10** for circuit breaking (with shadow-mode adapter)
- **keyv + @keyv/sqlite** for distributed KV without Redis sidecar
- **@node-rs/argon2** for password hashing (OWASP Argon2id)
- **picocolors** for CLI styling (200KB → 16KB)

### Sidecar-free deployment

| Sidecar | Replacement |
|---|---|
| Redis | `KeyvQuotaStore` + `KeyvRateLimitStore` (embedded keyv + SQLite) |
| Qdrant | `sqlite-vec` facade (`src/lib/memory/qdrant.ts`) |
| MITM subprocess | in-process `worker_threads` (no fork) |

### Embedded services

- **API gateway** — Next.js 15 App Router (`src/app/api/**`)
- **Open SSE** — streaming engine (`open-sse/services/**`)
- **MITM proxy** — embedded worker (`src/mitm/manager.ts`)
- **In-app login** — device-code preferred, Playwright fallback (`open-sse/services/inAppLoginService.ts`)
- **Bifrost** — provider broker (fork-only architecture)

### Rust support

- `crates/omniroute-agent` — agent-side tooling
- `crates/omniroute-ffi` — FFI bridge to Next.js
- `crates/omniroute-rs` — standalone Rust workspace (separate from root)

## What doesn't ship (by design)

- **No desktop / mobile runtime.** This fork is server-only.
  - No Electron, Tauri, React Native, Flutter, Capacitor, Expo, or ElectroBun.
  - The frontend is a Next.js web app served over HTTP.
- **No npm publication.** The package is an application, not a library.
- **No standalone CLI.** The CLI is internal-only (`bin/omniroute.ts`).

## Architecture diagram (text)

```
┌─────────────────────────────────────────────────┐
│  Client (web UI / SDK / curl / OpenAI client)   │
└─────────────────┬───────────────────────────────┘
                  │ HTTPS
                  ▼
┌─────────────────────────────────────────────────┐
│  Next.js 15 App Router                           │
│  ├── /api/v1/** (chat, models, keys, memory)     │
│  ├── /api/health/** (probe, deep, ping)         │
│  ├── /api/identity (GET → fork SSOT)            │
│  ├── /api/quota/** (consume, peek, plan)        │
│  └── /api/system/version (release info)          │
└────────┬──────────────┬──────────────┬──────────┘
         │              │              │
         ▼              ▼              ▼
   ┌──────────┐  ┌──────────┐  ┌──────────────┐
   │ open-sse │  │   Rust   │  │  SQLite      │
   │ workers  │  │  crates  │  │  (embedded)  │
   │ (Node)   │  │ (FFI)    │  │  via keyv    │
   └──────────┘  └──────────┘  └──────────────┘
```

## How to install

```bash
pnpm install
pnpm run build:open-sse
pnpm run dev  # starts Next.js on :3000
```

## How to verify

```bash
# Identity (fork SSOT)
curl http://localhost:3000/api/identity | jq .

# Health
curl http://localhost:3000/api/health/ping

# Auth
curl -X POST http://localhost:3000/api/keys -H "Content-Type: application/json" \
  -d '{"provider":"openai","scope":"chat"}'

# Chat completion (OpenAI-compatible)
curl -X POST http://localhost:3000/api/v1/chat/completions \
  -H "Authorization: Bearer $OMNIROUTE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}'
```

## License

Internal-use only. See `LICENSE` for upstream license.

## Support

This is an active fork. Issues and PRs accepted at the fork remote.
