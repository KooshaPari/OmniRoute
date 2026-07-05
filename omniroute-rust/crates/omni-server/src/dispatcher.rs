//! Request dispatcher.
//!
//! Bridges the HTTP handler layer to the router + executor + translator
//! + storage stack. Each call follows the same pipeline:
//!
//! ```text
//! client body (OpenAI / Anthropic / Gemini wire)
//!   -> detect wire format
//!   -> router picks a provider (with circuit breaker, strategy, fallback)
//!   -> translate body to provider wire
//!   -> executor.execute() (handles auth header, base url, streaming)
//!   -> translate response back to client wire
//!   -> write a call_log row + usage_history-style aggregates (best-effort)
//!   -> return DispatchOutcome
//! ```
//!
//! The dispatcher never panics. Every error is mapped to a typed
//! `ServerError` so axum can convert it to a JSON HTTP response.

use std::pin::Pin;
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::response::sse::Event;
use chrono::Utc;
use futures::Stream;
use futures::StreamExt;
use serde_json::{json, Value};
use tracing::{debug, error, warn, Instrument};
use uuid::Uuid;

use omni_core::executor::{CompleteResponse, ExecutorRequest, ExecutorResponse, StreamEvent};
use omni_core::provider::ProviderKind;
use omni_protocol::WireFormat;
use omni_router::{ProviderHandle, RoutingContext, Strategy};
use omni_storage::repo::call_log_repo;
use omni_storage::{
    ApiKeyId, CallLog, CallLogId, CallLogStatus, ProviderRecordId, TenantId, WorkspaceId,
};
use omni_translator::{streaming as stream_translate, translate_request, translate_response};

use crate::state::{App, AuthKey, ServerError, ServerResult};

/// Maximum number of fallback attempts before giving up. Bounds tail latency
/// and prevents a single bad request from trying every provider.
const MAX_FALLBACKS: usize = 2;

/// Default per-call upstream timeout. The config can lower this.
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(120);

/// Outcome of a dispatcher call.
pub enum DispatchOutcome {
    /// A single JSON response.
    Json(Value),
    /// A server-sent event stream. The handler wraps this in `Sse<...>`.
    Sse(Pin<Box<dyn Stream<Item = Result<Event, std::io::Error>> + Send>>),
    /// Streaming JSON Lines (used for `/v1/combos`).
    JsonLines(Pin<Box<dyn Stream<Item = Result<Value, std::io::Error>> + Send>>),
}

/// Identifier for the API surface that initiated the call. Stamped into
/// the call_log row so analytics can break down by surface.
#[derive(Debug, Clone, Copy)]
pub enum Surface {
    OpenaiChat,
    OpenaiEmbeddings,
    OpenaiImages,
    OpenaiAudio,
    AnthropicMessages,
    AnthropicCountTokens,
    Combo,
}

impl Surface {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::OpenaiChat => "openai_chat",
            Self::OpenaiEmbeddings => "openai_embeddings",
            Self::OpenaiImages => "openai_images",
            Self::OpenaiAudio => "openai_audio",
            Self::AnthropicMessages => "anthropic_messages",
            Self::AnthropicCountTokens => "anthropic_count_tokens",
            Self::Combo => "combo",
        }
    }
}

/// State captured at call start; the call_log row is constructed from this
/// once the call completes.
struct CallContext {
    pub request_id: Uuid,
    pub surface: Surface,
    pub model: String,
    pub tenant_id: TenantId,
    pub workspace_id: WorkspaceId,
    pub api_key_id: Option<ApiKeyId>,
    pub started_at: chrono::DateTime<Utc>,
    pub started_instant: Instant,
}

/// Resolve a wire format from the inbound body.
fn detect_wire(body: &Value) -> WireFormat {
    if body.get("system").is_some() && body.get("messages").is_some() {
        // Anthropic uses both, but presence of "system" + "max_tokens" is a
        // strong Anthropic signal. Default to Claude when both are present
        // because the OpenAI Chat Completions shape does not use "system"
        // as a top-level field — it appears only inside messages[].role=system.
        if body.get("max_tokens").is_some() {
            return WireFormat::Claude;
        }
    }
    if body.get("input").is_some() && body.get("instructions").is_some() {
        return WireFormat::Codex;
    }
    if body.get("contents").is_some() || body.get("systemInstruction").is_some() {
        return WireFormat::Gemini;
    }
    WireFormat::Openai
}

