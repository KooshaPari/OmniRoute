// SPDX-License-Identifier: MIT OR Apache-2.0

//! Smoke-test every `.toml` file in `examples/templates/` — parse → apply
//! into an in-memory RuleUpsert store → re-apply (idempotency).
//!
//! This is the closest thing to a real-world coverage test for the
//! template-pack format: every starter pack shipped in the repo has to
//! round-trip cleanly and install without error.

use focus_templates::{RuleUpsert, TemplatePack};
use std::collections::HashMap;

struct MemStore {
    by_id: HashMap<uuid::Uuid, focus_rules::Rule>,
}

impl MemStore {
    fn new() -> Self {
        Self { by_id: HashMap::new() }
    }
}

impl RuleUpsert for MemStore {
    fn upsert_rule(&mut self, rule: focus_rules::Rule) -> std::result::Result<(), String> {
        self.by_id.insert(rule.id, rule);
        Ok(())
    }
}

fn examples_dir() -> std::path::PathBuf {
    // Tests run from the crate root; walk up two levels to the workspace.
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .join("examples")
        .join("templates")
}

#[test]
fn every_example_template_parses() {
    let dir = examples_dir();
    let mut count = 0;
    for entry in std::fs::read_dir(&dir).expect("examples/templates exists") {
        let path = entry.unwrap().path();
        if path.extension().and_then(|s| s.to_str()) != Some("toml") {
            continue;
        }
        let toml = std::fs::read_to_string(&path)
            .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
        TemplatePack::from_toml_str(&toml)
            .unwrap_or_else(|e| panic!("parse {}: {e:?}", path.display()));
        count += 1;
    }
    assert!(count >= 4, "expected at least 4 starter packs; found {count}");
}

#[test]
fn every_example_applies_idempotently() {
    let dir = examples_dir();
    for entry in std::fs::read_dir(&dir).expect("examples/templates exists") {
        let path = entry.unwrap().path();
        if path.extension().and_then(|s| s.to_str()) != Some("toml") {
            continue;
        }
        let toml = std::fs::read_to_string(&path).unwrap();
        let pack = TemplatePack::from_toml_str(&toml).unwrap();
        let mut store = MemStore::new();
        let n1 = pack.apply(&mut store).expect("first apply");
        let n2 = pack.apply(&mut store).expect("second apply (idempotent)");
        assert_eq!(n1, n2, "{} upserts differ between first and second apply", path.display());
        assert_eq!(
            store.by_id.len(),
            n1,
            "{} rule count mismatch after idempotent re-apply",
            path.display()
        );
    }
}
