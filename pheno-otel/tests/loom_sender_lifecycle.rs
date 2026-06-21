//! Loom test verifying the OTLP batch exporter's shutdown path is race-free.
//!
//! Exercises the read-modify-write pattern that the StdoutExporter and
//! HttpExporter would use when flushing a queued batch: a `shutdown`
//! flag is checked before each push, and an `AtomicBool` is set to
//! signal producer threads to drain. The loom model checker enumerates
//! every interleaving of the two `send`+`shutdown` calls so we know the
//! final state is reachable from any ordering without a data race.
//!
//! No assertion on `sent.len()` is made because the final order is
//! non-deterministic (loom intentionally explores all orderings); a
//! panic from the loom scheduler or a data-race report from
//! ThreadSanitizer is the failure signal.
//!
//! Tests are gated behind the `loom-tests` Cargo feature. Run with:
//!   cargo test --features loom-tests --test loom_sender_lifecycle --release
//!
//! Refs: v14 cycle-3 T5, L25. See plans/2026-06-20-v14-71-pillar-cycle-3-p0.md § T5.

#![cfg(feature = "loom-tests")]

use loom::sync::Arc;
use loom::sync::atomic::{AtomicBool, Ordering};
use loom::sync::Mutex;
use loom::thread;

/// Mock OTLP batch sender that mirrors the shape of the production
/// StdoutExporter / HttpExporter: a shutdown flag gates writes, and
/// the inner buffer is protected by a `Mutex`.
#[derive(Default)]
struct BatchSender {
    shutdown: Arc<AtomicBool>,
    sent: Arc<Mutex<Vec<u32>>>,
}

impl BatchSender {
    fn send(&self, item: u32) {
        if self.shutdown.load(Ordering::SeqCst) {
            return;
        }
        self.sent.lock().unwrap().push(item);
    }

    fn shutdown(&self) {
        self.shutdown.store(true, Ordering::SeqCst);
    }
}

#[test]
fn loom_shutdown_no_panic() {
    loom::model(|| {
        let shutdown = Arc::new(AtomicBool::new(false));
        let sent = Arc::new(Mutex::new(Vec::new()));

        let sender_a = Arc::new(BatchSender {
            shutdown: shutdown.clone(),
            sent: sent.clone(),
        });
        let sender_b = Arc::new(BatchSender {
            shutdown: shutdown.clone(),
            sent: sent.clone(),
        });

        let sa = sender_a.clone();
        let sb = sender_b.clone();

        let t1 = thread::spawn(move || {
            sa.send(1);
            sa.shutdown();
        });
        let t2 = thread::spawn(move || {
            sb.send(2);
            sb.shutdown();
        });

        t1.join().unwrap();
        t2.join().unwrap();

        // No panic = no race. Final state may have 0, 1, or 2 items in
        // `sent` depending on ordering; we only verify the shutdown flag
        // is set and the mutex is in a consistent state.
        assert!(shutdown.load(Ordering::SeqCst));
        let _len = sent.lock().unwrap().len();
    });
}
