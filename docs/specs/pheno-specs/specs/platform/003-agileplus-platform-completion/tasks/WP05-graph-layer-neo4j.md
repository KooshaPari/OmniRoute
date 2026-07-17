---
work_package_id: WP05
title: Graph Layer (Neo4j)
lane: "done"
dependencies: []
base_branch: main
base_commit: e441120abb2a1454a9ee3b6b49a38ea9eef9962f
created_at: '2026-03-02T11:50:57.274484+00:00'
subtasks: [T028, T029, T030, T031, T032, T033]
shell_pid: "52715"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

# Graph Layer (Neo4j) (WP05)

## Overview

Create the `agileplus-graph` crate with Neo4j connectivity, node/relationship CRUD operations, and graph queries for dependency analysis and project navigation.

## Objective

Implement:
- Neo4j connection management
- Node types with uniqueness constraints
- Relationship CRUD operations
- Dependency chain traversal
- Project-scoped queries
- Health monitoring

## Architecture

The graph layer models:
- **Features** as nodes with state and metadata
- **WorkPackages** as nodes with ordinal sequencing
- **Agents** as nodes representing users/systems
- **Labels** as nodes for tagging
- **Projects** as nodes for organizational grouping
- **Relationships** connecting all entities with semantic meaning

## Subtasks

### T028: Scaffold agileplus-graph Crate

Create a new crate at `crates/agileplus-graph/`.

**Cargo.toml:**
```toml
[package]
name = "agileplus-graph"
version = "0.1.0"
edition = "2021"

[dependencies]
agileplus-domain = { path = "../agileplus-domain" }
neo4rs = "0.7"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"
async-trait = "0.1"
tokio = { version = "1", features = ["full"] }

[dev-dependencies]
tokio = { version = "1", features = ["full"] }
```

**Directory structure:**
```
crates/agileplus-graph/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── config.rs
    ├── store.rs
    ├── nodes.rs
    ├── relationships.rs
    ├── queries.rs
    └── health.rs
```

**lib.rs content:**
```rust
pub mod config;
pub mod health;
pub mod nodes;
pub mod queries;
pub mod relationships;
pub mod store;

pub use config::GraphConfig;
pub use health::GraphHealth;
pub use nodes::NodeStore;
pub use queries::GraphQueries;
pub use relationships::RelationshipStore;
pub use store::{GraphError, GraphStore};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Graph error: {0}")]
    Graph(#[from] GraphError),
    #[error("Config error: {0}")]
    Config(String),
}
```

### T029: GraphConfig and GraphStore

Create `crates/agileplus-graph/src/config.rs`:

```rust
#[derive(Clone, Debug)]
pub struct GraphConfig {
    pub bolt_uri: String,
    pub username: String,
    pub password: String,
    pub database: String,
}

impl GraphConfig {
    pub fn new(bolt_uri: String, username: String, password: String) -> Self {
        GraphConfig {
            bolt_uri,
            username,
            password,
            database: "neo4j".to_string(),
        }
    }

    pub fn with_database(mut self, db: String) -> Self {
        self.database = db;
        self
    }
}

impl Default for GraphConfig {
    fn default() -> Self {
        GraphConfig {
            bolt_uri: "bolt://localhost:7687".to_string(),
            username: "neo4j".to_string(),
            password: "agileplus".to_string(),
            database: "neo4j".to_string(),
        }
    }
}
```

Create `crates/agileplus-graph/src/store.rs`:

