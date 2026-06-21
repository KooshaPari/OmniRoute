// SPDX-License-Identifier: MIT OR Apache-2.0

//! Plugin trait and ABI definitions for WASM connectors.

use serde::{Deserialize, Serialize};

/// ConnectorPlugin trait: standard ABI for WASM plugins.
///
/// Plugins implement a single exported function:
/// `poll(config_ptr: i32, config_len: i32) -> i64`
///
/// The returned i64 packs two i32 values:
/// - High 32 bits: pointer to NDJSON event buffer
/// - Low 32 bits: length of buffer in bytes
pub trait ConnectorPlugin: Send + Sync {
    /// Poll for events, returning NDJSON-formatted event stream.
    fn poll(&self, config: PluginConfig) -> Result<Vec<u8>, String>;
}

/// Configuration passed to plugin via linear memory.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginConfig {
    pub client_id: String,
    pub client_secret: String,
    pub workspace_id: Option<String>,
}

/// NDJSON event serialization.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NdjsonEvent {
    pub id: String,
    pub kind: String,
    pub timestamp: i64,
    pub data: serde_json::Value,
}

impl NdjsonEvent {
    /// Serialize event to NDJSON line (includes newline).
    pub fn to_ndjson(&self) -> String {
        format!("{}\n", serde_json::to_string(self).unwrap_or_default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ndjson_event_serialization() {
        let event = NdjsonEvent {
            id: "msg-001".to_string(),
            kind: "message".to_string(),
            timestamp: 1234567890,
            data: serde_json::json!({
                "user": "alice",
                "text": "hello world"
            }),
        };

        let ndjson = event.to_ndjson();
        assert!(ndjson.ends_with('\n'));
        let parsed: NdjsonEvent = serde_json::from_str(ndjson.trim())
            .expect("failed to parse NDJSON");
        assert_eq!(parsed.id, event.id);
    }

    #[test]
    fn test_plugin_config_serialization() {
        let config = PluginConfig {
            client_id: "slack-client".to_string(),
            client_secret: "secret123".to_string(),
            workspace_id: Some("workspace-1".to_string()),
        };

        let json = serde_json::to_string(&config).unwrap();
        let deserialized: PluginConfig = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.client_id, config.client_id);
        assert_eq!(deserialized.workspace_id, config.workspace_id);
    }
}
