//! Anthropic provider adapter.
//!
//! Speaks the Anthropic Messages API wire format: `x-api-key` header,
//! `anthropic-version: 2023-06-01`, and the `/v1/messages` endpoint.
//!
//! Stream 4 (Phase 6) adds:
//! - non-streaming message completion
//! - streaming SSE with `content_block_delta` parsing
//! - ping via `/v1/messages` with a minimal token estimate

use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use futures_util::StreamExt;
use reqwest::Client;
use serde_json::json;
use tokio::sync::mpsc;

use omniroute_core::{
    ChatMessage, ChatRequest, ChatResponse, Choice, Context, Model, Provider,
    ProviderError, StreamChunk, Usage,
};

const DEFAULT_BASE_URL: &str = "https://api.anthropic.com";
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(120);
const ANTHROPIC_VERSION: &str = "2023-06-01";

/// Initialisation context for [`AnthropicProvider`].
#[derive(Debug, Clone)]
pub struct ProviderInit {
    /// Provider ID (e.g. `"anthropic"`).
    pub id: String,
    /// API key (sent via `x-api-key` header, not Bearer).
    pub api_key: String,
    /// Base URL (no trailing slash). Defaults to `https://api.anthropic.com`.
    pub base_url: String,
    /// Per-request timeout. Defaults to 120s.
    pub timeout: Duration,
}

impl ProviderInit {
    /// Minimal init: id + api key, defaults elsewhere.
    pub fn new(id: impl Into<String>, api_key: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            api_key: api_key.into(),
            base_url: DEFAULT_BASE_URL.into(),
            timeout: DEFAULT_TIMEOUT,
        }
    }

    /// Builder: override the base URL (no trailing slash).
    pub fn with_base_url(mut self, url: impl Into<String>) -> Self {
        let raw = url.into();
        self.base_url = raw.trim_end_matches('/').to_string();
        self
    }

    /// Builder: override the per-request timeout.
    pub fn with_timeout(mut self, t: Duration) -> Self {
        self.timeout = t;
        self
    }

    fn validate(&self) -> Result<(), ProviderError> {
        if self.id.is_empty() {
            return Err(ProviderError::AuthFailed {
                provider: "anthropic".into(),
                message: "id is required".into(),
            });
        }
        if self.api_key.is_empty() {
            return Err(ProviderError::AuthFailed {
                provider: self.id.clone(),
                message: "api_key is required".into(),
            });
        }
        Ok(())
    }
}

/// Anthropic provider implementing the Messages API.
#[derive(Debug)]
pub struct AnthropicProvider {
    id: String,
    base_url: String,
    api_key: Arc<String>,
    http: Arc<Client>,
}

impl AnthropicProvider {
    /// Construct an [`AnthropicProvider`] from a [`ProviderInit`].
    ///
    /// # Errors
    ///
    /// Returns [`ProviderError::AuthFailed`] if `id` or `api_key` is empty.
    pub fn new(init: ProviderInit) -> Result<Arc<Self>, ProviderError> {
        init.validate()?;
        let http = Client::builder()
            .timeout(init.timeout)
            .build()
            .map_err(|e| ProviderError::Unavailable {
                provider: init.id.clone(),
                reason: e.to_string(),
            })?;
        Ok(Arc::new(Self {
            id: init.id,
            base_url: init.base_url,
            api_key: Arc::new(init.api_key),
            http: Arc::new(http),
        }))
    }

    /// Returns the configured base URL.
    pub fn base_url(&self) -> &str {
        &self.base_url
    }
}

/// Translate a [`ChatRequest`] into the Anthropic Messages API JSON body.
fn build_anthropic_body(req: &ChatRequest) -> serde_json::Value {
    let mut messages: Vec<serde_json::Value> = Vec::new();
    let mut system: Option<String> = None;

    for msg in &req.messages {
        match msg.role.as_str() {
            "system" => {
                // Anthropic puts the system prompt at the top level.
                if let Some(text) = msg.content.as_str() {
                    system = Some(text.to_string());
                }
            }
            _ => {
                let content = msg.content.as_str().map(|s| s.to_string()).unwrap_or_default();
                messages.push(json!({
                    "role": msg.role,
                    "content": content,
                }));
            }
        }
    }

    let mut body = json!({
        "model": req.model,
        "max_tokens": req.max_tokens.unwrap_or(1024),
        "messages": messages,
    });

    if let Some(sys) = system {
        body["system"] = json!(sys);
    }
    if let Some(temp) = req.temperature {
        body["temperature"] = json!(temp);
    }

    body
}