/// Pick the provider wire format. OpenAI-compat is the universal default;
/// Anthropic has its own shape. Gemini for v1 is shimmed through OpenAI
/// compat at the executor level (see `executors::executor_for_kind`).
fn provider_wire_format(handle: &ProviderHandle) -> WireFormat {
    let kind = match handle.id.0.as_str() {
        "anthropic" => ProviderKind::Anthropic,
        "google" | "gemini" => ProviderKind::Google,
        _ => ProviderKind::Default,
    };
    match kind {
        ProviderKind::Anthropic => WireFormat::Claude,
        _ => WireFormat::Openai,
    }
}

/// Build the `RoutingContext` for a chat call.
fn routing_context(model: &str, stream: bool) -> RoutingContext {
    RoutingContext {
        model: model.to_string(),
        estimated_tokens: 0,
        budget_remaining_usd: None,
        require_streaming: stream,
        strategy: Strategy::FallbackChain,
    }
}

fn tenant_workspace_for(auth: Option<&AuthKey>) -> (TenantId, WorkspaceId, Option<ApiKeyId>) {
    match auth {
        Some(a) => {
            let tid = uuid::Uuid::parse_str(&a.tenant_id)
                .map(TenantId)
                .unwrap_or_default();
            let wid = uuid::Uuid::parse_str(&a.workspace_id)
                .map(WorkspaceId)
                .unwrap_or_default();
            let kid = uuid::Uuid::parse_str(&a.id).ok().map(ApiKeyId);
            (tid, wid, kid)
        }
        None => (TenantId::default(), WorkspaceId::default(), None),
    }
}


use std::collections::BTreeMap;

fn executor_for_kind_by_id(handle: &ProviderHandle) -> Arc<dyn omni_core::Executor> {
    let kind = match handle.id.0.as_str() {
        "anthropic" => ProviderKind::Anthropic,
        _ => ProviderKind::OpenAI,
    };
    crate::executors::executor_for_kind(kind)
}

fn map_exec_err(e: omni_core::Error) -> ServerError {
    let kind = e.kind();
    match kind {
        omni_core::ErrorKind::BadRequest => ServerError::BadRequest(e.to_string()),
        omni_core::ErrorKind::NotFound => ServerError::NotFound(e.to_string()),
        omni_core::ErrorKind::Unauthorized => ServerError::Unauthorized,
        omni_core::ErrorKind::Forbidden => ServerError::Forbidden,
        omni_core::ErrorKind::UpstreamStatus(s) if (500..600).contains(&s) => {
            ServerError::Upstream(e.to_string())
        }
        omni_core::ErrorKind::UpstreamTimeout | omni_core::ErrorKind::UpstreamUnavailable => {
            ServerError::Upstream(e.to_string())
        }
        _ => ServerError::Upstream(e.to_string()),
    }
}

/// The dispatcher itself. Cheap to clone (`App` is already `Arc`-wrapped).
#[derive(Clone)]
pub struct Dispatcher {
    app: App,
}

impl Dispatcher {
    #[must_use]
    pub fn new(app: App) -> Self {
        Self { app }
    }

    /// OpenAI Chat Completions dispatcher. Returns a `DispatchOutcome`
    /// containing either the final JSON or the SSE stream.
    pub async fn dispatch_chat(
        &self,
        body: Value,
        stream: bool,
        request_id: Uuid,
        auth: Option<&AuthKey>,
    ) -> ServerResult<DispatchOutcome> {
        let client_wire = detect_wire(&body);
        let model = body
            .get("model")
            .and_then(|v| v.as_str())
            .unwrap_or("gpt-4o")
            .to_string();
        let (tenant_id, workspace_id, api_key_id) = tenant_workspace_for(auth);
        let mut ctx = CallContext {
            request_id,
            surface: Surface::OpenaiChat,
            model: model.clone(),
            tenant_id,
            workspace_id,
            api_key_id,
            started_at: Utc::now(),
            started_instant: Instant::now(),
        };

        let routing = routing_context(&model, stream);
        let decision = self
            .app
            .router
            .route(&routing)
            .map_err(|e| ServerError::BadRequest(e.to_string()))?;
        let provider_wire = provider_wire_format(&decision.chosen);
        let translated = translate_request(client_wire, provider_wire, body)
            .map_err(|e| ServerError::BadRequest(format!("translator: {e}")))?;

        let candidates = std::iter::once(decision.chosen.clone())
            .chain(decision.alternatives.iter().cloned())
            .take(MAX_FALLBACKS + 1)
            .collect::<Vec<_>>();

        if stream {
            // Streaming: pick the first candidate, return an SSE stream
            // that handles translate-on-the-fly + call_log on completion.
            self.stream_chat(ctx, candidates, provider_wire, client_wire)
                .await
        } else {
            self.complete_chat(ctx, candidates, provider_wire, client_wire, translated)
                .await
        }
    }