```rust
use crate::config::GraphConfig;
use neo4rs::Graph;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum GraphError {
    #[error("Connection error: {0}")]
    ConnectionError(String),
    #[error("Query error: {0}")]
    QueryError(String),
    #[error("Constraint violation: {0}")]
    ConstraintViolation(String),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

pub struct GraphStore {
    graph: Graph,
}

impl GraphStore {
    pub async fn new(config: GraphConfig) -> Result<Self, GraphError> {
        let graph = Graph::new(
            config.bolt_uri.clone(),
            config.username.clone(),
            config.password.clone(),
        )
        .await
        .map_err(|e| GraphError::ConnectionError(e.to_string()))?;

        Ok(GraphStore { graph })
    }

    pub fn raw_graph(&self) -> &Graph {
        &self.graph
    }

    pub async fn init_constraints(&self) -> Result<(), GraphError> {
        // Create uniqueness constraints for all node types
        // Feature uniqueness on id
        self.graph
            .run(
                neo4rs::query(
                    "CREATE CONSTRAINT feature_id IF NOT EXISTS FOR (f:Feature) REQUIRE f.id IS UNIQUE",
                ),
            )
            .await
            .ok(); // Ignore if constraint already exists

        // WorkPackage uniqueness on id
        self.graph
            .run(
                neo4rs::query(
                    "CREATE CONSTRAINT workpackage_id IF NOT EXISTS FOR (w:WorkPackage) REQUIRE w.id IS UNIQUE",
                ),
            )
            .await
            .ok();

        // Agent uniqueness on name
        self.graph
            .run(
                neo4rs::query(
                    "CREATE CONSTRAINT agent_name IF NOT EXISTS FOR (a:Agent) REQUIRE a.name IS UNIQUE",
                ),
            )
            .await
            .ok();

        // Label uniqueness on name
        self.graph
            .run(
                neo4rs::query(
                    "CREATE CONSTRAINT label_name IF NOT EXISTS FOR (l:Label) REQUIRE l.name IS UNIQUE",
                ),
            )
            .await
            .ok();

        // Project uniqueness on slug
        self.graph
            .run(
                neo4rs::query(
                    "CREATE CONSTRAINT project_slug IF NOT EXISTS FOR (p:Project) REQUIRE p.slug IS UNIQUE",
                ),
            )
            .await
            .ok();

        Ok(())
    }

    pub async fn health_check(&self) -> Result<(), GraphError> {
        self.graph
            .run(neo4rs::query("RETURN 1"))
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))
    }
}
```

### T030: Node Types and Operations

Create `crates/agileplus-graph/src/nodes.rs`:

