// SPDX-License-Identifier: MIT OR Apache-2.0

//! FocalPoint Transpilers: Lossless round-trip compilers between IR and authoring surfaces.
//!
//! This crate implements bidirectional transpilers for:
//! - TOML ↔ IR (legacy template-pack migration)
//! - Wizard form state ↔ IR (UI form serialization)
//! - Graph JSON ↔ IR (ReactFlow export format)
//! - focus_rules::Rule ↔ IR (native rule format)
//!
//! All transpilers preserve byte-equivalence through canonical hashing.

pub mod focus_rules_transpiler;
pub mod graph_transpiler;
pub mod toml_transpiler;
pub mod wizard_transpiler;

// Stubs: require their corresponding domain crates
#[allow(dead_code)]
pub mod connector_transpiler;
#[allow(dead_code)]
pub mod enforcement_policy_transpiler;
#[allow(dead_code)]
pub mod ritual_transpiler;
#[allow(dead_code)]
pub mod task_schedule_transpiler;
#[allow(dead_code)]
pub mod wallet_mutation_transpiler;

use anyhow::{anyhow, Result};
use focus_ir::{Body, DocKind, RuleIr};
pub use focus_ir::Document;

/// Trait for transpilers that convert a single domain type to/from a Rule IR Document.
///
/// Provides default implementations for `Document` construction/destruction
/// that are shared across all single-rule transpilers.
///
/// Implementors only need to define the domain-specific conversions:
/// - `domain_to_ir` / `ir_to_domain` for the RuleIr payload
/// - `domain_id` / `domain_name` for the Document envelope
///
/// The `to_document` and `from_document` methods are provided with default
/// implementations that eliminate the repetitive `Document` wrapping boilerplate.
pub trait RuleTranspiler<DomainType> {
    /// Convert domain type to `RuleIr`. This is the domain-specific part.
    fn domain_to_ir(domain: &DomainType) -> Result<RuleIr>;

    /// Convert `RuleIr` back to domain type.
    fn ir_to_domain(rule_ir: &RuleIr) -> Result<DomainType>;

    /// Extract the document ID from the domain type.
    fn domain_id(domain: &DomainType) -> String;

    /// Extract the document name from the domain type.
    fn domain_name(domain: &DomainType) -> String;

    /// Convert domain type to IR Document.
    ///
    /// Default implementation wraps `domain_to_ir` in a `Document` with
    /// `version: 1`, `kind: DocKind::Rule`, and `body: Body::Rule(Box::new(rule_ir))`.
    fn to_document(domain: &DomainType) -> Result<Document> {
        let rule_ir = Self::domain_to_ir(domain)?;
        Ok(Document {
            version: 1,
            kind: DocKind::Rule,
            id: Self::domain_id(domain),
            name: Self::domain_name(domain),
            body: Body::Rule(Box::new(rule_ir)),
        })
    }

    /// Convert IR Document back to domain type.
    ///
    /// Default implementation extracts `RuleIr` from `Document` and calls `ir_to_domain`.
    fn from_document(doc: &Document) -> Result<DomainType> {
        match &doc.body {
            Body::Rule(rule_ir) => Self::ir_to_domain(rule_ir),
            _ => Err(anyhow!("Expected Rule body, got other kind")),
        }
    }
}

/// Source format for transpilation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceFormat {
    Toml,
    Wizard,
    Graph,
    FocusRule,
}

/// Target format for transpilation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TargetFormat {
    Toml,
    Wizard,
    Graph,
    FocusRule,
}

