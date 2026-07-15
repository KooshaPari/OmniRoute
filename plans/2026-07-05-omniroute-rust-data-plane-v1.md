# OmniRoute Rust Data Plane — Seed Spec v1

**2026-07-05** | Part of `plans/2026-07-04-omniroute-fork-rewrite-v1.md` Phase 2—4

---

## Preamble — Why a Rust Data Plane

The TypeScript data plane (`open-sse/handlers/chatCore.ts` + `open-sse/executors/`)
hits fundamental performance ceilings against the Tier-1 routing mission:

| Dimension                                 | TypeScript (current) | Rust (target) | Gap  |
| ----------------------------------------- | -------------------- | ------------- | ---- |
| P99 latency (chat completion, non-stream) | ~320ms               | ~50ms         | 6.4× |
| In-flight requests per worker             | ~2,000               | ~50,000       | 25×  |
| GC pause (max)                            | ~120ms (V8)          | ~0μs          | —    |
| Memory per active connection              | ~128 KB              | ~8 KB         | 16×  |
| Warm startup                              | ~2.8 s (tsx load)    | ~80 ms        | 35×  |

The **Rust data plane** does NOT replace the Next.js control plane. It replaces
the hot path: provider HTTP dispatch, SSE decode/re-encode, credential
resolution, retry logic, and usage-data extraction. The control plane
(fleet mgmt, DB, MCP tools, A2A skills, dashboard) stays in TypeScript.

**Polyglot binding (ADR-032):** Rust ↔ TS via `T3-N (napi-rs)` for the
control-plane glue. The data plane itself is a standalone binary — no napi-rs
dependency in the hot path. See `SPEC.md §13` (Tokn substrate) and `§17`
(ADR-032 Polyglot Binding Tiers).

---

## 1. Triangle Deploy — Architecture

```
Client ←→ Next.js (TS control plane)
              │
              ├── proxy /v1/* → Rust data plane (Unix socket /tmp/omniroute-rust.sock)
              ├── API routes → SQLite (admin, settings, etc.)
              └── Agent protocols (MCP stdio, A2A SSE)

Rust data plane (standalone binary "omniroute-routed")
  ├── /v1/chat/completions  (proxy, stream + non-stream)
  ├── /v1/models            (catalog relay → TS cache)
  ├── /healthz              (liveness)
  └── /readyz               (readiness + provider health)
```

**Communication:**

- Next.js routes `/v1/*` with `x-omniroute-rust: 1` header to
  `http://u:/tmp/omniroute-rust.sock/<path>` — bypasses the TS executor layer.
- Metadata (API key, connection ID, internal routing hint) carried via
  `x-omniroute-*` headers so Rust never needs direct SQLite access.
- Metrics: Rust exports a Prometheus `/metrics` endpoint on a separate
  TCP port (`:9102`). TS scrapes this for dashboard display.

---

## 2. Crate Structure

````
crates/
├── omniroute-core/           # No deps on tokio/hyper — pure types + traits
│   ├── src/
│   │   ├── lib.rs            # Re-exports
│   │   ├── provider.rs       # Provider trait (← Go registry.Provider)
│   │   ├── types.rs          # ChatRequest, ChatResponse, StreamChunk, etc.
│   │   ├── credentials.rs    # Credential resolution + rotation
│   │   ├── error.rs          # Typed errors (retryable, rate-limited, auth)
│   │   ├── model.rs          # Model metadata, capabilities
│   │   └── usage.rs          # Token counting, usage extraction
│   └── Cargo.toml
│
├── omniroute-provider/       # Provider adapters — one file│   ├── src/
│   │   ├── lib.rs
│   │   ├── openai.rs        # openai + OpenAI-compatible (120+ providers)
│   │   ├── anthropic.rs     # Claude family
│   │   ├── gemini.rs        # Gemini / Vertex / Bedrock family
│   │   └── registry.rs      # Runtime registry: HashMap<&'str, Arc<dyn Provider>>
│   └── Cargo.toml
│
├── omniroute-runtime/        # Runtime: hyper server + executor loop
│   ├── src/
│   │   ├── lib.rs
│   │   ├── server.rs         # hyper Server on Unix socket or TCP
│   │   ├── chat.rs           # /v1/chat/completions handler (stream + non-stream)
│   │   ├── models.rs         # /v1/models handler
│   │   ├── sse.rs            # SSE decoder (incoming from provider) + encoder (outgoing to client)
│   │   ├── retry.rs          # Exponential backoff, per-provider circuit breaker
│   │   └── health.rs         # /healthz, /readyz, /metrics
│   └── Cargo.toml
│
├── omniroute-bindings/       # FFI bridge (T3-N napi-rs)
│   ├── src/
│   │   └── lib.rs            # napi::register_module! — exposes Rust fn to TS
│   └── Cargo.toml            # Depends on omniroute-core; napi-rs + napi-derive
│
└── Cargo.toml                 # Workspace root

