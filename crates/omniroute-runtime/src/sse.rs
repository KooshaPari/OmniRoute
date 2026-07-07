//! SSE encoder and decoder for the data plane.
//!
//! Wire format (both inbound and outbound):
//! ```text
//! data: <json>\n\n
//! data: <json>\n\n
//! ...
//! data: [DONE]\n\n
//! ```
//!
//! Optional event lines (e.g. `event: error`) are emitted by the encoder
//! when a [`StreamChunk`] carries an [`ApiError`](omniroute_core::ApiError).
//! The decoder strips event/control lines and parses only `data:` payloads.

use omniroute_core::StreamChunk;

/// Encode one [`StreamChunk`] into SSE wire bytes.
///
/// Returns the bytes to write to the client stream. If `chunk.done` is set,
/// returns the terminal `data: [DONE]\n\n` sentinel. If `chunk.error` is set,
/// emits an `event: error\ndata: <json>\n\n` pair.
pub fn encode_sse(chunk: &StreamChunk) -> String {
    if chunk.done {
        return "data: [DONE]\n\n".to_string();
    }
    if let Some(ref err) = chunk.error {
        return format!(
            "event: error\ndata: {}\n\n",
            serde_json::to_string(err).unwrap_or_else(|_| {
                r#"{"message":"sse encode failure"}"#.to_string()
            })
        );
    }
    match serde_json::to_string(chunk) {
        Ok(s) => format!("data: {s}\n\n"),
        Err(_) => {
            "event: error\ndata: {\"message\":\"chunk encode failed\"}\n\n".to_string()
        }
    }
}

/// Decode one SSE event payload (the part after `data: ` on a single line)
/// into a [`StreamChunk`].
///
/// Returns `None` for the `[DONE]` sentinel.
pub fn decode_sse_data(line: &str) -> Option<Result<StreamChunk, String>> {
    let trimmed = line.trim_start_matches("data:").trim();
    if trimmed == "[DONE]" {
        return None;
    }
    Some(
        serde_json::from_str::<StreamChunk>(trimmed)
            .map_err(|e| format!("sse decode error: {e}")),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use omniroute_core::StreamChunk;

    #[test]
    fn encode_done_sentinel() {
        let chunk = StreamChunk::new("x", "gpt-4o", 0).with_done();
        assert_eq!(encode_sse(&chunk), "data: [DONE]\n\n");
    }

    #[test]
    fn encode_data_chunk() {
        let chunk = StreamChunk::new("x", "gpt-4o", 0);
        let out = encode_sse(&chunk);
        assert!(out.starts_with("data: "));
        assert!(out.ends_with("\n\n"));
    }

    #[test]
    fn encode_error_chunk_uses_event_line() {
        let chunk = StreamChunk::new("x", "gpt-4o", 0).with_error(omniroute_core::ApiError {
            message: "boom".into(),
            r#type: Some("internal".into()),
            code: None,
        });
        let out = encode_sse(&chunk);
        assert!(out.starts_with("event: error\ndata: "));
        assert!(out.contains("\"message\":\"boom\""));
    }

    #[test]
    fn decode_done_returns_none() {
        assert!(decode_sse_data("data: [DONE]").is_none());
        assert!(decode_sse_data("data:[DONE]").is_none());
    }

    #[test]
    fn decode_valid_chunk() {
        let chunk = StreamChunk::new("x", "gpt-4o", 0);
        let wire = encode_sse(&chunk);
        let parsed = decode_sse_data(&wire).expect("not [DONE]").expect("ok");
        assert_eq!(parsed.id, "x");
        assert_eq!(parsed.model, "gpt-4o");
        assert!(!parsed.done);
    }
}