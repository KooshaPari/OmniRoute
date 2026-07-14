//! Compression error types.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum Error {
    #[error("tokenizer: {0}")]
    Tokenizer(String),

    #[error("pipeline: {0}")]
    Pipeline(String),

    #[error("io: {0}")]
    Io(#[from] std::io::Error),
}

pub type Result<T> = std::result::Result<T, Error>;
