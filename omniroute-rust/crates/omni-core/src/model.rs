//! Model catalog: the canonical representation of an LLM model exposed by
//! a provider.
//!
//! A [`Model`] carries identity (typed [`ModelId`]), runtime limits
//! (context window, max output tokens), capability flags, modalities, and
//! optional pricing. Models with the same slug across providers are
//! distinct entries — the tuple `(provider, id)` is the full address.
//!
//! Two helpers close the loop:
//! - [`Model::validate`] enforces structural invariants (non-empty id,
//!   positive limits).
//! - [`Model::estimate_cost`] computes USD cost from prompt/completion
//!   token counts using the model's pricing (or [`None`] if unpriced).
//!
//! [`ModelRef`] is the wire-side `provider/model` string that callers send
//! to the chat endpoint; [`ModelRef::parse`] tolerates the bare-model form.

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};

use crate::error::{Error, ErrorKind, Result};
use crate::ids::ModelId;
use crate::provider::ProviderId;

/// A single model in the catalog.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Model {
    /// Wire slug of the model (e.g. `gpt-4o`, `claude-sonnet-4-5`).
    pub id: ModelId,
    /// Provider that hosts this model.
    pub provider: ProviderId,
    /// Human-readable display name (e.g. `"GPT-4o"`).
    pub display_name: String,
    /// Total context window in tokens (input + output).
    pub context_window: u32,
    /// Per-request maximum output tokens.
    pub max_output_tokens: u32,
    /// Capability flags (streaming, tool use, vision, ...).
    pub capabilities: ModelCapabilities,
    /// Supported input/output modalities (text, image, audio, video).
    pub modalities: BTreeSet<Modality>,
    /// USD per 1k prompt tokens. `None` = unknown / not priced.
    pub price_prompt_per_1k: Option<f64>,
    /// USD per 1k completion tokens.
    pub price_completion_per_1k: Option<f64>,
}

/// Feature capabilities of a model.
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

impl ModelCapabilities {
    /// `true` if the model can be invoked with `stream=true`.
    #[must_use]
    pub const fn supports_streaming(&self) -> bool {
        self.streaming
    }
}

/// Modality that a model can accept as input or produce as output.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Modality {
    Text,
    Image,
    Audio,
    Video,
}

/// Wire-side model reference (`"provider/model"` or just `"model"`).
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ModelRef {
    pub raw: String,
}

impl ModelRef {
    /// Parse a wire-side reference. Always succeeds (the resolver decides
    /// whether `raw` is valid later); use [`ModelRef::split`] to extract
    /// `(provider, model)`.
    ///
    /// ```
    /// use omni_core::ModelRef;
    ///
    /// let r = ModelRef::parse("openai/gpt-4o");
    /// assert_eq!(r.to_string(), "openai/gpt-4o");
    /// assert_eq!(r.split(), Some(("openai", "gpt-4o")));
    /// ```
    #[must_use]
    pub fn parse(raw: &str) -> Self {
        Self { raw: raw.to_string() }
    }

    /// Split `"provider/model"` into `(provider, model)`. Returns `None`
    /// when there is no `/` — the caller must resolve the bare model
    /// against its configured provider.
    ///
    /// ```
    /// use omni_core::ModelRef;
    ///
    /// assert_eq!(ModelRef::parse("anthropic/claude-sonnet-4-5").split(),
    ///            Some(("anthropic", "claude-sonnet-4-5")));
    /// assert_eq!(ModelRef::parse("gpt-4o").split(), None);
    /// ```
    #[must_use]
    pub fn split(&self) -> Option<(&str, &str)> {
        self.raw.split_once('/')
    }
}

impl std::fmt::Display for ModelRef {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.raw)
    }
}