    async fn complete_chat(
        &self,
        ctx: CallContext,
        candidates: Vec<Arc<ProviderHandle>>,
        provider_wire: WireFormat,
        client_wire: WireFormat,
        body: Value,
    ) -> ServerResult<DispatchOutcome> {
        let mut last_err: Option<ServerError> = None;
        for handle in candidates {
            let model = ctx.model.clone();
            let exec_body = body.clone();
            let span = tracing::info_span!(
                "complete_chat",
                request_id = %ctx.request_id,
                provider = %handle.id.0,
                model = %model
            );
            let res = async {
                self.attempt_with_credential(&handle, &model, exec_body, false, ctx.request_id)
                    .await
            }
            .instrument(span)
            .await;

            match res {
                Ok(ExecutorResponse::Complete(complete)) => {
                    let status = complete.status;
                    let body_v = complete.body.clone();
                    let usage = complete.usage.clone();
                    let translated = translate_response(provider_wire, client_wire, body_v)
                        .unwrap_or_else(|_| json!({}));
                    let id = format!("chatcmpl-{}", Uuid::new_v4().simple());
                    let created = Utc::now().timestamp().max(0) as u64;
                    let out = build_openai_chat_response(
                        &id, &created, &ctx.model, translated, usage.as_ref(),
                    );
                    self.record_call_log(
                        &ctx,
                        &handle.id.0,
                        status,
                        usage.as_ref().map(|u| (u.prompt_tokens, u.completion_tokens, u.cost_usd)),
                        None,
                    );
                    return Ok(DispatchOutcome::Json(out));
                }
                Ok(ExecutorResponse::Streaming(_)) => {
                    let err = ServerError::Upstream("expected non-stream response".into());
                    last_err = Some(err);
                }
                Err(e) => {
                    warn!(provider = %handle.id.0, error = %e, "complete_chat attempt failed");
                    last_err = Some(e);
                }
            }
        }
        Err(last_err.unwrap_or_else(|| ServerError::Upstream("no provider succeeded".into())))
    }

    async fn stream_chat(
        &self,
        ctx: CallContext,
        candidates: Vec<Arc<ProviderHandle>>,
        provider_wire: WireFormat,
        client_wire: WireFormat,
    ) -> ServerResult<DispatchOutcome> {
        // Pick the first non-open-breaker candidate. If the first call
        // errors mid-stream, we close the stream with a final error event;
        // cross-provider stream failover is not implemented in v1.
        let handle = candidates
            .into_iter()
            .find(|h| h.circuit_breaker.allow())
            .ok_or_else(|| ServerError::Upstream("no available provider (breaker open)".into()))?;
        let span = tracing::info_span!(
            "stream_chat",
            request_id = %ctx.request_id,
            provider = %handle.id.0,
            model = %ctx.model
        );
        let app = self.app.clone();
        let handle_for_log = handle.clone();
        let model_for_log = ctx.model.clone();
        let request_id = ctx.request_id;
        let started = ctx.started_instant;

        let stream = async_stream::stream! {
            let _enter = span.enter();
            let exec_res = app
                .dispatcher_executor()
                .execute_streaming(
                    &handle,
                    &model_for_log,
                    request_id,
                )
                .await;
            let mut upstream = match exec_res {
                Ok(s) => s,
                Err(e) => {
                    error!(error = %e, "stream_chat executor init failed");
                    let chunk = json!({
                        "error": {"code": "upstream_error", "message": e.to_string()}
                    });
                    yield Ok(Event::default()
                        .event("error")
                        .data(serde_json::to_string(&chunk).unwrap_or_default()));
                    return;
                }
            };

            // Emit the leading "[DONE]" or first chunk; OpenAI expects the
            // first chunk to carry the role.
            let first_role = json!({
                "id": format!("chatcmpl-{}", Uuid::new_v4().simple()),
                "object": "chat.completion.chunk",
                "created": Utc::now().timestamp().max(0) as u64,
                "model": model_for_log,
                "choices": [{
                    "index": 0,
                    "delta": {"role": "assistant", "content": ""},
                    "finish_reason": null
                }]
            });
            yield Ok(Event::default()
                .data(serde_json::to_string(&first_role).unwrap_or_default()));

            let mut last_event: Option<StreamEvent> = None;
            let mut total_prompt: u32 = 0;
            let mut total_completion: u32 = 0;
            let mut http_status: u16 = 200;
            while let Some(item) = upstream.next().await {
                match item {
                    Ok(ev) => {
                        let is_terminal = ev.terminal;
                        last_event = Some(ev.clone());
                        // Translate chunk if needed
                        let v: Value = serde_json::from_str(&ev.data).unwrap_or(Value::Null);
                        let translated = stream_translate::translate_chunk(
                            provider_wire,
                            client_wire,
                            v,
                        ).unwrap_or(Value::Null);
                        let data = serde_json::to_string(&translated).unwrap_or_default();
                        if !data.is_empty() && data != "null" {
                            yield Ok(Event::default().data(data));
                        }
                        if is_terminal {
                            // Token usage often arrives in the last chunk.
                            if let Some(ref e) = last_event {
                                if let Ok(v) = serde_json::from_str::<Value>(&e.data) {
                                    if let Some(u) = v.get("usage") {
                                        total_prompt = u.get("prompt_tokens")
                                            .and_then(|x| x.as_u64()).unwrap_or(0) as u32;
                                        total_completion = u.get("completion_tokens")
                                            .and_then(|x| x.as_u64()).unwrap_or(0) as u32;
                                    }
                                }
                            }
                            yield Ok(Event::default().data("[DONE]"));
                            break;
                        }
                    }
                    Err(e) => {
                        error!(error = %e, "stream_chat upstream error");
                        let chunk = json!({
                            "error": {"code": "upstream_error", "message": e.to_string()}
                        });
                        yield Ok(Event::default()
                            .event("error")
                            .data(serde_json::to_string(&chunk).unwrap_or_default()));
                        http_status = 502;
                        break;
                    }
                }
            }

            // Record call_log on stream end (best-effort).
            let usage = if total_prompt + total_completion > 0 {
                Some((total_prompt, total_completion, None))
            } else {
                None
            };
            let _ = app.dispatcher_record_call_log(
                request_id,
                &handle_for_log.id.0,
                &model_for_log,
                http_status,
                usage,
                started,
            ).await;
        };

        Ok(DispatchOutcome::Sse(Box::pin(stream)))
    }

