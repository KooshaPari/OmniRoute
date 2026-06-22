//! SIGHUP-driven hot reload for `pheno-config` (L33 / v22-T3).
//!
//! Long-running `pheno-*` daemons need to pick up configuration
//! changes (rotated secrets, new feature flags, updated connection
//! strings) without a process restart. This module provides:
//!
//! 1. [`ConfigReloader`] — an atomic, lock-protected cache of the
//!    currently-live config. Readers see either the old or the new
//!    value, never a torn state.
//! 2. [`watch_sighup`] — a background thread that listens for
//!    `SIGHUP` (via the [`signal-hook`] crate) and reloads the
//!    config from a file on disk when the signal arrives.
//!
//! ## Wire protocol
//!
//! ```text
//! process (PID 1234)
//!   ├─ ConfigReloader::new(initial)
//!   ├─ watch_sighup(reloader, "config.toml", parse)
//!   ├─ main loop: reloader.current() -> serve request
//!   ├─ operator: kill -HUP 1234
//!   ├─ signal-hook catches SIGHUP
//!   ├─ handler reads "config.toml", parses, calls install()
//!   └─ next reloader.current() call returns the new value
//! ```
//!
//! ## Atomicity
//!
//! The internal cache is `Mutex<Arc<T>>`. Reads via
//! [`ConfigReloader::current`] lock the mutex, clone the `Arc`,
//! unlock. Each `Arc::clone` is a single atomic refcount
//! increment; a concurrent writer that swaps the inner `Arc` will
//! either see the old or the new pointer, never a half-state.
//! This is the same atomicity guarantee that the `arc-swap`
//! crate provides, but expressed in terms of the stdlib
//! primitives that fit `pheno-config`'s
//! `#![forbid(unsafe_code)]` policy.
//!
//! ## Why `Mutex`, not `Arc::swap`?
//!
//! `Arc::swap` was removed from the stdlib in recent Rust
//! versions; the safe `Arc::make_mut` route requires
//! `T: Clone` and in-place mutation, which is the wrong shape
//! for a config reload (we want a wholesale replacement, not
//! an edit). A `Mutex<Arc<T>>` is the canonical stdlib-only
//! substitute — the lock is held for a single `Arc::clone`
//! (microseconds), so contention is negligible at any realistic
//! request rate.
//!
//! ## Cross-references
//!
//! - ADR-023 (agent-effort governance) — MacBook-safe,
//!   stdlib-first; `signal-hook` is the only added dep.
//! - ADR-048 (substrate graduation) — `pheno-config` is at T3;
//!   this module does not change tier.
//! - ADR-046 (federation mTLS + OIDC) — secret rotation is a
//!   separate track (see `src/secret_rotation.rs`); hot_reload
//!   covers non-secret config.
//!
//! ## Example
//!
//! See `examples/hot_reload.rs` for a runnable daemon.

use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// A `Config` payload that is itself cheaply cloneable.
///
/// For the reload-from-disk pattern in this module, `SourcedConfig`
/// is a convenient alias for `Arc<String>`: the inner `String`
/// clones cheaply when `Arc::clone` is called, and the
/// `current()` API hands out a fresh `Arc` whose strong count
/// tracks the live readers.
pub type SourcedConfig = Arc<String>;

/// Error type for hot-reload operations.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConfigError {
    /// I/O error reading the config file (file not found,
    /// permission denied, transient FS error, ...). The previous
    /// config is retained verbatim — the daemon keeps serving the
    /// last-known-good value.
    Io(String),
    /// The file contents were syntactically valid but the parser
    /// returned an error (missing required field, out-of-range
    /// value, ...). The previous config is retained.
    Parse(String),
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ConfigError::Io(msg) => write!(f, "config I/O error: {msg}"),
            ConfigError::Parse(msg) => write!(f, "config parse error: {msg}"),
        }
    }
}

impl std::error::Error for ConfigError {}

