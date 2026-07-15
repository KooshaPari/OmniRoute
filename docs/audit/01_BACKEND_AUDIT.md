# 01 — Backend Audit (OmniRoute fork, v3.8.42)

> **Method**: file-tree walk + LOC counts + read of entry points + commit archaeology + provider inventory.
> **Confidence**: high for top-level shape, medium for deep cross-file flow (we cite file paths).
> **Companion docs**: `02_STACK_RESEARCH.md` (which languages fit), `03_REWRITE_PLAN.md` (staged migration).

## 1. Top-line scope

**"Backend"** for this fork = everything except the Next.js UI under `src/app/`. That is:

- `open-sse/` — streaming engine, executor runtime, services, MCP server, translator
- `src/server/` — auth pipeline, CORS, origin checks, WS
- `src/lib/` — business logic (db, jobs, skills, guardrails, skills, secrets, cache, telemetry)
- `src/domain/` — domain models
- `src/store/`, `src/models/`, `src/types/` — state + types
- `src/mitm/` — MITM proxy (cert, dns, tproxy, inspector, manager, system commands)
- `src/sse/` — SSE helpers
- `src/shared/` — shared utilities
- `bin/` — CLI entry points
- `scripts/` — build + dev + check + bench
- `@omniroute/opencode-plugin`, `@omniroute/opencode-provider` — OpenCode integration SDK packages

What the backend **does** (5-bullet elevator): receives chat, completion, image, audio, video, embedding, search, moderation, rerank, and tool-call requests from any Phenotype service; routes them to one of 232+ upstream LLM providers (OpenAI, Anthropic, Gemini, DeepSeek, Groq, xAI, Mistral, Cohere, NVIDIA, Fireworks, Cerebras, HuggingFace, OpenRouter, Vertex AI, Cloudflare AI, Together, Pollinations, Puter, vLLM, Ollama, etc.) using policy + cost + latency + capability + quota; responds in OpenAI-compatible (or Anthropic, Responses-API, or A2A-JSON-RPC) wire shape; and exposes 94 MCP tools, 6 A2A skills, ACP registry, webhooks, evals, and a policy/guardrail/skill engine.

## 2. Module inventory (LOC by directory)

```
src/                 233,483 LOC  (Next.js + domain + lib + server + mitm + store + types)
open-sse/            187,358 LOC  (executor + services + translator + handlers + mcp-server)
bin/                  24,825 LOC  (CLI + scripts + TUI)
scripts/              32,211 LOC  (build + dev + check + bench)
TOTAL backend       ~477,000 LOC  (TS + .mjs; excludes src/app/)
```

Top 15 largest files in the backend (sample):

| LOC | Path                                  |
| --: | ------------------------------------- |
| 933 | `src/lib/cloudflaredTunnel.ts`        |
| 924 | `src/lib/modelsDevSync.ts`            |
| 763 | `src/lib/localDb.ts`                  |
| 706 | `open-sse/executors/windsurf.ts`      |
| 564 | `src/lib/arenaEloSync.ts`             |
| 553 | `src/lib/modelMetadataRegistry.ts`    |
| 481 | `open-sse/executors/trae.ts`          |
| 444 | `src/lib/modelCapabilities.ts`        |
| 397 | `open-sse/executors/veoaifree-web.ts` |
| 341 | `open-sse/executors/vertexMedia.ts`   |
| 317 | `open-sse/executors/theoldllm.ts`     |
| 283 | `open-sse/executors/zenmux-free.ts`   |
| 267 | `src/lib/localHealthCheck.ts`         |
| 239 | `src/lib/freeProviderRankings.ts`     |
| 233 | `src/lib/apiBridgeServer.ts`          |

## 3. Provider surface (`open-sse/executors/`)

