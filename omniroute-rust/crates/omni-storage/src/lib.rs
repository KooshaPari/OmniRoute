//! OmniRoute SQLite storage: connection pool, schema, migrations, repositories.
//!
//! Foundation crate. The router and server depend on this for API keys,
//! providers, models, call logs, combos, tenants, and feature flags.

#![forbid(unsafe_code)]
#![warn(clippy::all, clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]

pub mod error;
pub mod ids;
pub mod migrations;
pub mod models;
pub mod pool;
pub mod repo;
pub mod schema;

pub use error::{StorageError, StorageResult};
pub use ids::*;
pub use models::*;
pub use pool::{StoragePool, StoragePoolBuilder};
pub use schema::{list_tables, schema_version, table_exists};
