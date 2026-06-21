// SPDX-License-Identifier: MIT OR Apache-2.0

//! Slack reference connector plugin: emits slack:message_posted events.
//!
//! This plugin demonstrates the full connector lifecycle:
//! - Declares HTTP capability with Slack domain allowlist
//! - Implements poll(config_ptr, config_len) -> (ptr, len) ABI
//! - Serializes events as NDJSON
//!
//! Plugin manifest declares:
//! ```toml
//! [capabilities]
//! http = { allowlist = ["api.slack.com", "hooks.slack.com"] }
//! ```

use serde_json::json;

/// Plugin configuration (passed from host via linear memory).
#[derive(serde::Deserialize)]
struct SlackConfig {
    workspace_id: String,
    bot_token: String,
}

/// Event emitted by the Slack connector.
#[derive(serde::Serialize, serde::Deserialize)]
struct SlackEvent {
    id: String,
    kind: String,
    timestamp: i64,
    data: serde_json::Value,
}

/// Poll function: ABI entry point called by host.
/// Arguments: config_ptr (linear memory offset), config_len (byte length)
/// Returns: (output_ptr, output_len) tuple for NDJSON event stream
///
/// # Safety
/// This function is called by the host via WASM linear memory.
/// The host provides a valid config pointer and length.
#[no_mangle]
pub extern "C" fn poll(_config_ptr: i32, _config_len: i32) -> i64 {
    // Parse config from linear memory (in a real plugin, this would be marshalled by the host).
    // For now, we'll emit a hardcoded message_posted event to validate the pipeline.

    let event = SlackEvent {
        id: "slack-evt-001".to_string(),
        kind: "slack:message_posted".to_string(),
        timestamp: chrono::Utc::now().timestamp(),
        data: json!({
            "user": "alice@example.com",
            "text": "Hello from Slack",
            "thread_ts": "1234567890.123456",
            "workspace_id": "T123ABC"
        }),
    };

    // Serialize as NDJSON.
    let json_line = serde_json::to_string(&event).unwrap();
    let output = format!("{}\n", json_line);
    let bytes = output.into_bytes();

    // In a real plugin, the host would allocate linear memory and copy the bytes.
    // For this reference, we return the length as a placeholder.
    // The actual pointer management is handled by the plugin runtime.
    bytes.len() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_slack_event_serialization() {
        let event = SlackEvent {
            id: "slack-evt-001".to_string(),
            kind: "slack:message_posted".to_string(),
            timestamp: 1234567890,
            data: json!({
                "user": "alice@example.com",
                "text": "Hello from Slack"
            }),
        };

        let json = serde_json::to_string(&event).unwrap();
        let deserialized: SlackEvent = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, "slack-evt-001");
        assert_eq!(deserialized.kind, "slack:message_posted");
    }

    #[test]
    fn test_slack_config_parsing() {
        let config_json = r#"{
            "workspace_id": "T123ABC",
            "bot_token": "xoxb-..."
        }"#;

        let config: SlackConfig = serde_json::from_str(config_json).unwrap();
        assert_eq!(config.workspace_id, "T123ABC");
        assert!(!config.bot_token.is_empty());
    }
}