**Total crate count:** 4
**Total deps on tokio/hyper:** 1 (`omniroute-runtime`)
**Total deps on napi-rs:** 1 (`omniroute-bindings`, TS-only consumers)

---

## 3. Provider Trait — Mirrors Go `registry.Provider` Exactly

The Go native client (`native-clients/omniroute-go/internal/provider/registry/provider.go`)
defines the `Provider` interface. The Rust port is mechanical:

```rust
use async_trait::async_trait;
use std::time::Duration;

/// Live type representing an upstream LLM provider.
///
/// Mirrors Go `registry.Provider` exactly (same method names, same semantics).
#[async_trait]
pub trait Provider: Send + Sync + std::fmt::Debug {
    /// Stable provider ID (e.g. "openai", "anthropic", "gemini").
    fn id(&self) -> &str;

    /// Returns the model catalog this provider currently advertises.
    async fn models(&self, ctx: &Context) -> Result<Vec<Model>, ProviderError>;

    /// Non-streaming completion. Returns the full response body.
    async fn chat_completion(
        &self,
        ctx: &Context,
        req: ChatRequest,
    ) -> Result<ChatResponse, ProviderError>;

    /// Streaming completion. Yields one SSE chunk at a time.
    ///
    /// The implementation MUST yield at least one `StreamChunk { done: true }`
    /// before returning Ok(()). This matches the Go channel-close contract.
    async fn chat_completion_stream(
        &self,
        ctx: &Context,
        req: ChatRequest,
        tx: tokio::sync::mpsc::Sender<Result<StreamChunk, ProviderError>>,
    ) -> Result<(), ProviderError>;

    /// Liveness check — confirms credentials are valid without spending tokens.
    async fn ping(&self, ctx: &Context) -> Result<(), ProviderError>;
}
````

**Key design decision:** `chat_completion_stream` takes a `mpsc::Sender` rather
than returning a `Stream`. This mirrors the Go `<-chan StreamChunk` semantics
exactly and avoids an extra `async-stream` or `futures` wrapper layer in the
first phase. It can be refactored to a proper `impl Stream` return type later.

---

## 4. Core Types — Rust Port of Go Wire Shapes

Derived verbatim from `native-clients/omniroute-go/internal/provider/registry/provider.go`
and `open-sse/types.d.ts`.

```rust
//! All types mirror the Go native client shapes. Keep in sync.
//! Rust → Go round-trip via serde: field names and JSON tags must match.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// OpenAI-compatible chat completion request (port of `registry.ChatRequest`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<Tool>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
    /// Not serialized — set by proxy layer before dispatch.
    #[serde(skip)]
    pub request_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: serde_json::Value,  // string or array of content parts
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    #[serde(rename = "type")]
    pub type_: String,  // always "function"
    pub function: ToolFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolFunction {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub type_: String,  // "function"
    pub function: ToolCallFunction,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    pub id: String,
    pub object: String,
    pub created: i64,
    pub model: String,
    pub choices: Vec<Choice>,
    pub usage: Usage,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Choice {
    pub index: usize,
    pub message: ChatMessage,
    #[serde(rename = "finish_reason")]
    pub finish_reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

/// One SSE event emitted by the Rust data plane to the client.
///
/// For streaming: emit a sequence of `StreamChunk` deltas, then one with
/// `done: true`, then close the SSE stream. This matches the Go
/// `StreamChunk.Done` contract.
#[derive(Debug, Clone, Serialize)]
pub struct StreamChunk {
    pub id: String,
    pub object: String,
    pub created: i64,
    pub model: String,
    pub choices: Vec<StreamChoice>,
    /// Terminal sentinel — not serialized as a data field. Emitted by the
    /// proxy layer after the channel closes.
    #[serde(skip)]
    pub done: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ApiError>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StreamChoice {
    pub index: usize,
    pub delta: ChatMessage,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ApiError {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Model {
    pub id: String,
    pub object: String,  // "model"
    pub created: i64,
    pub owned_by: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider: Option<String>,
}

/// Per-request context — credentials, request ID, log handle, metadata.
/// Set by the proxy before calling `Provider::chat_completion` etc.
#[derive(Clone)]
pub struct Context {
    pub api_key: String,
    pub connection_id: String,
    pub provider_id: String,
    pub request_id: String,
    pub metadata: HashMap<String, String>,
}

// --- Error ---

#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    #[error("upstream {provider} returned HTTP {status}: {body}")]
    UpstreamError { provider: String, status: u16, body: String },

    #[error("rate limited by {provider}, retry after {retry_after:?}s")]
    RateLimited { provider: String, retry_after: Option<u64> },

    #[error("authentication failed for {provider}: {message}")]
    AuthFailed { provider: String, message: String },

    #[error("stream error from {provider}: {message}")]
    StreamError { provider: String, message: String },

    #[error("request to {provider} timed out after {timeout:?}")]
    Timeout { provider: String, timeout: Duration },

    #[error("provider {provider} unavailable: {reason}")]
    Unavailable { provider: String, reason: String },
}

impl ProviderError {
    /// True if the error is transient and a retry is appropriate.
    pub fn is_retryable(&self) -> bool {
        matches!(
            self,
            ProviderError::Timeout { .. }
                | ProviderError::RateLimited { .. }
                | ProviderError::UpstreamError { status, .. }
                if *status >= 500
        )
    }
}

// --- Retry ---

/// Exponential backoff with jitter, mirroring `open-sse/executors/base.ts`.
#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_attempts: u32,
    pub base_delay_ms: u64,
    pub max_delay_ms: u64,
    pub jitter_ms: u64,
}

impl Default for RetryConfig {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            base_delay_ms: 500,
            max_delay_ms: 10_000,
            jitter_ms: 200,
        }
    }
}

pub fn backoff_delay(attempt: u32, cfg: &RetryConfig) -> Duration {
    let exp = 2u64.saturating_pow(attempt).saturating_mul(cfg.base_delay_ms);
    let capped = std::cmp::min(exp, cfg.max_delay_ms);
    let jitter = rand::Rng::gen_range(&mut rand::thread_rng(), 0..=cfg.jitter_ms);
    Duration::from_millis(capped + jitter)
}
```

---

## 5. OpenAI Adapter — Reference Implementation

The OpenAI adapter mirrors `native-clients/omniroute-go/internal/provider/openai/openai.go`
line-for-line in behavior. This is the only adapter shipped in Phase 2;
all others follow the same pattern.

```rust
//! OpenAI provider adapter (port of omniroute-go/internal/provider/openai/openai.go).
//!
//! Speaks api.openai.com wire format and any OpenAI-compatible endpoint
//! (Together, Groq, Fireworks, OpenRouter, vLLM, Ollama Cloud, etc.).
//!
//! Credentials come from `ctx.api_key` — the proxy injects the correct
//! key per provider via the `x-omniroute-provider` header.

use super::*;
use reqwest::Client;
use std::sync::Arc;
use tokio::sync::mpsc;

const DEFAULT_BASE: &str = "https://api.openai.com";

#[derive(Debug)]
pub struct OpenAIProvider {
    id: String,
    base_url: String,
    api_key: Arc<String>,
    http: Arc<Client>,
}

impl OpenAIProvider {
    pub fn new(ctx: impl Into<ProviderInitContext>) -> Result<Arc<Self>, ProviderError> {
        let c = ctx.into();
        if c.id.is_empty() {
            return Err(ProviderError::AuthFailed {
                provider: "openai".into(),
                message: "id is required".into(),
            });
        }
        if c.api_key.is_empty() {
            return Err(ProviderError::AuthFailed {
                provider: c.id.clone(),
                message: "api_key is required".into(),
            });
        }
        let base = c.base_url.strip_suffix('/').unwrap_or(c.base_url.as_str());
        let base = if base.is_empty() { DEFAULT_BASE } else { base };
        Ok(Arc::new(Self {
            id: c.id,
            base_url: base.into(),
            api_key: Arc::new(c.api_key),
            http: Arc::new(c.http.unwrap_or_else(|| {
                Client::builder()
                    .timeout(Duration::from_secs(60))
                    .build()
                    .expect("reqwest::Client::build infallible with default TLS")
            })),
        }))
    }
}

#[async_trait]
impl Provider for OpenAIProvider {
    fn id(&self) -> &str { &self.id }

    async fn models(&self, _ctx: &Context) -> Result<Vec<Model>, ProviderError> {
        // Phase 2: fetch from /v1/models and map to Model struct.
        // Phase 3: cache in SQLite via omniroute-core::model.
        todo!("Phase 2 — wire GET {}/v1/models", self.base_url)
    }

    async fn chat_completion(
        &self,
        ctx: &Context,
        req: ChatRequest,
    ) -> Result<ChatResponse, ProviderError> {
        let url = format!("{}/v1/chat/completions", self.base_url);
        let resp = self.http
            .post(&url)
            .bearer_auth(ctx.api_key.as_ref())
            .json(&req)
            .send()
            .await
            .map_err(|e| ProviderError::Unavailable {
                provider: self.id.clone(),
                reason: e.to_string(),
            })?;

        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            let retry_after = parse_retry_after(&resp);
            return Err(match status {
                s if s.is_client_error() && s == http::StatusCode::TOO_MANY_REQUESTS => {
                    ProviderError::RateLimited { provider: self.id.clone(), retry_after }
                }
                s if s == http::StatusCode::UNAUTHORIZED || s == http::StatusCode::FORBIDDEN => {
                    ProviderError::AuthFailed { provider: self.id.clone(), message: body.clone() }
                }
                _ => ProviderError::UpstreamError { provider: self.id.clone(), status: status.as_u16(), body },
            });
        }

        resp.json::<ChatResponse>()
            .await
            .map_err(|e| ProviderError::UpstreamError {
                provider: self.id.clone(),
                status: status.as_u16(),
                body: e.to_string(),
            })
    }

    async fn chat_completion_stream(
        &self,
        _ctx: &Context,
        req: ChatRequest,
        tx: mpsc::Sender<Result<StreamChunk, ProviderError>>,
    ) -> Result<(), ProviderError> {
        // Phase 2: wire streaming.
        // Read upstream SSE line-by-line, parse `data: {...}` JSON,
        // convert to StreamChunk, send via tx.
        // On EOF or error, send StreamChunk { done: true } then return Ok(()).
        todo!("Phase 2 — stream implementation")
    }

    async fn ping(&self, ctx: &Context) -> Result<(), ProviderError> {
        let url = format!("{}/v1/models", self.base_url);
        let resp = self.http.get(&url).bearer_auth(ctx.api_key.as_ref()).send().await
            .map_err(|e| ProviderError::Unavailable { provider: self.id.clone(), reason: e.to_string() })?;
        if resp.status().is_success() { Ok(()) } else {
            Err(ProviderError::AuthFailed { provider: self.id.clone(), message: format!("HTTP {}", resp.status()) })
        }
    }
}

