//! OmniRoute MCP (Model Context Protocol) server.
//!
//! Stub — full impl in v2. Re-exports the public surface so downstream crates
//! (omni-server) can wire it.

#![forbid(unsafe_code)]

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

/// MCP tool definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolDef {
    pub name: String,
    pub description: String,
    /// JSON schema for the tool's input.
    pub input_schema: serde_json::Value,
}

/// MCP tool call result.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolResult {
    pub content: Vec<ToolContent>,
    pub is_error: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ToolContent {
    Text { text: String },
    Image { data: String, mime_type: String },
    Resource { uri: String, text: Option<String> },
}

/// MCP server. Holds a registry of tools.
#[derive(Default, Clone)]
pub struct McpServer {
    tools: Arc<RwLock<HashMap<String, ToolDef>>>,
}

impl McpServer {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&self, tool: ToolDef) {
        self.tools.write().insert(tool.name.clone(), tool);
    }

    pub fn list(&self) -> Vec<ToolDef> {
        self.tools.read().values().cloned().collect()
    }

    pub fn get(&self, name: &str) -> Option<ToolDef> {
        self.tools.read().get(name).cloned()
    }
}

pub use rmcp as upstream;
