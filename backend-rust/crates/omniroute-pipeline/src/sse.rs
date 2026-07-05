//! SSE (Server-Sent Events) byte parser for LLM streaming.
//!
//! The parser is tolerant of both OpenAI-style (`data: {...}`) and
//! Anthropic-style (`event: ...\ndata: ...`) frame formats. It emits a
//! `Vec<StreamEvent>` per buffer; incomplete trailing frames are dropped
//! (caller should re-feed the remaining bytes on the next read).

use bytes::Bytes;
use omniroute_core::error::Result;
use omniroute_core::provider::{StreamEvent, ToolCallPartial};
use omniroute_core::request::Usage;

/// Parse a buffer of SSE bytes into a list of `StreamEvent`s.
pub fn parse_sse_bytes(buf: &Bytes) -> Result<Vec<StreamEvent>> {
    let text = match std::str::from_utf8(buf) {
        Ok(t) => t,
        Err(_) => return Ok(Vec::new()),
    };
    let mut out = Vec::new();
    for frame in text.split("\n\n") {
        if frame.is_empty() {
            continue;
        }
        let mut event_type: Option<String> = None;
        let mut data_lines: Vec<String> = Vec::new();
        for line in frame.split('\n') {
            let line = line.trim_end_matches('\r');
            if line.is_empty() {
                continue;
            }
            // Comment / heartbeat — ignore.
            if line.starts_with(':') {
                continue;
            }
            if let Some(rest) = line.strip_prefix("event: ") {
                event_type = Some(rest.to_string());
            } else if let Some(rest) = line.strip_prefix("data: ") {
                data_lines.push(rest.to_string());
            } else if let Some(rest) = line.strip_prefix("data:") {
                // SSE allows `data:` with no space.
                data_lines.push(rest.trim_start().to_string());
            }
            // All other field types (id:, retry:, etc.) are ignored for v1.
        }
        if data_lines.is_empty() {
            continue;
        }
        let data = data_lines.join("\n");
        let trimmed = data.trim();
        if trimmed == "[DONE]" {
            out.push(StreamEvent::Done);
            continue;
        }
        let v: serde_json::Value = match serde_json::from_str(&data) {
            Ok(v) => v,
            Err(_) => continue, // Skip malformed JSON silently.
        };
        out.extend(decode_event(&v, event_type.as_deref()));
    }
    Ok(out)
}

/// Dispatch a parsed JSON value + optional event type into StreamEvents.
fn decode_event(v: &serde_json::Value, event_type: Option<&str>) -> Vec<StreamEvent> {
    // Anthropic: event: content_block_delta
    if event_type == Some("content_block_delta") {
        if let Some(text) = v
            .get("delta")
            .and_then(|d| d.get("text"))
            .and_then(|t| t.as_str())
        {
            if !text.is_empty() {
                return vec![StreamEvent::Content(text.to_string())];
            }
        }
        return Vec::new();
    }
    if event_type == Some("message_stop") {
        return vec![StreamEvent::Done];
    }
    if event_type == Some("error") {
        let msg = v
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
            .unwrap_or("upstream error")
            .to_string();
        return vec![StreamEvent::Error(msg)];
    }

    // OpenAI / generic: choices[].delta.{content, reasoning, tool_calls}
    let mut out = Vec::new();
    if let Some(choices) = v.get("choices").and_then(|c| c.as_array()) {
        for c in choices {
            if let Some(delta) = c.get("delta") {
                if let Some(content) = delta.get("content").and_then(|x| x.as_str()) {
                    if !content.is_empty() {
                        out.push(StreamEvent::Content(content.to_string()));
                    }
                }
                if let Some(reasoning) = delta.get("reasoning").and_then(|x| x.as_str()) {
                    if !reasoning.is_empty() {
                        out.push(StreamEvent::Reasoning(reasoning.to_string()));
                    }
                }
                if let Some(tcs) = delta.get("tool_calls").and_then(|x| x.as_array()) {
                    for (i, tc) in tcs.iter().enumerate() {
                        let partial = ToolCallPartial {
                            index: tc.get("index").and_then(|x| x.as_u64()).unwrap_or(i as u64) as u32,
                            id: tc
                                .get("id")
                                .and_then(|x| x.as_str())
                                .map(|s| s.to_string()),
                            name: tc
                                .get("function")
                                .and_then(|f| f.get("name"))
                                .and_then(|x| x.as_str())
                                .map(|s| s.to_string()),
                            arguments_delta: tc
                                .get("function")
                                .and_then(|f| f.get("arguments"))
                                .and_then(|x| x.as_str())
                                .map(|s| s.to_string()),
                        };
                        out.push(StreamEvent::ToolCallDelta(partial));
                    }
                }
            }
            // `finish_reason` is detected but does not emit a Done event on its
            // own; the [DONE] sentinel or a final Usage chunk is the canonical
            // done signal in v1.
        }
    }
    if !out.is_empty() {
        return out;
    }
    // Bare usage chunk (some providers send a final usage-only frame).
    if let Some(usage) = v.get("usage") {
        if let Some(u) = parse_usage(usage) {
            return vec![StreamEvent::Usage(u)];
        }
    }
    Vec::new()
}

