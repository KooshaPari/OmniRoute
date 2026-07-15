//! Gemini generation config + safety settings.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerationConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top_k: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub candidate_count: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stop_sequences: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response_mime_type: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response_schema: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thinking_config: Option<ThinkingConfig>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seed: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub presence_penalty: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub frequency_penalty: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub response_logprobs: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub logprobs: Option<u32>,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThinkingConfig {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub include_thoughts: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thinking_budget: Option<u32>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HarmCategory {
    #[default]
    HarmCategoryUnspecified,
    HateSpeech,
    SexuallyExplicit,
    DangerousContent,
    Harassment,
    CivicIntegrity,
    /// Catch-all for newer categories Google adds.
    Other,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HarmBlockThreshold {
    #[default]
    HarmBlockThresholdUnspecified,
    BlockLowAndAbove,
    BlockMediumAndAbove,
    BlockOnlyHigh,
    BlockNone,
    Off,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SafetySetting {
    pub category: HarmCategory,
    pub threshold: HarmBlockThreshold,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SafetyRating {
    pub category: HarmCategory,
    pub probability: SafetyProbability,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub probability_score: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub severity: Option<SafetySeverity>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub severity_score: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blocked: Option<bool>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SafetyProbability {
    #[default]
    Unspecified,
    Negligible,
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SafetySeverity {
    #[default]
    Unspecified,
    Negligible,
    Low,
    Medium,
    High,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generation_config_round_trip() {
        let c = GenerationConfig {
            temperature: Some(0.7),
            top_p: Some(0.9),
            top_k: Some(40),
            max_output_tokens: Some(1024),
            candidate_count: Some(1),
            stop_sequences: Some(vec!["END".into()]),
            response_mime_type: Some("application/json".into()),
            response_schema: Some(serde_json::json!({"type": "object"})),
            thinking_config: Some(ThinkingConfig { include_thoughts: Some(true), thinking_budget: Some(8192) }),
            seed: Some(42),
            presence_penalty: None,
            frequency_penalty: None,
            response_logprobs: None,
            logprobs: None,
            extra: IndexMap::new(),
        };
        let j = serde_json::to_string(&c).unwrap();
        assert!(j.contains("\"responseMimeType\":\"application/json\""));
        let back: GenerationConfig = serde_json::from_str(&j).unwrap();
        assert_eq!(c, back);
    }

    #[test]
    fn safety_rating_screaming_snake() {
        let s = SafetyProbability::High;
        let j = serde_json::to_string(&s).unwrap();
        assert_eq!(j, "\"HIGH\"");
    }
}
