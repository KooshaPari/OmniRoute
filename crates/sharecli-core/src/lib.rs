//! `sharecli-core` — hypervisor engine tier.
//!
//! This crate is the central entry point for spawning managed processes in the
//! sharecli stack.  It wires together the coalescing cache from `sharecli-ipc`
//! (Lock-Wait-Cache deduplication) with real OS process spawning via
//! `tokio::process::Command`.
//!
//! # Architecture
//!
//! ```text
//! caller ──► Hypervisor::run(SpawnRequest)
//!                │
//!                ├─ compute command_key (sharecli-ipc)
//!                │
//!                └─ CoalesceCache::with_lock
//!                       │
//!                       ├─ [cache hit]  → SpawnOutcome { from_cache: true }
//!                       │
//!                       └─ [cache miss] → tokio::process::Command::spawn
//!                                             → capture stdout/stderr/exit_code
//!                                             → store in cache
//!                                             → SpawnOutcome { from_cache: false }
//! ```
//!
//! # TODO hooks (follow-up PRs)
//! - `// TODO(hypervisor): thermal-gate` — query `sharecli-fleet::ThermalGovernor`
//!   before spawning; back-pressure when the device is thermally throttled.
//! - `// TODO(hypervisor): fuse-io` — mount FUSE intercept layer from `sharecli-fuse`
//!   over the child's working directory for IO ownership tracking.
//! - `// TODO(hypervisor): speculative` — pre-execute high-probability commands during
//!   idle periods and pre-populate the coalesce cache.

use std::path::PathBuf;

use anyhow::{Context, Result};
use sharecli_ipc::{CachedResult, CoalesceCache, command_key};
use tracing::debug;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// Configuration for the [`Hypervisor`].
#[derive(Debug, Clone)]
pub struct HypervisorConfig {
    /// Root directory for the coalesce cache.
    pub cache_root: PathBuf,
}

/// A request to spawn a managed process.
#[derive(Debug, Clone)]
pub struct SpawnRequest {
    /// Argument vector — `argv[0]` is the program name.
    pub argv: Vec<String>,
    /// Working directory for the child process.
    pub cwd: PathBuf,
    /// Environment variable overrides passed to the child.
    pub env: Vec<(String, String)>,
}

/// The outcome of a [`Hypervisor::run`] call.
#[derive(Debug, Clone)]
pub struct SpawnOutcome {
    /// Exit status code of the process (or the cached result).
    pub exit_code: i32,
    /// Raw bytes captured from standard output.
    pub stdout: Vec<u8>,
    /// Raw bytes captured from standard error.
    pub stderr: Vec<u8>,
    /// `true` when the result was served from the coalesce cache without
    /// actually spawning a new process.
    pub from_cache: bool,
}

// ---------------------------------------------------------------------------
// CachedResult ↔ SpawnOutcome conversions (required by CoalesceCache::with_lock)
// ---------------------------------------------------------------------------

impl From<CachedResult> for SpawnOutcome {
    fn from(c: CachedResult) -> Self {
        Self {
            exit_code: c.exit_code,
            stdout: c.stdout,
            stderr: c.stderr,
            from_cache: true,
        }
    }
}

impl From<SpawnOutcome> for CachedResult {
    fn from(s: SpawnOutcome) -> Self {
        Self { exit_code: s.exit_code, stdout: s.stdout, stderr: s.stderr }
    }
}

// ---------------------------------------------------------------------------
// Hypervisor
// ---------------------------------------------------------------------------

/// The sharecli hypervisor engine.
///
/// Owns a [`CoalesceCache`] and routes every [`SpawnRequest`] through the
/// Lock-Wait-Cache protocol: identical concurrent commands coalesce into a
/// single execution, with all waiters receiving the same cached result.
pub struct Hypervisor {
    cache: CoalesceCache,
    #[allow(dead_code)]
    config: HypervisorConfig,
}

impl Hypervisor {
    /// Create a new `Hypervisor` with its coalesce cache rooted at `cache_root`.
    pub fn new(cache_root: impl Into<PathBuf>) -> Self {
        let cache_root = cache_root.into();
        let config = HypervisorConfig { cache_root: cache_root.clone() };
        Self { cache: CoalesceCache::new(cache_root), config }
    }

