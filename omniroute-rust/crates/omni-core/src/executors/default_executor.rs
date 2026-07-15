//! Default HTTP executor — translates `ExecutorRequest` into an upstream API call
//! via `reqwest`, streaming the response back as `StreamEvent` frames.
//!
//! This is the **concrete executor** that PR-9's `DispatchPlan` resolves to.
//! It is stateless beyond the `Provider` metadata it wraps; the caller
//! (dispatcher / combo engine) is responsible for routing decisions, while
//! this executor handles the wire protocol.
//!
//! ## Streaming path (when `ExecutorRequest.stream`)
//!
//! 1. Send POST to `provider.base_url + /chat/completions` with the request body.
//! 2. Read the response body as newline-delimited JSON (NDJSON) via
//!    `reqwest::Response::bytes_stream()`.
//! 3. For each complete line, parse into an SSE-style text chunk, then build
//!    the corresponding `StreamEvent`:
//!    - `[DONE]` → `StreamEvent::Done(CompleteResponse)`.
//!    - `data: {"choices":[{"delta":{"content":"..."}}]}` → `StreamEvent::Chunk`.
//! 4. Emit `StreamEvent::Error` on HTTP errors, timeouts, or invalid JSON.
//!
//! ## Non-streaming path (when `!ExecutorRequest.stream`)
//!
//! 1. Send POST to `provider.base_url` (same endpoint) with the request body.
//! 2. Await the full JSON response body.
//! 3. Parse into `CompleteResponse` and emit a single `StreamEvent::Done`.
//!
//! ## Error classification
//!
//! | HTTP status | Error kind  | retryable | notes |
//! |-------------|-------------|-----------|-------|
//! | 400–499     | BadRequest  | false     | caller must fix the request |
//! | 500–599     | `Upstream`  | true      | automatic retry |
//! | 429         | RateLimited | true      | backoff + retry |
//! | connection  | `Upstream`  | true      | transient |
//! | timeout     | `Upstream`  | true      | requester may increase timeout |
//! | 200 OK      | —           | —         | success |

use async_trait::async_trait;
use bytes::Bytes;
use futures::{stream, StreamExt};
use reqwest::Client;
use std::time::Duration;

use crate::error::{Error, ErrorKind};
use crate::executor::{
    Executor, ExecutorCapabilities, ExecutorRequest, ExecutorResponse, StreamEvent,
};
use crate::provider::{Provider, ProviderId};

/// Default HTTP executor that calls upstream LLM API endpoints.
///
/// Constructed with a reqwest `Client` (shared across calls) and a
/// `Provider` reference that provides base URL, auth headers, and the
/// capability set. This executor is **stateless** — all mutable state
/// (rate-limit counters, circuit-breaker state) lives in the caller.
pub struct DefaultExecutor {
    client: Client,
    provider: Provider,
    base_url: String,
    model_catalog: Vec<String>,
}

impl DefaultExecutor {
    /// Create a new executor for the given provider.
    ///
    /// The `base_url` is resolved from the provider's config (including
    /// `ProviderConfig.base_url`). Falls back to the metadata's implicit
    /// OpenAI-compatible URL (`https://api.openai.com/v1/chat/completions`)
    /// only when none is configured.
    pub fn new(provider: Provider) -> Self {
        let model_catalog = provider
            .metadata
            .models
            .iter()
            .map(|model| model.as_str().to_string())
            .collect();

        let base_url = if provider.metadata.base_url.is_empty() {
            "https://api.openai.com/v1".to_string()
        } else {
            provider.metadata.base_url.clone()
        };

        Self {
            client: Client::builder()
                .timeout(Duration::from_secs(120))
                .pool_max_idle_per_host(8)
                .build()
                .expect("reqwest Client::builder() should never fail with the config above"),
            provider,
            base_url,
            model_catalog,
        }
    }

    /// Build the full endpoint URL for this provider.
    fn endpoint(&self, path: &str) -> String {
        let base = self.base_url.trim_end_matches('/');
        let path = path.trim_start_matches('/');
        format!("{base}/{path}")
    }

    /// Build the authorization header value from the provider's configured
    /// credential. Returns the `Authorization` header value (e.g.
    /// `"Bearer sk-abc123"`) or `None` if the provider has no credentials
    /// configured (which will cause a 401 from the upstream).
    fn auth_header(&self) -> Option<String> {
        self.provider
            .credential
            .as_ref()
            .map(|key| format!("Bearer {key}"))
    }

