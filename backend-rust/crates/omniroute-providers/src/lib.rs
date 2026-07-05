//! OmniRoute provider adapters.
//!
//! v1: OpenAI Chat Completions (streaming + non-streaming). Anthropic, Gemini,
//! Cohere, Bedrock, and Responses follow the same trait surface and land in
//! subsequent PRs. The registry is a `Vec<Arc<dyn Provider>>` keyed by
//! `ProviderId` for O(1) lookup; a sharded `DashMap` upgrade is reserved for
//! >100 providers.

use std::collections::HashMap;
use std::sync::Arc;

use async_trait::async_trait;
use bytes::Bytes;
use futures::StreamExt;
use omniroute_core::{
    error::{Error, Result},
    format::Format,
    model::ModelId,
    provider::{
        Provider, ProviderCallContext, ProviderMetadata, StreamEvent, StreamEventSource,
    },
    request::{
        ChatMessage, ChatRequest, ChatRole, EmbeddingRequest, ImageRequest, MessageContent,
        ToolCall, Usage,
    },
    response::{
        ChatChoice, ChatResponse, EmbeddingResponse, FinishReason, ImageResponse,
    },
};
use reqwest::Client;
use serde::{Deserialize, Serialize};

/// Build the canonical registry of providers. v1: just OpenAI.
pub fn default_registry() -> Vec<Arc<dyn Provider>> {
    vec![Arc::new(OpenAiProvider::new())]
}

/// OpenAI Chat Completions provider.
///
/// Translates a canonical [`ChatRequest`] into the OpenAI wire format, calls
/// `POST /v1/chat/completions`, and returns either a [`ChatResponse`]
/// (non-streaming) or a [`StreamEventSource`] of [`StreamEvent`]s.
pub struct OpenAiProvider {
    client: Client,
    base_url: String,
    metadata: ProviderMetadata,
}

impl OpenAiProvider {
    pub fn new() -> Self {
        let client = Client::builder()
            .pool_max_idle_per_host(8)
            .tcp_keepalive(std::time::Duration::from_secs(60))
            .build()
            .expect("reqwest client build");
        let base_url = std::env::var("OMNIROUTE_OPENAI_BASE_URL")
            .unwrap_or_else(|_| "https://api.openai.com".to_string());
        let mut overrides = HashMap::new();
        // Map a few well-known aliases; the rest fall through to the model id.
        overrides.insert(ModelId::new("gpt-4o"), "gpt-4o-2024-08-06".to_string());
        overrides.insert(ModelId::new("gpt-4o-mini"), "gpt-4o-mini-2024-07-18".to_string());
        overrides.insert(ModelId::new("gpt-4-turbo"), "gpt-4-turbo-2024-04-09".to_string());
        let metadata = ProviderMetadata {
            id: omniroute_core::provider::ProviderId::new("openai"),
            display_name: "OpenAI".to_string(),
            format: Format::Openai,
            base_url: base_url.clone(),
            requires_api_key: true,
            supports_oauth: false,
            supports_streaming: true,
            supports_tools: true,
            supports_vision: true,
            supports_audio: false,
            supports_images: false,
            supports_embeddings: true,
            request_timeout_ms: 60_000,
            auth_header: None,
            auth_scheme: Some("Bearer".to_string()),
            anthropic_sse: false,
            model_overrides: overrides,
            custom_headers: HashMap::new(),
        };
        Self { client, base_url, metadata }
    }

    pub fn with_base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = url.into();
        self.metadata.base_url = self.base_url.clone();
        self
    }
}

impl Default for OpenAiProvider {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Provider for OpenAiProvider {
    fn metadata(&self) -> &ProviderMetadata {
        &self.metadata
    }

    async fn chat(
        &self,
        ctx: &ProviderCallContext,
        req: &ChatRequest,
    ) -> Result<ChatResponse> {
        let url = format!("{}/v1/chat/completions", self.base_url);
        let body = render_openai_body(req, false);
        let resp = self
            .client
            .post(&url)
            .bearer_auth(&ctx.credential)
            .header("x-request-id", ctx.request_id.to_string())
            .json(&body)
            .send()
            .await
            .map_err(|e| Error::Upstream { provider: "openai".into(), status: None, message: format!("send failed: {e}") })?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(Error::Upstream { provider: "openai".into(), status: Some(status.as_u16()), message: format!("status {status}: {text}") });
        }
        let parsed: OpenAiChatResponse = resp
            .json()
            .await
            .map_err(|e| Error::Upstream { provider: "openai".into(), status: None, message: format!("decode failed: {e}") })?;
        Ok(openai_to_canonical(parsed))
    }

