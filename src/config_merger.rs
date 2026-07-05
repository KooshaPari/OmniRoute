use std::collections::HashMap;

pub fn merge(base: &HashMap<String, String>, overlay: &HashMap<String, String>) -> HashMap<String, String> {
    let mut result = base.clone();
    for (k, v) in overlay {
        result.insert(k.clone(), v.clone());
    }
    result
}

pub fn deep_merge(base: &HashMap<String, String>, overlay: &HashMap<String, String>, allow_override: bool) -> HashMap<String, String> {
    let mut result = base.clone();
    for (k, v) in overlay {
        if !allow_override && result.contains_key(k) { continue; }
        result.insert(k.clone(), v.clone());
    }
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    fn map(items: &[(&str, &str)]) -> HashMap<String, String> {
        items.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
    }
    #[test] fn merge_basic() { let b = map(&[("a", "1")]); let o = map(&[("b", "2")]); let m = merge(&b, &o); assert_eq!(m.get("a"), Some(&"1".to_string())); assert_eq!(m.get("b"), Some(&"2".to_string())); }
    #[test] fn merge_override() { let b = map(&[("a", "1")]); let o = map(&[("a", "2")]); let m = merge(&b, &o); assert_eq!(m.get("a"), Some(&"2".to_string())); }
    #[test] fn deep_merge_no_override() { let b = map(&[("a", "1")]); let o = map(&[("a", "2"), ("b", "3")]); let m = deep_merge(&b, &o, false); assert_eq!(m.get("a"), Some(&"1".to_string())); assert_eq!(m.get("b"), Some(&"3".to_string())); }
    #[test] fn deep_merge_with_override() { let b = map(&[("a", "1")]); let o = map(&[("a", "2")]); let m = deep_merge(&b, &o, true); assert_eq!(m.get("a"), Some(&"2".to_string())); }
}
