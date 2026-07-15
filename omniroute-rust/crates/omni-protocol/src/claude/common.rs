//! Anthropic-common types: system prompts, thinking config, usage.

use serde::{Deserialize, Serialize};

/// Claude system prompt. May be a plain string (legacy) or an array of typed
/// blocks (allows cache_control per block).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum SystemPrompt {
    Text(String),
    Blocks(Vec<SystemBlock>),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SystemBlock {
    #[serde(rename = "type")]
    pub kind: SystemBlockType,
    pub text: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_control: Option<CacheControl>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SystemBlockType {
    Text,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum CacheControl {
    Ephemeral { ttl: Option<String> },
}

/// Anthropic extended thinking. `type` is always `"enabled"` when present;
/// the new `adaptive` variant allows the model to decide.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ThinkingConfig {
    Enabled { budget_tokens: u32 },
    Disabled,
    Adaptive,
}

impl Default for ThinkingConfig {
    fn default() -> Self {
        Self::Disabled
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ClaudeUsage {
    pub input_tokens: u32,
    pub output_tokens: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_creation_input_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_read_input_tokens: Option<u32>,
    /// Server-side tool use tokens (web_search, web_fetch, code_execution).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub server_tool_use: Option<ServerToolUse>,
    /// Service-tier specific (1h cache).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_creation: Option<CacheCreationDetail>,
    /// Anthropic tier-based rate limit info returned on every response.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rate_limit_info: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct ServerToolUse {
    pub web_search_requests: Option<u32>,
    pub web_fetch_requests: Option<u32>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct CacheCreationDetail {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ephemeral_1h_input_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ephemeral_5m_input_tokens: Option<u32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn system_prompt_text_round_trip() {
        let s = SystemPrompt::Text("you are helpful".into());
        let j = serde_json::to_string(&s).unwrap();
        let back: SystemPrompt = serde_json::from_str(&j).unwrap();
        assert_eq!(s, back);
    }

    #[test]
    fn system_prompt_blocks_with_cache_control() {
        let s = SystemPrompt::Blocks(vec![SystemBlock {
            kind: SystemBlockType::Text,
            text: "long prompt".into(),
            cache_control: Some(CacheControl::Ephemeral { ttl: Some("5m".into()) }),
        }]);
        let j = serde_json::to_string(&s).unwrap();
        assert!(j.contains("\"cache_control\""));
        assert!(j.contains("\"ttl\":\"5m\""));
    }

    #[test]
    fn thinking_config_enabled() {
        let t = ThinkingConfig::Enabled { budget_tokens: 8192 };
        let j = serde_json::to_string(&t).unwrap();
        assert!(j.contains("\"type\":\"enabled\""));
        assert!(j.contains("\"budget_tokens\":8192"));
    }

    #[test]
    fn thinking_config_adaptive() {
        let t = ThinkingConfig::Adaptive;
        let j = serde_json::to_string(&t).unwrap();
        assert!(j.contains("\"type\":\"adaptive\""));
    }
}
