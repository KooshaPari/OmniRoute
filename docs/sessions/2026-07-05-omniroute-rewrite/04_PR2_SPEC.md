# PR-2 Spec -- omni-core/provider::HttpExecutor + First Wire-Up Executor

> **Audit date:** 2026-07-05
> **Branch base:** `feat/omni-foundation-2026-07-05` (12-crate workspace, 141 tests green)
> **Branch head today:** `feat/pr1-extend-omni-core` (`c62621a9d`, 4 commits ahead of foundation)
> **Companion:** `00_SESSION_OVERVIEW.md`, `01_TS_BACKEND_INVENTORY.md`, `02_POLYGLOT_ARCHITECTURE.md`, `03_BOUNDARY_IPC_FFI.md`
> **Status:** DRAFT v0.1 (parent agent + sponsor sign-off required)

PR-1 (`d57fe55da`) is **types-only**: it added `RequestId` / `TraceId` / `ModelId` / `TenantId` / `ApiKeySlug` / `ComboId`, hardened `Config` (chaos + opencode sections, `ErrorKind`), and fixed the `DelayForAttempt` sub-second bug. **PR-1 still has zero real provider executors.** The `Executor` trait exists; no impl is checked in.

**PR-2 is the first real executor and the first wire-up of `Executor` -> `omni-server::dispatcher`.** After PR-2, the workspace can answer one OpenAI-shape request end-to-end against a fake upstream; PR-3+ add real providers.

---

## 1. Goal (3-5 bullets)

- Land `omni_core::provider::HttpExecutor` -- a generic, transport-only `Executor` impl that speaks **OpenAI `/v1/chat/completions`** wire format over `reqwest` + `rustls`, parameterized by a `Provider` config record (base URL, auth header, default model).
- Land `omni_server::dispatcher::route` -- the first end-to-end route: an axum handler at `POST /v1/chat/completions` that takes an `ExecutorRequest`, looks up the right `HttpExecutor` by `ProviderId`, calls `execute`, and shapes the response back into the OpenAI wire format.
- Add **request body validation** (model required, messages non-empty, `stream` is bool, `temperature` in `[0.0, 2.0]`) and a single 4xx mapping in `omni_server::error::ApiError`.
- Add **streaming end-to-end**: a real `axum::response::sse::Sse` response for `stream: true` requests, with `StreamEvent` -> SSE wire mapping.
- Land **8 new tests** (doctest + integration), raise workspace test count from 141 to **>= 158**. Do not regress any existing test.

---

## 2. Crate(s) touched

| Crate | Files added | Files modified | Approx LoC added | Purpose |
|---|---|---|---|---|
| `omni-core` | `provider/http_executor.rs` | `provider/mod.rs`, `executor.rs` (helper), `error.rs` (1 variant), `Cargo.toml` (reqwest) | ~520 | The generic transport-only executor; one impl works for any OpenAI-shape provider |
| `omni-server` | `dispatcher/route.rs`, `dispatcher/openai_shape.rs`, `error.rs` | `dispatcher/mod.rs`, `dispatcher.rs` (re-export), `Cargo.toml` (axum SSE, tracing) | ~640 | First axum route, OpenAI request/response shape, ApiError, SSE plumbing |
| `omni-telemetry` | -- | `Cargo.toml` (1 dep), `src/middleware.rs` (trace-context injector) | ~80 | OTel trace context propagation from inbound headers into `ExecutorRequest.trace_id` |

Total: ~1240 LoC, 3 crates, 0 new crates, 0 removed crates.

---

## 3. Public API surface

### 3.1 `omni_core::provider::HttpExecutor` (new)

