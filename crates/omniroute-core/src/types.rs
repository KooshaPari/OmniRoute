//! Wire-compatible chat-completion types.
//!
//! These shapes mirror the Go native client
//! (`native-clients/omniroute-go/internal/provider/registry/provider.go`)
//! and the TypeScript control plane (`open-sse/types.d.ts`). Field names,
//! `serde` renames, and JSON tags must stay in sync.
//!
//! The `serde_json::Value` types on `content` and `tool_choice` accommodate
//! both OpenAI (string or array of parts) and Anthropic/Gemini variants.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

/// OpenAI-compatible chat completion request.
///
/// Mirrors Go `registry.ChatRequest` exactly (field names + JSON tags).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    /// Model ID (e.g. `gpt-4o`, `claude-3-5-sonnet-20241022`, `gemini-1.5-pro`).
    pub model: String,

    /// Conversation messages.
    pub messages: Vec<ChatMessage>,

    /// If `true`, the response is an SSE stream of `StreamChunk`s.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,

    /// Sampling temperature (0.0 – 2.0).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,

    /// Top-p nucleus sampling.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f64>,

    /// Maximum tokens to generate.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,

    /// Stop sequences.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop: Option<Vec<String>>,

    /// End-user identifier for abuse detection.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,

    /// Tool / function definitions.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<Tool>>,

    /// `"none"`, `"auto"`, or a specific tool choice object.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<serde_json::Value>,

    /// Arbitrary vendor-specific metadata.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,

    /// Not serialized — set by the proxy layer before dispatch.
    #[serde(skip)]
    pub request_id: String,
}

impl ChatRequest {
    /// Create a minimal request with just `model` and a single user message.
    pub fn new(model: impl Into<String>, user_message: impl Into<String>) -> Self {
        Self {
            model: model.into(),
            messages: vec![ChatMessage::user(user_message)],
            stream: None,
            temperature: None,
            top_p: None,
            max_tokens: None,
            stop: None,
            user: None,
            tools: None,
            tool_choice: None,
            metadata: None,
            request_id: String::new(),
        }
    }
}

/// A single message in a chat conversation.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ChatMessage {
    /// `"system"`, `"user"`, `"assistant"`, `"tool"`.
    pub role: String,

    /// Either a plain string or an array of content parts
    /// (e.g. `[{type: "text", text: "..."}, {type: "image_url", ...}]`).
    pub content: serde_json::Value,

    /// Optional participant name (for multi-user `/v1/chat/completions`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    /// For `"role": "tool"` messages: the `id` of the tool call this answers.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,

    /// For `"role": "assistant"` messages: any tool calls the model made.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
}

impl ChatMessage {
    /// Build a `"user"` message with a plain-text content body.
    pub fn user(text: impl Into<String>) -> Self {
        Self {
            role: "user".into(),
            content: serde_json::Value::String(text.into()),
            name: None,
            tool_call_id: None,
            tool_calls: None,
        }
    }

    /// Build a `"system"` message with a plain-text content body.
    pub fn system(text: impl Into<String>) -> Self {
        Self {
            role: "system".into(),
            content: serde_json::Value::String(text.into()),
            name: None,
            tool_call_id: None,
            tool_calls: None,
        }
    }

    /// Build an `"assistant"` message with a plain-text content body.
    pub fn assistant(text: impl Into<String>) -> Self {
        Self {
            role: "assistant".into(),
            content: serde_json::Value::String(text.into()),
            name: None,
            tool_call_id: None,
            tool_calls: None,
        }
    }
}

/// Tool / function definition in a [`ChatRequest`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tool {
    /// Always `"function"` (reserved for future tool types).
    #[serde(rename = "type")]
    pub type_: String,
    /// Function definition.
    pub function: ToolFunction,
}

/// Function specification inside a [`Tool`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolFunction {
    /// Function name (e.g. `"get_weather"`).
    pub name: String,
    /// Human-readable description.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// JSON Schema for the function arguments.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parameters: Option<serde_json::Value>,
}

/// A tool call emitted by the assistant in a non-streaming response.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ToolCall {
    /// Unique call ID (used to address the `"tool"` response).
    pub id: String,
    /// Always `"function"` (reserved for future tool types).
    #[serde(rename = "type")]
    pub type_: String,
    /// Function invocation details.
    pub function: ToolCallFunction,
}

/// Function invocation payload for a [`ToolCall`].
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ToolCallFunction {
    /// Function name (e.g. `"get_weather"`).
    pub name: String,
    /// JSON-encoded argument object as a string.
    pub arguments: String,
}

/// Non-streaming chat completion response.
///
/// Mirrors Go `registry.ChatResponse` exactly.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResponse {
    /// Response ID (e.g. `"chatcmpl-abc123"`).
    pub id: String,
    /// Always `"chat.completion"` for non-streaming responses.
    pub object: String,
    /// Unix timestamp of creation.
    pub created: i64,
    /// Model ID actually used (may differ from the request if a fallback fired).
    pub model: String,
    /// Completion choices (usually 1; multiple when `n > 1`).
    pub choices: Vec<Choice>,
    /// Token usage accounting.
    pub usage: Usage,
    /// Set by the runtime — which provider served this response.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_id: Option<String>,
}

/// One completion choice inside a [`ChatResponse`].
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Choice {
    /// Index in the `choices` array (0-based).
    pub index: usize,
    /// The assistant message.
    pub message: ChatMessage,
    /// Why the model stopped (`"stop"`, `"length"`, `"tool_calls"`, …).
    pub finish_reason: String,
}

