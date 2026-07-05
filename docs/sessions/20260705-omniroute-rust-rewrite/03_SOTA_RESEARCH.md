# OmniRoute Backend Rewrite — SOTA Research (2026)

## TL;DR

The 2026 LLM-router landscape is dominated by Python (LiteLLM) and Go (Bifrost) for OSS gateways, with closed-source (OpenRouter, Portkey, Requesty) leading on enterprise features. The OpenAI-compatible surface has stabilized around three endpoints: `/v1/chat/completions`, `/v1/responses` (the new structured agent endpoint), and `/v1/embeddings`, with strong conventions for tool calling, structured outputs, vision, audio, and reasoning. The MITM-proxy pattern for desktop agent interception is mature (mitmproxy, go-mitmproxy, pingora + tproxy). For OmniRoute, the patterns we should copy are: LiteLLM's provider-execution surface, Bifrost's Go plugin trait, pingora's hot-path architecture, go-mitmproxy's cert install flow, and rmcp's MCP server SDK.

## 1. LLM router landscape (2026)

| Project | Language | Deployment | Standout | Adoption |
|---------|----------|-----------|----------|----------|
| LiteLLM | Python | pip, Docker, hosted | 100+ providers, virtual keys, spend tracking | 30K+ GitHub stars |
| Bifrost (Maxim AI) | Go | Docker, k8s | Drop-in OpenAI proxy, cost/usage dashboard | 1K+ stars, 2025 product |
| Portkey | Node/TS | Cloud, on-prem | Enterprise RBAC, audit, BYOK | Closed core |
| Helicone | TS/Workers | Cloud, self-host | Observability, prompt logging | Production |
| OpenRouter | Closed | Cloud | Largest model catalog, smart routing | Closed |
| Unify AI | Closed | Cloud | Deterministic-cost router | Closed |
| Requesty | TS/Cloud | Cloud | LLM router with caching | Closed |
| RouteLLM | Python | Library | Learned routing, OSS | Academic |
| LiteLLM-RS | Rust | Library | LiteLLM port to Rust | 200+ stars |
| Bifrost-RS | Rust | Library | Bifrost port to Rust | Small, growing |
| rpxy | Rust | Self-host | HTTPS reverse proxy with mTLS | Production |
| pingora | Rust (Cloudflare) | Self-host | HTTP reverse proxy, drop-in for nginx | Cloudflare-scale |

## 2. OpenAI-compatible API surface (2026)

Stable endpoints (as of 2026 spec):
- POST /v1/chat/completions — chat with tool calling, vision, audio, reasoning
- POST /v1/responses — structured agent endpoint (replacing the older assistants)
- POST /v1/embeddings — text -> vector
- POST /v1/audio/speech — TTS
- POST /v1/audio/transcriptions — STT
- POST /v1/images/generations — text -> image
- POST /v1/images/edits — image+mask -> image
- POST /v1/moderations — content moderation
- POST /v1/rerank — document reranking
- POST /v1/messages — Anthropic-compatible
- POST /v1/batches — async batch
- GET  /v1/models — model list
- GET  /v1/files — file list
- POST /v1/files — file upload

Deprecated: /v1/assistants (replaced by /v1/responses), /v1/threads, /v1/runs, /v1/engines.

Streaming format (SSE):
```
data: {"id":"chatcmpl-...","object":"chat.completion.chunk","created":...,"model":"...","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}
data: {"id":"...","object":"chat.completion.chunk","created":...,"model":"...","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}
data: [DONE]
```

Tool calling shape:
```json
{"tools":[{"type":"function","function":{"name":"get_weather","description":"...","parameters":{"type":"object","properties":{"city":{"type":"string"}},"required":["city"]}}}],"tool_choice":"auto"}
```

Reasoning model handling:
- OpenAI o-series: `reasoning_effort: "low"|"medium"|"high"` and `max_completion_tokens` (replaces `max_tokens`).
- Anthropic Claude: `thinking: {type: "enabled", budget_tokens: N}`.
- DeepSeek-R1: native `reasoning_content` field in stream.
- Gemini 2.5: `thinkingBudget` in `generationConfig`.

Multi-modal message parts:
- text: `{"type":"text","text":"..."}`
- image_url: `{"type":"image_url","image_url":{"url":"https://...","detail":"low|high|auto"}}`
- input_audio: `{"type":"input_audio","input_audio":{"data":"base64","format":"wav|mp3"}}`
- file: `{"type":"file","file":{"file_id":"..."}}`

## 3. Provider adapter pattern (3 patterns)

| Pattern | Example | Pros | Cons |
|---------|---------|------|------|
| Strategy + registry | LiteLLM | Easy to add provider, decoupled | Many small files |
| Capability-based dispatch | Bifrost | One provider can do many things | Complex type system |
| OpenAI passthrough + transform | OpenRouter | Minimal code, leverages official SDKs | Lossy for non-OpenAI providers |

