//! Storage error type.

use thiserror::Error;

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("sqlx: {0}")]
    Sqlx(#[from] sqlx::Error),

    #[error("migration: {0}")]
    Migration(String),

    #[error("io: {0}")]
    Io(#[from] std::io::Error),

    #[error("json: {0}")]
    Json(#[from] serde_json::Error),

    #[error("not found: {entity} id={id}")]
    NotFound { entity: String, id: String },

    #[error("duplicate: {entity} key={key}")]
    Duplicate { entity: String, key: String },

    #[error("config: {0}")]
    Config(String),

    #[error("other: {0}")]
    Other(String),
}

impl StorageError {
    pub fn not_found(entity: impl Into<String>, id: impl Into<String>) -> Self {
        Self::NotFound { entity: entity.into(), id: id.into() }
    }

    pub fn duplicate(entity: impl Into<String>, key: impl Into<String>) -> Self {
        Self::Duplicate { entity: entity.into(), key: key.into() }
    }
}

pub type StorageResult<T> = Result<T, StorageError>;

impl From<StorageError> for omni_core::Error {
    fn from(e: StorageError) -> Self {
        match e {
            StorageError::NotFound { .. } => omni_core::Error::with_kind(omni_core::ErrorKind::NotFound, e.to_string()),
            StorageError::Duplicate { .. } => omni_core::Error::with_kind(omni_core::ErrorKind::Conflict, e.to_string()),
            _ => omni_core::Error::with_kind(omni_core::ErrorKind::Db, e.to_string()),
        }
    }
}