```rust
use crate::store::{GraphError, GraphStore};
use serde_json::json;

pub struct NodeStore<'a> {
    store: &'a GraphStore,
}

impl<'a> NodeStore<'a> {
    pub fn new(store: &'a GraphStore) -> Self {
        NodeStore { store }
    }

    // === Feature Node Operations ===

    pub async fn create_feature(
        &self,
        id: i64,
        slug: String,
        state: String,
        friendly_name: String,
    ) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(
                neo4rs::query(
                    "CREATE (f:Feature {id: $id, slug: $slug, state: $state, friendly_name: $friendly_name})",
                )
                .param("id", id)
                .param("slug", slug)
                .param("state", state)
                .param("friendly_name", friendly_name),
            )
            .await
            .map_err(|e| {
                if e.to_string().contains("Constraint") {
                    GraphError::ConstraintViolation(e.to_string())
                } else {
                    GraphError::QueryError(e.to_string())
                }
            })?;
        Ok(())
    }

    pub async fn get_feature(&self, feature_id: i64) -> Result<Option<serde_json::Value>, GraphError> {
        let mut result = self
            .store
            .raw_graph()
            .execute(
                neo4rs::query("MATCH (f:Feature {id: $id}) RETURN f")
                    .param("id", feature_id),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;

        if let Ok(Some(row)) = result.next().await {
            let node: neo4rs::Node = row.get("f").map_err(|e| GraphError::QueryError(e.to_string()))?;
            Ok(Some(node_to_json(&node)))
        } else {
            Ok(None)
        }
    }

    pub async fn update_feature_state(
        &self,
        feature_id: i64,
        new_state: String,
    ) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(
                neo4rs::query("MATCH (f:Feature {id: $id}) SET f.state = $state")
                    .param("id", feature_id)
                    .param("state", new_state),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;
        Ok(())
    }

    pub async fn delete_feature(&self, feature_id: i64) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(
                neo4rs::query("MATCH (f:Feature {id: $id}) DETACH DELETE f")
                    .param("id", feature_id),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;
        Ok(())
    }

    // === WorkPackage Node Operations ===

    pub async fn create_workpackage(
        &self,
        id: i64,
        title: String,
        state: String,
        ordinal: i32,
    ) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(
                neo4rs::query(
                    "CREATE (w:WorkPackage {id: $id, title: $title, state: $state, ordinal: $ordinal})",
                )
                .param("id", id)
                .param("title", title)
                .param("state", state)
                .param("ordinal", ordinal),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;
        Ok(())
    }

    pub async fn get_workpackage(&self, wp_id: i64) -> Result<Option<serde_json::Value>, GraphError> {
        let mut result = self
            .store
            .raw_graph()
            .execute(
                neo4rs::query("MATCH (w:WorkPackage {id: $id}) RETURN w")
                    .param("id", wp_id),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;

        if let Ok(Some(row)) = result.next().await {
            let node: neo4rs::Node = row.get("w").map_err(|e| GraphError::QueryError(e.to_string()))?;
            Ok(Some(node_to_json(&node)))
        } else {
            Ok(None)
        }
    }

    pub async fn delete_workpackage(&self, wp_id: i64) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(
                neo4rs::query("MATCH (w:WorkPackage {id: $id}) DETACH DELETE w")
                    .param("id", wp_id),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;
        Ok(())
    }

    // === Agent Node Operations ===

    pub async fn create_agent(
        &self,
        name: String,
        agent_type: String,
    ) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(
                neo4rs::query("CREATE (a:Agent {name: $name, type: $type})")
                    .param("name", name)
                    .param("type", agent_type),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;
        Ok(())
    }

    pub async fn get_agent(&self, name: &str) -> Result<Option<serde_json::Value>, GraphError> {
        let mut result = self
            .store
            .raw_graph()
            .execute(
                neo4rs::query("MATCH (a:Agent {name: $name}) RETURN a")
                    .param("name", name),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;

        if let Ok(Some(row)) = result.next().await {
            let node: neo4rs::Node = row.get("a").map_err(|e| GraphError::QueryError(e.to_string()))?;
            Ok(Some(node_to_json(&node)))
        } else {
            Ok(None)
        }
    }

    // === Label Node Operations ===

    pub async fn create_label(
        &self,
        name: String,
        color: String,
    ) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(
                neo4rs::query("CREATE (l:Label {name: $name, color: $color})")
                    .param("name", name)
                    .param("color", color),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;
        Ok(())
    }

    // === Project Node Operations ===

    pub async fn create_project(
        &self,
        name: String,
        slug: String,
    ) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(
                neo4rs::query("CREATE (p:Project {name: $name, slug: $slug})")
                    .param("name", name)
                    .param("slug", slug),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;
        Ok(())
    }

    pub async fn get_project(&self, slug: &str) -> Result<Option<serde_json::Value>, GraphError> {
        let mut result = self
            .store
            .raw_graph()
            .execute(
                neo4rs::query("MATCH (p:Project {slug: $slug}) RETURN p")
                    .param("slug", slug),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;

        if let Ok(Some(row)) = result.next().await {
            let node: neo4rs::Node = row.get("p").map_err(|e| GraphError::QueryError(e.to_string()))?;
            Ok(Some(node_to_json(&node)))
        } else {
            Ok(None)
        }
    }
}

/// Convert a Neo4j node to JSON
fn node_to_json(node: &neo4rs::Node) -> serde_json::Value {
    let mut map = serde_json::Map::new();

    // Add node labels
    map.insert(
        "labels".to_string(),
        serde_json::json!(node.labels()),
    );

    // Add properties
    for (key, value) in node.properties() {
        map.insert(key.to_string(), value_to_json(value));
    }

    serde_json::Value::Object(map)
}

/// Convert a Neo4j value to JSON
fn value_to_json(value: &neo4rs::Value) -> serde_json::Value {
    match value {
        neo4rs::Value::Null => serde_json::Value::Null,
        neo4rs::Value::Boolean(b) => serde_json::Value::Bool(*b),
        neo4rs::Value::Integer(i) => serde_json::Value::Number((*i).into()),
        neo4rs::Value::Float(f) => {
            serde_json::Number::from_f64(*f)
                .map(serde_json::Value::Number)
                .unwrap_or(serde_json::Value::Null)
        }
        neo4rs::Value::String(s) => serde_json::Value::String(s.clone()),
        neo4rs::Value::Bytes(_) => serde_json::Value::String("[bytes]".to_string()),
        neo4rs::Value::List(l) => {
            serde_json::Value::Array(l.iter().map(value_to_json).collect())
        }
        neo4rs::Value::Map(m) => {
            let mut map = serde_json::Map::new();
            for (k, v) in m.iter() {
                map.insert(k.clone(), value_to_json(v));
            }
            serde_json::Value::Object(map)
        }
        _ => serde_json::Value::Null,
    }
}
```

