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
pub mod sorted_vec;
pub mod ring_buffer;
pub mod uuid;
pub mod jsonpath_lite;
pub mod rational;
pub mod stopwatch;
pub mod base64_util;
pub mod money;
pub mod stats;
pub mod hash_util;
pub mod bloom;
pub mod text_slab;
pub mod csv_util;
pub mod levenshtein;
pub mod deque;
pub mod trim;
pub mod itoa;
pub mod astar;
pub mod graph;
pub mod disjoint_set;
pub mod stack;
pub mod queue2;
pub mod lru;
pub mod utf8v;
pub mod lazy;
pub mod argparse;
pub mod stream;
pub mod pin;
pub mod sortedset;
pub mod priority_queue;
pub mod typed_id;
pub mod sliding_window;
pub mod credit_card;
pub mod vlq;
pub mod tar_util;
pub mod ipv4_util;
