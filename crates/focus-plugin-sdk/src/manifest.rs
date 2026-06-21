// SPDX-License-Identifier: MIT OR Apache-2.0

//! Plugin manifest schema for capability declaration and metadata.

use serde::{Deserialize, Serialize};

/// Top-level plugin manifest.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub plugin: PluginMetadata,
    pub capabilities: PluginCapabilities,
    #[serde(default)]
    pub interface: PluginInterface,
}

/// Plugin metadata section.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    pub name: String,
    pub version: String,
    pub authors: Vec<String>,
    pub description: String,
    #[serde(rename = "type")]
    pub plugin_type: String,
    pub api_version: String,
}

/// Capability declaration: phase-2 supports http_client with allowlist and timer.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginCapabilities {
    #[serde(default)]
    pub http: Option<HttpCapabilityDecl>,
    #[serde(default)]
    pub filesystem: Option<FilesystemScope>,
    #[serde(default)]
    pub timer: bool,
}

/// HTTP capability declaration with domain allowlist.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HttpCapabilityDecl {
    /// Domains this plugin is allowed to reach (e.g., ["api.slack.com", "*.slack.com"]).
    pub allowlist: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilesystemScope {
    pub scope: String,
}

/// Plugin interface definition.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PluginInterface {
    #[serde(default)]
    pub connector: Option<ConnectorInterface>,
}

/// Connector-specific interface.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorInterface {
    pub scope: String,
    pub auth: String,
    pub events: Vec<EventDefinition>,
}

/// Event schema definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventDefinition {
    pub name: String,
    pub fields: Vec<String>,
}