    /// Run a managed spawn with Lock-Wait-Cache coalescing.
    ///
    /// # Coalescing behaviour
    /// - If no cached result exists for this command the process is spawned,
    ///   its output captured, and the result stored.
    /// - If a cached result already exists (i.e. an identical command was
    ///   recently run) the result is returned immediately without a new spawn.
    /// - Concurrent callers with the same command key block on an advisory
    ///   flock; the first one to acquire the lock spawns; the rest read the
    ///   cache once the lock is released.
    ///
    /// # TODO(hypervisor): thermal-gate
    /// Before calling `spawn_process` check `ThermalGovernor::can_schedule()`
    /// from `sharecli-fleet`; return `Err` or sleep-retry when the device is
    /// throttled.
    ///
    /// # TODO(hypervisor): fuse-io
    /// Wrap the child's `cwd` with the `sharecli-fuse` IO intercept mount so
    /// that file-system access is tracked for build-system cache sharing.
    ///
    /// # TODO(hypervisor): speculative
    /// Record command-frequency histograms here; trigger pre-execution from a
    /// background task when a command crosses the speculation threshold.
    pub async fn run(&self, req: SpawnRequest) -> Result<SpawnOutcome> {
        let key = command_key(&req.argv, &req.cwd, &req.env);
        debug!(key = %key.0, argv = ?req.argv, "hypervisor::run");

        // Check the cache before acquiring the lock so that we can
        // accurately report `from_cache` for the caller.
        if let Some(cached) = self.cache.lookup(&key)? {
            debug!(key = %key.0, "hypervisor::run — cache hit");
            return Ok(SpawnOutcome {
                exit_code: cached.exit_code,
                stdout: cached.stdout,
                stderr: cached.stderr,
                from_cache: true,
            });
        }

        // Cache miss — acquire the advisory flock, re-check inside the lock
        // (a sibling may have stored the result while we were waiting), and
        // only spawn if still a miss.
        //
        // Lock-Wait-Cache: spawn is the closure called only on a cache miss.
        let cached: CachedResult = self.cache.with_lock(&key, || {
            // Blocking spawn — `with_lock` is a sync callback.
            let outcome = spawn_process_sync(&req)?;
            Ok(CachedResult {
                exit_code: outcome.exit_code,
                stdout: outcome.stdout,
                stderr: outcome.stderr,
            })
        })?;

        // We came through `with_lock` — the result is fresh (spawned by us
        // or by a sibling that held the lock; either way, not in the cache
        // when we last checked before entering with_lock).
        Ok(SpawnOutcome {
            exit_code: cached.exit_code,
            stdout: cached.stdout,
            stderr: cached.stderr,
            from_cache: false,
        })
    }
}

// ---------------------------------------------------------------------------
// Process execution
// ---------------------------------------------------------------------------

/// Spawn `req.argv` synchronously (blocking) and capture its output.
///
/// Used inside `CoalesceCache::with_lock` which takes a synchronous closure.
fn spawn_process_sync(req: &SpawnRequest) -> Result<SpawnOutcome> {
    let (program, args) = req
        .argv
        .split_first()
        .with_context(|| "spawn_process_sync: argv is empty")?;

    let output = std::process::Command::new(program)
        .args(args)
        .current_dir(&req.cwd)
        .envs(req.env.iter().map(|(k, v)| (k.as_str(), v.as_str())))
        .output()
        .with_context(|| format!("failed to spawn {:?}", req.argv))?;

    let exit_code = output.status.code().unwrap_or(-1);
    Ok(SpawnOutcome {
        exit_code,
        stdout: output.stdout,
        stderr: output.stderr,
        from_cache: false,
    })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn echo_argv(msg: &str) -> Vec<String> {
        // Use a portable shell-free echo: `echo` is available on both unix and Windows.
        #[cfg(unix)]
        return vec!["echo".to_string(), msg.to_string()];
        #[cfg(windows)]
        return vec!["cmd".to_string(), "/C".to_string(), "echo".to_string(), msg.to_string()];
    }

    /// (a) Running a simple echo command for the first time should succeed with
    ///     `from_cache = false` and the expected stdout.
    #[tokio::test]
    async fn run_echo_fresh() {
        let dir = TempDir::new().expect("tempdir");
        let hv = Hypervisor::new(dir.path());

        let req = SpawnRequest {
            argv: echo_argv("hello"),
            cwd: dir.path().to_path_buf(),
            env: vec![],
        };

        let outcome = hv.run(req).await.expect("run should succeed");

        assert_eq!(outcome.exit_code, 0, "echo should exit 0");
        assert!(!outcome.from_cache, "first run must not come from cache");

        let stdout = String::from_utf8_lossy(&outcome.stdout);
        assert!(stdout.contains("hello"), "stdout should contain 'hello', got: {stdout:?}");
    }

    /// (b) A second identical run must return the cached result (`from_cache = true`)
    ///     with the same stdout bytes — without re-executing the process.
    #[tokio::test]
    async fn run_echo_coalesces_on_second_call() {
        let dir = TempDir::new().expect("tempdir");
        let hv = Hypervisor::new(dir.path());

        let req = SpawnRequest {
            argv: echo_argv("world"),
            cwd: dir.path().to_path_buf(),
            env: vec![],
        };

        // First call — live spawn.
        let first = hv.run(req.clone()).await.expect("first run");
        assert!(!first.from_cache, "first run must not come from cache");
        assert_eq!(first.exit_code, 0);

        // Second call — must hit the cache.
        let second = hv.run(req).await.expect("second run");
        assert!(second.from_cache, "second run must come from cache");
        assert_eq!(second.stdout, first.stdout, "cached stdout must match original");
        assert_eq!(second.exit_code, first.exit_code);
    }
}