### T031: Relationship CRUD

Create `crates/agileplus-graph/src/relationships.rs`:

```rust
use crate::store::{GraphError, GraphStore};

pub struct RelationshipStore<'a> {
    store: &'a GraphStore,
}

impl<'a> RelationshipStore<'a> {
    pub fn new(store: &'a GraphStore) -> Self {
        RelationshipStore { store }
    }

    // === owns: Feature → WorkPackage ===

    pub async fn owns(
        &self,
        feature_id: i64,
        wp_id: i64,
    ) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(
                neo4rs::query(
                    "MATCH (f:Feature {id: $f_id}), (w:WorkPackage {id: $w_id}) \
                     CREATE (f)-[:OWNS]->(w)"
                )
                .param("f_id", feature_id)
                .param("w_id", wp_id),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;
        Ok(())
    }

    // === assigned_to: WorkPackage → Agent ===

    pub async fn assign_to_agent(
        &self,
        wp_id: i64,
        agent_name: String,
    ) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(
                neo4rs::query(
                    "MATCH (w:WorkPackage {id: $wp_id}), (a:Agent {name: $agent_name}) \
                     CREATE (w)-[:ASSIGNED_TO]->(a)"
                )
                .param("wp_id", wp_id)
                .param("agent_name", agent_name),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;
        Ok(())
    }

    // === depends_on: Feature → Feature ===

    pub async fn depends_on(
        &self,
        from_feature_id: i64,
        to_feature_id: i64,
    ) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(
                neo4rs::query(
                    "MATCH (f1:Feature {id: $f1_id}), (f2:Feature {id: $f2_id}) \
                     CREATE (f1)-[:DEPENDS_ON]->(f2)"
                )
                .param("f1_id", from_feature_id)
                .param("f2_id", to_feature_id),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;
        Ok(())
    }

    // === blocks: WorkPackage → WorkPackage ===

    pub async fn blocks(
        &self,
        blocking_wp_id: i64,
        blocked_wp_id: i64,
    ) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(
                neo4rs::query(
                    "MATCH (w1:WorkPackage {id: $w1_id}), (w2:WorkPackage {id: $w2_id}) \
                     CREATE (w1)-[:BLOCKS]->(w2)"
                )
                .param("w1_id", blocking_wp_id)
                .param("w2_id", blocked_wp_id),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;
        Ok(())
    }

    // === tagged: Feature → Label ===

    pub async fn tag_feature(
        &self,
        feature_id: i64,
        label_name: String,
    ) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(
                neo4rs::query(
                    "MATCH (f:Feature {id: $f_id}), (l:Label {name: $label_name}) \
                     CREATE (f)-[:TAGGED]->(l)"
                )
                .param("f_id", feature_id)
                .param("label_name", label_name),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;
        Ok(())
    }

    // === in_project: Feature/WorkPackage → Project ===

    pub async fn feature_in_project(
        &self,
        feature_id: i64,
        project_slug: String,
    ) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(
                neo4rs::query(
                    "MATCH (f:Feature {id: $f_id}), (p:Project {slug: $p_slug}) \
                     CREATE (f)-[:IN_PROJECT]->(p)"
                )
                .param("f_id", feature_id)
                .param("p_slug", project_slug),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;
        Ok(())
    }

    pub async fn workpackage_in_project(
        &self,
        wp_id: i64,
        project_slug: String,
    ) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(
                neo4rs::query(
                    "MATCH (w:WorkPackage {id: $w_id}), (p:Project {slug: $p_slug}) \
                     CREATE (w)-[:IN_PROJECT]->(p)"
                )
                .param("w_id", wp_id)
                .param("p_slug", project_slug),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;
        Ok(())
    }

    // === delete relationship ===

    pub async fn delete_relationship(
        &self,
        from_type: &str,
        from_id: i64,
        rel_type: &str,
        to_type: &str,
        to_id: i64,
    ) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(
                neo4rs::query(&format!(
                    "MATCH (from:{} {{id: $from_id}})-[r:{}]->(to:{} {{id: $to_id}}) \
                     DELETE r",
                    from_type, rel_type, to_type
                ))
                .param("from_id", from_id)
                .param("to_id", to_id),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;
        Ok(())
    }
}
```

