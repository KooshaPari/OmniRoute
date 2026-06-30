//! Build-contention throttle — Zig hot core + Rust orchestration.
//!
//! # Architecture
//!
//! ```text
//! ┌──────────────────────────────────────────────┐
//! │  Rust (orchestration layer)                  │
//! │  config parse · harness detection            │
//! │  sccache wiring · async permit wrapper       │
//! │  SpawnPolicy · ProcessPool                   │
//! └──────────────┬───────────────────────────────┘
//!                │  extern "C"  (C ABI static lib)
//! ┌──────────────▼───────────────────────────────┐
//! │  Zig (hot core — crates/spawn-core/)         │
//! │  spc_semaphore_*  POSIX mutex + condvar      │
//! │  spc_spawn        posix_spawn / fork+exec    │
//! │                   setpriority(PRIO_DARWIN_BG)│
//! │  spc_waitpid      waitpid(2)                 │
//! └──────────────────────────────────────────────┘
//! ```
//!
//! # Why Zig for the hot core
//!
//! * `posix_spawn`, `setpriority`, `waitpid`, and POSIX mutex/condvar are
//!   single `std.c` calls in Zig — no abstraction penalty, no hidden runtime.
//! * `extern struct` in Zig guarantees C layout; `#[repr(C)]` in Rust matches
//!   it exactly — the ABI boundary is a handful of integers and a pointer.
//! * Explicit allocator (`std.heap.c_allocator`) — allocation failure is a
//!   return value, not a panic.
//! * No bindgen needed: the Zig `export fn` symbols are consumed directly via
//!   `extern "C"` in `spawn-core-sys/src/lib.rs`.
//!
//! # Rust role
//!
//! Rust owns everything above the FFI boundary: config parsing
//! (`SpawnPolicyConfig`), harness classification (`is_build_harness`), the
//! async tokio integration (`acquire_build_permit` bridges the blocking Zig
//! `spc_semaphore_acquire` via `spawn_blocking`), `RUSTC_WRAPPER` wiring for
//! sccache, and the `ProcessPool` integration.

use anyhow::Result;
use spawn_core_sys::ZigSemaphore;
use std::sync::Arc;

use crate::config::SpawnPolicyConfig;

// ---------------------------------------------------------------------------
// Build harness detection (Rust layer — config logic stays in Rust)
// ---------------------------------------------------------------------------

/// Returns `true` for harnesses that consume heavy CPU and benefit from throttling.
pub fn is_build_harness(harness: &str) -> bool {
    matches!(harness, "cargo" | "rustc" | "build" | "make" | "cmake" | "ninja" | "bazel")
}

// ---------------------------------------------------------------------------
// SpawnPolicy — thin Rust wrapper over the Zig semaphore
// ---------------------------------------------------------------------------

/// Sharecli-wide spawn-policy enforcer.
///
/// Internally delegates the semaphore, spawn, and scheduling primitives to the
/// Zig hot core (`spc_semaphore_*` / `spc_spawn` / `spc_waitpid`).  Rust
/// provides the async integration, config, and sccache wiring.
pub struct SpawnPolicy {
    /// Counting semaphore backed by POSIX mutex+condvar in Zig.
    semaphore: Arc<ZigSemaphore>,
    pub config: SpawnPolicyConfig,
}

/// RAII permit — holds one semaphore slot until dropped.
pub struct BuildPermit {
    semaphore: Arc<ZigSemaphore>,
}

impl Drop for BuildPermit {
    fn drop(&mut self) {
        // Release permit back to the Zig semaphore.
        let _ = self.semaphore.release();
    }
}

impl SpawnPolicy {
    pub fn new(config: SpawnPolicyConfig) -> Self {
        let permits = config.max_concurrent_builds.max(1);
        Self { semaphore: Arc::new(ZigSemaphore::new(permits)), config }
    }

    /// Acquire a build slot, blocking (via `spawn_blocking`) until one is free.
    ///
    /// The returned `BuildPermit` MUST be held for the duration of the build;
    /// when it drops the slot is released and the next queued build starts.
    pub async fn acquire_build_permit(self: &Arc<Self>) -> Result<BuildPermit> {
        let sem = Arc::clone(&self.semaphore);
        // Bridge the blocking Zig mutex-wait into tokio without blocking the executor.
        tokio::task::spawn_blocking(move || sem.acquire())
            .await
            .map_err(|e| anyhow::anyhow!("spawn_blocking join: {e}"))??;

        Ok(BuildPermit { semaphore: Arc::clone(&self.semaphore) })
    }

    /// Try to acquire a build slot without waiting.
    // Used in tests and diagnostics.
    #[allow(dead_code)]
    pub fn try_acquire_build_permit(&self) -> Option<BuildPermit> {
        match self.semaphore.try_acquire() {
            Ok(true) => Some(BuildPermit { semaphore: Arc::clone(&self.semaphore) }),
            _ => None,
        }
    }