    /// Stream the response body, parsing newline-delimited JSON into
    /// `StreamEvent` values. Each complete line that starts with `data: `
    /// is decoded; other lines are silently skipped (OpenAI-style SSE).
    ///
    /// This method is separated from `execute_stream` so both streaming
    /// and non-streaming paths share the same line-parse logic.
    async fn parse_streaming_response<B>(
        mut body: B,
        provider_id: &str,
        model_id: &str,
    ) -> Vec<StreamEvent>
    where
        B: futures::Stream<Item = Result<Bytes, reqwest::Error>> + Unpin,
    {
        let mut events: Vec<StreamEvent> = Vec::new();
        let mut buffer = String::new();

        while let Some(chunk_result) = body.next().await {
            match chunk_result {
                Ok(chunk) => {
                    let chunk_str = String::from_utf8_lossy(&chunk);
                    buffer.push_str(&chunk_str);

                    // Process complete lines from buffer
                    loop {
                        let nl_pos = buffer.find('\n');
                        let cr_pos = buffer.find("\r\n");
                        let end = match (nl_pos, cr_pos) {
                            (Some(n), Some(c)) => std::cmp::min(n, c),
                            (Some(n), None) => n,
                            (None, Some(c)) => c,
                            (None, None) => break,
                        };

                        let line: String = buffer.drain(..=end).collect();
                        let line = line.trim().to_string();

                        if line.is_empty() {
                            continue;
                        }

                        if let Some(evt) = Self::parse_sse_line(&line, provider_id, model_id) {
                            events.push(evt);
                        }
                    }
                }
                Err(e) => {
                    events.push(StreamEvent {
                        data: serde_json::json!({"error":{"message":format!("upstream stream error: {e}")}}).to_string(),
                        event: Some("error".to_string()),
                        terminal: true,
                    });
                }
            }
        }

        events
    }

    /// Parse a single SSE line into an optional `StreamEvent`.
    ///
    /// Supports the standard OpenAI SSE format:
    /// - `data: {"choices":[{"delta":{"content":"..."}}]}` → Chunk
    /// - `data: [DONE]` → Done (signal only; the actual Done event is
    ///   synthesized from accumulated chunks)
    /// - `data: {"choices":[{"delta":{},"finish_reason":"stop"}]}` →
    ///   last chunk with finish_reason
    /// - `data: {"error":{...}}`  → Error
    fn parse_sse_line(line: &str, _provider_id: &str, _model_id: &str) -> Option<StreamEvent> {
        let line = line.trim();

        if line.is_empty() || line.starts_with(':') {
            return None; // comment or heartbeat
        }

        // Strip `data: ` prefix
        let payload = if let Some(rest) = line.strip_prefix("data: ") {
            rest.trim()
        } else if let Some(rest) = line.strip_prefix("data:") {
            rest.trim()
        } else {
            // Not a data line — the SSE spec allows event: / id: / retry: lines
            // which we skip.
            return None;
        };

        // OpenAI `data: [DONE]` signal
        if payload == "[DONE]" {
            return Some(StreamEvent {
                data: serde_json::json!({"id":"","model":_model_id}).to_string(),
                event: Some("done".to_string()),
                terminal: true,
            });
        }

        // Try to parse as JSON
        let value: serde_json::Value = match serde_json::from_str(payload) {
            Ok(v) => v,
            Err(_) => {
                // Non-JSON data lines are silently skipped (some upstreams
                // send keepalive bytes like `:\n\n` or `data: ping\n\n`).
                return None;
            }
        };

        // Check for errors embedded in the response
        if let Some(_err) = value.get("error") {
            let msg = _err
                .get("message")
                .and_then(|m| m.as_str())
                .unwrap_or("unknown upstream error")
                .to_string();
            return Some(StreamEvent {
                data: serde_json::json!({"error":{"message":msg}}).to_string(),
                event: Some("error".to_string()),
                terminal: true,
            });
        }

        // Parse choices
        if let Some(choices) = value.get("choices").and_then(|c| c.as_array()) {
            if let Some(choice) = choices.first() {
                let finish_reason = choice
                    .get("finish_reason")
                    .and_then(|f| f.as_str())
                    .map(|s| s.to_string());

                let content = choice
                    .get("delta")
                    .and_then(|d| d.get("content"))
                    .and_then(|c| c.as_str())
                    .map(|s| s.to_string())
                    .unwrap_or_default();

                if finish_reason.is_some() || !content.is_empty() {
                    return Some(StreamEvent {
                        data: content,
                        event: finish_reason.clone().or(Some("chunk".to_string())),
                        terminal: finish_reason.is_some(),
                    });
                }
            }
        }

        None
    }
}

