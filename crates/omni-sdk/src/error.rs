//! SDK error type. Wraps transport, decode, and API errors with a single
//! enum so callers can match exhaustively.

use thiserror::Error;

pub type SdkResult<T> = Result<T, SdkError>;

#[derive(Debug, Error)]
pub enum SdkError {
    #[error("invalid URL: {0}")]
    InvalidUrl(String),

    #[error("invalid header: {name} = {value}")]
    InvalidHeader { name: String, value: String },

    #[error("transport: {0}")]
    Transport(#[from] reqwest::Error),

    #[error("HTTP {status}: {body}")]
    Http { status: u16, body: String },

    #[error("JSON decode: {0}")]
    Decode(#[from] serde_json::Error),

    #[error("upstream returned no body")]
    EmptyBody,

    #[error("upstream stream closed unexpectedly")]
    StreamClosed,
}
