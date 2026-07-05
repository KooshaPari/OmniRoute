# OmniRoute Backend Surface Audit (2026-07-05)

**Repo:** /Users/kooshapari/CodeProjects/Phenotype/repos/OmniRoute-pr232-policyfix-20260703 (fork of diegosouzapw/OmniRoute, v3.8.43)

## 1. Executive summary

OmniRoute is a local-first, OpenAI-compatible LLM router that speaks to ~160 upstream providers (80 executor files), runs an MITM/HTTPS proxy for desktop agents (Cursor, Cline, Codex, Antigravity), embeds an MCP server, drives a CLI, and writes everything to a single SQLite database. The frontend (Next.js 16 dashboard) is the only piece the user wants to keep; the entire backend (HTTP API, CLI, SDK, MCP, mitm, SSE, executors, domain logic, store) is in scope for a clean rewrite in a systems language.

## 2. Backend LoC budget

| Concern           | LoC          | Notes                                                |
|-------------------|--------------|------------------------------------------------------|
| open-sse/         | 201,358      | executors, MCP, transformer, services, handlers      |
| src/lib/          | 127,173      | DB, providers, usage, memory, tunnels                |
| src/app/api/      | 58,060       | 51 v1 + ~100 management routes                       |
| src/mitm/         | 7,387        | cert, inspector, tproxy, handlers                    |
| src/sse/          | 6,009        | streaming core                                       |
| src/domain/       | 4,887        | policy, fallback, cost, combos                       |
| src/server/       | 3,038        | auth, authz, cors, origin, ws                        |
| src/store/        | 248          | tiny client stores                                   |
| **Total backend** | **~408 K**   | Excludes src/app/(dashboard) frontend (~70 K)        |

Sanity check: `find src open-sse bin -name '*.ts' -o -name '*.mjs' | xargs wc -l | tail -1` = 476,631 lines. Frontend is the remainder.

## 3. HTTP API surface

