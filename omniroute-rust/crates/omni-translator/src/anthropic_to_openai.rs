//! Anthropic Messages → OpenAI Chat Completions conversion.

use serde_json::{json, Value};

use crate::error::Result;

/// Convert an Anthropic Messages request to an OpenAI Chat Completions request.
pub fn request(anthropic: Value) -> Result<Value> {
    let model = anthropic
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("claude")
        .to_string();
    let max_tokens = anthropic
        .get("max_tokens")
        .and_then(|v| v.as_i64())
        .unwrap_or(4096);

    let system = anthropic.get("system").and_then(|v| v.as_str()).map(String::from);

    let mut messages: Vec<Value> = Vec::new();
    if let Some(s) = system {
        messages.push(json!({"role": "system", "content": s}));
    }
    if let Some(arr) = anthropic.get("messages").and_then(|v| v.as_array()) {
        for m in arr {
            let role = m.get("role").and_then(|r| r.as_str()).unwrap_or("user");
            let content = m.get("content");
            if role == "assistant" {
                // assistant content: extract text + tool_use blocks
                if let Some(blocks) = content.and_then(|c| c.as_array()) {
                    let mut text = String::new();
                    let mut tool_calls: Vec<Value> = Vec::new();
                    for (i, b) in blocks.iter().enumerate() {
                        match b.get("type").and_then(|t| t.as_str()) {
                            Some("text") => {
                                if let Some(s) = b.get("text").and_then(|t| t.as_str()) {
                                    if !text.is_empty() {
                                        text.push('\n');
                                    }
                                    text.push_str(s);
                                }
                            }
                            Some("tool_use") => {
                                tool_calls.push(json!({
                                    "id": b.get("id"),
                                    "type": "function",
                                    "function": {
                                        "name": b.get("name"),
                                        "arguments": serde_json::to_string(b.get("input").unwrap_or(&json!({}))).unwrap_or_else(|_| "{}".into()),
                                    },
                                    "_index": i,
                                }));
                            }
                            _ => {}
                        }
                    }
                    let mut msg = json!({"role": "assistant", "content": text});
                    if !tool_calls.is_empty() {
                        msg["tool_calls"] = json!(tool_calls);
                    }
                    messages.push(msg);
                } else if let Some(s) = content.and_then(|c| c.as_str()) {
                    messages.push(json!({"role": "assistant", "content": s}));
                }
            } else {
                // user / tool_result blocks
                if let Some(blocks) = content.and_then(|c| c.as_array()) {
                    let mut text = String::new();
                    for b in blocks {
                        if b.get("type").and_then(|t| t.as_str()) == Some("text") {
                            if let Some(s) = b.get("text").and_then(|t| t.as_str()) {
                                if !text.is_empty() {
                                    text.push('\n');
                                }
                                text.push_str(s);
                            }
                        } else if b.get("type").and_then(|t| t.as_str()) == Some("tool_result") {
                            messages.push(json!({
                                "role": "tool",
                                "tool_call_id": b.get("tool_use_id"),
                                "content": b.get("content"),
                            }));
                        }
                    }
                    if !text.is_empty() {
                        messages.push(json!({"role": "user", "content": text}));
                    }
                } else if let Some(s) = content.and_then(|c| c.as_str()) {
                    messages.push(json!({"role": "user", "content": s}));
                }
            }
        }
    }

    // Tools
    let tools = anthropic.get("tools").and_then(|t| t.as_array()).map(|arr| {
        arr.iter()
            .map(|t| {
                json!({
                    "type": "function",
                    "function": {
                        "name": t.get("name"),
                        "description": t.get("description"),
                        "parameters": t.get("input_schema").cloned().unwrap_or(json!({})),
                    }
                })
            })
            .collect::<Vec<_>>()
    });

    let mut out = json!({
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
    });
    if let Some(temp) = anthropic.get("temperature") {
        out["temperature"] = temp.clone();
    }
    if let Some(top_p) = anthropic.get("top_p") {
        out["top_p"] = top_p.clone();
    }
    if let Some(stop) = anthropic.get("stop_sequences") {
        out["stop"] = stop.clone();
    }
    if let Some(stream) = anthropic.get("stream") {
        out["stream"] = stream.clone();
    }
    if let Some(ts) = tools {
        out["tools"] = json!(ts);
    }
    Ok(out)
}

/// Convert an OpenAI response to Anthropic Messages response.
pub fn response(openai: Value) -> Result<Value> {
    let id = openai
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("chatcmpl")
        .to_string();
    let model = openai
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("claude")
        .to_string();
    let choice = openai
        .get("choices")
        .and_then(|c| c.as_array())
        .and_then(|a| a.first())
        .cloned()
        .unwrap_or_else(|| json!({}));
    let message = choice.get("message").cloned().unwrap_or_else(|| json!({}));
    let content_text = message
        .get("content")
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string();
    let stop_reason = choice
        .get("finish_reason")
        .and_then(|v| v.as_str())
        .map(openai_to_anthropic_stop)
        .unwrap_or("end_turn");
    let usage = openai.get("usage").cloned().unwrap_or_else(|| json!({}));
    let input_tokens = usage.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
    let output_tokens = usage.get("completion_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
    Ok(json!({
        "id": id,
        "type": "message",
        "role": "assistant",
        "model": model,
        "content": [{"type": "text", "text": content_text}],
        "stop_reason": stop_reason,
        "usage": {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
        }
    }))
}

fn openai_to_anthropic_stop(s: &str) -> &'static str {
    match s {
        "stop" => "end_turn",
        "length" => "max_tokens",
        "tool_calls" => "tool_use",
        _ => "end_turn",
    }
}
