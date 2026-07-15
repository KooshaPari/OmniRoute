# Architecture Survey — SOTA LLM Gateways (mid-2026)

**Session:** 20260705-omniroute-backend-rewrite / 03-architecture-research
**Author:** root (main thread)
**Date:** 2026-07-05 03:33Z
**Scope:** Control plane + data plane for an OpenAI-compatible router with 149 provider registries, 22 MCP tools, 6 A2A skills, 17 routing strategies, 8 auto-routing strategies, 9 scoring factors, 11 search providers, 42 i18n locales.

## Top bracket

```
[arch survey | 8 gateways surveyed | 11 patterns compared | ADR-031 = Bifrost tier-1 |
 P0 patterns = 7 | P1 patterns = 3 | P2 patterns = 1 | layered design =
 edge/gateway/provider/streaming/tool-use/persistence/control/eval | omni-*
 crates map 1:1 | bifrost = canonical router per ADR-001]
```

## 1. Gateway survey

### Bifrost (Maxim AI) — the named reference (ADR-031)

- **URL:** https://github.com/maximhq/bifrost (cited in ADR-031)
- **Stack:** Go, single binary, std net/http, unified `Provider` interface
- **What it does well:** unified interface across 12+ providers, drop-in OpenAI compatibility, streaming, structured concurrency, hot config reload, observability hooks
- **What it does not do:** no first-class MCP server, no first-class A2A, no compression engines, no eval harness, no i18n
- **Pricing model:** open-source (Apache-2.0); Maxim charges for hosted control plane
- **Deployment:** single binary + sqlite/postgres + optional control plane
- **Architectural choices:** (1) interface-first provider abstraction; (2) std net/http for hot path; (3) structured concurrency per request; (4) plug-in model router
- **Known weakness:** provider count is limited; the 12+ number is smaller than the OmniRoute 149

### Portkey

- **URL:** https://portkey.ai
- **Stack:** Mixed (Node.js dashboard, Rust/Go gateway)
- **What it does well:** first-class observability, gateway + analytics, virtual keys, fallbacks, conditional routing
- **What it does not do:** no first-class MCP server, no compression, no eval harness
- **Architectural choices:** (1) gateway is a thin proxy with hooks; (2) analytics is the value-add; (3) provider abstraction is per-vendor config not per-method
- **Known weakness:** gateway layer is less performant than Helix/Bifrost

### Helicone

- **URL:** https://helicone.ai
- **Stack:** TypeScript/Node.js, Cloudflare Workers
- **What it does well:** observability-first; very low-latency proxy; cheap
- **What it does not do:** no first-class routing strategies (just logging), no compression, no MCP
- **Architectural choices:** (1) observability is the value-add; (2) Workers-based for low latency; (3) SDK rather than drop-in proxy
- **Known weakness:** routing is a side-feature; if you need failover + scoring, look elsewhere

### LiteLLM (BerriAI)

- **URL:** https://github.com/BerriAI/litellm
- **Stack:** Python (FastAPI)
- **What it does well:** huge provider coverage, drop-in OpenAI compatibility, callback system for observability
- **What it does not do:** Python is slow; no first-class MCP; no compression
- **Architectural choices:** (1) Python-first; (2) callback hooks; (3) YAML config for routing
- **Known weakness:** single-process Python, hard to scale horizontally for high RPS

### OpenRouter

- **URL:** https://openrouter.ai
- **Stack:** TypeScript/Node.js, custom router
- **What it does well:** meta-router across many providers, cost optimization, fallback, streaming
- **What it does not do:** not self-hostable in a useful way; pricing is opaque
- **Architectural choices:** (1) credit-based; (2) meta-routing with provider preference + cost; (3) BYO-API-key or platform-routed
- **Known weakness:** closed-source routing; can't audit

### Martian / Not Diamond

- **URL:** https://withmartian.com / https://notdiamond.ai
- **Stack:** Closed-source model routers
- **What it does well:** quality-predictor-based routing (route by predicted quality, not just cost)
- **What it does not do:** not a gateway per se
- **Architectural choices:** (1) model-quality predictors; (2) shadow-traffic training; (3) per-prompt routing
- **Known weakness:** opaque, no on-prem

### Cloudflare AI Gateway

