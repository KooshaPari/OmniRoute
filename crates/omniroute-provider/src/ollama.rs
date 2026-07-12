//! Ollama provider adapter.
//!
//! Ollama speaks the OpenAI-compatible `/v1/chat/completions` wire format
//! but runs on `localhost:11434` by default and requires no API key.
//!
//! Credentials:
//!   - `Credentials::None` → no auth header (default localhost)
//!   - `Credentials::ApiKey { key }` → `Authorization: Bearer <key>`
//!   - `Credentials::Bearer { token }` → `Authorization: Bearer <token>`

use async_trait::async_trait;
use std::sync::Arc;

use omniroute_core::credentials::Credentials;
use omniroute_core::error::ProviderError;
use omniroute_core::provider::Context;
use omniroute_core::model::Model;
use omniroute_core::types::{
    ChatRequest, ChatResponse, StreamChunk, StreamChoice,
};
use omniroute_core::Provider as ProviderTrait;

/// HTTP client used for the Ollama provider.
type HttpClient = reqwest::Client;

/// Default base URL for Ollama.
const DEFAULT_BASE: &str = "http://localhost:11434";

/// Default model served by Ollama when none specified.
const DEFAULT_MODEL: &str = "llama3.2";

/// The Ollama provider adapter.
///
/// Ollama is an OpenAI-compatible localhost API server. It typically runs
/// on port 11434 and requires no authentication for local access.
///
/// Wire format: identical to OpenAI `/v1/chat/completions`. The `model`
/// field in the request selects which locally-pulled model to use.
#[derive(Debug)]
pub struct OllamaProvider {
    id: String,
    base_url: String,
    default_model: String,
    http: Arc<HttpClient>,
}

impl OllamaProvider {
    /// Create a new Ollama provider adapter.
    ///
    /// `base_url` defaults to `http://localhost:11434`.
    /// `default_model` defaults to `llama3.2`.
    /// `credentials` is stored but only used when non-`None` (Bearer auth).
    pub fn new(id: &str, base_url: Option<&str>, default_model: Option<&str>) -> Arc<Self> {
        let base = base_url
            .filter(|s| !s.is_empty())
            .unwrap_or(DEFAULT_BASE)
            .trim_end_matches('/');
        let model = default_model
            .filter(|s| !s.is_empty())
            .unwrap_or(DEFAULT_MODEL);

        Arc::new(Self {
            id: id.to_string(),
            base_url: base.to_string(),
            default_model: model.to_string(),
            http: Arc::new(
                HttpClient::builder()
                    .timeout(std::time::Duration::from_secs(120))
                    .build()
                    .expect("reqwest::Client::build"),
            ),
        })
    }

    /// Build the base request with shared headers and auth.
    fn build_request(
        &self,
        method: reqwest::Method,
        path: &str,
        ctx: &Context,
    ) -> Result<reqwest::RequestBuilder, ProviderError> {
        let url = format!("{}{}", self.base_url, path);
        let mut builder = self.http.request(method, &url);

        match &ctx.credentials {
            Credentials::None => { /* skip — ollama localhost default */ }
            Credentials::ApiKey { key } => {
                builder = builder.header("Authorization", format!("Bearer {}", key));
            }
            Credentials::Bearer { token } => {
                builder = builder.header("Authorization", format!("Bearer {}", token));
            }
        }

        Ok(builder)
    }

    /// Dispatch a chat completion request (non-streaming).
    async fn dispatch(
        &self,
        ctx: &Context,
        req: ChatRequest,
    ) -> Result<ChatResponse, ProviderError> {
        let builder = self.build_request(reqwest::Method::POST, "/v1/chat/completions", ctx)?;
        let r = builder.json(&req).send().await.map_err(|e| {
            ProviderError::Unavailable {
                provider: self.id.clone(),
                reason: e.to_string(),
            }
        })?;

        let status = r.status();
        let body = r.text().await.unwrap_or_default();

        if !status.is_success() {
            return Err(match status.as_u16() {
                429 => ProviderError::RateLimited {
                    provider: self.id.clone(),
                    retry_after: None,
                },
                401 | 403 => ProviderError::AuthFailed {
                    provider: self.id.clone(),
                    message: body.clone(),
                },
                _ => ProviderError::UpstreamError {
                    provider: self.id.clone(),
                    status: status.as_u16(),
                    body,
                },
            });
        }

        serde_json::from_str::<ChatResponse>(&body).map_err(|e| ProviderError::UpstreamError {
            provider: self.id.clone(),
            status: status.as_u16(),
            body: e.to_string(),
        })
    }

