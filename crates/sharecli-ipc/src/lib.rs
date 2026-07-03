//! `sharecli-ipc` — coalesce/debounce/queue tier of the sharecli OS-process hypervisor.
//!
//! # Lock-Wait-Cache pattern
//!
//! When N isolated agent processes issue the same command concurrently (e.g. 8 agents
//! all run `ruff check .`), only one execution actually runs; the other 7 block on an
//! advisory `flock` and then read the result written by the winner.
//!
//! The three building blocks are:
//!
//! 1. **[`command_key`]** — SHA-256 of (argv + cwd + relevant env) → deterministic hex key.
//! 2. **[`CoalesceCache`]** — atomic JSON store: `lookup` / `store` / `with_lock`.
//! 3. **[`CachedResult`]** — the serialisable exit_code + stdout + stderr bundle.
//!
//! # TODO hooks
//! - `// TODO(hypervisor): debounce-window` — attach a TTL / staleness check to
//!   [`CoalesceCache::lookup`] so results older than N seconds are treated as a miss.
//! - `// TODO(hypervisor): eviction` — periodic sweep of `root/<key>.json` files older
//!   than the configured TTL inside [`CoalesceCache::store`].

use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// ---------------------------------------------------------------------------
// CommandKey
// ---------------------------------------------------------------------------

/// An opaque, stable, hex-encoded cache key for a command invocation.
///
/// Two invocations are considered identical when they have the same argv,
/// working directory, and the same subset of environment variables.
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CommandKey(pub String);

/// Compute the [`CommandKey`] for a command invocation.
///
/// Inputs are normalised before hashing:
/// - `argv` — joined with NUL bytes so spaces inside arguments are safe.
/// - `cwd`  — the canonical string representation of the path.
/// - `env_subset` — key=value pairs sorted by key so insertion order is irrelevant.
pub fn command_key(argv: &[String], cwd: &Path, env_subset: &[(String, String)]) -> CommandKey {
    let mut hasher = Sha256::new();

    // argv: NUL-separated tokens so `["ruff", "check ."]` != `["ruff check", "."]`
    for arg in argv {
        hasher.update(arg.as_bytes());
        hasher.update(b"\x00");
    }
    hasher.update(b"\x01"); // argv/cwd separator

    // cwd
    hasher.update(cwd.to_string_lossy().as_bytes());
    hasher.update(b"\x01"); // cwd/env separator

    // env: sort so {A=1,B=2} == {B=2,A=1}
    let mut sorted_env: Vec<&(String, String)> = env_subset.iter().collect();
    sorted_env.sort_by_key(|(k, _)| k.as_str());
    for (k, v) in sorted_env {
        hasher.update(k.as_bytes());
        hasher.update(b"=");
        hasher.update(v.as_bytes());
        hasher.update(b"\x00");
    }

    let digest = hasher.finalize();
    CommandKey(hex::encode(digest))
}

// ---------------------------------------------------------------------------
// CachedResult
// ---------------------------------------------------------------------------

/// The outcome of a command execution — what the hypervisor stores and returns
/// to the waiting sibling agents.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedResult {
    pub exit_code: i32,
    /// Raw bytes of standard output.
    pub stdout: Vec<u8>,
    /// Raw bytes of standard error.
    pub stderr: Vec<u8>,
}

// ---------------------------------------------------------------------------
// CoalesceCache
// ---------------------------------------------------------------------------

/// File-system-backed coalesce cache for command results.
///
/// Layout under `root/`:
/// ```text
/// <hex-key>.json   — JSON-serialised CachedResult
/// <hex-key>.lock   — advisory flock sentinel (content irrelevant)
/// ```
///
/// [`with_lock`][CoalesceCache::with_lock] serialises concurrent callers with the
/// same key: the first acquires the exclusive flock, runs the command, and writes the
/// result; subsequent callers block until the lock is released, then hit the now-
/// populated cache entry without re-executing.
pub struct CoalesceCache {
    root: PathBuf,
}

