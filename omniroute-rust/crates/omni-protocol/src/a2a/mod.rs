//! Agent-to-Agent Protocol v0.3 wire types (minimal).
//!
//! These are the type-only placeholders. The full `omni-a2a` crate will
//! implement the protocol on top of these shapes.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

/// Public agent metadata. A2A v0.3 calls this the "Agent Card".
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct AgentCard {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider: Option<AgentProvider>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub capabilities: Option<AgentCapabilities>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_input_modes: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub default_output_modes: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub skills: Option<Vec<AgentSkill>>,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct AgentProvider {
    pub organization: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct AgentCapabilities {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub streaming: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub push_notifications: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state_transition_history: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub extensions: Option<Vec<AgentExtension>>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct AgentExtension {
    pub uri: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub required: Option<bool>,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub params: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct AgentSkill {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub examples: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub input_modes: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output_modes: Option<Vec<String>>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub context_id: Option<String>,
    pub status: TaskStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub history: Option<Vec<Message>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub artifacts: Option<Vec<Artifact>>,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub metadata: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct TaskStatus {
    pub state: TaskState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<Message>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum TaskState {
    Submitted,
    Working,
    InputRequired,
    Completed,
    Canceled,
    Failed,
    AuthRequired,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Message {
    pub role: MessageRole,
    pub parts: Vec<Part>,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub metadata: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageRole {
    User,
    Agent,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Part {
    Text { text: String },
    File { file: FileContent },
    Data { data: serde_json::Value },
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FileContent {
    pub name: Option<String>,
    pub mime_type: Option<String>,
    pub bytes: Option<String>, // base64
    pub uri: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Artifact {
    pub name: Option<String>,
    pub description: Option<String>,
    pub parts: Vec<Part>,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub metadata: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SendTaskRequest {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    pub message: Message,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub metadata: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SendTaskResponse {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub result: Option<Task>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<A2aError>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GetTaskRequest {
    pub id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub history_length: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CancelTaskRequest {
    pub id: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct A2aError {
    pub code: i32,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn task_state_kebab() {
        let s = serde_json::to_string(&TaskState::InputRequired).unwrap();
        assert_eq!(s, "\"input-required\"");
    }

    #[test]
    fn agent_card_round_trip() {
        let c = AgentCard {
            name: "echo".into(),
            description: Some("echoes input".into()),
            url: Some("https://x".into()),
            version: Some("0.1.0".into()),
            provider: Some(AgentProvider { organization: "phenotype".into(), url: None }),
            capabilities: Some(AgentCapabilities {
                streaming: Some(true),
                push_notifications: Some(false),
                state_transition_history: Some(true),
                extensions: None,
            }),
            default_input_modes: Some(vec!["text".into()]),
            default_output_modes: Some(vec!["text".into()]),
            skills: Some(vec![AgentSkill {
                id: "echo".into(),
                name: "echo".into(),
                description: None,
                tags: None,
                examples: None,
                input_modes: None,
                output_modes: None,
            }]),
            extra: IndexMap::new(),
        };
        let j = serde_json::to_string(&c).unwrap();
        let back: AgentCard = serde_json::from_str(&j).unwrap();
        assert_eq!(c, back);
    }
}
