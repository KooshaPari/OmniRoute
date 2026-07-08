//! OmniRoute storage: SQLite-backed call logs, API keys, and daily rollups.
//!
//! This crate is a thin wrapper over `sqlx` for the three core tables the
//! gateway reads and writes. The schema lives in `migrations/` and is
//! applied at startup via `run_migrations`.

#![deny(unsafe_code)]
#![warn(missing_debug_implementations)]

pub mod api_keys;
pub mod call_logs;
pub mod db;
pub mod error;
pub mod usage;

pub use api_keys::{insert as upsert_key, find_by_hashed_secret, revoke, touch_last_used, ApiKeyRow};
pub use call_logs::{CallLogRow, count, find_by_request_id, insert, list_recent};
pub use db::{open_memory_pool, open_pool, run_migrations};
pub use error::{StorageError, StorageResult};
pub use usage::{daily_rollup, DailyUsage};
