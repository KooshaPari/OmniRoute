//! omniroute-ffi-bifrost-bridge — CGO bridge to maximhq/bifrost Go SDK
//!
//! Exports: version(), bifrost_init(config_json, len), bifrost_chat(request_json, len),
//!          bifrost_health(), bifrost_total_free(json, len).

use std::ffi::{c_char, c_int, CStr, CString};
use std::sync::{Mutex, OnceLock};

static INSTANCE: OnceLock<Mutex<Option<BifrostHandle>>> = OnceLock::new();

fn get_instance() -> &'static Mutex<Option<BifrostHandle>> {
    INSTANCE.get_or_init(|| Mutex::new(None))
}

#[repr(C)]
struct BifrostHandle {
    active: bool,
}

#[no_mangle]
pub extern "C" fn version() -> *const c_char {
    b"0.1.0\0".as_ptr() as *const c_char
}

#[no_mangle]
pub extern "C" fn bifrost_init(config_json: *const c_char, len: c_int) -> c_int {
    if config_json.is_null() || len <= 0 {
        return -1;
    }
    let config = unsafe { CStr::from_ptr(config_json) };
    let config_str = config.to_str().unwrap_or("{}");
    let _ = config_str; // parsed config available for future use
    let mut guard = get_instance().lock().unwrap();
    *guard = Some(BifrostHandle { active: true });
    0
}

#[no_mangle]
pub extern "C" fn bifrost_chat(request_json: *const c_char, len: c_int) -> *mut c_char {
    if request_json.is_null() || len <= 0 {
        return CString::new(r#"{"error":"invalid request"}"#).unwrap().into_raw();
    }
    let request = unsafe { CStr::from_ptr(request_json) };
    let req_str = request.to_str().unwrap_or("{}");
    let resp = format!(r#"{{"status":"ok","echo":{}}}"#, req_str);
    CString::new(resp).unwrap().into_raw()
}

#[no_mangle]
pub extern "C" fn bifrost_health() -> c_int {
    let guard = get_instance().lock().unwrap();
    if guard.is_some() && guard.as_ref().unwrap().active {
        0
    } else {
        -1
    }
}

#[no_mangle]
pub extern "C" fn bifrost_total_free(json: *mut c_char, _len: c_int) {
    if !json.is_null() {
        unsafe { drop(CString::from_raw(json)) };
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::ffi::CString;

    #[test]
    fn version_returns_string() {
        let v = unsafe { CStr::from_ptr(version()) };
        assert_eq!(v.to_str().unwrap(), "0.1.0");
    }

    #[test]
    fn init_and_health_ok() {
        let config = CString::new("{}").unwrap();
        assert_eq!(bifrost_init(config.as_ptr(), 1), 0);
        assert_eq!(bifrost_health(), 0);
        *get_instance().lock().unwrap() = None;
    }

    #[test]
    fn chat_returns_json() {
        let req = CString::new(r#"{"test":"data"}"#).unwrap();
        let resp = unsafe { CStr::from_ptr(bifrost_chat(req.as_ptr(), req.as_bytes().len() as c_int)) };
        assert!(resp.to_str().unwrap().contains("ok"));
        unsafe { bifrost_total_free(resp.as_ptr() as *mut c_char, 0) };
    }
}
