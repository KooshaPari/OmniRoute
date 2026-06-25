//! YAML/JSON serialization for the enriched DAG schema.
//!
//! Provides a portable [`DagSchema`] that uses the enriched [`SchemaNode`]
//! and [`SchemaEdge`] types with prerequisites, acceptance criteria, and
//! audit hooks, defined in [`crate::schema`].
//!
//! # Example
//!
//! ```rust
//! use pheno_dag::dag::Dag;
//! use pheno_dag::serialize::DagSchema;
//!
//! let mut dag: Dag<String> = Dag::new();
//! dag.add_node("build".into()).unwrap();
//! dag.add_node("test".into()).unwrap();
//! dag.add_node("deploy".into()).unwrap();
//! dag.add_edge("build".into(), "test".into()).unwrap();
//! dag.add_edge("test".into(), "deploy".into()).unwrap();
//!
//! let schema = DagSchema::from_dag(&dag, "2.0.0");
//! let yaml = schema.to_yaml().unwrap();
//! let round: DagSchema = DagSchema::from_yaml(&yaml).unwrap();
//! assert_eq!(schema, round);
//! ```

use std::collections::BTreeSet;

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::dag::Dag;
use crate::schema::{SchemaEdge, SchemaNode};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/// Errors that can occur during DAG serialization / deserialization.
#[derive(Debug, Error)]
pub enum DagSerError {
    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
}

// ---------------------------------------------------------------------------
// DagSchema — portable, serde-friendly, enriched DAG representation
// ---------------------------------------------------------------------------

/// Portable, serializable, enriched DAG representation.
///
/// Extends the basic node/edge structure with prerequisites, acceptance
/// criteria, audit hooks, and metadata.
///
/// This type is the **only** entry point for YAML / JSON serialization
/// of the enriched schema.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DagSchema {
    /// Schema version (e.g. "2.0.0").
    pub version: String,
    /// DAG name (optional).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    /// Nodes in the graph.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub nodes: Vec<SchemaNode>,
    /// Directed edges.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub edges: Vec<SchemaEdge>,
}

impl DagSchema {
    /// Build a `DagSchema` from an internal `Dag` keyed by `String`.
    ///
    /// `version` is a free-form version string (e.g. `"2.0.0"`).
    ///
    /// The enriched fields (prerequisites, acceptance, audit hooks) are
    /// left empty in the auto-generated nodes; consumers should populate
    /// them on the returned schema before serializing.
    pub fn from_dag(dag: &Dag<String>, version: impl Into<String>) -> Self {
        let nodes: Vec<SchemaNode> = dag
            .iter_nodes()
            .map(|id| SchemaNode {
                id: id.clone(),
                label: None,
                description: None,
                prerequisites: Vec::new(),
                acceptance: Vec::new(),
                audit_hooks: Vec::new(),
                metadata: None,
            })
            .collect();

        // Collect deduplicated edges.
        let mut edges_set: BTreeSet<(String, String)> = BTreeSet::new();
        for node in dag.iter_nodes() {
            if let Some(children) = dag.children_of(node) {
                for child in children {
                    edges_set.insert((node.clone(), child.clone()));
                }
            }
        }
        let edges: Vec<SchemaEdge> = edges_set
            .into_iter()
            .map(|(from, to)| SchemaEdge {
                from,
                to,
                label: None,
                condition: None,
            })
            .collect();

        Self {
            version: version.into(),
            name: None,
            nodes,
            edges,
        }
    }

    /// Set an optional name on the schema.
    pub fn with_name(mut self, name: impl Into<String>) -> Self {
        self.name = Some(name.into());
        self
    }

    /// Reconstruct an internal `Dag<String>` from this schema.
    ///
    /// Returns an error if a duplicate node is encountered.
    pub fn into_dag(&self) -> Result<Dag<String>, crate::dag::DagError> {
        let mut dag = Dag::new();
        for node in &self.nodes {
            dag.add_node(node.id.clone())?;
        }
        for edge in &self.edges {
            dag.add_edge(edge.from.clone(), edge.to.clone())?;
        }
        Ok(dag)
    }

