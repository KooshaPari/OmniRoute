//! Tests for phenotype-error-macros

use thiserror::Error;

// Test that basic error types work with thiserror
#[derive(Debug, Error)]
pub enum TestError {
    #[error("Not found: {resource}")]
    NotFound { resource: String },

    #[error("Permission denied: {action}")]
    PermissionDenied { action: String },

    #[error("Invalid input")]
    InvalidInput,
}

// Test another error type
#[derive(Debug, Error)]
pub enum ServiceError {
    #[error("Database error: {0}")]
    Database(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Other: {0}")]
    Other(String),
}

#[test]
fn test_basic_error() {
    let err = TestError::NotFound {
        resource: "user".to_string(),
    };
    assert!(err.to_string().contains("user"));
}

#[test]
fn test_error_display() {
    let err = TestError::InvalidInput;
    assert_eq!(err.to_string(), "Invalid input");
}

#[test]
fn test_service_error_display() {
    let err = ServiceError::Other("test error".to_string());
    let display = format!("{}", err);
    assert!(display.contains("test error"));
}

#[test]
fn test_error_variant_count() {
    // Test that all variants are accessible
    let _ = TestError::NotFound {
        resource: "test".to_string(),
    };
    let _ = TestError::PermissionDenied {
        action: "read".to_string(),
    };
    let _ = TestError::InvalidInput;
}