    /// Embeddings dispatcher. v1 only supports OpenAI-compat providers that
    /// expose a `/v1/embeddings` endpoint. We do the POST inline rather than
    /// adding a new Executor variant, because embeddings use a different
    /// body shape than chat.
    pub async fn dispatch_embeddings(
        &self,
        body: Value,
        request_id: Uuid,
        auth: Option<&AuthKey>,
    ) -> ServerResult<DispatchOutcome> {
        let model = body
            .get("model")
            .and_then(|v| v.as_str())
            .unwrap_or("text-embedding-3-small")
            .to_string();
        let (tenant_id, workspace_id, api_key_id) = tenant_workspace_for(auth);
        let ctx = CallContext {
            request_id,
            surface: Surface::OpenaiEmbeddings,
            model: model.clone(),
            tenant_id,
            workspace_id,
            api_key_id,
            started_at: Utc::now(),
            started_instant: Instant::now(),
        };
        let routing = routing_context(&model, false);
        let decision = self
            .app
            .router
            .route(&routing)
            .map_err(|e| ServerError::BadRequest(e.to_string()))?;
        let handle = decision.chosen;
        let credential = self
            .app
            .credential_for(&handle.id.0)
            .ok_or_else(|| ServerError::BadRequest(format!("no credential for provider {}", handle.id.0)))?;
        let url = format!(
            "{}/v1/embeddings",
            handle.base_url.trim_end_matches('/').trim_end_matches("/v1")
        );
        debug!(%url, model = %model, provider = %handle.id.0, "embeddings dispatch");

        let client = reqwest::Client::builder()
            .timeout(DEFAULT_TIMEOUT)
            .build()
            .map_err(|e| ServerError::Upstream(e.to_string()))?;
        let resp = client
            .post(&url)
            .bearer_auth(&credential)
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                warn!(error = %e, "embeddings request failed");
                ServerError::Upstream(e.to_string())
            })?;
        let status = resp.status();
        let body_v: Value = resp.json().await.map_err(|e| ServerError::Upstream(e.to_string()))?;
        if !status.is_success() {
            self.record_call_log(
                &ctx,
                &handle.id.0,
                status.as_u16(),
                None,
                Some(("upstream_error", body_v.to_string())),
            );
            return Err(ServerError::Upstream(format!(
                "upstream {}: {}",
                status,
                body_v
            )));
        }
        let usage = body_v
            .get("usage")
            .map(|u| omni_core::executor::UsageMetrics {
                prompt_tokens: u.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                completion_tokens: 0,
                total_tokens: u.get("total_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                cost_usd: None,
            });
        self.record_call_log(
            &ctx,
            &handle.id.0,
            status.as_u16(),
            usage
                .as_ref()
                .map(|u| (u.prompt_tokens, u.total_tokens, u.cost_usd)),
            None,
        );
        Ok(DispatchOutcome::Json(body_v))
    }

    /// Anthropic Messages dispatcher. Mirrors dispatch_chat.
    pub async fn dispatch_anthropic_messages(
        &self,
        body: Value,
        stream: bool,
        request_id: Uuid,
        auth: Option<&AuthKey>,
    ) -> ServerResult<DispatchOutcome> {
        let model = body
            .get("model")
            .and_then(|v| v.as_str())
            .unwrap_or("claude-sonnet-4-5")
            .to_string();
        let (tenant_id, workspace_id, api_key_id) = tenant_workspace_for(auth);
        let mut ctx = CallContext {
            request_id,
            surface: Surface::AnthropicMessages,
            model: model.clone(),
            tenant_id,
            workspace_id,
            api_key_id,
            started_at: Utc::now(),
            started_instant: Instant::now(),
        };

        let routing = routing_context(&model, stream);
        let decision = self
            .app
            .router
            .route(&routing)
            .map_err(|e| ServerError::BadRequest(e.to_string()))?;
        let provider_wire = provider_wire_format(&decision.chosen);
        // body is already in Anthropic shape on this path; for OpenAI clients
        // we'd need translate_request(Openai, Claude, ...). The handler
        // chooses which to call. We just execute and return.

        let candidates = std::iter::once(decision.chosen.clone())
            .chain(decision.alternatives.iter().cloned())
            .take(MAX_FALLBACKS + 1)
            .collect::<Vec<_>>();

        if stream {
            // For v1 we non-stream the Anthropic response; streaming the
            // Anthropic shape into the OpenAI client is a v1.1 follow-up.
            return Err(ServerError::BadRequest(
                "anthropic streaming not yet implemented in v0.1".into(),
            ));
        }
        let mut last_err: Option<ServerError> = None;
        for handle in candidates {
            let res = self
                .attempt_with_credential(&handle, &model, body.clone(), false, ctx.request_id)
                .await;
            match res {
                Ok(ExecutorResponse::Complete(complete)) => {
                    self.record_call_log(
                        &ctx,
                        &handle.id.0,
                        complete.status,
                        complete.usage.as_ref().map(|u| (u.prompt_tokens, u.completion_tokens, u.cost_usd)),
                        None,
                    );
                    let out = build_anthropic_message_response(&ctx.model, &complete);
                    return Ok(DispatchOutcome::Json(out));
                }
                Ok(ExecutorResponse::Streaming(_)) => {
                    last_err = Some(ServerError::Upstream("expected non-stream response".into()));
                }
                Err(e) => {
                    warn!(provider = %handle.id.0, error = %e, "anthropic attempt failed");
                    last_err = Some(e);
                }
            }
        }
        Err(last_err.unwrap_or_else(|| ServerError::Upstream("no provider succeeded".into())))
    }

    /// Count tokens using `tiktoken-rs` for OpenAI-style messages. Falls
    /// back to a whitespace-based approximation if the model is unknown.
    pub async fn dispatch_anthropic_count_tokens(&self, body: Value) -> ServerResult<DispatchOutcome> {
        count_tokens_for_messages(&body).await
    }



    /// Run one attempt against a chosen provider, injecting the credential
    /// from the App's cache.
    async fn attempt_with_credential(
        &self,
        handle: &ProviderHandle,
        model: &str,
        body: Value,
        stream: bool,
        request_id: Uuid,
    ) -> ServerResult<ExecutorResponse> {
        let credential = self.app.credential_for(&handle.id.0).unwrap_or_default();
        let mut headers = BTreeMap::new();
        headers.insert("x-omni-credential".to_string(), credential);
        headers.insert("x-omni-base-url".to_string(), handle.base_url.clone());
        let req = ExecutorRequest {
            request_id,
            provider: omni_core::provider::ProviderId(handle.id.0.clone()),
            model: model.to_string(),
            body,
            headers,
            stream,
            timeout: Some(DEFAULT_TIMEOUT),
        };
        let executor = executor_for_kind_by_id(handle);
        executor.execute(req).await.map_err(map_exec_err)
    }

    /// Persist a single call_log row. Best-effort: a DB error is logged and
    /// swallowed so it never breaks the response.
    async fn record_call_log(
        &self,
        ctx: &CallContext,
        provider_id: &str,
        http_status: u16,
        usage: Option<(u32, u32, Option<f64>)>,
        error: Option<(&str, String)>,
    ) {
        let (prompt, completion, cost) = usage.unwrap_or((0, 0, None));
        let total = prompt.saturating_add(completion);
        let (status, err_kind, err_msg) = match error {
            Some((k, m)) => (CallLogStatus::Error, Some(k.to_string()), Some(m)),
            None if (200..300).contains(&http_status) => (CallLogStatus::Success, None, None),
            None => (CallLogStatus::Error, Some("upstream_error".into()), Some(format!("http {http_status}"))),
        };
        let prid = uuid::Uuid::parse_str(provider_id)
            .ok()
            .map(ProviderRecordId)
            .or_else(|| {
                // Provider ids in the App registry are free-form strings
                // (e.g. "openai"); they don't necessarily parse as UUID.
                // Synthesize a stable UUID from the bytes so the FK to
                // provider_records still works for known seed entries.
                use uuid::Uuid;
                let bytes = md5_like(provider_id.as_bytes());
                Some(ProviderRecordId(Uuid::from_bytes(bytes)))
            });
        let log = CallLog {
            id: CallLogId::new(),
            tenant_id: ctx.tenant_id,
            workspace_id: ctx.workspace_id,
            api_key_id: ctx.api_key_id,
            provider_id: prid,
            model_id: None,
            model_name: ctx.model.clone(),
            status,
            http_status: Some(http_status),
            prompt_tokens: prompt,
            completion_tokens: completion,
            total_tokens: total,
            cost_usd: cost,
            duration_ms: ctx.started_instant.elapsed().as_millis().min(u32::MAX as u128) as u32,
            started_at: ctx.started_at,
            finished_at: Some(Utc::now()),
            error_kind: err_kind,
            error_message: err_msg,
            request_id: ctx.request_id.simple().to_string(),
            session_id: None,
            metadata: Default::default(),
        };
        if let Some(pool) = &self.app.pool {
            let repo = call_log_repo(pool.pool());
            if let Err(e) = repo.insert(&log).await {
                warn!(error = %e, "call_log insert failed");
            }
        }
    }
}

