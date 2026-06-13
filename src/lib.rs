//! sharecli - Shared CLI process manager
//!
//! Thin CLI wrapper around local process runtime.
//!
//! Features:
//! - Process management via local runtime types
//! - Multi-project orchestration

pub mod commands;
pub mod config;
pub mod runtime;
pub mod monitoring;

pub use runtime::{ManagedProcess, ProcessInfo, ProcessPool, ProcessFilter, SharedRuntime, ProjectLimits, ProjectResources};
pub use anyhow::Result;