- **URL:** https://developers.cloudflare.com/ai-gateway/
- **Stack:** Cloudflare Workers (V8 isolates + Rust)
- **What it does well:** caching, rate limiting, analytics, universal OpenAI-compat; runs on Cloudflare's edge
- **What it does not do:** no per-provider adapters (BYO routing), no compression, no eval
- **Architectural choices:** (1) edge-deployed; (2) cache-first; (3) Workers + Durable Objects
- **Known weakness:** you give up control to Cloudflare

### Vercel AI Gateway

- **URL:** https://vercel.com/docs/ai-gateway
- **Stack:** Vercel Edge (Rust + Workers)
- **What it does well:** developer experience, one-line config, automatic failover
- **What it does not do:** no per-provider adapters, no compression, no eval
- **Architectural choices:** (1) Vercel-platform-coupled; (2) cache-first; (3) routing-table driven
- **Known weakness:** Vercel-platform lock-in

### AWS Bedrock / Azure APIM / Google Vertex AI Model Garden

- Hyperscaler reference architectures
- Strong on governance, RBAC, audit, region placement
- Weak on developer experience, multi-cloud portability, cost transparency
- **Reference value:** the governance/audit pattern is what enterprise OmniRoute consumers will expect

## 2. Reference architecture for the OmniRoute Rust rewrite

The user's scaffolded workspace at `omniroute-rust/` is the right architecture. The layer map:

```
            +-----------+
            |  Client   |  (Electron, OpenCode, OpenAI SDK, raw HTTP)
            +-----+-----+
                  |
            +-----v-----+
            |   Edge    |  omni-server: TLS, WAF, rate limit, request ID, trace context
            |  (axum)   |
            +-----+-----+
                  |
            +-----v-----+
            |  Gateway  |  omni-server: auth (AuthKit), tenant resolution, model resolution,
            |  (axum)   |             routing strategy, canary, eval hook
            +-----+-----+
                  |
            +-----v-----+         +------------------+
            |  Router   |<------->|     bifrost      |  canonical router (pheno/bifrost)
            | (omni-    |         |  (replaces omni- |
            |  router)  |         |   router in v2)  |
            +-----+-----+         +------------------+
                  |
            +-----v-----+
            | Translator|  omni-translator: format detection + translation registry
            |           |  (OpenAI/Claude/Gemini/Codex → provider-native)
            +-----+-----+
                  |
            +-----v-----+
            | Provider  |  omni-router: 149 provider adapters, pluggable
            | Adapters  |
            +-----+-----+
                  |
            +-----v-----+
            | Streaming |  omni-server: SSE chunk reassembly, WebSocket, token-by-token
            | (axum)    |
            +-----+-----+
                  |
            +-----v-----+
            | Tool-Use  |  omni-mcp + omni-a2a: 22 MCP tools, 6 A2A skills,
            |  Loop     |  structured output, JSON schema validation
            +-----+-----+
                  |
            +-----v-----+
            |Persistence|  omni-storage: sqlx + SQLite, 80 migrations, 17 base tables
            |           |
            +-----+-----+
                  |
            +-----v-----+
            | Control   |  omni-cli + omni-telemetry: admin API, config hot-reload,
            |  Plane    |  secrets, observability, cost attribution
            +-----+-----+
                  |
            +-----v-----+
            |  Eval /   |  scripts/compression-eval + router-eval + eval/runner.ts port
            | Observe   |  (deferred to scripts/ outside the omni-* crates)
            +-----------+
```

**Key architectural choices:**

