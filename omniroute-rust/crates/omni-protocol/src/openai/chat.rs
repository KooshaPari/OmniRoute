//! `/v1/chat/completions` request, response, and SSE streaming chunk shapes.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use super::common::{
    AssistantMessage, FinishReason, Message, ResponseFormat, StreamOptions, Tool,
    ToolChoice, Usage,
};

/// `POST /v1/chat/completions` request body. Compatible with OpenAI and the
/// 100+ OpenAI-API-compatible providers (DeepSeek, Groq, Mistral, OpenRouter,
/// Fireworks, Together, xAI, Cohere, NVIDIA, Cerebras, ...).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<Message>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub n: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_completion_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stop: Option<Stop>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub presence_penalty: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub frequency_penalty: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logit_bias: Option<IndexMap<String, f32>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seed: Option<i64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<Tool>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<ToolChoice>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parallel_tool_calls: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response_format: Option<ResponseFormat>,

    #[serde(default)]
    pub stream: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stream_options: Option<StreamOptions>,

    /// Provider-specific passthrough.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extra_body: Option<IndexMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Stop {
    Single(String),
    Multi(Vec<String>),
}

/// `POST /v1/chat/completions` non-streaming response.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatCompletionResponse {
    pub id: String,
    pub object: String,
    pub created: i64,
    pub model: String,
    pub choices: Vec<ChatCompletionChoice>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub usage: Option<Usage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub system_fingerprint: Option<String>,
    /// Provider-specific passthrough preserved from the upstream.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extra: Option<IndexMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatCompletionChoice {
    pub index: u32,
    pub message: AssistantMessage,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logprobs: Option<serde_json::Value>,
    pub finish_reason: Option<FinishReason>,
}

/// SSE streaming chunk. The terminal `data: [DONE]` line is a transport-level
/// sentinel and is handled by the SSE parser, not the deserializer.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatCompletionChunk {
    pub id: String,
    pub object: String,
    pub created: i64,
    pub model: String,
    pub choices: Vec<ChatCompletionChunkChoice>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub usage: Option<Usage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub system_fingerprint: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ChatCompletionChunkChoice {
    pub index: u32,
    pub delta: ChatCompletionDelta,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logprobs: Option<serde_json::Value>,
    pub finish_reason: Option<FinishReason>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ChatCompletionDelta {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refusal: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCallDelta>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ToolCallDelta {
    pub index: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(rename = "type", default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub function: Option<ToolCallDeltaFunction>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ToolCallDeltaFunction {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub arguments: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::openai::common::{ContentPart, MessageContent, Role};

    #[test]
    fn chat_request_minimal() {
        let r = ChatCompletionRequest {
            model: "gpt-4o".into(),
            messages: vec![Message {
                role: Role::User,
                content: Some(MessageContent::Text("hi".into())),
                name: None,
                tool_call_id: None,
                tool_calls: None,
            }],
            temperature: None,
            top_p: None,
            n: None,
            max_tokens: None,
            max_completion_tokens: None,
            stop: None,
            presence_penalty: None,
            frequency_penalty: None,
            logit_bias: None,
            user: None,
            seed: None,
            tools: None,
            tool_choice: None,
            parallel_tool_calls: None,
            response_format: None,
            stream: false,
            stream_options: None,
            extra_body: Some(IndexMap::new()),
        };
        let s = serde_json::to_string(&r).unwrap();
        assert!(s.contains("\"model\":\"gpt-4o\""));
        let back: ChatCompletionRequest = serde_json::from_str(&s).unwrap();
        assert_eq!(r, back);
    }

    #[test]
    fn chat_request_image_content() {
        let m = Message {
            role: Role::User,
            content: Some(MessageContent::Parts(vec![ContentPart::ImageUrl {
                image_url: super::super::common::ImageUrl {
                    url: "https://x/cat.jpg".into(),
                    detail: Some("high".into()),
                },
            }])),
            name: None,
            tool_call_id: None,
            tool_calls: None,
        };
        let s = serde_json::to_string(&m).unwrap();
        assert!(s.contains("image_url"));
    }

    #[test]
    fn stop_single_vs_multi() {
        let s = Stop::Single("END".into());
        let json = serde_json::to_string(&s).unwrap();
        assert_eq!(json, "\"END\"");

        let m = Stop::Multi(vec!["END".into(), "###".into()]);
        let json = serde_json::to_string(&m).unwrap();
        let back: Stop = serde_json::from_str(&json).unwrap();
        assert_eq!(m, back);
    }

    #[test]
    fn response_choice_finish_reason_snake() {
        let fr = FinishReason::ToolCalls;
        let s = serde_json::to_string(&fr).unwrap();
        assert_eq!(s, "\"tool_calls\"");
    }
}