    async fn chat_stream(
        &self,
        ctx: &ProviderCallContext,
        req: &ChatRequest,
    ) -> Result<StreamEventSource> {
        let url = format!("{}/v1/chat/completions", self.base_url);
        let body = render_openai_body(req, true);
        let resp = self
            .client
            .post(&url)
            .bearer_auth(&ctx.credential)
            .header("x-request-id", ctx.request_id.to_string())
            .json(&body)
            .send()
            .await
            .map_err(|e| Error::Upstream { provider: "openai".into(), status: None, message: format!("send failed: {e}") })?;

        let status = resp.status();
        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(Error::Upstream { provider: "openai".into(), status: Some(status.as_u16()), message: format!("status {status}: {text}") });
        }

        // Map the byte stream to a StreamEvent stream.
        // Both branches of the flat_map return Pin<Box<dyn Stream<Item = Result<StreamEvent>> + Send>>
        // so the Either<...> inner streams share an Item type.
        let byte_stream = resp.bytes_stream();
        let s = byte_stream
            .map(|item| -> Result<Vec<StreamEvent>> {
                match item {
                    Ok(bytes) => parse_sse_bytes(&bytes),
                    Err(e) => Err(Error::Upstream { provider: "openai".into(), status: None, message: format!("stream: {e}") }),
                }
            })
            .flat_map(|res| -> std::pin::Pin<Box<dyn futures::Stream<Item = Result<StreamEvent>> + Send>> {
                match res {
                    Ok(events) => Box::pin(futures::stream::iter(events.into_iter().map(Ok))),
                    Err(e) => Box::pin(futures::stream::once(async move { Err(e) })),
                }
            });
        Ok(Box::pin(s))
    }

    async fn embed(
        &self,
        _ctx: &ProviderCallContext,
        _req: &EmbeddingRequest,
    ) -> Result<EmbeddingResponse> {
        Err(Error::Upstream { provider: "openai".into(), status: None, message: "embed not yet ported (PR-2)".into() })
    }

    async fn image(
        &self,
        _ctx: &ProviderCallContext,
        _req: &ImageRequest,
    ) -> Result<ImageResponse> {
        Err(Error::Upstream { provider: "openai".into(), status: None, message: "image not yet ported (PR-3)".into() })
    }
}

// ─── Wire format ───────────────────────────────────────────────────────────

fn render_openai_body(req: &ChatRequest, stream: bool) -> serde_json::Value {
    let model = req.model.as_str().to_string();
    let messages: Vec<serde_json::Value> = req
        .messages
        .iter()
        .map(chat_message_to_openai)
        .collect();
    let mut body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": stream,
    });
    if let Some(t) = req.params.temperature {
        body["temperature"] = serde_json::json!(t);
    }
    if let Some(tp) = req.params.top_p {
        body["top_p"] = serde_json::json!(tp);
    }
    if let Some(m) = req.params.max_tokens {
        body["max_tokens"] = serde_json::json!(m);
    }
    if let Some(tools) = &req.tools {
        body["tools"] = serde_json::json!(tools);
    }
    body
}

fn chat_message_to_openai(m: &ChatMessage) -> serde_json::Value {
    let role = match m.role {
        ChatRole::System => "system",
        ChatRole::User => "user",
        ChatRole::Assistant => "assistant",
        ChatRole::Tool => "tool",
        ChatRole::Function => "function",
    };
    let mut obj = serde_json::json!({ "role": role });
    if let Some(content) = &m.content {
        obj["content"] = match content {
            MessageContent::Text(s) => serde_json::json!(s),
            MessageContent::Parts(parts) => serde_json::json!(parts),
        };
    }
    if let Some(tc) = &m.tool_calls {
        obj["tool_calls"] = serde_json::json!(tc);
    }
    if let Some(id) = &m.tool_call_id {
        obj["tool_call_id"] = serde_json::json!(id);
    }
    if let Some(name) = &m.name {
        obj["name"] = serde_json::json!(name);
    }
    obj
}