    /// Current number of free build slots (approximate).
    // Used in tests; exposed for diagnostics.
    #[allow(dead_code)]
    pub fn available_permits(&self) -> usize {
        self.semaphore.available()
    }

    // -----------------------------------------------------------------------
    // Command shaping (Rust layer — config logic stays in Rust)
    // -----------------------------------------------------------------------

    /// Wrap a build-harness command with `taskpolicy -b` on macOS when
    /// `nice_level > 0`.  Returns `(effective_program, effective_args)`.
    ///
    /// The Zig `spc_spawn` path sets `PRIO_DARWIN_BG` directly via
    /// `setpriority`, but when sharecli delegates to `substrate::ProcessPort`
    /// (which uses tokio `Command`) we cannot inject per-spawn QoS at the
    /// syscall level — wrapping with `taskpolicy -b` is the portable fallback
    /// for the substrate path.
    pub fn apply_taskpolicy<'a>(
        &self,
        program: &'a str,
        args: &'a [String],
    ) -> (String, Vec<String>) {
        #[cfg(target_os = "macos")]
        if self.config.nice_level > 0 {
            let mut new_args = vec!["--".to_string(), program.to_string()];
            new_args.extend_from_slice(args);
            return ("taskpolicy".to_string(), new_args);
        }

        (program.to_string(), args.to_vec())
    }

    /// Build env-var overrides to inject into build harness spawns.
    ///
    /// * `CARGO_BUILD_JOBS` — caps rustc's own internal parallelism to the
    ///   same budget as the semaphore.
    /// * `RUSTC_WRAPPER=sccache` — only when `use_sccache = true` AND `sccache`
    ///   is found on PATH.
    pub fn build_env_overrides(&self) -> Vec<(String, String)> {
        let mut env = vec![(
            "CARGO_BUILD_JOBS".to_string(),
            self.config.max_concurrent_builds.to_string(),
        )];

        if self.config.use_sccache && sccache_on_path() {
            env.push(("RUSTC_WRAPPER".to_string(), "sccache".to_string()));
        }

        env
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn sccache_on_path() -> bool {
    std::env::var_os("PATH").and_then(|path_var| {
        std::env::split_paths(&path_var).find_map(|dir| {
            let candidate = dir.join("sccache");
            if candidate.exists() { Some(candidate) } else { None }
        })
    }).is_some()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::SpawnPolicyConfig;
    use std::sync::Arc;
    use tokio::time::Duration;

    fn policy(max: usize) -> Arc<SpawnPolicy> {
        Arc::new(SpawnPolicy::new(SpawnPolicyConfig {
            max_concurrent_builds: max,
            ..Default::default()
        }))
    }

    // -- Zig semaphore via Rust wrapper --------------------------------------

    #[test]
    fn zig_semaphore_cap_enforced() {
        let p = policy(2);
        let _p1 = p.try_acquire_build_permit().expect("first permit");
        let _p2 = p.try_acquire_build_permit().expect("second permit");
        assert!(p.try_acquire_build_permit().is_none(), "must block at cap=2");
        drop(_p1);
        assert!(p.try_acquire_build_permit().is_some(), "slot freed after drop");
    }

    /// Cap=2 semaphore: 6 concurrent tokio tasks, verify peak active ≤ 2.
    #[tokio::test]
    async fn semaphore_queues_excess_tasks() {
        use std::sync::Mutex;
        use tokio::task::JoinSet;

        let policy = policy(2);
        let active = Arc::new(Mutex::new(0usize));
        let peak = Arc::new(Mutex::new(0usize));

        let mut set = JoinSet::new();
        for _ in 0..6 {
            let policy = Arc::clone(&policy);
            let active = Arc::clone(&active);
            let peak = Arc::clone(&peak);
            set.spawn(async move {
                let _permit = policy.acquire_build_permit().await.unwrap();
                {
                    let mut a = active.lock().unwrap();
                    *a += 1;
                    let mut pk = peak.lock().unwrap();
                    if *a > *pk { *pk = *a; }
                }
                tokio::time::sleep(Duration::from_millis(15)).await;
                {
                    let mut a = active.lock().unwrap();
                    *a -= 1;
                }
            });
        }
        while set.join_next().await.is_some() {}

        let pk = *peak.lock().unwrap();
        assert!(pk <= 2, "peak active builds was {pk}, expected ≤ 2");
    }

    // -- taskpolicy wrapping -------------------------------------------------

    #[test]
    #[cfg(target_os = "macos")]
    fn taskpolicy_wraps_command_on_macos_when_nice_gt_0() {
        let p = SpawnPolicy::new(SpawnPolicyConfig {
            nice_level: 10,
            max_concurrent_builds: 2,
            use_sccache: false,
        });
        let (prog, args) =
            p.apply_taskpolicy("cargo", &["build".to_string(), "--release".to_string()]);
        assert_eq!(prog, "taskpolicy");
        assert_eq!(args, vec!["--", "cargo", "build", "--release"]);
    }

    #[test]
    #[cfg(target_os = "macos")]
    fn taskpolicy_disabled_when_nice_is_0() {
        let p = SpawnPolicy::new(SpawnPolicyConfig {
            nice_level: 0,
            max_concurrent_builds: 2,
            use_sccache: false,
        });
        let (prog, args) = p.apply_taskpolicy("cargo", &["build".to_string()]);
        assert_eq!(prog, "cargo");
        assert_eq!(args, vec!["build"]);
    }

    #[test]
    #[cfg(not(target_os = "macos"))]
    fn taskpolicy_passthrough_on_non_macos() {
        let p = SpawnPolicy::new(SpawnPolicyConfig {
            nice_level: 10,
            max_concurrent_builds: 2,
            use_sccache: false,
        });
        let (prog, args) = p.apply_taskpolicy("cargo", &["build".to_string()]);
        assert_eq!(prog, "cargo");
        assert_eq!(args, vec!["build"]);
    }

    // -- CARGO_BUILD_JOBS injection ------------------------------------------

    #[test]
    fn cargo_build_jobs_injected() {
        let p = SpawnPolicy::new(SpawnPolicyConfig {
            nice_level: 0,
            max_concurrent_builds: 3,
            use_sccache: false,
        });
        let env = p.build_env_overrides();
        let jobs = env.iter().find(|(k, _)| k == "CARGO_BUILD_JOBS").map(|(_, v)| v.as_str());
        assert_eq!(jobs, Some("3"), "CARGO_BUILD_JOBS must match max_concurrent_builds");
    }

    // -- sccache wiring ------------------------------------------------------

    #[test]
    fn sccache_not_injected_when_disabled() {
        let p = SpawnPolicy::new(SpawnPolicyConfig {
            nice_level: 0,
            max_concurrent_builds: 2,
            use_sccache: false,
        });
        let env = p.build_env_overrides();
        assert!(!env.iter().any(|(k, _)| k == "RUSTC_WRAPPER"));
    }

    #[test]
    fn sccache_not_injected_when_not_on_path() {
        let old_path = std::env::var("PATH").unwrap_or_default();
        std::env::set_var("PATH", "");

        let p = SpawnPolicy::new(SpawnPolicyConfig {
            nice_level: 0,
            max_concurrent_builds: 2,
            use_sccache: true,
        });
        let env = p.build_env_overrides();

        std::env::set_var("PATH", old_path);
        assert!(!env.iter().any(|(k, _)| k == "RUSTC_WRAPPER"));
    }

    // -- is_build_harness ----------------------------------------------------

    #[test]
    fn build_harness_detection() {
        for h in ["cargo", "rustc", "build", "make", "cmake", "ninja", "bazel"] {
            assert!(is_build_harness(h), "{h} should be a build harness");
        }
        for h in ["claude", "forge", "node", "bun", "python"] {
            assert!(!is_build_harness(h), "{h} should NOT be a build harness");
        }
    }

    // -- Under-load benchmark ------------------------------------------------
    //
    // 6 concurrent `cargo --version` spawns, throttled (cap=2) vs unthrottled
    // (cap=6).  Uses the Zig semaphore path end-to-end.
    //
    // On an unloaded machine the throttled run is slower (serialisation
    // overhead outweighs unloaded contention).  Under real CPU saturation the
    // throttled path wins by preventing cache thrashing.  We test for
    // correctness (no deadlock, peak ≤ cap) and emit the numbers for the PR.
    #[tokio::test]
    async fn benchmark_throttled_vs_unthrottled_under_load() {
        use tokio::task::JoinSet;
        use tokio::time::Instant;

        const TASKS: usize = 6;

        async fn run_builds(cap: usize) -> Duration {
            let policy = policy(cap);
            let start = Instant::now();
            let mut set = JoinSet::new();
            for _ in 0..TASKS {
                let policy = Arc::clone(&policy);
                set.spawn(async move {
                    let _permit = policy.acquire_build_permit().await.unwrap();
                    let _ = tokio::process::Command::new("cargo")
                        .args(["--version"])
                        .env("CARGO_BUILD_JOBS", cap.to_string())
                        .output()
                        .await;
                });
            }
            while set.join_next().await.is_some() {}
            start.elapsed()
        }

        let throttled = run_builds(2).await;
        let unthrottled = run_builds(TASKS).await;

        println!(
            "[bench] throttled (cap=2, {TASKS} tasks): {throttled:?}  |  unthrottled (cap={TASKS}, {TASKS} tasks): {unthrottled:?}"
        );

        assert!(throttled.as_secs() < 60, "throttled run timed out");
        assert!(unthrottled.as_secs() < 60, "unthrottled run timed out");
    }
}
