//! 1000-request SLO chaos load test (V21-T2 / L29 chaos-in-CI).
//!
//! **Purpose.** Demonstrate the chaos invocation pattern called out in
//! the V21-T2 brief: spawn a fleet of simulated requests under random
//! fault injection, then assert fleet-level SLO compliance.
//!
//! **Why a separate integration test, not a `#[chaos_test]` macro test?**
//! The `#[chaos_test]` proc-macro drives a single fault × N runs on
//! the test thread. This test needs *N requests × concurrent threads*,
//! so it uses the [`chaos_call`] entry point directly (the same one the
//! macro uses) and arms [`NetworkLatency`] per worker thread.
//!
//! **Fault matrix (this test).**
//!
//! | Fault           | Probability | Base delay | Jitter | Max delay | Notes                                  |
//! | :-------------- | :---------- | :--------- | :----- | :-------- | :------------------------------------- |
//! | NetworkLatency  | 0.10 (light)| 50ms       | 25ms   | 75ms      | 4 worker threads, "calm" workload      |
//! | NetworkLatency  | 0.20 (heavy)| 150ms      | 30ms   | 180ms     | 4 worker threads, "stress" workload    |
//!
//! Max delay = `base + jitter` (the network substrate clamps the
//! sampled delay to `[0, base+jitter]`). Both envelopes stay below
//! `PER_REQUEST_SLO_MS = 250ms`.
//!
//! `ConnectionDrop` and `CpuSpike` are *not* enabled here — the
//! 1000-request pattern is a steady-state latency check, not a
//! drop-recovery check. The chaos matrix is intentionally
//! narrow so the SLO breach surface is well-defined and a regression
//! points at exactly one cause.
//!
//! **SLO gate (fleet-level).**
//!
//! - **Per-request SLO:** `PER_REQUEST_SLO_MS = 250ms`. Each request
//!   wraps its I/O in `chaos_call(|| do_work())`; the wall-clock from
//!   `Instant::now()` before the call to after must be < SLO. The 250ms
//!   budget leaves ~70ms headroom over the worst-case injected delay
//!   (heavy quadrant: 150ms base + 30ms jitter = 180ms max sampled
//!   delay) so a single `std::thread::sleep` overshoot (typically
//!   <20ms on Linux) does not trip the gate on a flaky runner.
//! - **Fleet compliance:** ≥ `TARGET_PASS_RATE_PCT = 99%` of the 1000
//!   requests must pass per-request SLO.
//! - **p100 gate:** the worst observed latency across all 1000
//!   requests must be < SLO (the 99% gate allows a single tail breach
//!   but the p100 check catches gross regressions).
//!
//! **Why `cargo test --test slo_load` and not `cargo test`?** Cargo
//! runs each integration test file in its own process; isolating this
//! to `--test slo_load` makes the chaos-ci workflow's invocation
//! explicit and prevents test-threading from masking scheduling
//! interactions. The `.github/workflows/chaos-ci.yml` workflow invokes
//! exactly this target.
//!
//! ## Run
//!
//! ```text
//! cargo test --release --test slo_load -- --nocapture
//! ```
//!
//! ## Expected runtime
//!
//! Wall-clock: 5–10s on a typical CI runner. The bottleneck is the
//! heavy-quadrant 150ms × 30ms injected delays (≈20% of 500 requests ×
//! up to 180ms = 18s sequential, 4 threads in parallel → ~5s).
//!
//! ## Pass criteria (visible in `--nocapture` output)
//!
//! - `Total requests: 1000`
//! - `Pass rate: ≥ 99%`
//! - `Max latency < 250ms`
//! - Exit code 0 from `cargo test`

#![allow(clippy::needless_range_loop)] // explicit index reads cleaner than enumerate() in worker loops

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};

use pheno_chaos::{chaos_call, Fault, NetworkLatency};

// ===========================================================================
// SLO configuration (single source of truth; the chaos-ci.yml gate
// parses these values out of the test output for the workflow gate).
// ===========================================================================

/// Total simulated requests to spawn across all worker threads.
const TOTAL_REQUESTS: u64 = 1_000;

/// Per-request SLO in milliseconds. A request fails the SLO if its
/// wall-clock time from before `chaos_call` to after exceeds this
/// value. 250ms leaves ~70ms headroom over the worst-case heavy
/// quadrant delay (180ms) plus a single `std::thread::sleep`
/// overshoot (~20ms).
const PER_REQUEST_SLO_MS: u64 = 250;

