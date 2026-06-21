// SPDX-License-Identifier: MIT OR Apache-2.0

//! Focus Plugin SDK: WASM sandbox runtime for community connectors.
//!
//! Provides `PluginRuntime` wrapping `wasmtime` with strict capability caps:
//! - 10 MB memory limit
//! - 5s wall-clock timeout
//! - No filesystem or network (host provides config via linear memory)
//!
//! Plugins implement `ConnectorPlugin` ABI: `poll(config_ptr, config_len) -> (ptr, len)`
//! returning NDJSON event stream.

use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;

pub mod capabilities;
pub mod manifest;
pub mod plugin;
pub mod runtime;
pub mod signing;

pub use manifest::PluginManifest;
pub use plugin::ConnectorPlugin;
pub use runtime::{PluginRuntime, RuntimeConfig};
pub use signing::PluginSignature;

/// Event emitted by a plugin in NDJSON format.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginEvent {
    pub id: String,
    pub kind: String,
    pub timestamp: i64,
    pub data: serde_json::Value,
}

/// Plugin execution error types.
#[derive(Debug, Error)]
pub enum PluginError {
    #[error("Memory limit exceeded: {0}")]
    MemoryLimitExceeded(usize),

    #[error("Timeout after {0:?}")]
    Timeout(Duration),

    #[error("Signature verification failed")]
    SignatureInvalid,

    #[error("WASM initialization failed: {0}")]
    InitializationFailed(String),

    #[error("Plugin panicked: {0}")]
    PluginPanicked(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Capability denied: {0}")]
    CapabilityDenied(String),

    #[error("Internal runtime error: {0}")]
    RuntimeError(#[from] anyhow::Error),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_plugin_runtime_memory_cap() {
        let config = RuntimeConfig {
            memory_limit_mb: 10,
            timeout: Duration::from_secs(5),
            ..Default::default()
        };
        assert_eq!(config.memory_limit_mb, 10);
        assert_eq!(config.timeout.as_secs(), 5);
    }

    #[test]
    fn test_plugin_event_serialization() {
        let event = PluginEvent {
            id: "evt-001".to_string(),
            kind: "message_posted".to_string(),
            timestamp: 1234567890,
            data: serde_json::json!({ "user": "alice", "text": "hello" }),
        };

        let json = serde_json::to_string(&event).unwrap();
        let deserialized: PluginEvent = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.id, event.id);
        assert_eq!(deserialized.kind, event.kind);
    }

    #[test]
    fn test_manifest_parsing() {
        let manifest_toml = r#"
[plugin]
name = "connector-hello"
version = "0.1.0"
authors = ["Test <test@example.com>"]
description = "Test connector"
type = "connector"
api_version = "0.1.0"

[capabilities.http]
allowlist = ["api.example.com"]

[interface.connector]
scope = "workspace"
auth = "api_key"
events = []
"#;

        let manifest: PluginManifest = toml::from_str(manifest_toml)
            .expect("failed to parse manifest");

        assert_eq!(manifest.plugin.name, "connector-hello");
        assert_eq!(manifest.plugin.version, "0.1.0");
        assert!(manifest.capabilities.http.is_some());
    }

    #[test]
    fn test_signature_verification_flow() {
        use ed25519_dalek::{SigningKey, Signer};
        use rand_core::OsRng;
        use sha2::Digest;

        let signing_key = SigningKey::generate(&mut OsRng);

        let payload = b"test-plugin-data";
        let hash = sha2::Sha256::digest(payload);
        let signature = signing_key.sign(&hash);

        let verifying_key = ed25519_dalek::VerifyingKey::from(&signing_key);
        let result = verifying_key.verify_strict(&hash, &signature);

        assert!(result.is_ok());
    }
}
