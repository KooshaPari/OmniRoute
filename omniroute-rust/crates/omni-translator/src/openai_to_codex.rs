//! OpenAI Chat Completions → OpenAI Responses (Codex) conversion.

use serde_json::{json, Value};

use crate::error::Result;

pub fn request(openai: Value) -> Result<Value> {
    // OpenAI Responses API uses `input` (string or array) instead of `messages`,
    // and `instructions` (system) as a top-level field.
    let model = openai
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("gpt-4o")
        .to_string();
    let messages = openai
        .get("messages")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let mut instructions: Option<String> = None;
    let mut input_items: Vec<Value> = Vec::new();
    for m in &messages {
        let role = m.get("role").and_then(|r| r.as_str()).unwrap_or("user");
        if role == "system" {
            let text = m
                .get("content")
                .and_then(|c| c.as_str())
                .unwrap_or("")
                .to_string();
            instructions = Some(match instructions {
                Some(existing) => format!("{existing}\n{text}"),
                None => text,
            });
            continue;
        }
        if role == "user" {
            let text = m
                .get("content")
                .and_then(|c| c.as_str())
                .unwrap_or("");
            input_items.push(json!({
                "type": "message",
                "role": "user",
                "content": [{"type": "input_text", "text": text}],
            }));
        } else if role == "assistant" {
            let text = m
                .get("content")
                .and_then(|c| c.as_str())
                .unwrap_or("");
            input_items.push(json!({
                "type": "message",
                "role": "assistant",
                "content": [{"type": "output_text", "text": text}],
            }));
        } else if role == "tool" {
            input_items.push(json!({
                "type": "function_call_output",
                "call_id": m.get("tool_call_id"),
                "output": m.get("content"),
            }));
        }
    }
    let mut out = json!({
        "model": model,
        "input": input_items,
    });
    if let Some(s) = instructions {
        out["instructions"] = json!(s);
    }
    if let Some(t) = openai.get("temperature") {
        out["temperature"] = t.clone();
    }
    if let Some(t) = openai.get("max_tokens") {
        out["max_output_tokens"] = t.clone();
    }
    if let Some(p) = openai.get("top_p") {
        out["top_p"] = p.clone();
    }
    if let Some(tools) = openai.get("tools") {
        out["tools"] = tools.clone();
    }
    if let Some(stream) = openai.get("stream") {
        out["stream"] = stream.clone();
    }
    Ok(out)
}

pub fn response(_codex: Value) -> Result<Value> {
    // Codex Responses responses have a different shape. For v1 we return the body
    // unchanged; downstream can post-process.
    Ok(_codex)
}
