//! # pheno-otel — canonical OpenTelemetry init for the Phenotype monorepo
//!
//! This crate wraps the OpenTelemetry 0.27 initialization chain into a
//! one-liner: [`init`] (OTLP) or [`init_with_stdout`] (local dev). The
//! returned [`TelemetryGuard`] flushes the global tracer provider and
//! shuts it down when it is dropped, so the surrounding scope's lifetime
//! IS the telemetry pipeline's lifetime.
//!
//! ## Quick start
//!
//! ```no_run
//! use pheno_otel::TelemetryGuard;
//!
//! fn main() -> Result<(), pheno_otel::OtelError> {
//!     let _guard: TelemetryGuard = pheno_otel::init("my-service")?;
//!     // …application code…
//!     // _guard drops at end of `main`; spans are flushed +
//!     // the global tracer provider is shut down.
//!     Ok(())
//! }
//! ```
//!
//! ## Environment
//!
//! - `OTEL_EXPORTER_OTLP_ENDPOINT` — OTLP HTTP/proto endpoint used by
//!   [`init`]. Falls back to `http://localhost:4318` when unset.
//!
//! ## Errors
//!
//! Every fallible function returns [`Result<T, OtelError>`]. See
//! [`OtelError`] for the three-variant taxonomy.
//!
//! ## Companion crates
//!
//! - `pheno-tracing` (L3 #47) installs a `tracing-subscriber` and a
//!   `tracing::Span` will flow into both subscribers.
//! - `pheno-errors` (L3 #46) provides the canonical error type; this
//!   crate's `OtelError` is intentionally narrower (3 variants, scoped
//!   to the OTel lifecycle).

#![deny(missing_docs)]
#![deny(rust_2018_idioms)]

pub mod error;
pub mod exporter;
pub mod guard;
pub mod init;

pub use crate::error::OtelError;
pub use crate::guard::TelemetryGuard;
pub use crate::init::{init, init_with_stdout, DEFAULT_OTLP_ENDPOINT};
