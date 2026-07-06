// RFC 6901 JSON Pointer: navigate a JSON-ish value via slash-separated tokens.
use serde_json::Value;

pub fn resolve<'a>(root: &'a Value, pointer: &str) -> Option<&'a Value> {
    if pointer.is_empty() { return Some(root); }
    if !pointer.starts_with('/') { return None; }
    let mut node = root;
    for token in split_tokens(&pointer[1..]) {
        // Unescape ~1 -> / and ~0 -> ~
        let unescaped = token.replace("~1", "/").replace("~0", "~");
        node = match node {
            Value::Object(map) => map.get(&unescaped)?,
            Value::Array(arr) => {
                let idx: usize = unescaped.parse().ok()?;
                arr.get(idx)?
            }
            _ => return None,
        };
    }
    Some(node)
}
fn split_tokens(s: &str) -> Vec<String> {
    s.split('/').map(String::from).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test] fn root_empty() {
        let v = json!({"a": 1});
        assert_eq!(resolve(&v, ""), Some(&v));
    }
    #[test] fn object_member() {
        let v = json!({"a": 1, "b": 2});
        assert_eq!(resolve(&v, "/a"), Some(&json!(1)));
        assert_eq!(resolve(&v, "/b"), Some(&json!(2)));
    }
    #[test] fn nested() {
        let v = json!({"a": {"b": {"c": 42}}});
        assert_eq!(resolve(&v, "/a/b/c"), Some(&json!(42)));
    }
    #[test] fn array_index() {
        let v = json!({"items": [10, 20, 30]});
        assert_eq!(resolve(&v, "/items/1"), Some(&json!(20)));
    }
    #[test] fn missing_key() {
        let v = json!({"a": 1});
        assert_eq!(resolve(&v, "/b"), None);
    }
    #[test] fn out_of_bounds() {
        let v = json!([1, 2]);
        assert_eq!(resolve(&v, "/5"), None);
    }
    #[test] fn escaped_slash() {
        let v = json!({"a/b": 1});
        assert_eq!(resolve(&v, "/a~1b"), Some(&json!(1)));
    }
    #[test] fn escaped_tilde() {
        let v = json!({"a~b": 1});
        assert_eq!(resolve(&v, "/a~0b"), Some(&json!(1)));
    }
    #[test] fn invalid_no_slash() {
        let v = json!(1);
        assert_eq!(resolve(&v, "abc"), None);
    }
    #[test] fn through_array() {
        let v = json!({"data": [{"x": 1}, {"x": 2}]});
        assert_eq!(resolve(&v, "/data/1/x"), Some(&json!(2)));
    }
    #[test] fn bad_index_string() {
        let v = json!([1, 2]);
        assert_eq!(resolve(&v, "/abc"), None);
    }
}
