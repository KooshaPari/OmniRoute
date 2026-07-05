//! Chat completions: request builder + response + streaming.

use serde::{Deserialize, Serialize};

use crate::client::Client;
use crate::error::{SdkError, SdkResult};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    System,
    User,
    Assistant,
    Tool,
}

/// One message in a chat conversation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: Role,
    pub content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
}

impl Message {
    pub fn system(content: impl Into<String>) -> Self {
        Self { role: Role::System, content: content.into(), name: None }
    }
    pub fn user(content: impl Into<String>) -> Self {
        Self { role: Role::User, content: content.into(), name: None }
    }
    pub fn assistant(content: impl Into<String>) -> Self {
        Self { role: Role::Assistant, content: content.into(), name: None }
    }
}

/// A chat completion request. Use `client.chat()` to start.
#[derive(Debug, Clone, Serialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<Message>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub stream: bool,
}

impl ChatRequest {
    pub fn new(model: impl Into<String>) -> Self {
        Self { model: model.into(), messages: Vec::new(), temperature: None, max_tokens: None, stream: false }
    }
    pub fn message(mut self, m: Message) -> Self { self.messages.push(m); self }
    pub fn system(mut self, c: impl Into<String>) -> Self { self.messages.push(Message::system(c)); self }
    pub fn user(mut self, c: impl Into<String>) -> Self { self.messages.push(Message::user(c)); self }
    pub fn assistant(mut self, c: impl Into<String>) -> Self { self.messages.push(Message::assistant(c)); self }
    pub fn temperature(mut self, t: f32) -> Self { self.temperature = Some(t); self }
    pub fn max_tokens(mut self, n: u32) -> Self { self.max_tokens = Some(n); self }
    pub fn stream(mut self, on: bool) -> Self { self.stream = on; self }
}

/// The non-streaming chat response. Mirrors the OpenAI shape.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChatResponse {
    pub id: String,
    pub model: String,
    pub choices: Vec<Choice>,
    #[serde(default)]
    pub usage: Option<Usage>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Choice {
    pub index: u32,
    pub message: Message,
    #[serde(default)]
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

impl ChatResponse {
    pub fn content(&self) -> &str {
        self.choices.first().map(|c| c.message.content.as_str()).unwrap_or("")
    }
}

/// One streaming event (Server-Sent Event chunk). Decoded from a single line.
#[derive(Debug, Clone, Deserialize)]
pub struct StreamEvent {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub choices: Vec<StreamChoice>,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StreamChoice {
    pub index: u32,
    pub delta: Delta,
    #[serde(default)]
    pub finish_reason: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct Delta {
    #[serde(default)]
    pub role: Option<Role>,
    #[serde(default)]
    pub content: Option<String>,
}

/// Builder for chat requests bound to a `Client`.
#[derive(Debug)]
pub struct ChatRequests<'a> {
    client: &'a Client,
    req: ChatRequest,
}

impl<'a> ChatRequests<'a> {
    pub(crate) fn new(client: &'a Client) -> Self {
        Self { client, req: ChatRequest::new("") }
    }
    pub fn model(mut self, m: impl Into<String>) -> Self { self.req.model = m.into(); self }
    pub fn message(mut self, m: Message) -> Self { self.req = self.req.message(m); self }
    pub fn system(mut self, c: impl Into<String>) -> Self { self.req = self.req.system(c); self }
    pub fn user(mut self, c: impl Into<String>) -> Self { self.req = self.req.user(c); self }
    pub fn temperature(mut self, t: f32) -> Self { self.req = self.req.temperature(t); self }
    pub fn max_tokens(mut self, n: u32) -> Self { self.req = self.req.max_tokens(n); self }
    pub fn stream(mut self, on: bool) -> Self { self.req.stream = on; self }
    pub fn into_request(self) -> ChatRequest { self.req }

    /// Send the request and decode a non-streaming response.
    pub async fn send(self) -> SdkResult<ChatResponse> {
        if self.req.model.is_empty() {
            return Err(SdkError::EmptyBody); // (reuse as "missing model" signal)
        }
        let url = self.client.base().join("v1/chat/completions")
            .map_err(|e| SdkError::InvalidUrl(e.to_string()))?;
        let mut req = self.client.http().post(url).json(&self.req);
        for (k, v) in self.client.default_headers() {
            req = req.header(k, v);
        }
        let resp = req.send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(SdkError::Http { status: status.as_u16(), body });
        }
        let chat: ChatResponse = resp.json().await?;
        Ok(chat)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Client;

    #[test]
    fn chat_request_round_trips() {
        let r = ChatRequest::new("gpt-4o-mini")
            .system("be brief")
            .user("ping")
            .temperature(0.2)
            .max_tokens(64);
        let j = serde_json::to_string(&r).unwrap();
        assert!(j.contains("\"model\":\"gpt-4o-mini\""));
        assert!(j.contains("\"role\":\"system\""));
        assert!(j.contains("\"temperature\":0.2"));
    }

    #[test]
    fn chat_response_content() {
        let j = r#"{"id":"x","model":"gpt","choices":[{"index":0,"message":{"role":"assistant","content":"pong"}}]}"#;
        let r: ChatResponse = serde_json::from_str(j).unwrap();
        assert_eq!(r.content(), "pong");
    }

    #[test]
    fn missing_model_via_builder() {
        let c = Client::builder("http://x").build().unwrap();
        let req = c.chat().into_request();
        assert_eq!(req.model, "");
    }
}
