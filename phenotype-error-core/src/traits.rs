use crate::code::ErrorCode;
use crate::error_enum::PhenotypeError;

/// Trait for projecting domain-specific error types into the canonical
/// [`PhenotypeError`] and its stable wire [`ErrorCode`].
///
/// Implement this trait on your domain-level error enum so that it
/// participates in the ecosystem's unified error handling pipeline.
///
/// # Derive macro
///
/// When the `phenotype-error-core-derive` proc-macro crate is available,
/// you can use `#[derive(PhenotypeError)]` with variant-level annotations
/// to auto-generate this implementation:
///
/// ```ignore
/// #[derive(Debug, PhenotypeError)]
/// enum MyError {
///     #[phenotype_error(code = "NotFound")]
///     NotFound(String),
///
///     #[phenotype_error(code = "ValidationError")]
///     Validation { field: String, reason: String },
/// }
/// ```
pub trait PhenotypeErrorTrait: std::error::Error + std::fmt::Display + Send + Sync {
    /// Project this error into the stable wire [`ErrorCode`].
    fn error_code(&self) -> ErrorCode;

    /// Whether the operation that produced this error can be safely retried.
    fn is_retryable(&self) -> bool {
        false
    }

    /// Human-readable summary of the error.
    fn message(&self) -> String {
        self.to_string()
    }

    /// Convert (consume) this domain error into the canonical [`PhenotypeError`].
    ///
    /// The default implementation uses [`error_code`](Self::error_code) and
    /// [`message`](Self::message) to construct the most appropriate variant.
    fn into_canonical(self) -> PhenotypeError
    where
        Self: Sized,
    {
        let msg = self.message();
        match self.error_code() {
            ErrorCode::NotFound => PhenotypeError::not_found(msg),
            ErrorCode::AlreadyExists => PhenotypeError::conflict(msg),
            ErrorCode::ValidationError => PhenotypeError::validation(msg),
            ErrorCode::InvalidArgument => PhenotypeError::invalid_input("", msg),
            ErrorCode::Timeout => PhenotypeError::timeout(msg, 0),
            ErrorCode::Unauthenticated => PhenotypeError::authentication(msg),
            ErrorCode::PermissionDenied => PhenotypeError::authorization(msg),
            ErrorCode::Cancelled => PhenotypeError::cancelled(msg),
            ErrorCode::ResourceExhausted => PhenotypeError::rate_limited(msg),
            ErrorCode::Unavailable => PhenotypeError::unavailable(msg),
            _ => PhenotypeError::internal(msg),
        }
    }
}

// ---------------------------------------------------------------------------
// Blanket impl – every PhenotypeError trivially implements PhenotypeErrorTrait.
// ---------------------------------------------------------------------------

impl PhenotypeErrorTrait for PhenotypeError {
    fn error_code(&self) -> ErrorCode {
        self.error_code()
    }

    fn is_retryable(&self) -> bool {
        self.is_retryable()
    }

    fn message(&self) -> String {
        self.to_string()
    }

    fn into_canonical(self) -> PhenotypeError {
        self
    }
}
