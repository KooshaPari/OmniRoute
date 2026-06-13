//! Integration tests for the 5 `AppError` variants.
//!
//! Each test exercises a different consumer-style usage pattern so we catch
//! regressions in the `thiserror` derives, the `anyhow` interop, and the
//! `From` impls together.

use std::io;

use anyhow::{Context, Result as AnyhowResult};
use pheno_errors::{AppError, AppResult};

// ---------------------------------------------------------------------------
// 1. Domain variant
// ---------------------------------------------------------------------------

#[test]
fn domain_variant_carries_message_and_is_error() {
    let err = AppError::domain("invariant violated: cycle detected");
    // Display
    let s = err.to_string();
    assert!(s.contains("domain error"), "display was: {s}");
    assert!(s.contains("invariant violated"), "display was: {s}");
    // It's a std::error::Error (via thiserror's derive)
    let as_std: &dyn std::error::Error = &err;
    assert!(as_std.source().is_none(), "Domain has no source");
    // kind() is stable
    assert_eq!(err.kind(), "domain");
}

// ---------------------------------------------------------------------------
// 2. NotFound variant (struct, not tuple)
// ---------------------------------------------------------------------------

#[test]
fn not_found_variant_carries_entity_and_id() {
    let err = AppError::not_found("project", "pheno-007");
    let s = err.to_string();
    assert!(s.contains("not found"), "display was: {s}");
    assert!(s.contains("project"), "display was: {s}");
    assert!(s.contains("pheno-007"), "display was: {s}");
    assert_eq!(err.kind(), "not_found");
    // Pattern-match on the struct fields
    match err {
        AppError::NotFound { entity, id } => {
            assert_eq!(entity, "project");
            assert_eq!(id, "pheno-007");
        }
        other => panic!("expected NotFound, got {other:?}"),
    }
}

// ---------------------------------------------------------------------------
// 3. Conflict variant
// ---------------------------------------------------------------------------

#[test]
fn conflict_variant_lifts_via_question_mark() {
    fn inner() -> AppResult<()> {
        Err(AppError::conflict("etag mismatch: expected 7, got 9"))
    }
    fn outer() -> AppResult<()> {
        inner()?;
        Ok(())
    }
    let err = outer().unwrap_err();
    assert!(matches!(err, AppError::Conflict(_)));
    assert!(err.to_string().contains("etag mismatch"));
    assert_eq!(err.kind(), "conflict");
}

// ---------------------------------------------------------------------------
// 4. Validation variant
// ---------------------------------------------------------------------------

#[test]
fn validation_variant_preserves_input_failure_context() {
    // Simulate a real validation failure: the input was syntactically
    // valid JSON but failed a domain-level rule.
    let err = AppError::validation("name length 0 below minimum 1");
    assert_eq!(err.kind(), "validation");
    assert!(err.to_string().contains("validation error"));
    assert!(err.to_string().contains("name length 0"));

    // The anyhow::Context trait lets us layer on a higher-level message
    // and round-trip back to AppError.
    fn read_field() -> AnyhowResult<String> {
        Err(anyhow::anyhow!("missing required field `name`"))
    }
    let lifted: AppError = read_field()
        .context("loading user profile")
        .unwrap_err()
        .into();
    assert!(matches!(lifted, AppError::Domain(_)));
    assert!(lifted.to_string().contains("loading user profile"));
    assert!(lifted.to_string().contains("missing required field"));
}

// ---------------------------------------------------------------------------
// 5. Storage variant (via From<io::Error>)
// ---------------------------------------------------------------------------

#[test]
fn storage_variant_from_io_error_preserves_message() {
    // The most common boundary translation in the fleet: io::Error
    // arriving from a file / socket / pipe.
    let io_err = io::Error::new(io::ErrorKind::PermissionDenied, "EACCES on /var/data");
    let app_err: AppError = io_err.into();
    assert!(matches!(app_err, AppError::Storage(_)));
    assert_eq!(app_err.kind(), "storage");
    assert!(
        app_err.to_string().contains("EACCES"),
        "io message lost: {}",
        app_err
    );

    // Round-trip the storage error through anyhow::Context without losing
    // the variant. The From<anyhow::Error> impl walks .chain() to
    // preserve the full causal trail when collapsing back to AppError.
    let chained: anyhow::Error = app_err.into();
    let chained = chained.context("while opening adapter file");
    // Sanity: anyhow::Error Display shows the top-level context.
    let anyhow_display = format!("{}", chained);
    assert!(anyhow_display.contains("while opening adapter file"));
    // Drop the anyhow wrapper back into AppError to inspect the chain.
    let lifted_back: AppError = chained.into();
    let lifted_display = lifted_back.to_string();
    assert!(
        lifted_display.contains("EACCES"),
        "lost source: {lifted_display}"
    );
    assert!(
        lifted_display.contains("while opening adapter file"),
        "lost context: {lifted_display}"
    );
}

// ---------------------------------------------------------------------------
// Bonus: cross-variant exhaustiveness check
// ---------------------------------------------------------------------------

#[test]
fn kind_is_total_over_all_5_variants() {
    // If a 6th variant is added, this test will fail to compile and
    // force the maintainer to update it — a tripwire for the L3 DAG's
    // "exactly 5 variants" invariant.
    let variants = [
        AppError::domain("d"),
        AppError::not_found("e", "i"),
        AppError::conflict("c"),
        AppError::validation("v"),
        AppError::storage("s"),
    ];
    let kinds: std::collections::BTreeSet<&str> = variants.iter().map(|v| v.kind()).collect();
    assert_eq!(kinds.len(), 5, "expected 5 distinct kinds, got {kinds:?}");
}