/// Atomic, lock-protected config reloader.
///
/// The struct owns the **current** `Arc<T>` of the live config.
/// Reads via [`ConfigReloader::current`] take a brief mutex lock
/// and clone the `Arc`; writes via [`ConfigReloader::install`]
/// lock the mutex and replace the inner `Arc`. Readers see either
/// the old or the new value, never a torn state.
///
/// # Construction
///
/// ```ignore
/// use pheno_config::hot_reload::ConfigReloader;
/// let reloader = ConfigReloader::new("initial-config".to_string());
/// ```
///
/// # Reload lifecycle
///
/// 1. Caller (or the SIGHUP handler installed by [`watch_sighup`])
///    invokes [`ConfigReloader::install`] with the new `T`.
/// 2. The mutex is locked; the inner `Arc<T>` is replaced.
/// 3. Subsequent calls to [`ConfigReloader::current`] return the
///    new value.
///
/// # Failure handling
///
/// The hot-reload API itself never fails (`install` is
/// infallible). The failure path is in [`read_and_install`]: a
/// failed file read or parse returns a [`ConfigError`] and
/// leaves the previous config intact.
pub struct ConfigReloader<T> {
    /// `Mutex<Arc<T>>` — the lock is held for a single
    /// `Arc::clone` on the read path, and for a single
    /// `*guard = Arc::new(new)` on the write path. Both
    /// operations complete in microseconds.
    inner: Mutex<Arc<T>>,
}

impl<T> ConfigReloader<T> {
    /// Construct a new `ConfigReloader` wrapping `initial`.
    ///
    /// Returns `Arc<Self>` so the reloader can be cheaply cloned
    /// into reader threads and the SIGHUP-watching background
    /// thread without moving the original.
    pub fn new(initial: T) -> Arc<Self> {
        Arc::new(Self {
            inner: Mutex::new(Arc::new(initial)),
        })
    }

    /// Get a clone of the current config's `Arc`.
    ///
    /// This is the **hot-path** read: a mutex lock + an
    /// `Arc::clone` (single atomic refcount increment). Readers
    /// can call this in tight loops; the lock is held for
    /// nanoseconds.
    pub fn current(&self) -> Arc<T> {
        let guard = self
            .inner
            .lock()
            .expect("pheno-config: ConfigReloader mutex poisoned");
        Arc::clone(&guard)
    }

    /// Replace the current config with `new`.
    ///
    /// The replacement is atomic w.r.t. `current()` callers: a
    /// reader either sees the old or the new value, never a mix.
    /// The previous `Arc<T>` is dropped here (which decrements
    /// its strong count by 1; the drop of the actual `T` happens
    /// when the last `Arc<T>` goes out of scope).
    pub fn install(&self, new: T) {
        let mut guard = self
            .inner
            .lock()
            .expect("pheno-config: ConfigReloader mutex poisoned");
        *guard = Arc::new(new);
    }

    /// Returns the strong count of the inner `Arc<T>`.
    ///
    /// Test-only helper. The count is 1 (the reloader itself)
    /// plus the number of live clones handed out by
    /// [`current`](Self::current).
    #[cfg(test)]
    fn strong_count(&self) -> usize {
        Arc::strong_count(&*self.inner.lock().unwrap())
    }
}

// ---------------------------------------------------------------------------
// File reload + SIGHUP wiring
// ---------------------------------------------------------------------------

/// Read a config file, parse it with `parse`, and install the
/// result into `reloader`.
///
/// This is the "reload from disk" primitive. It is split out
/// from [`watch_sighup`] so the failure paths can be unit-tested
/// without sending a real `SIGHUP`.
///
/// # Errors
///
/// - [`ConfigError::Io`] if the file cannot be read.
/// - [`ConfigError::Parse`] if `parse` returns an error.
///
/// On error, the previous config in `reloader` is **not**
/// modified — the daemon keeps serving the last-known-good value.
pub fn read_and_install<C, F>(
    reloader: &ConfigReloader<C>,
    path: &Path,
    parse: F,
) -> Result<(), ConfigError>
where
    F: FnOnce(&str) -> Result<C, ConfigError>,
{
    let contents = std::fs::read_to_string(path)
        .map_err(|e| ConfigError::Io(format!("read {}: {e}", path.display())))?;
    let new_cfg = parse(&contents)?;
    reloader.install(new_cfg);
    Ok(())
}

