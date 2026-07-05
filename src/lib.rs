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
pub mod config_merger;
pub mod binary_search;
pub mod matrix;
pub mod slice_ext;
pub mod perm;
pub mod xml_escape;
pub mod erf;

pub mod distance;
pub mod color;

pub mod bucks;
pub mod md_table;

pub mod radix_trie;
pub mod jsonschema_subset;

pub mod binary_search_ex;
pub mod kmp_search;

pub mod bloom_filter;
pub mod lru_cache_ext;

pub mod skiplist;
pub mod trie_compressed;

pub mod flatbuffers_lite;
pub mod lz4_block;

pub mod crc64;
pub mod glob_pattern;

pub mod base85;
pub mod xxhash3;

pub mod xxtea;
pub mod apfs_uuid;

pub mod base_n_radix;
pub mod word_count;

pub mod mime_qp;
pub mod csv_writer;
