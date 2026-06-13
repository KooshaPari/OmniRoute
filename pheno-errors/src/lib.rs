//! # pheno-errors
//!
//! Canonical [`AppError`] type for the `pheno-*` fleet. Consolidates the
//! 5 most-common error patterns observed across the L1/L2 fleet audit
//! (2026-06-10) into a single, dependency-light crate.
//!
//! ## The 5 variants
//!
//! | Variant | Meaning | Common wire code |
//! |---------|---------|------------------|
//! | [`AppError::Domain`] | Invariant / business-rule violation that doesn't fit a finer bucket. | `INTERNAL_ERROR` / `INVALID_ARGUMENT` |
//! | [`AppError::NotFound`] | Lookup of an entity by id returned no result. | `NOT_FOUND` |
//! | [`AppError::Conflict`] | Optimistic-concurrency / duplicate / state-machine conflict. | `ALREADY_EXISTS` / `CONFLICT` |
//! | [`AppError::Validation`] | Input failed schema or value-level validation. | `VALIDATION_ERROR` / `INVALID_ARGUMENT` |
//! | [`AppError::Storage`] | Persistence, file, network, or adapter I/O failure. | `INTERNAL_ERROR` |
//!
//! ## Design
//!
//! - Built on [`thiserror`] for `Display` + `Error` derives (no per-variant
//!   boilerplate).
//! - Drops into [`anyhow`] via the blanket
//!   `impl<T: Error + Send + Sync + 'static> From<T> for anyhow::Error`, so
//!   `.context()` / `.with_context()` from `anyhow::Context` work directly
//!   on `Result<_, AppError>`.
//! - Provides `From` impls for the most common boundary errors
//!   ([`std::io::Error`] → [`AppError::Storage`], [`anyhow::Error`] →
//!   [`AppError::Domain`], `&str`/`String` → [`AppError::Domain`]).
//! - Deliberately does NOT add a blanket `From<E: Error>` impl, because
//!   that conflicts with the concrete [`std::io::Error`] impl under Rust's
//!   coherence rules. Callers with their own error types use
//!   `.map_err(|e| AppError::domain(e.to_string()))?` — explicit at the
//!   boundary, no surprise auto-conversion inside libraries.
//!
//! ## Consumers
//!
//! Consumed by L5 #81–85 across the pheno-* fleet. See
//! `V3_EXECUTION_LOG_2026_06_10.md` → "L3 #46" for the rollout notes.
//!
//! ## Why a new crate?
//!
//! The `phenoShared/crates/phenotype-error-core` crate already exposes a
//! richer taxonomy (`ApiError`, `DomainError`, `RepositoryError`,
//! `StorageError`, `ConfigError`, etc.) for the shared-crate fleet. This
//! crate is the **fleet-wide** consolidation: a single, tiny, dependency-
//! light error type that every L1/L2/L3 pheno-* repo can depend on without
//! pulling in the rest of the shared-crate surface. Downstream L5 lanes can
//! later re-export `pheno_errors::AppError` from `phenotype-error-core` to
//! unify the two taxonomies.

use thiserror::Error;

/// The canonical fleet-wide error type.
///
/// This enum is intentionally closed (no `#[non_exhaustive]`) so that
/// `match` exhaustiveness checks are useful at consumer call sites. The
/// 5-variant set is the L3 DAG's design constraint; growing past 5 is a
/// breaking change and should be done via a new variant on a new type.
#[derive(Debug, Error)]
pub enum AppError {
    /// Business-rule / invariant violation that doesn't fit a finer bucket.
    ///
    /// Use this for "the operation is conceptually invalid but the input
    /// shape is fine" — e.g., attempting to ship a frozen contract,
    /// transitioning a state machine to a forbidden state, or evaluating
    /// a policy that fails for a structural reason.
    #[error("domain error: {0}")]
    Domain(String),

    /// Lookup of an entity by id returned no result.
    ///
    /// Carries the entity name and the id so consumers don't have to
    /// re-parse the message string.
    #[error("not found: {entity} {id}")]
    NotFound { entity: String, id: String },