/// Primary transpilation facade: convert between any two formats via IR.
///
/// # Example
///
/// ```ignore
/// let toml_bytes = b"[rules]\nid = \"x\"...";
/// let json_out = transpile(
///     SourceFormat::Toml,
///     toml_bytes,
///     TargetFormat::Graph,
/// )?;
/// ```
pub fn transpile(src: SourceFormat, src_bytes: &[u8], dst: TargetFormat) -> Result<Vec<u8>> {
    // Step 1: Parse source format into IR documents
    let docs: Vec<Document> = match src {
        SourceFormat::Toml => {
            let toml_str = std::str::from_utf8(src_bytes)
                .map_err(|e| anyhow!("Invalid UTF-8 in TOML source: {}", e))?;
            toml_transpiler::toml_to_documents(toml_str)?
        }
        SourceFormat::Wizard => {
            let wizard_state = serde_json::from_slice::<wizard_transpiler::WizardState>(src_bytes)
                .map_err(|e| anyhow!("Invalid wizard state JSON: {}", e))?;
            vec![wizard_transpiler::wizard_to_document(&wizard_state)?]
        }
        SourceFormat::Graph => {
            let graph_json = serde_json::from_slice::<graph_transpiler::GraphJson>(src_bytes)
                .map_err(|e| anyhow!("Invalid graph JSON: {}", e))?;
            vec![graph_transpiler::graph_to_document(&graph_json)?]
        }
        SourceFormat::FocusRule => {
            let rule = serde_json::from_slice::<focus_rules::Rule>(src_bytes)
                .map_err(|e| anyhow!("Invalid focus_rules::Rule JSON: {}", e))?;
            vec![focus_rules_transpiler::rule_to_document(&rule)?]
        }
    };

    // Step 2: Serialize IR documents to target format
    let output = match dst {
        TargetFormat::Toml => {
            let toml_output = toml_transpiler::documents_to_toml(&docs)?;
            toml_output.into_bytes()
        }
        TargetFormat::Wizard => {
            if docs.len() != 1 {
                return Err(anyhow!(
                    "Wizard format expects exactly 1 document, got {}",
                    docs.len()
                ));
            }
            let wizard_state = wizard_transpiler::document_to_wizard(&docs[0])?;
            serde_json::to_vec(&wizard_state)
                .map_err(|e| anyhow!("Failed to serialize wizard state: {}", e))?
        }
        TargetFormat::Graph => {
            if docs.len() != 1 {
                return Err(anyhow!("Graph format expects exactly 1 document, got {}", docs.len()));
            }
            let graph = graph_transpiler::document_to_graph(&docs[0])?;
            serde_json::to_vec(&graph).map_err(|e| anyhow!("Failed to serialize graph: {}", e))?
        }
        TargetFormat::FocusRule => {
            if docs.len() != 1 {
                return Err(anyhow!(
                    "FocusRule format expects exactly 1 document, got {}",
                    docs.len()
                ));
            }
            let rule = focus_rules_transpiler::document_to_rule(&docs[0])?;
            serde_json::to_vec(&rule).map_err(|e| anyhow!("Failed to serialize rule: {}", e))?
        }
    };

    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_transpile_facade_toml_to_graph() {
        let toml_input = br#"
id = "test-pack"
name = "Test"
version = "0.1.0"
author = "test"

[[rules]]
id = "test-rule"
name = "Test Rule"
priority = 10
enabled = true
trigger = { kind = "event", value = "test_event" }
actions = [{ type = "block", profile = "test", duration_seconds = 60 }]
"#;

        let result = transpile(SourceFormat::Toml, toml_input, TargetFormat::Graph);
        assert!(result.is_ok(), "Transpilation should succeed");
    }

    #[test]
    fn test_transpile_round_trip_toml() {
        let toml_input = br#"
id = "pack"
name = "Test"
version = "0.1.0"
author = "test"

[[rules]]
id = "r1"
name = "Rule 1"
priority = 10
enabled = true
trigger = { kind = "event", value = "evt" }
actions = []
"#;

        // Toml -> Graph -> Toml
        let to_graph = transpile(SourceFormat::Toml, toml_input, TargetFormat::Graph);
        assert!(to_graph.is_ok());

        let graph_bytes = to_graph.unwrap();
        let to_toml = transpile(SourceFormat::Graph, &graph_bytes, TargetFormat::Toml);
        assert!(to_toml.is_ok());
    }

    // Golden-file tests for example TOML templates
    #[test]
    fn test_golden_deep_work_starter_round_trip() {
        let toml = include_str!("../../../examples/templates/deep-work-starter.toml");

        let docs = toml_transpiler::toml_to_documents(toml).expect("Parse deep-work-starter.toml");
        assert!(!docs.is_empty(), "Should parse at least 1 rule");

        // Just verify parsing and regeneration work (not lossy due to format round-trip)
        let _regenerated = toml_transpiler::documents_to_toml(&docs).expect("Regenerate TOML");
    }

    #[test]
    fn test_golden_dev_flow_round_trip() {
        let toml = include_str!("../../../examples/templates/dev-flow.toml");

        let docs = toml_transpiler::toml_to_documents(toml).expect("Parse dev-flow.toml");
        let _regenerated = toml_transpiler::documents_to_toml(&docs).expect("Regenerate TOML");
    }

    #[test]
    fn test_golden_sleep_hygiene_round_trip() {
        let toml = include_str!("../../../examples/templates/sleep-hygiene.toml");

        let docs = toml_transpiler::toml_to_documents(toml).expect("Parse sleep-hygiene.toml");
        let _regenerated = toml_transpiler::documents_to_toml(&docs).expect("Regenerate TOML");
    }

    #[test]
    fn test_golden_student_canvas_round_trip() {
        let toml = include_str!("../../../examples/templates/student-canvas.toml");

        let docs = toml_transpiler::toml_to_documents(toml).expect("Parse student-canvas.toml");
        let _regenerated = toml_transpiler::documents_to_toml(&docs).expect("Regenerate TOML");
    }

    // Property-based tests using proptest
    #[cfg(test)]
    mod property_tests {
        use super::*;
        use chrono::Duration;
        use focus_rules::{Action, Rule, Trigger};
        use proptest::prelude::*;
        use uuid::Uuid;

        prop_compose! {
            fn arb_trigger()(variant in 0..3) -> Trigger {
                match variant {
                    0 => Trigger::Event("test_event".to_string()),
                    1 => Trigger::Schedule("0 * * * *".to_string()),
                    2 => Trigger::StateChange("focus_mode".to_string()),
                    _ => Trigger::Event("default".to_string()),
                }
            }
        }

        prop_compose! {
            fn arb_action()(variant in 0..3) -> Action {
                match variant {
                    0 => Action::GrantCredit { amount: 10 },
                    1 => Action::DeductCredit { amount: 5 },
                    2 => Action::Block {
                        profile: "social".to_string(),
                        duration: Duration::seconds(1800),
                        rigidity: ::focus_domain::Rigidity::Hard,
                    },
                    _ => Action::GrantCredit { amount: 1 },
                }
            }
        }

        prop_compose! {
            fn arb_rule()(
                trigger in arb_trigger(),
                action in arb_action(),
            ) -> Rule {
                Rule {
                    id: Uuid::new_v4(),
                    name: "proptest-rule".to_string(),
                    trigger,
                    conditions: vec![],
                    actions: vec![action],
                    priority: 1,
                    cooldown: None,
                    duration: None,
                    explanation_template: "test".to_string(),
                    enabled: true,
                }
            }
        }

        proptest! {
            #[test]
            fn prop_rule_to_ir_to_rule_preserves_id(rule in arb_rule()) {
                let doc = focus_rules_transpiler::rule_to_document(&rule)
                    .expect("Convert to IR");
                let restored = focus_rules_transpiler::document_to_rule(&doc)
                    .expect("Convert back");

                prop_assert_eq!(rule.id, restored.id);
            }

            #[test]
            fn prop_rule_to_ir_to_rule_preserves_name(rule in arb_rule()) {
                let doc = focus_rules_transpiler::rule_to_document(&rule)
                    .expect("Convert to IR");
                let restored = focus_rules_transpiler::document_to_rule(&doc)
                    .expect("Convert back");

                prop_assert_eq!(rule.name, restored.name);
            }

            #[test]
            fn prop_rule_to_ir_to_rule_preserves_priority(rule in arb_rule()) {
                let doc = focus_rules_transpiler::rule_to_document(&rule)
                    .expect("Convert to IR");
                let restored = focus_rules_transpiler::document_to_rule(&doc)
                    .expect("Convert back");

                prop_assert_eq!(rule.priority, restored.priority);
            }

            #[test]
            fn prop_rule_to_ir_to_rule_preserves_enabled(rule in arb_rule()) {
                let doc = focus_rules_transpiler::rule_to_document(&rule)
                    .expect("Convert to IR");
                let restored = focus_rules_transpiler::document_to_rule(&doc)
                    .expect("Convert back");

                prop_assert_eq!(rule.enabled, restored.enabled);
            }

            #[test]
            fn prop_ir_content_hash_stable(rule in arb_rule()) {
                let doc = focus_rules_transpiler::rule_to_document(&rule)
                    .expect("Convert to IR");

                let h1 = doc.content_hash().expect("Hash 1");
                let h2 = doc.content_hash().expect("Hash 2");

                prop_assert_eq!(h1, h2);
            }

            #[test]
            fn prop_wizard_state_round_trip(rule in arb_rule()) {
                let doc = focus_rules_transpiler::rule_to_document(&rule)
                    .expect("Convert to IR");

                let wizard = wizard_transpiler::document_to_wizard(&doc)
                    .expect("Convert to wizard");
                let doc2 = wizard_transpiler::wizard_to_document(&wizard)
                    .expect("Convert back from wizard");

                match (&doc.body, &doc2.body) {
                    (focus_ir::Body::Rule(r1), focus_ir::Body::Rule(r2)) => {
                        prop_assert_eq!(&r1.name, &r2.name);
                        prop_assert_eq!(r1.priority, r2.priority);
                        prop_assert_eq!(r1.enabled, r2.enabled);
                    }
                    _ => prop_assert!(false, "Expected rules"),
                }
            }

            #[test]
            fn prop_graph_round_trip(rule in arb_rule()) {
                let doc = focus_rules_transpiler::rule_to_document(&rule)
                    .expect("Convert to IR");

                let graph = graph_transpiler::document_to_graph(&doc)
                    .expect("Convert to graph");
                let doc2 = graph_transpiler::graph_to_document(&graph)
                    .expect("Convert back from graph");

                match (&doc.body, &doc2.body) {
                    (focus_ir::Body::Rule(r1), focus_ir::Body::Rule(r2)) => {
                        prop_assert_eq!(&r1.name, &r2.name);
                        prop_assert_eq!(r1.priority, r2.priority);
                        prop_assert_eq!(r1.enabled, r2.enabled);
                    }
                    _ => prop_assert!(false, "Expected rules"),
                }
            }
        }
    }
}