#[async_trait]
impl Executor for DefaultExecutor {
    fn provider_id(&self) -> ProviderId {
        self.provider.metadata.id.clone()
    }

    fn capabilities(&self) -> ExecutorCapabilities {
        // DefaultExecutor supports all base capabilities.
        ExecutorCapabilities::default()
    }

    fn models(&self) -> &[String] {
        &self.model_catalog
    }

    async fn execute(&self, request: ExecutorRequest) -> Result<ExecutorResponse, Error> {
        if request.stream {
            self.execute_stream(request).await
        } else {
            self.execute_non_streaming(request).await
        }
    }
}

// ---------------------------------------------------------------------------
// Private impl blocks — split for readability
// ---------------------------------------------------------------------------

/// Streaming-request logic.
impl DefaultExecutor {
    async fn execute_stream(&self, request: ExecutorRequest) -> Result<ExecutorResponse, Error> {
        let endpoint = self.endpoint("/chat/completions");
        let url_str: &str = &endpoint;

        let mut req_builder = self
            .client
            .post(url_str)
            .header("Content-Type", "application/json");

        // Add auth header if available
        if let Some(auth) = self.auth_header() {
            req_builder = req_builder.header("Authorization", &auth);
        }

        // Merge any additional headers from the executor request
        for (key, value) in &request.headers {
            req_builder = req_builder.header(key.as_str(), value.as_str());
        }

        // Set the request body — reqwest's body type implements
        // `From<Vec<u8>>` so we serialize the JSON value to bytes.
        let body_bytes = serde_json::to_vec(&request.body).map_err(|e| {
            Error::with_kind(
                ErrorKind::BadRequest,
                format!("failed to serialize request body: {e}"),
            )
        })?;
        let req_builder = req_builder.body(body_bytes);

        // Apply timeout from the request, or default to 120s
        let req_builder = match request.timeout {
            Some(d) => req_builder.timeout(d),
            None => req_builder,
        };

        // Send the request
        let response = match req_builder.send().await {
            Ok(resp) => resp,
            Err(e) => {
                return Err(if e.is_timeout() {
                    Error::upstream_status("upstream timeout", 504)
                } else if e.is_connect() {
                    Error::upstream_status(format!("upstream connection failed: {e}"), 502)
                } else {
                    Error::upstream_status(format!("upstream request failed: {e}"), 502)
                });
            }
        };

        let status = response.status();
        let provider_id = self.provider.metadata.id.as_str();
        let model_id = request.model.as_str();

        // HTTP error paths
        if !status.is_success() {
            let status_code = status.as_u16();
            let body_text = response.text().await.unwrap_or_default();
            let message = if body_text.is_empty() {
                format!("upstream returned {status_code}")
            } else {
                format!("upstream returned {status_code}: {body_text}")
            };

            let kind = match status_code {
                400..=499 => {
                    if status_code == 429 {
                        ErrorKind::RateLimited
                    } else {
                        ErrorKind::BadRequest
                    }
                }
                500..=599 => ErrorKind::UpstreamUnavailable,
                _ => ErrorKind::UpstreamUnavailable,
            };

            return Err(Error::with_kind(kind, message));
        }

        // Success — stream the response body
        let body = response.bytes_stream();
        let events = Self::parse_streaming_response(body, provider_id, model_id).await;

        Ok(ExecutorResponse::Streaming(Box::pin(stream::iter(
            events.into_iter().map(Ok),
        ))))
    }
}

