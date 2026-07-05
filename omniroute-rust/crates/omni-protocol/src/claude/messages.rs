//! `POST /v1/messages` request/response shapes.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use super::common::{ClaudeUsage, SystemPrompt, ThinkingConfig};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MessagesRequest {
    pub model: String,
    pub messages: Vec<ClaudeMessage>,
    pub max_tokens: u32,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub system: Option<SystemPrompt>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top_k: Option<u32>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stop_sequences: Option<Vec<String>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<ClaudeTool>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<ClaudeToolChoice>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thinking: Option<ThinkingConfig>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<ClaudeMetadata>,

    #[serde(default)]
    pub stream: bool,

    /// Provider-specific passthrough.
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ClaudeMessage {
    pub role: ClaudeRole,
    pub content: ClaudeContent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ClaudeRole {
    User,
    Assistant,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ClaudeContent {
    Text(String),
    Blocks(Vec<ContentBlock>),
}

/// Tagged union of all Anthropic content block types.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    Text { text: String, cache_control: Option<super::common::CacheControl> },
    Image { source: ImageSource },
    Document { source: ImageSource, cache_control: Option<super::common::CacheControl> },
    ToolUse { id: String, name: String, input: serde_json::Value, cache_control: Option<super::common::CacheControl> },
    ToolResult { tool_use_id: String, content: ToolResultContent, is_error: Option<bool>, cache_control: Option<super::common::CacheControl> },
    Thinking { thinking: String, signature: String, cache_control: Option<super::common::CacheControl> },
    RedactedThinking { data: String, cache_control: Option<super::common::CacheControl> },
    ServerToolUse { id: String, name: String, input: serde_json::Value, cache_control: Option<super::common::CacheControl> },
    WebSearchToolResult { tool_use_id: String, content: serde_json::Value, cache_control: Option<super::common::CacheControl> },
    /// Forward-compat for new block types Anthropic adds.
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ImageSource {
    Base64 { media_type: String, data: String },
    Url { url: String },
    File { file_id: String },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ToolResultContent {
    Text(String),
    Blocks(Vec<ContentBlock>),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ClaudeTool {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub input_schema: serde_json::Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_control: Option<super::common::CacheControl>,
    /// Server-side tools: web_search, web_fetch, code_execution, ...
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub type_: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClaudeToolChoice {
    Auto,
    Any,
    Tool { name: String },
    None,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ClaudeMetadata {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(flatten, default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

/// Non-streaming response.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MessagesResponse {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String, // "message"
    pub role: ClaudeRole,
    pub content: MessagesResponseContent,
    pub model: String,
    pub stop_reason: Option<ClaudeStopReason>,
    pub stop_sequence: Option<String>,
    pub usage: ClaudeUsage,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessagesResponseContent {
    /// Anthropic returns content as a list of blocks. We accept either a
    /// single string (some forks) or the standard list.
    Text(String),
    Blocks(Vec<ContentBlock>),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ClaudeStopReason {
    EndTurn,
    MaxTokens,
    StopSequence,
    ToolUse,
    Refusal,
    PauseTurn,
    Other,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn messages_request_minimal() {
        let r = MessagesRequest {
            model: "claude-sonnet-4-5".into(),
            messages: vec![ClaudeMessage {
                role: ClaudeRole::User,
                content: ClaudeContent::Text("hi".into()),
            }],
            max_tokens: 1024,
            system: None,
            temperature: None,
            top_p: None,
            top_k: None,
            stop_sequences: None,
            tools: None,
            tool_choice: None,
            thinking: None,
            metadata: None,
            stream: false,
            extra: IndexMap::new(),
        };
        let j = serde_json::to_string(&r).unwrap();
        let back: MessagesRequest = serde_json::from_str(&j).unwrap();
        assert_eq!(r, back);
    }

    #[test]
    fn content_block_text_with_cache() {
        let b = ContentBlock::Text {
            text: "ctx".into(),
            cache_control: Some(super::super::common::CacheControl::Ephemeral { ttl: None }),
        };
        let j = serde_json::to_string(&b).unwrap();
        assert!(j.contains("\"type\":\"text\""));
        assert!(j.contains("\"cache_control\""));
    }

    #[test]
    fn content_block_unknown_falls_through() {
        // A new block type from upstream that we don't know about.
        let raw = r#"{"type":"future_block","foo":"bar"}"#;
        let b: ContentBlock = serde_json::from_str(raw).unwrap();
        assert!(matches!(b, ContentBlock::Unknown));
    }

    #[test]
    fn tool_use_block_round_trip() {
        let b = ContentBlock::ToolUse {
            id: "tu_1".into(),
            name: "search".into(),
            input: serde_json::json!({"q": "rust"}),
            cache_control: None,
        };
        let j = serde_json::to_string(&b).unwrap();
        let back: ContentBlock = serde_json::from_str(&j).unwrap();
        assert_eq!(b, back);
    }
}
