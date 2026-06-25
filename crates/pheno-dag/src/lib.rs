//! # pheno-dag
//!
//! DAG foundation for Phenotype compute/infra automation (epic F).
//!
//! This crate was extracted from BytePort's `byteport-dag` crate as part
//! of the foundation automation effort. It provides a generic directed
//! acyclic graph, topological sort (Kahn + DFS), parallel-bucket scheduling,
//! enriched node/edge schema (prerequisites, acceptance criteria, audit
//! hooks), and YAML/JSON serialization.
//!
//! ## Modules
//!
//! | Module        | Description                                                |
//! |---------------|------------------------------------------------------------|
//! | [`dag`]       | Generic directed-acyclic-graph data structure               |
//! | [`topo`]      | Topological sort (Kahn's algorithm + DFS variant)          |
//! | [`scheduler`] | Parallel-bucket scheduler built on topological order        |
//! | [`schema`]    | Enriched node/edge schema: prereqs, acceptance, audit hooks |
//! | [`serialize`] | YAML/JSON round-trip serialization for the enriched schema |
//!
//! ## Example
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

pub mod dag;
pub mod topo;
pub mod scheduler;
pub mod schema;
pub mod serialize;