    /// Optimistic-concurrency, duplicate, or state-machine conflict.
    ///
    /// Distinct from [`AppError::Validation`] because the input itself is
    /// valid — the conflict is with existing state (e.g., a duplicate
    /// insert, a stale etag, a CAS failure).
    #[error("conflict: {0}")]
    Conflict(String),

    /// Input failed schema or value-level validation.
    ///
    /// Use this for "the input is malformed" — type errors, missing
    /// required fields, value out of range, regex mismatch.
    #[error("validation error: {0}")]
    Validation(String),

    /// Persistence, file, network, or adapter I/O failure.
    ///
    /// Use this for transport-layer failures — the request was well-formed
    /// but the storage adapter couldn't satisfy it.
    #[error("storage error: {0}")]
    Storage(String),
}

impl AppError {
    /// Short, lowercase, snake_case tag for logging and metrics.
    ///
    /// Stable across releases; do NOT use as the wire error code
    /// (use `phenotype-error-core::ErrorCode` for that).
    pub const fn kind(&self) -> &'static str {
        match self {
            Self::Domain(_) => "domain",
            Self::NotFound { .. } => "not_found",
            Self::Conflict(_) => "conflict",
            Self::Validation(_) => "validation",
            Self::Storage(_) => "storage",
        }
    }

    /// Convenience constructor for [`AppError::Domain`].
    pub fn domain(msg: impl Into<String>) -> Self {
        Self::Domain(msg.into())
    }

    /// Convenience constructor for [`AppError::NotFound`].
    pub fn not_found(entity: impl Into<String>, id: impl Into<String>) -> Self {
        Self::NotFound {
            entity: entity.into(),
            id: id.into(),
        }
    }

    /// Convenience constructor for [`AppError::Conflict`].
    pub fn conflict(msg: impl Into<String>) -> Self {
        Self::Conflict(msg.into())
    }

    /// Convenience constructor for [`AppError::Validation`].
    pub fn validation(msg: impl Into<String>) -> Self {
        Self::Validation(msg.into())
    }

    /// Convenience constructor for [`AppError::Storage`].
    pub fn storage(msg: impl Into<String>) -> Self {
        Self::Storage(msg.into())
    }

    /// Log this error at WARN with structured fields, then return it.
    ///
    /// Useful in fallible pipelines where the caller wants a recorded
    /// breadcrumb but still wants to propagate the error.
    pub fn log_warn(self) -> Self {
        tracing::warn!(error.kind = self.kind(), error.display = %self, "AppError");
        self
    }

    /// Log this error at ERROR with structured fields, then return it.
    pub fn log_error(self) -> Self {
        tracing::error!(error.kind = self.kind(), error.display = %self, "AppError");
        self
    }
}

// ---------------------------------------------------------------------------
// From impls for common boundary error types
// ---------------------------------------------------------------------------

/// Map any `std::io::Error` to [`AppError::Storage`].
///
/// This is the most common boundary translation in the fleet — every
/// persistence adapter sees `io::Error`. Mapping it to the `Storage`
/// variant (not `Domain`) preserves the "the request was fine, the
/// adapter failed" semantics.
impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        Self::Storage(err.to_string())
    }
}

/// Map a `&'static str` literal to [`AppError::Domain`].
///
/// Ergonomic for `return Err("something went wrong".into())` in handlers.
impl From<&'static str> for AppError {
    fn from(msg: &'static str) -> Self {
        Self::Domain(msg.to_string())
    }
}

/// Map an owned `String` to [`AppError::Domain`].
impl From<String> for AppError {
    fn from(msg: String) -> Self {
        Self::Domain(msg)
    }
}

