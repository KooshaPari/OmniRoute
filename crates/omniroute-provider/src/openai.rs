//! OpenAI provider adapter.
//!
//! Speaks the OpenAI chat-completions wire format. The same adapter handles
//! 120+ OpenAI-compatible providers (Together, Groq, Fireworks, OpenRouter,
//! vLLM, Ollama Cloud, etc.) — the only difference is `base_url`.
//!
//! Phase 2 ships:
//! - non-streaming chat completion
//! - stubbed streaming (`todo!`)
//! - stubbed models listing (`todo!`)
//! - ping/health check via `/v1/models`
//!
//! Phase 3 wires the streaming path with SSE decode + mpsc sender.

use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
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
        _ctx: &Context,
        _req: omniroute_core::ChatRequest,
        _tx: mpsc::Sender<Result<StreamChunk, ProviderError>>,
    ) -> Result<(), ProviderError> {
        // Phase 3: wire SSE decode → StreamChunk → tx.
        // For now, send one `done: true` chunk so the runtime's stream
        // contract is satisfied.
        let _ = _tx; // silence unused
        Err(ProviderError::Internal {
            provider: self.id.clone(),
            message: "chat_completion_stream not yet wired (Phase 3)".into(),
        })
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
}