/// Install a background thread that listens for `SIGHUP` and
/// reloads the config from `path` each time the signal arrives.
///
/// # Wire protocol
///
/// ```text
/// process (PID 1234)
///   ├─ let reloader = ConfigReloader::new(initial);
///   ├─ let _h = watch_sighup(reloader.clone(), "config.toml",
///   │                        |s| Ok(s.to_string()))?;
///   ├─ main loop: reloader.current() -> serve request
///   ├─ operator: kill -HUP 1234
///   ├─ signal-hook catches SIGHUP
///   ├─ handler reads "config.toml", parses, calls install()
///   └─ next reloader.current() call returns the new value
/// ```
///
/// # Unix only
///
/// `SIGHUP` is a POSIX concept; on non-Unix platforms the
/// function returns `Err(io::ErrorKind::Unsupported)`. Callers
/// in cross-platform code should treat the absence of a
/// `JoinHandle` as "SIGHUP is not available on this platform,
/// but `current()` still works."
///
/// # Failure handling
///
/// If the file read or parse fails, the handler prints a
/// diagnostic to stderr and returns; the previous config in
/// `reloader` is **not** modified. The daemon continues serving
/// the last-known-good value.
///
/// # Arguments
///
/// - `reloader` — the reloader to drive. Cloned internally; the
///   caller retains ownership.
/// - `path` — the file to read on each `SIGHUP`.
/// - `parse` — a closure that turns the file contents into a `C`.
///   Should be cheap to call (µs–ms) and `Send + Sync + 'static`
///   because it runs on a background thread.
///
/// # Returns
///
/// A `JoinHandle<()>` for the watcher thread. The thread runs
/// forever; the caller can drop the handle (the thread is
/// detached) or call `.join()` during graceful shutdown.
#[cfg(unix)]
pub fn watch_sighup<C, F, P>(
    reloader: Arc<ConfigReloader<C>>,
    path: P,
    parse: F,
) -> io::Result<JoinHandle<()>>
where
    C: Send + Sync + 'static,
    F: Fn(&str) -> Result<C, ConfigError> + Send + Sync + 'static,
    P: Into<PathBuf>,
{
    use signal_hook::consts::signal::SIGHUP;
    use signal_hook::iterator::Signals;

    let path = path.into();
    let mut signals = Signals::new([SIGHUP])?;
    thread::Builder::new()
        .name("pheno-config-sighup".to_string())
        .spawn(move || {
            for _sig in signals.forever() {
                if let Err(e) = read_and_install(&reloader, &path, &parse) {
                    eprintln!(
                        "pheno-config hot_reload: SIGHUP handler: {e} \
                         (keeping previous config)"
                    );
                }
            }
        })
}

/// Non-Unix stub. Returns `Err(Unsupported)`. See the Unix
/// version for the real implementation.
#[cfg(not(unix))]
pub fn watch_sighup<C, F, P>(
    _reloader: Arc<ConfigReloader<C>>,
    _path: P,
    _parse: F,
) -> io::Result<JoinHandle<()>>
where
    C: Send + Sync + 'static,
    F: Fn(&str) -> Result<C, ConfigError> + Send + Sync + 'static,
    P: Into<PathBuf>,
{
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "pheno-config hot_reload: SIGHUP is Unix-only",
    ))
}