impl CoalesceCache {
    /// Create a new cache rooted at `root`.  The directory is created on first use
    /// if it does not already exist.
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    fn entry_path(&self, key: &CommandKey) -> PathBuf {
        self.root.join(format!("{}.json", key.0))
    }

    fn lock_path(&self, key: &CommandKey) -> PathBuf {
        self.root.join(format!("{}.lock", key.0))
    }

    fn ensure_root(&self) -> Result<()> {
        fs::create_dir_all(&self.root)
            .with_context(|| format!("create cache root {}", self.root.display()))
    }

    /// Look up a cached result.
    ///
    /// Returns `Ok(None)` when no entry exists yet.
    ///
    /// # TODO(hypervisor): debounce-window
    /// Compare the entry's mtime against a configured TTL; return `Ok(None)` when
    /// the entry is stale so the caller re-runs and re-stores a fresh result.
    pub fn lookup(&self, key: &CommandKey) -> Result<Option<CachedResult>> {
        let path = self.entry_path(key);
        match fs::read(&path) {
            Ok(bytes) => {
                let result: CachedResult = serde_json::from_slice(&bytes)
                    .with_context(|| format!("deserialise cache entry {}", path.display()))?;
                Ok(Some(result))
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e).with_context(|| format!("read cache entry {}", path.display())),
        }
    }

    /// Atomically write a [`CachedResult`] for `key`.
    ///
    /// Uses a write-to-temp-then-rename strategy so concurrent readers never
    /// observe a partial / truncated JSON file.
    ///
    /// # TODO(hypervisor): eviction
    /// After writing, schedule or inline a sweep of `root/` to remove entries
    /// whose mtime exceeds the configured TTL.
    pub fn store(&self, key: &CommandKey, result: &CachedResult) -> Result<()> {
        self.ensure_root()?;

        let bytes = serde_json::to_vec(result).context("serialise CachedResult")?;

        // Write to a NamedTempFile in the same directory so the rename is atomic
        // (same filesystem, no cross-device move).
        let mut tmp = tempfile::NamedTempFile::new_in(&self.root)
            .with_context(|| format!("create temp file in {}", self.root.display()))?;
        tmp.write_all(&bytes).context("write cache bytes to temp file")?;
        tmp.flush().context("flush temp file")?;

        let dest = self.entry_path(key);
        tmp.persist(&dest)
            .with_context(|| format!("persist cache entry to {}", dest.display()))?;

        Ok(())
    }

    /// Execute `f` under an exclusive advisory flock for `key`.
    ///
    /// The Lock-Wait-Cache protocol:
    /// 1. Open (or create) `root/<key>.lock`.
    /// 2. Acquire an **exclusive** flock — blocks until any prior holder releases it.
    /// 3. After acquiring the lock, **re-check** the cache: a sibling that held the
    ///    lock may have already stored the result.
    /// 4. If still a miss, call `f()` and store the result.
    /// 5. Release the lock (file handle drop).
    ///
    /// Returns the [`CachedResult`] whether it came from `f()` or the cache.
    pub fn with_lock<T>(
        &self,
        key: &CommandKey,
        f: impl FnOnce() -> Result<T>,
    ) -> Result<T>
    where
        T: Into<CachedResult> + From<CachedResult>,
    {
        self.ensure_root()?;

        let lock_path = self.lock_path(key);
        let lock_file = fs::OpenOptions::new()
            .create(true)
            .write(true)
            .open(&lock_path)
            .with_context(|| format!("open lock file {}", lock_path.display()))?;

        // Block until we are the sole holder.
        lock_file
            .lock_exclusive()
            .with_context(|| format!("acquire exclusive lock on {}", lock_path.display()))?;

        // Re-check: a sibling may have stored the result while we were waiting.
        // TODO(hypervisor): debounce-window — also check TTL staleness here.
        if let Some(cached) = self.lookup(key)? {
            // Lock releases on drop of `lock_file`.
            return Ok(T::from(cached));
        }

        // We are first — run the command.
        let value = f()?;
        let cached: CachedResult = value.into();
        self.store(key, &cached)?;

        // Lock releases on drop.
        Ok(T::from(cached))
    }
}