/// Minimum acceptable fleet-level pass rate (percent). The chaos-ci
/// workflow fails the build if observed pass rate < this value.
const TARGET_PASS_RATE_PCT: u64 = 99;

/// Number of concurrent worker threads. 8 is chosen because:
///
/// - It's a typical CI runner core count (2 vCPU × 4 = 8 in
///   GitHub-hosted runners).
/// - It divides `TOTAL_REQUESTS` evenly (1000 / 8 = 125 per thread).
/// - It keeps the spawn overhead under 10ms.
const WORKER_THREADS: u64 = 8;

/// Per-thread simulated-work payload duration (the "real" work the
/// fault is being injected around). 50µs is small enough that the
/// injected latency dominates the per-request wall-clock.
const WORK_DURATION: Duration = Duration::from_micros(50);

/// Light-quadrant fault parameters (4 worker threads): 50ms ± 25ms,
/// 10% probability. Matches the brief's "moderate chaos" envelope.
const LIGHT_BASE_MS: u64 = 50;
const LIGHT_JITTER_MS: u64 = 25;
const LIGHT_PROBABILITY: f64 = 0.10;

/// Heavy-quadrant fault parameters (4 worker threads): 150ms ± 30ms,
/// 20% probability. Stresses the SLO but stays under the 250ms budget
/// (max sampled delay = 180ms).
const HEAVY_BASE_MS: u64 = 150;
const HEAVY_JITTER_MS: u64 = 30;
const HEAVY_PROBABILITY: f64 = 0.20;

// ===========================================================================
// Test
// ===========================================================================