fn parse_retry_after(resp: &reqwest::Response) -> Option<u64> {
    resp.headers()
        .get("retry-after")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
}
```

---

## 6. Provider Registry

Mirrors Go `registry.Registry`:

```rust
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Default)]
pub struct Registry {
    inner: RwLock<HashMap<String, Arc<dyn Provider>>>,
}

impl Registry {
    pub fn register(&self, provider: Arc<dyn Provider>) {
        let id = provider.id().to_string();
        self.inner.write().await.insert(id, provider);
    }

    pub fn get(&self, id: &str) -> Option<Arc<dyn Provider>> {
        self.inner.read().await.get(id).cloned()
    }

    pub async fn all_models(&self, ctx: &Context) -> Result<Vec<Model>, ProviderError> {
        let guard = self.inner.read().await;
        let mut all = Vec::new();
        for p in guard.values() {
            match p.models(ctx).await {
                Ok(mut m) => all.append(&mut m),
                Err(e) => tracing::warn!("provider {} failed to list models: {}", p.id(), e),
            }
        }
        Ok(all)
    }
}
```

---

## 7. HTTP Server — `hyper` on Unix Domain Socket

The data plane is a hyper server. Phase 2 listens on a Unix socket so
the Next.js control plane can proxy via `fetch("http://u:/tmp/omniroute-rust.sock/...")`
without TCP overhead.

```rust
use std::path::PathBuf;