```rust
//! Generic OpenAI-shape provider executor.
//!
//! One `HttpExecutor` instance = one provider (one base URL, one auth header,
//! one default model). Stateless across requests; pool state lives in the
//! shared `reqwest::Client` passed at construction.

use std::time::Duration;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

use crate::error::{Error, ErrorKind, Result};
use crate::executor::{
    CompleteResponse, Executor, ExecutorCapabilities, ExecutorRequest,
    ExecutorResponse, RetryPolicy, StreamEvent, UsageMetrics,
};
use crate::ids::{ProviderId, ProviderKind};

/// Wire-format hint; PR-2 only supports `OpenAi`; PR-3 adds `Anthropic`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WireFormat { OpenAi, Anthropic } // PR-2 only constructs OpenAi

/// Configuration for a single provider. Loaded from `Config.providers`.
#[derive(Debug, Clone)]
pub struct HttpExecutorConfig {
    pub provider_id: ProviderId,
    pub kind: ProviderKind,
    pub base_url: String,        // e.g. "https://api.openai.com"
    pub auth_header: String,     // e.g. "Bearer sk-..."
    pub default_model: String,   // e.g. "gpt-4o"
    pub request_timeout: Duration,
    pub wire: WireFormat,
}

/// Generic OpenAI-shape provider executor.
pub struct HttpExecutor {
    cfg: HttpExecutorConfig,
    client: reqwest::Client,
}

impl HttpExecutor {
    /// Build a new executor. Validates `base_url` parses, `default_model`
    /// non-empty, `request_timeout > 0`.
    pub fn new(cfg: HttpExecutorConfig) -> Result<Self>;

    /// Borrow the shared reqwest client (used by tests to point at
    /// `wiremock`/`httpmock`).
    pub fn client(&self) -> &reqwest::Client;
}

#[async_trait]
impl Executor for HttpExecutor {
    async fn execute(&self, req: ExecutorRequest) -> Result<ExecutorResponse>;
    async fn health(&self) -> Result<()>;        // GET {base_url}/models with auth
    fn capabilities(&self) -> ExecutorCapabilities;
    fn provider_id(&self) -> ProviderId;
    fn retry_policy(&self) -> RetryPolicy;
}
```

### 3.2 `omni_server::dispatcher::route` (new)

```rust
//! First real route. OpenAI `/v1/chat/completions` against a
//! `ProviderRegistry` (newtype over `HashMap<ProviderId, Arc<dyn Executor>>`).

use axum::{extract::State, http::StatusCode, response::sse::Sse, Json};
use serde::{Deserialize, Serialize};

use omni_core::executor::{ExecutorRequest, ExecutorResponse, StreamEvent};
use omni_core::ids::{RequestId, TraceId};
use omni_core::provider::ProviderId;

#[derive(Clone)]
pub struct AppState {
    pub registry: ProviderRegistry,
}

#[derive(Debug, Deserialize)]
pub struct OpenAiChatRequest {
    pub model: String,
    pub messages: Vec<OpenAiMessage>,
    #[serde(default)]
    pub stream: bool,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

#[derive(Debug, Serialize)]
pub struct OpenAiChatResponse {
    pub id: String,
    pub object: String,        // "chat.completion"
    pub created: i64,
    pub model: String,
    pub choices: Vec<OpenAiChoice>,
    pub usage: Option<OpenAiUsage>,
}

/// `POST /v1/chat/completions` -- single handler for both shapes.
pub async fn chat_completions(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    Json(req): Json<OpenAiChatRequest>,
) -> Result<axum::response::Response, ApiError>;
```

### 3.3 `omni_server::error::ApiError` (new)

```rust
use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("invalid request: {0}")]      BadRequest(String),
    #[error("upstream error: {status}")]  Upstream { status: u16, body: String },
    #[error("upstream timeout")]          UpstreamTimeout,
    #[error("not found: {0}")]            NotFound(String),
    #[error("internal error")]            Internal(#[source] anyhow::Error),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, code) = match &self {
            Self::BadRequest(_)        => (StatusCode::BAD_REQUEST,  "invalid_request_error"),
            Self::Upstream { status, ..} => (StatusCode::BAD_GATEWAY, "upstream_error"),
            Self::UpstreamTimeout       => (StatusCode::GATEWAY_TIMEOUT, "upstream_timeout"),
            Self::NotFound(_)           => (StatusCode::NOT_FOUND,    "not_found"),
            Self::Internal(_)           => (StatusCode::INTERNAL_SERVER_ERROR, "internal_error"),
        };
        (status, Json(json!({
            "error": { "type": code, "message": self.to_string() }
        }))).into_response()
    }
}
```

---

## 4. Migration path from PR-1

