//! OpenAI Chat Completions → Anthropic Messages conversion.
//!
//! Operates on `serde_json::Value` for resilience: the wire is the source of
//! truth and protocol types are checked at higher layers.

use serde_json::{json, Value};

use crate::error::Result;

/// Convert an OpenAI Chat Completions request to an Anthropic Messages request.
pub fn request(openai: Value) -> Result<Value> {
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
    let max_tokens = openai
        .get("max_tokens")
        .and_then(|v| v.as_i64())
        .or_else(|| openai.get("max_completion_tokens").and_then(|v| v.as_i64()))
        .unwrap_or(4096);

    let mut system_text: Option<String> = None;
    let mut out_messages: Vec<Value> = Vec::with_capacity(messages.len());
    for m in &messages {
        let role = m.get("role").and_then(|r| r.as_str()).unwrap_or("user");
        let content = m.get("content");
        match role {
            "system" | "developer" => {
                if let Some(s) = message_text(content) {
                    system_text = Some(match system_text {
                        Some(existing) => format!("{existing}\n{s}"),
                        None => s,
                    });
                }
            }
            "user" => {
                out_messages.push(json!({
                    "role": "user",
                    "content": user_content_to_anthropic(content),
                }));
            }
            "assistant" => {
                let mut content_arr: Vec<Value> = Vec::new();
                if let Some(s) = message_text(content) {
                    if !s.is_empty() {
                        content_arr.push(json!({"type": "text", "text": s}));
                    }
                }
                if let Some(tcs) = m.get("tool_calls").and_then(|t| t.as_array()) {
                    for tc in tcs {
                        if let (Some(id), Some(func)) = (
                            tc.get("id").and_then(|v| v.as_str()),
                            tc.get("function"),
                        ) {
                            let name = func
                                .get("name")
                                .and_then(|v| v.as_str())
                                .unwrap_or("")
                                .to_string();
                            let args_str = func
                                .get("arguments")
                                .and_then(|v| v.as_str())
                                .unwrap_or("{}");
                            let input: Value = serde_json::from_str(args_str)
                                .unwrap_or_else(|_| Value::String(args_str.to_string()));
                            content_arr.push(json!({
                                "type": "tool_use",
                                "id": id,
                                "name": name,
                                "input": input,
                            }));
                        }
                    }
                }
                if content_arr.is_empty() {
                    content_arr.push(json!({"type": "text", "text": ""}));
                }
                out_messages.push(json!({"role": "assistant", "content": content_arr}));
            }
            "tool" => {
                let tool_use_id = m
                    .get("tool_call_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                out_messages.push(json!({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": tool_use_id,
                        "content": content.cloned().unwrap_or_else(|| Value::String(String::new())),
                    }],
                }));
            }
            "function" => {
                // Legacy function-call result
                let name = m.get("name").and_then(|v| v.as_str()).unwrap_or("");
                out_messages.push(json!({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": name,
                        "content": content.cloned().unwrap_or_else(|| Value::String(String::new())),
                    }],
                }));
            }
            _ => {
                if let Some(s) = message_text(content) {
                    out_messages.push(json!({"role": "user", "content": s}));
                }
            }
        }
    }

    let mut out = json!({
        "model": model,
        "messages": out_messages,
        "max_tokens": max_tokens,
    });
    if let Some(s) = system_text {
        out["system"] = json!(s);
    }
    if let Some(t) = openai.get("temperature") {
        out["temperature"] = t.clone();
    }
    if let Some(p) = openai.get("top_p") {
        out["top_p"] = p.clone();
    }
    if let Some(s) = openai.get("stop") {
        out["stop_sequences"] = s.clone();
    }
    if let Some(tools) = openai.get("tools") {
        if let Some(arr) = tools.as_array() {
            let anthropic_tools: Vec<Value> = arr
                .iter()
                .filter_map(|t| {
                    let f = t.get("function")?;
                    Some(json!({
                        "name": f.get("name"),
                        "description": f.get("description"),
                        "input_schema": f.get("parameters").cloned().unwrap_or(json!({})),
                    }))
                })
                .collect();
            if !anthropic_tools.is_empty() {
                out["tools"] = json!(anthropic_tools);
            }
        }
    }
    if let Some(stream) = openai.get("stream") {
        out["stream"] = stream.clone();
    }
    Ok(out)
}

/// Convert an Anthropic Messages response body to an OpenAI Chat Completions
/// response body.
pub fn response(anthropic: Value) -> Result<Value> {
    let id = anthropic
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("anthropic-msg")
        .to_string();
    let model = anthropic
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("claude")
        .to_string();
    let content = anthropic
        .get("content")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let mut text = String::new();
    for block in &content {
        if block.get("type").and_then(|t| t.as_str()) == Some("text") {
            if let Some(s) = block.get("text").and_then(|t| t.as_str()) {
                if !text.is_empty() {
                    text.push('\n');
                }
                text.push_str(s);
            }
        }
    }
    let stop_reason = anthropic
        .get("stop_reason")
        .and_then(|v| v.as_str())
        .map(anthropic_finish_reason);
    let usage = anthropic.get("usage").cloned().unwrap_or_else(|| json!({}));
    let prompt_tokens = usage.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
    let completion_tokens = usage.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0);
    let now = chrono_like_now();
    Ok(json!({
        "id": id,
        "object": "chat.completion",
        "created": now,
        "model": model,
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": text},
            "finish_reason": stop_reason,
        }],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        }
    }))
}

fn chrono_like_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn message_text(content: Option<&Value>) -> Option<String> {
    match content {
        Some(Value::String(s)) => Some(s.clone()),
        Some(Value::Array(arr)) => {
            let s: Vec<String> = arr
                .iter()
                .filter_map(|p| {
                    if p.get("type").and_then(|t| t.as_str()) == Some("text") {
                        p.get("text").and_then(|t| t.as_str()).map(String::from)
                    } else {
                        None
                    }
                })
                .collect();
            if s.is_empty() {
                None
            } else {
                Some(s.join("\n"))
            }
        }
        _ => None,
    }
}

fn user_content_to_anthropic(content: Option<&Value>) -> Value {
    match content {
        Some(Value::String(s)) => json!(s),
        Some(Value::Array(arr)) => {
            let v: Vec<Value> = arr
                .iter()
                .map(|p| match p.get("type").and_then(|t| t.as_str()) {
                    Some("text") => json!({
                        "type": "text",
                        "text": p.get("text").and_then(|t| t.as_str()).unwrap_or(""),
                    }),
                    Some("image_url") => {
                        let url = p
                            .get("image_url")
                            .and_then(|i| i.get("url"))
                            .and_then(|u| u.as_str())
                            .unwrap_or("");
                        if let Some(rest) = url.strip_prefix("data:") {
                            if let Some((meta, data)) = rest.split_once(',') {
                                let mime = meta.split(';').next().unwrap_or("image/png");
                                return json!({
                                    "type": "image",
                                    "source": {
                                        "type": "base64",
                                        "media_type": mime,
                                        "data": data,
                                    }
                                });
                            }
                        }
                        json!({
                            "type": "image",
                            "source": {
                                "type": "url",
                                "url": url,
                            }
                        })
                    }
                    _ => json!({"type": "text", "text": ""}),
                })
                .collect();
            json!(v)
        }
        _ => json!(""),
    }
}

fn anthropic_finish_reason(s: &str) -> &'static str {
    match s {
        "end_turn" | "stop_sequence" => "stop",
        "max_tokens" => "length",
        "tool_use" => "tool_calls",
        _ => "stop",
    }
}
