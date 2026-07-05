//! sharecli - Shared CLI process manager
//!
//! Thin CLI wrapper around local process runtime.
//!
//! Features:
//! - Process management via local runtime types
//! - Multi-project orchestration

pub mod cast;
pub mod commands;
pub mod config;
pub mod config_watcher;
pub mod coordination;
pub mod health_check;
pub mod monitoring;
pub mod notifier;
pub mod runtime;
pub mod serve_lock;
pub mod spawn_policy;
pub mod watchdog;

pub use anyhow::Result;
pub use runtime::{
    ManagedProcess, ProcessFilter, ProcessInfo, ProcessPool, ProjectLimits, ProjectResources,
    SharedRuntime,
};
pub mod health;
pub mod log_sink;
pub mod config_loader;
pub mod metrics;
pub mod signals;
pub mod proc_table;
pub mod env_manager;
pub mod scheduler;

pub mod api;
pub mod queue;
pub mod cache;
pub mod rate_limiter;
pub mod backoff;
pub mod feature_flags;
pub mod object_pool;
pub mod retry;
pub mod cron_parser;
pub mod template;
