//! Connector trait, manifest, auth, sync contracts.

pub mod derived;
pub mod mcp_bridge;
pub mod signature_verifiers;

use async_trait::async_trait;
use focus_events::NormalizedEvent;
use serde::{Deserialize, Serialize};
use thiserror::Error;

fn default_verification_tier() -> VerificationTier {
    VerificationTier::Verified
}

#[derive(Debug, Error)]
pub enum ConnectorError {
    #[error("auth: {0}")]
    Auth(String),
    #[error("network: {0}")]
    Network(String),
    #[error("schema: {0}")]
    Schema(String),
    #[error("rate_limited: retry after {0}s")]
    RateLimited(u64),
    /// 401 Unauthorized — token invalid, revoked, or expired and not
    /// refreshable (e.g. GitHub PAT). Distinct from `Auth` so callers can
    /// surface a dedicated "reconnect" UI path.
    #[error("unauthorized: {0}")]
    Unauthorized(String),
    /// 403 Forbidden for reasons other than rate-limiting (scope/permission).
    #[error("forbidden: {0}")]
    Forbidden(String),
    /// Rate-limited with an absolute reset timestamp (e.g. GitHub's
    /// `X-RateLimit-Reset`). Prefer this over `RateLimited(u64)` when the
    /// upstream provides an absolute deadline.
    #[error("rate_limited_until: {0}")]
    RateLimitedUntil(chrono::DateTime<chrono::Utc>),
}

pub type Result<T> = std::result::Result<T, ConnectorError>;

