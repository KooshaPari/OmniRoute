//! `/v1/models` shapes (OpenAI-compatible model catalog).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ModelList {
    pub object: String,
    pub data: Vec<Model>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Model {
    pub id: String,
    pub object: String,
    pub created: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owned_by: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context_window: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input_modalities: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_modalities: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub supports_tools: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub supports_vision: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub supports_streaming: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub supports_reasoning: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_updated: Option<DateTime<Utc>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_list_round_trip() {
        let ml = ModelList {
            object: "list".into(),
            data: vec![Model {
                id: "gpt-4o".into(),
                object: "model".into(),
                created: 1_700_000_000,
                owned_by: Some("openai".into()),
                task: None,
                context_window: Some(128_000),
                max_output_tokens: Some(16_384),
                input_modalities: Some(vec!["text".into(), "image".into()]),
                output_modalities: Some(vec!["text".into()]),
                supports_tools: Some(true),
                supports_vision: Some(true),
                supports_streaming: Some(true),
                supports_reasoning: Some(false),
                last_updated: None,
            }],
        };
        let s = serde_json::to_string(&ml).unwrap();
        let back: ModelList = serde_json::from_str(&s).unwrap();
        assert_eq!(ml, back);
    }
}