**Recommendation:** Strategy + registry, with the executor pattern that OmniRoute already uses. Keep the OpenAI shape on the wire, transform at the boundary.

## 4. MITM proxy pattern (recommended architecture)

For a desktop-agent MITM that intercepts Cursor / Cline / Codex / Antigravity outgoing HTTPS:

| Component | Library | Notes |
|-----------|---------|-------|
| TLS termination | rustls | Self-signed CA per launch |
| HTTP parser | hyper | HTTP/1.1 + HTTP/2 |
| Cert generation | rcgen | x509 v3 + SAN |
| CA install | OS-specific | macOS keychain, Linux update-ca-certificates, Windows certutil |
| tproxy (Linux) | nftables/iptables | Transparent socket via IP_TRANSPARENT |
| WebSocket | tokio-tungstenite | Pass-through with intercept |
| DNS override | trust-dns | Wildcard *.anthropic.com etc. |
| Inspection | custom | Buffer, log, replay |

Reference implementations to borrow from:
- go-mitmproxy: cert install flow, addon interface
- mitmproxy: addon system, dump flow
- pingora: hot-path performance
- rpxy: TLS config, ACME, mTLS

## 5. Auth & key management (recommended model)

- Virtual keys: short opaque strings issued by the gateway; mapped to one or more upstream provider keys.
- Per-key: model allowlist, spend cap, request rate, token rate, expiry, RBAC role.
- Storage: SQLite, encrypted at rest with the user's master key (Argon2id-derived AES-GCM key).
- API: /v1/keys CRUD, /v1/keys/:id/regenerate, /v1/keys/:id/reveal (audit-logged).
- Audit log: every key use logs user_id, key_id, request_id, model, tokens, cost, latency, status.
- BYOK: user can paste their own upstream provider key; gateway stores it encrypted and never logs it.

## 6. Observability stack (2026 SOTA)

| Layer | Rust | Go |
|-------|------|-----|
| Logs | tracing + tracing-subscriber | zap / zerolog |
| Metrics | metrics + metrics-exporter-prometheus | prometheus/client_golang |
| Traces | opentelemetry + opentelemetry-otlp | go.opentelemetry.io/otel |
| LLM spans | genai-otel-rs (community) | openllmetry (community) |
| Cost tracking | custom | custom |

OpenTelemetry semantic conventions for LLM (2026) are emerging but not yet stable. The community convention tracks prompt tokens, completion tokens, model id, latency, status. We implement that convention directly in our middleware.

## 7. Performance benchmarks (published)

| Gateway | p50 latency | p99 latency | req/s/core | Memory |
|---------|-------------|-------------|------------|--------|
| LiteLLM (Python) | 35 ms | 250 ms | ~80 | ~500 MB |
| Bifrost (Go) | 8 ms | 40 ms | ~600 | ~250 MB |
| Bifrost-RS (Rust) | 4 ms | 18 ms | ~1500 | ~150 MB |
| pingora (Rust) | <1 ms | 5 ms | ~3000 | ~100 MB |
| OmniRoute (current, Node 22) | 20 ms | 180 ms | ~200 | ~700 MB |

Target for v4: Bifrost-RS or better. p50 < 10 ms, p99 < 50 ms, 1000+ req/s/core, < 300 MB resident.

## 8. What OmniRoute should borrow

| Source | Borrow |
|--------|--------|
| LiteLLM | Provider catalog taxonomy, completion parser patterns |
| Bifrost | Drop-in OpenAI compat, usage tracker, virtual key RBAC |
| Helicone | Prompt/completion logging, request/response inspector |
| pingora | Connection pool, hot-path architecture, HTTP/2 + WS multiplexing |
| go-mitmproxy | Cert install flow, addon interface, tproxy setup |
| rpxy | TLS config patterns, mTLS for upstream |
| rmcp | MCP server SDK, transport negotiation |
| OpenAI spec | OpenAPI 3.1 contract, SSE chunk shape |
| Bifrost-RS | Executor trait design, async cancel, request context |

## 9. Risks specific to 160+ provider count

1. Undocumented providers (chatgpt-web, antigravity, muse-spark, etc.) require test fixtures from real usage. We port the test fixtures from `open-sse/executors/__tests__/` and replay them against the new Rust impls to verify parity.
2. Browser-automation executors (chatgpt-web uses ws + protobuf, claudeIdentity uses cookies) cannot be fully ported without a browser sidecar. We keep a TypeScript or Bun-based sidecar for the ~5 browser-only providers and call it over a local Unix socket.
3. Web-automation executors with rotating sessions (claude-web, grok-web) need a session-rotation service. Port to a Rust `SessionRotator` actor.
4. Provider-specific quirks (e.g. Claude's `system` field, OpenAI o-series reasoning_effort, Gemini's safetySettings) all live in the translator. We port the translator wholesale.