// ---------------------------------------------------------------------------
// anyhow interop
// ---------------------------------------------------------------------------
//
// `anyhow::Error: From<E> where E: std::error::Error + Send + Sync + 'static`
// is a blanket impl in the `anyhow` crate, so no explicit `From<AppError>
// for anyhow::Error` is needed. The `anyhow::Context` trait relies on it
// to chain extra context onto an `AppError`-yielding `Result`:
//
//     use anyhow::Context;
//     let port = std::env::var("PORT").context("PORT not set")?; // -> anyhow::Error
//     let _: AppError = port.context("reading config").unwrap_err().into();
//
// The `From<anyhow::Error> for AppError` below rounds-trip back into the
// canonical type at API boundaries (e.g., HTTP handlers that want to
// return a typed error instead of leaking `anyhow::Error` to clients).

/// Round-trip conversion from `anyhow::Error` back to [`AppError`].
///
/// `anyhow::Error` is a heterogeneous wrapper, so we collapse the whole
/// chain into a [`AppError::Domain`] with the rendered display. Callers
/// that need a more specific variant should downcast or `match` the source
/// before calling this.
///
/// Note: `anyhow::Error`'s `Display` impl renders only the outermost
/// context, not the cause chain. We walk the chain explicitly so the
/// result preserves the full causal trail (otherwise `?` propagation
/// would silently drop inner error context).
impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        // Walk the chain root → leaf and join with " → " so the full
        // causal trail is preserved in the resulting Domain message.
        let chain: Vec<String> = err.chain().map(|e| e.to_string()).collect();
        Self::Domain(chain.join(" → "))
    }
}

// ---------------------------------------------------------------------------
// Result alias
// ---------------------------------------------------------------------------

/// `Result<T, AppError>` — the canonical return type for fallible
/// functions in the pheno-* fleet.
pub type AppResult<T> = Result<T, AppError>;

// ---------------------------------------------------------------------------
// Inline unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod inline_tests {
    use super::*;

    #[test]
    fn kind_is_stable() {
        assert_eq!(AppError::domain("x").kind(), "domain");
        assert_eq!(AppError::not_found("user", "1").kind(), "not_found");
        assert_eq!(AppError::conflict("x").kind(), "conflict");
        assert_eq!(AppError::validation("x").kind(), "validation");
        assert_eq!(AppError::storage("x").kind(), "storage");
    }

    #[test]
    fn constructors_set_variant() {
        assert!(matches!(AppError::domain("d"), AppError::Domain(_)));
        assert!(matches!(
            AppError::not_found("user", "1"),
            AppError::NotFound { entity, id } if entity == "user" && id == "1"
        ));
        assert!(matches!(AppError::conflict("c"), AppError::Conflict(_)));
        assert!(matches!(AppError::validation("v"), AppError::Validation(_)));
        assert!(matches!(AppError::storage("s"), AppError::Storage(_)));
    }

    #[test]
    fn display_includes_context() {
        let e = AppError::not_found("user", "42");
        let s = e.to_string();
        assert!(s.contains("user"), "display was: {s}");
        assert!(s.contains("42"), "display was: {s}");
    }

    #[test]
    fn from_io_error_maps_to_storage() {
        let io = std::io::Error::new(std::io::ErrorKind::NotFound, "file gone");
        let app: AppError = io.into();
        assert!(matches!(app, AppError::Storage(_)));
    }

    #[test]
    fn from_str_literal_maps_to_domain() {
        let app: AppError = "boom".into();
        assert!(matches!(app, AppError::Domain(ref m) if m == "boom"));
    }

    #[test]
    fn from_string_maps_to_domain() {
        let app: AppError = String::from("owned boom").into();
        assert!(matches!(app, AppError::Domain(ref m) if m == "owned boom"));
    }

    #[test]
    fn from_anyhow_round_trip() {
        let original = AppError::validation("bad");
        let anyhow_err: anyhow::Error = original.into();
        let round_trip: AppError = anyhow_err.into();
        assert!(matches!(round_trip, AppError::Domain(_)));
        assert!(round_trip.to_string().contains("bad"));
    }

    #[test]
    fn app_error_is_std_error_with_no_source() {
        use std::error::Error;
        fn assert_is_error<E: std::error::Error>(_: &E) {}
        let e = AppError::conflict("x");
        assert_is_error(&e);
        assert!(e.source().is_none(), "no source by default");
    }
}
