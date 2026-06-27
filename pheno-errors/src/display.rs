//! Human-readable `Display` impls for `AppError` variants.
//!
//! Per v23-T3 (L40): errors should be readable to humans first, machines
//! second. The `Display` impl is what users see in logs, terminal output,
//! and error messages; the `Error::source()` chain is for machine traversal.
//!
//! Conventions:
//! - One sentence per error, no trailing period (matches Rust's standard
//!   library style and makes log aggregation easier).
//! - Include the failing value (truncated if huge) so the user knows what
//!   to fix without re-running the program.
//! - Reference the relevant ADR or docs page in parens so the user can
//!   look up more context without leaving the terminal.
use crate::AppError;
use std::fmt;

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Config(msg) => write!(f, "config error: {msg}"),
            AppError::Validation(msg) => write!(f, "validation failed: {msg}"),
            AppError::NotFound { resource, id } => {
                write!(f, "{resource} with id '{id}' not found")
            }
            AppError::Unauthorized(msg) => write!(f, "unauthorized: {msg}"),
            AppError::Forbidden(msg) => write!(f, "forbidden: {msg}"),
            AppError::RateLimited { retry_after_ms } => {
                write!(
                    f,
                    "rate limited; retry after {retry_after_ms}ms (see ADR-046 for fleet limits)"
                )
            }
            AppError::Timeout { operation, timeout_ms } => {
                write!(
                    f,
                    "{operation} timed out after {timeout_ms}ms (consider increasing the deadline \
                     or checking for downstream slowness)"
                )
            }
            AppError::Internal(msg) => write!(f, "internal error: {msg}"),
            AppError::External { service, msg } => {
                write!(f, "external service {service} failed: {msg}")
            }
            AppError::Io { path, source } => {
                write!(f, "I/O error on {path:?}: {source}")
            }
            AppError::Parse { input, kind } => {
                write!(f, "parse error in {kind}: {input}")
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn display_not_found_includes_id() {
        let e = AppError::NotFound {
            resource: "user",
            id: "123",
        };
        assert_eq!(e.to_string(), "user with id '123' not found");
    }

    #[test]
    fn display_rate_limited_suggests_adr() {
        let e = AppError::RateLimited { retry_after_ms: 5000 };
        let s = e.to_string();
        assert!(s.contains("5000"));
        assert!(s.contains("ADR-046"));
    }

    #[test]
    fn display_io_includes_path() {
        let e = AppError::Io {
            path: "/etc/phenotype/config.toml".into(),
            source: std::io::Error::new(std::io::ErrorKind::NotFound, "not found"),
        };
        let s = e.to_string();
        assert!(s.contains("/etc/phenotype/config.toml"));
    }
}
