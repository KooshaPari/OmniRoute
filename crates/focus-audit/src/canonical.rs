// SPDX-License-Identifier: MIT OR Apache-2.0

//! Deterministic JSON canonicalization for stable hashing.
//!
//! Recursively sorts object keys so semantically-equal JSON produces
//! byte-identical output regardless of original key ordering.

#![cfg_attr(test, allow(clippy::disallowed_methods))]

use serde_json::Value;
use std::collections::BTreeMap;

/// Canonicalize a `serde_json::Value` into a stable string.
///
/// - Object keys are sorted lexicographically.
/// - Array element order is preserved.
/// - Numbers, strings, bools, and nulls pass through `serde_json` serialization.
pub fn canonicalize(v: &Value) -> String {
    let normalized = normalize(v);
    // `serde_json::to_string` on a `Value` built from `BTreeMap` preserves
    // key order because `Value::Object` is backed by a map that we emit in
    // sorted form via the `normalize` step.
    serde_json::to_string(&normalized).expect("canonicalize: serde_json serialization failed")
}

fn normalize(v: &Value) -> Value {
    match v {
        Value::Object(map) => {
            // Collect into a BTreeMap to enforce key ordering, then rebuild
            // into a `serde_json::Map` preserving that ordering on iteration.
            let sorted: BTreeMap<String, Value> =
                map.iter().map(|(k, v)| (k.clone(), normalize(v))).collect();
            let mut out = serde_json::Map::with_capacity(sorted.len());
            for (k, v) in sorted {
                out.insert(k, v);
            }
            Value::Object(out)
        }
        Value::Array(arr) => Value::Array(arr.iter().map(normalize).collect()),
        other => other.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // Traces to: FR-DATA-002, FR-DATA-003
    #[test]
    fn canonicalize_sorts_top_level_keys() {
        let a = json!({"a": 1, "b": 2});
        let b = json!({"b": 2, "a": 1});
        assert_eq!(canonicalize(&a), canonicalize(&b));
        assert_eq!(canonicalize(&a), r#"{"a":1,"b":2}"#);
    }

    // Traces to: FR-DATA-002, FR-DATA-003
    #[test]
    fn canonicalize_sorts_nested_keys() {
        let a = json!({"outer": {"z": 1, "a": 2}, "arr": [{"y": 1, "x": 2}]});
        let b = json!({"arr": [{"x": 2, "y": 1}], "outer": {"a": 2, "z": 1}});
        assert_eq!(canonicalize(&a), canonicalize(&b));
    }

    // Traces to: FR-DATA-002, FR-DATA-003
    #[test]
    fn canonicalize_preserves_array_order() {
        let a = json!([3, 1, 2]);
        let b = json!([1, 2, 3]);
        assert_ne!(canonicalize(&a), canonicalize(&b));
    }

    // Traces to: FR-DATA-002, FR-DATA-003
    #[test]
    fn canonicalize_handles_primitives_and_null() {
        assert_eq!(canonicalize(&json!(null)), "null");
        assert_eq!(canonicalize(&json!(true)), "true");
        assert_eq!(canonicalize(&json!("hello")), "\"hello\"");
        assert_eq!(canonicalize(&json!(42)), "42");
    }
}
