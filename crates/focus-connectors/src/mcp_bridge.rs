// SPDX-License-Identifier: MIT OR Apache-2.0

//! Stub for the MCP-bridged connector class.
//!
//! `MCPBridgedConnector` lets a user point FocalPoint at any MCP server and
//! bolt it in as a connector. The concrete MCP wiring (stdio / SSE transport,
//! tool-call plumbing, capability negotiation) is deliberately out of scope
//! here — this module exists to claim the slot in the connector taxonomy so
//! higher-level code (manifest tier = `MCPBridged`, registry UI, audit) has a
//! real type to reason about.
//!
//! Traces to: FR-CONN-TIER-001.

use std::collections::HashMap;

use async_trait::async_trait;

use crate::{Connector, ConnectorError, ConnectorManifest, HealthState, Result, SyncOutcome};

/// A connector backed by an arbitrary external MCP server.
///
/// * `mcp_endpoint` — stdio command line or SSE URL identifying the server.
/// * `event_map`    — for each MCP tool-output field name, the
///   event type string it should be mapped to at normalize-time.
///   Key = mcp tool output field; value = event type display string
///   (either a canonical well-known name like `"AssignmentDue"` or a
///   `"connector_id:type"` custom form).
pub struct MCPBridgedConnector {
    manifest: ConnectorManifest,
    mcp_endpoint: String,
    event_map: HashMap<String, String>,
}

impl MCPBridgedConnector {
    pub fn new(
        manifest: ConnectorManifest,
        mcp_endpoint: impl Into<String>,
        event_map: HashMap<String, String>,
    ) -> Self {
        Self { manifest, mcp_endpoint: mcp_endpoint.into(), event_map }
    }

    pub fn mcp_endpoint(&self) -> &str {
        &self.mcp_endpoint
    }

    pub fn event_map(&self) -> &HashMap<String, String> {
        &self.event_map
    }

    /// Stable dedupe-key construction for MCP-bridged events: the MCP endpoint
    /// identity plus the tool-output field name form the key prefix, so two
    /// MCP servers offering the same field name don't collide.
    pub fn dedupe_prefix(&self, output_field: &str) -> String {
        format!("mcp:{}:{}", self.mcp_endpoint, output_field)
    }
}

#[async_trait]
impl Connector for MCPBridgedConnector {
    fn manifest(&self) -> &ConnectorManifest {
        &self.manifest
    }

    async fn health(&self) -> HealthState {
        // Until the MCP transport is wired up we cannot talk to the server;
        // surface `Failing` rather than lying with `Healthy`.
        HealthState::Failing("MCP bridge not yet wired to MCP client".into())
    }

    async fn sync(&self, _cursor: Option<String>) -> Result<SyncOutcome> {
        Err(ConnectorError::Network("MCP bridge not yet wired to MCP client".into()))
    }
}

#[cfg(test)]
#[allow(clippy::disallowed_methods)]
mod tests {
    use super::*;
    use crate::{AuthStrategy, SyncMode, VerificationTier};

    fn mk_manifest() -> ConnectorManifest {
        ConnectorManifest {
            id: "mcp-notes".into(),
            version: "0.1.0".into(),
            display_name: "Notes via MCP".into(),
            auth_strategy: AuthStrategy::None,
            sync_mode: SyncMode::Polling { cadence_seconds: 300 },
            capabilities: vec![],
            entity_types: vec!["note".into()],
            event_types: vec!["task_added".into()],
            tier: VerificationTier::MCPBridged,
            health_indicators: vec!["mcp_reachable".into()],
        }
    }

    // Traces to: FR-CONN-TIER-001
    #[test]
    fn manifest_shape_exposes_tier_and_health_indicators() {
        let m = mk_manifest();
        assert_eq!(m.tier, VerificationTier::MCPBridged);
        assert_eq!(m.health_indicators, vec!["mcp_reachable".to_string()]);
    }

    // Traces to: FR-CONN-TIER-001
    #[test]
    fn tier_defaults_to_verified_when_deserializing_legacy_manifest() {
        // Simulate a manifest JSON authored before `tier` existed. The
        // `AuthStrategy::None` variant is a unit variant so serde expects the
        // string "None".
        let legacy_json = r#"{
            "id": "legacy",
            "version": "0.1.0",
            "display_name": "Legacy",
            "auth_strategy": "None",
            "sync_mode": {"Polling": {"cadence_seconds": 60}},
            "capabilities": [],
            "entity_types": [],
            "event_types": []
        }"#;
        let m: ConnectorManifest =
            serde_json::from_str(legacy_json).expect("legacy manifest parses");
        assert_eq!(m.tier, VerificationTier::Verified);
        assert!(m.health_indicators.is_empty());
    }

    // Traces to: FR-CONN-TIER-001
    #[test]
    fn dedupe_prefix_uses_endpoint_and_field() {
        let c = MCPBridgedConnector::new(
            mk_manifest(),
            "stdio:/usr/local/bin/my-mcp",
            HashMap::from([("tasks".to_string(), "task_added".to_string())]),
        );
        let k1 = c.dedupe_prefix("tasks");
        let k2 = c.dedupe_prefix("notes");
        assert_ne!(k1, k2);
        assert!(k1.starts_with("mcp:stdio:/usr/local/bin/my-mcp:"));
        assert_eq!(c.event_map().get("tasks"), Some(&"task_added".to_string()));
    }

    // Traces to: FR-CONN-TIER-001
    #[tokio::test]
    async fn sync_returns_not_wired_error() {
        let c =
            MCPBridgedConnector::new(mk_manifest(), "stdio:/usr/local/bin/my-mcp", HashMap::new());
        let err = c.sync(None).await.expect_err("sync should error until MCP wired");
        match err {
            ConnectorError::Network(msg) => assert!(msg.contains("MCP")),
            other => panic!("expected Network error, got {other:?}"),
        }
    }
}
