// SPDX-License-Identifier: MIT OR Apache-2.0

//! Hello Connector: minimal reference plugin that returns hardcoded event.
//!
//! Compiles to wasm32-unknown-unknown. Exports:
//! - `poll(config_ptr: i32, config_len: i32) -> i64` — main entry point

#[no_mangle]
pub extern "C" fn poll(config_ptr: i32, config_len: i32) -> i64 {
    // Phase-1: ignore config, return hardcoded event
    let event = r#"{"id":"hello-001","kind":"test","timestamp":0,"data":{"message":"hello from wasm sandbox"}}"#;
    let bytes = event.as_bytes();

    // Pack return value: high 32 = ptr, low 32 = len
    let ptr = bytes.as_ptr() as i32;
    let len = bytes.len() as i32;

    ((ptr as i64) << 32) | (len as i64 & 0xFFFFFFFF)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hello_connector_export() {
        // Verify function is exportable
        let _fn_ptr: fn(i32, i32) -> i64 = poll;
    }
}
