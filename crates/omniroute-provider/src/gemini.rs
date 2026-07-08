//! Gemini provider adapter.
//!
//! Speaks the Google Gemini (Generative Language API) wire format:
//! API key via `?key=` query parameter, `/v1beta` base path,
//! `models/{model}:generateContent` for non-streaming and
//! `models/{model}:streamGenerateContent` for streaming.
//!
//! Stream 4 (Phase 6) adds:
//! - non-streaming content generation
//! - streaming SSE with delta-based chunk emission
//! - ping via minimal generateContent

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

const DEFAULT_BASE_URL: &str = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(120);

/// Initialisation context for [`GeminiProvider`].
#[derive(Debug, Clone)]
pub struct ProviderInit {
    /// Provider ID (e.g. `"gemini"`).
    pub id: String,
    /// API key (sent via `?key=` query param).
    pub api_key: String,
    /// Base URL (no trailing slash). Defaults to `https://generativelanguage.googleapis.com/v1beta`.
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
                provider: "gemini".into(),
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

/// Gemini provider implementing the Generative Language API.
#[derive(Debug)]
pub struct GeminiProvider {
    id: String,
    base_url: String,
    api_key: Arc<String>,
    http: Arc<Client>,
}

impl GeminiProvider {
    /// Construct a [`GeminiProvider`] from a [`ProviderInit`].
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

/// Translate a [`ChatRequest`] into the Gemini `generateContent` JSON body.
fn build_gemini_body(req: &ChatRequest) -> serde_json::Value {
    let mut contents: Vec<serde_json::Value> = Vec::new();
    let mut system_instruction: Option<String> = None;

    for msg in &req.messages {
        match msg.role.as_str() {
            "system" => {
                if let Some(text) = msg.content.as_str() {
                    system_instruction = Some(text.to_string());
                }
            }
            "assistant" => {
                let text = msg.content.as_str().unwrap_or("");
                contents.push(json!({
                    "role": "model",
                    "parts": [{"text": text}],
                }));
            }
            _ => {
                let text = msg.content.as_str().unwrap_or("");
                contents.push(json!({
                    "role": "user",
                    "parts": [{"text": text}],
                }));
            }
        }
    }

    let mut body = json!({
        "contents": contents,
    });

    if let Some(sys) = system_instruction {
        body["system_instruction"] = json!({
            "parts": [{"text": sys}]
        });
    }

    let mut gen_config = serde_json::Map::new();
    if let Some(temp) = req.temperature {
        gen_config.insert("temperature".into(), json!(temp));
    }
    if let Some(max_t) = req.max_tokens {
        gen_config.insert("maxOutputTokens".into(), json!(max_t));
    }
    if !gen_config.is_empty() {
        body["generationConfig"] = json!(gen_config);
    }

    body
}

/// Translate a Gemini `generateContent` response into a [`ChatResponse`].
fn translate_gemini_response(
    model: &str,
    raw: &serde_json::Value,
) -> Result<ChatResponse, ProviderError> {
    let text = raw
        .get("candidates")
        .and_then(|c| c.as_array())
        .and_then(|arr| arr.first())
        .and_then(|c| c.get("content"))
        .and_then(|c| c.get("parts"))
        .and_then(|p| p.as_array())
        .and_then(|arr| arr.first())
        .and_then(|p| p.get("text"))
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .to_string();

    let finish_reason = raw
        .get("candidates")
        .and_then(|c| c.as_array())
        .and_then(|arr| arr.first())
        .and_then(|c| c.get("finishReason"))
        .and_then(|v| v.as_str())
        .unwrap_or("STOP")
        .to_lowercase();

    let usage_in = raw
        .get("usageMetadata")
        .and_then(|u| u.get("promptTokenCount"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;
    let usage_out = raw
        .get("usageMetadata")
        .and_then(|u| u.get("candidatesTokenCount"))
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as u32;

    Ok(ChatResponse {
        id: format!("gemini-{}", model),
        object: "chat.completion".into(),
        created: chrono::Utc::now().timestamp(),
        model: model.to_string(),
        choices: vec![Choice {
            index: 0,
            message: ChatMessage::assistant(text),
            finish_reason: finish_reason,
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
impl Provider for GeminiProvider {
    fn id(&self) -> &str {
        &self.id
    }

    async fn models(&self, _ctx: &Context) -> Result<Vec<Model>, ProviderError> {
        // Phase 4: wire GET /models once we need catalog listing.
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
        let url = format!(
            "{}/models/{}:generateContent?key={}",
            self.base_url,
            req.model,
            ctx.credentials.as_bearer_token().unwrap_or(&self.api_key),
        );
        let body = build_gemini_body(&req);

        let resp = self
            .http
            .post(&url)
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
            return Err(classify_gemini_error(
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

        translate_gemini_response(&req.model, &raw)
    }

    async fn chat_completion_stream(
        &self,
        ctx: &Context,
        req: ChatRequest,
        tx: mpsc::Sender<Result<StreamChunk, ProviderError>>,
    ) -> Result<(), ProviderError> {
        let api_key = ctx.credentials.as_bearer_token().unwrap_or(&self.api_key);
        let url = format!(
            "{}/models/{}:streamGenerateContent?alt=sse&key={}",
            self.base_url, req.model, api_key,
        );
        let body = build_gemini_body(&req);

        let resp = self
            .http
            .post(&url)
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
            return Err(classify_gemini_error(
                &self.id,
                status.as_u16(),
                body_text,
            ));
        }

        let mut stream = resp.bytes_stream();
        let mut buffer: Vec<u8> = Vec::new();
        let created = chrono::Utc::now().timestamp();

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

                // Gemini SSE uses `data: {...}` lines; extract the payload.
                let payload = if let Some(s) = line.strip_prefix("data: ") {
                    s.trim()
                } else if let Some(s) = line.strip_prefix("data:") {
                    s.trim()
                } else {
                    continue;
                };

                // Gemini wraps each streaming chunk in a JSON array.
                // Parse the inner object from the array.
                let parsed: serde_json::Value = match serde_json::from_str(payload) {
                    Ok(v) => v,
                    Err(e) => {
                        let _ = tx
                            .send(Err(ProviderError::StreamError {
                                provider: self.id.clone(),
                                message: format!("gemini sse: {e}"),
                            }))
                            .await;
                        continue;
                    }
                };

                // Handle array-wrapped chunks: unwrap first element.
                let candidate = if let Some(arr) = parsed.as_array() {
                    arr.first()
                } else {
                    Some(&parsed)
                };

                let Some(candidate) = candidate else {
                    continue;
                };

                // Extract text delta from the candidate.
                let text = candidate
                    .get("candidates")
                    .and_then(|c| c.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|c| c.get("content"))
                    .and_then(|c| c.get("parts"))
                    .and_then(|p| p.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|p| p.get("text"))
                    .and_then(|t| t.as_str())
                    .unwrap_or("");

                let finish_reason = candidate
                    .get("candidates")
                    .and_then(|c| c.as_array())
                    .and_then(|arr| arr.first())
                    .and_then(|c| c.get("finishReason"))
                    .and_then(|v| v.as_str());

                if text.is_empty() && finish_reason.is_none() {
                    continue;
                }

                let chunk = if let Some(_reason) = finish_reason {
                    // Final chunk with finish reason — emit the delta and mark done.
                    let mut c = StreamChunk::new(&req.model, &req.model, created);
                    if !text.is_empty() {
                        c = c.push_choice(0, ChatMessage::assistant(text));
                    }
                    c.with_done()
                } else {
                    StreamChunk::new(&req.model, &req.model, created)
                        .push_choice(0, ChatMessage::assistant(text))
                };

                if tx.send(Ok(chunk)).await.is_err() {
                    return Ok(());
                }

                // If finishReason was present, the stream is done.
                if finish_reason.is_some() {
                    return Ok(());
                }
            }
        }

        // Stream ended without a finish reason; emit done.
        let _ = tx
            .send(Ok(StreamChunk::new("", "", 0).with_done()))
            .await;
        Ok(())
    }

    async fn ping(&self, ctx: &Context) -> Result<(), ProviderError> {
        let api_key = ctx.credentials.as_bearer_token().unwrap_or(&self.api_key);
        let url = format!(
            "{}/models/gemini-1.5-flash:generateContent?key={}",
            self.base_url, api_key,
        );
        let minimal = json!({
            "contents": [{"parts": [{"text": "ping"}]}],
        });

        let resp = self
            .http
            .post(&url)
            .json(&minimal)
            .send()
            .await
            .map_err(|e| ProviderError::Unavailable {
                provider: self.id.clone(),
                reason: e.to_string(),
            })?;

        let status = resp.status();
        if status.is_success() {
            Ok(())
        } else {
            Err(ProviderError::AuthFailed {
                provider: self.id.clone(),
                message: format!("HTTP {status}"),
            })
        }
    }
}

fn classify_gemini_error(provider: &str, status: u16, body: String) -> ProviderError {
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
        let init = ProviderInit::new("", "gemini-test");
        let err = GeminiProvider::new(init).unwrap_err();
        assert!(matches!(err, ProviderError::AuthFailed { .. }));
    }

    #[test]
    fn new_rejects_empty_api_key() {
        let init = ProviderInit::new("gemini", "");
        let err = GeminiProvider::new(init).unwrap_err();
        assert!(matches!(err, ProviderError::AuthFailed { .. }));
    }

    #[test]
    fn new_strips_trailing_slash() {
        let init = ProviderInit::new("gemini", "test-key")
            .with_base_url("https://generativelanguage.googleapis.com/v1beta/");
        let p = GeminiProvider::new(init).unwrap();
        assert_eq!(p.base_url(), "https://generativelanguage.googleapis.com/v1beta");
    }

    #[test]
    fn provider_id_round_trip() {
        let p = GeminiProvider::new(ProviderInit::new("gemini", "test-key")).unwrap();
        assert_eq!(p.id(), "gemini");
    }

    #[test]
    fn build_body_includes_system_and_contents() {
        let req = ChatRequest::new("gemini-1.5-pro", "Hello")
            .with_system("You are a helpful assistant.")
            .with_max_tokens(500);
        let body = build_gemini_body(&req);
        assert_eq!(body["contents"][0]["role"], "user");
        assert_eq!(body["contents"][0]["parts"][0]["text"], "Hello");
        assert_eq!(
            body["system_instruction"]["parts"][0]["text"],
            "You are a helpful assistant."
        );
    }

    #[test]
    fn build_body_maps_assistant_to_model_role() {
        let mut req = ChatRequest::new("gemini-1.5-pro", "hi");
        req.messages.push(ChatMessage::assistant("Hello!"));
        req.messages.push(ChatMessage::user("How are you?"));
        let body = build_gemini_body(&req);
        assert_eq!(body["contents"].as_array().unwrap().len(), 3);
        assert_eq!(body["contents"][1]["role"], "model");
        assert_eq!(body["contents"][1]["parts"][0]["text"], "Hello!");
    }

    #[test]
    fn build_body_includes_temperature() {
        let mut req = ChatRequest::new("gemini-1.5-pro", "hi");
        req.temperature = Some(0.8);
        let body = build_gemini_body(&req);
        assert!((body["generationConfig"]["temperature"].as_f64().unwrap() - 0.8).abs() < 1e-6);
    }

    #[test]
    fn classify_401_is_auth_failed() {
        let err = classify_gemini_error("gemini", 401, "bad".into());
        assert!(matches!(err, ProviderError::AuthFailed { .. }));
        assert!(!err.is_retryable());
    }

    #[test]
    fn classify_429_is_rate_limited() {
        let err = classify_gemini_error("gemini", 429, "rate".into());
        assert!(matches!(err, ProviderError::RateLimited { .. }));
        assert!(err.is_retryable());
    }
}
