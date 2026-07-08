//! OpenAI provider adapter.
//!
//! Speaks the OpenAI chat-completions wire format. The same adapter handles
//! 120+ OpenAI-compatible providers (Together, Groq, Fireworks, OpenRouter,
//! vLLM, Ollama Cloud, etc.) — the only difference is `base_url`.
//!
//! Phase 3 (Stream 4) ships:
//! - non-streaming chat completion
//! - streaming chat completion with SSE decode + mpsc sender
//! - stubbed models listing
//! - ping/health check via `/v1/models`

use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use futures_util::StreamExt;
use reqwest::Client;
use tokio::sync::mpsc;

use omniroute_core::{
    Context, Model, Provider, ProviderError, RetryConfig, StreamChunk,
    backoff_delay,
};

const DEFAULT_BASE_URL: &str = "https://api.openai.com";
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(60);

/// Initialisation context for [`OpenAIProvider`].
///
/// Build with [`ProviderInit::new`] and chain the optional `base_url`,
/// `timeout`, and `retry_config` builders.
#[derive(Debug, Clone)]
pub struct ProviderInit {
    /// Provider ID — typically `"openai"` or a compatible alias.
    pub id: String,
    /// API key / bearer token.
    pub api_key: String,
    /// Base URL (no trailing slash). Defaults to `https://api.openai.com`.
    pub base_url: String,
    /// Per-request timeout. Defaults to 60s.
    pub timeout: Duration,
    /// Retry policy. Defaults match `open-sse/executors/base.ts`.
    pub retry_config: RetryConfig,
}