| Metric                                                   | Count                                                                                                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Executors (`*.ts` in `executors/`)                       | **71**                                                                                                                                              |
| Aliases (e.g. `agy` → antigravity, `cmd` → command-code) | 30+                                                                                                                                                 |
| Format namespaces (`FORMATS` in `translator/formats.ts`) | 9 (openai, openai-responses, openai-response, claude, gemini, codex, antigravity, kiro, cursor)                                                     |
| Translator request pairs                                 | 9 (antigravity, claude→gemini, claude→openai, gemini→openai, openai-responses, openai→claude, openai→cursor, openai→gemini, openai→kiro)            |
| Translator response pairs                                | 9 (claude→openai, cursor→openai, gemini→claude, gemini→openai, kiro→openai, openai-responses, openai→antigravity, openai→claude, openai→gemini-sse) |

**Top 20 most-used executors** (by upstream usage data; see `src/lib/freeProviderRankings.ts` and `modelMetadataRegistry.ts`):

1. openai / openai-compatible-routing
2. claude-web / claude-web-with-auto-refresh
3. gemini-web / gemini-business
4. codex (OpenAI Codex CLI OAuth)
5. antigravity (Google internal)
6. kiro (AWS)
7. cursor
8. trae
9. vertex
10. azure-openai
11. chatgpt-web
12. deepseek-web / deepseek-web-with-auto-refresh
13. copilot-web / copilot-m365-web
14. grok-web / grok-cli
15. qwen-web
16. kimi-web
17. doubao-web
18. windsurf
19. perplexity-web
20. glm

**Registration**: `open-sse/executors/index.ts` constructs an `executors` object mapping alias → instance, with `agy`, `cmd`, `pol`, `cu` etc. as short aliases. New providers are added by writing a new `XxxExecutor` that extends `BaseExecutor` and importing it into the index.

## 4. API surface

### 4.1 OpenAI-compatible (the user-facing hot path)

| Method | Path                              | Notes                                                                                                                                                       |
| ------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/v1/chat/completions`            | Streaming + non-streaming. Routed via Bifrost (Tier 1) when `BIFROST_BASE_URL` is set, else TS handler at `src/app/api/v1/relay/chat/completions/route.ts`. |
| POST   | `/v1/responses`                   | OpenAI Responses API.                                                                                                                                       |
| POST   | `/v1/embeddings`                  |                                                                                                                                                             |
| POST   | `/v1/images/generations`          |                                                                                                                                                             |
| POST   | `/v1/audio/speech`                |                                                                                                                                                             |
| POST   | `/v1/audio/transcriptions`        |                                                                                                                                                             |
| POST   | `/v1/moderations`                 |                                                                                                                                                             |
| POST   | `/v1/rerank`                      |                                                                                                                                                             |
| POST   | `/v1/video/generations`           |                                                                                                                                                             |
| GET    | `/v1/models`                      |                                                                                                                                                             |
| GET    | `/v1/models/:model`               |                                                                                                                                                             |
| POST   | `/v1/messages` (Anthropic-compat) |                                                                                                                                                             |
| POST   | `/v1/messages/count_tokens`       |                                                                                                                                                             |

### 4.2 Bifrost relay (Tier-1 hot path)

| Method | Path                                     | Notes                                                                                                                                                                                   |
| ------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/api/v1/relay/chat/completions/bifrost` | Sidecar proxy to `BIFROST_BASE_URL`. `src/app/api/v1/relay/chat/completions/bifrost/route.ts` (~370 LOC). Falls back to TS relay on 502/504 (signaled via `X-Bifrost-Fallback` header). |
| POST   | `/api/v1/relay/chat/completions`         | TS fallback relay.                                                                                                                                                                      |

### 4.3 MCP server (`/mcp`, stdio + sse + streamable-http)

