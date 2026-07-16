use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "code", content = "message")]
pub enum AppError {
    #[error("Internal error: {0}")]
    Internal(String),
    #[error("Not implemented: {0}")]
    NotImplemented(String),
    #[error("Invalid argument: {0}")]
    InvalidArgument(String),
    #[error("IO error: {0}")]
    Io(String),
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