fn parse_usage(v: &serde_json::Value) -> Option<Usage> {
    Some(Usage {
        prompt_tokens: v.get("prompt_tokens").and_then(|x| x.as_u64()).unwrap_or(0) as u32,
        completion_tokens: v.get("completion_tokens").and_then(|x| x.as_u64()).unwrap_or(0) as u32,
        total_tokens: v.get("total_tokens").and_then(|x| x.as_u64()).unwrap_or(0) as u32,
        reasoning_tokens: v.get("reasoning_tokens").and_then(|x| x.as_u64()).map(|n| n as u32),
        cached_tokens: v.get("cached_tokens").and_then(|x| x.as_u64()).map(|n| n as u32),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_sse_bytes_openai_style() {
        let buf = Bytes::from_static(
            b"data: {\"choices\":[{\"delta\":{\"content\":\"hel\"}}]}\n\n\
              data: {\"choices\":[{\"delta\":{\"content\":\"lo\"}}]}\n\n\
              data: [DONE]\n\n",
        );
        let events = parse_sse_bytes(&buf).unwrap();
        let content: Vec<String> = events
            .iter()
            .filter_map(|e| match e {
                StreamEvent::Content(s) => Some(s.clone()),
                _ => None,
            })
            .collect();
        assert_eq!(content, vec!["hel", "lo"]);
        assert!(matches!(events.last(), Some(StreamEvent::Done)));
    }

    #[test]
    fn parse_sse_bytes_anthropic_style() {
        let buf = Bytes::from_static(
            b"event: content_block_delta\ndata: {\"delta\":{\"text\":\"hello\"}}\n\n\
              event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n",
        );
        let events = parse_sse_bytes(&buf).unwrap();
        assert!(matches!(events.first(), Some(StreamEvent::Content(s)) if s == "hello"));
        assert!(matches!(events.last(), Some(StreamEvent::Done)));
    }

    #[test]
    fn parse_sse_bytes_handles_heartbeat_blank_lines() {
        let buf = Bytes::from_static(
            b": heartbeat\n\n\
              data: {\"choices\":[{\"delta\":{\"content\":\"x\"}}]}\n\n\
              \n\n\
              data: [DONE]\n\n",
        );
        let events = parse_sse_bytes(&buf).unwrap();
        let content: Vec<String> = events
            .iter()
            .filter_map(|e| match e {
                StreamEvent::Content(s) => Some(s.clone()),
                _ => None,
            })
            .collect();
        assert_eq!(content, vec!["x"]);
        assert!(matches!(events.last(), Some(StreamEvent::Done)));
    }

    #[test]
    fn parse_sse_bytes_unknown_event_is_ignored() {
        let buf = Bytes::from_static(
            b"event: ping\ndata: {}\n\n\
              data: {\"choices\":[{\"delta\":{\"content\":\"y\"}}]}\n\n\
              data: [DONE]\n\n",
        );
        let events = parse_sse_bytes(&buf).unwrap();
        // The `event: ping` frame has empty choices + no usage, so it
        // produces no events; the rest produces Content("y") + Done.
        let content: Vec<String> = events
            .iter()
            .filter_map(|e| match e {
                StreamEvent::Content(s) => Some(s.clone()),
                _ => None,
            })
            .collect();
        assert_eq!(content, vec!["y"]);
    }

    #[test]
    fn parse_sse_bytes_malformed_json_skipped_silently() {
        let buf = Bytes::from_static(
            b"data: not-json\n\n\
              data: {\"choices\":[{\"delta\":{\"content\":\"ok\"}}]}\n\n\
              data: [DONE]\n\n",
        );
        let events = parse_sse_bytes(&buf).unwrap();
        let content: Vec<String> = events
            .iter()
            .filter_map(|e| match e {
                StreamEvent::Content(s) => Some(s.clone()),
                _ => None,
            })
            .collect();
        assert_eq!(content, vec!["ok"]);
    }

    #[test]
    fn parse_sse_bytes_emits_usage_chunk() {
        let buf = Bytes::from_static(
            b"data: {\"usage\":{\"prompt_tokens\":3,\"completion_tokens\":4,\"total_tokens\":7}}\n\n",
        );
        let events = parse_sse_bytes(&buf).unwrap();
        let usage = events
            .iter()
            .find_map(|e| match e {
                StreamEvent::Usage(u) => Some(u.clone()),
                _ => None,
            })
            .expect("usage event");
        assert_eq!(usage.prompt_tokens, 3);
        assert_eq!(usage.completion_tokens, 4);
        assert_eq!(usage.total_tokens, 7);
    }

    #[test]
    fn parse_sse_bytes_handles_tool_call_delta() {
        let buf = Bytes::from_static(
            b"data: {\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_x\",\"function\":{\"name\":\"get_weather\",\"arguments\":\"{\\\"city\\\":\"}}]}}]}\n\n",
        );
        let events = parse_sse_bytes(&buf).unwrap();
        let partial = events
            .iter()
            .find_map(|e| match e {
                StreamEvent::ToolCallDelta(p) => Some(p.clone()),
                _ => None,
            })
            .expect("tool call delta");
        assert_eq!(partial.index, 0);
        assert_eq!(partial.id.as_deref(), Some("call_x"));
        assert_eq!(partial.name.as_deref(), Some("get_weather"));
        assert!(partial.arguments_delta.is_some());
    }
}