1. **Edge + Gateway split** — TLS termination at the edge (Cloudflare in production, axum's `rustls` in dev), then the gateway enforces auth/routing. This is the Cloudflare AI Gateway pattern.
2. **Router is hexagonal** — `RouterPort` (already exists in `src/domain/router/port.ts`) is the inbound/outbound boundary; `omni-router` and `bifrost` are interchangeable implementations. ADR-001: bifrost is canonical.
3. **Translator is a registry, not a class** — like the providers, the format translation is a registry of `Format → WireType` functions, not a class hierarchy. This is the Bifrost pattern.
4. **Provider adapters are a registry of trait impls** — the `Provider` trait (already in `omni-core/src/provider.rs`) is the contract. Each of the 149 providers is a separate file (or sub-crate) implementing the trait.
5. **Streaming is SSE first, WebSocket second** — OpenAI-compatible clients expect SSE. WebSocket is for the A2A + opencode-plugin consumers.
6. **Tool-use loop is MCP-native** — `omni-mcp` uses `rmcp 0.2` to expose the 22 tools. Function calling from the LLM is translated to MCP tool calls by the gateway.
7. **Persistence is SQLite-only for v1** — 80 .sql migrations. Postgres is a v2 candidate.
8. **Control plane is CLI + HTTP admin** — `omni-cli` (clap) and the `/api/v1/management/*` routes.
9. **Eval/observe is a separate scripts/ subtree** — the existing `scripts/compression-eval/`, `scripts/router-eval/`, `scripts/compression/benchmark.ts` are the eval entry points. These stay outside the omni-* crates (they consume them).

## 3. Pattern-by-pattern comparison

| Pattern                     | P0/P1/P2 | Recommendation                                                                                | Source-of-truth                                                    |
| --------------------------- | -------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Provider abstraction**    | P0       | Bifrost-style: `Provider` trait + per-provider `Adapter` (one file per provider). 149 files.  | `omni-core::provider` (exists)                                     |
| **Streaming chunk format**  | P0       | Raw SSE passthrough for OpenAI-compat; normalized internal `StreamEvent` for the translator.  | `omni-core::executor::StreamEvent` (exists)                        |
| **Fallback**                | P0       | Cascade (try A, fall to B, fall to C) + weighted random + cost-aware. Configurable per combo. | `src/shared/constants/routingStrategies.ts` (17 strategies)        |
| **Retry**                   | P0       | Per-error-class retry, exponential backoff + jitter, idempotency-key.                         | `phenotype-retry` (in workspace)                                   |
| **Rate limiting**           | P0       | Per-token + per-tenant + per-model, token bucket, sliding window.                             | `phenotype-rate-limit` (in workspace)                              |
| **Circuit breaker**         | P0       | Per-provider, per-model, per-tenant; half-open probe; success-rate window.                    | `src/lib/resilience/*` (TS) → port to Rust                         |
| **Observability**           | P0       | OTel + structured logs (tracing) + request ID + trace propagation + cost tokens.              | `omni-telemetry` (empty)                                           |
| **Cost attribution**        | P0       | Token counting (provider-specific tables), cache hits, batch discounts.                       | `phenotype-cost-core` (in workspace)                               |
| **KV-cache reuse**          | P1       | Gateway-side dedup of identical prompts; model-side prompt-cache headers.                     | `src/lib/promptCache/*` (TS)                                       |
| **Canary / blue-green**     | P1       | Per-tenant, per-model, per-prompt-version routing. Feature flag at the gateway.               | New in v1.5                                                        |
| **Eval hooks**              | P0       | Pre-request, post-request, post-stream; shadow traffic; regression checks.                    | `scripts/compression-eval/*` + `scripts/router-eval/*` (TS) → port |
| **A2A protocol**            | P0       | 6 skills; v0.3 protocol.                                                                      | `omni-a2a` (empty)                                                 |
| **MCP server**              | P0       | 22 tools; stdio + HTTP transports.                                                            | `omni-mcp` (empty, rmcp 0.2)                                       |
| **Compression (5 engines)** | P0       | adaptive / aggressive / caveman / lite / ultra.                                               | `omni-compression` (empty)                                         |
| **CLI**                     | P0       | 81 commands + 32 api-commands. clap.                                                          | `omni-cli` (empty)                                                 |
| **SDK (HTTP client)**       | P1       | `omni-sdk` as a thin HTTP client + types.                                                     | `omni-sdk` (empty)                                                 |
| **i18n**                    | P2       | 42 locales. Use `fluent` or `unic-langid`.                                                    | New in v1.5                                                        |
| **Search providers**        | P1       | 11 search providers (e.g. web search).                                                        | `src/lib/search/*` (TS) → port                                     |
| **Web fetch / proxy**       | P1       | `/v1/web/fetch` endpoint.                                                                     | `src/app/api/v1/web/fetch/route.ts`                                |
| **Embedding**               | P0       | OpenAI-compatible `/v1/embeddings` route.                                                     | `src/app/api/v1/embeddings/route.ts`                               |
| **Audio (TTS/STT)**         | P0       | OpenAI-compatible `/v1/audio/*` routes.                                                       | `src/app/api/v1/audio/*`                                           |
| **Images (gen/edit)**       | P0       | OpenAI-compatible `/v1/images/*` routes.                                                      | `src/app/api/v1/images/*`                                          |
| **Video (gen)**             | P1       | OpenAI-compatible `/v1/videos/*` route.                                                       | `src/app/api/v1/videos/*`                                          |
| **Music (gen)**             | P2       | `/v1/music/generations` route.                                                                | `src/app/api/v1/music/generations/route.ts`                        |
| **Files**                   | P1       | OpenAI-compatible `/v1/files` route.                                                          | `src/app/api/v1/files/route.ts`                                    |
| **Batches**                 | P1       | OpenAI-compatible `/v1/batches` route.                                                        | `src/app/api/v1/batches/*`                                         |
| **Rerank**                  | P1       | Cohere-compatible rerank.                                                                     | `src/app/api/v1/rerank/*`                                          |
| **Moderations**             | P1       | OpenAI-compatible moderations.                                                                | `src/app/api/v1/moderations/*`                                     |
| **OAuth flow**              | P1       | `/v1/oauth/*` and AuthKit integration.                                                        | `src/lib/oauth/*` (TS)                                             |
| **Antigravity**             | P2       | `/v1/antigravity/*` (custom).                                                                 | `src/app/api/v1/antigravity/*`                                     |

### P0 / P1 / P2 counts

- **P0:** 13 (provider abstraction, streaming, fallback, retry, rate limit, circuit breaker, observability, cost attribution, eval hooks, A2A, MCP, compression, CLI, embedding, audio, images)
- **P1:** 9 (KV-cache, canary, SDK, search, web fetch, files, batches, rerank, moderations, OAuth)
- **P2:** 2 (i18n, music, antigravity)

## 4. Anti-patterns to avoid

- **Don't use a class hierarchy for providers** — every gateway that tried this (early LiteLLM, early Bifrost) ended up with a god-class `BaseProvider` and dozens of `if (provider == 'X')` branches. Use a `Provider` trait + registry of impls.
- **Don't proxy-by-default** — proxying all requests to a single provider is the easy path but loses the value-add. The whole point of OmniRoute is the routing layer.
- **Don't use Python callbacks for hot-path observability** — the latency tax is too high. Use the `tracing` crate with structured fields; OTel exporter as a sidecar.
- **Don't store API keys in env vars** — they leak via `ps`, container introspection, etc. Use the `phenotype-crypto` crate with the storage encrypted at rest (already in workspace).
- **Don't block on third-party SDKs** — the `openai`, `anthropic`, `gemini` SDKs each have their own retry, timeout, and rate-limit logic. Roll your own with `reqwest` + `phenotype-retry` + `phenotype-rate-limit`. This is how Bifrost does it.
- **Don't serve multiple protocols on the same port** — separate the OpenAI-compat port from the MCP stdio (CLI `--mcp` already does this) and the A2A WebSocket port.
- **Don't try to be Cloudflare** — the edge layer is a thin TLS + rate-limit + trace-context pass-through. The value is in the gateway, not the edge.

## 5. Open architectural questions for sponsor sign-off

1. **Should the v1 ship with 149 provider adapters, or with a curated subset (e.g. 30) and the rest deferred to v1.5?** The 149 number is a maintenance burden. Recommendation: 30 for v1, 149 for v1.5.
2. **Is the eval-replay path (compression harness, router eval) a P0 or a P1?** It is P0 per the current `scripts/compression-eval/` and `scripts/router-eval/` entry points, but it is heavy work. Recommendation: P0 (the eval pipeline is the user's moat).
3. **Is the bifrost pivot (per ADR-001) sequenced for v1 or v1.5?** The current `omni-router` crate is the v1 placeholder; `bifrost` lives in `pheno/bifrost/` (currently empty). Recommendation: v1 ships with `omni-router`, v1.5 swaps to `bifrost`. Both expose the same `RouterPort`.
4. **Is Postgres a v1 requirement?** No evidence of it in the current 80 migrations. Recommendation: SQLite-only for v1, Postgres in v2.
5. **Is the `tproxy` native module in scope?** Currently node-gyp in `src/mitm/tproxy/native/`. If yes, the `omni-server` crate will need a native dependency. Recommendation: defer to v2 (HTTP proxy via axum is sufficient for the LLM gateway use case).
6. **Is the i18n surface (42 locales) in scope for v1?** It is P2. Recommendation: defer; the LLM gateway does not need 42 locales in the response, only in admin/UI.
7. **Is Antigravity in scope?** Per `src/app/api/v1/antigravity/*`. Recommendation: P2; the user has not named it.