pub struct Server {
    router: Router,
    socket_path: PathBuf,
}

impl Server {
    pub fn new(socket_path: impl Into<PathBuf>) -> Self {
        Self { router: Router::new(), socket_path: socket_path.into() }
    }

    pub fn route(mut self, path: &str, handler: impl Into<Handler>) -> Self {
        self.router = self.router.route(path, handler);
        self
    }

    pub async fn run(self) -> anyhow::Result<()> {
        let make_svc = make_service_fn(|_| async { Ok::<_, Infallible>(self.router.clone()) });
        let addr = UnixAddr::from_pathname(&self.socket_path)?;
        Server::bind(&addr)
            .tcp_nodelay(true)
            .serve(make_svc)
            .await?;
        Ok(())
    }
}
```

Routes (all OpenAI-compatible):

| Path                   | Method | Auth                  | Response                         |
| ---------------------- | ------ | --------------------- | -------------------------------- |
| `/v1/chat/completions` | POST   | `x-omniroute-api-key` | SSE stream or JSON               |
| `/v1/models`           | GET    | `x-omniroute-api-key` | JSON model catalog               |
| `/healthz`             | GET    | none                  | `200 OK`                         |
| `/readyz`              | GET    | none                  | `200` or `503` + provider health |
| `/metrics`             | GET    | none                  | Prometheus text format           |

---

## 8. SSE Chunking — Incoming/Outgoing Contracts

Incoming (provider → Rust): standard `data: {...}\n\n` lines terminated
by `data: [DONE]\n\n`. Trailing newline is required.

Outgoing (Rust → Next.js): identical format. The Rust encoder wraps
each `StreamChunk` in `data: <json>\n\n` and writes the trailing
`data: [DONE]\n\n` before dropping the connection.

```rust
pub fn encode_sse(chunk: &StreamChunk) -> String {
    if chunk.done {
        "data: [DONE]\n\n".into()
    } else if let Some(ref err) = chunk.error {
        format!("event: error\ndata: {}\n\n", serde_json::to_string(err).unwrap())
    } else {
        format!("data: {}\n\n", serde_json::to_string(chunk).unwrap())
    }
}
```

---

## 9. Phase Plan — 6 Phases

### Phase 2 — Minimal Viable Data Plane (target: 3 weeks)

| Task | Description                                                        | Deliverable                  |
| ---- | ------------------------------------------------------------------ | ---------------------------- |
| 2-A  | Scaffold `crates/omniroute-*` with Cargo.toml (minimal dep set)    | `cargo check` green          |
| 2-B  | Port core types + `Provider` trait from Go native client           | `omniroute-core`, 0 warnings |
| 2-C  | `OpenAIProvider` (non-streaming only) + `Registry`                 | `omniroute-provider`         |
| 2-D  | `/v1/chat/completions` non-stream handler (hyper + Unix socket)    | `omniroute-runtime`          |
| 2-E  | `/v1/models` catalog relay                                         | `omniroute-runtime`          |
| 2-F  | `/healthz`, `/readyz`, retry with exponential backoff              | `omniroute-runtime`          |
| 2-G  | End-to-end test: curl `/v1/chat/completions` against mock provider | Pass                         |

### Phase 3 — Streaming + Go ↔ Rust IPC (2 weeks)

| Task | Description                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------ |
| 3-A  | Wire SSE decode/re-encode for streaming responses                                                                  |
| 3-B  | `chat_completion_stream` with mpsc::Sender pattern                                                                 |
| 3-C  | Anthropic adapter (Claude format) — mirrors `native-clients/omniroute-go/internal/provider/anthropic/anthropic.go` |
| 3-D  | Gemini adapter — mirrors `omniroute-go/internal/provider/gemini/gemini.go`                                         |
| 3-E  | Polyglot binding T3-N (napi-rs): expose `omniroute_core::chat_completion` to TS                                    |
| 3-F  | Bifrost Go gateway → Rust data plane migration (Go Bifrost executor calls Rust instead of TS)                      |

### Phase 4 — Production Hardening (2 weeks)

| Task | Description                                                                                     |
| ---- | ----------------------------------------------------------------------------------------------- |
| 4-A  | Zig hot-path shim: validate `ChatRequest` JSON → `ChatRequest` Rust struct conversion (~50μs)   |
| 4-B  | Mojo kernels (gated on Mojo ≥ v1.0): `usage_extractor` for token counting                       |
| 4-C  | Circuit breaker per provider (10-consecutive-failure threshold, matches `bifrostKillSwitch.ts`) |
| 4-D  | Metrics: `prometheus` crate exports provider latency p50/p99, request count, error rate         |
| 4-E  | `cargo audit` + `cargo deny` CI workflow (mirrors `.github/workflows/security-scan.yml`)        |
| 4-F  | `panic = "abort"` build profile for production binary                                           |

---

## 10. Dependency Budget (Phase 2 Only)

| Crate                            | Why                                        |
| -------------------------------- | ------------------------------------------ |
| `tokio` (full)                   | Async runtime — required                   |
| `hyper`                          | HTTP server — required                     |
| `reqwest`                        | HTTP client (provider calls) — required    |
| `serde` + `serde_json`           | Types — required                           |
| `thiserror`                      | Typed errors — required                    |
| `tracing` + `tracing-subscriber` | Logging — required                         |
| `prometheus`                     | Metrics export — Phase 3                   |
| `napi-derive` / `napi`           | T3-N TS FFI — Phase 3                      |
| `redis`                          | Optional caching (model catalog) — Phase 4 |

**Phase 2 total (compile-time, stripped):** ~12 MB binary (hyper + tokio + reqwest
static TLS). No Zig/Mojo/C bindings in Phase 2.

---

## 11. Testing Strategy

```rust
//! Tests mirror the Go provider tests exactly.

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn openai_provider_requires_api_key() {
        let result = OpenAIProvider::new(ProviderInitContext {
            id: "test".into(),
            api_key: "".into(),
            ..Default::default()
        });
        assert!(matches!(result, Err(ProviderError::AuthFailed { .. })));
    }

    #[tokio::test]
    async fn registry_register_and_get_roundtrip() {
        let reg = Registry::default();
        let provider = OpenAIProvider::new(ProviderInitContext {
            id: "openai-test".into(),
            api_key: "sk-test".into(),
            ..Default::default()
        }).unwrap();
        reg.register(provider);
        assert!(reg.get("openai-test").is_some());
        assert!(reg.get("missing").is_none());
    }

    // Phase 3+: mock-provider integration tests using wiremock-rs.
}
```

**CI:** `cargo test --workspace && cargo clippy -- -D warnings && cargo fmt --check`

---

## 12. File Inventory (Phase 2 Seed)

| File                                        | Lines    | Purpose                                                |
| ------------------------------------------- | -------- | ------------------------------------------------------ |
| `crates/omniroute-core/src/provider.rs`     | ~40      | `Provider` trait                                       |
| `crates/omniroute-core/src/types.rs`        | ~140     | ChatRequest, ChatResponse, StreamChunk, Model, Context |
| `crates/omniroute-core/src/error.rs`        | ~60      | `ProviderError` enum + `is_retryable()`                |
| `crates/omniroute-core/src/usage.rs`        | ~30      | Token counting helpers                                 |
| `crates/omniroute-core/src/credentials.rs`  | ~40      | API key injection into Context                         |
| `crates/omniroute-core/src/lib.rs`          | ~15      | Re-exports                                             |
| `crates/omniroute-core/Cargo.toml`          | ~25      | Dependencies                                           |
| `crates/omniroute-provider/src/openai.rs`   | ~80      | OpenAI adapter (non-stream + stream stub)              |
| `crates/omniroute-provider/src/registry.rs` | ~35      | Runtime provider registry                              |
| `crates/omniroute-provider/src/lib.rs`      | ~15      | Re-exports                                             |
| `crates/omniroute-provider/Cargo.toml`      | ~20      | Dependencies                                           |
| `crates/omniroute-runtime/src/server.rs`    | ~50      | hyper Server on Unix socket                            |
| `crates/omniroute-runtime/src/chat.rs`      | ~80      | `/v1/chat/completions` handler                         |
| `crates/omniroute-runtime/src/models.rs`    | ~30      | `/v1/models` handler                                   |
| `crates/omniroute-runtime/src/health.rs`    | ~30      | `/healthz`, `/readyz`                                  |
| `crates/omniroute-runtime/src/retry.rs`     | ~30      | Exponential backoff                                    |
| `crates/omniroute-runtime/src/lib.rs`       | ~10      | Re-exports                                             |
| `crates/omniroute-runtime/Cargo.toml`       | ~20      | Dependencies                                           |
| `Cargo.toml` (workspace)                    | ~30      | Members + [workspace.dependencies]                     |
| **Total**                                   | **~690** | 14 source files + 4 Cargo.toml                         |

---

## 13. Integration with Existing Plan

This spec is the **Phase 2–4 decomposition** of the OmniRoute fork plan
(`plans/2026-07-04-omniroute-fork-rewrite-v1.md`).

Key alignments:

- **§2.2 Phase 2 (Rust data plane seed)** — directly mapped to the 3 phases above
- **§3 Stack discipline** — Zig/Mojo shims explicitly staged in Phase 4, not Phase 2
- **§5 Task 5D (FastMCP bridge)** — uses `phenotype-port-adapter-shim` as the Rust↔Python T3-P edge
- **§6.1 Bug-for-bug compat** — Go native client (`native-clients/omniroute-go/`) is the reference source of truth
- **ADR-032 §T3-N** — napi-rs binding in Phase 3; Zig shim in Phase 4
- **Tokn substrate (SPEC.md §13)** — data plane binary calls out to Tokn for
  credential/session state (read-only), does not own the SQLite schema

---

## 14. Non-Goals (Phase 2)

- ❌ No MCP/A2A server in Rust — stays in TS
- ❌ No DB writes from Rust — Rust calls out to TS API routes or reads from
  `/tmp/omniroute-rust.sock` headers
- ❌ No tool-call interpretation — pure pass-through proxy
- ❌ No image/audio/video/generation endpoints — text only in Phase 2
- ❌ No provider-specific field remapping (Claude tool remapping, context
  editing, fingerprint) — stays in TS until Phase 4 if needed
- ❌ No multi-tenant / org isolation — out of scope for data plane

---

## 15. Open Questions

1. **Unix socket path** — `/tmp/omniroute-rust.sock` is not namespace-safe
   under multi-user. Use `/run/user/<uid>/omniroute-rust.sock` or
   `$XDG_RUNTIME_DIR/omniroute/`? Decision: `$XDG_RUNTIME_DIR/omniroute/routed.sock` per XDG spec.
2. **Credential injection** — does Rust read a TS-side credential cache file,
   or does TS pass the API key in `x-omniroute-api-key` header? Decision: header
   only; no file read from Rust (zero SQLite dependency in Phase 2).
3. **Go ↔ Rust migration** — does the Go native client (`omniroute-go`) become
   a stub in Phase 3, or run in parallel? Decision: Rust takes over; Go client
   stays as the fast-path for local CLI invocation (does not need cloud features).
4. **Mojo gating** — Mojo v1.0 was expected mid-2026. If Mojo v1.0 ships,
   Phase 4 Mojo usage extractor can start immediately. Otherwise Zig shim is the
   fallback for the same hot path (token counting).