94 tools across routing, cache, compression, memory, skills, proxy, pool, and context-source operations. Tool catalog: `open-sse/mcp-server/schemas/tools.ts` (34 base) + `memoryTools.ts` (3) + `skillTools.ts` (4) + `agentSkillTools.ts` (3) + `poolTools.ts` (6) + `gamificationTools.ts` (8) + `pluginTools.ts` (8) + `notionTools.ts` (6) + `obsidianTools.ts` (22) = **94**. Transports: stdio (`omniroute --mcp`), SSE (`POST/GET /api/mcp/sse`), streamable-HTTP (`POST/GET/DELETE /api/mcp/stream`).

### 4.4 A2A server (`/a2a`)

JSON-RPC 2.0 at `POST /a2a`; REST at `/api/a2a/*`. Agent Card at `/.well-known/agent.json`. 6 skills (including `agentDispatch`). Tasks tracked by `A2ATaskManager` (`src/lib/a2a/taskManager.ts`, 5-min TTL). Auth = Bearer OmniRoute API key.

### 4.5 ACP, webhooks, evals, management

- ACP registry (`docs/frameworks/ACP.md`) — peer-agent discovery
- Webhooks — 7 event types, HMAC-signed (`docs/frameworks/WEBHOOKS.md`)
- Evals — `docs/frameworks/EVALS.md`
- Management UI/API — admin auth, login guard, CSRF, peer-stamp (in `src/server/`)

## 5. Translation layer

`open-sse/translator/` is the format-conversion engine. Each `*to*.ts` file in `request/` and `response/` is a bidirectional translator between two formats (e.g. `openai-to-claude.ts` request, `claude-to-openai.ts` response). `formats.ts` enumerates 9 canonical formats; `registry.ts` registers them at startup; `index.ts` (`bootstrapTranslatorRegistry`) wires it.

Streaming translation (`open-sse/translator/response/openai-responses.ts` and `open-sse/translator/index.ts`) handles SSE chunk-by-chunk conversion between formats. The `caveman` and `rtk` compression engines (`open-sse/compression/*` — RTK, Caveman, Aggressive, Adaptive, plus `pipeline.rs`/`pipeline.ts` and `preservers`) are applied in the translator pipeline when enabled per-combo.

## 6. State and storage

- `src/lib/localDb.ts` (763 LOC) — primary SQLite open + migrations
- `src/store/` — typed stores (emailPrivacyStore, notificationStore, themeStore)
- `src/models/` — ORM-ish models
- Schema lives in `src/lib/db/` migrations, run on startup
- 17 base tables, 97 migrations, 83 modules
- WAL mode SQLite, 4 cache layers (semantic, signature, read, reasoning)

## 7. Auth + credential vault

- `src/server/auth/loginGuard.ts` — login throttling
- `src/server/authz/` — authz pipeline (classify → policy → assert), CSRF, peer-stamp, access tokens, route guard
- `src/server/cors/origins.ts` — public origin allow-list
- `src/server/origin/publicOrigin.ts` — proxied-dashboard origin checks
- `src/server/ws/` — WS auth + allow-list
- `src/lib/auth/managementPassword.ts` — bcrypt management password (reset via `bin/reset-password.mjs`)
- `src/lib/machineToken.ts` — machine tokens
- `src/lib/apiKeyExposure.ts` — prevents API key leakage in error paths

## 8. MITM proxy (`src/mitm/`)

A real MITM HTTPS proxy: cert generation, DNS resolution, transparent proxy (tproxy), inspector, manager (runtime + stub), upstream trust, system command channel, socket timeouts, secret masking. This is **the** hard-to-port subsystem. The fork uses Node's `tls` module + native cert tools; the Rust rewrite must replace with `rustls` + custom CA + ACME provisioning.

## 9. CLI

`bin/omniroute.mjs` is the entry. Subcommands via Commander under `bin/cli/program.mjs`. Major subcommands: `start`, `stop`, `restart`, `migrate`, `providers list`, `providers test`, `usage`, `audit`, `config`, `secrets`, `encrypt`, `decrypt`, plus the `--mcp` stdio server and the `reset-encrypted-columns` recovery tool. TUI for tray under `bin/cli/tray/`; interactive TUI components under `bin/cli/tui-components/`.

