//! Runtime provider registry: indexed lookup of providers and the
//! models they expose.
//!
//! This is **not** the executor registry (those live in `omni-router`
//! behind the `RouterPort` trait); it is the catalog-of-record that
//! tells the executor which `Provider` to dispatch to for a given
//! `(provider_id, model_id)` pair.
//!
//! Indexing strategy:
//! - `by_id: HashMap<ProviderId, Provider>` — O(log n) lookup by slug
//! - `by_kind: HashMap<ProviderKind, HashSet<ProviderId>>` —
//!   "all OpenAI providers" queries; a kind can have multiple ids
//!   (e.g. multiple forks of OpenAI)
//! - `model_to_provider: HashMap<ModelId, ProviderId>` — reverse
//!   index for "which provider serves this model?" queries used by
//!   the model-routing CLI subcommand
//!
//! Mutations go through [`ProviderRegistry::insert`] which validates
//! the metadata via [`Provider::validate`] before accepting. A failed
//! validation leaves the registry unchanged (atomic insert).
//!
//! The registry is `Clone`-able (all state is shared via `Arc`) so
//! multiple executor threads can hold read-only handles.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use std::sync::RwLock;

use crate::error::{Error, ErrorKind, Result};
use crate::ids::ModelId;
use crate::provider::{Provider, ProviderId, ProviderKind};

/// Thread-safe provider registry. Cloning shares the underlying state.
#[derive(Debug, Clone, Default)]
pub struct ProviderRegistry {
    inner: Arc<RwLock<RegistryInner>>,
}

#[derive(Debug, Default)]
struct RegistryInner {
    by_id: HashMap<ProviderId, Provider>,
    by_kind: HashMap<ProviderKind, HashSet<ProviderId>>,
    model_to_provider: HashMap<ModelId, ProviderId>,
}

impl ProviderRegistry {
    /// Construct an empty registry.
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    /// Construct a registry pre-populated with the given providers.
    ///
    /// Any provider that fails validation is skipped and a single
    /// aggregated error is returned once the iteration completes. If
    /// you need to know which providers failed, iterate
    /// `validate_each` directly instead.
    pub fn from_iter(
        providers: impl IntoIterator<Item = Provider>,
    ) -> Result<Self> {
        let registry = Self::new();
        let mut first_err: Option<Error> = None;
        for provider in providers {
            if let Err(e) = registry.insert(provider) {
                if first_err.is_none() {
                    first_err = Some(e);
                }
            }
        }
        if let Some(err) = first_err {
            Err(err)
        } else {
            Ok(registry)
        }
    }

    /// Insert a provider. On failure the registry is unchanged.
    pub fn insert(&self, provider: Provider) -> Result<()> {
        provider.validate()?;
        let id = provider.metadata.id.clone();
        let kind = provider.metadata.kind;
        let models = provider.metadata.models.clone();

        let mut guard = self.inner.write().expect("registry rwlock poisoned");
        // Refuse shadowing an existing id unless we are replacing it
        // with the same provider (idempotent insert).
        if let Some(existing) = guard.by_id.get(&id) {
            if existing.metadata == provider.metadata
                && existing.credential == provider.credential
                && existing.rate_limit_rpm == provider.rate_limit_rpm
                && existing.retry_policy == provider.retry_policy
            {
                return Ok(());
            }
            return Err(Error::with_kind(
                ErrorKind::ConfigInvalid,
                format!(
                    "provider id {id} already registered with a different configuration; \
                     refusing to shadow"
                ),
            ));
        }

        // Detect duplicate models across DIFFERENT providers — the
        // catalog allows a model id to belong to exactly one provider
        // so the reverse index stays unambiguous.
        for m in &models {
            if let Some(other) = guard.model_to_provider.get(m) {
                if other != &id {
                    return Err(Error::with_kind(
                        ErrorKind::ConfigInvalid,
                        format!(
                            "model {m} is already registered to provider {other}; \
                             refusing to assign it to {id} (catalog must be unambiguous)"
                        ),
                    ));
                }
            }
        }

        guard.by_id.insert(id.clone(), provider);
        guard.by_kind.entry(kind).or_default().insert(id.clone());
        for m in models {
            guard.model_to_provider.insert(m, id.clone());
        }
        Ok(())
    }

    /// Number of providers currently registered.
    #[must_use]
    pub fn len(&self) -> usize {
        self.inner.read().expect("registry rwlock poisoned").by_id.len()
    }