| PR-1 type / method | PR-2 status | Notes |
|---|---|---|
| `Executor` trait | **preserved** | New `HttpExecutor` impl; no signature change |
| `ExecutorRequest` | **preserved + 1 helper** | New `ExecutorRequest::with_provider_defaults(provider_id, model)` for the common path |
| `ExecutorResponse::{Complete, Streaming}` | **preserved** | No change; SSE mapping added in `omni-server` |
| `CompleteResponse.usage` | **preserved** | New `OpenAiUsage` shape in server layer translates to `UsageMetrics` |
| `StreamEvent::{data, named, terminal}` | **preserved** | SSE wire mapping lives in `dispatcher/openai_shape.rs` |
| `RetryPolicy` | **preserved** | `HttpExecutor::retry_policy` returns a default; per-provider overrides land in PR-3 |
| `Config` | **preserved** | New `providers: ProvidersConfig` field (added by PR-1). `HttpExecutorConfig` is loaded from this. |
| `Error` / `ErrorKind` | **preserved + 1 variant** | New `ErrorKind::Upstream { status, retriable }`; `Error::upstream(...)` constructor |
| `Provider` / `ProviderId` / `ProviderKind` | **preserved** | `HttpExecutorConfig` uses both |
| `omni_server::dispatcher::Dispatcher` | **replaced** | PR-1 had a placeholder (`7 insertions` in `dispatcher.rs`); PR-2 replaces it with `route::chat_completions` + `AppState` |
| `omni_server::record_call_log` futures | **preserved (already fixed in `686eb215e`)** | PR-2 calls the same `record_call_log` after every `execute` |

**No PR-1 type is removed or renamed.** PR-2 is purely additive.

---

## 5. Test plan (>= 6 new tests, all must pass)

| # | Test file | Test function | What it asserts |
|---|---|---|---|
| 1 | `omni-core/tests/http_executor.rs` | `http_executor_sends_openai_shape_body` | Mock upstream receives a body that round-trips through `OpenAiChatRequest -> ExecutorRequest -> wire`; verifies model, messages, stream=false, temperature passthrough |
| 2 | `omni-core/tests/http_executor.rs` | `http_executor_streams_sse_events` | `stream: true` returns `ExecutorResponse::Streaming`; events arrive in order; terminal event is last |
| 3 | `omni-core/tests/http_executor.rs` | `http_executor_health_ok` | `health()` GETs `{base_url}/models` with auth, returns `Ok(())` on 2xx and `Err(Internal)` on 5xx |
| 4 | `omni-core/tests/http_executor.rs` | `http_executor_upstream_4xx_maps_to_upstream_error` | 4xx from upstream becomes `ErrorKind::Upstream { status, retriable: false }` |
| 5 | `omni-core/tests/http_executor.rs` | `http_executor_upstream_429_is_retriable` | 429 becomes `ErrorKind::Upstream { status, retriable: true }` |
| 6 | `omni-server/tests/chat_route.rs` | `chat_completions_round_trips_against_mock` | Spin up `wiremock`, build `AppState{registry}`, `POST /v1/chat/completions` with `OpenAiChatRequest`, verify response shape and that `record_call_log` was called exactly once with the right `ApiCallId` / `TraceId` |
| 7 | `omni-server/tests/chat_route.rs` | `chat_completions_streaming_returns_sse` | Same as 6 but `stream: true`; assert response is `Content-Type: text/event-stream`, each line is a JSON-encoded `OpenAiChatResponse`-shaped chunk, last line is `[DONE]` |
| 8 | `omni-server/tests/chat_route.rs` | `chat_completions_rejects_empty_messages_with_400` | `messages: []` -> 400, body is `{"error":{"type":"invalid_request_error",...}}` |

`cargo test -p omni-core -p omni-server` must pass; total workspace test count >= 158 (was 141 at foundation; PR-1 added 17 = 158; PR-2 adds >= 6 new on top).

---

## 6. Dependency delta

| Crate | Added | Removed | Bumped |
|---|---|---|---|
| `omni-core` | `reqwest = { version = "0.12", default-features = false, features = ["rustls-tls", "json", "stream"] }`, `wiremock = { version = "0.6", optional = true }` (dev-dep already) | -- | -- |
| `omni-server` | `axum = { version = "0.8", features = ["macros", "http2"] }` (already present; enable SSE), `tower-http = { version = "0.6", features = ["trace"] }` | -- | `axum` to 0.8.4 (latest patch) |
| `omni-telemetry` | `tracing-opentelemetry = "0.27"` | -- | `opentelemetry` to 0.26 (latest) |

Justification: the polyglot library matrix in `02_POLYGLOT_ARCHITECTURE.md` section 3.1 already lists `reqwest` 0.12, `axum` 0.8, `rustls` 0.23, `tracing-opentelemetry`. PR-2 just turns the on-dep entries into actual `Cargo.toml` lines.

---