/// Fleet-level chaos load test: 1000 requests, 8 worker threads,
/// mixed-quadrant NetworkLatency, SLO compliance verification.
#[test]
fn slo_load_1000_requests_with_chaos() {
    assert_eq!(
        TOTAL_REQUESTS % WORKER_THREADS,
        0,
        "TOTAL_REQUESTS must be divisible by WORKER_THREADS for even load"
    );
    let per_thread = TOTAL_REQUESTS / WORKER_THREADS;

    // Shared counters. AtomicUsize would do, but u64 keeps the printout
    // alignment uniform and matches the workflow's grep parser.
    let pass_count = Arc::new(AtomicU64::new(0));
    let fail_count = Arc::new(AtomicU64::new(0));
    let max_latency_us = Arc::new(AtomicU64::new(0));

    let suite_start = Instant::now();

    let mut handles = Vec::with_capacity(WORKER_THREADS as usize);

    for thread_id in 0..WORKER_THREADS {
        let pass_count = Arc::clone(&pass_count);
        let fail_count = Arc::clone(&fail_count);
        let max_latency_us = Arc::clone(&max_latency_us);

        // Half the threads run the light quadrant, half the heavy
        // quadrant. This gives the test a bimodal latency distribution
        // (calm + stress) so the SLO breach surface covers both
        // envelopes.
        let (base_ms, jitter_ms, probability) = if thread_id < WORKER_THREADS / 2 {
            (LIGHT_BASE_MS, LIGHT_JITTER_MS, LIGHT_PROBABILITY)
        } else {
            (HEAVY_BASE_MS, HEAVY_JITTER_MS, HEAVY_PROBABILITY)
        };

        let handle = thread::Builder::new()
            .name(format!("chaos-load-worker-{}", thread_id))
            .spawn(move || {
                // Arm the NetworkLatency fault for the lifetime of this
                // worker thread. The thread-local ARMED cell in
                // `network.rs` keeps the fault scoped to this thread —
                // worker threads cannot pollute each other.
                let fault = NetworkLatency::new(base_ms, jitter_ms, probability);
                // `inject()` returns a `FaultGuard`; we hold it for
                // the lifetime of this worker thread. The guard's
                // Drop impl reverts the thread-local ARMED cell, so
                // we must NOT also `drop(_guard)` ourselves — that
                // would fire the "dropped without explicit revert()"
                // warning. Instead, we call `revert()` at the end
                // (which consumes the guard and is the canonical
                // idempotent teardown path).
                let _guard = fault.inject().expect("NetworkLatency::inject");

                for _req_idx in 0..per_thread {
                    let req_start = Instant::now();
                    chaos_call(|| {
                        // The "real" work is a 50µs sleep. The fault
                        // (when it fires) sleeps on top of this.
                        thread::sleep(WORK_DURATION);
                    });
                    let elapsed_us = req_start.elapsed().as_micros() as u64;

                    // Atomic max-update. The CAS loop is fine here
                    // because max_latency_us is updated ~1000 times
                    // total, not in a hot inner loop.
                    let slo_us = PER_REQUEST_SLO_MS * 1_000;
                    if elapsed_us > slo_us {
                        fail_count.fetch_add(1, Ordering::Relaxed);
                    } else {
                        pass_count.fetch_add(1, Ordering::Relaxed);
                    }

                    let mut current = max_latency_us.load(Ordering::Relaxed);
                    while elapsed_us > current {
                        match max_latency_us.compare_exchange(
                            current,
                            elapsed_us,
                            Ordering::Relaxed,
                            Ordering::Relaxed,
                        ) {
                            Ok(_) => break,
                            Err(actual) => current = actual,
                        }
                    }
                }

                // Explicit revert before the guard falls out of
                // scope. This consumes `_guard` and runs the handle's
                // Drop, which clears the thread-local ARMED cell so
                // subsequent tests in the same process are not
                // contaminated. Without the explicit call, the
                // `FaultGuard::Drop` impl would emit a noisy
                // warning to stderr.
                _guard.revert();
            })
            .expect("worker thread spawn");

        handles.push(handle);
    }

    for h in handles {
        h.join().expect("worker thread join");
    }

    // ===========================================================================
    // Report + assertions
    // ===========================================================================

    let total_elapsed = suite_start.elapsed();
    let passes = pass_count.load(Ordering::Relaxed);
    let fails = fail_count.load(Ordering::Relaxed);
    let total = passes + fails;
    let pass_rate_pct = if total > 0 {
        passes * 100 / total
    } else {
        0
    };
    let max_latency_ms = max_latency_us.load(Ordering::Relaxed) as f64 / 1_000.0;

    // Emit a parseable report. The chaos-ci workflow greps for the
    // `PASS_RATE:` and `MAX_LATENCY_MS:` lines below as the SLO gate.
    println!("=== V21-T2 L29 Chaos SLO Load Report ===");
    println!("TOTAL_REQUESTS:       {}", TOTAL_REQUESTS);
    println!("WORKER_THREADS:       {}", WORKER_THREADS);
    println!("PER_REQUEST_SLO_MS:   {}", PER_REQUEST_SLO_MS);
    println!("TARGET_PASS_RATE_PCT: {}", TARGET_PASS_RATE_PCT);
    println!("---");
    println!("Total requests:       {}", total);
    println!("Passed:               {} ({}%)", passes, pass_rate_pct);
    println!("Failed:               {}", fails);
    println!("Max latency (ms):     {:.3}", max_latency_ms);
    println!("p100 SLO gate:        {} ms", per_request_slo_gate());
    println!("Suite wall-clock:     {:?}", total_elapsed);
    println!("PASS_RATE:            {}", pass_rate_pct);
    println!("MAX_LATENCY_MS:       {:.3}", max_latency_ms);
    println!("==========================================");

    assert_eq!(
        total, TOTAL_REQUESTS,
        "all {} requests must complete (got {}; missing = {})",
        TOTAL_REQUESTS, total, TOTAL_REQUESTS as i64 - total as i64
    );
    assert!(
        pass_rate_pct >= TARGET_PASS_RATE_PCT,
        "SLO compliance breach: pass rate {}% < target {}% (passes={}, fails={}, max_latency_ms={:.3})",
        pass_rate_pct, TARGET_PASS_RATE_PCT, passes, fails, max_latency_ms
    );
    assert!(
        max_latency_ms < PER_REQUEST_SLO_MS as f64,
        "p100 latency exceeded SLO: {:.3}ms >= {}ms (SLO breach)",
        max_latency_ms, PER_REQUEST_SLO_MS
    );
}

/// Wraps the per-request SLO in milliseconds for the printout so the
/// `p100 SLO gate:` line is computed once and matches the assertion
/// below.
fn per_request_slo_gate() -> u64 {
    PER_REQUEST_SLO_MS
}