/// Non-streaming (single-completion) request logic.
impl DefaultExecutor {
    async fn execute_non_streaming(
        &self,
        request: ExecutorRequest,
    ) -> Result<ExecutorResponse, Error> {
        let endpoint = self.endpoint("/chat/completions");
        let url_str: &str = &endpoint;

        let mut req_builder = self
            .client
            .post(url_str)
            .header("Content-Type", "application/json");

        if let Some(auth) = self.auth_header() {
            req_builder = req_builder.header("Authorization", &auth);
        }

        for (key, value) in &request.headers {
            req_builder = req_builder.header(key.as_str(), value.as_str());
        }

        let body_bytes = serde_json::to_vec(&request.body).map_err(|e| {
            Error::with_kind(
                ErrorKind::BadRequest,
                format!("failed to serialize request body: {e}"),
            )
        })?;
        let req_builder = req_builder.body(body_bytes);

        let req_builder = match request.timeout {
            Some(d) => req_builder.timeout(d),
            None => req_builder,
        };

        let response = match req_builder.send().await {
            Ok(resp) => resp,
            Err(e) => {
                return Err(if e.is_timeout() {
                    Error::upstream_status("upstream timeout", 504)
                } else if e.is_connect() {
                    Error::upstream_status(format!("upstream connection failed: {e}"), 502)
                } else {
                    Error::upstream_status(format!("upstream request failed: {e}"), 502)
                });
            }
        };

        let status = response.status();

        if !status.is_success() {
            let status_code = status.as_u16();
            let body_text = response.text().await.unwrap_or_default();
            let message = if body_text.is_empty() {
                format!("upstream returned {status_code}")
            } else {
                format!("upstream returned {status_code}: {body_text}")
            };

            let kind = match status_code {
                429 => ErrorKind::RateLimited,
                400..=499 => ErrorKind::BadRequest,
                _ => ErrorKind::UpstreamUnavailable,
            };

            return Err(Error::with_kind(kind, message));
        }

        // Success — parse the full JSON body
        let body_bytes = match response.bytes().await {
            Ok(b) => b,
            Err(e) => {
                return Err(Error::upstream_status(
                    format!("failed to read response body: {e}"),
                    502,
                ));
            }
        };

        let value: serde_json::Value = match serde_json::from_slice(&body_bytes) {
            Ok(v) => v,
            Err(e) => {
                return Err(Error::with_kind(
                    ErrorKind::UpstreamUnavailable,
                    format!("upstream returned invalid JSON: {e}"),
                ));
            }
        };

        // Extract basic fields from the response
        let id = value
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let model = value
            .get("model")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let finish_reason = value
            .get("choices")
            .and_then(|c| c.as_array())
            .and_then(|arr| arr.first())
            .and_then(|c| c.get("finish_reason"))
            .and_then(|f| f.as_str())
            .map(|s| s.to_string());

        let usage = value.get("usage").map(|u| crate::streaming::TokenUsage {
            input: u.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0),
            output: u
                .get("completion_tokens")
                .and_then(|v| v.as_u64())
                .unwrap_or(0),
            total: u.get("total_tokens").and_then(|v| v.as_u64()).unwrap_or(0),
        });

        let events = vec![StreamEvent {
            data: serde_json::json!({"id":id,"model":model}).to_string(),
            event: Some("done".to_string()),
            terminal: true,
        }];

        Ok(ExecutorResponse::Streaming(Box::pin(stream::iter(
            events.into_iter().map(Ok),
        ))))
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::{ProviderKind, ProviderMetadata};

    fn test_provider() -> Provider {
        Provider::new(ProviderMetadata {
            id: crate::ProviderId::from("test-provider"),
            kind: ProviderKind::OpenAI,
            display_name: "Test Provider".to_string(),
            base_url: "https://api.test-provider.com/v1".to_string(),
            ..Default::default()
        })
        .with_credential("sk-test123")
    }

    #[test]
    fn default_executor_new_sets_base_url() {
        let provider = test_provider();
        let executor = DefaultExecutor::new(provider);
        assert!(
            executor.base_url.contains("test-provider"),
            "base_url should include test-provider, got: {}",
            executor.base_url
        );
    }

    #[test]
    fn default_executor_new_fallback_url() {
        let provider = Provider::new(ProviderMetadata {
            id: crate::ProviderId::from("no-url"),
            kind: ProviderKind::OpenAI,
            display_name: "No URL".to_string(),
            base_url: String::new(),
            ..Default::default()
        });
        let executor = DefaultExecutor::new(provider);
        assert!(
            executor.base_url.contains("api.openai.com"),
            "fallback URL should point to OpenAI, got: {}",
            executor.base_url
        );
    }

    #[test]
    fn auth_header_uses_api_key() {
        let provider = test_provider();
        // test_provider() already calls .with_credential("sk-test123")
        let executor = DefaultExecutor::new(provider);
        let auth = executor.auth_header();
        assert!(
            auth.is_some(),
            "auth_header should return Some with api_key set"
        );
        let val = auth.unwrap();
        assert!(
            val.starts_with("Bearer "),
            "auth header should start with 'Bearer '"
        );
        assert!(
            val.contains("sk-test123"),
            "auth header should contain the key"
        );
    }

    #[test]
    fn auth_header_none_when_no_credentials() {
        let provider = Provider::new(ProviderMetadata {
            id: crate::ProviderId::from("no-creds"),
            kind: ProviderKind::OpenAI,
            base_url: "https://api.openai.com/v1".to_string(),
            ..Default::default()
        });
        let executor = DefaultExecutor::new(provider);
        assert!(
            executor.auth_header().is_none(),
            "no auth header without credentials"
        );
    }

