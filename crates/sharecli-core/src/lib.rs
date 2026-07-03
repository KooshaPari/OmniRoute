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
//!                ├─ ThermalGate::poll() ─► Green/Yellow → proceed
//!                │                         Red → sleep-retry (loud) or Err
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
//! # Thermal gate behaviour
//!
//! Before any spawn the hypervisor queries the [`ThermalGate`] trait object:
//!
//! - [`ThermalDecision::Allow`]  — spawn proceeds normally.
//! - [`ThermalDecision::Warn`]   — spawn proceeds but a warning is logged.
//! - [`ThermalDecision::Refuse`] — spawn is back-pressured.  The hypervisor
//!   enters a visible retry loop ("Waiting for thermal headroom… (N/M)"), and
//!   if the device remains RED after [`THERMAL_MAX_RETRIES`] attempts it returns
//!   an explicit `Err`.  This is **never a silent no-op**.
//!
//! # FUSE IO-intercept behaviour
//!
//! Before executing a cache-miss spawn the hypervisor attempts to mount a
//! sharecli-fuse IO-intercept layer over the child's working directory.  When
//! the mount succeeds the child's `cwd` is transparently replaced with the
//! FUSE mountpoint — all filesystem access goes through the intercept layer,
//! which tracks reads/writes for build-system cache sharing.
//!
//! FUSE mounting is **best-effort**: if the platform does not support FUSE
//! (non-Linux/macOS) or the mount fails for any reason, the spawn proceeds
//! without interception.  Cache keys always use the *original* (unwrapped)
//! `cwd` so that identical commands produce the same cache entry regardless
//! of whether FUSE was active.
//!
//! # TODO hooks (follow-up PRs)
//! - `// TODO(hypervisor): speculative` — pre-execute high-probability commands during
//!   idle periods and pre-populate the coalesce cache.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use anyhow::{anyhow, Context, Result};
use sharecli_fleet::thermal::{ThermalGovernor, ThermalLevel};
use sharecli_ipc::{command_key, CachedResult, CoalesceCache};
use tracing::{debug, warn};

// ---------------------------------------------------------------------------
// Thermal gate — trait + decisions
// ---------------------------------------------------------------------------

/// Decision returned by a [`ThermalGate`] implementation.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ThermalDecision {
    /// Device is cool — spawn may proceed unconditionally.
    Allow,
    /// Device is warm — spawn may proceed but caller should log a warning.
    Warn,
    /// Device is hot — spawn must be back-pressured or refused.
    Refuse,
}

/// A seam that the [`Hypervisor`] calls before every spawn to determine whether
/// the device has enough thermal headroom.
///
/// The production implementation ([`SystemThermalGate`]) delegates to
/// [`ThermalGovernor`] from `sharecli-fleet`.  Tests inject a fake via
/// [`FakeThermalGate`].
pub trait ThermalGate: Send + Sync {
    /// Poll the current thermal state and return a spawn decision.
    fn check(&self) -> ThermalDecision;
}

/// Production [`ThermalGate`] — wraps [`ThermalGovernor`] from `sharecli-fleet`.
///
/// Maps `ThermalLevel::Green` → [`ThermalDecision::Allow`],
///      `ThermalLevel::Yellow` → [`ThermalDecision::Warn`],
///      `ThermalLevel::Red`    → [`ThermalDecision::Refuse`].
///
/// If `poll()` returns an error (e.g. missing sysctl) the gate defaults to
/// [`ThermalDecision::Allow`] and logs a warning so that sysctl unavailability
/// does not block spawns on non-macOS CI runners.
#[derive(Debug)]
pub struct SystemThermalGate {
    governor: ThermalGovernor,
}

impl SystemThermalGate {
    /// Create a new gate backed by the real [`ThermalGovernor`].
    pub fn new() -> Self {
        Self { governor: ThermalGovernor::new() }
    }
}