### T032: Graph Queries

Create `crates/agileplus-graph/src/queries.rs`:

```rust
use crate::store::{GraphError, GraphStore};

pub struct GraphQueries<'a> {
    store: &'a GraphStore,
}

impl<'a> GraphQueries<'a> {
    pub fn new(store: &'a GraphStore) -> Self {
        GraphQueries { store }
    }

    /// Get all transitive dependencies of a feature
    pub async fn get_dependency_chain(
        &self,
        feature_id: i64,
    ) -> Result<Vec<(i64, String)>, GraphError> {
        let mut result = self
            .store
            .raw_graph()
            .execute(
                neo4rs::query(
                    "MATCH (f:Feature {id: $id})-[:DEPENDS_ON*]->(dep:Feature) \
                     RETURN dep.id AS id, dep.friendly_name AS name"
                )
                .param("id", feature_id),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;

        let mut chain = Vec::new();
        while let Ok(Some(row)) = result.next().await {
            let id = row.get("id").map_err(|e| GraphError::QueryError(e.to_string()))?;
            let name = row.get("name").map_err(|e| GraphError::QueryError(e.to_string()))?;
            chain.push((id, name));
        }
        Ok(chain)
    }

    /// Get what blocks a work package
    pub async fn get_blocking_path(
        &self,
        wp_id: i64,
    ) -> Result<Vec<(i64, String)>, GraphError> {
        let mut result = self
            .store
            .raw_graph()
            .execute(
                neo4rs::query(
                    "MATCH (blocker:WorkPackage)-[:BLOCKS*]->(w:WorkPackage {id: $id}) \
                     RETURN blocker.id AS id, blocker.title AS title"
                )
                .param("id", wp_id),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;

        let mut blockers = Vec::new();
        while let Ok(Some(row)) = result.next().await {
            let id = row.get("id").map_err(|e| GraphError::QueryError(e.to_string()))?;
            let title = row.get("title").map_err(|e| GraphError::QueryError(e.to_string()))?;
            blockers.push((id, title));
        }
        Ok(blockers)
    }

    /// Get all features in a project
    pub async fn get_project_features(
        &self,
        project_slug: &str,
    ) -> Result<Vec<(i64, String)>, GraphError> {
        let mut result = self
            .store
            .raw_graph()
            .execute(
                neo4rs::query(
                    "MATCH (f:Feature)-[:IN_PROJECT]->(p:Project {slug: $slug}) \
                     RETURN f.id AS id, f.friendly_name AS name ORDER BY f.id"
                )
                .param("slug", project_slug),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;

        let mut features = Vec::new();
        while let Ok(Some(row)) = result.next().await {
            let id = row.get("id").map_err(|e| GraphError::QueryError(e.to_string()))?;
            let name = row.get("name").map_err(|e| GraphError::QueryError(e.to_string()))?;
            features.push((id, name));
        }
        Ok(features)
    }

    /// Get all assigned work packages for an agent
    pub async fn get_agent_workload(
        &self,
        agent_name: &str,
    ) -> Result<Vec<(i64, String)>, GraphError> {
        let mut result = self
            .store
            .raw_graph()
            .execute(
                neo4rs::query(
                    "MATCH (w:WorkPackage)-[:ASSIGNED_TO]->(a:Agent {name: $name}) \
                     RETURN w.id AS id, w.title AS title ORDER BY w.ordinal"
                )
                .param("name", agent_name),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;

        let mut workload = Vec::new();
        while let Ok(Some(row)) = result.next().await {
            let id = row.get("id").map_err(|e| GraphError::QueryError(e.to_string()))?;
            let title = row.get("title").map_err(|e| GraphError::QueryError(e.to_string()))?;
            workload.push((id, title));
        }
        Ok(workload)
    }

    /// Get features by label
    pub async fn get_features_by_label(
        &self,
        label_name: &str,
    ) -> Result<Vec<(i64, String)>, GraphError> {
        let mut result = self
            .store
            .raw_graph()
            .execute(
                neo4rs::query(
                    "MATCH (f:Feature)-[:TAGGED]->(l:Label {name: $label}) \
                     RETURN f.id AS id, f.friendly_name AS name ORDER BY f.id"
                )
                .param("label", label_name),
            )
            .await
            .map_err(|e| GraphError::QueryError(e.to_string()))?;

        let mut features = Vec::new();
        while let Ok(Some(row)) = result.next().await {
            let id = row.get("id").map_err(|e| GraphError::QueryError(e.to_string()))?;
            let name = row.get("name").map_err(|e| GraphError::QueryError(e.to_string()))?;
            features.push((id, name));
        }
        Ok(features)
    }
}
```