// ---------------------------------------------------------------------------
// hex helper (avoid a separate dep — sha2 already pulls in digest)
// ---------------------------------------------------------------------------

mod hex {
    pub fn encode(bytes: impl AsRef<[u8]>) -> String {
        bytes.as_ref().iter().map(|b| format!("{b:02x}")).collect()
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;
    use tempfile::TempDir;

    // -----------------------------------------------------------------------
    // (a) command_key is stable and differs on differing argv
    // -----------------------------------------------------------------------
    #[test]
    fn command_key_stable_and_differs() {
        let cwd = Path::new("/tmp/proj");
        let env: Vec<(String, String)> = vec![];

        let argv_a = vec!["ruff".to_string(), "check".to_string(), ".".to_string()];
        let argv_b = vec!["ruff".to_string(), "format".to_string(), ".".to_string()];

        let key1 = command_key(&argv_a, cwd, &env);
        let key2 = command_key(&argv_a, cwd, &env);
        let key3 = command_key(&argv_b, cwd, &env);

        // Stable: same input → same key.
        assert_eq!(key1, key2, "command_key must be deterministic");

        // Differs: different argv → different key.
        assert_ne!(key1, key3, "different argv must produce different keys");

        // Key is a non-empty hex string (64 hex chars for SHA-256).
        assert_eq!(key1.0.len(), 64);
        assert!(key1.0.chars().all(|c| c.is_ascii_hexdigit()));
    }

    // -----------------------------------------------------------------------
    // (b) store → lookup round-trips a CachedResult
    // -----------------------------------------------------------------------
    #[test]
    fn store_lookup_round_trip() {
        let dir = TempDir::new().expect("tempdir");
        let cache = CoalesceCache::new(dir.path());

        let argv = vec!["cargo".to_string(), "check".to_string()];
        let key = command_key(&argv, Path::new("/workspace"), &[]);

        // Nothing stored yet.
        assert!(cache.lookup(&key).unwrap().is_none(), "fresh cache should be empty");

        let result = CachedResult {
            exit_code: 0,
            stdout: b"all good".to_vec(),
            stderr: vec![],
        };

        cache.store(&key, &result).expect("store");

        let got = cache.lookup(&key).expect("lookup").expect("should be Some");
        assert_eq!(got.exit_code, 0);
        assert_eq!(got.stdout, b"all good");
        assert_eq!(got.stderr, Vec::<u8>::new());
    }

    // -----------------------------------------------------------------------
    // (c) with_lock: second call returns cached result without re-running f
    // -----------------------------------------------------------------------
    #[test]
    fn with_lock_deduplicates() {
        let dir = TempDir::new().expect("tempdir");
        let cache = CoalesceCache::new(dir.path());

        let argv = vec!["pytest".to_string(), "-x".to_string()];
        let key = command_key(&argv, Path::new("/repo"), &[]);

        let mut call_count = 0u32;

        // First call — f() should execute.
        let r1: CachedResult = cache
            .with_lock(&key, || {
                call_count += 1;
                Ok(CachedResult { exit_code: 42, stdout: b"run1".to_vec(), stderr: vec![] })
            })
            .expect("first with_lock");
        assert_eq!(call_count, 1, "f() must run on first call");
        assert_eq!(r1.exit_code, 42);

        // Second call — cache is populated, f() must NOT run again.
        let r2: CachedResult = cache
            .with_lock(&key, || {
                call_count += 1;
                Ok(CachedResult { exit_code: 99, stdout: b"run2".to_vec(), stderr: vec![] })
            })
            .expect("second with_lock");
        assert_eq!(call_count, 1, "f() must NOT run when cache is populated");
        assert_eq!(r2.exit_code, 42, "second call must return the cached result");
        assert_eq!(r2.stdout, b"run1");
    }
}
