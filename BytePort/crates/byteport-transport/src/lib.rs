use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub mod ports;

pub type TransportResult<T> = Result<T, UploadTransportError>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UploadRequest {
    pub object_key: String,
    pub content_type: String,
    pub content_length: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UploadInstruction {
    pub method: String,
    pub url: String,
    pub headers: BTreeMap<String, String>,
}

pub trait UploadTransport: Send + Sync {
    fn create_upload(&self, request: &UploadRequest) -> TransportResult<UploadInstruction>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct S3UploadTransport {
    endpoint: String,
    bucket: String,
    key_prefix: Option<String>,
}

impl S3UploadTransport {
    pub fn new(
        endpoint: impl Into<String>,
        bucket: impl Into<String>,
        key_prefix: Option<impl Into<String>>,
    ) -> Self {
        Self {
            endpoint: endpoint.into(),
            bucket: bucket.into(),
            key_prefix: key_prefix.map(Into::into),
        }
    }

    fn normalized_object_key(&self, object_key: &str) -> String {
        let trimmed_key = object_key.trim_start_matches('/');
        match self
            .key_prefix
            .as_deref()
            .map(|prefix| prefix.trim_matches('/'))
            .filter(|prefix| !prefix.is_empty())
        {
            Some(prefix) => format!("{prefix}/{trimmed_key}"),
            None => trimmed_key.to_string(),
        }
    }

    fn upload_url(&self, object_key: &str) -> String {
        let endpoint = self.endpoint.trim_end_matches('/');
        format!("{endpoint}/{}/{object_key}", self.bucket)
    }
}

impl UploadTransport for S3UploadTransport {
    fn create_upload(&self, request: &UploadRequest) -> TransportResult<UploadInstruction> {
        if request.object_key.trim().is_empty() {
            return Err(UploadTransportError::EmptyObjectKey);
        }

        if request.content_type.trim().is_empty() {
            return Err(UploadTransportError::EmptyContentType);
        }

        let object_key = self.normalized_object_key(&request.object_key);
        let mut headers = BTreeMap::new();
        headers.insert("content-length".into(), request.content_length.to_string());
        headers.insert("content-type".into(), request.content_type.clone());

        Ok(UploadInstruction {
            method: "PUT".into(),
            url: self.upload_url(&object_key),
            headers,
        })
    }
}

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum UploadTransportError {
    #[error("upload object key cannot be empty")]
    EmptyObjectKey,
    #[error("upload content type cannot be empty")]
    EmptyContentType,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn s3_transport_prefixes_and_normalizes_object_keys() {
        let transport = S3UploadTransport::new(
            "https://storage.example.test/",
            "byteport-uploads",
            Some("/projects/"),
        );

        let upload = transport
            .create_upload(&UploadRequest {
                object_key: "/demo/screenshot.png".into(),
                content_type: "image/png".into(),
                content_length: 42,
            })
            .expect("upload request should succeed");

        assert_eq!(upload.method, "PUT");
        assert_eq!(
            upload.url,
            "https://storage.example.test/byteport-uploads/projects/demo/screenshot.png"
        );
        assert_eq!(
            upload.headers.get("content-type"),
            Some(&"image/png".into())
        );
        assert_eq!(upload.headers.get("content-length"), Some(&"42".into()));
    }

    #[test]
    fn s3_transport_rejects_empty_object_key() {
        let transport = S3UploadTransport::new(
            "https://storage.example.test",
            "byteport-uploads",
            None::<String>,
        );

        let error = transport
            .create_upload(&UploadRequest {
                object_key: "".into(),
                content_type: "application/octet-stream".into(),
                content_length: 128,
            })
            .expect_err("empty object key should fail");

        assert_eq!(error, UploadTransportError::EmptyObjectKey);
    }
}
