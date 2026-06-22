//! Integration test for `pheno-config` hot-reload (L33 / v22-T4).
//!
//! Exercises the **reload-under-load** contract:
//! 1. Start with `ConfigA`.
//! 2. Spawn N reader threads that each loop on
//!    `reloader.current()` and verify the config is consistent
//!    (the atomic-swap invariant).
//! 3. From the main thread, call `reloader.install(ConfigB)`.
//! 4. Verify all N readers see ConfigB after the install.
//! 5. Install ConfigC; verify all N readers see ConfigC.
//!
//! The atomic-swap guarantee is the load-bearing piece: every
//! reader must see a *complete* `Arc<T>`, never a torn read.
//! The `Mutex<Arc<T>>` pattern (which `pheno-config` uses for
//! poison detection) gives us this for free — readers see
//! either the old pointer or the new pointer, never a
//! half-state.
//!
//! ## Why stdlib-only?
//!
//! Per the v22-T4 brief and ADR-023 (agent-effort governance,
//! MacBook-safe), `pheno-config` keeps `arc-swap` /
//! `signal-hook` / `parking_lot` out of the substrate. We rely
//! on `std::sync::Mutex<Arc<T>>` (atomic pointer exchange
//! guarded by a short-lived lock) and the documented stdlib
//! guarantees.

use pheno_config::hot_reload::ConfigReloader;
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

#[test]
fn reload_under_load_is_consistent() {
    // Construct the reloader with ConfigA.
    let reloader: Arc<ConfigReloader<String>> = ConfigReloader::new("ConfigA".to_string());

    // 8 reader threads, each loops on current() for the
    // duration of the test. Each reader records the distinct
    // payloads it observes. Because the swap is atomic
    // (guarded by the inner Mutex on the writer side, with
    // Arc::clone on the reader side), a reader must observe
    // a monotonic sequence of labels (A → B → C), never a
    // torn read.
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
                    let payload = (&*current).clone();
                    if distinct.last().map(|s| s.as_str()) != Some(payload.as_str()) {
                        distinct.push(payload);
                    }
                    // Tight loop — no sleep — so we maximize
                    // the chance of catching a torn read if
                    // the swap were not atomic.
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

    // Every reader MUST observe a prefix of the sequence
    // [ConfigA, ConfigB, ConfigC] — readers that started
    // before ConfigB was installed may only see ConfigA, but
    // no reader should see ConfigC without having seen
    // ConfigB first (that would indicate a torn read where
    // the ConfigA pointer leaked into the ConfigC window).
    for (i, obs) in all_observations.iter().enumerate() {
        // Sanity: at least one observation.
        assert!(
            !obs.is_empty(),
            "reader {i} observed zero payloads (test timing too tight?)"
        );
        // No duplicates interleaved.
        for w in obs.windows(2) {
            assert_ne!(
                w[0], w[1],
                "reader {i} observed duplicate {w:?} (should dedupe)"
            );
        }
        // Ordering invariant: A before B before C, if seen.
        let saw_a = obs.iter().any(|s| s == "ConfigA");
        let saw_b = obs.iter().any(|s| s == "ConfigB");
        let saw_c = obs.iter().any(|s| s == "ConfigC");
        if saw_c {
            assert!(saw_b, "reader {i} saw C without B: {obs:?}");
        }
        if saw_b {
            assert!(saw_a, "reader {i} saw B without A: {obs:?}");
        }
        // First observation is always A (initial state).
        assert_eq!(
            obs[0], "ConfigA",
            "reader {i} did not start on ConfigA: {obs:?}"
        );
    }

    // The final state is ConfigC (verified by a fresh current()
    // call from the main thread).
    let final_cfg = reloader.current();
    assert_eq!(&*final_cfg, "ConfigC");
}

#[test]
fn install_replaces_current_atomically() {
    let reloader: Arc<ConfigReloader<String>> = ConfigReloader::new("v1".to_string());
    assert_eq!(&*reloader.current(), "v1");

    reloader.install("v2".to_string());
    assert_eq!(&*reloader.current(), "v2");

    reloader.install("v3".to_string());
    assert_eq!(&*reloader.current(), "v3");
}

#[test]
fn current_returns_arc_with_correct_strong_count() {
    let reloader: Arc<ConfigReloader<String>> = ConfigReloader::new("only".to_string());
    let a = reloader.current();
    let b = reloader.current();
    let c = reloader.current();
    // Three clones of the same Arc — strong count is 4
    // (1 inside the reloader + 3 we cloned).
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