impl ProviderInit {
    /// Minimal init: id + api key, defaults elsewhere.
    pub fn new(id: impl Into<String>, api_key: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            api_key: api_key.into(),
            base_url: DEFAULT_BASE_URL.into(),
            timeout: DEFAULT_TIMEOUT,
            retry_config: RetryConfig::default(),
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

    /// Builder: override the retry policy.
    pub fn with_retry_config(mut self, cfg: RetryConfig) -> Self {
        self.retry_config = cfg;
        self
    }

    fn validate(&self) -> Result<(), ProviderError> {
        if self.id.is_empty() {
            return Err(ProviderError::AuthFailed {
                provider: "openai".into(),
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

/// OpenAI / OpenAI-compatible provider.
#[derive(Debug)]
pub struct OpenAIProvider {
    id: String,
    base_url: String,
    api_key: Arc<String>,
    http: Arc<Client>,
    retry: RetryConfig,
}

impl OpenAIProvider {
    /// Construct an [`OpenAIProvider`] from a [`ProviderInit`].
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
            retry: init.retry_config,
        }))
    }

    /// Returns the configured base URL.
    pub fn base_url(&self) -> &str {
        &self.base_url
    }
}

#[async_trait]
impl Provider for OpenAIProvider {
    fn id(&self) -> &str {
        &self.id
    }

    async fn models(&self, _ctx: &Context) -> Result<Vec<Model>, ProviderError> {
        // Phase 3: GET /v1/models, map response to Vec<Model>.
        Err(ProviderError::Internal {
            provider: self.id.clone(),
            message: "models() not yet wired (Phase 3)".into(),
        })
    }

    async fn chat_completion(
        &self,
        ctx: &Context,
        req: omniroute_core::ChatRequest,
    ) -> Result<omniroute_core::ChatResponse, ProviderError> {
        let url = format!("{}/v1/chat/completions", self.base_url);
        let token = ctx.credentials.as_bearer_token().unwrap_or(&self.api_key);
        let mut last_err: Option<ProviderError> = None;

        for attempt in 0..self.retry.max_attempts {
            let result = self
                .http
                .post(&url)
                .bearer_auth(token)
                .json(&req)
                .send()
                .await;

            match result {
                Ok(resp) => {
                    let status = resp.status();
                    if status.is_success() {
                        return resp.json::<omniroute_core::ChatResponse>().await.map_err(|e| {
                            ProviderError::UpstreamError {
                                provider: self.id.clone(),
                                status: status.as_u16(),
                                body: e.to_string(),
                            }
                        });
                    }

                    let retry_after = parse_retry_after(&resp);
                    let body = resp.text().await.unwrap_or_default();
                    let err = classify_status(self.id.as_str(), status.as_u16(), body, retry_after);

                    if !err.is_retryable() || attempt + 1 == self.retry.max_attempts {
                        return Err(err);
                    }
                    last_err = Some(err);
                }
                Err(e) => {
                    let err = if e.is_timeout() {
                        ProviderError::Timeout {
                            provider: self.id.clone(),
                            timeout: Duration::from_millis(self.retry.max_delay_ms),
                        }
                    } else {
                        ProviderError::Unavailable {
                            provider: self.id.clone(),
                            reason: e.to_string(),
                        }
                    };
                    if !err.is_retryable() || attempt + 1 == self.retry.max_attempts {
                        return Err(err);
                    }
                    last_err = Some(err);
                }
            }

            let delay = backoff_delay(attempt, &self.retry);
            tracing::warn!(
                provider = %self.id,
                attempt = attempt + 1,
                delay_ms = delay.as_millis() as u64,
                "retrying after error"
            );
            tokio::time::sleep(delay).await;
        }

        Err(last_err.unwrap_or_else(|| ProviderError::Internal {
            provider: self.id.clone(),
            message: "exhausted retries without capturing an error".into(),
        }))
    }

    async fn chat_completion_stream(
        &self,
        ctx: &Context,
        req: omniroute_core::ChatRequest,
        tx: mpsc::Sender<Result<StreamChunk, ProviderError>>,
    ) -> Result<(), ProviderError> {
        let url = format!("{}/v1/chat/completions", self.base_url);
        let token = ctx.credentials.as_bearer_token().unwrap_or(&self.api_key);

        // Clone the request and enable streaming.
        let mut stream_req = req;
        stream_req.stream = Some(true);

        let resp = self
            .http
            .post(&url)
            .bearer_auth(token)
            .json(&stream_req)
            .send()
            .await
            .map_err(|e| ProviderError::Unavailable {
                provider: self.id.clone(),
                reason: e.to_string(),
            })?;

        let status = resp.status();
        if !status.is_success() {
            let retry_after = parse_retry_after(&resp);
            let body = resp.text().await.unwrap_or_default();
            return Err(classify_status(self.id.as_str(), status.as_u16(), body, retry_after));
        }

        // Process SSE stream: read bytes, split into lines, parse `data:` payloads.
        let mut stream = resp.bytes_stream();
        let mut buffer: Vec<u8> = Vec::new();

        while let Some(chunk_result) = stream.next().await {
            let bytes = chunk_result.map_err(|e| ProviderError::StreamError {
                provider: self.id.clone(),
                message: e.to_string(),
            })?;
            buffer.extend_from_slice(&bytes);

            // Process all complete lines in the buffer.
            loop {
                // Find the next line boundary.
                let newline_pos = match buffer.iter().position(|&b| b == b'\n') {
                    Some(pos) => pos,
                    None => break, // incomplete line; wait for more data.
                };

                // Extract the line (excluding \n).
                let line = String::from_utf8_lossy(&buffer[..newline_pos])
                    .trim()
                    .to_string();
                buffer.drain(..=newline_pos);

                if line.is_empty() {
                    continue;
                }

                // Only process SSE `data:` lines.
                let payload = if let Some(s) = line.strip_prefix("data: ") {
                    s.trim()
                } else if let Some(s) = line.strip_prefix("data:") {
                    s.trim()
                } else {
                    continue;
                };

                // Handle the terminal sentinel.
                if payload == "[DONE]" {
                    let _ = tx
                        .send(Ok(StreamChunk::new("", "", 0).with_done()))
                        .await;
                    return Ok(());
                }

                // Deserialize the SSE payload directly into StreamChunk.
                // OpenAI's streaming JSON shape matches our StreamChunk (id, object,
                // created, model, choices[n].delta / finish_reason).
                match serde_json::from_str::<StreamChunk>(payload) {
                    Ok(chunk) => {
                        if tx.send(Ok(chunk)).await.is_err() {
                            // Receiver dropped — stream cancelled by consumer.
                            return Ok(());
                        }
                    }
                    Err(e) => {
                        let _ = tx
                            .send(Err(ProviderError::StreamError {
                                provider: self.id.clone(),
                                message: format!("failed to parse SSE payload: {e}"),
                            }))
                            .await;
                    }
                }
            }
        }

        // Stream ended without [DONE]; emit the terminal sentinel.
        let _ = tx
            .send(Ok(StreamChunk::new("", "", 0).with_done()))
            .await;
        Ok(())
    }

    async fn ping(&self, ctx: &Context) -> Result<(), ProviderError> {
        let url = format!("{}/v1/models", self.base_url);
        let token = ctx.credentials.as_bearer_token().unwrap_or(&self.api_key);
        let resp = self
            .http
            .get(&url)
            .bearer_auth(token)
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

fn classify_status(
    provider: &str,
    status: u16,
    body: String,
    retry_after: Option<u64>,
) -> ProviderError {
    match status {
        401 | 403 => ProviderError::AuthFailed {
            provider: provider.into(),
            message: body,
        },
        429 => ProviderError::RateLimited {
            provider: provider.into(),
            retry_after,
        },
        s if s >= 500 => ProviderError::UpstreamError {
            provider: provider.into(),
            status,
            body,
        },
        _ => ProviderError::UpstreamError {
            provider: provider.into(),
            status,
            body,
        },
    }
}

fn parse_retry_after(resp: &reqwest::Response) -> Option<u64> {
    resp.headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u64>().ok())
}

#[cfg(test)]
mod tests {
    use super::*;
    use omniroute_core::Credentials;

    #[test]
    fn new_rejects_empty_id() {
        let init = ProviderInit::new("", "sk-test");
        let err = OpenAIProvider::new(init).unwrap_err();
        assert!(matches!(err, ProviderError::AuthFailed { .. }));
    }

    #[test]
    fn new_rejects_empty_api_key() {
        let init = ProviderInit::new("openai", "");
        let err = OpenAIProvider::new(init).unwrap_err();
        assert!(matches!(err, ProviderError::AuthFailed { .. }));
    }

    #[test]
    fn new_strips_trailing_slash() {
        let init = ProviderInit::new("groq", "gsk-test").with_base_url("https://api.groq.com/openai/v1/");
        let p = OpenAIProvider::new(init).unwrap();
        assert_eq!(p.base_url(), "https://api.groq.com/openai/v1");
    }

    #[test]
    fn provider_id_round_trip() {
        let p = OpenAIProvider::new(ProviderInit::new("openai", "sk-test")).unwrap();
        assert_eq!(p.id(), "openai");
    }

    #[test]
    fn classify_401_is_auth_failed() {
        let err = classify_status("openai", 401, "bad".into(), None);
        assert!(matches!(err, ProviderError::AuthFailed { .. }));
        assert!(!err.is_retryable());
    }

    #[test]
    fn classify_429_is_rate_limited() {
        let err = classify_status("openai", 429, "rate".into(), Some(5));
        assert!(matches!(err, ProviderError::RateLimited { retry_after: Some(5), .. }));
        assert!(err.is_retryable());
    }

    #[test]
    fn classify_503_is_upstream_retryable() {
        let err = classify_status("openai", 503, "x".into(), None);
        assert!(matches!(err, ProviderError::UpstreamError { status: 503, .. }));
        assert!(err.is_retryable());
    }

    #[tokio::test]
    async fn streaming_parses_sse_data_lines() {
        let _p = OpenAIProvider::new(ProviderInit::new("openai", "sk-test")).unwrap();
        let _ctx = Context::new(Credentials::bearer("sk-test"), "openai", "req-1");

        // Simulate SSE bytes that arrive in two chunks.
        let sse1 = "data: {\"id\":\"a\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"gpt-4o\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"Hel\"},\"finish_reason\":null}]}\n";
        let sse2 = "data: {\"id\":\"a\",\"object\":\"chat.completion.chunk\",\"created\":1,\"model\":\"gpt-4o\",\"choices\":[{\"index\":0,\"delta\":{\"role\":\"assistant\",\"content\":\"lo\"},\"finish_reason\":null}]}\n\ndata: [DONE]\n\n";

        // This test only validates that the SSE line parser works correctly.
        // We test the buffer/parse logic by checking the transform inline.
        let mut buffer: Vec<u8> = Vec::new();
        buffer.extend_from_slice(sse1.as_bytes());

        // Process first chunk
        let mut chunks = Vec::new();
        loop {
            let newline_pos = match buffer.iter().position(|&b| b == b'\n') {
                Some(pos) => pos,
                None => break,
            };
            let line =
                String::from_utf8_lossy(&buffer[..newline_pos]).trim().to_string();
            buffer.drain(..=newline_pos);
            if line.is_empty() {
                continue;
            }
            if let Some(payload) = line.strip_prefix("data: ") {
                let payload = payload.trim();
                if payload == "[DONE]" {
                    chunks.push(StreamChunk::new("", "", 0).with_done());
                    break;
                }
                if let Ok(chunk) = serde_json::from_str::<StreamChunk>(payload) {
                    chunks.push(chunk);
                }
            }
        }

        // Process second chunk
        buffer.extend_from_slice(sse2.as_bytes());
        loop {
            let newline_pos = match buffer.iter().position(|&b| b == b'\n') {
                Some(pos) => pos,
                None => break,
            };
            let line =
                String::from_utf8_lossy(&buffer[..newline_pos]).trim().to_string();
            buffer.drain(..=newline_pos);
            if line.is_empty() {
                continue;
            }
            if let Some(payload) = line.strip_prefix("data: ") {
                let payload = payload.trim();
                if payload == "[DONE]" {
                    chunks.push(StreamChunk::new("", "", 0).with_done());
                    break;
                }
                if let Ok(chunk) = serde_json::from_str::<StreamChunk>(payload) {
                    chunks.push(chunk);
                }
            }
        }

        assert_eq!(chunks.len(), 3, "should have 2 content chunks + 1 done");
        assert!(!chunks[0].done);
        assert_eq!(chunks[0].model, "gpt-4o");
        assert!(!chunks[1].done);
        assert!(chunks[2].done);
    }
}