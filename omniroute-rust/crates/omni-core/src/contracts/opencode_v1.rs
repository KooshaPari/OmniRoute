// SPDX-License-Identifier: MIT OR Apache-2.0
// OpenCode plugin contract v1 — wire shape lock (D-omni-08, PR-2)
//
// This contract is the canonical surface for any plugin consuming the
// OmniRoute model catalog. It is pinned at contract_version = "v1" and
// will only evolve via additive changes within v1, or via a major
// version bump that ships a parallel v2 endpoint.
//
// See: docs/contracts/opencode-plugin-contract.md
// Sign-off: docs/sessions/20260705-omniroute-backend-rewrite/05-decisions/00-D-OMNI-SIGNOFF.md
// Risk mitigated: R-omni-4 (plugin break on model-shape change)

use serde::{Deserialize, Serialize};

/// Bumped when the wire shape changes incompatibly.
pub const OPENCODE_CONTRACT_VERSION: &str = "v1";

/// Wire-shape response for `GET /v1/models`.
///
/// Any field marked `#[serde(default)]` is allowed to be absent on the
/// wire; consumers must tolerate missing optional fields. Required
/// fields MUST be present. Additive fields MAY be added in a minor
/// version within v1.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModelsResponseV1 {
    pub object: String, // always "list"
    pub data: Vec<ModelV1>,
    #[serde(default)]
    pub has_more: bool,
    #[serde(default)]
    pub last_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModelV1 {
    pub id: String,
    pub object: String, // always "model"
    pub created: i64,
    pub owned_by: String,
    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub capabilities: ModelCapabilitiesV1,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct ModelCapabilitiesV1 {
    #[serde(default)]
    pub chat: bool,
    #[serde(default)]
    pub stream: bool,
    #[serde(default)]
    pub tools: bool,
    #[serde(default)]
    pub vision: bool,
    #[serde(default)]
    pub json_mode: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn contract_version_is_pinned_v1() {
        assert_eq!(OPENCODE_CONTRACT_VERSION, "v1");
    }

    #[test]
    fn minimal_models_response_roundtrips() {
        // The minimum a provider MUST emit to satisfy the v1 contract.
        let raw = r#"{
            "object": "list",
            "data": [
                {
                    "id": "gpt-4o-mini",
                    "object": "model",
                    "created": 1721260800,
                    "owned_by": "openai"
                }
            ]
        }"#;
        let parsed: ModelsResponseV1 = serde_json::from_str(raw).expect("must parse");
        assert_eq!(parsed.object, "list");
        assert_eq!(parsed.data.len(), 1);
        let m = &parsed.data[0];
        assert_eq!(m.id, "gpt-4o-mini");
        assert_eq!(m.object, "model");
        // All optional fields default cleanly.
        assert!(m.display_name.is_none());
        assert!(!m.capabilities.chat);
        // has_more absent → default false.
        assert!(!parsed.has_more);
        assert!(parsed.last_id.is_none());
    }

    #[test]
    fn full_models_response_roundtrips() {
        let raw = r#"{
            "object": "list",
            "data": [
                {
                    "id": "claude-sonnet-4-5",
                    "object": "model",
                    "created": 1751328000,
                    "owned_by": "anthropic",
                    "display_name": "Claude Sonnet 4.5",
                    "capabilities": {
                        "chat": true,
                        "stream": true,
                        "tools": true,
                        "vision": true,
                        "json_mode": true
                    }
                }
            ],
            "has_more": false,
            "last_id": "claude-sonnet-4-5"
        }"#;
        let parsed: ModelsResponseV1 = serde_json::from_str(raw).expect("must parse");
        assert_eq!(parsed.data[0].capabilities.tools, true);
        assert_eq!(parsed.data[0].display_name.as_deref(), Some("Claude Sonnet 4.5"));
        assert_eq!(parsed.last_id.as_deref(), Some("claude-sonnet-4-5"));
    }

    #[test]
    fn missing_object_field_is_rejected() {
        // Hard contract: object MUST be "model".
        let raw = r#"{
            "data": []
        }"#;
        let result: Result<ModelsResponseV1, _> = serde_json::from_str(raw);
        assert!(result.is_err(), "missing object field must be rejected");
    }

    #[test]
    fn unknown_capability_fields_are_tolerated() {
        // Additive changes within v1 are allowed; unknown capability keys
        // must not break consumers that haven't been updated yet.
        let raw = r#"{
            "object": "list",
            "data": [{
                "id": "gpt-4o",
                "object": "model",
                "created": 1,
                "owned_by": "openai",
                "capabilities": {
                    "chat": true,
                    "future_capability_x": "ignored"
                }
            }]
        }"#;
        let parsed: ModelsResponseV1 = serde_json::from_str(raw).expect("must parse");
        assert!(parsed.data[0].capabilities.chat);
    }
}