    /// Dispatch a streaming chat completion request.
    async fn dispatch_stream(
        &self,
        ctx: &Context,
        req: ChatRequest,
        tx: tokio::sync::mpsc::Sender<Result<StreamChunk, ProviderError>>,
    ) -> Result<(), ProviderError> {
        let builder = self.build_request(reqwest::Method::POST, "/v1/chat/completions", ctx)?;
        let response = builder
            .json(&req)
            .send()
            .await
            .map_err(|e| ProviderError::Unavailable {
                provider: self.id.clone(),
                reason: e.to_string(),
            })?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(match status.as_u16() {
                429 => ProviderError::RateLimited {
                    provider: self.id.clone(),
                    retry_after: None,
                },
                401 | 403 => ProviderError::AuthFailed {
                    provider: self.id.clone(),
                    message: body.clone(),
                },
                _ => ProviderError::UpstreamError {
                    provider: self.id.clone(),
                    status: status.as_u16(),
                    body,
                },
            });
        }

        let stream = response.bytes_stream();
        let id = self.id.clone();
        tokio::spawn(async move {
            process_stream(id, stream, tx).await;
        });

        Ok(())
    }
}

/// Process a streaming SSE response from Ollama.
///
/// Reads `data: {...}` lines, parses them into `StreamChunk`, and sends
/// them through the channel. Sends a terminal `StreamChunk { done: true }`
/// when the stream ends or errors.
async fn process_stream(
    provider_id: String,
    mut stream: impl futures_util::Stream<Item = Result<reqwest::Bytes, reqwest::Error>> + Unpin,
    tx: tokio::sync::mpsc::Sender<Result<StreamChunk, ProviderError>>,
) {
    use futures_util::StreamExt;

    let mut accumulated = String::new();

    while let Some(item) = stream.next().await {
        match item {
            Ok(bytes) => {
                // Decode this chunk (lossy is fine for SSE JSON lines).
                let chunk_str = match std::str::from_utf8(&bytes) {
                    Ok(s) => s.to_string(),
                    Err(_) => continue,
                };
                accumulated.push_str(&chunk_str);

                // Process complete lines, holding back any partial trailing fragment.
                while let Some(idx) = accumulated.find('\n') {
                    let line: String = accumulated.drain(..=idx).collect();
                    let line = line.trim_end_matches(&['\r', '\n'][..]);

                    if line.is_empty() {
                        continue;
                    }
                    if line == "data: [DONE]" {
                        accumulated.clear();
                        let _ = tx
                            .send(Ok(StreamChunk {
                                done: true,
                                ..Default::default()
                            }))
                            .await;
                        return;
                    }
                    if let Some(json_str) = line.strip_prefix("data: ") {
                        if let Ok(chunk) =
                            serde_json::from_str::<ollama_stream::Chunk>(json_str)
                        {
                            if let Some(sc) = chunk.to_stream_chunk(&mut accumulated) {
                                if tx.send(Ok(sc)).await.is_err() {
                                    return;
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                let _ = tx
                    .send(Err(ProviderError::StreamError {
                        provider: provider_id,
                        message: e.to_string(),
                    }))
                    .await;
                return;
            }
        }
    }

    let _ = tx
        .send(Ok(StreamChunk {
            done: true,
            ..Default::default()
        }))
        .await;
}

// ─── Provider trait implementation ──────────────────────────────────────

#[async_trait]
impl ProviderTrait for OllamaProvider {
    fn id(&self) -> &str {
        &self.id
    }

    async fn models(&self, _ctx: &Context) -> Result<Vec<Model>, ProviderError> {
        // Ollama provides GET /api/tags but we use the OpenAI-compatible
        // surface. Return the default model.
        Ok(vec![Model {
            id: self.default_model.clone(),
            object: "model".into(),
            created: 0,
            owned_by: "ollama".into(),
            provider: Some(self.id.clone()),
        }])
    }

    async fn chat_completion(
        &self,
        ctx: &Context,
        req: ChatRequest,
    ) -> Result<ChatResponse, ProviderError> {
        let mut req = req;
        if req.model.is_empty() {
            req.model = self.default_model.clone();
        }
        self.dispatch(ctx, req).await
    }

    async fn chat_completion_stream(
        &self,
        ctx: &Context,
        req: ChatRequest,
        tx: tokio::sync::mpsc::Sender<Result<StreamChunk, ProviderError>>,
    ) -> Result<(), ProviderError> {
        let mut req = req;
        if req.model.is_empty() {
            req.model = self.default_model.clone();
        }
        self.dispatch_stream(ctx, req, tx).await
    }

    async fn ping(&self, ctx: &Context) -> Result<(), ProviderError> {
        let builder = self.build_request(reqwest::Method::GET, "/api/tags", ctx)?;
        let r = builder.send().await.map_err(|e| ProviderError::Unavailable {
            provider: self.id.clone(),
            reason: e.to_string(),
        })?;
        if r.status().is_success() {
            Ok(())
        } else {
            Err(ProviderError::Unavailable {
                provider: self.id.clone(),
                reason: format!("HTTP {}", r.status()),
            })
        }
    }
}

// ─── Ollama SSE chunk format ────────────────────────────────────────────

/// Mirrors the OpenAI-style SSE chunk that Ollama emits.
/// Ollama's streaming uses the same format as OpenAI:
///   `data: {"id":"...","object":"chat.completion.chunk","choices":[{"delta":{"content":"..."},"index":0}]}`
mod ollama_stream {
    use serde::Deserialize;

    #[derive(Debug, Deserialize)]
    pub(super) struct Chunk {
        pub id: Option<String>,
        pub object: Option<String>,
        pub created: Option<i64>,
        pub model: Option<String>,
        pub choices: Option<Vec<ChunkChoice>>,
    }

    #[derive(Debug, Deserialize)]
    pub(super) struct ChunkChoice {
        pub delta: ChunkDelta,
        pub index: Option<usize>,
        #[serde(rename = "finish_reason")]
        pub finish_reason: Option<String>,
    }

    #[derive(Debug, Deserialize)]
    pub(super) struct ChunkDelta {
        pub content: Option<String>,
        pub role: Option<String>,
        #[serde(rename = "tool_calls")]
        pub tool_calls: Option<Vec<serde_json::Value>>,
    }

    impl Chunk {
        /// Convert to an `omniroute_core::StreamChunk`.
        ///
        /// `accumulated` is used to build up the full `content` string for
        /// the terminal chunk, matching OpenAI-style SSE.
        pub fn to_stream_chunk(
            &self,
            accumulated: &mut String,
        ) -> Option<super::StreamChunk> {
            let choices = self.choices.as_ref()?;
            let mut out_choices = Vec::with_capacity(choices.len());

            for c in choices {
                let content = c.delta.content.clone().unwrap_or_default();
                accumulated.push_str(&content);

                let finish_reason = c.finish_reason.clone();
                let is_done = finish_reason.is_some();

                out_choices.push(super::StreamChoice {
                    index: c.index.unwrap_or(0),
                    delta: ChatMessage {
                        role: c.delta.role.clone().unwrap_or_else(|| "assistant".into()),
                        content: serde_json::Value::String(content),
                        name: None,
                        tool_call_id: None,
                        tool_calls: c.delta.tool_calls.clone().map(|tc| {
                            tc.into_iter()
                                .filter_map(|v| serde_json::from_value(v).ok())
                                .collect()
                        }),
                    },
                    finish_reason,
                });
            }

            Some(super::StreamChunk {
                id: self.id.clone().unwrap_or_default(),
                object: self.object.clone().unwrap_or_else(|| "chat.completion.chunk".into()),
                created: self.created.unwrap_or(0),
                model: self.model.clone().unwrap_or_default(),
                choices: out_choices,
                done: false,
                error: None,
            })
        }
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use std::io::{BufRead, Read};
use tokio_stream::wrappers::ReceiverStream as TokioRecvStream;
    use omniroute_core::types::*;
    use omniroute_core::error::ProviderError;
    use omniroute_core::types::ChatMessage;
    use omniroute_core::provider::Context;
    use omniroute_core::credentials::Credentials;

    #[tokio::test]
    async fn ollama_provider_creates_with_defaults() {
        let p = OllamaProvider::new("ollama-local", None, None);
        assert_eq!(p.id(), "ollama-local");
        assert_eq!(p.base_url, "http://localhost:11434");
        assert_eq!(p.default_model, "llama3.2");
    }

    #[tokio::test]
    async fn ollama_provider_accepts_custom_base_url() {
        let p = OllamaProvider::new("ollama-custom", Some("http://10.0.0.1:11434"), None);
        assert_eq!(p.base_url, "http://10.0.0.1:11434");
    }

    #[tokio::test]
    async fn ollama_provider_without_credentials_no_auth_header() {
        let ctx = Context::new(
            Credentials::None,
            "test-req".to_string(),
            "ollama-test".to_string(),
        );
        let p = OllamaProvider::new("ollama-test", None, None);
        let builder = p.build_request(reqwest::Method::GET, "/api/tags", &ctx);
        assert!(builder.is_ok(), "build_request should succeed with no credentials");
        // We can't inspect the headers of an unbuilt reqwest::RequestBuilder,
        // so we just verify no error was returned.
    }

    #[tokio::test]
    async fn ollama_ping_with_no_running_server_returns_error() {
        // Use a port that's unlikely to have Ollama running
        let p = OllamaProvider::new("ollama-offline", Some("http://127.0.0.1:19999"), None);
        let ctx = Context::new(
            Credentials::None,
            "ping-test".into(),
            "ollama-test".to_string(),
        );
        let result = p.ping(&ctx).await;
        assert!(result.is_err(), "Ping should fail when no server is running");
        match result {
            Err(ProviderError::Unavailable { .. }) => {} // expected
            Err(e) => panic!("Expected Unavailable error, got: {e}"),
            Ok(()) => panic!("Expected error, got Ok"),
        }
    }

    #[tokio::test]
    async fn chat_completion_with_no_server_returns_error() {
        let p = OllamaProvider::new("ollama-offline", Some("http://127.0.0.1:19998"), None);
        let ctx = Context::new(
            Credentials::None,
            "chat-test".into(),
            "ollama-test".to_string(),
        );
        let req = ChatRequest {
            model: "llama3.2".into(),
            messages: vec![ChatMessage {
                role: "user".into(),
                content: serde_json::Value::String("Hello".into()),
                name: None,
                tool_call_id: None,
                tool_calls: None,
            }],
            stream: Some(false),
            temperature: None,
            top_p: None,
            max_tokens: Some(10),
            stop: None,
            user: None,
            tools: None,
            tool_choice: None,
            metadata: None,
            request_id: "test-1".into(),
        };
        let result = p.chat_completion(&ctx, req).await;
        assert!(result.is_err(), "Chat should fail when no server is running");
    }

    #[tokio::test]
    async fn stream_returns_error_without_server() {
        let p = OllamaProvider::new("ollama-offline", Some("http://127.0.0.1:19997"), None);
        let ctx = Context::new(
            Credentials::None,
            "stream-test".into(),
            "ollama-test".to_string(),
        );
        let req = ChatRequest {
            model: "llama3.2".into(),
            messages: vec![ChatMessage {
                role: "user".into(),
                content: serde_json::Value::String("Hello".into()),
                name: None,
                tool_call_id: None,
                tool_calls: None,
            }],
            stream: Some(true),
            temperature: None,
            top_p: None,
            max_tokens: Some(10),
            stop: None,
            user: None,
            tools: None,
            tool_choice: None,
            metadata: None,
            request_id: "test-2".into(),
        };
        let (tx, _rx) = tokio::sync::mpsc::channel(64);
        let result = p.chat_completion_stream(&ctx, req, tx).await;
        assert!(result.is_err(), "Stream should fail when no server is running");
    }

    #[test]
    fn ollama_chunk_to_stream_chunk() {
        let json = r#"{"id":"chatcmpl-123","object":"chat.completion.chunk","created":1700000000,"model":"llama3.2","choices":[{"delta":{"content":" Hello"},"index":0,"finish_reason":null}]}"#;
        let chunk: ollama_stream::Chunk = serde_json::from_str(json).unwrap();
        let mut acc = String::new();
        let sc = chunk.to_stream_chunk(&mut acc);
        assert!(sc.is_some(), "Should produce a StreamChunk");
        let sc = sc.unwrap();
        assert_eq!(sc.id, "chatcmpl-123");
        assert!(!sc.choices.is_empty());
        assert_eq!(sc.choices[0].delta.content.as_str().unwrap_or(""), " Hello");
        assert_eq!(acc, " Hello");
    }

    #[test]
    fn ollama_chunk_with_finish_reason() {
        let json = r#"{"id":"chatcmpl-456","object":"chat.completion.chunk","created":1700000001,"model":"llama3.2","choices":[{"delta":{"content":" world"},"index":0,"finish_reason":"stop"}]}"#;
        let chunk: ollama_stream::Chunk = serde_json::from_str(json).unwrap();
        let mut acc = String::new();
        let sc = chunk.to_stream_chunk(&mut acc);
        assert!(sc.is_some());
        let sc = sc.unwrap();
        assert_eq!(sc.choices[0].finish_reason, Some("stop".to_string()));
        assert!(!sc.done, "done should be false (marker is from event: done, not finish_reason)");
    }
}