#[derive(Debug, Deserialize, Serialize)]
struct OpenAiChatResponse {
    id: String,
    object: String,
    created: i64,
    model: String,
    choices: Vec<OpenAiChoice>,
    #[serde(default)]
    usage: Option<OpenAiUsage>,
}

#[derive(Debug, Deserialize, Serialize)]
struct OpenAiChoice {
    index: i32,
    message: OpenAiMessage,
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
struct OpenAiMessage {
    role: String,
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    tool_calls: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Deserialize, Serialize)]
struct OpenAiUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

fn openai_to_canonical(r: OpenAiChatResponse) -> ChatResponse {
    let choices = r
        .choices
        .into_iter()
        .map(|c| {
            let role = match c.message.role.as_str() {
                "system" => ChatRole::System,
                "user" => ChatRole::User,
                "tool" => ChatRole::Tool,
                "function" => ChatRole::Function,
                _ => ChatRole::Assistant,
            };
            let content = c
                .message
                .content
                .map(MessageContent::Text)
                .unwrap_or(MessageContent::Text(String::new()));
            let finish_reason = c.finish_reason.as_deref().and_then(parse_finish_reason);
            ChatChoice {
                index: c.index as u32,
                message: ChatMessage {
                    role,
                    content: Some(content),
                    tool_calls: c.message.tool_calls.and_then(|arr| {
                        arr.into_iter()
                            .map(|v| serde_json::from_value::<ToolCall>(v).map_err(Error::from))
                            .collect::<Result<Vec<_>>>()
                            .ok()
                    }),
                    tool_call_id: None,
                    name: None,
                },
                finish_reason,
                logprobs: None,
            }
        })
        .collect();
    let usage = r
        .usage
        .map(|u| Usage {
            prompt_tokens: u.prompt_tokens,
            completion_tokens: u.completion_tokens,
            total_tokens: u.total_tokens,
            reasoning_tokens: None,
            cached_tokens: None,
        })
        .unwrap_or_default();
    ChatResponse {
        id: r.id,
        object: r.object,
        created: r.created,
        model: ModelId::new(r.model),
        choices,
        usage,
        served_by: None,
        served_format: None,
        system_fingerprint: None,
    }
}

fn parse_finish_reason(s: &str) -> Option<FinishReason> {
    match s {
        "stop" => Some(FinishReason::Stop),
        "length" => Some(FinishReason::Length),
        "tool_calls" => Some(FinishReason::ToolCalls),
        "content_filter" => Some(FinishReason::ContentFilter),
        _ => Some(FinishReason::Other),
    }
}

// ─── SSE byte chunk parser ─────────────────────────────────────────────────

/// Parse a buffer of `data: {...}\n\n` lines into a list of `StreamEvent`s.
/// Tolerant of partial chunks: incomplete final frames are returned as `None`
/// (and the caller should re-feed the trailing bytes on the next read).
fn parse_sse_bytes(buf: &Bytes) -> Result<Vec<StreamEvent>> {
    let text = match std::str::from_utf8(buf) {
        Ok(t) => t,
        Err(_) => return Ok(Vec::new()),
    };
    let mut out = Vec::new();
    for line in text.split('\n') {
        let line = line.trim_end_matches('\r');
        if line.is_empty() {
            continue;
        }
        let payload = match line.strip_prefix("data: ") {
            Some(p) => p,
            None => continue,
        };
        if payload.trim() == "[DONE]" {
            out.push(StreamEvent::Done);
            continue;
        }
        let chunk: OpenAiStreamChunk = match serde_json::from_str(payload) {
            Ok(c) => c,
            Err(_) => continue,
        };
        for choice in chunk.choices {
            if let Some(content) = choice.delta.content {
                if !content.is_empty() {
                    out.push(StreamEvent::Content(content));
                }
            }
            if let Some(reasoning) = choice.delta.reasoning {
                if !reasoning.is_empty() {
                    out.push(StreamEvent::Reasoning(reasoning));
                }
            }
            if choice.finish_reason.is_some() {
                // The wire-level done signal.
            }
        }
        if let Some(u) = chunk.usage {
            out.push(StreamEvent::Usage(Usage {
                prompt_tokens: u.prompt_tokens,
                completion_tokens: u.completion_tokens,
                total_tokens: u.total_tokens,
                reasoning_tokens: u.reasoning_tokens,
                cached_tokens: u.cached_tokens,
            }));
        }
    }
    Ok(out)
}

