//! Token counting and usage extraction.
//!
//! Provider responses vary in token accounting shape (OpenAI gives `usage`,
//! Anthropic gives `usage.input_tokens`/`output_tokens`, Gemini gives
//! `usageMetadata`). These helpers normalize them into a single
//! [`Usage`](crate::types::Usage) value.
//!
//! In Phase 2 the counting is done via simple heuristics. Phase 4 introduces
//! a Zig hot-path shim for JSON validation and a (gated) Mojo kernel for
//! per-message token estimation using a BPE-style approximation.

use crate::types::{ChatMessage, ChatRequest, ChatResponse, Usage};

/// Estimate the number of tokens in a string using a 4-chars-per-token
/// approximation. This is the same heuristic used by OpenAI's
/// `tiktoken` when no encoder is available, and it errs slightly high
/// (better to over-estimate than under).
pub fn estimate_tokens(s: &str) -> u32 {
    // Round up so that very short strings still register at least 1 token.
    let n = (s.chars().count() as u32).div_ceil(4);
    n.max(1)
}

/// Estimate prompt tokens from a list of messages.
///
/// Heuristic: sum `estimate_tokens` across `role` + `content` + 4 tokens
/// of per-message overhead (mirrors the OpenAI `gpt-4o` chat-completions
/// encoding).
pub fn estimate_prompt_tokens(messages: &[ChatMessage]) -> u32 {
    messages
        .iter()
        .map(|m| {
            let body = match &m.content {
                serde_json::Value::String(s) => s.clone(),
                other => other.to_string(),
            };
            estimate_tokens(&m.role) + estimate_tokens(&body) + 4
        })
        .sum()
}

/// Extract [`Usage`](crate::types::Usage) from a non-streaming response,
/// using the provider's own accounting if present, otherwise falling back
/// to heuristic estimation.
pub fn usage_from_response(resp: &ChatResponse, req: &ChatRequest) -> Usage {
    if resp.usage.total_tokens > 0 {
        return resp.usage.clone();
    }
    let prompt_tokens = estimate_prompt_tokens(&req.messages);
    let completion_tokens = resp
        .choices
        .iter()
        .map(|c| match &c.message.content {
            serde_json::Value::String(s) => estimate_tokens(s),
            other => estimate_tokens(&other.to_string()),
        })
        .sum();
    Usage {
        prompt_tokens,
        completion_tokens,
        total_tokens: prompt_tokens + completion_tokens,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn estimate_short_string_is_one_token() {
        assert_eq!(estimate_tokens("hi"), 1);
    }

    #[test]
    fn estimate_grows_linearly() {
        let s = "a".repeat(40);
        assert_eq!(estimate_tokens(&s), 10);
    }

    #[test]
    fn estimate_prompt_includes_overhead() {
        let msgs = vec![
            ChatMessage::system("you are helpful"),
            ChatMessage::user("hello there"),
        ];
        let tokens = estimate_prompt_tokens(&msgs);
        // each message gets 4 overhead tokens + role + body
        assert!(tokens > 8);
    }

    #[test]
    fn usage_from_response_prefers_provider() {
        let req = ChatRequest::new("gpt-4o", "hi");
        let resp = ChatResponse {
            id: "x".into(),
            object: "chat.completion".into(),
            created: 0,
            model: "gpt-4o".into(),
            choices: vec![],
            usage: Usage {
                prompt_tokens: 10,
                completion_tokens: 20,
                total_tokens: 30,
            },
            provider_id: None,
        };
        let u = usage_from_response(&resp, &req);
        assert_eq!(u.total_tokens, 30);
    }

    #[test]
    fn usage_from_response_estimates_when_zero() {
        let req = ChatRequest::new("gpt-4o", "hello world");
        let resp = ChatResponse {
            id: "x".into(),
            object: "chat.completion".into(),
            created: 0,
            model: "gpt-4o".into(),
            choices: vec![],
            usage: Usage::default(),
            provider_id: None,
        };
        let u = usage_from_response(&resp, &req);
        assert!(u.total_tokens > 0);
        assert!(u.prompt_tokens > 0);
        assert_eq!(u.completion_tokens, 0);
    }
}