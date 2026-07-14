//! OpenAI-compatible executor.
//!
//! Speaks the OpenAI Chat Completions wire format against any provider that
//! exposes a compatible `/v1/chat/completions` endpoint — including OpenAI
//! itself, Groq, OpenRouter, Together, Fireworks, Ollama (with
//! `OLLAMA_OPENAI_COMPAT=1`), LM Studio, vLLM, llama.cpp's server, and any
//! other gateway. The provider's `base_url` and `credential` come from
//! `ProviderHandle`.

use std::collections::BTreeMap;
use std::pin::Pin;
use std::time::Duration;

use async_stream::stream;
use async_trait::async_trait;
use futures::Stream;
use futures::StreamExt;
use reqwest::Client;
use serde_json::{json, Value};
use tracing::{debug, warn};

use omni_core::executor::{
    CompleteResponse, ExecutorCapabilities, ExecutorRequest, ExecutorResponse, StreamEvent,
    UsageMetrics,
};
use omni_core::provider::ProviderId;
use omni_core::Executor;

use crate::executors::map_reqwest_error;
use crate::ServerError;

/// Default model list advertised by an OpenAI-compat provider. The router
/// does not require these to be valid — the provider returns 404 for unknown
/// models. The list is just for `/v1/models` and routing.
const DEFAULT_MODELS: &[&str] = &[
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4.1",
    "gpt-4.1-mini",
    "o3",
    "o3-mini",
    "o4-mini",
    "claude-3-5-sonnet",
    "llama-3.3-70b",
];

/// OpenAI-compat executor. Stateless — the credential and base URL are passed
/// in `ExecutorRequest::headers` and `body` (the router fills them from the
/// chosen `ProviderHandle`).
#[derive(Debug, Default, Clone)]
pub struct OpenAiCompatExecutor {
    client: Client,
}

impl OpenAiCompatExecutor {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .connect_timeout(Duration::from_secs(10))
            .pool_idle_timeout(Duration::from_secs(90))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self { client }
    }

    /// Build the upstream URL for a given provider base URL.
    /// Strips a trailing `/` and `/v1` (case-insensitive) before appending `/v1/chat/completions`.
    fn chat_url(base_url: &str) -> String {
        let trimmed = base_url.trim_end_matches('/');
        let stripped = if trimmed.len() > 3 && trimmed.to_ascii_lowercase().ends_with("/v1") {
            &trimmed[..trimmed.len() - 3]
        } else {
            trimmed
        };
        format!("{}/v1/chat/completions", stripped)
    }
}

#[async_trait]
impl Executor for OpenAiCompatExecutor {
    fn provider_id(&self) -> ProviderId {
        ProviderId::default()
    }

    fn capabilities(&self) -> ExecutorCapabilities {
        ExecutorCapabilities {
            supports_streaming: true,
            supports_tools: true,
            supports_vision: true,
            supports_reasoning: true,
            supports_system_role: true,
        }
    }

    fn models(&self) -> &[String] {
        // Returned as &str slice via map; this is a const for ergonomics.
        // (We use Vec<String> -> &[String] through a thread_local.)
        thread_local! {
            static CACHE: Vec<String> = DEFAULT_MODELS.iter().map(|s| s.to_string()).collect();
        }
        CACHE.with(|v| {
            // SAFETY: leak the Vec to get a 'static slice; this is fine for a
            // constant list. Re-allocated only on first call.
            let leaked: &'static Vec<String> = Box::leak(Box::new(v.clone()));
            leaked.as_slice()
        })
    }

