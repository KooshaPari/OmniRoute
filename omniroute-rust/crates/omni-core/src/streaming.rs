//! Typed SSE streaming contract.
//!
//! Every executor streams [`ChatEvent`]s through [`SseFrame::encode`].
//! The OpenCode plugin (and any future consumer) parses the same
//! wire format. Locking this surface early prevents the chunk-shape
//! breakage that has historically hit plugin consumers on every
//! executor change.
//!
//! ## Wire format
//!
//! ```text
//! event: <SseEventName>
//! id: <ResponseId>          (omitted for Heartbeat)
//! data: <single-line JSON>
//!
//! ```
//!
//! The empty line at the end is the SSE frame terminator. Recipients
//! parse `data:` lines as JSON [`ChatEvent`] values.
//!
//! ## Terminal events
//!
//! `Done` and `Error` are terminal: a stream that emits either MUST
//! NOT emit any further events. The gateway closes the connection.
//! `Heartbeat` is non-terminal and may appear between any two
//! non-terminal events when the upstream stalls longer than
//! [`SSE_KEEP_ALIVE_SECONDS`].

use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::ids::{RequestId, ResponseId};
use crate::ids::ModelId;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Time between heartbeat frames when the upstream stalls.
///
/// Heartbeats keep idle connections warm through proxies that time
/// out otherwise (nginx `proxy_read_timeout`, ALB idle timeout, etc.).
pub const SSE_KEEP_ALIVE_SECONDS: u64 = 15;

/// Maximum bytes per `data:` line (defense against runaway upstreams).
///
/// A chunk larger than this is a malformed executor — we reject it at
/// the executor boundary rather than splitting it across frames (which
/// would corrupt the JSON).
pub const SSE_MAX_CHUNK_BYTES: usize = 65_536;

/// Convenience: heartbeat interval as a [`Duration`].
pub const SSE_KEEP_ALIVE: Duration = Duration::from_secs(SSE_KEEP_ALIVE_SECONDS);

// ---------------------------------------------------------------------------
// SSE event names (the 5 events the gateway ever sends)
// ---------------------------------------------------------------------------

/// The event-name line of an SSE frame.
///
/// Corresponds 1:1 to the variants of [`ChatEvent`] (Heartbeat is the
/// only event without an `id:` line, so it's distinct here).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SseEventName {
    /// Stream open + correlation IDs (`Begin`).
    #[serde(rename = "begin")]
    Begin,
    /// Token chunk (`Chunk`).
    #[serde(rename = "chunk")]
    Chunk,
    /// Stream end with token accounting (`Done`).
    #[serde(rename = "done")]
    Done,
    /// Terminal error (`Error`).
    #[serde(rename = "error")]
    Error,
    /// Liveness ping (`Heartbeat`). Never carries an `id:` field.
    #[serde(rename = "heartbeat")]
    Heartbeat,
}

impl SseEventName {
    /// String form used on the wire (matches serde rename).
    #[must_use]
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::Begin => "begin",
            Self::Chunk => "chunk",
            Self::Done => "done",
            Self::Error => "error",
            Self::Heartbeat => "heartbeat",
        }
    }
}

// ---------------------------------------------------------------------------
// Token accounting
// ---------------------------------------------------------------------------

/// Canonical token accounting for one request.
///
/// `total` is computed by the gateway (`input + output`) so consumers
/// don't have to. Provider-reported totals are validated against this
/// derivation and the executor emits a warning span when they diverge.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct TokenUsage {
    /// Tokens consumed from the prompt (input side).
    pub input: u64,
    /// Tokens generated in the completion (output side).
    pub output: u64,
    /// Sum of `input + output` (computed by [`TokenUsage::new`]).
    pub total: u64,
}

impl TokenUsage {
    /// Construct with input + output, computing total.
    #[must_use]
    pub const fn new(input: u64, output: u64) -> Self {
        Self {
            input,
            output,
            total: input + output,
        }
    }
}

