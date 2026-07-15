//! OpenAI Chat Completions → Gemini generateContent conversion.

use serde_json::{json, Value};

use crate::error::Result;

pub fn request(openai: Value) -> Result<Value> {
    let model = openai
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("gemini")
        .to_string();
    let messages = openai
        .get("messages")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut system_instruction: Option<Value> = None;
    let mut contents: Vec<Value> = Vec::with_capacity(messages.len());
    for m in &messages {
        let role = m.get("role").and_then(|r| r.as_str()).unwrap_or("user");
        let content = m.get("content");
        if role == "system" {
            system_instruction = Some(json!({
                "parts": [{"text": content.and_then(|c| c.as_str()).unwrap_or("")}]
            }));
            continue;
        }
        let gemini_role = if role == "assistant" { "model" } else { "user" };
        let parts: Vec<Value> = match content {
            Some(Value::String(s)) => vec![json!({"text": s})],
            Some(Value::Array(arr)) => arr
                .iter()
                .map(|p| match p.get("type").and_then(|t| t.as_str()) {
                    Some("text") => json!({"text": p.get("text").and_then(|t| t.as_str()).unwrap_or("")}),
                    Some("image_url") => {
                        let url = p
                            .get("image_url")
                            .and_then(|i| i.get("url"))
                            .and_then(|u| u.as_str())
                            .unwrap_or("");
                        // Gemini wants inline_data or file_data; we map data: URIs to inline
                        if let Some(stripped) = url.strip_prefix("data:") {
                            let (meta, data) = match stripped.split_once(',') {
                                Some((m, d)) => (m, d),
                                None => ("", ""),
                            };
                            let mime = meta
                                .split(';')
                                .next()
                                .unwrap_or("image/png")
                                .trim_start_matches("data:");
                            json!({
                                "inline_data": {"mime_type": mime, "data": data}
                            })
                        } else {
                            json!({
                                "file_data": {"file_uri": url, "mime_type": "image/jpeg"}
                            })
                        }
                    }
                    _ => json!({"text": ""}),
                })
                .collect(),
            _ => vec![json!({"text": ""})],
        };
        contents.push(json!({"role": gemini_role, "parts": parts}));
    }

    let mut out = json!({
        "model": model,
        "contents": contents,
    });
    if let Some(s) = system_instruction {
        out["systemInstruction"] = s;
    }
    let gen_cfg = openai.get("temperature")
        .or_else(|| openai.get("max_tokens"))
        .or_else(|| openai.get("top_p"))
        .map(|_| json!({}));
    if let Some(mut cfg) = gen_cfg {
        if let Some(temp) = openai.get("temperature") {
            cfg["temperature"] = temp.clone();
        }
        if let Some(t) = openai.get("max_tokens") {
            cfg["maxOutputTokens"] = t.clone();
        }
        if let Some(top_p) = openai.get("top_p") {
            cfg["topP"] = top_p.clone();
        }
        out["generationConfig"] = cfg;
    }
    if let Some(stream) = openai.get("stream") {
        out["stream"] = stream.clone();
    }
    Ok(out)
}

pub fn response(gemini: Value) -> Result<Value> {
    // Map Gemini response → OpenAI Chat Completions response
    let model = gemini
        .get("modelVersion")
        .and_then(|v| v.as_str())
        .unwrap_or("gemini")
        .to_string();
    let candidates = gemini
        .get("candidates")
        .and_then(|c| c.as_array())
        .cloned()
        .unwrap_or_default();
    let mut choices = Vec::with_capacity(candidates.len());
    for (i, c) in candidates.iter().enumerate() {
        let content = c.get("content").cloned().unwrap_or_else(|| json!({}));
        let text = content
            .get("parts")
            .and_then(|p| p.as_array())
            .map(|parts| {
                parts
                    .iter()
                    .filter_map(|p| p.get("text").and_then(|t| t.as_str()))
                    .collect::<Vec<_>>()
                    .join("")
            })
            .unwrap_or_default();
        let finish_reason = c.get("finishReason").and_then(|v| v.as_str()).map(|s| match s {
            "STOP" => "stop",
            "MAX_TOKENS" => "length",
            "SAFETY" => "content_filter",
            "RECITATION" => "content_filter",
            _ => "stop",
        });
        choices.push(json!({
            "index": i,
            "message": {"role": "assistant", "content": text},
            "finish_reason": finish_reason,
        }));
    }
    let usage = gemini.get("usageMetadata").cloned().unwrap_or_else(|| json!({}));
    let prompt_tokens = usage.get("promptTokenCount").and_then(|v| v.as_u64()).unwrap_or(0);
    let completion_tokens = usage
        .get("candidatesTokenCount")
        .and_then(|v| v.as_u64())
        .unwrap_or(0);
    Ok(json!({
        "id": format!("chatcmpl-{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos() as i64).unwrap_or(0)),
        "object": "chat.completion",
        "created": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0),
        "model": model,
        "choices": choices,
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        }
    }))
}