/// Token accounting for a [`ChatResponse`].
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Usage {
    /// Tokens consumed by the prompt.
    pub prompt_tokens: u32,
    /// Tokens generated in the completion.
    pub completion_tokens: u32,
    /// `prompt_tokens + completion_tokens`.
    pub total_tokens: u32,
}

/// One SSE chunk emitted by the Rust data plane to the client.
///
/// For streaming, the runtime emits a sequence of `StreamChunk`s with
/// `done: false`, then one with `done: true`, then closes the SSE channel.
/// The `done: true` chunk is encoded as `data: [DONE]\n\n`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StreamChunk {
    /// Response ID (matches the first non-`done` chunk).
    pub id: String,
    /// Always `"chat.completion.chunk"`.
    pub object: String,
    /// Unix timestamp of creation.
    pub created: i64,
    /// Model ID actually used.
    pub model: String,
    /// Per-choice deltas.
    pub choices: Vec<StreamChoice>,
    /// Terminal sentinel — encoded as `data: [DONE]` rather than a chunk field.
    #[serde(skip)]
    pub done: bool,
    /// Error payload — replaces `choices` on mid-stream failures.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ApiError>,
}

impl StreamChunk {
    /// Build a new chunk with one empty delta (used as a stream opener).
    pub fn new(
        id: impl Into<String>,
        model: impl Into<String>,
        created: i64,
    ) -> Self {
        Self {
            id: id.into(),
            object: "chat.completion.chunk".into(),
            created,
            model: model.into(),
            choices: Vec::new(),
            done: false,
            error: None,
        }
    }

    /// Mark this chunk as the terminal `[DONE]` sentinel.
    pub fn with_done(mut self) -> Self {
        self.done = true;
        self
    }

    /// Attach an error payload (mid-stream failure).
    pub fn with_error(mut self, err: ApiError) -> Self {
        self.error = Some(err);
        self
    }

    /// Append a delta choice (indexed by `index`).
    pub fn push_choice(mut self, index: usize, delta: ChatMessage) -> Self {
        self.choices.push(StreamChoice {
            index,
            delta,
            finish_reason: None,
        });
        self
    }
}

/// One streaming delta inside a [`StreamChunk`].
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StreamChoice {
    /// Index in the `choices` array (0-based).
    pub index: usize,
    /// Incremental content delta (role set on first chunk, content grows).
    pub delta: ChatMessage,
    /// Set on the final chunk: `"stop"`, `"length"`, `"tool_calls"`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<String>,
}

/// Error body emitted in a [`StreamChunk`] (mid-stream) or non-streaming response.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ApiError {
    /// Human-readable error message.
    pub message: String,
    /// Machine-readable error type (e.g. `"rate_limit_error"`).
    #[serde(skip_serializing_if = "Option::is_none", rename = "type")]
    pub r#type: Option<String>,
    /// Provider-specific error code (e.g. `"context_length_exceeded"`).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub code: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chat_request_new_minimal() {
        let req = ChatRequest::new("gpt-4o", "Hello");
        assert_eq!(req.model, "gpt-4o");
        assert_eq!(req.messages.len(), 1);
        assert_eq!(req.messages[0].role, "user");
    }

    #[test]
    fn chat_request_roundtrip_json() {
        let req = ChatRequest::new("claude-3-5-sonnet-20241022", "hi")
            .with_temperature(0.5)
            .with_max_tokens(256);
        let s = serde_json::to_string(&req).unwrap();
        let de: ChatRequest = serde_json::from_str(&s).unwrap();
        assert_eq!(de.model, req.model);
        assert_eq!(de.temperature, Some(0.5));
        assert_eq!(de.max_tokens, Some(256));
        // request_id is skip — should not be serialized.
        assert!(!s.contains("request_id"));
    }

    #[test]
    fn stream_chunk_done_uses_dedicated_sentinel() {
        let chunk = StreamChunk::new("x", "y", 0).with_done();
        let s = serde_json::to_string(&chunk).unwrap();
        assert!(!s.contains("\"done\":true"));
        // done is skipped in serialization; runtime layer translates to `data: [DONE]\n\n`
        assert!(!s.contains("done"));
    }

    #[test]
    fn stream_chunk_carries_error() {
        let chunk = StreamChunk::new("x", "y", 0).with_error(ApiError {
            message: "boom".into(),
            r#type: Some("internal".into()),
            code: None,
        });
        let s = serde_json::to_string(&chunk).unwrap();
        assert!(s.contains("\"message\":\"boom\""));
        assert!(s.contains("\"type\":\"internal\""));
    }
}

// Convenience extensions kept inline to avoid an extra file for ~10 lines.
impl ChatRequest {
    /// Builder: set `temperature`.
    pub fn with_temperature(mut self, t: f64) -> Self {
        self.temperature = Some(t);
        self
    }
    /// Builder: set `max_tokens`.
    pub fn with_max_tokens(mut self, n: u32) -> Self {
        self.max_tokens = Some(n);
        self
    }
    /// Builder: enable streaming.
    pub fn with_stream(mut self, b: bool) -> Self {
        self.stream = Some(b);
        self
    }
    /// Builder: assign `request_id` (not serialized).
    pub fn with_request_id(mut self, id: impl Into<String>) -> Self {
        self.request_id = id.into();
        self
    }
    /// Builder: attach a system message at the front.
    pub fn with_system(mut self, text: impl Into<String>) -> Self {
        self.messages.insert(0, ChatMessage::system(text));
        self
    }
}