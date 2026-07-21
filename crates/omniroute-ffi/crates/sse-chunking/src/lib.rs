use std::ffi::{c_char, CStr, CString};

/// Chunk an SSE stream.
/// Input: JSON `{"raw_body": "...", "max_chunk_bytes": 4096, "keep_open": true}`
/// Output: JSON `{"chunks": [...], "total_bytes": N, "duration_micros": U}`
#[no_mangle]
pub extern "C" fn chunk_sse_stream(
    input_ptr: *const c_char,
    input_len: usize,
) -> *mut c_char {
    if input_ptr.is_null() || input_len == 0 {
        return to_c_string(r#"{"error":"null input"}"#);
    }
    let input = unsafe { CStr::from_ptr(input_ptr).to_str().unwrap_or("") };
    let start = std::time::Instant::now();

    let v: serde_json::Value = match serde_json::from_str(input) {
        Ok(v) => v,
        Err(e) => return to_c_string(&format!(r#"{{"error":"json parse: {e}"}}"#)),
    };

    let body = v["raw_body"].as_str().unwrap_or("");
    let max_chunk = v["max_chunk_bytes"].as_u64().unwrap_or(4096) as usize;

    let mut chunks: Vec<String> = Vec::new();
    let bytes = body.as_bytes();
    let mut offset = 0;
    while offset < bytes.len() {
        let end = (offset + max_chunk).min(bytes.len());
        let chunk = String::from_utf8_lossy(&bytes[offset..end]).to_string();
        chunks.push(format!("data: {chunk}\n\n"));
        offset = end;
    }

    let duration = start.elapsed().as_micros() as u64;
    let total = body.len();
    let response = serde_json::json!({
        "chunks": chunks,
        "total_bytes": total,
        "duration_micros": duration,
    });
    to_c_string(&response.to_string())
}

/// Version string.
#[no_mangle]
pub extern "C" fn version() -> *const std::ffi::c_char {
    b"0.1.0\0".as_ptr() as *const std::ffi::c_char
}

fn to_c_string(s: &str) -> *mut c_char {
    CString::new(s).unwrap_or_else(|_| CString::new("{}").unwrap()).into_raw()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn version_returns_non_null() {
        assert!(!version().is_null());
    }

    #[test]
    fn chunk_small_body() {
        let input = CString::new(r#"{"raw_body":"hello","max_chunk_bytes":1024,"keep_open":true}"#).unwrap();
        let resp = chunk_sse_stream(input.as_ptr(), input.to_bytes().len());
        let s = unsafe { CStr::from_ptr(resp).to_str().unwrap() };
        assert!(s.contains("hello"));
        assert!(s.contains("total_bytes"));
        unsafe { CString::from_raw(resp); }
    }

    #[test]
    fn chunk_null_input() {
        let resp = chunk_sse_stream(std::ptr::null(), 0);
        let s = unsafe { CStr::from_ptr(resp).to_str().unwrap() };
        assert!(s.contains("error"));
        unsafe { CString::from_raw(resp); }
    }
}
