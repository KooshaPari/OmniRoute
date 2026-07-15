//! Embeddings request/response.

use serde::{Deserialize, Serialize};

use crate::client::Client;
use crate::error::{SdkError, SdkResult};

#[derive(Debug, Clone, Serialize)]
pub struct EmbedRequest {
    pub model: String,
    pub input: EmbedInput,
}

#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
pub enum EmbedInput {
    Single(String),
    Batch(Vec<String>),
}

impl EmbedInput {
    pub fn single(s: impl Into<String>) -> Self { Self::Single(s.into()) }
    pub fn batch<I, S>(iter: I) -> Self
    where I: IntoIterator<Item=S>, S: Into<String> {
        Self::Batch(iter.into_iter().map(Into::into).collect())
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct EmbedResponse {
    pub model: String,
    pub data: Vec<EmbedItem>,
    #[serde(default)]
    pub usage: Option<EmbedUsage>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct EmbedItem {
    pub index: u32,
    pub embedding: Vec<f32>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct EmbedUsage {
    pub prompt_tokens: u32,
    pub total_tokens: u32,
}

impl EmbedResponse {
    pub fn first(&self) -> Option<&[f32]> {
        self.data.first().map(|i| i.embedding.as_slice())
    }
}

#[derive(Debug)]
pub struct EmbedRequests<'a> { client: &'a Client, req: EmbedRequest }

impl<'a> EmbedRequests<'a> {
    pub(crate) fn new(client: &'a Client) -> Self {
        Self { client, req: EmbedRequest { model: String::new(), input: EmbedInput::Batch(vec![]) } }
    }
    pub fn model(mut self, m: impl Into<String>) -> Self { self.req.model = m.into(); self }
    pub fn input(mut self, i: EmbedInput) -> Self { self.req.input = i; self }
    pub fn single(mut self, s: impl Into<String>) -> Self { self.req.input = EmbedInput::single(s); self }
    pub fn batch<I, S>(mut self, iter: I) -> Self
    where I: IntoIterator<Item=S>, S: Into<String> {
        self.req.input = EmbedInput::batch(iter);
        self
    }
    pub fn into_request(self) -> EmbedRequest { self.req }

    pub async fn send(self) -> SdkResult<EmbedResponse> {
        if self.req.model.is_empty() {
            return Err(SdkError::EmptyBody);
        }
        let url = self.client.base().join("v1/embeddings")
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
        Ok(resp.json().await?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Client;

    #[test]
    fn embed_request_single() {
        let r = EmbedRequest { model: "text-embed-3-small".into(), input: EmbedInput::single("hi") };
        let j = serde_json::to_string(&r).unwrap();
        assert!(j.contains("\"input\":\"hi\""));
    }

    #[test]
    fn embed_request_batch() {
        let r = EmbedRequest { model: "m".into(), input: EmbedInput::batch(["a", "b"]) };
        let j = serde_json::to_string(&r).unwrap();
        assert!(j.contains("[\"a\",\"b\"]"));
    }

    #[test]
    fn embed_response_first() {
        let j = r#"{"model":"m","data":[{"index":0,"embedding":[0.1,0.2,0.3]}]}"#;
        let r: EmbedResponse = serde_json::from_str(j).unwrap();
        assert_eq!(r.first().unwrap(), &[0.1, 0.2, 0.3]);
    }

    #[test]
    fn missing_model_errors() {
        let c = Client::builder("http://x").build().unwrap();
        let r = c.embed().into_request();
        assert_eq!(r.model, "");
    }
}
