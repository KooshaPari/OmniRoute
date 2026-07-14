//! `/v1/embeddings` request/response shapes.

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EmbeddingRequest {
    pub model: String,
    pub input: EmbeddingInput,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub encoding_format: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dimensions: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,
    #[serde(default, skip_serializing_if = "IndexMap::is_empty")]
    pub extra: IndexMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum EmbeddingInput {
    Single(String),
    Multi(Vec<String>),
    /// Token-id lists (rare; only some providers).
    TokenIds(Vec<Vec<u32>>),
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct EmbeddingResponse {
    pub object: String,
    pub data: Vec<Embedding>,
    pub model: String,
    pub usage: EmbeddingUsage,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Embedding {
    pub object: String,
    /// Float array (default) or base64 string when `encoding_format=base64`.
    #[serde(with = "embedding_value")]
    pub embedding: EmbeddingValue,
    pub index: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(untagged)]
pub enum EmbeddingValue {
    Floats(Vec<f32>),
    Base64(String),
}

mod embedding_value {
    use super::EmbeddingValue;
    use serde::{Deserialize, Deserializer, Serialize, Serializer};

    pub fn serialize<S: Serializer>(v: &EmbeddingValue, s: S) -> Result<S::Ok, S::Error> {
        match v {
            EmbeddingValue::Floats(fs) => fs.serialize(s),
            EmbeddingValue::Base64(b) => b.serialize(s),
        }
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<EmbeddingValue, D::Error> {
        // Try a float array first; fall back to a string.
        let v = serde_json::Value::deserialize(d)?;
        match v {
            serde_json::Value::Array(_) => {
                let fs: Vec<f32> = serde_json::from_value(v).map_err(serde::de::Error::custom)?;
                Ok(EmbeddingValue::Floats(fs))
            }
            serde_json::Value::String(b) => Ok(EmbeddingValue::Base64(b)),
            other => Err(serde::de::Error::custom(format!(
                "expected float array or base64 string, got {other:?}"
            ))),
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct EmbeddingUsage {
    pub prompt_tokens: u32,
    pub total_tokens: u32,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedding_input_text_multi() {
        let r = EmbeddingRequest {
            model: "text-embedding-3-small".into(),
            input: EmbeddingInput::Multi(vec!["a".into(), "b".into()]),
            encoding_format: None,
            dimensions: None,
            user: None,
            extra: IndexMap::new(),
        };
        let s = serde_json::to_string(&r).unwrap();
        let back: EmbeddingRequest = serde_json::from_str(&s).unwrap();
        assert_eq!(r, back);
    }

    #[test]
    fn embedding_floats_round_trip() {
        let v = EmbeddingValue::Floats(vec![0.1, 0.2, 0.3]);
        let s = serde_json::to_string(&v).unwrap();
        assert_eq!(s, "[0.1,0.2,0.3]");
    }
}
