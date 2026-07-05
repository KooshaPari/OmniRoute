//! SSE chunk translation between wire formats.
//!
//! Streaming chunks are small per-token payloads. The hot path is: provider chunk
//! arrives → translate to client format → write to SSE stream. We aim for
//! <100µs per chunk in the common case.

use serde_json::{json, Value};

use crate::error::Result;
use omni_protocol::WireFormat;

/// Translate one streaming chunk from `from` to `to`.
pub fn translate_chunk(from: WireFormat, to: WireFormat, body: Value) -> Result<Value> {
    if from == to {
        return Ok(body);
    }
    match (from, to) {
        (WireFormat::Openai, WireFormat::Claude) => openai_chunk_to_anthropic(body),
        (WireFormat::Claude, WireFormat::Openai) => anthropic_chunk_to_openai(body),
        (WireFormat::Openai, WireFormat::Gemini) => Ok(body), // best-effort
        (WireFormat::Gemini, WireFormat::Openai) => gemini_chunk_to_openai(body),
        (from, to) => Err(crate::Error::Conversion(
            match from {
                WireFormat::Openai => "openai",
                WireFormat::OpenaiResponses => "openai-responses",
                WireFormat::Claude => "claude",
                WireFormat::Gemini => "gemini",
                WireFormat::Codex => "codex",
                WireFormat::A2a => "a2a",
            },
            match to {
                WireFormat::Openai => "openai",
                WireFormat::OpenaiResponses => "openai-responses",
                WireFormat::Claude => "claude",
                WireFormat::Gemini => "gemini",
                WireFormat::Codex => "codex",
                WireFormat::A2a => "a2a",
            },
            "stream chunks not supported for this pair".into(),
        )),
    }
}

fn openai_chunk_to_anthropic(openai: Value) -> Result<Value> {
    // OpenAI chunk: { choices: [{ delta: { content }, index, finish_reason }] }
    // Anthropic SSE event: { type: "content_block_delta", delta: { type: "text_delta", text: "..." } }
    let choice = openai
        .get("choices")
        .and_then(|c| c.as_array())
        .and_then(|a| a.first())
        .cloned()
        .unwrap_or_else(|| json!({}));
    let delta = choice.get("delta").cloned().unwrap_or_else(|| json!({}));
    let text = delta
        .get("content")
        .and_then(|c| c.as_str())
        .unwrap_or("");
    if text.is_empty() {
        return Ok(json!({}));
    }
    Ok(json!({
        "type": "content_block_delta",
        "index": choice.get("index").and_then(|v| v.as_u64()).unwrap_or(0),
        "delta": {"type": "text_delta", "text": text},
    }))
}

fn anthropic_chunk_to_openai(anthropic: Value) -> Result<Value> {
    let event_type = anthropic
        .get("type")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    let text = match event_type {
        "content_block_delta" => anthropic
            .get("delta")
            .and_then(|d| d.get("text"))
            .and_then(|t| t.as_str())
            .unwrap_or(""),
        _ => "",
    };
    let finish_reason = if event_type == "message_stop" {
        Some("stop")
    } else {
        None
    };
    Ok(json!({
        "id": "chatcmpl-anthropic",
        "object": "chat.completion.chunk",
        "created": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0),
        "model": "claude",
        "choices": [{
            "index": 0,
            "delta": {"content": text},
            "finish_reason": finish_reason,
        }],
    }))
}

fn gemini_chunk_to_openai(gemini: Value) -> Result<Value> {
    let candidates = gemini
        .get("candidates")
        .and_then(|c| c.as_array())
        .cloned()
        .unwrap_or_default();
    let mut text = String::new();
    for c in &candidates {
        if let Some(parts) = c.get("content").and_then(|co| co.get("parts")).and_then(|p| p.as_array()) {
            for p in parts {
                if let Some(s) = p.get("text").and_then(|t| t.as_str()) {
                    text.push_str(s);
                }
            }
        }
    }
    Ok(json!({
        "id": "chatcmpl-gemini",
        "object": "chat.completion.chunk",
        "created": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0),
        "model": "gemini",
        "choices": [{
            "index": 0,
            "delta": {"content": text},
            "finish_reason": None::<&str>,
        }],
    }))
}
