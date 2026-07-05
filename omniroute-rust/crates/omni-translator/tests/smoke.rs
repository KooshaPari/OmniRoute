//! Smoke tests for omni-translator.

use omni_translator::*;
use serde_json::json;

#[test]
fn openai_to_anthropic_basic() {
    let openai = json!({
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": "You are terse."},
            {"role": "user", "content": "Hi"}
        ],
        "max_tokens": 256,
    });
    let out = translate_request(
        omni_protocol::WireFormat::Openai,
        omni_protocol::WireFormat::Claude,
        openai,
    )
    .expect("translate ok");
    assert_eq!(out["model"], "gpt-4o");
    assert_eq!(out["system"], "You are terse.");
    assert_eq!(out["messages"].as_array().unwrap().len(), 1);
    assert_eq!(out["messages"][0]["role"], "user");
    assert_eq!(out["max_tokens"], 256);
}

#[test]
fn openai_to_anthropic_tools() {
    let openai = json!({
        "model": "gpt-4o",
        "messages": [{"role": "user", "content": "What's the weather?"}],
        "tools": [{
            "type": "function",
            "function": {
                "name": "get_weather",
                "description": "Get weather for a city",
                "parameters": {"type": "object", "properties": {"city": {"type": "string"}}}
            }
        }],
    });
    let out = translate_request(
        omni_protocol::WireFormat::Openai,
        omni_protocol::WireFormat::Claude,
        openai,
    )
    .expect("translate ok");
    let tools = out["tools"].as_array().unwrap();
    assert_eq!(tools.len(), 1);
    assert_eq!(tools[0]["name"], "get_weather");
    assert!(tools[0].get("input_schema").is_some());
}

#[test]
fn anthropic_to_openai_basic() {
    let anthropic = json!({
        "model": "claude-3-5-sonnet",
        "max_tokens": 1024,
        "system": "Be helpful",
        "messages": [{"role": "user", "content": "Hi"}],
    });
    let out = translate_request(
        omni_protocol::WireFormat::Claude,
        omni_protocol::WireFormat::Openai,
        anthropic,
    )
    .expect("translate ok");
    assert_eq!(out["messages"].as_array().unwrap().len(), 2); // system + user
    assert_eq!(out["messages"][0]["role"], "system");
    assert_eq!(out["messages"][1]["role"], "user");
}

#[test]
fn openai_to_gemini_basic() {
    let openai = json!({
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": "You are a poet."},
            {"role": "user", "content": "Write a haiku."},
            {"role": "assistant", "content": "Silent code...\nBuilds the world\nA new dawn rises"}
        ],
        "temperature": 0.7,
    });
    let out = translate_request(
        omni_protocol::WireFormat::Openai,
        omni_protocol::WireFormat::Gemini,
        openai,
    )
    .expect("translate ok");
    let contents = out["contents"].as_array().unwrap();
    assert!(contents.iter().any(|c| c["role"] == "model"));
    assert!(out.get("systemInstruction").is_some());
    assert_eq!(out["generationConfig"]["temperature"], 0.7);
}

#[test]
fn gemini_to_openai_basic() {
    let gemini = json!({
        "contents": [
            {"role": "user", "parts": [{"text": "Hello"}]},
            {"role": "model", "parts": [{"text": "Hi back"}]}
        ]
    });
    let out = translate_request(
        omni_protocol::WireFormat::Gemini,
        omni_protocol::WireFormat::Openai,
        gemini,
    )
    .expect("translate ok");
    let msgs = out["messages"].as_array().unwrap();
    assert_eq!(msgs[0]["role"], "user");
    assert_eq!(msgs[0]["content"], "Hello");
    assert_eq!(msgs[1]["role"], "assistant");
    assert_eq!(msgs[1]["content"], "Hi back");
}

#[test]
fn openai_to_codex_basic() {
    let openai = json!({
        "model": "gpt-4o",
        "messages": [
            {"role": "system", "content": "Be terse."},
            {"role": "user", "content": "Hi"}
        ],
    });
    let out = translate_request(
        omni_protocol::WireFormat::Openai,
        omni_protocol::WireFormat::Codex,
        openai,
    )
    .expect("translate ok");
    assert_eq!(out["instructions"], "Be terse.");
    let input = out["input"].as_array().unwrap();
    assert!(input.iter().any(|i| i["role"] == "user"));
}

#[test]
fn streaming_chunk_translation_openai_to_anthropic() {
    let chunk = json!({
        "id": "chatcmpl-1",
        "choices": [{"index": 0, "delta": {"content": "Hello"}, "finish_reason": null}]
    });
    let out = streaming::translate_chunk(
        omni_protocol::WireFormat::Openai,
        omni_protocol::WireFormat::Claude,
        chunk,
    )
    .expect("stream ok");
    assert_eq!(out["type"], "content_block_delta");
    assert_eq!(out["delta"]["text"], "Hello");
}

#[test]
fn streaming_chunk_translation_anthropic_to_openai() {
    let chunk = json!({
        "type": "content_block_delta",
        "index": 0,
        "delta": {"type": "text_delta", "text": " world"}
    });
    let out = streaming::translate_chunk(
        omni_protocol::WireFormat::Claude,
        omni_protocol::WireFormat::Openai,
        chunk,
    )
    .expect("stream ok");
    assert_eq!(out["choices"][0]["delta"]["content"], " world");
}

#[test]
fn identity_translation_passthrough() {
    let body = json!({"anything": "goes"});
    let out = translate_request(
        omni_protocol::WireFormat::Openai,
        omni_protocol::WireFormat::Openai,
        body.clone(),
    )
    .expect("identity ok");
    assert_eq!(out, body);
}
