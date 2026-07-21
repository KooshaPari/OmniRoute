use serde::{Deserialize, Serialize};
use std::ffi::{c_char, c_int, CStr, CString};

#[derive(Serialize, Deserialize)]
pub struct CandidateFactors {
    pub id: String,
    pub factors: [f32; 12],
}

#[derive(Serialize, Deserialize)]
pub struct ScoreRequest {
    pub candidates: Vec<CandidateFactors>,
    pub weights: [f32; 14],
    pub max_cost: u32,
    pub max_latency: u32,
}

#[derive(Serialize, Deserialize)]
pub struct ScoreResponse {
    pub scores: Vec<ScoreEntry>,
}

#[derive(Serialize, Deserialize)]
pub struct ScoreEntry {
    pub id: String,
    pub score: f32,
}

fn score_candidate(factors: &[f32; 12], weights: &[f32; 14]) -> f32 {
    let mut sum = 0.0f32;
    for i in 0..12 {
        sum += factors[i] * weights[i];
    }
    sum += weights[12] * factors[0].min(factors[1]);
    sum += weights[13] * factors[10].max(factors[11]);
    sum
}

/// JSON-ABI entry point matching the TS contract.
#[no_mangle]
pub extern "C" fn score_combo_simd(input_ptr: *const c_char, input_len: usize) -> *mut c_char {
    if input_ptr.is_null() || input_len == 0 {
        return error_response("input is null or empty");
    }
    let input = unsafe { CStr::from_ptr(input_ptr) };
    let input_str = match input.to_str() {
        Ok(s) => s,
        Err(_) => return error_response("invalid utf-8"),
    };
    let request: ScoreRequest = match serde_json::from_str(input_str) {
        Ok(r) => r,
        Err(e) => return error_response(&format!("json parse error: {e}")),
    };
    let mut scored: Vec<ScoreEntry> = request
        .candidates
        .into_iter()
        .map(|c| {
            let score = score_candidate(&c.factors, &request.weights);
            ScoreEntry { id: c.id, score }
        })
        .collect();
    scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    let response = ScoreResponse { scores: scored };
    let json = serde_json::to_string(&response).unwrap_or_else(|_| "{}".into());
    match CString::new(json) {
        Ok(cstr) => cstr.into_raw(),
        Err(_) => error_response("null byte in response"),
    }
}

/// Typed ABI entry: (features, total_len, candidates, err_out, err_out_len) -> *mut f32
#[no_mangle]
pub extern "C" fn score_combo_simd_typed(
    features: *const f32,
    total_len: usize,
    candidates: usize,
    _err_out_buf: *mut u8,
    _err_out_len: usize,
) -> *mut f32 {
    if features.is_null() || total_len == 0 || candidates == 0 {
        return std::ptr::null_mut();
    }
    let slice = unsafe { std::slice::from_raw_parts(features, total_len) };
    let weights = [
        slice[candidates * 12],
        slice[candidates * 12 + 1],
        slice[candidates * 12 + 2],
        slice[candidates * 12 + 3],
        slice[candidates * 12 + 4],
        slice[candidates * 12 + 5],
        slice[candidates * 12 + 6],
        slice[candidates * 12 + 7],
        slice[candidates * 12 + 8],
        slice[candidates * 12 + 9],
        slice[candidates * 12 + 10],
        slice[candidates * 12 + 11],
        slice[candidates * 12 + 12],
        slice[candidates * 12 + 13],
    ];
    let scores: Vec<f32> = (0..candidates)
        .map(|i| {
            let factors = [
                slice[i * 12],
                slice[i * 12 + 1],
                slice[i * 12 + 2],
                slice[i * 12 + 3],
                slice[i * 12 + 4],
                slice[i * 12 + 5],
                slice[i * 12 + 6],
                slice[i * 12 + 7],
                slice[i * 12 + 8],
                slice[i * 12 + 9],
                slice[i * 12 + 10],
                slice[i * 12 + 11],
            ];
            score_candidate(&factors, &weights)
        })
        .collect();
    let boxed = scores.into_boxed_slice();
    Box::into_raw(boxed) as *mut f32
}

/// Free memory from typed ABI path.
#[no_mangle]
pub extern "C" fn omniroute_ffi_combo_scorer_free_typed(ptr: *mut f32, len: usize) {
    if !ptr.is_null() && len > 0 {
        unsafe { let _ = Box::from_raw(std::slice::from_raw_parts_mut(ptr, len)); }
    }
}

/// Free memory from JSON-ABI path.
#[no_mangle]
pub extern "C" fn omniroute_ffi_combo_scorer_free(ptr: *mut c_char) {
    if !ptr.is_null() {
        unsafe { let _ = CString::from_raw(ptr); }
    }
}

fn error_response(msg: &str) -> *mut c_char {
    let resp = serde_json::json!({"error": msg});
    CString::new(resp.to_string())
        .unwrap_or_else(|_| CString::new("{}").unwrap())
        .into_raw()
}

/// Version string.
#[no_mangle]
pub extern "C" fn version() -> *const c_char {
    b"0.1.0\0".as_ptr() as *const c_char
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn score_candidate_basic() {
        let factors = [1.0; 12];
        let weights = [0.5; 14];
        let score = score_candidate(&factors, &weights);
        assert!(score > 0.0);
    }

    #[test]
    fn null_input_does_not_panic() {
        let result = score_combo_simd(std::ptr::null(), 0);
        assert!(!result.is_null());
        omniroute_ffi_combo_scorer_free(result);
    }

    #[test]
    fn typed_null_returns_null() {
        let result = score_combo_simd_typed(std::ptr::null(), 0, 0, std::ptr::null_mut(), 0);
        assert!(result.is_null());
    }
}