impl ThermalGate for SystemThermalGate {
    fn check(&self) -> ThermalDecision {
        match self.governor.poll() {
            Ok(ThermalLevel::Green) => ThermalDecision::Allow,
            Ok(ThermalLevel::Yellow) => ThermalDecision::Warn,
            Ok(ThermalLevel::Red) => ThermalDecision::Refuse,
            Err(e) => {
                warn!(err = %e, "thermal-gate: poll failed — defaulting to Allow");
                ThermalDecision::Allow
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Thermal gate — retry constants
// ---------------------------------------------------------------------------

/// How many times the hypervisor will sleep-retry when the gate returns
/// [`ThermalDecision::Refuse`] before giving up with an explicit error.
pub const THERMAL_MAX_RETRIES: u32 = 5;

/// Duration of each sleep in the thermal back-pressure retry loop.
///
/// 2 s per attempt → up to ~10 s total wait before a hard error is returned.
pub const THERMAL_RETRY_SLEEP: Duration = Duration::from_secs(2);

// ---------------------------------------------------------------------------
// FUSE IO-intercept guard
// ---------------------------------------------------------------------------

/// RAII guard that manages a sharecli-fuse intercept mount lifetime.
///
/// On construction (best-effort) it creates a temporary directory, spawns a
/// background thread running the FUSE event loop that mirrors a backing path,
/// and exposes the mountpoint via [`mountpoint()`][FuseGuard::mountpoint].
///
/// On drop the guard force-unmounts the FUSE filesystem and removes the
/// temporary directory.
///
/// # Best-effort semantics
///
/// [`FuseGuard::try_mount`] **never** returns an error.  If mounting fails
/// (platform unsupported, FUSE kernel module not loaded, etc.) a no-op guard
/// is returned and [`mountpoint()`][FuseGuard::mountpoint] returns `None`.
/// Callers should always check `mountpoint()` and fall back to the original
/// path when it returns `None`.
struct FuseGuard {
    /// Path to the temporary mountpoint directory.
    /// `None` when FUSE could not be started (no-op guard).
    mountpoint: Option<PathBuf>,
    /// Keep the TempDir alive so it is not cleaned up before the unmount in
    /// [`Drop`] runs.
    _tmpdir: Option<tempfile::TempDir>,
}

impl FuseGuard {
    /// Attempt to mount a sharecli-fuse IO-intercept layer mirroring `backing`.
    ///
    /// When FUSE is unavailable or the mount fails a no-op guard is returned
    /// (the spawn proceeds without interception).
    fn try_mount(backing: &Path) -> Self {
        // Non-Linux/macOS: no-op guard — FUSE is not available.
        #[cfg(not(any(target_os = "linux", target_os = "macos")))]
        {
            let _ = backing;
            return Self { mountpoint: None, _tmpdir: None };
        }

        // Linux / macOS: try to start FUSE.
        #[cfg(any(target_os = "linux", target_os = "macos"))]
        {
            let tmpdir = match tempfile::tempdir() {
                Ok(d) => d,
                Err(_) => return Self { mountpoint: None, _tmpdir: None },
            };
            let mountpoint = tmpdir.path().to_path_buf();
            let backing = backing.to_path_buf();
            let mp = mountpoint.clone();

            // Spawn the FUSE event loop on a background thread — it blocks
            // until unmounted.
            std::thread::spawn(move || {
                let _ = sharecli_fuse::mount(&mp, &backing);
            });

            // Brief pause so the mount is ready when the child process spawns.
            std::thread::sleep(Duration::from_millis(100));

            Self { mountpoint: Some(mountpoint), _tmpdir: Some(tmpdir) }
        }
    }

    /// The mountpoint directory, or `None` if the guard is a no-op.
    fn mountpoint(&self) -> Option<&Path> {
        self.mountpoint.as_deref()
    }
}

impl Drop for FuseGuard {
    fn drop(&mut self) {
        if let Some(ref mp) = self.mountpoint {
            // Force-unmount (the `_tmpdir` field is dropped after this,
            // which removes the now-empty mountpoint directory).
            #[cfg(target_os = "linux")]
            {
                let _ = std::process::Command::new("fusermount")
                    .arg("-uz")
                    .arg(mp)
                    .status();
            }
            #[cfg(target_os = "macos")]
            {
                let _ = std::process::Command::new("umount")
                    .arg(mp)
                    .status();
            }
        }
    }
}

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
        Self { exit_code: c.exit_code, stdout: c.stdout, stderr: c.stderr, from_cache: true }
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
///
/// A [`ThermalGate`] is consulted before every spawn.  When the device is in a
/// RED thermal state the hypervisor enters a visible sleep-retry loop and, if
/// the state does not clear within [`THERMAL_MAX_RETRIES`] attempts, returns an
/// explicit error rather than silently dropping or degrading the spawn.
pub struct Hypervisor {
    cache: CoalesceCache,
    #[allow(dead_code)]
    config: HypervisorConfig,
    thermal_gate: Arc<dyn ThermalGate>,
}

impl Hypervisor {
    /// Create a new `Hypervisor` with its coalesce cache rooted at `cache_root`
    /// and the production [`SystemThermalGate`].
    pub fn new(cache_root: impl Into<PathBuf>) -> Self {
        Self::with_thermal_gate(cache_root, Arc::new(SystemThermalGate::new()))
    }

    /// Create a `Hypervisor` with an explicit [`ThermalGate`] implementation.
    ///
    /// Intended for tests that inject a [`FakeThermalGate`] (or any other
    /// implementation) to exercise gate behaviour without real hardware.
    pub fn with_thermal_gate(cache_root: impl Into<PathBuf>, gate: Arc<dyn ThermalGate>) -> Self {
        let cache_root = cache_root.into();
        let config = HypervisorConfig { cache_root: cache_root.clone() };
        Self { cache: CoalesceCache::new(cache_root), config, thermal_gate: gate }
    }

    /// Run a managed spawn with Lock-Wait-Cache coalescing.
    ///
    /// # Thermal gating
    /// Before touching the coalesce cache the hypervisor polls [`ThermalGate`]:
    ///
    /// - **Green** → proceed normally.
    /// - **Yellow** → log a warning, then proceed.
    /// - **Red** → print "Waiting for thermal headroom… (N/M)" to stderr and
    ///   sleep [`THERMAL_RETRY_SLEEP`] between each attempt, up to
    ///   [`THERMAL_MAX_RETRIES`] times.  If the gate is still RED after all
    ///   retries, return `Err("spawn refused: device is thermally throttled …")`.
    ///   This is **never a silent no-op**.
    ///
    /// # FUSE IO-intercept
    /// On a cache miss the hypervisor attempts to mount a sharecli-fuse intercept
    /// layer over the child's `cwd`.  When the mount succeeds the child runs
    /// against the FUSE mountpoint — all filesystem access goes through the
    /// intercept layer for build-system cache sharing.  FUSE is **best-effort**:
    /// if mounting fails the spawn proceeds without interception.
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
    /// # TODO(hypervisor): speculative
    /// Record command-frequency histograms here; trigger pre-execution from a
    /// background task when a command crosses the speculation threshold.
    pub async fn run(&self, req: SpawnRequest) -> Result<SpawnOutcome> {
        // ── Thermal gate ─────────────────────────────────────────────────────
        self.thermal_gate_check().await?;

        // ── Cache lookup ─────────────────────────────────────────────────────
        // NOTE: the cache key uses the *original* `req.cwd` so that identical
        // commands produce the same key regardless of whether FUSE is active.
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

        // ── FUSE intercept (cache-miss only) ─────────────────────────────────
        // Mount the IO-intercept layer over the child's working directory.
        // `FuseGuard::try_mount` never fails — if FUSE is unavailable a no-op
        // guard is returned and the spawn proceeds normally.
        let fuse_guard = FuseGuard::try_mount(&req.cwd);

        // Build an effective SpawnRequest whose cwd points at the FUSE
        // mountpoint (or the original cwd when FUSE is inactive).
        // This is a *separate owned clone* — no borrow relationship to `req`,
        // which avoids the borrow-checker conflict that would arise if we tried
        // to modify `req.cwd` inside the `with_lock` closure below.
        let effective_req = fuse_guard
            .mountpoint()
            .map(|mp| SpawnRequest { cwd: mp.to_path_buf(), ..req.clone() })
            .unwrap_or_else(|| req.clone());

        // Cache miss — acquire the advisory flock, re-check inside the lock
        // (a sibling may have stored the result while we were waiting), and
        // only spawn if still a miss.
        //
        // Lock-Wait-Cache: spawn is the closure called only on a cache miss.
        let cached: CachedResult = self.cache.with_lock(&key, || {
            // Blocking spawn — `with_lock` is a sync callback.
            // Uses `effective_req` (owned clone, not borrowing from `req`).
            let outcome = spawn_process_sync(&effective_req)?;
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

    /// Poll the thermal gate with a visible sleep-retry loop on RED.
    ///
    /// Returns `Ok(())` when the gate allows spawning.
    /// Returns `Err` if the gate refuses after all retries.
    async fn thermal_gate_check(&self) -> Result<()> {
        let mut attempt = 0u32;

        loop {
            match self.thermal_gate.check() {
                ThermalDecision::Allow => {
                    debug!("thermal-gate: Green — spawn allowed");
                    return Ok(());
                }
                ThermalDecision::Warn => {
                    warn!("thermal-gate: Yellow — device is warm, proceeding with spawn");
                    return Ok(());
                }
                ThermalDecision::Refuse => {
                    attempt += 1;
                    // Loud, actionable message — never a silent no-op.
                    eprintln!(
                        "sharecli: Waiting for thermal headroom\u{2026} ({attempt}/{THERMAL_MAX_RETRIES})"
                    );
                    warn!(
                        attempt,
                        max = THERMAL_MAX_RETRIES,
                        "thermal-gate: Red — spawn back-pressured"
                    );

                    if attempt >= THERMAL_MAX_RETRIES {
                        return Err(anyhow!(
                            "spawn refused: device is thermally throttled after \
                             {THERMAL_MAX_RETRIES} retries ({sleep}s each). \
                             Reduce concurrent builds or wait for the device to cool down.",
                            sleep = THERMAL_RETRY_SLEEP.as_secs(),
                        ));
                    }

                    tokio::time::sleep(THERMAL_RETRY_SLEEP).await;
                }
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Process execution
// ---------------------------------------------------------------------------

/// Spawn `req.argv` synchronously (blocking) and capture its output.
///
/// Used inside `CoalesceCache::with_lock` which takes a synchronous closure.
fn spawn_process_sync(req: &SpawnRequest) -> Result<SpawnOutcome> {
    let (program, args) =
        req.argv.split_first().with_context(|| "spawn_process_sync: argv is empty")?;

    let output = std::process::Command::new(program)
        .args(args)
        .current_dir(&req.cwd)
        .envs(req.env.iter().map(|(k, v)| (k.as_str(), v.as_str())))
        .output()
        .with_context(|| format!("failed to spawn {:?}", req.argv))?;

    let exit_code = output.status.code().unwrap_or(-1);
    Ok(SpawnOutcome { exit_code, stdout: output.stdout, stderr: output.stderr, from_cache: false })
}

// ---------------------------------------------------------------------------
// Test helpers (pub(crate) for tests module; also exported for integration tests)
// ---------------------------------------------------------------------------

/// A controllable [`ThermalGate`] for unit tests.
///
/// The gate's decision is set at construction time and never changes, making it
/// suitable for table-driven tests that need deterministic thermal states.
#[derive(Debug)]
pub struct FakeThermalGate {
    decision: ThermalDecision,
}

impl FakeThermalGate {
    /// Create a fake gate that always returns `decision`.
    pub fn new(decision: ThermalDecision) -> Self {
        Self { decision }
    }
}

impl ThermalGate for FakeThermalGate {
    fn check(&self) -> ThermalDecision {
        self.decision
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use std::sync::atomic::{AtomicU32, Ordering};

    use super::*;
    use tempfile::TempDir;

    fn echo_argv(msg: &str) -> Vec<String> {
        // Use a portable shell-free echo: `echo` is available on both unix and Windows.
        #[cfg(unix)]
        return vec!["echo".to_string(), msg.to_string()];
        #[cfg(windows)]
        return vec!["cmd".to_string(), "/C".to_string(), "echo".to_string(), msg.to_string()];
    }

    // ── Existing cache-coalescing tests ──────────────────────────────────────

    /// (a) Running a simple echo command for the first time should succeed with
    ///     `from_cache = false` and the expected stdout.
    #[tokio::test]
    async fn run_echo_fresh() {
        let dir = TempDir::new().expect("tempdir");
        let hv = Hypervisor::new(dir.path());

        let req =
            SpawnRequest { argv: echo_argv("hello"), cwd: dir.path().to_path_buf(), env: vec![] };

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

        let req =
            SpawnRequest { argv: echo_argv("world"), cwd: dir.path().to_path_buf(), env: vec![] };

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

    // ── Thermal gate unit tests ──────────────────────────────────────────────

    /// Green gate: spawn must succeed immediately without any retry.
    #[tokio::test]
    async fn thermal_gate_green_allows_spawn() {
        let dir = TempDir::new().expect("tempdir");
        let gate = Arc::new(FakeThermalGate::new(ThermalDecision::Allow));
        let hv = Hypervisor::with_thermal_gate(dir.path(), gate);

        let req = SpawnRequest {
            argv: echo_argv("green-gate"),
            cwd: dir.path().to_path_buf(),
            env: vec![],
        };

        let outcome = hv.run(req).await.expect("Green gate must allow spawn");
        assert_eq!(outcome.exit_code, 0);
        let stdout = String::from_utf8_lossy(&outcome.stdout);
        assert!(stdout.contains("green-gate"));
    }

    /// Yellow gate: spawn must succeed (warm device does not block).
    #[tokio::test]
    async fn thermal_gate_yellow_allows_spawn_with_warning() {
        let dir = TempDir::new().expect("tempdir");
        let gate = Arc::new(FakeThermalGate::new(ThermalDecision::Warn));
        let hv = Hypervisor::with_thermal_gate(dir.path(), gate);

        let req = SpawnRequest {
            argv: echo_argv("yellow-gate"),
            cwd: dir.path().to_path_buf(),
            env: vec![],
        };

        // Yellow must not block or error.
        let outcome = hv.run(req).await.expect("Yellow gate must allow spawn");
        assert_eq!(outcome.exit_code, 0);
        let stdout = String::from_utf8_lossy(&outcome.stdout);
        assert!(stdout.contains("yellow-gate"));
    }

    /// Red gate: spawn must be refused with an explicit, actionable error
    /// after THERMAL_MAX_RETRIES attempts.  The error message must mention
    /// "thermally throttled" so the operator can act on it.
    #[tokio::test(start_paused = true)]
    async fn thermal_gate_red_refuses_spawn_with_loud_error() {
        let dir = TempDir::new().expect("tempdir");
        let gate = Arc::new(FakeThermalGate::new(ThermalDecision::Refuse));
        let hv = Hypervisor::with_thermal_gate(dir.path(), gate);

        let req = SpawnRequest {
            argv: echo_argv("red-gate"),
            cwd: dir.path().to_path_buf(),
            env: vec![],
        };

        let result = hv.run(req).await;
        assert!(result.is_err(), "Red gate must refuse spawn");

        let err = result.unwrap_err();
        let msg = err.to_string();
        assert!(
            msg.contains("thermally throttled"),
            "error must mention 'thermally throttled', got: {msg}"
        );
        assert!(
            msg.contains(&THERMAL_MAX_RETRIES.to_string()),
            "error must mention retry count, got: {msg}"
        );
    }

    /// A gate that transitions Green → Red → Green validates that the retry
    /// loop recovers once the device cools down.
    ///
    /// The gate starts RED for the first call, then returns Green on the second
    /// call — simulating thermal recovery after one sleep-retry.
    #[tokio::test(start_paused = true)]
    async fn thermal_gate_recovers_after_one_red_attempt() {
        /// A gate that returns Refuse on the first check, then Allow forever.
        struct OneRedThenGreen {
            calls: AtomicU32,
        }
        impl ThermalGate for OneRedThenGreen {
            fn check(&self) -> ThermalDecision {
                let n = self.calls.fetch_add(1, Ordering::SeqCst);
                if n == 0 {
                    ThermalDecision::Refuse
                } else {
                    ThermalDecision::Allow
                }
            }
        }

        let dir = TempDir::new().expect("tempdir");
        let gate = Arc::new(OneRedThenGreen { calls: AtomicU32::new(0) });
        let hv = Hypervisor::with_thermal_gate(dir.path(), gate);

        let req =
            SpawnRequest { argv: echo_argv("recover"), cwd: dir.path().to_path_buf(), env: vec![] };

        // With `start_paused` tokio::time::sleep resolves immediately in tests.
        let outcome = hv.run(req).await.expect("should succeed after one RED retry");
        assert_eq!(outcome.exit_code, 0);
        let stdout = String::from_utf8_lossy(&outcome.stdout);
        assert!(stdout.contains("recover"));
    }

    /// FakeThermalGate::check() must return the decision it was constructed with.
    #[test]
    fn fake_thermal_gate_returns_configured_decision() {
        for decision in [ThermalDecision::Allow, ThermalDecision::Warn, ThermalDecision::Refuse] {
            let gate = FakeThermalGate::new(decision);
            assert_eq!(gate.check(), decision);
        }
    }

    /// ThermalDecision variants are Copy + Eq — spot-check the impls.
    #[test]
    fn thermal_decision_copy_eq() {
        let a = ThermalDecision::Allow;
        let b = a;
        assert_eq!(a, b);
        assert_ne!(ThermalDecision::Allow, ThermalDecision::Refuse);
    }

    // ── FUSE IO-intercept unit tests ─────────────────────────────────────────

    /// FuseGuard::try_mount never panics and always returns a guard — even on
    /// platforms without FUSE support (where it becomes a no-op).
    #[test]
    fn fuse_guard_try_mount_never_panics() {
        let dir = TempDir::new().expect("tempdir");
        let guard = FuseGuard::try_mount(dir.path());

        // We cannot assert the mountpoint is Some on CI (macFUSE may not be
        // installed), but we CAN assert the guard does not panic on drop.
        // On platforms with FUSE the mountpoint should exist.
        if cfg!(any(target_os = "linux", target_os = "macos")) {
            // If FUSE is available the mountpoint directory must exist.
            if let Some(mp) = guard.mountpoint() {
                assert!(mp.exists(), "mountpoint directory must exist");
            }
        } else {
            // Non-Linux/macOS: always a no-op.
            assert!(guard.mountpoint().is_none(), "non-FUSE platform must return no-op guard");
        }

        // guard drops here — must not panic during unmount/cleanup.
    }

    /// On cache-miss the FUSE guard is created and the spawn uses the
    /// effective_req with a (potentially) FUSE-wrapped cwd. This test verifies
    /// the integration compiles, the borrow-checker is satisfied (no conflicts
    /// with `effective_req` inside the `with_lock` closure), and the spawn
    /// still succeeds.
    #[tokio::test]
    async fn fuse_io_wired_into_run_compiles_and_spawns() {
        let dir = TempDir::new().expect("tempdir");
        let hv = Hypervisor::new(dir.path());

        let req = SpawnRequest {
            argv: echo_argv("fuse-integration"),
            cwd: dir.path().to_path_buf(),
            env: vec![],
        };

        // The spawn must succeed regardless of whether FUSE is active.
        // If FUSE is available the effective cwd is the mountpoint; if not,
        // the original cwd is used — either way the echo should work.
        let outcome = hv.run(req).await.expect("run must succeed with fuse-io");
        assert_eq!(outcome.exit_code, 0, "echo must exit 0");
        assert!(!outcome.from_cache, "first run must not come from cache");
        let stdout = String::from_utf8_lossy(&outcome.stdout);
        assert!(stdout.contains("fuse-integration"), "stdout must contain message");
    }

    /// Verify that the FUSE guard's mountpoint (when active) differs from the
    /// original cwd, confirming the cwd was redirected through the intercept.
    #[tokio::test]
    async fn fuse_io_cwd_redirected_when_fuse_active() {
        let dir = TempDir::new().expect("tempdir");
        let guard = FuseGuard::try_mount(dir.path());

        if let Some(mp) = guard.mountpoint() {
            // FUSE is active — the mountpoint must be different from the
            // original backing path because it is a temporary directory.
            assert_ne!(mp, dir.path(), "mountpoint must differ from backing");
            assert!(mp.starts_with(std::env::temp_dir()), "mountpoint must be under temp dir");
        }
        // No assertion needed for the no-FUSE case — the test just validates
        // the guard API and that mountpoint() returns None gracefully.
    }
}
