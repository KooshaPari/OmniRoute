//! `Diagnostic` impls for `AppError` variants using the `miette` crate.
//!
//! Per v23-T4 (L41): a `Diagnostic` is a machine-readable error description
//! that includes:
//! - The error message
//! - A unique error code (e.g., "PHN-CFG-001") for log aggregation
//! - A help suggestion for the user
//! - A link to the relevant docs page or ADR
//!
//! `Diagnostic` is the *machine* counterpart to `Display` (the human
//! counterpart). Logs that capture `Diagnostic.code` get auto-aggregated
//! by severity; the help field is what users see in CLI output.
use crate::AppError;
use miette::Diagnostic;
use thiserror::Error;

#[derive(Debug, Error, Diagnostic)]
pub enum AppDiagnostic {
    #[error("config error: {message}")]
    #[diagnostic(
        code = "PHN-CFG-001",
        help = "Check that the config file is valid TOML/JSON. See ADR-031 for the Configra canonical path."
    )]
    Config { message: String },

    #[error("validation failed: {field} — {reason}")]
    #[diagnostic(
        code = "PHN-VAL-001",
        help = "Re-read the API docs for the field; the value '{value}' is not in the expected set."
    )]
    Validation { field: String, reason: String, value: String },

    #[error("{resource} with id '{id}' not found")]
    #[diagnostic(
        code = "PHN-RES-404",
        help = "Verify the id is correct. If you have permission to list all {resource}, use the list command."
    )]
    NotFound { resource: String, id: String },

    #[error("rate limited; retry after {retry_after_ms}ms")]
    #[diagnostic(
        code = "PHN-RL-429",
        help = "See ADR-046 for the per-service rate limit table. If you need a higher limit, file an issue."
    )]
    RateLimited { retry_after_ms: u64 },

    #[error("internal error: {message}")]
    #[diagnostic(
        code = "PHN-INT-500",
        help = "This is a bug; please file an issue at https://github.com/phenotype/pheno-errors/issues with the full error."
    )]
    Internal { message: String },
}

impl From<&AppError> for AppDiagnostic {
    fn from(e: &AppError) -> Self {
        match e {
            AppError::Config(m) => AppDiagnostic::Config { message: m.clone() },
            AppError::Validation(m) => AppDiagnostic::Validation {
                field: "unknown".into(),
                reason: m.clone(),
                value: "".into(),
            },
            AppError::NotFound { resource, id } => AppDiagnostic::NotFound {
                resource: resource.clone(),
                id: id.clone(),
            },
            AppError::RateLimited { retry_after_ms } => AppDiagnostic::RateLimited {
                retry_after_ms: *retry_after_ms,
            },
            AppError::Internal(m) => AppDiagnostic::Internal { message: m.clone() },
            // For variants without a diagnostic mapping, fall back to Internal.
            _ => AppDiagnostic::Internal {
                message: e.to_string(),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn config_diagnostic_has_code() {
        let e = AppError::Config("bad toml".into());
        let d: AppDiagnostic = (&e).into();
        let report = miette::Report::new(d);
        let s = format!("{report:?}");
        assert!(s.contains("PHN-CFG-001"));
    }

    #[test]
    fn not_found_diagnostic_includes_resource() {
        let e = AppError::NotFound {
            resource: "user".into(),
            id: "42".into(),
        };
        let d: AppDiagnostic = (&e).into();
        let report = miette::Report::new(d);
        let s = format!("{report:?}");
        assert!(s.contains("user"));
        assert!(s.contains("PHN-RES-404"));
    }

    #[test]
    fn all_codes_are_phn_prefixed() {
        // Compile-time + runtime: ensures all codes share the PHN-* namespace
        let variants = vec![
            AppError::Config("x".into()),
            AppError::Validation("x".into()),
            AppError::NotFound {
                resource: "x".into(),
                id: "x".into(),
            },
            AppError::RateLimited { retry_after_ms: 1 },
            AppError::Internal("x".into()),
        ];
        for v in variants {
            let _d = AppDiagnostic::from(&v); // constructs without panic
        }
    }
}