### T033: Health Check and Index Management

Create `crates/agileplus-graph/src/health.rs`:

```rust
use crate::store::{GraphError, GraphStore};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum GraphHealth {
    Healthy,
    Unavailable,
}

pub struct GraphHealthChecker<'a> {
    store: &'a GraphStore,
}

impl<'a> GraphHealthChecker<'a> {
    pub fn new(store: &'a GraphStore) -> Self {
        GraphHealthChecker { store }
    }

    pub async fn check(&self) -> GraphHealth {
        match self.store.health_check().await {
            Ok(_) => GraphHealth::Healthy,
            Err(_) => GraphHealth::Unavailable,
        }
    }
}

pub struct IndexManager<'a> {
    store: &'a GraphStore,
}

impl<'a> IndexManager<'a> {
    pub fn new(store: &'a GraphStore) -> Self {
        IndexManager { store }
    }

    pub async fn create_indexes(&self) -> Result<(), GraphError> {
        // Create indexes for fast lookups
        self.store
            .raw_graph()
            .run(neo4rs::query(
                "CREATE INDEX feature_slug IF NOT EXISTS FOR (f:Feature) ON (f.slug)",
            ))
            .await
            .ok();

        self.store
            .raw_graph()
            .run(neo4rs::query(
                "CREATE INDEX workpackage_title IF NOT EXISTS FOR (w:WorkPackage) ON (w.title)",
            ))
            .await
            .ok();

        self.store
            .raw_graph()
            .run(neo4rs::query(
                "CREATE INDEX agent_type IF NOT EXISTS FOR (a:Agent) ON (a.type)",
            ))
            .await
            .ok();

        self.store
            .raw_graph()
            .run(neo4rs::query(
                "CREATE INDEX label_color IF NOT EXISTS FOR (l:Label) ON (l.color)",
            ))
            .await
            .ok();

        Ok(())
    }

    pub async fn delete_indexes(&self) -> Result<(), GraphError> {
        self.store
            .raw_graph()
            .run(neo4rs::query("DROP INDEX feature_slug IF EXISTS"))
            .await
            .ok();

        self.store
            .raw_graph()
            .run(neo4rs::query("DROP INDEX workpackage_title IF EXISTS"))
            .await
            .ok();

        Ok(())
    }
}
```

## Implementation Guidance

1. **Order:** T028 → T029 → T030 → T031 → T032 → T033
2. **Constraints:** Neo4j constraints enforce uniqueness; create them during initialization
3. **Cypher queries:** Use parameterized queries to prevent injection
4. **Error handling:** Distinguish constraint violations from query errors
5. **Relationships:** Always verify both source and target nodes exist before creating relationships
6. **Transactions:** Neo4j handles transaction consistency; no explicit transaction management needed
7. **Testing:** Test with a running Neo4j instance; can use Docker container

## Definition of Done

- [ ] agileplus-graph crate compiles
- [ ] GraphStore connects to Neo4j and initializes constraints
- [ ] All 5 node types can be created and queried
- [ ] All 6+ relationships can be created, deleted, and queried
- [ ] Dependency chain traversal works correctly
- [ ] Project-scoped queries return correct results
- [ ] Health check passes
- [ ] Index creation succeeds
- [ ] No clippy warnings

## Command

```bash
spec-kitty implement WP05 --base WP03
```

## Activity Log

- 2026-03-02T11:50:57Z – claude-opus – shell_pid=52715 – lane=doing – Assigned agent via workflow command
- 2026-03-02T11:55:15Z – claude-opus – shell_pid=52715 – lane=for_review – Ready for review: agileplus-graph crate with 23 tests
- 2026-03-02T23:19:12Z – claude-opus – shell_pid=52715 – lane=done – Merged to main, 516 tests passing
