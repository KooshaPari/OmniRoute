//! Storage error type. Wraps `sqlx::Error` and our own validation errors
//! for use in the storage layer.

use omniroute_core::error::Error as CoreError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("sqlx error: {0}")]
    Sqlx(#[from] sqlx::Error),

    #[error("migration error: {0}")]
    Migrate(#[from] sqlx::migrate::MigrateError),

    #[error("not found: {0}")]
    NotFound(String),

    #[error("decode error: {0}")]
    Decode(String),

    #[error(transparent)]
    Core(#[from] CoreError),
}

pub type StorageResult<T> = Result<T, StorageError>;
