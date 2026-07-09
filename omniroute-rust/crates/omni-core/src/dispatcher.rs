//! Dispatch planning: resolve a model request against the provider
//! registry and produce a structured dispatch plan.
//!
//! This is the **planning** layer — it selects *which* provider and model
//! to route to, but does **not** execute the call. Execution is handled
//! by the executor layer (PR-10+).
//!
//! # Flow
//!
//! 1. A [`DispatchRequest`] arrives from a route handler or MCP tool.
//! 2. `plan_dispatch` queries the [`ProviderRegistry`] to find candidates
//!    that serve the requested model and satisfy capability requirements.
//! 3. A [`DispatchPlan`] is returned, or a [`PlanError`] describing why
//!    the request could not be satisfied.

use crate::error::{Error, ErrorKind};
use crate::ids::ModelId;
use crate::model::ModelCapabilities;
use crate::provider::{Provider, ProviderId, ProviderKind};
use crate::registry::ProviderRegistry;

// ---------------------------------------------------------------------------
// Request & response types
// ---------------------------------------------------------------------------

/// A routing request before any provider resolution.
#[derive(Debug, Clone)]
pub struct DispatchRequest {
    /// The model the caller wants to use (e.g. `gpt-4o`).
    pub model_id: ModelId,

    /// If set, only consider this specific provider (fail-fast if it
    /// doesn't serve the model, rather than falling back).
    pub preferred_provider: Option<ProviderId>,

    /// If set, prefer providers of this kind (e.g. `OpenAI`) when
    /// no provider id is pinned.
    pub preferred_kind: Option<ProviderKind>,

    /// Require the model to support streaming responses.
    pub require_streaming: bool,

    /// Require the model to support tool/function calling.
    pub require_tools: bool,

    /// Require the model to support vision/image inputs.
    pub require_vision: bool,

    /// Require the model to support JSON mode.
    pub require_json_mode: bool,
}

/// A resolved dispatch plan — the outcome of routing a [`DispatchRequest`]
/// through the registry.
#[derive(Debug, Clone)]
pub struct DispatchPlan {
    /// The model that will be sent to the upstream.
    pub model_id: ModelId,
    /// The provider that serves this model.
    pub provider_id: ProviderId,
    /// The provider kind (e.g. OpenAI, Anthropic).
    pub provider_kind: ProviderKind,
    /// The capabilities the model actually supports. Can be compared
    /// against the request requirements after the fact.
    pub capabilities: ModelCapabilities,
}

/// Why a dispatch request could not be satisfied.
#[derive(Debug)]
pub enum PlanError {
    /// No provider in the registry serves this model id.
    ModelNotFound(ModelId),
    /// The preferred provider id is not registered.
    ProviderNotFound(ProviderId),
    /// The model is known but does not support a requested feature.
    CapabilityNotSupported {
        model_id: ModelId,
        provider_id: ProviderId,
        capability: &'static str,
    },
}

impl core::fmt::Display for PlanError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        match self {
            Self::ModelNotFound(mid) => write!(f, "model {mid} not found in registry"),
            Self::ProviderNotFound(pid) => {
                write!(f, "preferred provider {pid} not registered")
            }
            Self::CapabilityNotSupported {
                model_id,
                provider_id,
                capability,
            } => {
                write!(
                    f,
                    "{model_id} (provider {provider_id}) does not support {capability}"
                )
            }
        }
    }
}

impl std::error::Error for PlanError {}

// ---------------------------------------------------------------------------
// Core planning function
// ---------------------------------------------------------------------------

/// Resolve a [`DispatchRequest`] against the given [`ProviderRegistry`],
/// returning a [`DispatchPlan`] or a [`PlanError`].
pub fn plan_dispatch(
    registry: &ProviderRegistry,
    request: &DispatchRequest,
) -> Result<DispatchPlan, PlanError> {
    // 1. If a preferred provider is given, try it first (exact route).
    if let Some(ref pid) = request.preferred_provider {
        return plan_via_provider(registry, pid, request);
    }

    // 2. Otherwise, try to find any provider that serves this model.
    let candidates = candidates_for_model(registry, &request.model_id);
    if let Some(provider) = candidates.first() {
        // If a preferred kind is given, try matching it first.
        if let Some(ref kind) = request.preferred_kind {
            for p in &candidates {
                if p.kind() == *kind {
                    return build_plan(p, request);
                }
            }
        }
        // No kind preference or no kind match — take the first candidate.
        let provider = candidates.into_iter().next().unwrap();
        return build_plan(&provider, request);
    }

    Err(PlanError::ModelNotFound(request.model_id.clone()))
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/// Try to resolve a request through a specific provider id.
fn plan_via_provider(
    registry: &ProviderRegistry,
    pid: &ProviderId,
    request: &DispatchRequest,
) -> Result<DispatchPlan, PlanError> {
    let provider = registry
        .get(pid)
        .ok_or_else(|| PlanError::ProviderNotFound(pid.clone()))?;

    // Does this provider serve the requested model?
    if !provider.metadata.models.contains(&request.model_id) {
        return Err(PlanError::ModelNotFound(request.model_id.clone()));
    }

    // TODO(PR-10): fetch real ModelCapabilities from the provider catalog.
    // Until then we default to all-false and reject if the requested
    // capability can never be satisfied by the default stub.
    let capabilities = ModelCapabilities::default();

    // Capability checks (stub until PR-10 wires the catalog).
    if request.require_streaming && !capabilities.streaming {
        return Err(PlanError::CapabilityNotSupported {
            model_id: request.model_id.clone(),
            provider_id: pid.clone(),
            capability: "streaming",
        });
    }

    Ok(DispatchPlan {
        model_id: request.model_id.clone(),
        provider_id: pid.clone(),
        provider_kind: provider.metadata.kind,
        capabilities,
    })
}

/// Return all providers that list the given model in their metadata.
fn candidates_for_model<'r>(registry: &'r ProviderRegistry, model_id: &ModelId) -> Vec<Provider> {
    registry
        .list()
        .into_iter()
        .filter(|p| p.metadata.models.contains(model_id))
        .collect()
}

