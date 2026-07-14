//! Translator error types.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("unsupported wire format: {0}")]
    UnsupportedFormat(String),

    #[error("unsupported field: {0}")]
    UnsupportedField(String),

    #[error("shape mismatch: {0}")]
    ShapeMismatch(String),

    #[error("missing required field: {0}")]
    MissingField(&'static str),

    #[error("conversion: {0} -> {1}: {2}")]
    Conversion(&'static str, &'static str, String),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, Error>;
