//! OpenAI Codex CLI wire types. Slim — the Codex CLI speaks a small
//! instruction-driven subset of the OpenAI chat shape with a few extra
//! `codex-*` headers and a sandboxed tool-calling surface.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CodexRequest {
    pub model: String,
    /// `instructions` is the system-level role; treated like OpenAI's
    /// system message at index 0.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instructions: Option<String>,
    pub input: Vec<CodexMessage>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_output_tokens: Option<u32>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<CodexTool>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sandbox: Option<SandboxPolicy>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub working_directory: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thread_id: Option<String>,

    #[serde(default)]
    pub stream: bool,

    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CodexMessage {
    pub role: CodexRole,
    pub content: CodexContent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CodexRole {
    User,
    Assistant,
    System,
    Developer,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum CodexContent {
    Text(String),
    Parts(Vec<CodexPart>),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum CodexPart {
    Text { text: String },
    ImageUrl { image_url: crate::openai::common::ImageUrl },
    ToolCall { id: String, name: String, arguments: String },
    ToolResult { tool_call_id: String, output: String },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CodexTool {
    #[serde(rename = "type")]
    pub kind: String, // "function" | "codex_sandboxed_command"
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parameters: Option<serde_json::Value>,
    /// For sandboxed shell: requires "shell" sandbox scope.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sandbox: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SandboxPolicy {
    ReadOnly,
    WorkspaceWrite {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        writable_roots: Option<Vec<String>>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        network_access: Option<bool>,
    },
    DangerFullAccess,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CodexResponse {
    pub id: String,
    pub object: String,
    pub created: i64,
    pub model: String,
    pub output: Vec<CodexOutputItem>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub usage: Option<crate::openai::common::Usage>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thread_id: Option<String>,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum CodexOutputItem {
    Message {
        id: String,
        role: String,
        content: crate::openai::common::MessageContent,
    },
    FunctionCall {
        id: String,
        call_id: String,
        name: String,
        arguments: String,
    },
    Reasoning {
        id: String,
        summary: Vec<serde_json::Value>,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn codex_request_minimal() {
        let r = CodexRequest {
            model: "codex-1".into(),
            instructions: None,
            input: vec![CodexMessage {
                role: CodexRole::User,
                content: CodexContent::Text("write a fib".into()),
            }],
            temperature: None,
            top_p: None,
            max_output_tokens: None,
            tools: None,
            tool_choice: None,
            sandbox: None,
            working_directory: None,
            thread_id: None,
            stream: false,
            extra: IndexMap::new(),
        };
        let j = serde_json::to_string(&r).unwrap();
        assert!(j.contains("\"model\":\"codex-1\""));
    }

    #[test]
    fn sandbox_policy_workspace_write() {
        let s = SandboxPolicy::WorkspaceWrite {
            writable_roots: Some(vec!["/tmp".into()]),
            network_access: Some(false),
        };
        let j = serde_json::to_string(&s).unwrap();
        assert!(j.contains("\"type\":\"workspace_write\""));
        assert!(j.contains("\"writable_roots\""));
    }
}