## 7. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | `reqwest` with `rustls-tls` on macOS needs `rustls` platform verifier; CI may differ from local | Medium | Low | Pin `rustls` 0.23 and `rustls-platform-verifier` 0.3 as the explicit TLS stack; doc the choice in `omni-core/Cargo.toml` |
| R-2 | SSE from `axum::response::sse::Sse` requires the inner stream to be `Send + 'static`; `StreamEvent` is fine but the `Box<dyn Stream>` needs explicit `Pin<Box<dyn Stream<Item = Result<StreamEvent>> + Send>>` | Low | Medium | `executor.rs` already uses this exact shape; copy verbatim. Add a doctest for the SSE wire mapping. |
| R-3 | First end-to-end route means the dispatcher stops being a placeholder; existing tests in `omni-server/tests/` that referenced `Dispatcher::new` may break | Medium | Medium | `git grep -n 'Dispatcher::new' omni-server/`; if any caller exists, port to `AppState{registry}` in the same PR; do NOT leave a shim |
| R-4 | The OpenAI shape mapping (`OpenAiChatRequest -> ExecutorRequest.body`) is lossy; some `extra` fields (e.g. `tools`, `response_format`, `logit_bias`) won't survive the first pass | High | Low | Pass through via `extras: serde_json::Value` on `ExecutorRequest` (already PR-1); document the loss in `openai_shape.rs`; PR-3 adds explicit field translation |
| R-5 | The mock upstream tests use `wiremock`; if `wiremock` 0.6 conflicts with `reqwest` 0.12 features, integration tests may fail to compile | Low | Low | Pin `wiremock = "0.6"`; add `[dev-dependencies]` only; do NOT enable `wiremock` in non-test builds |
| R-6 | `record_call_log` (`686eb215e`) was already fixed for futures; PR-2 must use the same async-record pattern in the new route, or risk a regression | Low | High | Lint: every call site must `tokio::spawn` the future and `await` the join handle; the `omni-server` test in slot #6 asserts `record_call_log` was awaited exactly once |

---

## 8. Out of scope (PR-3+)

Explicitly NOT in PR-2:

- Real providers (OpenAI, Anthropic, Google, Bedrock, Vertex, etc.) -- PR-3 adds a per-provider config layer on top of `HttpExecutor`.
- Translator (`omni-translator` crate) -- PR-2 only does OpenAI-in / OpenAI-out. Anthropic-in / OpenAI-out translation lands in PR-3 alongside the Anthropic wire format.
- Streaming transformers (`streamingPiiTransform`, `sseTextTransform`) -- PR-2 emits raw SSE; PR-4 wraps the stream with the transform pipeline.
- Authentication / API key validation on the inbound side -- PR-2 trusts the caller; PR-5 adds `omni-auth` middleware.
- Quota / cost enforcement -- PR-5 (with auth).
- CLI / SDK surface for invoking `HttpExecutor` directly -- PR-6 (`omni-cli` and `omni-sdk`).
- Bifrost / relay (L5-122) -- separate track, owned by the bifrost lane.
- Mojo / WASM / FFI -- out of v1 entirely per the polyglot spec.
- The `pheno/bifrost/` empty crate cleanup -- separate PR.

---

## 9. Exit criteria (PR-2 is "done" when ALL true)

1. `cargo build --workspace --all-targets` exits 0.
2. `cargo test --workspace` exits 0 with >= 158 tests passing.
3. `cargo clippy --workspace --all-targets -- -D warnings` exits 0.
4. `cargo fmt --all -- --check` exits 0.
5. The 8 new tests (slot #1-#8 above) all pass.
6. No PR-1 type or method is removed, renamed, or has its signature changed.
7. The single diff commit message: `feat(omni-core+omni-server): PR-2 HttpExecutor + first chat route`.
8. `work/WORK.md` is updated to mark `PR-2` `[ok]` and the forward DAG reflects the new state.
9. `worklogs/2026-07-05-pr2-http-executor.md` exists with the standard session log format.

---

## 10. Open questions for sponsor (none blocking)

- Q1 -- `request_timeout` default: 30s (matches `reqwest` default) or 60s (matches OpenAI's `gpt-4o` SLA)? Recommend 30s; per-provider override in PR-3.
- Q2 -- `temperature` clamp on inbound: reject `> 2.0` with 400, or clamp to 2.0? Recommend reject (matches OpenAI's server-side behavior).
- Q3 -- `stream: true` but the provider's `HttpExecutorConfig.wire != OpenAi` -- return 400 or auto-fallback to non-streaming? Recommend 400 for PR-2; PR-3 handles per-provider streaming support flag.

All three are deferrable to the PR-3 spec if sponsor prefers not to decide now.