/// Translate the Anthropic Messages API response into a [`ChatResponse`].
fn translate_anthropic_response(
    id: &str,
    model: &str,
    raw: &serde_json::Value,
) -> Result<ChatResponse, ProviderError> {
    let content_blocks = raw
        .get("content")
        .and_then(|c| c.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|block| block.get("text").and_then(|t| t.as_str()))
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default();

    let stop_reason = raw
        .get("stop_reason")
        .and_then(|v| v.as_str())
        .unwrap_or("stop")
        .to_string();

    let usage_in = raw
        .get("usage")
        .and_then(|u| u.get("input_tokens"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    let usage_out = raw
        .get("usage")
        .and_then(|u| u.get("output_tokens"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;

    Ok(ChatResponse {
        id: id.to_string(),
        object: "chat.completion".into(),
        created: chrono::Utc::now().timestamp(),
        model: model.to_string(),
        choices: vec![Choice {
            index: 0,
            message: ChatMessage::assistant(content_blocks),
            finish_reason: stop_reason,
        }],
        usage: Usage {
            prompt_tokens: usage_in,
            completion_tokens: usage_out,
            total_tokens: usage_in + usage_out,
        },
        provider_id: None,
    })
}

#[async_trait]
impl Provider for AnthropicProvider {
    fn id(&self) -> &str {
        &self.id
    }

    async fn models(&self, _ctx: &Context) -> Result<Vec<Model>, ProviderError> {
        // Phase 4: wire GET /v1/models once Anthropic exposes a models endpoint.
        Err(ProviderError::Internal {
            provider: self.id.clone(),
            message: "models() not yet wired".into(),
        })
    }

    async fn chat_completion(
        &self,
        ctx: &Context,
        req: ChatRequest,
    ) -> Result<ChatResponse, ProviderError> {
        let url = format!("{}/v1/messages", self.base_url);
        let token = ctx.credentials.as_bearer_token().unwrap_or(&self.api_key);
        let body = build_anthropic_body(&req);

        let resp = self
            .http
            .post(&url)
            .header("x-api-key", token)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError::Unavailable {
                provider: self.id.clone(),
                reason: e.to_string(),
            })?;

        let status = resp.status();
        if !status.is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            return Err(classify_anthropic_error(
                &self.id,
                status.as_u16(),
                body_text,
            ));
        }

        let raw: serde_json::Value = resp.json().await.map_err(|e| {
            ProviderError::UpstreamError {
                provider: self.id.clone(),
                status: status.as_u16(),
                body: e.to_string(),
            }
        })?;

        let msg_id = raw
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("msg_unknown");
        let model = raw
            .get("model")
            .and_then(|v| v.as_str())
            .unwrap_or(&req.model);

        translate_anthropic_response(msg_id, model, &raw)
    }

    async fn chat_completion_stream(
        &self,
        ctx: &Context,
        req: ChatRequest,
        tx: mpsc::Sender<Result<StreamChunk, ProviderError>>,
    ) -> Result<(), ProviderError> {
        let url = format!("{}/v1/messages", self.base_url);
        let token = ctx.credentials.as_bearer_token().unwrap_or(&self.api_key);
        let mut body = build_anthropic_body(&req);
        body["stream"] = json!(true);

        let resp = self
            .http
            .post(&url)
            .header("x-api-key", token)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .json(&body)
            .send()
            .await
            .map_err(|e| ProviderError::Unavailable {
                provider: self.id.clone(),
                reason: e.to_string(),
            })?;

        let status = resp.status();
        if !status.is_success() {
            let body_text = resp.text().await.unwrap_or_default();
            return Err(classify_anthropic_error(
                &self.id,
                status.as_u16(),
                body_text,
            ));
        }

        let mut stream = resp.bytes_stream();
        let mut buffer: Vec<u8> = Vec::new();

        // Stateful tracking for building stream chunks.
        let mut msg_id: String = String::new();
        let mut msg_model: String = req.model.clone();
        let msg_created: i64 = chrono::Utc::now().timestamp();
        let mut accumulated_text = String::new();

        while let Some(chunk_result) = stream.next().await {
            let bytes = chunk_result.map_err(|e| ProviderError::StreamError {
                provider: self.id.clone(),
                message: e.to_string(),
            })?;
            buffer.extend_from_slice(&bytes);

            loop {
                let newline_pos = match buffer.iter().position(|&b| b == b'\n') {
                    Some(pos) => pos,
                    None => break,
                };
                let line = String::from_utf8_lossy(&buffer[..newline_pos])
                    .trim()
                    .to_string();
                buffer.drain(..=newline_pos);

                if line.is_empty() {
                    continue;
                }

                // Anthropic SSE uses `event:` and `data:` lines.
                // We care about `data:` payloads.
                let payload = if let Some(s) = line.strip_prefix("data: ") {
                    s.trim()
                } else if let Some(s) = line.strip_prefix("data:") {
                    s.trim()
                } else {
                    continue;
                };

                // Parse the JSON event to determine the type.
                let parsed: serde_json::Value = match serde_json::from_str(payload) {
                    Ok(v) => v,
                    Err(e) => {
                        let _ = tx
                            .send(Err(ProviderError::StreamError {
                                provider: self.id.clone(),
                                message: format!("anthropic sse parse: {e}"),
                            }))
                            .await;
                        continue;
                    }
                };

                let event_type = parsed
                    .get("type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                match event_type {
                    "message_start" => {
                        if let Some(msg) = parsed.get("message") {
                            msg_id = msg
                                .get("id")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            msg_model = msg
                                .get("model")
                                .and_then(|v| v.as_str())
                                .unwrap_or(&msg_model)
                                .to_string();
                        }
                    }
                    "content_block_delta" => {
                        if let Some(delta) = parsed.get("delta") {
                            if let Some(text) = delta.get("text").and_then(|v| v.as_str()) {
                                accumulated_text.push_str(text);
                                let chunk = StreamChunk::new(
                                    &msg_id,
                                    &msg_model,
                                    msg_created,
                                )
                                .push_choice(
                                    0,
                                    ChatMessage::assistant(text),
                                );
                                if tx.send(Ok(chunk)).await.is_err() {
                                    return Ok(());
                                }
                            }
                        }
                    }
                    "message_delta" => {
                        // Final usage info; we may get finish_reason here.
                    }
                    "message_stop" => {
                        let _ = tx
                            .send(Ok(StreamChunk::new("", "", 0).with_done()))
                            .await;
                        return Ok(());
                    }
                    "content_block_stop" | "ping" => {
                        // No-op; content_block_stop ends a block, pings are keepalives.
                    }
                    _ => {
                        // Unknown event type; skip.
                    }
                }
            }
        }

        // Stream ended without message_stop; send done.
        let _ = tx
            .send(Ok(StreamChunk::new("", "", 0).with_done()))
            .await;
        Ok(())
    }

    async fn ping(&self, ctx: &Context) -> Result<(), ProviderError> {
        // Send a minimal messages request with max_tokens: 1 to validate auth.
        let url = format!("{}/v1/messages", self.base_url);
        let token = ctx.credentials.as_bearer_token().unwrap_or(&self.api_key);
        let minimal = json!({
            "model": "claude-3-haiku-20240307",
            "max_tokens": 1,
            "messages": [{"role": "user", "content": "ping"}],
        });

        let resp = self
            .http
            .post(&url)
            .header("x-api-key", token)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .json(&minimal)
            .send()
            .await
            .map_err(|e| ProviderError::Unavailable {
                provider: self.id.clone(),
                reason: e.to_string(),
            })?;

        let status = resp.status();
        if status.is_success() || status == 400 {
            // 400 can mean "max_tokens too small" but confirms auth is valid.
            Ok(())
        } else {
            Err(ProviderError::AuthFailed {
                provider: self.id.clone(),
                message: format!("HTTP {status}"),
            })
        }
    }
}

fn classify_anthropic_error(
    provider: &str,
    status: u16,
    body: String,
) -> ProviderError {
    match status {
        401 | 403 => ProviderError::AuthFailed {
            provider: provider.into(),
            message: body,
        },
        429 => ProviderError::RateLimited {
            provider: provider.into(),
            retry_after: None,
        },
        s if s >= 500 => ProviderError::UpstreamError {
            provider: provider.into(),
            status: s,
            body,
        },
        _ => ProviderError::UpstreamError {
            provider: provider.into(),
            status,
            body,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_rejects_empty_id() {
        let init = ProviderInit::new("", "sk-ant-test");
        let err = AnthropicProvider::new(init).unwrap_err();
        assert!(matches!(err, ProviderError::AuthFailed { .. }));
    }

    #[test]
    fn new_rejects_empty_api_key() {
        let init = ProviderInit::new("anthropic", "");
        let err = AnthropicProvider::new(init).unwrap_err();
        assert!(matches!(err, ProviderError::AuthFailed { .. }));
    }

    #[test]
    fn new_strips_trailing_slash() {
        let init =
            ProviderInit::new("anthropic", "sk-ant-test").with_base_url("https://api.anthropic.com/");
        let p = AnthropicProvider::new(init).unwrap();
        assert_eq!(p.base_url(), "https://api.anthropic.com");
    }

    #[test]
    fn provider_id_round_trip() {
        let p = AnthropicProvider::new(ProviderInit::new("anthropic", "sk-ant-test")).unwrap();
        assert_eq!(p.id(), "anthropic");
    }

    #[test]
    fn build_body_includes_system_and_messages() {
        let req = ChatRequest::new("claude-3-haiku", "Hello")
            .with_system("Be helpful.")
            .with_max_tokens(500);
        let body = build_anthropic_body(&req);
        assert_eq!(body["model"], "claude-3-haiku");
        assert_eq!(body["max_tokens"], 500);
        assert_eq!(body["system"], "Be helpful.");
        assert_eq!(body["messages"][0]["role"], "user");
        assert_eq!(body["messages"][0]["content"], "Hello");
    }

    #[test]
    fn classify_401_is_auth_failed() {
        let err = classify_anthropic_error("anthropic", 401, "bad".into());
        assert!(matches!(err, ProviderError::AuthFailed { .. }));
        assert!(!err.is_retryable());
    }

    #[test]
    fn classify_429_is_rate_limited() {
        let err = classify_anthropic_error("anthropic", 429, "rate".into());
        assert!(matches!(err, ProviderError::RateLimited { .. }));
        assert!(err.is_retryable());
    }

    #[test]
    fn build_body_includes_temperature() {
        let mut req = ChatRequest::new("claude-3-haiku", "hi");
        req.temperature = Some(0.7);
        let body = build_anthropic_body(&req);
        assert!((body["temperature"].as_f64().unwrap() - 0.7).abs() < 1e-6);
    }
}
