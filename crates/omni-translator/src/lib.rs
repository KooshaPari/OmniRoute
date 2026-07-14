//! OmniRoute protocol translator.
//!
//! Converts between OpenAI / Anthropic / Gemini / Codex wire shapes so the
//! router can speak any provider's protocol on either side of the call.

#![forbid(unsafe_code)]
#![warn(clippy::all, clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]

pub mod error;
pub mod openai_to_anthropic;
pub mod anthropic_to_openai;
pub mod openai_to_gemini;
pub mod gemini_to_openai;
pub mod openai_to_codex;
pub mod streaming;

pub use error::{Error, Result};

use omni_protocol::WireFormat;
use serde_json::Value;

/// Detect the wire format of a JSON body.
#[must_use]
pub fn detect_format(body: &Value) -> WireFormat {
    WireFormat::parse(&format!("{:?}", detect_kind(body))).unwrap_or(WireFormat::Openai)
}

#[derive(Debug, Clone, Copy)]
enum DetectedKind {
    Openai,
    OpenaiResponses,
    Claude,
    Gemini,
    Codex,
    A2a,
}

fn detect_kind(body: &Value) -> DetectedKind {
    if body.get("system").is_some() && body.get("messages").is_some() {
        return DetectedKind::Claude;
    }
    if body.get("contents").is_some() || body.get("systemInstruction").is_some() {
        return DetectedKind::Gemini;
    }
    if body.get("input").is_some() && body.get("instructions").is_some() {
        return DetectedKind::Codex;
    }
    if body.get("messages").is_some() || body.get("prompt").is_some() {
        return DetectedKind::Openai;
    }
    DetectedKind::Openai
}

/// Translate a request body from one wire format to another.
/// Same format = identity.
pub fn translate_request(from: WireFormat, to: WireFormat, body: Value) -> Result<Value> {
    if from == to {
        return Ok(body);
    }
    match (from, to) {
        (WireFormat::Openai, WireFormat::Claude) => openai_to_anthropic::request(body),
        (WireFormat::Claude, WireFormat::Openai) => anthropic_to_openai::request(body),
        (WireFormat::Openai, WireFormat::Gemini) => openai_to_gemini::request(body),
        (WireFormat::Gemini, WireFormat::Openai) => gemini_to_openai::request(body),
        (WireFormat::Openai, WireFormat::Codex) | (WireFormat::Openai, WireFormat::OpenaiResponses) => {
            openai_to_codex::request(body)
        }
        (from, to) => Err(Error::Conversion(
            wire_format_name(from),
            wire_format_name(to),
            "not yet supported".into(),
        )),
    }
}

/// Translate a response body. Symmetric to `translate_request`.
pub fn translate_response(from: WireFormat, to: WireFormat, body: Value) -> Result<Value> {
    if from == to {
        return Ok(body);
    }
    match (from, to) {
        (WireFormat::Openai, WireFormat::Claude) => openai_to_anthropic::response(body),
        (WireFormat::Claude, WireFormat::Openai) => anthropic_to_openai::response(body),
        (WireFormat::Openai, WireFormat::Gemini) => openai_to_gemini::response(body),
        (WireFormat::Gemini, WireFormat::Openai) => gemini_to_openai::response(body),
        (from, to) => Err(Error::Conversion(
            wire_format_name(from),
            wire_format_name(to),
            "not yet supported".into(),
        )),
    }
}

const fn wire_format_name(w: WireFormat) -> &'static str {
    match w {
        WireFormat::Openai => "openai",
        WireFormat::OpenaiResponses => "openai-responses",
        WireFormat::Claude => "claude",
        WireFormat::Gemini => "gemini",
        WireFormat::Codex => "codex",
        WireFormat::A2a => "a2a",
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn identity_translation() {
        let body = json!({"model": "gpt-4o", "messages": []});
        let out = translate_request(WireFormat::Openai, WireFormat::Openai, body.clone()).unwrap();
        assert_eq!(out, body);
    }

    #[test]
    fn openai_to_anthropic_routes() {
        let body = json!({"model": "gpt-4o", "messages": [], "max_tokens": 1024});
        let out = translate_request(WireFormat::Openai, WireFormat::Claude, body);
        assert!(out.is_ok(), "got {:?}", out);
    }
}
