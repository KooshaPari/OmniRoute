//! Gemini `generateContent` / `streamGenerateContent` request and response.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use super::config::{GenerationConfig, SafetyRating};
use super::parts::{Content, Part, Tool, ToolConfig};

/// `POST /v1beta/models/{model}:generateContent` request.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateContentRequest {
    pub contents: Vec<Content>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub system_instruction: Option<Content>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<Tool>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_config: Option<ToolConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub generation_config: Option<GenerationConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub safety_settings: Option<Vec<super::config::SafetySetting>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cached_content: Option<String>,

    #[serde(flatten, default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

/// Non-streaming response.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateContentResponse {
    pub candidates: Vec<Candidate>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prompt_feedback: Option<PromptFeedback>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub usage_metadata: Option<UsageMetadata>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response_id: Option<String>,
    #[serde(flatten, default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub content: Content,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub finish_reason: Option<FinishReason>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub safety_ratings: Option<Vec<SafetyRating>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub citation_metadata: Option<CitationMetadata>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub token_count: Option<u32>,
    /// Index of this candidate in the response.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub index: Option<u32>,
    #[serde(flatten, default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum FinishReason {
    Unspecified,
    Stop,
    MaxTokens,
    Safety,
    Recitation,
    Other,
    Blocklist,
    ProhibitedContent,
    Spii,
    MalformedFunctionCall,
    /// Stop reason for image generation.
    ImageSafety,
    Language,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptFeedback {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub block_reason: Option<BlockReason>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub safety_ratings: Option<Vec<SafetyRating>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub block_reason_message: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum BlockReason {
    Unspecified,
    Safety,
    Other,
    Blocklist,
    ProhibitedContent,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CitationMetadata {
    pub citation_sources: Vec<CitationSource>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CitationSource {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub start_index: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_index: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uri: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub license: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub publication_date: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageMetadata {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prompt_token_count: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub candidates_token_count: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cached_content_token_count: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thoughts_token_count: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_use_prompt_token_count: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_token_count: Option<u32>,
    #[serde(flatten, default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

/// Per-element stream response. Gemini streams a JSON array, so each element
/// is the full `GenerateContentResponse` shape; the caller must coalesce.
pub type StreamElement = GenerateContentResponse;

/// Pull just the text content out of a single candidate. Used by the
/// translator when streaming.
pub fn candidate_text(c: &Candidate) -> String {
    c.content
        .parts
        .iter()
        .filter_map(|p| match p {
            Part::Text { text } => Some(text.as_str()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gemini::parts::Role;

    #[test]
    fn request_minimal() {
        let r = GenerateContentRequest {
            contents: vec![Content {
                role: Role::User,
                parts: vec![Part::Text { text: "hi".into() }],
            }],
            ..Default::default()
        };
        let j = serde_json::to_string(&r).unwrap();
        let back: GenerateContentRequest = serde_json::from_str(&j).unwrap();
        assert_eq!(r, back);
    }

    #[test]
    fn finish_reason_screaming_snake() {
        let j = serde_json::to_string(&FinishReason::MaxTokens).unwrap();
        assert_eq!(j, "\"MAX_TOKENS\"");
    }
}
