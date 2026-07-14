//! OpenAI wire-format common types: messages, content parts, tools, usage.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

/// Role of a message in a chat conversation. OpenAI's standard set plus
/// `developer` (newer OpenAI models treat this the same as `system`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    System,
    Developer,
    User,
    Assistant,
    Tool,
    Function,
}

/// A single message in a chat conversation. Content can be a plain string or
/// a list of typed parts (text / image / audio / file).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Message {
    pub role: Role,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<MessageContent>,
    /// Optional name (some providers use it for function-call attribution).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Required when role=tool: the tool call id this message is the result of.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    /// Tool calls produced by the assistant on a previous turn.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
}

/// Either a plain string or a list of typed content parts.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum MessageContent {
    Text(String),
    Parts(Vec<ContentPart>),
}

/// OpenAI multimodal content part. Audio, file, refusal, etc. are all
/// modelled as tagged enum variants.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentPart {
    Text { text: String },
    ImageUrl { image_url: ImageUrl },
    InputAudio { input_audio: InputAudio },
    File { file: FilePart },
    Refusal { refusal: String },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ImageUrl {
    pub url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct InputAudio {
    pub data: String,
    pub format: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FilePart {
    pub file_data: Option<String>,
    pub file_id: Option<String>,
    pub filename: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: ToolCallType,
    pub function: ToolCallFunction,
    /// Index in a streamed tool call delta. Only present in streaming chunks.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub index: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ToolCallType {
    Function,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolCallFunction {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AssistantMessage {
    pub content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refusal: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
}

/// JSON schema for a tool definition. OpenAI calls this `functions[].parameters`
/// in legacy form; modern `tools[].function.parameters` is identical.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Tool {
    #[serde(rename = "type")]
    pub kind: ToolKind,
    pub function: ToolFunction,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ToolKind {
    Function,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolFunction {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// JSON Schema object describing the function arguments.
    pub parameters: serde_json::Value,
    /// Whether the tool should be executed strictly (parallel_tool_calls).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub strict: Option<bool>,
}

/// Controls which (if any) tool the model should call.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ToolChoice {
    /// `"none"`, `"auto"`, or `"required"`.
    Mode(String),
    /// Force a specific tool.
    Specific(ToolChoiceSpecific),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolChoiceSpecific {
    #[serde(rename = "type")]
    pub kind: ToolKind,
    pub function: ToolChoiceSpecificFunction,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolChoiceSpecificFunction {
    pub name: String,
}

/// Structured output / JSON-mode configuration.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ResponseFormat {
    Text,
    JsonObject,
    JsonSchema { json_schema: ResponseFormatJsonSchema },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResponseFormatJsonSchema {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub schema: serde_json::Value,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub strict: Option<bool>,
}

/// SSE streaming knobs.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
pub struct StreamOptions {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub include_usage: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub include_obfuscation: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub chunk_include_usage: Option<bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FinishReason {
    Stop,
    Length,
    ToolCalls,
    ContentFilter,
    FunctionCall,
}

/// OpenAI usage shape. Mirrors `UsageBucket` but stays provider-native.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
    /// OpenAI Responses API extras.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prompt_tokens_details: Option<PromptTokensDetails>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completion_tokens_details: Option<CompletionTokensDetails>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct PromptTokensDetails {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cached_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio_tokens: Option<u32>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct CompletionTokensDetails {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reasoning_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub accepted_prediction_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rejected_prediction_tokens: Option<u32>,
}

/// Provider-extended headers that OmniRoute preserves when present.
pub type ExtHeaders = IndexMap<String, String>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn role_serde_lowercase() {
        let s = serde_json::to_string(&Role::Assistant).unwrap();
        assert_eq!(s, "\"assistant\"");
        let back: Role = serde_json::from_str(&"\"developer\"").unwrap();
        assert_eq!(back, Role::Developer);
    }

    #[test]
    fn message_text_round_trip() {
        let m = Message {
            role: Role::User,
            content: Some(MessageContent::Text("hi".into())),
            name: None,
            tool_call_id: None,
            tool_calls: None,
        };
        let s = serde_json::to_string(&m).unwrap();
        let back: Message = serde_json::from_str(&s).unwrap();
        assert_eq!(m, back);
    }

    #[test]
    fn content_part_image() {
        let p = ContentPart::ImageUrl {
            image_url: ImageUrl { url: "https://x".into(), detail: Some("low".into()) },
        };
        let s = serde_json::to_string(&p).unwrap();
        assert!(s.contains("\"type\":\"image_url\""));
    }

    #[test]
    fn tool_choice_mode_string() {
        let tc = ToolChoice::Mode("auto".into());
        let s = serde_json::to_string(&tc).unwrap();
        assert_eq!(s, "\"auto\"");
    }

    #[test]
    fn tool_choice_specific() {
        let tc = ToolChoice::Specific(ToolChoiceSpecific {
            kind: ToolKind::Function,
            function: ToolChoiceSpecificFunction { name: "search".into() },
        });
        let s = serde_json::to_string(&tc).unwrap();
        assert!(s.contains("\"type\":\"function\""));
        assert!(s.contains("\"name\":\"search\""));
    }

    #[test]
    fn response_format_json_schema() {
        let rf = ResponseFormat::JsonSchema {
            json_schema: ResponseFormatJsonSchema {
                name: "out".into(),
                description: None,
                schema: serde_json::json!({"type": "object"}),
                strict: Some(true),
            },
        };
        let s = serde_json::to_string(&rf).unwrap();
        assert!(s.contains("\"type\":\"json_schema\""));
        assert!(s.contains("\"strict\":true"));
    }
}
