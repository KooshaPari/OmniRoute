//! Prelude module — import with `use phenotype_deps::prelude::*;`.
//!
//! This re-exports the most commonly used traits, types, and macros
//! from each shared dependency so consuming crates get a single,
//! unified import surface.

// ── Async Runtime ────────────────────────────────────────────────────
pub use tokio::main as tokio_main;
pub use tokio::test as tokio_test;
pub use tokio::select;
pub use tokio::spawn;
pub use tokio::task;
pub use tokio::time::{sleep, timeout, Duration as TokioDuration};

pub use futures::prelude::*;

// ── Async Traits ─────────────────────────────────────────────────────
pub use async_trait::async_trait;

// ── Serialization ────────────────────────────────────────────────────
pub use serde::{Deserialize, Serialize};
pub use serde_json::{json, to_string_pretty, Map, Value};

// ── Error Handling ───────────────────────────────────────────────────
pub use anyhow::{anyhow, bail, Context, Error as AnyhowError, Result as AnyhowResult};
pub use thiserror::Error;

// ── Time ─────────────────────────────────────────────────────────────
pub use chrono::{DateTime, Days, Duration as ChronoDuration, NaiveDateTime, TimeDelta, Utc};

// ── CLI ──────────────────────────────────────────────────────────────
pub use clap::{Args, Parser, Subcommand, ValueEnum};

// ── Utilities ────────────────────────────────────────────────────────
pub use uuid::Uuid;

// ── Testing ──────────────────────────────────────────────────────────
pub use tempfile::{NamedTempFile, TempDir};
