//! Model list / get.

use serde::{Deserialize, Serialize};

use crate::client::Client;
use crate::error::{SdkError, SdkResult};

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Model {
    pub id: String,
    #[serde(default)]
    pub object: Option<String>,
    #[serde(default)]
    pub owned_by: Option<String>,
    #[serde(default)]
    pub created: Option<i64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ModelList {
    pub object: String,
    pub data: Vec<Model>,
}

#[derive(Debug)]
pub struct ModelRequests<'a> { client: &'a Client }

impl<'a> ModelRequests<'a> {
    pub(crate) fn new(client: &'a Client) -> Self { Self { client } }

    pub async fn list(self) -> SdkResult<ModelList> {
        let url = self.client.base().join("v1/models")
            .map_err(|e| SdkError::InvalidUrl(e.to_string()))?;
        let mut req = self.client.http().get(url);
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

    pub async fn get(self, id: impl AsRef<str>) -> SdkResult<Model> {
        let mut url = self.client.base().join("v1/models/")
            .map_err(|e| SdkError::InvalidUrl(e.to_string()))?;
        let escaped = id.as_ref();
        let seg = urlencoding(escaped);
        url = url.join(&seg).map_err(|e| SdkError::InvalidUrl(e.to_string()))?;
        let mut req = self.client.http().get(url);
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

fn urlencoding(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn urlencoding_basic() {
        assert_eq!(urlencoding("gpt-4o"), "gpt-4o");
        assert_eq!(urlencoding("a/b"), "a%2Fb");
        assert_eq!(urlencoding("a b"), "a%20b");
    }

    #[test]
    fn model_list_deserialize() {
        let j = r#"{"object":"list","data":[{"id":"m1","object":"model","owned_by":"openai"}]}"#;
        let l: ModelList = serde_json::from_str(j).unwrap();
        assert_eq!(l.data.len(), 1);
        assert_eq!(l.data[0].id, "m1");
    }
}
