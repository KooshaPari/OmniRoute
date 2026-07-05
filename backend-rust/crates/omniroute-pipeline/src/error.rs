//! Pipeline-specific error type. Wraps the core `Error` for use inside
//! `omniroute-pipeline`. The `From<CoreError>` impl lets you use `?` to
//! lift a core error straight into a `PipelineError`.

use omniroute_core::error::Error as CoreError;
use thiserror::Error;

/// All failure modes the pipeline can surface to its caller.
#[derive(Debug, Error)]
pub enum PipelineError {
    /// The upstream provider returned no events at all (empty stream).
    #[error("upstream returned an empty stream before any event")]
    EmptyStream,

    /// The registry could not resolve a provider for the requested model/format.
    #[error("no provider available for the requested model/format")]
    ProviderMissing,

    /// Wire-format translation failed.
    #[error("translation failed: {0}")]
    TranslationFailed(String),

    /// The caller cancelled the request via the cancellation token.
    #[error("stream was cancelled by the caller")]
    Cancelled,

    /// The pipeline request exceeded its timeout budget.
    #[error("pipeline timed out")]
    Timeout,

    /// The wrapped core error (auth, upstream, storage, etc.).
    #[error(transparent)]
    Core(#[from] CoreError),
}

/// Crate-local Result alias.
pub type PipelineResult<T> = Result<T, PipelineError>;

#[cfg(test)]
mod tests {
    use super::*;
    use omniroute_core::error::Error;

    #[test]
    fn pipeline_error_from_core_error_via_from() {
        let core_err: Error = Error::BadRequest("bad".into());
        let pe: PipelineError = core_err.into();
        match pe {
            PipelineError::Core(Error::BadRequest(s)) => assert_eq!(s, "bad"),
            other => panic!("expected wrapped core error, got {other:?}"),
        }
    }

    #[test]
    fn empty_stream_displays() {
        let e = PipelineError::EmptyStream;
        assert!(e.to_string().contains("empty stream"));
    }

    #[test]
    fn timeout_displays() {
        let e = PipelineError::Timeout;
        assert!(e.to_string().contains("timed out"));
    }
}