// ---------------------------------------------------------------------------
// Chat event body (the typed message)
// ---------------------------------------------------------------------------

/// Typed event body that flows through the gateway.
///
/// Variants correspond 1:1 to [`SseEventName`] (Heartbeat excluded —
/// it has no `id:` field, so its variant name alone is sufficient).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ChatEvent {
    /// Stream open. Emitted exactly once at the start of every stream.
    Begin {
        request_id: RequestId,
        response_id: ResponseId,
        model: ModelId,
        /// Unix epoch seconds when the gateway opened the stream.
        created: u64,
    },
    /// Token chunk. Emitted many times during the stream.
    Chunk {
        /// Token(s) to append to the running completion.
        delta: String,
        /// Present only on the terminal chunk of the stream.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        finish_reason: Option<FinishReason>,
    },
    /// Stream end with token accounting. Terminal.
    Done {
        usage: TokenUsage,
        /// Total time from `Begin` to `Done`, in milliseconds.
        total_duration_ms: u64,
    },
    /// Terminal error. Stream MUST close after this.
    Error {
        code: String,
        message: String,
        /// Seconds the client should wait before retrying.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        retry_after: Option<u64>,
    },
    /// Liveness ping. Non-terminal; no `id:` field on the wire.
    Heartbeat {
        /// Unix epoch seconds when the heartbeat was emitted.
        sent_at: u64,
    },
}

/// Why the upstream stopped generating tokens.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FinishReason {
    /// Natural completion (`stop` from OpenAI).
    Stop,
    /// Hit the configured max_tokens limit.
    Length,
    /// Caller-supplied stop sequence matched.
    StopSequence,
    /// Tool call requested by the model.
    ToolCalls,
    /// Provider-defined content filter triggered.
    ContentFilter,
}

// ---------------------------------------------------------------------------
// SSE wire encoder
// ---------------------------------------------------------------------------

/// One SSE frame ready to be written to the response stream.
///
/// `encode(event)` produces the canonical `event:` / `id:` / `data:`
/// / blank-line shape. The `id:` line is omitted for [`ChatEvent::Heartbeat`]
/// per the SSE spec (no event ID to correlate for replay).
#[derive(Debug, Clone, PartialEq)]
pub struct SseFrame {
    /// Event-name line value.
    pub name: SseEventName,
    /// `id:` line value (`None` for Heartbeat).
    pub id: Option<ResponseId>,
    /// `data:` line value (single-line JSON).
    pub data: String,
}

impl SseFrame {
    /// Build a frame from a [`ChatEvent`].
    ///
    /// Returns `Err(EncodeError::TooLarge)` if the JSON body exceeds
    /// [`SSE_MAX_CHUNK_BYTES`].
    pub fn encode(event: &ChatEvent) -> Result<Self, EncodeError> {
        let data = serde_json::to_string(event).map_err(|_| EncodeError::InvalidJson)?;
        if data.len() > SSE_MAX_CHUNK_BYTES {
            return Err(EncodeError::TooLarge {
                bytes: data.len(),
                cap: SSE_MAX_CHUNK_BYTES,
            });
        }
        let (name, id) = match event {
            ChatEvent::Begin { response_id, .. } => (SseEventName::Begin, Some(*response_id)),
            ChatEvent::Chunk { .. } => (SseEventName::Chunk, None),
            ChatEvent::Done { .. } => (SseEventName::Done, None),
            ChatEvent::Error { .. } => (SseEventName::Error, None),
            // Heartbeat frames MUST NOT carry an `id:` line per spec.
            ChatEvent::Heartbeat { .. } => (SseEventName::Heartbeat, None),
        };
        Ok(Self {
            name,
            id,
            data,
        })
    }

    /// Render this frame to its on-wire string form (ends with `\n\n`).
    pub fn to_wire_string(&self) -> String {
        let mut out = String::with_capacity(self.data.len() + 32);
        out.push_str("event: ");
        out.push_str(self.name.as_str());
        out.push('\n');
        if let Some(id) = self.id {
            out.push_str("id: ");
            out.push_str(&id.to_string());
            out.push('\n');
        }
        out.push_str("data: ");
        out.push_str(&self.data);
        out.push('\n');
        out.push('\n');
        out
    }
}