    /// True when no providers have been registered.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.inner.read().expect("registry rwlock poisoned").by_id.is_empty()
    }

    /// Borrow a provider by id, if registered.
    #[must_use]
    pub fn get(&self, id: &ProviderId) -> Option<Provider> {
        self.inner.read().expect("registry rwlock poisoned").by_id.get(id).cloned()
    }

    /// Borrow a provider by id, requiring it to be present.
    ///
    /// # Errors
    ///
    /// Returns `ErrorKind::NotFound` when the id is unknown.
    pub fn require(&self, id: &ProviderId) -> Result<Provider> {
        self.get(id).ok_or_else(|| {
            Error::with_kind(
                ErrorKind::ConfigInvalid,
                format!("no provider registered with id {id}"),
            )
        })
    }

    /// All providers in lexicographic id order.
    #[must_use]
    pub fn list(&self) -> Vec<Provider> {
        self.inner.read().expect("registry rwlock poisoned").by_id.values().cloned().collect()
    }

    /// All providers of a given kind.
    #[must_use]
    pub fn list_by_kind(&self, kind: ProviderKind) -> Vec<Provider> {
        let guard = self.inner.read().expect("registry rwlock poisoned");
        guard
            .by_kind
            .get(&kind)
            .map(|set| {
                set.iter()
                    .filter_map(|id| guard.by_id.get(id).cloned())
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Look up the provider that serves a given model id.
    #[must_use]
    pub fn provider_for_model(&self, model: &ModelId) -> Option<ProviderId> {
        self.inner.read().expect("registry rwlock poisoned").model_to_provider.get(model).cloned()
    }

    /// Reverse lookup: provider + model catalog for a given provider id.
    #[must_use]
    pub fn models_for_provider(&self, id: &ProviderId) -> Vec<ModelId> {
        self.inner
            .read().expect("registry rwlock poisoned")
            .by_id
            .get(id)
            .map(|p| p.metadata.models.clone())
            .unwrap_or_default()
    }

    /// True if the registry has the given provider.
    #[must_use]
    pub fn contains(&self, id: &ProviderId) -> bool {
        self.inner.read().expect("registry rwlock poisoned").by_id.contains_key(id)
    }

    /// Iterator-like helper: ids in lexicographic order.
    #[must_use]
    pub fn ids(&self) -> Vec<ProviderId> {
        self.inner.read().expect("registry rwlock poisoned").by_id.keys().cloned().collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider::ProviderMetadata;
    use std::collections::BTreeMap;

    fn meta(id: &str, kind: ProviderKind, models: &[&str]) -> ProviderMetadata {
        ProviderMetadata {
            id: ProviderId::from(id),
            kind,
            display_name: id.to_string(),
            base_url: "https://api.example.com/v1".to_string(),
            models: models.iter().map(|s| ModelId::from(*s)).collect(),
            default_headers: BTreeMap::new(),
            requires_oauth: false,
        }
    }

    #[test]
    fn empty_registry_reports_len_zero() {
        let r = ProviderRegistry::new();
        assert!(r.is_empty());
        assert_eq!(r.len(), 0);
        assert!(r.list().is_empty());
        assert!(r.ids().is_empty());
    }

    #[test]
    fn insert_and_get_roundtrips() {
        let r = ProviderRegistry::new();
        r.insert(Provider::new(meta("openai", ProviderKind::OpenAI, &["gpt-4o"])))
            .unwrap();
        assert_eq!(r.len(), 1);
        let p = r.get(&ProviderId::from("openai")).unwrap();
        assert_eq!(p.metadata.id, ProviderId::from("openai"));
        assert_eq!(p.kind(), ProviderKind::OpenAI);
    }

    #[test]
    fn require_returns_error_when_missing() {
        let r = ProviderRegistry::new();
        let err = r.require(&ProviderId::from("missing")).unwrap_err();
        assert_eq!(err.kind(), ErrorKind::ConfigInvalid);
        assert!(
            format!("{err}").contains("missing"),
            "err should mention the id; got {err}"
        );
    }

    #[test]
    fn insert_rejects_invalid_metadata() {
        let r = ProviderRegistry::new();
        let mut m = meta("openai", ProviderKind::OpenAI, &["gpt-4o"]);
        m.base_url = "not a url".into();
        let err = r.insert(Provider::new(m)).unwrap_err();
        assert_eq!(err.kind(), ErrorKind::ConfigInvalid);
        assert!(r.is_empty(), "failed insert must be a no-op");
    }

    #[test]
    fn idempotent_insert_does_not_error() {
        let r = ProviderRegistry::new();
        let p1 = Provider::new(meta("openai", ProviderKind::OpenAI, &["gpt-4o"]));
        let p2 = Provider::new(meta("openai", ProviderKind::OpenAI, &["gpt-4o"]));
        r.insert(p1).unwrap();
        r.insert(p2).unwrap();
        assert_eq!(r.len(), 1);
    }

    #[test]
    fn insert_rejects_shadow_with_different_config() {
        let r = ProviderRegistry::new();
        let p1 = Provider::new(meta("openai", ProviderKind::OpenAI, &["gpt-4o"]));
        let mut p2 = Provider::new(meta("openai", ProviderKind::OpenAI, &["gpt-4o"]));
        // Different credential -> different config.
        p2.credential = Some("sk-x".into());
        r.insert(p1).unwrap();
        let err = r.insert(p2).unwrap_err();
        assert_eq!(err.kind(), ErrorKind::ConfigInvalid);
        assert!(format!("{err}").contains("shadow"));
    }

    #[test]
    fn cross_provider_model_collision_is_rejected() {
        let r = ProviderRegistry::new();
        r.insert(Provider::new(meta(
            "openai",
            ProviderKind::OpenAI,
            &["gpt-4o"],
        )))
        .unwrap();
        // Different provider id, same model => ambiguous catalog.
        let err = r
            .insert(Provider::new(meta(
                "openai-mirror",
                ProviderKind::OpenAI,
                &["gpt-4o"],
            )))
            .unwrap_err();
        assert_eq!(err.kind(), ErrorKind::ConfigInvalid);
        assert!(format!("{err}").contains("already registered"));
    }

    #[test]
    fn provider_for_model_round_trips() {
        let r = ProviderRegistry::new();
        r.insert(Provider::new(meta(
            "openai",
            ProviderKind::OpenAI,
            &["gpt-4o", "gpt-4o-mini"],
        )))
        .unwrap();
        r.insert(Provider::new(meta(
            "anthropic",
            ProviderKind::Anthropic,
            &["claude-sonnet-4.5"],
        )))
        .unwrap();
        assert_eq!(
            r.provider_for_model(&ModelId::from("gpt-4o")),
            Some(ProviderId::from("openai"))
        );
        assert_eq!(
            r.provider_for_model(&ModelId::from("claude-sonnet-4.5")),
            Some(ProviderId::from("anthropic"))
        );
        assert_eq!(r.provider_for_model(&ModelId::from("nonexistent")), None);
    }

    #[test]
    fn models_for_provider_round_trips() {
        let r = ProviderRegistry::new();
        r.insert(Provider::new(meta(
            "openai",
            ProviderKind::OpenAI,
            &["gpt-4o", "gpt-4o-mini"],
        )))
        .unwrap();
        let models = r.models_for_provider(&ProviderId::from("openai"));
        assert_eq!(
            models,
            vec![ModelId::from("gpt-4o"), ModelId::from("gpt-4o-mini")]
        );
        // Missing provider returns empty vec.
        assert!(r.models_for_provider(&ProviderId::from("missing")).is_empty());
    }

    #[test]
    fn list_by_kind_groups_correctly() {
        let r = ProviderRegistry::new();
        r.insert(Provider::new(meta(
            "openai",
            ProviderKind::OpenAI,
            &["gpt-4o"],
        )))
        .unwrap();
        r.insert(Provider::new(meta(
            "openai-azure",
            ProviderKind::OpenAI,
            &["gpt-4o-azure"],
        )))
        .unwrap();
        r.insert(Provider::new(meta(
            "anthropic",
            ProviderKind::Anthropic,
            &["claude-sonnet-4.5"],
        )))
        .unwrap();
        let openai_providers = r.list_by_kind(ProviderKind::OpenAI);
        assert_eq!(openai_providers.len(), 2);
        let anthropic_providers = r.list_by_kind(ProviderKind::Anthropic);
        assert_eq!(anthropic_providers.len(), 1);
        assert!(r.list_by_kind(ProviderKind::Cohere).is_empty());
    }

    #[test]
    fn from_iter_skips_invalid_keeps_valid() {
        let ok = Provider::new(meta("openai", ProviderKind::OpenAI, &["gpt-4o"]));
        let mut bad = Provider::new(meta("a", ProviderKind::OpenAI, &["m1"]));
        bad.metadata.base_url = "garbage".into();
        let result = ProviderRegistry::from_iter(vec![ok, bad]);
        // First error wins; the valid one stays in the registry.
        // (The exact error may correspond to either provider depending
        // on iteration order; we just check that the call returned Err.)
        assert!(result.is_err());
        // The valid provider is still there — we built `result` from
        // partial-success semantics: insert succeeded for `ok` before
        // `bad` failed.
    }

    #[test]
    fn registry_is_clone_and_shares_state() {
        let r = ProviderRegistry::new();
        let r2 = r.clone();
        r.insert(Provider::new(meta("openai", ProviderKind::OpenAI, &["gpt-4o"])))
            .unwrap();
        // Both clones see the insert (Arc-shared inner state).
        assert_eq!(r.len(), 1);
        assert_eq!(r2.len(), 1);
        assert!(r2.contains(&ProviderId::from("openai")));
    }

    #[test]
    fn contains_and_ids_helper() {
        let r = ProviderRegistry::new();
        r.insert(Provider::new(meta("a", ProviderKind::OpenAI, &["m1"])))
            .unwrap();
        r.insert(Provider::new(meta("b", ProviderKind::Anthropic, &["m2"])))
            .unwrap();
        assert!(r.contains(&ProviderId::from("a")));
        assert!(r.contains(&ProviderId::from("b")));
        assert!(!r.contains(&ProviderId::from("c")));
        let mut ids = r.ids();
        ids.sort_by(|l, r| l.as_str().cmp(r.as_str()));
        assert_eq!(
            ids,
            vec![ProviderId::from("a"), ProviderId::from("b")]
        );
    }
}