// ---------------------------------------------------------------------------
// Unit tests (6 required by v22-T3 brief)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering as AtomicOrdering};

    /// **Unit test 1**: `current()` returns the initial config.
    /// The simplest possible smoke test — the reloader can be
    /// constructed and `current()` returns the value passed to
    /// `new()`.
    #[test]
    fn current_returns_initial_config() {
        let reloader = ConfigReloader::new("v0".to_string());
        let got = reloader.current();
        assert_eq!(*got, "v0");
        // After `current()`, two Arcs share the same allocation:
        //   - one inside `reloader.inner`
        //   - the one bound to `got`
        // `Arc::strong_count(&got)` reports both (compare test 3
        // below, which exercises the same invariant with multiple
        // clones).
        assert_eq!(Arc::strong_count(&got), 2, "1 inside + 1 live clone");
    }

    /// **Unit test 2**: `install()` replaces the current config.
    /// After `install(new)`, `current()` returns `new`.
    #[test]
    fn install_replaces_current() {
        let reloader = ConfigReloader::new("v0".to_string());
        assert_eq!(*reloader.current(), "v0");

        reloader.install("v1".to_string());
        assert_eq!(*reloader.current(), "v1");

        reloader.install("v2".to_string());
        assert_eq!(*reloader.current(), "v2");
    }

    /// **Unit test 3**: `current()` returns clones that share
    /// the inner `Arc`. The strong count tracks the number of
    /// live clones handed out — this is the property that lets
    /// readers hold the config for the lifetime of a request
    /// without blocking writers.
    #[test]
    fn current_returns_clone_with_incremented_strong_count() {
        let reloader = ConfigReloader::new(SourcedConfig::new("only".to_string()));

        let a = reloader.current();
        let b = reloader.current();
        let c = reloader.current();
        assert_eq!(Arc::strong_count(&a), 4, "1 inside + 3 clones");

        drop(a);
        drop(b);
        assert_eq!(Arc::strong_count(&c), 2, "1 inside + 1 clone");

        drop(c);
        assert_eq!(reloader.strong_count(), 1, "just the one inside");
    }

    /// **Unit test 4**: `read_and_install` reads the file and
    /// installs the parsed value. This is the happy path for
    /// the SIGHUP-triggered reload.
    #[test]
    fn read_and_install_reads_file_and_updates_reloader() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("config.toml");
        std::fs::write(&path, "v1\n").expect("write config.toml");

        let reloader = ConfigReloader::new("initial".to_string());
        read_and_install(&reloader, &path, |s| Ok(s.trim().to_string()))
            .expect("read_and_install must succeed");
        assert_eq!(*reloader.current(), "v1");

        // Update the file; simulate a second SIGHUP.
        std::fs::write(&path, "v2\n").expect("rewrite config.toml");
        read_and_install(&reloader, &path, |s| Ok(s.trim().to_string()))
            .expect("read_and_install must succeed");
        assert_eq!(*reloader.current(), "v2");
    }

    /// **Unit test 5**: a failed file read leaves the previous
    /// config intact. The error path must not corrupt the live
    /// state — the daemon keeps serving the last-known-good
    /// value until the operator fixes the file.
    #[test]
    fn read_and_install_failed_read_keeps_previous() {
        let dir = tempfile::tempdir().expect("tempdir");
        let missing_path = dir.path().join("does-not-exist.toml");

        let reloader = ConfigReloader::new("previous".to_string());
        let result = read_and_install(&reloader, &missing_path, |s| {
            Ok(s.trim().to_string())
        });
        assert!(matches!(result, Err(ConfigError::Io(_))));
        assert_eq!(*reloader.current(), "previous");
    }

    /// **Unit test 6**: a failed parse leaves the previous
    /// config intact. The parser is the operator's seam for
    /// validation; if it rejects the new file, we keep serving
    /// the old one.
    #[test]
    fn read_and_install_failed_parse_keeps_previous() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path = dir.path().join("config.toml");
        std::fs::write(&path, "garbage that the parser rejects\n").expect("write");

        let reloader = ConfigReloader::new("previous".to_string());
        let parse_calls = Arc::new(AtomicUsize::new(0));
        let parse_calls_for_fn = Arc::clone(&parse_calls);
        let result = read_and_install(&reloader, &path, move |_s| {
            parse_calls_for_fn.fetch_add(1, AtomicOrdering::AcqRel);
            Err(ConfigError::Parse("synthetic failure".into()))
        });
        assert!(matches!(result, Err(ConfigError::Parse(_))));
        assert_eq!(*reloader.current(), "previous");
        assert_eq!(parse_calls.load(AtomicOrdering::Acquire), 1);
    }
}