#[derive(Debug, Deserialize, Serialize)]
struct OpenAiStreamChunk {
    #[serde(default)]
    choices: Vec<OpenAiStreamChoice>,
    #[serde(default)]
    usage: Option<OpenAiUsageExt>,
}

#[derive(Debug, Deserialize, Serialize)]
struct OpenAiStreamChoice {
    delta: OpenAiStreamDelta,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Default)]
struct OpenAiStreamDelta {
    #[serde(default)]
    content: Option<String>,
    #[serde(default)]
    reasoning: Option<String>,
    #[serde(default)]
    role: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
struct OpenAiUsageExt {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
    #[serde(default)]
    reasoning_tokens: Option<u32>,
    #[serde(default)]
    cached_tokens: Option<u32>,
}

// ─── tests ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use omniroute_core::request::{ChatRequest, GenerationParams};

    fn fixture() -> ChatRequest {
        ChatRequest {
            model: ModelId::new("gpt-4o-mini"),
            messages: vec![ChatMessage {
                role: ChatRole::User,
                content: Some(MessageContent::Text("hello".to_string())),
                tool_calls: None,
                tool_call_id: None,
                name: None,
            }],
            stream: Some(false),
            tools: None,
            tool_choice: None,
            response_format: None,
            params: GenerationParams {
                temperature: Some(0.5),
                max_tokens: Some(64),
                top_p: None,
                ..Default::default()
            },
            target_format: None,
            combo_id: None,
        }
    }

    #[test]
    fn renders_openai_body_minimal() {
        let body = render_openai_body(&fixture(), false);
        assert_eq!(body["model"], "gpt-4o-mini");
        assert_eq!(body["stream"], false);
        assert_eq!(body["temperature"], 0.5);
        assert_eq!(body["max_tokens"], 64);
        assert!(body["messages"].is_array());
        assert_eq!(body["messages"][0]["role"], "user");
        assert_eq!(body["messages"][0]["content"], "hello");
    }

    #[test]
    fn renders_openai_body_streaming() {
        let body = render_openai_body(&fixture(), true);
        assert_eq!(body["stream"], true);
    }

    #[test]
    fn registry_includes_openai() {
        let reg = default_registry();
        assert_eq!(reg.len(), 1);
        assert_eq!(reg[0].metadata().id.as_str(), "openai");
        assert_eq!(reg[0].metadata().format, Format::Openai);
    }

    #[test]
    fn decode_canonical_response() {
        let raw = r#"{
            "id": "chatcmpl-1",
            "object": "chat.completion",
            "created": 1700000000,
            "model": "gpt-4o-mini",
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": "hi"},
                "finish_reason": "stop"
            }],
            "usage": {"prompt_tokens": 5, "completion_tokens": 3, "total_tokens": 8}
        }"#;
        let parsed: OpenAiChatResponse = serde_json::from_str(raw).unwrap();
        let canon = openai_to_canonical(parsed);
        assert_eq!(canon.id, "chatcmpl-1");
        assert_eq!(canon.choices.len(), 1);
        assert_eq!(canon.choices[0].message.content.as_ref().unwrap().text(), Some("hi"));
        assert_eq!(canon.usage.total_tokens, 8);
    }

    #[test]
    fn parse_sse_content_chunks() {
        let buf = Bytes::from_static(b"data: {\"choices\":[{\"delta\":{\"content\":\"hel\"}}]}\n\ndata: {\"choices\":[{\"delta\":{\"content\":\"lo\"}}]}\n\ndata: [DONE]\n\n");
        let events = parse_sse_bytes(&buf).unwrap();
        let content: Vec<String> = events
            .iter()
            .filter_map(|e| match e {
                StreamEvent::Content(s) => Some(s.clone()),
                _ => None,
            })
            .collect();
        assert_eq!(content, vec!["hel", "lo"]);
        assert!(matches!(events.last(), Some(StreamEvent::Done)));
    }
}