    // -----------------------------------------------------------------------
    // YAML
    // -----------------------------------------------------------------------

    /// Serialize to a YAML string.
    pub fn to_yaml(&self) -> Result<String, DagSerError> {
        Ok(serde_yaml::to_string(self)?)
    }

    /// Deserialize from a YAML string.
    pub fn from_yaml(yaml: &str) -> Result<Self, DagSerError> {
        Ok(serde_yaml::from_str(yaml)?)
    }

    // -----------------------------------------------------------------------
    // JSON
    // -----------------------------------------------------------------------

    /// Serialize to a compact JSON string.
    pub fn to_json(&self) -> Result<String, DagSerError> {
        Ok(serde_json::to_string(self)?)
    }

    /// Serialize to a pretty-printed JSON string.
    pub fn to_json_pretty(&self) -> Result<String, DagSerError> {
        Ok(serde_json::to_string_pretty(self)?)
    }

    /// Deserialize from a JSON string.
    pub fn from_json(json: &str) -> Result<Self, DagSerError> {
        Ok(serde_json::from_str(json)?)
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::schema::*;

    fn sample_dag() -> Dag<String> {
        let mut dag = Dag::new();
        for n in ["checkout", "build", "test", "deploy"] {
            dag.add_node(n.to_string()).unwrap();
        }
        dag.add_edge("checkout".into(), "build".into()).unwrap();
        dag.add_edge("build".into(), "test".into()).unwrap();
        dag.add_edge("test".into(), "deploy".into()).unwrap();
        dag
    }

    fn enriched_schema() -> DagSchema {
        let dag = sample_dag();
        let mut schema = DagSchema::from_dag(&dag, "2.0.0").with_name("ci-pipeline");

        for node in &mut schema.nodes {
            if node.id == "build" {
                node.description = Some("Compile the application".into());
                node.prerequisites = vec![
                    Prerequisite::FileExists {
                        path: "./Cargo.toml".into(),
                    },
                    Prerequisite::EnvironmentVariable {
                        variable: "RUSTFLAGS".into(),
                    },
                ];
                node.acceptance = vec![
                    AcceptanceCriterion::ExitCode { code: 0 },
                    AcceptanceCriterion::OutputContains {
                        pattern: "Compiling".into(),
                        regex: false,
                    },
                ];
                node.audit_hooks = vec![
                    AuditHook::MetricEmit {
                        name: "build_duration_ms".into(),
                        value: 0.0,
                        unit: Some("ms".into()),
                        timing: HookTiming::Post,
                    },
                ];
            }
            if node.id == "deploy" {
                node.prerequisites = vec![
                    Prerequisite::ImageReady {
                        image: "myapp:latest".into(),
                    },
                ];
                node.acceptance = vec![
                    AcceptanceCriterion::HttpOk {
                        url: "https://staging.example.com/health".into(),
                        expected_status: Some(200),
                    },
                ];
                node.audit_hooks = vec![
                    AuditHook::Notify {
                        channel: "slack".into(),
                        message: "Deploy completed".into(),
                        timing: HookTiming::OnSuccess,
                    },
                ];
            }
        }

        schema
    }

    #[test]
    fn yaml_round_trip_basic() {
        let dag = sample_dag();
        let schema = DagSchema::from_dag(&dag, "2.0.0").with_name("pipeline");
        let yaml = schema.to_yaml().expect("YAML serialization");
        let restored = DagSchema::from_yaml(&yaml).expect("YAML deserialization");
        assert_eq!(schema, restored, "YAML round-trip must be lossless");
    }

    #[test]
    fn json_round_trip_basic() {
        let dag = sample_dag();
        let schema = DagSchema::from_dag(&dag, "2.0.0");
        let json = schema.to_json().expect("JSON serialization");
        let restored = DagSchema::from_json(&json).expect("JSON deserialization");
        assert_eq!(schema, restored, "JSON round-trip must be lossless");
    }

    #[test]
    fn yaml_round_trip_enriched() {
        let schema = enriched_schema();
        let yaml = schema.to_yaml().expect("YAML serialization of enriched schema");
        let restored = DagSchema::from_yaml(&yaml).expect("YAML deserialization");
        assert_eq!(schema, restored, "Enriched YAML round-trip must be lossless");
    }

    #[test]
    fn json_round_trip_enriched() {
        let schema = enriched_schema();
        let json = schema.to_json_pretty().expect("JSON serialization of enriched schema");
        let restored = DagSchema::from_json(&json).expect("JSON deserialization");
        assert_eq!(schema, restored, "Enriched JSON round-trip must be lossless");
    }

    #[test]
    fn cross_format_consistency() {
        let schema = enriched_schema();
        let yaml = schema.to_yaml().unwrap();
        let from_yaml = DagSchema::from_yaml(&yaml).unwrap();
        let json = from_yaml.to_json().unwrap();
        let from_json = DagSchema::from_json(&json).unwrap();
        assert_eq!(
            schema, from_json,
            "YAML → JSON cross-format must be consistent"
        );
    }

    #[test]
    fn schema_to_dag_and_back() {
        let dag = sample_dag();
        let schema = DagSchema::from_dag(&dag, "2.0.0");
        let reconstructed = schema.into_dag().expect("into_dag should succeed");
        assert_eq!(dag.node_count(), reconstructed.node_count());
        assert_eq!(dag.edge_count(), reconstructed.edge_count());
        for n in dag.iter_nodes() {
            assert!(reconstructed.contains(n), "node {n} should exist");
        }
    }

    #[test]
    fn empty_dag_round_trips() {
        let dag: Dag<String> = Dag::new();
        let schema = DagSchema::from_dag(&dag, "0.1.0");
        let yaml = schema.to_yaml().unwrap();
        let back = DagSchema::from_yaml(&yaml).unwrap();
        assert_eq!(schema, back);
    }

    #[test]
    fn yaml_content_is_readable() {
        let schema = enriched_schema();
        let yaml = schema.to_yaml().unwrap();
        assert!(yaml.contains("version:"));
        assert!(yaml.contains("ci-pipeline"));
        assert!(yaml.contains("checkout"));
        assert!(yaml.contains("deploy"));
        assert!(yaml.contains("prerequisites"));
        assert!(yaml.contains("acceptance"));
        assert!(yaml.contains("audit_hooks"));
    }

    #[test]
    fn json_content_is_readable() {
        let schema = enriched_schema();
        let json = schema.to_json_pretty().unwrap();
        assert!(json.contains("\"version\""));
        assert!(json.contains("\"checkout\""));
        assert!(json.contains("\"deploy\""));
        assert!(json.contains("\"prerequisites\""));
    }

    #[test]
    fn diamond_graph_round_trip() {
        let mut dag = Dag::new();
        for n in ["a", "b", "c", "d"] {
            dag.add_node(n.to_string()).unwrap();
        }
        dag.add_edge("a".into(), "b".into()).unwrap();
        dag.add_edge("a".into(), "c".into()).unwrap();
        dag.add_edge("b".into(), "d".into()).unwrap();
        dag.add_edge("c".into(), "d".into()).unwrap();

        let schema = DagSchema::from_dag(&dag, "1.0.0");
        let json = schema.to_json().unwrap();
        let back = DagSchema::from_json(&json).unwrap();
        assert_eq!(schema, back);
        assert_eq!(back.edges.len(), 4);
    }

    #[test]
    fn enriched_schema_has_correct_prereqs() {
        let schema = enriched_schema();
        let build_node = schema.nodes.iter().find(|n| n.id == "build").unwrap();
        assert_eq!(build_node.prerequisites.len(), 2);
        assert_eq!(build_node.acceptance.len(), 2);
        assert_eq!(build_node.audit_hooks.len(), 1);

        let deploy_node = schema.nodes.iter().find(|n| n.id == "deploy").unwrap();
        assert_eq!(deploy_node.prerequisites.len(), 1);
        assert_eq!(deploy_node.acceptance.len(), 1);
        assert_eq!(deploy_node.audit_hooks.len(), 1);
    }
}