## 10. SDK packages

- `@omniroute/opencode-plugin` — OpenCode plugin (fetches the live `/v1/models` catalog at startup)
- `@omniroute/opencode-provider` — DEPRECATED, but kept for back-compat; static-config provider helper

## 11. Build / runtime / deps

- Node engines: `>=22.0.0 <23 || >=24.0.0 <27`
- Build pipeline: `tsup` (for SDK packages), `next build` (for the app), custom `scripts/build/*` (for runtime env, native-binary compat, runtime-env)
- Workspace: `open-sse/` is a sub-workspace
- Top 30 most-imported npm packages: `next`, `react`, `axios`, `zod`, `dotenv`, `@anthropic-ai/sdk`, `openai`, `@google/generative-ai`, `eventsource-parser`, `winston`, `pino`, `better-sqlite3`, `kysely`, `bcrypt`, `jose`, `express`, `@modelcontextprotocol/sdk`, `undici`, `node-fetch`, `commander`, `chalk`, `inquirer`, `boxen`, `ora`, `cli-progress`, `cosmiconfig`, `ajv`, `jsonwebtoken`, `cookie`, `mime-types` (approx; full audit would `npm ls` them).

## 12. Test surface

- `tests/unit/` — unit tests (Node test runner + `node --import tsx`)
- `tests/integration/` — integration
- `tests/e2e/` — end-to-end
- `tests/golden-set/` — golden outputs for translation
- `tests/load/` — load tests
- `tests/live/` — live-provider tests
- `tests/llm-security/` — security regression
- `tests/snapshots/` — snapshot tests
- `tests/fixtures/` — fixture data
- `tests/translator/` — translation-specific

**Contract tests that MUST keep passing** (the post-rewrite regression floor):

- All `tests/golden-set/*` (translation parity)
- All `tests/llm-security/*` (injection, PII, prompt-leak)
- All `tests/integration/api/*` (route-level)
- `tests/load/*` (p99 latency envelope)

## 13. Hot spots and risk

| Risk                          | Why                                                                 | Mitigation                                                                              |
| ----------------------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| MITM proxy (`src/mitm/`)      | Native `tls` + cert tooling, transparent proxy                      | Replace with `rustls` + `rcgen` + `instant-acme`; FFI bridge or full Rust rewrite       |
| 232 provider executors        | Each has unique auth flow, refresh daemon, fingerprint, obfuscation | Port in waves (5 reference + 25 most-used + rest via codegen from provider spec)        |
| RTK + Caveman compression     | Custom token-aware compressors with adaptive combo                  | Port the pipeline (already 684 LOC in Rust in `omniroute-rust/crates/omni-compression`) |
| MCP server (94 tools)         | JSON-RPC + SSE + streamable-HTTP + scope enforcement                | Replace with `rmcp` SDK + 94 tool defs (most are thin wrappers over services)           |
| SQLite + 97 migrations        | Live migrations on startup                                          | Use `sqlx::migrate!` (already in `omni-storage`)                                        |
| Auth pipeline                 | Custom policy DSL                                                   | Keep in TS for now; the policy engine is not on the hot path                            |
| Next.js dependency in src/lib | `next/headers`, `next/server` are imported in many backend files    | Decouple first (extract a `core` package), then port                                    |
| tsx runtime for .ts → .js     | The CLI uses `await import("tsx/esm")` at startup                   | Replace with compiled Rust binary that calls into the Rust crates                       |
| Hardcoded fork deltas         | Many `process.env` checks, runtime-env hack                         | Document in `04_KNOWN_DELTAS.md`, then remove the hack when the TS handler is gone      |

## 14. Spec / contract list (must survive rewrite)

