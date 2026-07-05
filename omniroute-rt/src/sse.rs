//! SSE (Server-Sent Events) stream parsing utilities.
//!
//! In Phase 0, the stream is piped directly from reqwest's `bytes_stream()`
//! via a channel (handled in [`OpenAiExecutor`](crate::openai::OpenAiExecutor)).
//! This module provides helpers for parsing the [`data: ...`] SSE lines that
//! OpenAI and compatible APIs emit during streaming responses.

/// A parsed SSE event.
#[derive(Debug, Clone, PartialEq)]
pub struct SseEvent {
    /// The event type (from `event:` line; empty for `data:` only).
    pub event: String,
    /// The payload (from `data:` line). May be `[DONE]` for stream terminator.
    pub data: String,
}

/// Parse a raw SSE byte buffer into individual events.
///
/// Handles the standard SSE format:
/// ```text
/// event: completion
/// data: {"choices": [...]}
///
/// ```
pub fn parse_sse_events(buf: &[u8]) -> Vec<SseEvent> {
    let text = std::str::from_utf8(buf).unwrap_or("");
    let mut events = Vec::new();
    let mut current_event = String::new();
    let mut current_data = String::new();

    for line in text.lines() {
        if let Some(value) = line.strip_prefix("event: ") {
            current_event = value.trim().to_owned();
        } else if let Some(value) = line.strip_prefix("data: ") {
            current_data = value.trim().to_owned();
        } else if line.is_empty() && !current_data.is_empty() {
            events.push(SseEvent {
                event: std::mem::take(&mut current_event),
                data: std::mem::take(&mut current_data),
            });
        }
    }

    // Flush any trailing event without blank-line terminator.
    if !current_data.is_empty() {
        events.push(SseEvent {
            event: current_event,
            data: current_data,
        });
    }

    events
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_single_data_event() {
        let buf = b"data: {\"hello\":\"world\"}\n\n";
        let events = parse_sse_events(buf);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].data, r#"{"hello":"world"}"#);
        assert_eq!(events[0].event, "");
    }

    #[test]
    fn parses_event_with_type() {
        let buf = b"event: completion\ndata: {\"id\":\"x\"}\n\n";
        let events = parse_sse_events(buf);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event, "completion");
        assert_eq!(events[0].data, r#"{"id":"x"}"#);
    }

    #[test]
    fn parses_multiple_events() {
        let buf = b"data: {\"a\":1}\n\ndata: {\"b\":2}\n\n";
        let events = parse_sse_events(buf);
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].data, r#"{"a":1}"#);
        assert_eq!(events[1].data, r#"{"b":2}"#);
    }

    #[test]
    fn handles_done_signal() {
        let buf = b"data: [DONE]\n\n";
        let events = parse_sse_events(buf);
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].data, "[DONE]");
    }

    #[test]
    fn empty_buffer_returns_empty() {
        let events = parse_sse_events(b"");
        assert!(events.is_empty());
    }
}