impl App {
    /// Build a dispatcher bound to this app.
    #[must_use]
    pub fn dispatcher(&self) -> Dispatcher {
        Dispatcher::new(self.clone())
    }

    /// Helper used by the streaming path. The executor trait already
    /// exposes `execute`; this wraps it with the credential lookup.
    pub(crate) fn dispatcher_executor(&self) -> AppDispatcherHandle<'_> {
        AppDispatcherHandle { app: self }
    }

    /// Best-effort call_log write. Used by the streaming path after the
    /// stream ends.
    pub(crate) async fn dispatcher_record_call_log(
        &self,
        request_id: Uuid,
        provider_id: &str,
        model: &str,
        http_status: u16,
        usage: Option<(u32, u32, Option<f64>)>,
        started: Instant,
    ) -> ServerResult<()> {
        let (tenant_id, workspace_id, api_key_id) = tenant_workspace_for(None);
        let (prompt, completion, cost) = usage.unwrap_or((0, 0, None));
        let total = prompt.saturating_add(completion);
        let status = if (200..300).contains(&http_status) {
            CallLogStatus::Success
        } else {
            CallLogStatus::Error
        };
        let prid = uuid::Uuid::parse_str(provider_id)
            .ok()
            .map(ProviderRecordId)
            .or_else(|| {
                let bytes = md5_like(provider_id.as_bytes());
                Some(ProviderRecordId(uuid::Uuid::from_bytes(bytes)))
            });
        let log = CallLog {
            id: CallLogId::new(),
            tenant_id,
            workspace_id,
            api_key_id,
            provider_id: prid,
            model_id: None,
            model_name: model.to_string(),
            status,
            http_status: Some(http_status),
            prompt_tokens: prompt,
            completion_tokens: completion,
            total_tokens: total,
            cost_usd: cost,
            duration_ms: started.elapsed().as_millis().min(u32::MAX as u128) as u32,
            started_at: Utc::now(),
            finished_at: Some(Utc::now()),
            error_kind: None,
            error_message: None,
            request_id: request_id.simple().to_string(),
            session_id: None,
            metadata: Default::default(),
        };
        if let Some(pool) = &self.pool {
            let repo = call_log_repo(pool.pool());
            if let Err(e) = repo.insert(&log).await {
                warn!(error = %e, "call_log insert failed");
            }
        }
        Ok(())
    }
}

