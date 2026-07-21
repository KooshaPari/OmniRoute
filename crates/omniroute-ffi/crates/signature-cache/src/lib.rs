use std::ffi::{c_char, c_int, CStr, CString};
use std::collections::HashMap;
use std::sync::Mutex;
use parking_lot::RwLock;

lazy_static::lazy_static! {
    static ref CACHE: RwLock<HashMap<String, String>> = RwLock::new(HashMap::new());
}

/// Insert an entry into the semantic cache.
/// Input: JSON `{"key": "...", "value": "..."}`
#[no_mangle]
pub extern "C" fn semantic_lookup_simd(
    input_ptr: *const c_char,
    input_len: usize,
) -> *mut c_char {
    if input_ptr.is_null() || input_len == 0 {
        return error_response("input is null or empty");
    }
    let input_str = unsafe {
        match CStr::from_ptr(input_ptr).to_str() {
            Ok(s) => s,
            Err(_) => return error_response("invalid utf-8"),
        }
    };

    let v: serde_json::Value = match serde_json::from_str(input_str) {
        Ok(v) => v,
        Err(e) => return error_response(&format!("json parse error: {e}")),
    };

    let prompt = v["prompt"].as_str().unwrap_or("");
    let threshold = v["simhash_threshold"].as_f64().unwrap_or(0.85);
    let max_entries = v["max_entries"].as_u64().unwrap_or(10) as usize;

    // Simple linear scan (bucketed v2 in future)
    let cache = CACHE.read();
    let mut results: Vec<serde_json::Value> = Vec::new();
    for (k, val) in cache.iter().take(max_entries) {
        if k == prompt {
            results.push(serde_json::json!({"key": k, "value": val, "similarity": 1.0}));
        }
    }
    let response = serde_json::json!({"matches": results, "total": cache.len()});
    to_c_string(&response.to_string())
}

/// Insert entry into cache.
#[no_mangle]
pub extern "C" fn insert_entry(
    key_ptr: *const c_char,
    key_len: usize,
    value_ptr: *const c_char,
    value_len: usize,
) -> *mut c_char {
    if key_ptr.is_null() || value_ptr.is_null() || key_len == 0 || value_len == 0 {
        return error_response("null input");
    }
    let key = unsafe { CStr::from_ptr(key_ptr).to_str().unwrap_or("") }.to_string();
    let value = unsafe { CStr::from_ptr(value_ptr).to_str().unwrap_or("") }.to_string();
    CACHE.write().insert(key, value);
    to_c_string(r#"{"ok":true}"#)
}

/// Version string.
#[no_mangle]
pub extern "C" fn version() -> *const std::ffi::c_char {
    b"0.1.0\0".as_ptr() as *const std::ffi::c_char
}

fn to_c_string(s: &str) -> *mut c_char {
    CString::new(s).unwrap_or_else(|_| CString::new("{}").unwrap()).into_raw()
}

fn error_response(msg: &str) -> *mut c_char {
    to_c_string(&format!(r#"{{"error":"{msg}"}}"#))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_returns_non_null() {
        assert!(!version().is_null());
    }

    #[test]
    fn lookup_null_input() {
        let r = semantic_lookup_simd(std::ptr::null(), 0);
        assert!(!r.is_null());
        unsafe { std::ffi::CString::from_raw(r); }
    }

    #[test]
    fn insert_and_lookup() {
        let key = CString::new("test-key").unwrap();
        let val = CString::new("test-value").unwrap();
        let r = insert_entry(key.as_ptr(), 8, val.as_ptr(), 11);
        unsafe { std::ffi::CString::from_raw(r); }

        let query = CString::new(r#"{"prompt":"test-key","simhash_threshold":0.8,"max_entries":10}"#).unwrap();
        let resp = semantic_lookup_simd(query.as_ptr(), query.to_bytes().len());
        let s = unsafe { CStr::from_ptr(resp).to_str().unwrap() };
        assert!(s.contains("test-key"));
        unsafe { std::ffi::CString::from_raw(resp); }
    }
}
