//! Anthropic SSE stream event types.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use super::common::ClaudeUsage;
use super::messages::{ContentBlock, MessagesResponse, ClaudeRole};

/// Top-level discriminated union of every Anthropic SSE event. New event
/// types are preserved as `Unknown` for forward-compat.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MessagesStreamEvent {
    Error {
        error: StreamError,
    },
    Ping,
    MessageStart {
        message: MessagesResponse,
    },
    MessageDelta {
        delta: MessageDelta,
        usage: ClaudeUsage,
    },
    MessageStop,
    ContentBlockStart {
        index: u32,
        content_block: ContentBlock,
    },
    ContentBlockDelta {
        index: u32,
        delta: ContentBlockDelta,
    },
    ContentBlockStop {
        index: u32,
    },
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MessageDelta {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stop_reason: Option<super::messages::ClaudeStopReason>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stop_sequence: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlockDelta {
    TextDelta { text: String },
    InputJsonDelta { partial_json: String },
    ThinkingDelta { thinking: String },
    SignatureDelta { signature: String },
    CitationsDelta { citation: serde_json::Value },
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StreamErrorEnvelope {
    pub error: StreamError,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct StreamError {
    #[serde(rename = "type")]
    pub kind: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

impl MessagesStreamEvent {
    /// Whether this event is the terminal event of the stream.
    #[must_use]
    pub const fn is_terminal(&self) -> bool {
        matches!(self, Self::MessageStop | Self::Error { .. })
    }

    /// Extract the assistant role on `MessageStart`. Used to seed the
    /// reconstructed response.
    #[must_use]
    pub const fn message_start_role(&self) -> Option<ClaudeRole> {
        match self {
            Self::MessageStart { message } => Some(message.role),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ping_event() {
        let raw = r#"{"type":"ping"}"#;
        let ev: MessagesStreamEvent = serde_json::from_str(raw).unwrap();
        assert!(matches!(ev, MessagesStreamEvent::Ping));
    }

    #[test]
    fn content_block_delta_text() {
        let raw = r#"{"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"hi"}}"#;
        let ev: MessagesStreamEvent = serde_json::from_str(raw).unwrap();
        match ev {
            MessagesStreamEvent::ContentBlockDelta { index, delta } => {
                assert_eq!(index, 0);
                match delta {
                    ContentBlockDelta::TextDelta { text } => assert_eq!(text, "hi"),
                    _ => panic!("expected text_delta"),
                }
            }
            _ => panic!("expected ContentBlockDelta"),
        }
    }

    #[test]
    fn unknown_event_falls_through() {
        let raw = r#"{"type":"future_event","foo":"bar"}"#;
        let ev: MessagesStreamEvent = serde_json::from_str(raw).unwrap();
        assert!(matches!(ev, MessagesStreamEvent::Unknown));
    }

    #[test]
    fn terminal_detection() {
        assert!(MessagesStreamEvent::MessageStop.is_terminal());
        assert!(!MessagesStreamEvent::Ping.is_terminal());
    }
}