- 51 v1 routes in src/app/api/v1/**/route.ts (OpenAI-compatible)
- ~100 management routes (combos, evals, keys, webhooks, virtual keys, usage, telemetry, traffic-inspector, mcp, etc.)
- 119 SQL migrations under src/lib/db/migrations/
- OpenAPI 3.1 spec at docs/openapi.yaml (6,693 lines) — the stable contract
- Public endpoints: /v1/chat/completions, /v1/responses, /v1/embeddings, /v1/audio/*, /v1/images/*, /v1/models, /v1/messages, /v1/moderations, /v1/rerank, /v1/batches, /v1/files, /v1/completions, /v1/agents/*, /v1/registered-keys, /v1/relay/chat/completions, /v1/providers/[provider]/*, /v1/vscode/[token]/*, /v1/ws, /v1/web/fetch
- Anthropic-compatible: /v1/messages
- v1beta for early endpoints

## 4. CLI surface

- bin/omniroute.mjs (the main binary)
- bin/reset-password.mjs
- bin/mcp-server.mjs
- bin/cli/* (subcommands)
- bin/_ops-common.sh + 5 shell helpers (restore, snapshot, rollback, cold-start bench)
- commander@15 + ink@7 TUI + ora@9 spinner

## 5. SDK surface (@omniroute/)

- @omniroute/opencode-plugin — adapter for OpenCode IDE
- @omniroute/opencode-provider — provider registration
- External SDK consumers: VS Code extension, Cline, Cursor, Codex CLI, Antigravity
- Public npm name: omniroute. Bin name: omniroute. Both must stay.

## 6. MCP server (open-sse/mcp-server/, 4 K LoC)

- Implements MCP spec 2025-06-18 with tools, resources, prompts
- SSE transport
- Multiple auth modes (virtual key, internal)
- @modelcontextprotocol/sdk@1.29.0

## 7. MITM proxy (src/mitm/, 7.4 K LoC, 30 files)

- server.cjs (786) — HTTPS intercept + tunnel
- manager.ts (746) — cert lifecycle, on/off
- cert/install.ts (417) — system CA trust (macOS keychain, Linux update-ca-certificates, Windows certutil)
- inspector/conversationNormalizer.ts (393) — normalize LLM payloads
- tproxy/tlsCapture.ts (368) — Linux tproxy + TLS capture
- inspector/systemProxyConfig.ts (316) — per-OS proxy settings
- inspector/sseMerger.ts (316) — merge SSE streams
- inspector/httpProxyServer.ts (272) — plain HTTP proxy
- dns/dnsConfig.ts (242), systemCommands.ts (234)
- handlers/base.ts (333), handlers/antigravity.ts (192)
- tproxy/captureMode.ts (226), transparentSocket.ts (131), commands.ts (122)

## 8. Persistence

- SQLite via sql.js@1.14.1 (in-memory + WASM, snapshotted to disk) + sqlite-vec@0.1.9 (vector)
- 119 SQL migrations
- Optional ioredis@5.10.1 (quota/rate-limit paths)
- 50+ files in src/lib/db/ (core.ts 1520, apiKeys.ts 1412, migrationRunner.ts 1048, models.ts 936, etc.)

## 9. Streaming / SSE (6 K LoC + open-sse/utils/stream.ts 2726)

- OpenAI-compatible SSE
- Tool/function calling
- Reasoning/thinking deltas (per provider)
- Image/audio/moderation streaming
- WebSocket transport for Cursor/Codex
- Token bucket (services/rateLimitManager.ts, 1063 LoC)
- mergeAbortSignals (open-sse)
- sseMerger.ts multi-stream fan-in

## 10. Domain logic (src/domain/, 4.9 K LoC)

- pipeline.ts — request/response pipeline
- policyEngine.ts — central policy
- fallbackPolicy.ts — chain composition
- costRules.ts — pricing + per-key budget
- comboResolver.ts — multi-provider combo
- tagRouter.ts — route by tag
- modelAvailability.ts — live availability
- quotaCache.ts — in-memory quota cache
- lockoutPolicy.ts — provider/account lockout
- degradation.ts — graceful degradation
- providerExpiration.ts — token/key expiry
- responses.ts, omnirouteResponseMeta.ts, prompts.ts
- connectionModelRules.ts, configAudit.ts
- assessment/ (provider assessment)
- router/ (routing strategies)

## 11. Provider executors (open-sse/executors/, 80 files, 39.6 K LoC)

- Each implements Executor interface (base.ts, 1368 LoC)
- Translates OpenAI shape -> provider-specific
- Handles auth (API key, OAuth refresh, session cookies, device code)
- Streams responses back into OpenAI shape
- Handles abort signals
- Emits telemetry
- Largest: chatgpt-web (3205), grok-web (1862), antigravity (1812), cursor (1577), codex (1539), muse-spark-web (1301), deepseek-web (1147), claude-web, claudeIdentity, kiro, kiroThinking, codex, commandCode, vertex, vertexMedia, etc.
- Browser-automation executors: chatgpt-web (uses ws + protobuf), claudeIdentity (cookies), antigravity, muse-spark-web
- API-key executors: openai, anthropic, google, opencode, kimi, glm, github, gitlab, etc.

## 12. Instrumentation

- src/instrumentation.ts + instrumentation-node.ts
- @opentelemetry/api@1.9.1
- pino@10.3.1 + pino-pretty@13.1.3

## 13. Top 20 files by LoC

| LoC    | File                                            | Concern                   |
|--------|------------------------------------------------|---------------------------|
| 4,308  | open-sse/handlers/chatCore.ts                  | Chat orchestration        |
| 3,908  | src/lib/providers/validation.ts                | Provider validation       |
| 3,386  | open-sse/services/combo.ts                     | Combo executor            |
| 3,205  | open-sse/executors/chatgpt-web.ts              | ChatGPT web executor      |
| 2,855  | open-sse/handlers/imageGeneration.ts           | Image gen                 |
| 2,726  | open-sse/utils/stream.ts                       | SSE stream utils          |
| 2,521  | src/shared/validation/schemas.ts               | Zod schemas               |
| 2,406  | src/sse/services/auth.ts                       | SSE auth                  |
| 2,180  | open-sse/services/tokenRefresh.ts              | OAuth token refresh       |
| 1,862  | open-sse/executors/grok-web.ts                 | Grok web executor         |
| 1,831  | src/app/api/providers/[id]/models/route.ts     | Provider model discovery  |
| 1,812  | open-sse/executors/antigravity.ts              | Antigravity executor      |
| 1,790  | open-sse/services/accountFallback.ts           | Account-level fallback    |
| 1,646  | src/sse/handlers/chat.ts                       | SSE chat handler          |
| 1,578  | open-sse/mcp-server/server.ts                  | MCP server                |
| 1,577  | open-sse/executors/cursor.ts                   | Cursor agent executor     |
| 1,545  | open-sse/handlers/search.ts                    | Search handler            |
| 1,539  | open-sse/executors/codex.ts                    | Codex executor            |
| 1,520  | src/lib/db/core.ts                             | DB core                   |
| 1,478  | open-sse/mcp-server/schemas/tools.ts           | MCP tool schemas          |

Files over the AGENTS.md 500-line hard limit: ~50+. Target for rewrite: every file <=350 lines.

## 14. External deps (74 prod + 44 dev)

Backend-relevant:
- HTTP: next@16, express@5.2, http-proxy-middleware@4, undici@8, axios@1.16, ws@8.18, https-proxy-agent@9, fetch-socks@1.3
- DB: sql.js@1.14, sqlite-vec@0.1, ioredis@5.10, lowdb@7
- Auth/cert: jose@6.2, bcryptjs@3, selfsigned@5.5, socks@2.8
- Validation: zod@4.4
- Logging: pino@10.3, pino-pretty@13.1
- CLI: commander@15, ink@7, ora@9, update-notifier@7
- MCP: @modelcontextprotocol/sdk@1.29
- Tunnel: @ngrok/ngrok@1.7, tailscale (CLI)
- Build: tsx@4.22
- Telemetry: @opentelemetry/api@1.9
- Misc: bottleneck@2.19, xxhash-wasm@1.1, fflate@0.8, dompurify@3.4, uuid@14

## 15. Rewrite scope (in/out)

IN (rewrite):
- open-sse/ — executors, MCP, transformer, services, handlers, utils, translator, mcp-server
- src/lib/ — db, providers, usage, memory, tunnels, tokenHealthCheck
- src/app/api/ — all 152 routes (v1 + management) as handlers
- src/mitm/ — proxy + cert + tproxy + inspector
- src/sse/ — streaming core
- src/domain/ — policy/fallback/cost/combo/tag
- src/server/ — auth/authz/cors/origin/ws
- bin/ — CLI entrypoints and shell helpers
- 119 SQL migrations — run as-is via refinery/goose

OUT (keep):
- src/app/(dashboard)/** — Next.js dashboard
- src/app/docs/, src/app/landing/, src/app/login/ — client routes
- desktop-electrobun/, electron/, flutter/ — desktop/mobile UIs
- i18n/ (UI translations)
- assets/, images/

Bridge during migration: frontend keeps calling the new backend over HTTP; OpenAPI spec is the contract.

## 16. Top risks (ranked)

1. Provider parity (160+). Some are undocumented / reverse-engineered (chatgpt-web, antigravity, muse-spark). Porting needs original test fixtures + replay harness.
2. Browser-automation executors. Some require session cookies, device code, or websocket-protobuf. Native rewrite must talk to a browser sidecar (puppeteer/playwright) or accept dropped coverage.
3. MITM CA trust. Cert install is OS-specific (macOS keychain, Linux update-ca-certificates, Windows certutil). Tests must run on each OS.
4. SQLite data migration. 119 migrations + user data must be preserved. New engine must run them in order and read existing DBs.
5. WebSocket transports. Cursor and Codex CLI use WS; new backend must speak both HTTP and WS.
6. Single binary distribution. Currently Node 22+. New binary must be a single static file per OS/arch.
7. OpenAPI parity. The dashboard depends on specific request/response shapes; a single breaking change cascades.
