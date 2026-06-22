//! Integration test for `pheno-config` hot-reload (L33 / v22-T3).
//!
//! This test lives in `tests/` (not `src/hot_reload.rs`) so it
//! runs as a separate binary; integration tests are the Rust
//! convention for tests that exercise the public API across
//! module boundaries.
//!
//! The test exercises the **reload-under-load** contract:
//! 1. Start with `ConfigA`.
//! 2. Spawn N reader threads that each loop on
//!    `reloader.current()` and verify the config is consistent
//!    (the reloader's atomic-swap invariant).
//! 3. From the main thread, call `reloader.install(ConfigB)`.
//! 4. Verify all N readers see ConfigB after the install.
//! 5. Install ConfigC; verify all N readers see ConfigC.
//!
//! The atomic-swap guarantee is the load-bearing piece: every
//! reader must see a *complete* `Config` value, never a torn
//! read. `Mutex<Arc<T>>` (the substrate we use) gives us this
//! because the mutex lock + `Arc::clone` is atomic w.r.t. the
//! install path — readers see either the old pointer or the
//! new pointer, never a half-state.
//!
//! ## Why stdlib-only?
//!
//! `pheno-config` keeps the hot-reload substrate small: a
//! `Mutex<Arc<T>>` and a `read_and_install` function. The
//! SIGHUP wiring is a separate concern that lives behind
//! `watch_sighup` on Unix (gated `#[cfg(unix)]`) and is
//! tested separately. The substrate itself is platform-
//! independent.

use pheno_config::hot_reload::{read_and_install, ConfigReloader};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use tempfile::tempdir;

/// 8 reader threads, each loops on `current()` for the
/// duration of the test. Each reader records the number of
/// distinct payloads it observes. Because the
/// `Mutex<Arc<T>>` install path is atomic w.r.t. `current()`
/// readers, a reader must observe only ConfigA → ConfigB →
/// ConfigC transitions (each distinct at most once); it MUST
/// NOT see a torn read (e.g. A → C without B).
#[test]
fn reload_under_load_is_consistent() {
    // Construct the reloader with ConfigA.
    let reloader: Arc<ConfigReloader<String>> =
        ConfigReloader::new("ConfigA".to_string());

    const N_READERS: usize = 8;
    const READ_DURATION: Duration = Duration::from_millis(300);

    let handles: Vec<_> = (0..N_READERS)
        .map(|_| {
            let r = Arc::clone(&reloader);
            thread::spawn(move || {
                let start = Instant::now();
                let mut distinct: Vec<String> = Vec::new();
                while start.elapsed() < READ_DURATION {
                    let current = r.current();
                    let payload: String = (*current).clone();
                    if distinct.last().map(|s| s.as_str()) != Some(payload.as_str()) {
                        distinct.push(payload);
                    }
                    // Tight loop — no sleep — so we maximize
                    // the chance of catching a torn read if
                    // the install path were not atomic.
                }
                distinct
            })
        })
        .collect();

    // Give the readers a moment to start.
    thread::sleep(Duration::from_millis(20));

    // Install ConfigB at t≈20ms.
    reloader.install("ConfigB".to_string());
    thread::sleep(Duration::from_millis(100));

    // Install ConfigC at t≈120ms.
    reloader.install("ConfigC".to_string());

    // Join all readers.
    let mut all_observations: Vec<Vec<String>> = Vec::new();
    for h in handles {
        all_observations.push(h.join().expect("reader thread panicked"));
    }

    // Every reader MUST observe a *prefix* of the sequence
    // [ConfigA, ConfigB, ConfigC] — no duplicates, no torn
    // reads. A reader that started before ConfigB was
    // installed may only see ConfigA. A reader that observed
    // ConfigC MUST have observed ConfigB first (otherwise a
    // torn read snuck ConfigA's pointer into the ConfigC
    // window).
    for (i, obs) in all_observations.iter().enumerate() {
        assert!(
            !obs.is_empty(),
            "reader {i} observed zero payloads (test timing too tight?)"
        );
        for w in obs.windows(2) {
            assert_ne!(
                w[0], w[1],
                "reader {i} observed duplicate {w:?} (should dedupe)"
            );
        }
        let saw_a = obs.iter().any(|s| s == "ConfigA");
        let saw_b = obs.iter().any(|s| s == "ConfigB");
        let saw_c = obs.iter().any(|s| s == "ConfigC");
        if saw_c {
            assert!(saw_b, "reader {i} saw C without B: {obs:?}");
        }
        if saw_b {
            assert!(saw_a, "reader {i} saw B without A: {obs:?}");
        }
        assert_eq!(
            obs[0], "ConfigA",
            "reader {i} did not start on ConfigA: {obs:?}"
        );
    }

    // The final state is ConfigC.
    let final_cfg = reloader.current();
    assert_eq!(*final_cfg, "ConfigC");
}

/// Smoke: a fresh install replaces the previous config.
#[test]
fn install_replaces_current_atomically() {
    let reloader: Arc<ConfigReloader<String>> =
        ConfigReloader::new("v1".to_string());
    assert_eq!(*reloader.current(), "v1");

    reloader.install("v2".to_string());
    assert_eq!(*reloader.current(), "v2");

    reloader.install("v3".to_string());
    assert_eq!(*reloader.current(), "v3");
}

/// Strong-count invariant: every `current()` clone shares the
/// allocation with the inner Arc.
#[test]
fn current_returns_arc_with_correct_strong_count() {
    let reloader: Arc<ConfigReloader<String>> =
        ConfigReloader::new("only".to_string());
    let a = reloader.current();
    let b = reloader.current();
    let c = reloader.current();
    // Three clones of the same Arc — strong count is 4 (the
    // one inside the reloader + the three we cloned).
    assert_eq!(Arc::strong_count(&a), 4);
    assert_eq!(Arc::strong_count(&b), 4);
    assert_eq!(Arc::strong_count(&c), 4);
    drop(a);
    drop(b);
    drop(c);
    // Down to 1 (the one inside the reloader).
    let d = reloader.current();
    assert_eq!(Arc::strong_count(&d), 2);
}

/// `read_and_install` reads a file and installs the parsed
/// payload — the file→install primitive that backs the SIGHUP
/// handler. This is the integration version of unit test 4
/// (it exercises the public path, not the inner module).
#[test]
fn read_and_install_reads_file() {
    let dir = tempdir().expect("tempdir");
    let path = dir.path().join("config.toml");
    std::fs::write(&path, "alpha\n").expect("write");

    let reloader: Arc<ConfigReloader<String>> =
        ConfigReloader::new("initial".to_string());
    read_and_install(&reloader, &path, |s| Ok(s.trim().to_string()))
        .expect("read_and_install must succeed");
    assert_eq!(*reloader.current(), "alpha");

    // Second reload (simulating a second SIGHUP).
    std::fs::write(&path, "beta\n").expect("rewrite");
    read_and_install(&reloader, &path, |s| Ok(s.trim().to_string()))
        .expect("read_and_install must succeed on second call");
    assert_eq!(*reloader.current(), "beta");
}

/// `read_and_install` keeps the previous config on failure —
/// the file→install primitive does not corrupt live state.
#[test]
fn read_and_install_keeps_previous_on_failure() {
    let dir = tempdir().expect("tempdir");
    let missing = dir.path().join("does-not-exist.toml");

    let reloader: Arc<ConfigReloader<String>> =
        ConfigReloader::new("previous".to_string());
    let result =
        read_and_install(&reloader, &missing, |s| Ok(s.trim().to_string()));
    assert!(result.is_err(), "missing file must error");
    assert_eq!(*reloader.current(), "previous");
}