/// Tiny handle the streaming path uses to call into the executor pool.
pub(crate) struct AppDispatcherHandle<'a> {
    app: &'a App,
}

impl<'a> AppDispatcherHandle<'a> {
    /// Start a streaming call against the given provider. Returns the
    /// inner `Stream` of `StreamEvent` results.
    pub(crate) async fn execute_streaming(
        self,
        handle: &Arc<ProviderHandle>,
        model: &str,
        request_id: Uuid,
    ) -> ServerResult<Pin<Box<dyn Stream<Item = Result<StreamEvent, omni_core::Error>> + Send>>> {
        let credential = self.app.credential_for(&handle.id.0).unwrap_or_default();
        let mut headers = BTreeMap::new();
        headers.insert("x-omni-credential".to_string(), credential);
        headers.insert("x-omni-base-url".to_string(), handle.base_url.clone());
        let req = ExecutorRequest {
            request_id,
            provider: omni_core::provider::ProviderId(handle.id.0.clone()),
            model: model.to_string(),
            body: json!({"stream": true}),
            headers,
            stream: true,
            timeout: Some(DEFAULT_TIMEOUT),
        };
        let executor = executor_for_kind_by_id(handle);
        let resp = executor.execute(req).await.map_err(map_exec_err)?;
        match resp {
            ExecutorResponse::Streaming(s) => Ok(s),
            ExecutorResponse::Complete(_) => Err(ServerError::Upstream(
                "executor returned non-stream response for stream request".into(),
            )),
        }
    }
}

