//! OpenAI-compatible executor.
//!
//! Implements [`ProviderExecutor`](crate::ProviderExecutor) for the OpenAI
//! Chat Completions API (`/v1/chat/completions`). Can also serve any
//! OpenAI-compatible provider (OpenRouter, Together, etc.) by passing a
//! custom base URL.

use crate::metrics::ExecutorMetrics;
use crate::{ExecuteRequest, ExecuteResponse, ExecutorError, ProviderExecutor, Result};
use async_trait::async_trait;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio_stream::StreamExt;

/// OpenAI-compatible executor.
///
/// Thread-safe, holds a shared `reqwest::Client` and optional metrics
/// collector. Created via [`OpenAiExecutor::new()`].
#[derive(Clone)]
pub struct OpenAiExecutor {
    client: reqwest::Client,
    metrics: Option<Arc<ExecutorMetrics>>,
}

impl OpenAiExecutor {
    /// Create a new executor with the given HTTP client.
    pub fn new(client: reqwest::Client) -> Self {
        Self {
            client,
            metrics: None,
        }
    }

    /// Attach an OTel-compatible metrics collector.
    pub fn with_metrics(self, metrics: Arc<ExecutorMetrics>) -> Self {
        Self {
            metrics: Some(metrics),
            ..self
        }
    }

    /// Convenience: build a client with sensible defaults for LLM serving.
    pub fn default_client() -> reqwest::Client {
        reqwest::Client::builder()
            .timeout(Duration::from_secs(120))
            .pool_max_idle_per_host(32)
            .tcp_keepalive(Duration::from_secs(30))
            .build()
            .expect("valid reqwest Client config")
    }
}

#[async_trait]
impl ProviderExecutor for OpenAiExecutor {
    async fn execute(&self, request: ExecuteRequest) -> Result<ExecuteResponse> {
        let start = std::time::Instant::now();

        // Build the HTTP request.
        let mut req_builder = match request.method.to_uppercase().as_str() {
            "POST" => self.client.post(&request.url),
            "GET" => self.client.get(&request.url),
            _ => {
                return Err(ExecutorError::Upstream {
                    status: 0,
                    body: format!("unsupported method: {}", request.method),
                })
            }
        };

        // Apply headers.
        for (key, value) in &request.headers {
            req_builder = req_builder.header(key.as_str(), value.as_str());
        }

        // Apply body (POST only).
        if request.method.to_uppercase() == "POST" {
            req_builder = req_builder.json(&request.body);
        }

        // Apply per-request timeout.
        if let Some(timeout) = request.timeout {
            req_builder = req_builder.timeout(timeout);
        }

        // Send.
        let response = req_builder.send().await.map_err(ExecutorError::Transport)?;
        let status = response.status().as_u16();
        let headers: Vec<(String, String)> = response
            .headers()
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
            .collect();

        // Record metrics.
        if let Some(metrics) = &self.metrics {
            metrics.record(status, start.elapsed());
        }

        // Handle streaming vs. non-streaming.
        if let Some(_chunk_size) = request.stream {
            let byte_stream = response.bytes_stream();
            let mapped = byte_stream.map(move |chunk| {
                chunk
                    .map_err(|e| ExecutorError::Io(std::io::Error::new(std::io::ErrorKind::Other, e)))
            });

            let (tx, rx) = mpsc::channel(64);
            tokio::spawn(async move {
                use tokio_stream::StreamExt;
                tokio::pin!(mapped);
                while let Some(chunk) = StreamExt::next(&mut mapped).await {
                    match chunk {
                        Ok(bytes) if !bytes.is_empty() => {
                            let _ = tx.send(Ok(bytes)).await;
                        }
                        Err(e) => {
                            let _ = tx.send(Err(e)).await;
                            break;
                        }
                        _ => {}
                    }
                }
            });

            Ok(ExecuteResponse {
                status,
                headers,
                body: serde_json::Value::Null,
                stream: Some(rx),
            })
        } else {
            let body: serde_json::Value = response.json().await.map_err(ExecutorError::Transport)?;
            Ok(ExecuteResponse {
                status,
                headers,
                body,
                stream: None,
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ExecuteRequest;
    use wiremock::matchers::{body_json, header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn valid_body() -> serde_json::Value {
        serde_json::json!({
            "model": "gpt-4o-mini",
            "messages": [{"role": "user", "content": "hi"}],
            "stream": false
        })
    }

    #[tokio::test]
    async fn openai_non_streaming_returns_json() {
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/v1/chat/completions"))
            .and(header("authorization", "Bearer sk-test"))
            .and(body_json(valid_body()))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "id": "chatcmpl-test",
                "object": "chat.completion",
                "choices": [{"index": 0, "message": {"role": "assistant", "content": "Hello"} }],
                "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}
            })))
            .mount(&mock_server)
            .await;

        let executor = OpenAiExecutor::new(reqwest::Client::new());

        let req = ExecuteRequest {
            url: format!("{}/v1/chat/completions", mock_server.uri()),
            method: "POST".into(),
            headers: vec![("Authorization".into(), "Bearer sk-test".into())],
            body: valid_body(),
            stream: None,
            timeout: None,
        };

        let resp = executor.execute(req).await.unwrap();
        assert!(resp.is_success());
        assert_eq!(resp.body["id"], "chatcmpl-test");
        assert_eq!(resp.stream.is_none(), true);
    }

    #[tokio::test]
    async fn returns_error_on_non_2xx() {
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/v1/chat/completions"))
            .respond_with(
                ResponseTemplate::new(401).set_body_json(serde_json::json!({
                    "error": {"message": "Invalid API key", "type": "authentication_error"}
                })),
            )
            .mount(&mock_server)
            .await;

        let executor = OpenAiExecutor::new(reqwest::Client::new());

        let req = ExecuteRequest {
            url: format!("{}/v1/chat/completions", mock_server.uri()),
            method: "POST".into(),
            headers: vec![],
            body: valid_body(),
            stream: None,
            timeout: None,
        };

        let resp = executor.execute(req).await.unwrap();
        assert!(!resp.is_success());
        assert_eq!(resp.status, 401);
    }

    #[tokio::test]
    async fn rejects_unsupported_method() {
        let executor = OpenAiExecutor::new(reqwest::Client::new());

        let req = ExecuteRequest {
            url: "http://localhost:1/nope".into(),
            method: "DELETE".into(),
            headers: vec![],
            body: serde_json::Value::Null,
            stream: None,
            timeout: None,
        };

        let err = executor.execute(req).await.unwrap_err();
        assert!(err.to_string().contains("unsupported method"));
    }
}