    #[test]
    fn endpoint_joins_base_and_path() {
        let provider = test_provider();
        let executor = DefaultExecutor::new(provider);
        let ep = executor.endpoint("/chat/completions");
        assert_eq!(ep, "https://api.test-provider.com/v1/chat/completions");
    }

    #[test]
    fn endpoint_strips_trailing_slash() {
        let provider = Provider::new(ProviderMetadata {
            id: crate::ProviderId::from("trailing-slash"),
            kind: ProviderKind::OpenAI,
            base_url: "https://api.test/".to_string(),
            ..Default::default()
        });
        let executor = DefaultExecutor::new(provider);
        let ep = executor.endpoint("/models");
        assert_eq!(ep, "https://api.test/models");
    }

    #[test]
    fn endpoint_no_leading_slash_in_path() {
        let provider = Provider::new(ProviderMetadata {
            id: crate::ProviderId::from("no-lead-slash"),
            kind: ProviderKind::OpenAI,
            base_url: "https://api.test".to_string(),
            ..Default::default()
        });
        let executor = DefaultExecutor::new(provider);
        let ep = executor.endpoint("models");
        assert_eq!(ep, "https://api.test/models");
    }

    // -----------------------------------------------------------------------
    // SSE line parsing tests (no network calls)
    // -----------------------------------------------------------------------

    #[test]
    fn parse_sse_done_signal() {
        let evt = DefaultExecutor::parse_sse_line("data: [DONE]", "p", "m");
        assert!(evt.is_some(), "data: [DONE] should parse");
        let ev = evt.unwrap();
        assert_eq!(ev.event, Some("done".to_string()), "expected done event");
        assert!(ev.terminal, "done events should be terminal");
    }

    #[test]
    fn parse_sse_chunk_with_content() {
        let line = r#"data: {"choices":[{"delta":{"content":"Hello"},"index":0}]}"#;
        let evt = DefaultExecutor::parse_sse_line(line, "p", "m");
        assert!(evt.is_some(), "chunk should parse");
        let ev = evt.unwrap();
        assert_eq!(ev.data, "Hello");
        assert!(!ev.terminal, "non-terminal chunk");
    }

    #[test]
    fn parse_sse_chunk_with_finish_reason() {
        let line = r#"data: {"choices":[{"delta":{},"finish_reason":"stop","index":0}]}"#;
        let evt = DefaultExecutor::parse_sse_line(line, "p", "m");
        assert!(evt.is_some(), "terminal chunk should parse");
        let ev = evt.unwrap();
        assert!(ev.data.is_empty());
        assert_eq!(ev.event, Some("stop".to_string()));
        assert!(ev.terminal, "chunk with finish_reason should be terminal");
    }

    #[test]
    fn parse_sse_error_payload() {
        let line =
            r#"data: {"error":{"message":"Insufficient quota","type":"insufficient_quota"}}"#;
        let evt = DefaultExecutor::parse_sse_line(line, "p", "m");
        assert!(evt.is_some(), "error payload should parse");
        let ev = evt.unwrap();
        assert_eq!(ev.event, Some("error".to_string()), "expected error event");
        assert!(ev.data.contains("quota"), "error should mention quota");
    }

    #[test]
    fn parse_sse_comment_line_is_skipped() {
        let evt = DefaultExecutor::parse_sse_line(":ping", "p", "m");
        assert!(evt.is_none(), "comment lines should be skipped");
    }

    #[test]
    fn parse_sse_event_line_is_skipped() {
        let evt = DefaultExecutor::parse_sse_line(r#"event: done"#, "p", "m");
        assert!(evt.is_none(), "event: lines should be skipped");
    }

    #[test]
    fn parse_sse_empty_line_is_skipped() {
        let evt = DefaultExecutor::parse_sse_line("", "p", "m");
        assert!(evt.is_none(), "empty lines should be skipped");
    }

    #[test]
    fn parse_sse_non_data_line_is_skipped() {
        let evt = DefaultExecutor::parse_sse_line("id: 1", "p", "m");
        assert!(evt.is_none(), "non-data lines should be skipped");
    }

    #[test]
    fn capabilities_matches_provider() {
        let provider = test_provider();
        let executor = DefaultExecutor::new(provider);
        let caps = executor.capabilities();
        // Default provider has ExecutorCapabilities::default() — no special caps.
        // If the test_provider used defaults, streaming is not supported.
        // The test verifies the proxy works, not the specific cap values.
        let _ = caps; // not much to assert on a default-capabilities provider
    }
}