/// Free function: count tokens for an Anthropic Messages request body.
/// No `App` or `Dispatcher` required; safe for handlers that don't
/// have storage state.
pub async fn count_tokens_for_messages(body: &Value) -> ServerResult<DispatchOutcome> {
    let messages = body
        .get("messages")
        .and_then(|v| v.as_array())
        .ok_or_else(|| ServerError::BadRequest("messages[] is required".into()))?;
    let mut total: u32 = 0;
    for m in messages {
        if let Some(s) = m.get("content").and_then(|c| c.as_str()) {
            total += tiktoken_count(s);
        } else if let Some(arr) = m.get("content").and_then(|c| c.as_array()) {
            for block in arr {
                if let Some(s) = block.get("text").and_then(|t| t.as_str()) {
                    total += tiktoken_count(s);
                }
            }
        }
    }
    if let Some(s) = body.get("system").and_then(|v| v.as_str()) {
        total += tiktoken_count(s);
    } else if let Some(arr) = body.get("system").and_then(|v| v.as_array()) {
        for block in arr {
            if let Some(s) = block.get("text").and_then(|t| t.as_str()) {
                total += tiktoken_count(s);
            }
        }
    }
    Ok(DispatchOutcome::Json(json!({ "input_tokens": total })))
}

// ─── Helpers ───────────────────────────────────────────────────────────

/// Build the OpenAI Chat Completions response shape from a translated body.
fn build_openai_chat_response(
    id: &str,
    created: &u64,
    model: &str,
    translated: Value,
    usage: Option<&omni_core::executor::UsageMetrics>,
) -> Value {
    // `translated` is already in OpenAI shape when client_wire == Openai,
    // but the translator may have produced a partial shape. We ensure the
    // top-level fields are present.
    let mut out = translated;
    if out.get("id").is_none() {
        out["id"] = json!(id);
    }
    if out.get("object").is_none() {
        out["object"] = json!("chat.completion");
    }
    if out.get("created").is_none() {
        out["created"] = json!(created);
    }
    if out.get("model").is_none() {
        out["model"] = json!(model);
    }
    if let Some(u) = usage {
        out["usage"] = json!({
            "prompt_tokens": u.prompt_tokens,
            "completion_tokens": u.completion_tokens,
            "total_tokens": u.total_tokens,
        });
    } else if out.get("usage").is_none() {
        out["usage"] = json!({
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        });
    }
    out
}

/// Build an Anthropic Messages response from a complete upstream response.
fn build_anthropic_message_response(model: &str, complete: &CompleteResponse) -> Value {
    let body = &complete.body;
    let text = body
        .get("content")
        .and_then(|c| c.as_array())
        .and_then(|arr| arr.first())
        .and_then(|b| b.get("text"))
        .and_then(|t| t.as_str())
        .unwrap_or_default();
    let id = body
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("msg_unkn")
        .to_string();
    let stop_reason = body
        .get("stop_reason")
        .and_then(|v| v.as_str())
        .unwrap_or("end_turn")
        .to_string();
    let usage = complete.usage.as_ref();
    let mut out = json!({
        "id": id,
        "type": "message",
        "role": "assistant",
        "model": body.get("model").and_then(|v| v.as_str()).unwrap_or(model),
        "content": [{"type": "text", "text": text}],
        "stop_reason": stop_reason,
        "stop_sequence": null,
        "usage": {
            "input_tokens": usage.map(|u| u.prompt_tokens).unwrap_or(0),
            "output_tokens": usage.map(|u| u.completion_tokens).unwrap_or(0),
        }
    });
    if let Some(u) = usage {
        out["usage"]["cache_read_input_tokens"] = json!(0);
        out["usage"]["cache_creation_input_tokens"] = json!(0);
    }
    out
}