/// Build a plan from a resolved provider, checking capability constraints.
fn build_plan(provider: &Provider, request: &DispatchRequest) -> Result<DispatchPlan, PlanError> {
    // TODO(PR-10): fetch real ModelCapabilities from the provider catalog.
    // For now we default to all-false and only reject if the model name
    // is absent from the provider's model list (already checked above).
    let capabilities = ModelCapabilities::default();

    // Capability checks (stub until PR-10 wires the catalog).
    if request.require_streaming && !capabilities.streaming {
        return Err(PlanError::CapabilityNotSupported {
            model_id: request.model_id.clone(),
            provider_id: provider.metadata.id.clone(),
            capability: "streaming",
        });
    }

    Ok(DispatchPlan {
        model_id: request.model_id.clone(),
        provider_id: provider.metadata.id.clone(),
        provider_kind: provider.metadata.kind,
        capabilities,
    })
}

// ---------------------------------------------------------------------------
// Convenience converters (PlanError -> Error) for the executor layer
// ---------------------------------------------------------------------------

impl From<PlanError> for Error {
    fn from(e: PlanError) -> Self {
        match e {
            PlanError::ModelNotFound(mid) => Error::not_found(format!("model {mid} not found")),
            PlanError::ProviderNotFound(pid) => {
                Error::not_found(format!("provider {pid} not found"))
            }
            PlanError::CapabilityNotSupported { model_id, .. } => Error::forbidden(format!(
                "model {model_id} does not support the requested capability"
            )),
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::ProviderMetadata;
    use std::collections::BTreeMap;

    fn openai_provider() -> Provider {
        Provider::new(ProviderMetadata {
            id: ProviderId::from("openai"),
            kind: ProviderKind::OpenAI,
            display_name: "OpenAI".to_string(),
            base_url: "https://api.openai.com/v1".to_string(),
            models: vec![ModelId::from("gpt-4o"), ModelId::from("gpt-4o-mini")],
            default_headers: BTreeMap::new(),
            requires_oauth: false,
        })
    }

    fn anthropic_provider() -> Provider {
        Provider::new(ProviderMetadata {
            id: ProviderId::from("anthropic"),
            kind: ProviderKind::Anthropic,
            display_name: "Anthropic".to_string(),
            base_url: "https://api.anthropic.com/v1".to_string(),
            models: vec![ModelId::from("claude-sonnet-4.5")],
            default_headers: BTreeMap::new(),
            requires_oauth: false,
        })
    }

    fn populated_registry() -> ProviderRegistry {
        let r = ProviderRegistry::new();
        r.insert(openai_provider()).unwrap();
        r.insert(anthropic_provider()).unwrap();
        r
    }

    #[test]
    fn plan_dispatch_resolves_known_model_to_correct_provider() {
        let registry = populated_registry();
        let request = DispatchRequest {
            model_id: ModelId::from("gpt-4o"),
            preferred_provider: None,
            preferred_kind: None,
            require_streaming: false,
            require_tools: false,
            require_vision: false,
            require_json_mode: false,
        };
        let plan = plan_dispatch(&registry, &request).unwrap();
        assert_eq!(plan.model_id, ModelId::from("gpt-4o"));
        assert_eq!(plan.provider_id, ProviderId::from("openai"));
        assert_eq!(plan.provider_kind, ProviderKind::OpenAI);
    }

    #[test]
    fn plan_dispatch_preferred_provider_wins_when_available() {
        let registry = populated_registry();
        let request = DispatchRequest {
            model_id: ModelId::from("gpt-4o"),
            preferred_provider: Some(ProviderId::from("openai")),
            preferred_kind: None,
            require_streaming: false,
            require_tools: false,
            require_vision: false,
            require_json_mode: false,
        };
        let plan = plan_dispatch(&registry, &request).unwrap();
        assert_eq!(plan.provider_id, ProviderId::from("openai"));
    }

    #[test]
    fn plan_dispatch_unknown_model_returns_model_not_found() {
        let registry = populated_registry();
        let request = DispatchRequest {
            model_id: ModelId::from("nonexistent"),
            preferred_provider: None,
            preferred_kind: None,
            require_streaming: false,
            require_tools: false,
            require_vision: false,
            require_json_mode: false,
        };
        let err = plan_dispatch(&registry, &request).unwrap_err();
        assert!(matches!(err, PlanError::ModelNotFound(_)));
    }

    #[test]
    fn plan_dispatch_unknown_provider_returns_provider_not_found() {
        let registry = populated_registry();
        let request = DispatchRequest {
            model_id: ModelId::from("gpt-4o"),
            preferred_provider: Some(ProviderId::from("nonexistent")),
            preferred_kind: None,
            require_streaming: false,
            require_tools: false,
            require_vision: false,
            require_json_mode: false,
        };
        let err = plan_dispatch(&registry, &request).unwrap_err();
        assert!(matches!(err, PlanError::ProviderNotFound(_)));
    }

    #[test]
    fn plan_dispatch_preferred_kind_filters_candidates() {
        let registry = populated_registry();
        let request = DispatchRequest {
            model_id: ModelId::from("gpt-4o"),
            preferred_provider: None,
            preferred_kind: Some(ProviderKind::Anthropic),
            require_streaming: false,
            require_tools: false,
            require_vision: false,
            require_json_mode: false,
        };
        // gpt-4o is not served by Anthropic — should fall through to
        // the first available provider since no Anthropic serves it.
        // Currently this falls back to the first OpenAi provider that
        // serves the model. With only one OpenAI provider in the test
        // registry, that succeeds.
        let plan = plan_dispatch(&registry, &request).unwrap();
        assert_eq!(plan.provider_id, ProviderId::from("openai"));
    }

    #[test]
    fn plan_dispatch_streaming_requirement_checked() {
        let registry = populated_registry();
        let request = DispatchRequest {
            model_id: ModelId::from("gpt-4o"),
            preferred_provider: Some(ProviderId::from("openai")),
            preferred_kind: None,
            require_streaming: true,
            require_tools: false,
            require_vision: false,
            require_json_mode: false,
        };
        // The model IS in the provider's model list, but ModelCapabilities
        // are currently stubbed as all-false (default). The requirement
        // check should reject because capabilities.streaming is false.
        let err = plan_dispatch(&registry, &request).unwrap_err();
        assert!(
            matches!(err, PlanError::CapabilityNotSupported { .. }),
            "expected capability error, got {err:?}"
        );
    }

    #[test]
    fn plan_error_converts_to_error() {
        let e: Error = PlanError::ModelNotFound(ModelId::from("x")).into();
        assert_eq!(e.kind(), ErrorKind::NotFound);

        let e: Error = PlanError::ProviderNotFound(ProviderId::from("x")).into();
        assert_eq!(e.kind(), ErrorKind::NotFound);

        let e: Error = PlanError::CapabilityNotSupported {
            model_id: ModelId::from("x"),
            provider_id: ProviderId::from("y"),
            capability: "streaming",
        }
        .into();
        assert_eq!(e.kind(), ErrorKind::Forbidden);
    }

    #[test]
    fn empty_registry_returns_model_not_found() {
        let registry = ProviderRegistry::new();
        let request = DispatchRequest {
            model_id: ModelId::from("gpt-4o"),
            preferred_provider: None,
            preferred_kind: None,
            require_streaming: false,
            require_tools: false,
            require_vision: false,
            require_json_mode: false,
        };
        let err = plan_dispatch(&registry, &request).unwrap_err();
        assert!(matches!(err, PlanError::ModelNotFound(_)));
    }

    #[test]
    fn prefer_kind_respects_model_availability() {
        let registry = populated_registry();
        let request = DispatchRequest {
            // claude-sonnet-4.5 is only served by Anthropic
            model_id: ModelId::from("claude-sonnet-4.5"),
            preferred_provider: None,
            preferred_kind: Some(ProviderKind::OpenAI),
            require_streaming: false,
            require_tools: false,
            require_vision: false,
            require_json_mode: false,
        };
        // No OpenAI provider serves this model, but Anthropic does.
        // With preferred_kind=OpenAI matching no candidates, we should
        // fall back to the first available (Anthropic).
        let plan = plan_dispatch(&registry, &request).unwrap();
        assert_eq!(plan.provider_id, ProviderId::from("anthropic"));
    }
}