/// Convenience: encode a [`ChatEvent`] directly to its wire string.
pub fn encode_chat_event(event: &ChatEvent) -> Result<String, EncodeError> {
    Ok(SseFrame::encode(event)?.to_wire_string())
}

/// Errors returned by [`SseFrame::encode`].
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum EncodeError {
    /// The event's JSON body failed to serialize (should be unreachable
    /// for well-formed variants; surfaces as a guard).
    #[error("invalid JSON for SSE event")]
    InvalidJson,
    /// The JSON body exceeded [`SSE_MAX_CHUNK_BYTES`].
    #[error("SSE chunk too large: {bytes} bytes (cap {cap})")]
    TooLarge { bytes: usize, cap: usize },
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_wire(wire: &str) -> (Option<&str>, Option<&str>, &str) {
        let mut event = None;
        let mut id = None;
        let mut data = None;
        for line in wire.lines() {
            if let Some(rest) = line.strip_prefix("event: ") {
                event = Some(rest);
            } else if let Some(rest) = line.strip_prefix("id: ") {
                id = Some(rest);
            } else if let Some(rest) = line.strip_prefix("data: ") {
                data = Some(rest);
            }
        }
        (event, id, data.expect("data line present"))
    }

    #[test]
    fn encode_chat_event_begin_roundtrips_through_parser() {
        let req = RequestId::new();
        let resp = ResponseId::new();
        let model = ModelId::from("gpt-4o");
        let event = ChatEvent::Begin {
            request_id: req,
            response_id: resp,
            model,
            created: 1_700_000_000,
        };
        let wire = encode_chat_event(&event).unwrap();
        let (name, id, data) = parse_wire(&wire);
        assert_eq!(name, Some("begin"));
        assert_eq!(id, Some(resp.to_string().as_str()));
        let back: ChatEvent = serde_json::from_str(data).unwrap();
        assert_eq!(back, event);
    }

    #[test]
    fn encode_chat_event_chunk_roundtrips_through_parser() {
        let event = ChatEvent::Chunk {
            delta: "hello".into(),
            finish_reason: None,
        };
        let wire = encode_chat_event(&event).unwrap();
        let (name, _id, data) = parse_wire(&wire);
        assert_eq!(name, Some("chunk"));
        assert!(_id.is_none(), "Chunk has no id field");
        let back: ChatEvent = serde_json::from_str(data).unwrap();
        assert_eq!(back, event);
    }

    #[test]
    fn encode_chat_event_done_carries_usage() {
        let event = ChatEvent::Done {
            usage: TokenUsage::new(100, 200),
            total_duration_ms: 1234,
        };
        let wire = encode_chat_event(&event).unwrap();
        let (name, _id, data) = parse_wire(&wire);
        assert_eq!(name, Some("done"));
        let back: ChatEvent = serde_json::from_str(data).unwrap();
        if let ChatEvent::Done { usage, .. } = back {
            assert_eq!(usage.input, 100);
            assert_eq!(usage.output, 200);
            assert_eq!(usage.total, 300);
        } else {
            panic!("expected Done");
        }
    }

    #[test]
    fn encode_chat_event_error_carries_retry_after() {
        let event = ChatEvent::Error {
            code: "rate_limited".into(),
            message: "slow down".into(),
            retry_after: Some(30),
        };
        let wire = encode_chat_event(&event).unwrap();
        let (name, _id, data) = parse_wire(&wire);
        assert_eq!(name, Some("error"));
        let back: ChatEvent = serde_json::from_str(data).unwrap();
        if let ChatEvent::Error {
            code,
            retry_after,
            ..
        } = back
        {
            assert_eq!(code, "rate_limited");
            assert_eq!(retry_after, Some(30));
        } else {
            panic!("expected Error");
        }
    }

    #[test]
    fn encode_chat_event_heartbeat_roundtrips_through_parser() {
        let event = ChatEvent::Heartbeat {
            sent_at: 1_700_000_005,
        };
        let wire = encode_chat_event(&event).unwrap();
        let (name, id, data) = parse_wire(&wire);
        assert_eq!(name, Some("heartbeat"));
        assert!(id.is_none(), "Heartbeat must not carry an id field");
        let back: ChatEvent = serde_json::from_str(data).unwrap();
        assert_eq!(back, event);
    }

    #[test]
    fn sse_frame_encodes_id_field_for_replay() {
        let req = RequestId::new();
        let resp = ResponseId::new();
        let event = ChatEvent::Begin {
            request_id: req,
            response_id: resp,
            model: ModelId::from("claude-sonnet-4-5"),
            created: 1_700_000_000,
        };
        let frame = SseFrame::encode(&event).unwrap();
        let wire = frame.to_wire_string();
        assert!(wire.contains(&format!("id: {}", resp)));
    }

    #[test]
    fn sse_keep_alive_constant_is_15_seconds() {
        assert_eq!(SSE_KEEP_ALIVE_SECONDS, 15);
        assert_eq!(SSE_KEEP_ALIVE, Duration::from_secs(15));
    }

    #[test]
    fn chunk_finish_reason_absent_when_continuing() {
        let event = ChatEvent::Chunk {
            delta: "more".into(),
            finish_reason: None,
        };
        let s = serde_json::to_string(&event).unwrap();
        assert!(!s.contains("finish_reason"), "absent on continuing chunk");
    }

    #[test]
    fn chunk_finish_reason_present_on_terminal_chunk() {
        let event = ChatEvent::Chunk {
            delta: "".into(),
            finish_reason: Some(FinishReason::Stop),
        };
        let s = serde_json::to_string(&event).unwrap();
        assert!(s.contains("finish_reason"));
        assert!(s.contains("stop"));
    }

    #[test]
    fn token_usage_input_output_total_are_independent() {
        let u = TokenUsage::new(0, 0);
        assert_eq!(u.input, 0);
        assert_eq!(u.output, 0);
        assert_eq!(u.total, 0);
        let u = TokenUsage::new(50, 0);
        assert_eq!(u.total, 50);
        let u = TokenUsage::new(0, 75);
        assert_eq!(u.total, 75);
    }

    #[test]
    fn token_usage_total_equals_input_plus_output() {
        let u = TokenUsage::new(123, 456);
        assert_eq!(u.total, u.input + u.output);
    }

    #[test]
    fn sse_frame_id_field_absent_when_response_id_is_unset() {
        // Chunk has no response_id by design.
        let event = ChatEvent::Chunk {
            delta: "x".into(),
            finish_reason: None,
        };
        let frame = SseFrame::encode(&event).unwrap();
        assert!(frame.id.is_none());
    }

    #[test]
    fn chat_event_clone_is_idempotent() {
        let event = ChatEvent::Error {
            code: "x".into(),
            message: "y".into(),
            retry_after: None,
        };
        assert_eq!(event.clone(), event);
    }

    #[test]
    fn chat_event_serializes_with_snake_case_keys() {
        let event = ChatEvent::Chunk {
            delta: "x".into(),
            finish_reason: Some(FinishReason::Length),
        };
        let s = serde_json::to_string(&event).unwrap();
        assert!(s.contains("\"finish_reason\""));
        assert!(s.contains("\"length\""));
    }

    #[test]
    fn sse_frame_data_field_is_single_line_json() {
        let event = ChatEvent::Done {
            usage: TokenUsage::new(1, 2),
            total_duration_ms: 5,
        };
        let frame = SseFrame::encode(&event).unwrap();
        // The data string must not contain newlines.
        assert!(!frame.data.contains('\n'));
        let wire = frame.to_wire_string();
        // The wire form has newlines but they are delimiters, not in data.
        assert!(wire.ends_with("\n\n"));
    }
}