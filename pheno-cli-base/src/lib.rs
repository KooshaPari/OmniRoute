//! # pheno-cli-base
//!
//! Shared CLI building blocks for Phenotype command-line tools.
//!
//! This crate is intentionally small. It bundles the three pieces of
//! boilerplate that every Phenotype CLI re-implements:
//!
//! - [`ConfigArg`] — `-c, --config <path>` (also reads `PHENOTYPE_CONFIG`).
//! - [`Verbosity`] — `-v, --verbose` (count) and `-q, --quiet` flags,
//!   mutually exclusive.
//! - [`setup_tracing`] / [`setup_tracing_from_count`] — `tracing-subscriber`
//!   initialization that respects `RUST_LOG`.
//!
//! ## Quick Start
//!
//! ```rust,no_run
//! use clap::Parser;
//! use pheno_cli_base::{ConfigArg, Verbosity, setup_tracing};
//!
//! #[derive(Debug, Parser)]
//! struct Cli {
//!     #[command(flatten)]
//!     config: ConfigArg,
//!
//!     #[command(flatten)]
//!     verbosity: Verbosity,
//! }
//!
//! fn main() {
//!     let cli = Cli::parse();
//!     setup_tracing(cli.verbosity.to_filter());
//!
//!     if let Some(path) = cli.config.path() {
//!         tracing::info!(?path, "using config");
//!     }
//! }
//! ```
//!
//! See the [`prelude`] for the common-import set.

pub mod config_arg;
pub mod tracing;
pub mod verbosity;

pub use crate::config_arg::ConfigArg;
pub use crate::tracing::{setup_tracing, setup_tracing_from_count};
pub use crate::verbosity::Verbosity;

pub mod prelude {
    //! Common imports for adopting crates.
    //!
    //! ```rust,no_run
    //! use pheno_cli_base::prelude::*;
    //! ```

    pub use crate::config_arg::ConfigArg;
    pub use crate::tracing::{setup_tracing, setup_tracing_from_count};
    pub use crate::verbosity::Verbosity;
}
