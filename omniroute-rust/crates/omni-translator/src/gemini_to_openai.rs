//! Gemini generateContent → OpenAI Chat Completions conversion (request side).

use serde_json::{json, Value};

use crate::error::Result;

pub fn request(gemini: Value) -> Result<Value> {
    let model = gemini
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("gemini")
        .to_string();
    let mut messages: Vec<Value> = Vec::new();
    if let Some(s) = gemini.get("systemInstruction") {
        let text = s
            .get("parts")
            .and_then(|p| p.as_array())
            .and_then(|a| a.first())
            .and_then(|p| p.get("text"))
            .and_then(|t| t.as_str())
            .unwrap_or("");
        messages.push(json!({"role": "system", "content": text}));
    }
    if let Some(contents) = gemini.get("contents").and_then(|c| c.as_array()) {
        for c in contents {
            let role = c.get("role").and_then(|r| r.as_str()).unwrap_or("user");
            let oai_role = match role {
                "model" => "assistant",
                _ => "user",
            };
            let text = c
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
            messages.push(json!({"role": oai_role, "content": text}));
        }
    }
    let mut out = json!({"model": model, "messages": messages});
    if let Some(cfg) = gemini.get("generationConfig") {
        if let Some(t) = cfg.get("temperature") {
            out["temperature"] = t.clone();
        }
        if let Some(t) = cfg.get("maxOutputTokens") {
            out["max_tokens"] = t.clone();
        }
        if let Some(p) = cfg.get("topP") {
            out["top_p"] = p.clone();
        }
    }
    Ok(out)
}

pub fn response(openai: Value) -> Result<Value> {
    // Symmetric to openai_to_gemini::response
    let id = openai
        .get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("chatcmpl")
        .to_string();
    let model = openai
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("gpt-4o")
        .to_string();
    let choices = openai
        .get("choices")
        .and_then(|c| c.as_array())
        .cloned()
        .unwrap_or_default();
    let mut candidates: Vec<Value> = Vec::with_capacity(choices.len());
    for c in &choices {
        let text = c
            .get("message")
            .and_then(|m| m.get("content"))
            .and_then(|t| t.as_str())
            .unwrap_or("");
        candidates.push(json!({
            "content": {"role": "model", "parts": [{"text": text}]},
            "finishReason": match c.get("finish_reason").and_then(|v| v.as_str()) {
                Some("stop") => "STOP",
                Some("length") => "MAX_TOKENS",
                Some("content_filter") => "SAFETY",
                _ => "STOP",
            },
        }));
    }
    let usage = openai.get("usage").cloned().unwrap_or_else(|| json!({}));
    Ok(json!({
        "candidates": candidates,
        "modelVersion": model,
        "responseId": id,
        "usageMetadata": {
            "promptTokenCount": usage.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0),
            "candidatesTokenCount": usage.get("completion_tokens").and_then(|v| v.as_u64()).unwrap_or(0),
            "totalTokenCount": usage.get("total_tokens").and_then(|v| v.as_u64()).unwrap_or(0),
        }
    }))
}