/// Best-effort token count. Uses tiktoken-rs when the model encodes are
/// available; otherwise falls back to a whitespace heuristic.
fn tiktoken_count(s: &str) -> u32 {
    // We don't pin a specific encoding per model here — the cl100k_base
    // encoding is the conservative default for unknown models and is
    // accurate to within ~5% for non-embedding estimation workloads.
    match tiktoken_rs::cl100k_base() {
        Ok(enc) => enc.encode_with_special_tokens(s).len() as u32,
        Err(_) => {
            // Heuristic: ~0.75 tokens per whitespace-delimited word.
            (s.split_whitespace().count() as f32 / 0.75).ceil() as u32
        }
    }
}

/// Synthesize a stable UUID from a free-form provider id so the call_log
/// FK to `provider_records` resolves for seed providers whose ids are
/// short strings ("openai", "anthropic", ...) rather than real UUIDs.
fn md5_like(bytes: &[u8]) -> [u8; 16] {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(bytes);
    let out = h.finalize();
    let mut id = [0u8; 16];
    id.copy_from_slice(&out[..16]);
    id
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_openai_body() {
        let v = json!({"model": "gpt-4o", "messages": [{"role": "user", "content": "hi"}]});
        assert_eq!(detect_wire(&v), WireFormat::Openai);
    }

    #[test]
    fn detect_anthropic_body() {
        let v = json!({"model": "claude", "messages": [], "system": "x", "max_tokens": 1024});
        assert_eq!(detect_wire(&v), WireFormat::Claude);
    }

    #[test]
    fn detect_gemini_body() {
        let v = json!({"contents": [{"parts": [{"text": "hi"}]}]});
        assert_eq!(detect_wire(&v), WireFormat::Gemini);
    }

    #[test]
    fn detect_codex_body() {
        let v = json!({"input": "x", "instructions": "y"});
        assert_eq!(detect_wire(&v), WireFormat::Codex);
    }

    #[test]
    fn provider_wire_anthropic() {
        let h = ProviderHandle::new(
            omni_router::ProviderId::new("anthropic"),
            "Anthropic".into(),
            "https://api.anthropic.com".into(),
        );
        assert_eq!(provider_wire_format(&h), WireFormat::Claude);
    }

    #[test]
    fn provider_wire_openai_default() {
        let h = ProviderHandle::new(
            omni_router::ProviderId::new("openai"),
            "OpenAI".into(),
            "https://api.openai.com".into(),
        );
        assert_eq!(provider_wire_format(&h), WireFormat::Openai);
    }

    #[test]
    fn md5_like_is_stable() {
        let a = md5_like(b"openai");
        let b = md5_like(b"openai");
        let c = md5_like(b"anthropic");
        assert_eq!(a, b);
        assert_ne!(a, c);
    }

    #[test]
    fn tiktoken_count_handles_empty() {
        assert_eq!(tiktoken_count(""), 0);
        assert!(tiktoken_count("hello world") > 0);
    }

    #[test]
    fn build_openai_response_fills_defaults() {
        let out = build_openai_chat_response(
            "chatcmpl-x",
            &1_700_000_000,
            "gpt-4o",
            json!({"choices": [{"message": {"role": "assistant", "content": "hi"}}]}),
            None,
        );
        assert_eq!(out["id"], "chatcmpl-x");
        assert_eq!(out["model"], "gpt-4o");
        assert_eq!(out["object"], "chat.completion");
        assert!(out["usage"].is_object());
    }

    #[test]
    fn build_anthropic_response_from_complete() {
        let complete = CompleteResponse {
            status: 200,
            headers: Default::default(),
            body: json!({
                "id": "msg_01",
                "model": "claude-sonnet-4-5",
                "content": [{"type": "text", "text": "hello"}],
                "stop_reason": "end_turn",
                "usage": {"input_tokens": 5, "output_tokens": 1},
            }),
            usage: Some(omni_core::executor::UsageMetrics {
                prompt_tokens: 5,
                completion_tokens: 1,
                total_tokens: 6,
                cost_usd: None,
            }),
        };
        let out = build_anthropic_message_response("claude-sonnet-4-5", &complete);
        assert_eq!(out["type"], "message");
        assert_eq!(out["role"], "assistant");
        assert_eq!(out["content"][0]["text"], "hello");
        assert_eq!(out["stop_reason"], "end_turn");
        assert_eq!(out["usage"]["input_tokens"], 5);
    }
}