    async fn execute(&self, req: ExecutorRequest) -> omni_core::error::Result<ExecutorResponse> {
        // Extract the routing context. The router has stamped these into the
        // request `headers` map under `x-omni-base-url` and `x-omni-credential`.
        let base_url = req
            .headers
            .get("x-omni-base-url")
            .cloned()
            .unwrap_or_else(|| "https://api.openai.com".to_string());
        let credential = req
            .headers
            .get("x-omni-credential")
            .cloned()
            .unwrap_or_default();
        let org = req.headers.get("x-omni-org").cloned();
        let project = req.headers.get("x-omni-project").cloned();

        let url = Self::chat_url(&base_url);
        debug!(%url, model = %req.model, "openai-compat dispatch");

        let mut upstream = self
            .client
            .post(&url)
            .header("content-type", "application/json")
            .header("accept", if req.stream { "text/event-stream" } else { "application/json" })
            .timeout(req.timeout.unwrap_or(Duration::from_secs(120)));

        if !credential.is_empty() {
            upstream = upstream.bearer_auth(&credential);
        }
        if let Some(o) = &org {
            upstream = upstream.header("OpenAI-Organization", o);
        }
        if let Some(p) = &project {
            upstream = upstream.header("OpenAI-Project", p);
        }

        // Pass through any custom client headers (e.g. anthropic-beta, x-client).
        for (k, v) in &req.headers {
            if k.starts_with("x-omni-") {
                continue;
            }
            // Don't override auth or content-type.
            if k == "authorization" || k == "content-type" || k == "accept" {
                continue;
            }
            upstream = upstream.header(k, v);
        }

        let body = req.body.clone();
        let upstream = upstream.json(&body);

        if req.stream {
            let resp = upstream.send().await.map_err(map_reqwest_error)?;
            if !resp.status().is_success() {
                let status = resp.status();
                let text = resp.text().await.unwrap_or_default();
                return Err(omni_core::Error::with_kind(
                    omni_core::ErrorKind::UpstreamStatus(status.as_u16()),
                    format!("upstream {status}: {text}"),
                ));
            }
            let mut event_stream = resp.bytes_stream();
            let s = stream! {
                while let Some(chunk) = event_stream.next().await {
                    match chunk {
                        Ok(b) => {
                            // SSE chunks may be partial. Forward them as-is;
                            // the client (curl, OpenAI SDK) reassembles.
                            let data = String::from_utf8_lossy(&b).to_string();
                            yield Ok(StreamEvent {
                                data,
                                event: None,
                                terminal: false,
                            });
                        }
                        Err(e) => {
                            yield Err(omni_core::Error::with_kind(
                                omni_core::ErrorKind::UpstreamUnavailable,
                                format!("upstream stream: {e}"),
                            ));
                            break;
                        }
                    }
                }
                // Terminal marker.
                yield Ok(StreamEvent { data: "[DONE]".into(), event: None, terminal: true });
            };
            Ok(ExecutorResponse::Streaming(Box::pin(s)))
        } else {
            let resp = upstream.send().await.map_err(map_reqwest_error)?;
            let status = resp.status();
            let headers: BTreeMap<String, String> = resp
                .headers()
                .iter()
                .filter_map(|(k, v)| {
                    v.to_str().ok().map(|s| (k.to_string(), s.to_string()))
                })
                .collect();
            let body: Value = resp.json().await.map_err(map_reqwest_error)?;
            if !status.is_success() {
                let kind = omni_core::ErrorKind::UpstreamStatus(status.as_u16());
                return Err(omni_core::Error::with_kind(
                    kind,
                    format!("upstream {status}: {body}"),
                ));
            }
            let usage = body.get("usage").map(|u| UsageMetrics {
                prompt_tokens: u.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                completion_tokens: u.get("completion_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                total_tokens: u.get("total_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                cost_usd: None,
            });
            Ok(ExecutorResponse::Complete(CompleteResponse {
                status: status.as_u16(),
                headers,
                body,
                usage,
            }))
        }
    }
}

impl From<ServerError> for omni_core::Error {
    fn from(e: ServerError) -> Self {
        match e {
            ServerError::Unauthorized => omni_core::Error::with_kind(omni_core::ErrorKind::Unauthorized, e.to_string()),
            ServerError::Forbidden => omni_core::Error::with_kind(omni_core::ErrorKind::Forbidden, e.to_string()),
            ServerError::NotFound(_) => omni_core::Error::with_kind(omni_core::ErrorKind::NotFound, e.to_string()),
            ServerError::BadRequest(_) => omni_core::Error::with_kind(omni_core::ErrorKind::BadRequest, e.to_string()),
            ServerError::Upstream(_) => omni_core::Error::with_kind(omni_core::ErrorKind::UpstreamUnavailable, e.to_string()),
            _ => omni_core::Error::with_kind(omni_core::ErrorKind::Internal, e.to_string()),
        }
    }
}

#[allow(dead_code)]
fn _suppress_warning() {
    warn!("placeholder");
    let _ = json!({});
}
