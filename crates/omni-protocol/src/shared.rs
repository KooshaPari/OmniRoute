//! Common types used across multiple wire formats.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// (use inside tests module)

/// UUIDv7-style request id, scoped to a single turn.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct RequestId(pub Uuid);

impl RequestId {
    #[must_use]
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl Default for RequestId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for RequestId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// Alias used by a few formats that share role semantics.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    System,
    User,
    Assistant,
    Tool,
    Developer,
}

/// Common reason an assistant turn ended. Provider-specific enums map into this
/// in the translator.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StopReason {
    EndTurn,
    MaxTokens,
    StopSequence,
    ToolUse,
    ContentFilter,
    Refusal,
    Other,
}

/// Common timestamp type used in audit, call log, and response metadata.
pub type Timestamp = DateTime<Utc>;

/// Usage bucketing used for cost analytics. Provider-specific token shapes
/// map into this single struct.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct UsageBucket {
    pub input_tokens: u32,
    pub output_tokens: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_read_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cache_creation_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reasoning_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_tokens: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cost_usd: Option<f64>,
}

impl UsageBucket {
    /// Sum all token fields (treats missing fields as zero).
    #[must_use]
    pub fn total(&self) -> u32 {
        self.input_tokens
            .saturating_add(self.output_tokens)
            .saturating_add(self.cache_read_tokens.unwrap_or(0))
            .saturating_add(self.cache_creation_tokens.unwrap_or(0))
            .saturating_add(self.reasoning_tokens.unwrap_or(0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::WireFormat;

    #[test]
    fn request_id_round_trip() {
        let id = RequestId::new();
        let s = serde_json::to_string(&id).unwrap();
        let back: RequestId = serde_json::from_str(&s).unwrap();
        assert_eq!(id, back);
    }

    #[test]
    fn role_serde_lowercase() {
        let r = Role::Assistant;
        let s = serde_json::to_string(&r).unwrap();
        assert_eq!(s, "\"assistant\"");
    }

    #[test]
    fn usage_total_aggregates_all_fields() {
        let u = UsageBucket {
            input_tokens: 10,
            output_tokens: 5,
            cache_read_tokens: Some(3),
            cache_creation_tokens: Some(2),
            reasoning_tokens: Some(4),
            total_tokens: None,
            cost_usd: None,
        };
        assert_eq!(u.total(), 24);
    }

    #[test]
    fn usage_total_handles_missing() {
        let u = UsageBucket {
            input_tokens: 10,
            output_tokens: 5,
            ..Default::default()
        };
        assert_eq!(u.total(), 15);
    }

    #[test]
    fn wire_format_as_str() {
        use crate::WireFormat;
        assert_eq!(WireFormat::Openai.as_str(), "openai");
        assert_eq!(WireFormat::Claude.as_str(), "claude");
        assert_eq!(WireFormat::Gemini.as_str(), "gemini");
    }

    #[test]
    fn wire_format_parse_aliases() {
        assert_eq!(WireFormat::parse("openai"), Some(WireFormat::Openai));
        assert_eq!(WireFormat::parse("Anthropic"), Some(WireFormat::Claude));
        assert_eq!(WireFormat::parse("google"), Some(WireFormat::Gemini));
        assert_eq!(WireFormat::parse("unknown"), None);
    }
}