impl Model {
    /// Validate structural invariants. Returns an [`Error::Config`] on
    /// violation. Call this when ingesting from the DB, the OpenCode plugin
    /// contract, or any external source.
    ///
    /// ```
    /// use omni_core::{Model, ModelCapabilities, ProviderId};
    /// use omni_core::ids::ModelId;
    /// use std::collections::BTreeSet;
    ///
    /// let m = Model {
    ///     id: ModelId::from("gpt-4o"),
    ///     provider: ProviderId::from("openai"),
    ///     display_name: "GPT-4o".into(),
    ///     context_window: 128_000,
    ///     max_output_tokens: 16_384,
    ///     capabilities: ModelCapabilities::default(),
    ///     modalities: BTreeSet::new(),
    ///     price_prompt_per_1k: None,
    ///     price_completion_per_1k: None,
    /// };
    /// assert!(m.validate().is_ok());
    /// ```
    pub fn validate(&self) -> Result<()> {
        if self.id.is_empty() {
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                "model id must not be empty",
            ));
        }
        if self.provider.as_str().is_empty() {
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                "model provider must not be empty",
            ));
        }
        if self.context_window == 0 {
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                "model context_window must be > 0",
            ));
        }
        if self.max_output_tokens == 0 {
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                "model max_output_tokens must be > 0",
            ));
        }
        if self.max_output_tokens > self.context_window {
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                "model max_output_tokens must be <= context_window",
            ));
        }
        for price in [self.price_prompt_per_1k, self.price_completion_per_1k] {
            if let Some(p) = price {
                if !p.is_finite() || p < 0.0 {
                    return Err(Error::with_kind(
                        ErrorKind::ConfigInvalid,
                        "model price must be finite and non-negative",
                    ));
                }
            }
        }
        Ok(())
    }

    /// Estimate the USD cost of an invocation given prompt + completion
    /// token counts. Returns `None` if either price is missing.
    ///
    /// ```
    /// use omni_core::{Model, ModelCapabilities, ProviderId};
    /// use omni_core::ids::ModelId;
    /// use std::collections::BTreeSet;
    ///
    /// let m = Model {
    ///     id: ModelId::from("gpt-4o-mini"),
    ///     provider: ProviderId::from("openai"),
    ///     display_name: "GPT-4o mini".into(),
    ///     context_window: 128_000,
    ///     max_output_tokens: 16_384,
    ///     capabilities: ModelCapabilities::default(),
    ///     modalities: BTreeSet::new(),
    ///     price_prompt_per_1k: Some(0.00015),
    ///     price_completion_per_1k: Some(0.00060),
    /// };
    /// // 1_000 prompt + 500 completion tokens:
    /// let cost = m.estimate_cost(1_000, 500).unwrap();
    /// assert!((cost - 0.00045).abs() < 1e-9);
    /// ```
    #[must_use]
    pub fn estimate_cost(&self, prompt_tokens: u32, completion_tokens: u32) -> Option<f64> {
        let p = self.price_prompt_per_1k?;
        let c = self.price_completion_per_1k?;
        let prompt_cost = p * (f64::from(prompt_tokens) / 1000.0);
        let completion_cost = c * (f64::from(completion_tokens) / 1000.0);
        Some(prompt_cost + completion_cost)
    }

    /// `true` if the model advertises support for a given modality.
    ///
    /// ```
    /// use omni_core::{Model, ModelCapabilities, Modality, ProviderId};
    /// use omni_core::ids::ModelId;
    /// use std::collections::BTreeSet;
    ///
    /// let mut mods = BTreeSet::new();
    /// mods.insert(Modality::Text);
    /// mods.insert(Modality::Image);
    /// let m = Model {
    ///     id: ModelId::from("gpt-4o"),
    ///     provider: ProviderId::from("openai"),
    ///     display_name: "GPT-4o".into(),
    ///     context_window: 128_000,
    ///     max_output_tokens: 16_384,
    ///     capabilities: ModelCapabilities::default(),
    ///     modalities: mods,
    ///     price_prompt_per_1k: None,
    ///     price_completion_per_1k: None,
    /// };
    /// assert!(m.supports_modality(Modality::Image));
    /// assert!(!m.supports_modality(Modality::Audio));
    /// ```
    #[must_use]
    pub fn supports_modality(&self, m: Modality) -> bool {
        self.modalities.contains(&m)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_model() -> Model {
        Model {
            id: ModelId::from("gpt-4o"),
            provider: ProviderId::from("openai"),
            display_name: "GPT-4o".into(),
            context_window: 128_000,
            max_output_tokens: 16_384,
            capabilities: ModelCapabilities::default(),
            modalities: BTreeSet::new(),
            price_prompt_per_1k: Some(0.005),
            price_completion_per_1k: Some(0.015),
        }
    }

    #[test]
    fn validate_ok_for_typical_model() {
        assert!(make_model().validate().is_ok());
    }

    #[test]
    fn validate_rejects_empty_id() {
        let mut m = make_model();
        m.id = ModelId::from("");
        let err = m.validate().unwrap_err();
        assert_eq!(err.kind(), ErrorKind::ConfigInvalid);
    }

    #[test]
    fn validate_rejects_zero_context_window() {
        let mut m = make_model();
        m.context_window = 0;
        assert!(m.validate().is_err());
    }

    #[test]
    fn validate_rejects_negative_price() {
        let mut m = make_model();
        m.price_prompt_per_1k = Some(-1.0);
        assert!(m.validate().is_err());
    }

    #[test]
    fn estimate_cost_computes_prompt_and_completion() {
        let m = make_model();
        // 1000 prompt * 0.005/1k = 0.005
        // 1000 completion * 0.015/1k = 0.015
        let cost = m.estimate_cost(1000, 1000).unwrap();
        assert!((cost - 0.020).abs() < 1e-9);
    }

    #[test]
    fn estimate_cost_none_when_unpriced() {
        let mut m = make_model();
        m.price_prompt_per_1k = None;
        assert!(m.estimate_cost(100, 100).is_none());
    }

    #[test]
    fn model_ref_split_handles_both_forms() {
        assert_eq!(
            ModelRef::parse("anthropic/claude").split(),
            Some(("anthropic", "claude"))
        );
        assert_eq!(ModelRef::parse("gpt-4o").split(), None);
    }

    #[test]
    fn capabilities_default_is_all_false() {
        let c = ModelCapabilities::default();
        assert!(!c.supports_streaming());
    }

    #[test]
    fn model_round_trips_through_serde() {
        let m = make_model();
        let s = serde_json::to_string(&m).unwrap();
        let back: Model = serde_json::from_str(&s).unwrap();
        assert_eq!(m.id, back.id);
        assert_eq!(m.context_window, back.context_window);
        assert_eq!(m.price_prompt_per_1k, back.price_prompt_per_1k);
    }
}