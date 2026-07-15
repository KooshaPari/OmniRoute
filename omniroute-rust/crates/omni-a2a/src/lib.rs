//! OmniRoute A2A (Agent-to-Agent) protocol implementation.
//!
//! Stub — full impl in v2. Re-exports the public surface so downstream crates
//! (omni-server) can wire it.

#![forbid(unsafe_code)]

use std::collections::HashMap;
use std::sync::Arc;

use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

/// A2A agent card (advertised at `/.well-known/agent.json`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentCard {
    pub name: String,
    pub description: String,
    pub version: String,
    pub skills: Vec<Skill>,
    pub endpoints: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    pub id: String,
    pub name: String,
    pub description: String,
}

/// A2A task state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskState {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// A2A task.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub state: TaskState,
    pub input: serde_json::Value,
    pub output: Option<serde_json::Value>,
    pub error: Option<String>,
}

/// A2A registry.
#[derive(Default, Clone)]
pub struct A2aRegistry {
    tasks: Arc<RwLock<HashMap<String, Task>>>,
}

impl A2aRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn submit(&self, task: Task) {
        self.tasks.write().insert(task.id.clone(), task);
    }

    pub fn get(&self, id: &str) -> Option<Task> {
        self.tasks.read().get(id).cloned()
    }

    pub fn list(&self) -> Vec<Task> {
        self.tasks.read().values().cloned().collect()
    }
}
