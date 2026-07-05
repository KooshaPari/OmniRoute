use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Model {
    pub id: String,
    pub provider: String,
    pub display_name: String,
    pub context_window: u32,
    pub max_output_tokens: u32,
    pub capabilities: ModelCapabilities,
    pub modalities: BTreeSet<Modality>,
    /// USD per 1k prompt tokens. None = unknown / not priced.
    pub price_prompt_per_1k: Option<f64>,
    /// USD per 1k completion tokens.
    pub price_completion_per_1k: Option<f64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
pub struct ModelCapabilities {
    pub streaming: bool,
    pub tool_use: bool,
    pub vision: bool,
    pub reasoning: bool,
    pub json_mode: bool,
    pub system_role: bool,
    pub prompt_caching: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Modality {
    Text,
    Image,
    Audio,
    Video,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ModelRef {
    /// `"provider/model"` or just `"model"` (resolved by the router).
    pub raw: String,
}

impl ModelRef {
    #[must_use]
    pub fn parse(raw: &str) -> Self {
        Self { raw: raw.to_string() }
    }
}

impl std::fmt::Display for ModelRef {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.raw)
    }
}