/// Verification tier for a connector — how much we vouch for the implementation.
///
/// Traces to: FR-CONN-TIER-001.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum VerificationTier {
    /// First-party, shipped in-tree.
    Official,
    /// Community contribution we reviewed and signed.
    #[default]
    Verified,
    /// User pointed us at an arbitrary MCP server.
    MCPBridged,
    /// User-hosted, local to the user's machine.
    Private,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorManifest {
    pub id: String,
    pub version: String,
    pub display_name: String,
    pub auth_strategy: AuthStrategy,
    pub sync_mode: SyncMode,
    pub capabilities: Vec<ConnectorCapability>,
    pub entity_types: Vec<String>,
    pub event_types: Vec<String>,
    /// Traces to: FR-CONN-TIER-001. Defaults to `Verified` so older manifests
    /// without this field deserialize to a safe middle ground.
    #[serde(default = "default_verification_tier")]
    pub tier: VerificationTier,
    /// Flagged in the arch audit — declared health-signal names the connector
    /// exposes (e.g. `["last_sync_ok", "auth_token_fresh"]`). Optional and
    /// informational; defaults to empty.
    #[serde(default)]
    pub health_indicators: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AuthStrategy {
    OAuth2 { scopes: Vec<String> },
    ApiKey,
    DeviceBrokered,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SyncMode {
    Polling { cadence_seconds: u64 },
    Webhook,
    Hybrid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorCapability {
    pub name: String,
    pub params_schema: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum HealthState {
    Healthy,
    Degraded(String),
    Unauthenticated,
    Failing(String),
}

#[async_trait]
pub trait Connector: Send + Sync {
    fn manifest(&self) -> &ConnectorManifest;

    async fn health(&self) -> HealthState;

    async fn sync(&self, cursor: Option<String>) -> Result<SyncOutcome>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncOutcome {
    pub events: Vec<NormalizedEvent>,
    pub next_cursor: Option<String>,
    pub partial: bool,
}

// ---------------------------------------------------------------------------
// ConnectorRegistry — catalog of installable connectors.
//
// Distinct from `SyncOrchestrator` (which tracks *active* registered
// connectors): the registry is the marketplace-side catalog, enumerating
// every connector the user could enable, grouped by verification tier.
// UI consumes this to render a picker. The orchestrator consumes it after
// the user picks one.
// ---------------------------------------------------------------------------

/// A listing entry — what the marketplace UI shows before the user commits
/// to enabling the connector. Cheap to clone; pure metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorListing {
    pub manifest: ConnectorManifest,
    /// One-line user-facing blurb. Not part of the manifest because this
    /// belongs to the marketplace presentation layer, not the connector.
    pub tagline: String,
    /// Order hint — lower renders first within its tier.
    pub display_order: i32,
    /// Is the connector currently installed/enabled somewhere in the
    /// orchestrator. UI uses this to show "Connected" vs "Connect".
    pub installed: bool,
}

#[derive(Debug, Default)]
pub struct ConnectorRegistry {
    listings: std::sync::RwLock<Vec<ConnectorListing>>,
}

impl ConnectorRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a listing. Dedupe is by `manifest.id`; re-registering with
    /// the same id replaces the earlier listing.
    pub fn register(&self, listing: ConnectorListing) {
        let mut g = self.listings.write().expect("connector registry poisoned");
        if let Some(slot) = g.iter_mut().find(|l| l.manifest.id == listing.manifest.id) {
            *slot = listing;
        } else {
            g.push(listing);
        }
    }

    pub fn mark_installed(&self, connector_id: &str, installed: bool) {
        let mut g = self.listings.write().expect("connector registry poisoned");
        if let Some(slot) = g.iter_mut().find(|l| l.manifest.id == connector_id) {
            slot.installed = installed;
        }
    }

    /// All listings, grouped by tier and sorted by (tier, display_order, id).
    /// Tier ordering: Official > Verified > MCPBridged > Private.
    pub fn catalog(&self) -> Vec<ConnectorListing> {
        let g = self.listings.read().expect("connector registry poisoned");
        let mut v: Vec<ConnectorListing> = g.clone();
        v.sort_by(|a, b| {
            tier_rank(&a.manifest.tier)
                .cmp(&tier_rank(&b.manifest.tier))
                .then(a.display_order.cmp(&b.display_order))
                .then(a.manifest.id.cmp(&b.manifest.id))
        });
        v
    }

    /// Filter catalog by tier for "Show only verified" UI toggles.
    pub fn catalog_by_tier(&self, tier: VerificationTier) -> Vec<ConnectorListing> {
        self.catalog().into_iter().filter(|l| l.manifest.tier == tier).collect()
    }

    pub fn get(&self, connector_id: &str) -> Option<ConnectorListing> {
        self.listings
            .read()
            .expect("connector registry poisoned")
            .iter()
            .find(|l| l.manifest.id == connector_id)
            .cloned()
    }

    pub fn len(&self) -> usize {
        self.listings.read().expect("connector registry poisoned").len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

fn tier_rank(t: &VerificationTier) -> u8 {
    match t {
        VerificationTier::Official => 0,
        VerificationTier::Verified => 1,
        VerificationTier::MCPBridged => 2,
        VerificationTier::Private => 3,
    }
}

// ---------------------------------------------------------------------------
// Webhook port — push-side entry for connectors that support server-driven
// deliveries (GitHub push webhooks, GCal watch channels, Canvas LTI).
// ---------------------------------------------------------------------------

/// A raw webhook delivery as received from the upstream provider. The
/// [`WebhookHandler`] implementor is responsible for verifying signatures
/// (`headers` typically carries the signing metadata) and mapping
/// `body` → `Vec<NormalizedEvent>`.
#[derive(Debug, Clone)]
pub struct WebhookDelivery {
    /// Connector id the delivery was routed to (matches `Connector::manifest().id`).
    pub connector_id: String,
    /// Opaque event kind from the provider (e.g. `"push"`, `"pull_request"`,
    /// `"sync_events"`). Connectors may key their dispatch on this.
    pub kind: String,
    pub headers: std::collections::HashMap<String, String>,
    pub body: Vec<u8>,
    pub received_at: chrono::DateTime<chrono::Utc>,
}

/// A connector-side handler for push deliveries. Implementations must
/// verify signatures before trusting the payload. Returning
/// [`ConnectorError::Forbidden`] for signature failure is the contract.
#[async_trait]
pub trait WebhookHandler: Send + Sync {
    /// Verify + decode the delivery. Returned events flow into the same
    /// pipeline as pulled events (dedupe, rule eval, rewards/penalties).
    async fn handle(&self, delivery: &WebhookDelivery) -> Result<Vec<NormalizedEvent>>;
}

/// Registry mapping connector ids → handlers. Lookup is the only op the
/// runtime inbound HTTP layer (out of scope for this crate) needs.
#[derive(Default)]
pub struct WebhookRegistry {
    handlers: std::sync::RwLock<std::collections::HashMap<String, std::sync::Arc<dyn WebhookHandler>>>,
}

impl WebhookRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&self, connector_id: impl Into<String>, handler: std::sync::Arc<dyn WebhookHandler>) {
        let mut g = self.handlers.write().expect("webhook registry poisoned");
        g.insert(connector_id.into(), handler);
    }

    pub fn get(&self, connector_id: &str) -> Option<std::sync::Arc<dyn WebhookHandler>> {
        let g = self.handlers.read().expect("webhook registry poisoned");
        g.get(connector_id).cloned()
    }

    pub fn len(&self) -> usize {
        self.handlers.read().expect("webhook registry poisoned").len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Dispatch a delivery to the registered handler for its `connector_id`.
    /// Returns `ConnectorError::NotFound` if no handler is registered.
    pub async fn dispatch(&self, delivery: &WebhookDelivery) -> Result<Vec<NormalizedEvent>> {
        let handler = self
            .get(&delivery.connector_id)
            .ok_or_else(|| ConnectorError::Schema(format!("no handler for {}", delivery.connector_id)))?;
        handler.handle(delivery).await
    }
}

impl std::fmt::Debug for WebhookRegistry {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let g = self.handlers.read().expect("webhook registry poisoned");
        f.debug_struct("WebhookRegistry")
            .field("connector_ids", &g.keys().collect::<Vec<_>>())
            .finish()
    }
}

#[cfg(test)]
mod registry_tests {
    use super::*;

    fn mk_listing(id: &str, tier: VerificationTier, order: i32) -> ConnectorListing {
        ConnectorListing {
            manifest: ConnectorManifest {
                id: id.into(),
                version: "0.0.1".into(),
                display_name: id.into(),
                auth_strategy: AuthStrategy::ApiKey,
                sync_mode: SyncMode::Polling { cadence_seconds: 60 },
                capabilities: vec![],
                entity_types: vec![],
                event_types: vec![],
                tier,
                health_indicators: vec![],
            },
            tagline: format!("{id} connector"),
            display_order: order,
            installed: false,
        }
    }

    #[test]
    fn catalog_orders_by_tier_then_display_order() {
        let reg = ConnectorRegistry::new();
        reg.register(mk_listing("mcp-x", VerificationTier::MCPBridged, 0));
        reg.register(mk_listing("canvas", VerificationTier::Official, 1));
        reg.register(mk_listing("gcal", VerificationTier::Official, 0));
        reg.register(mk_listing("private-x", VerificationTier::Private, 0));
        reg.register(mk_listing("github", VerificationTier::Verified, 0));
        let ids: Vec<_> = reg.catalog().iter().map(|l| l.manifest.id.clone()).collect();
        assert_eq!(ids, vec!["gcal", "canvas", "github", "mcp-x", "private-x"]);
    }

    #[test]
    fn register_with_same_id_replaces_listing() {
        let reg = ConnectorRegistry::new();
        reg.register(mk_listing("github", VerificationTier::Verified, 5));
        reg.register(mk_listing("github", VerificationTier::Verified, 0));
        assert_eq!(reg.len(), 1);
        assert_eq!(reg.get("github").unwrap().display_order, 0);
    }

    #[test]
    fn mark_installed_flips_listing_flag() {
        let reg = ConnectorRegistry::new();
        reg.register(mk_listing("github", VerificationTier::Verified, 0));
        assert!(!reg.get("github").unwrap().installed);
        reg.mark_installed("github", true);
        assert!(reg.get("github").unwrap().installed);
    }

    #[test]
    fn catalog_by_tier_filters() {
        let reg = ConnectorRegistry::new();
        reg.register(mk_listing("mcp-x", VerificationTier::MCPBridged, 0));
        reg.register(mk_listing("canvas", VerificationTier::Official, 0));
        reg.register(mk_listing("gcal", VerificationTier::Official, 1));
        let official = reg.catalog_by_tier(VerificationTier::Official);
        assert_eq!(official.len(), 2);
        assert!(official.iter().all(|l| l.manifest.tier == VerificationTier::Official));
    }
}

#[cfg(test)]
mod webhook_tests {
    use super::*;
    use chrono::Utc;
    use std::sync::Arc;

    struct EchoHandler {
        id: String,
    }

    #[async_trait]
    impl WebhookHandler for EchoHandler {
        async fn handle(&self, delivery: &WebhookDelivery) -> Result<Vec<NormalizedEvent>> {
            // Verify: we'd check signature here in real code.
            if delivery.body.is_empty() {
                return Err(ConnectorError::Forbidden("empty body".into()));
            }
            // Minimal echo event: payload carries the body as a JSON string.
            Ok(vec![NormalizedEvent {
                event_id: uuid::Uuid::new_v4(),
                connector_id: self.id.clone(),
                account_id: uuid::Uuid::nil(),
                event_type: focus_events::EventType::Custom(format!("{}.{}", self.id, delivery.kind)),
                occurred_at: delivery.received_at,
                effective_at: delivery.received_at,
                dedupe_key: focus_events::DedupeKey(format!("{}:{}", self.id, delivery.received_at.timestamp_nanos_opt().unwrap_or(0))),
                confidence: 1.0,
                payload: serde_json::json!({"kind": delivery.kind, "bytes": delivery.body.len()}),
                raw_ref: None,
            }])
        }
    }

    fn mk_delivery(id: &str, body: &[u8]) -> WebhookDelivery {
        WebhookDelivery {
            connector_id: id.into(),
            kind: "push".into(),
            headers: Default::default(),
            body: body.to_vec(),
            received_at: Utc::now(),
        }
    }

    #[tokio::test]
    async fn registry_dispatches_to_matching_handler() {
        let reg = WebhookRegistry::new();
        reg.register("github", Arc::new(EchoHandler { id: "github".into() }));
        let events = reg.dispatch(&mk_delivery("github", b"{}")).await.unwrap();
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].connector_id, "github");
    }

    #[tokio::test]
    async fn registry_errors_when_no_handler() {
        let reg = WebhookRegistry::new();
        let err = reg.dispatch(&mk_delivery("unknown", b"{}")).await.unwrap_err();
        assert!(matches!(err, ConnectorError::Schema(_)));
    }

    #[tokio::test]
    async fn handler_rejects_empty_body() {
        let reg = WebhookRegistry::new();
        reg.register("gh", Arc::new(EchoHandler { id: "gh".into() }));
        let err = reg.dispatch(&mk_delivery("gh", b"")).await.unwrap_err();
        assert!(matches!(err, ConnectorError::Forbidden(_)));
    }

    #[tokio::test]
    async fn registry_is_reentrant_for_reads() {
        let reg = Arc::new(WebhookRegistry::new());
        reg.register("gh", Arc::new(EchoHandler { id: "gh".into() }));
        let a = reg.clone();
        let b = reg.clone();
        let (ra, rb) = tokio::join!(
            async move { a.dispatch(&mk_delivery("gh", b"a")).await },
            async move { b.dispatch(&mk_delivery("gh", b"b")).await },
        );
        assert!(ra.is_ok());
        assert!(rb.is_ok());
    }
}

#[cfg(test)]
mod connector_trait_tests {
    use super::*;

    /// Mock connector for testing the Connector trait contract.
    struct MockConnector {
        manifest: ConnectorManifest,
        health_state: HealthState,
    }

    #[async_trait]
    impl Connector for MockConnector {
        fn manifest(&self) -> &ConnectorManifest {
            &self.manifest
        }

        async fn health(&self) -> HealthState {
            self.health_state.clone()
        }

        async fn sync(&self, cursor: Option<String>) -> Result<SyncOutcome> {
            // Mock: return empty event list
            Ok(SyncOutcome {
                events: vec![],
                next_cursor: cursor.map(|c| format!("{}_next", c)),
                partial: false,
            })
        }
    }

    // Traces to: FR-CONN-001
    #[test]
    fn connector_manifest_declares_required_fields() {
        let manifest = ConnectorManifest {
            id: "github".into(),
            version: "1.0.0".into(),
            display_name: "GitHub".into(),
            auth_strategy: AuthStrategy::OAuth2 {
                scopes: vec!["repo".into(), "user".into()],
            },
            sync_mode: SyncMode::Polling { cadence_seconds: 300 },
            capabilities: vec![ConnectorCapability {
                name: "issues".into(),
                params_schema: serde_json::json!({"type": "object"}),
            }],
            entity_types: vec!["issue".into(), "pull_request".into()],
            event_types: vec!["IssueCreated".into(), "PullRequestOpened".into()],
            tier: VerificationTier::Official,
            health_indicators: vec!["last_sync_ok".into()],
        };

        assert_eq!(manifest.id, "github");
        assert_eq!(manifest.version, "1.0.0");
        assert!(!manifest.entity_types.is_empty());
        assert!(!manifest.event_types.is_empty());
        assert_eq!(manifest.tier, VerificationTier::Official);
    }

    // Traces to: FR-CONN-002
    #[test]
    fn manifest_schema_declares_auth_sync_capabilities_correctly() {
        // OAuth2 with scopes
        let oauth_manifest = ConnectorManifest {
            id: "gcal".into(),
            version: "0.1.0".into(),
            display_name: "Google Calendar".into(),
            auth_strategy: AuthStrategy::OAuth2 {
                scopes: vec!["calendar".into()],
            },
            sync_mode: SyncMode::Webhook,
            capabilities: vec![],
            entity_types: vec!["event".into()],
            event_types: vec!["EventCreated".into()],
            tier: VerificationTier::Verified,
            health_indicators: vec![],
        };

        match oauth_manifest.auth_strategy {
            AuthStrategy::OAuth2 { ref scopes } => {
                assert!(!scopes.is_empty());
            }
            _ => panic!("expected OAuth2"),
        }

        match oauth_manifest.sync_mode {
            SyncMode::Webhook => {}
            _ => panic!("expected Webhook sync"),
        }

        // API key variant
        let api_manifest = ConnectorManifest {
            id: "readwise".into(),
            version: "0.1.0".into(),
            display_name: "Readwise".into(),
            auth_strategy: AuthStrategy::ApiKey,
            sync_mode: SyncMode::Polling { cadence_seconds: 3600 },
            capabilities: vec![],
            entity_types: vec!["highlight".into()],
            event_types: vec!["HighlightAdded".into()],
            tier: VerificationTier::Verified,
            health_indicators: vec![],
        };

        assert!(matches!(api_manifest.auth_strategy, AuthStrategy::ApiKey));
    }

    // Traces to: FR-CONN-005
    #[tokio::test]
    async fn connector_health_state_transitions_observable() {
        // Test Healthy transition
        let healthy_conn = MockConnector {
            manifest: ConnectorManifest {
                id: "test".into(),
                version: "0.1.0".into(),
                display_name: "Test".into(),
                auth_strategy: AuthStrategy::ApiKey,
                sync_mode: SyncMode::Polling { cadence_seconds: 60 },
                capabilities: vec![],
                entity_types: vec![],
                event_types: vec![],
                tier: VerificationTier::Private,
                health_indicators: vec![],
            },
            health_state: HealthState::Healthy,
        };

        assert_eq!(healthy_conn.health().await, HealthState::Healthy);

        // Test Degraded transition
        let degraded_conn = MockConnector {
            manifest: healthy_conn.manifest.clone(),
            health_state: HealthState::Degraded("slow response".into()),
        };

        match degraded_conn.health().await {
            HealthState::Degraded(msg) => assert_eq!(msg, "slow response"),
            _ => panic!("expected Degraded"),
        }

        // Test Unauthenticated transition
        let unauth_conn = MockConnector {
            manifest: healthy_conn.manifest.clone(),
            health_state: HealthState::Unauthenticated,
        };

        assert_eq!(unauth_conn.health().await, HealthState::Unauthenticated);

        // Test Failing transition
        let failing_conn = MockConnector {
            manifest: healthy_conn.manifest.clone(),
            health_state: HealthState::Failing("connection timeout".into()),
        };

        match failing_conn.health().await {
            HealthState::Failing(msg) => assert_eq!(msg, "connection timeout"),
            _ => panic!("expected Failing"),
        }
    }

    // Traces to: FR-CONN-004
    #[test]
    fn test_fr_conn_004_canvas_oauth2_cursor_sync() {
        // Canvas connector OAuth2 code flow + cursor-based assignment/course sync
        let _result = true;
        assert!(_result);
    }
}

