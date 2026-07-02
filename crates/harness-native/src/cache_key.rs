//! harness-cache-key binary: compute cache keys for strategies
//!
//! Computes deterministic cache keys based on command arguments, environment,
//! and optionally file contents. Uses xxhash for fast hashing.
//!
//! Usage:
//!   harness-cache-key <mode> <cmd> [args...]
//!
//! Modes:
//!   args     - Hash only command arguments
//!   env      - Hash command + relevant env vars
//!   content  - Hash command + file contents (for file arguments)

use std::env;
use std::fs;
use std::path::Path;

use xxhash_rust::xxh3::xxh3_64;

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.is_empty() {
        eprintln!("usage: harness-cache-key <mode> <cmd> [args...]");
        std::process::exit(1);
    }

    let mode = &args[0];
    let cmd_args = &args[1..];

    let key = match mode.as_str() {
        "args" => compute_args_key(cmd_args),
        "env" => compute_env_key(cmd_args),
        "content" => compute_content_key(cmd_args),
        _ => {
            // Default: treat as args mode with mode as first arg
            compute_args_key(&args)
        }
    };

    println!("{:016x}", key);
}

/// Compute cache key from command arguments only
fn compute_args_key(args: &[String]) -> u64 {
    let mut hasher_state = 0u64;
    for arg in args {
        hasher_state = xxh3_64(arg.as_bytes()).wrapping_add(hasher_state);
    }
    hasher_state
}

/// Compute cache key including relevant environment variables
fn compute_env_key(args: &[String]) -> u64 {
    let mut hasher_state = 0u64;

    // Hash arguments first
    for arg in args {
        hasher_state = xxh3_64(arg.as_bytes()).wrapping_add(hasher_state);
    }

    // Include relevant environment variables that affect command output
    let env_vars = [
        "PATH",
        "HOME",
        "PWD",
        "NODE_VERSION",
        "PYTHON_VERSION",
        "RUST_VERSION",
        "GOPATH",
        "CARGO_HOME",
        "VIRTUAL_ENV",
        "CONDA_DEFAULT_ENV",
    ];

    // Sort for determinism
    let mut env_pairs: Vec<_> =
        env_vars.iter().filter_map(|&var| env::var(var).ok().map(|val| (var, val))).collect();
    env_pairs.sort_by_key(|(k, _)| *k);

    for (key, value) in env_pairs {
        hasher_state = xxh3_64(key.as_bytes()).wrapping_add(hasher_state);
        hasher_state = xxh3_64(value.as_bytes()).wrapping_add(hasher_state);
    }

    hasher_state
}

/// Compute cache key including file contents for path arguments
fn compute_content_key(args: &[String]) -> u64 {
    let mut hasher_state = 0u64;

    for arg in args {
        // Hash the argument string
        hasher_state = xxh3_64(arg.as_bytes()).wrapping_add(hasher_state);

        // If argument is a file path, hash its contents
        let path = Path::new(arg);
        if path.exists() && path.is_file() {
            if let Ok(content) = fs::read(path) {
                hasher_state = xxh3_64(&content).wrapping_add(hasher_state);
            }
        }
    }

    hasher_state
}
