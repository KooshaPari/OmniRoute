//! OpenAI Responses API (`/v1/responses`) wire types.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use super::common::{ResponseFormat, StreamOptions, Tool, ToolChoice, Usage};

/// `POST /v1/responses` request body. The Responses API is the successor to
/// Chat Completions; it is stateful, supports `previous_response_id`, and
/// has a slightly different input shape.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResponseRequest {
    pub model: String,
    pub input: ResponseInput,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instructions: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub previous_response_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub conversation: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<u32>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<Tool>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<ToolChoice>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parallel_tool_calls: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response_format: Option<ResponseFormat>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<IndexMap<String, String>>,

    #[serde(default)]
    pub stream: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stream_options: Option<StreamOptions>,

    /// Server-side store: when true, the response is stored and can be
    /// referenced by `previous_response_id`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub store: Option<bool>,

    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ResponseInput {
    /// Plain text input.
    Text(String),
    /// List of typed input items.
    Items(Vec<ResponseInputItem>),
}

/// One item in the Responses API input array. Roles are `user`, `system`,
/// `developer`, or `assistant`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ResponseInputItem {
    Message {
        role: String,
        content: ResponseInputContent,
    },
    FunctionCall {
        id: String,
        call_id: String,
        name: String,
        arguments: String,
    },
    FunctionCallOutput {
        call_id: String,
        output: String,
    },
    /// A single tool search call from a previous turn (rare).
    Reasoning {
        id: String,
        summary: Vec<serde_json::Value>,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ResponseInputContent {
    Text(String),
    Parts(Vec<super::common::ContentPart>),
}

/// Non-streaming response object.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ResponseObject {
    pub id: String,
    pub object: String,
    pub created_at: i64,
    pub status: ResponseStatus,
    pub model: String,
    pub output: Vec<ResponseOutputItem>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub usage: Option<Usage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub previous_response_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub system_fingerprint: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<IndexMap<String, String>>,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ResponseStatus {
    Completed,
    Failed,
    InProgress,
    Incomplete,
    Cancelled,
    Queued,
}

/// An item in the Responses API output array.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ResponseOutputItem {
    Message {
        id: String,
        role: String,
        content: Vec<super::common::ContentPart>,
        status: ResponseStatus,
    },
    FunctionCall {
        id: String,
        call_id: String,
        name: String,
        arguments: String,
        status: ResponseStatus,
    },
    Reasoning {
        id: String,
        summary: Vec<serde_json::Value>,
    },
}

/// Streaming event tagged by `type`. Other variants may exist; new ones are
/// preserved as a string in `Unknown` for forward-compat.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ResponseStreamEvent {
    ResponseCreated { response: Box<ResponseObject> },
    ResponseInProgress { response: Box<ResponseObject> },
    ResponseCompleted { response: Box<ResponseObject> },
    ResponseFailed { response: Box<ResponseObject> },
    ResponseIncomplete { response: Box<ResponseObject> },
    ResponseOutputItemAdded { output_index: u32, item: Box<ResponseOutputItem> },
    ResponseOutputItemDone { output_index: u32, item: Box<ResponseOutputItem> },
    ResponseContentPartAdded { item_id: String, output_index: u32, content_index: u32, part: super::common::ContentPart },
    ResponseContentPartDone { item_id: String, output_index: u32, content_index: u32, part: super::common::ContentPart },
    ResponseOutputTextDelta { item_id: String, output_index: u32, content_index: u32, delta: String },
    ResponseOutputTextDone { item_id: String, output_index: u32, content_index: u32, text: String },
    ResponseRefusalDelta { item_id: String, output_index: u32, content_index: u32, delta: String },
    ResponseFunctionCallArgumentsDelta { item_id: String, output_index: u32, delta: String },
    ResponseFunctionCallArgumentsDone { item_id: String, output_index: u32, arguments: String },
    #[serde(other)]
    Unknown,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn response_input_text_round_trip() {
        let r = ResponseRequest {
            model: "gpt-5".into(),
            input: ResponseInput::Text("hello".into()),
            instructions: None,
            previous_response_id: None,
            conversation: None,
            temperature: None,
            top_p: None,
            max_output_tokens: None,
            tools: None,
            tool_choice: None,
            parallel_tool_calls: None,
            response_format: None,
            user: None,
            metadata: None,
            stream: false,
            stream_options: None,
            store: None,
            extra: IndexMap::new(),
        };
        let s = serde_json::to_string(&r).unwrap();
        assert!(s.contains("\"input\":\"hello\""));
    }

    #[test]
    fn response_status_snake_case() {
        let s = serde_json::to_string(&ResponseStatus::InProgress).unwrap();
        assert_eq!(s, "\"in_progress\"");
    }

    #[test]
    fn stream_event_tagged() {
        let ev = ResponseStreamEvent::ResponseOutputTextDelta {
            item_id: "msg_1".into(),
            output_index: 0,
            content_index: 0,
            delta: "hi".into(),
        };
        let s = serde_json::to_string(&ev).unwrap();
        assert!(s.contains("\"type\":\"response_output_text_delta\""));
    }
}
