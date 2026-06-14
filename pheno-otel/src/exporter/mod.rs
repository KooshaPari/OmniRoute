//! Span exporter implementations used by the init helpers.
//!
//! The OTLP exporter is pulled in transitively via `opentelemetry-otlp`;
//! it is constructed inline in [`crate::init`]. The [`stdout`] module
//! provides a custom [`StdoutSpanExporter`] for local development that
//! does not require any extra dependencies beyond the OpenTelemetry
//! SDK we already depend on.

pub mod stdout;

pub use stdout::StdoutSpanExporter;