| Contract                        | Owner            | Where defined                                                         |
| ------------------------------- | ---------------- | --------------------------------------------------------------------- |
| OpenAI Chat Completions         | upstream         | `open-sse/handlers/chatCore`                                          |
| OpenAI Responses                | upstream         | `open-sse/handlers/responsesHandler`                                  |
| Anthropic Messages              | upstream         | `open-sse/handlers/anthropic`                                         |
| Gemini GenerateContent          | upstream         | `open-sse/translator/request/openai-to-gemini.ts`                             |
| MCP JSON-RPC 2.0                | Anthropic        | `open-sse/mcp-server/server.ts`                                       |
| A2A JSON-RPC 2.0 v0.3           | Linux Foundation | `src/lib/a2a/taskExecution.ts`                                        |
| OpenAI-compatible MCP responses | fork-only        | `open-sse/executors/openaiCompatibleRouting.ts`                       |
| CLI contract                    | fork             | `bin/cli/program.mjs`                                                 |
| Bifrost sidecar protocol        | Maxim AI         | `src/app/api/v1/relay/chat/completions/bifrost/route.ts` (HTTP, JSON) |

## 15. What's in `omniroute-rust/` (the parallel workspace)

| Crate              |         LOC | Role                                                                                                                                                       | State                                    |
| ------------------ | ----------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `omni-core`        |         708 | errors, config, executor trait, ids, model, provider                                                                                                       | **done** (18 tests)                      |
| `omni-protocol`    |        2723 | OpenAI / Claude / Gemini / Codex / A2A / MCP wire types                                                                                                    | **done** (9 tests)                       |
| `omni-translator`  |        1120 | format detection + 6 translators + streaming                                                                                                               | **done** (46 tests)                      |
| `omni-storage`     |        1535 | sqlx SQLite + migrations + repos (api_key, call_log, tenant)                                                                                               | **done** (17 tests)                      |
| `omni-router`      |         434 | provider registry, breaker, strategy                                                                                                                       | **done** (7 tests)                       |
| `omni-compression` |         684 | RTK, Caveman, Aggressive, Adaptive, pipeline, preserver, tokenizer                                                                                         | **done** (13 tests)                      |
| `omni-server`      |        1521 | axum HTTP server, auth, state, telemetry, middleware, 6 handlers (openai, anthropic, v1_combos, v1_models, admin, health), 2 executors (openai, anthropic) | **mostly done** (2 tests)                |
| `omni-telemetry`   |         529 | tracing, metrics, audit, span                                                                                                                              | **done** (9 tests)                       |
| `omni-sdk`         |         625 | Rust client SDK (chat, client, embeddings, models)                                                                                                         | **done** (3 tests)                       |
| `omni-mcp`         |          62 | McpServer stub, `pub use rmcp as upstream`                                                                                                                 | **stub**                                 |
| `omni-a2a`         |          74 | AgentCard + Task + A2aRegistry stubs                                                                                                                       | **stub**                                 |
| `omni-cli`         |           2 | `fn main() { println!("omniroute CLI v0.1.0"); }`                                                                                                          | **stub**                                 |
| **TOTAL**          | **~10,000** |                                                                                                                                                            | **124 tests pass, 5 warnings, 0 errors** |

The workspace compiles clean (`cargo check --workspace` ✅, `cargo test --workspace` ✅). The main.rs in `omni-server` boots the server on port from `AppConfig` with SQLite + migrations + tracing + seed providers from env. The omniroute CLI binary (`omni-cli/src/main.rs`) is a stub.

## 16. Conclusion

The TS backend is **~477k LOC** of mature, well-tested, fork-extended code on top of `diegosouzapw/OmniRoute` v3.8.42. The non-TS **starting point** (`omniroute-rust/`) is **~10k LOC of working Rust** with 124 passing tests, covering the protocol, translator, storage, router, compression, and server skeleton. The realistic next 90 days is **a polyglot Tier-2 surface, not a complete rewrite** — see `02_STACK_RESEARCH.md` for the language decision and `03_REWRITE_PLAN.md` for the staged migration.
