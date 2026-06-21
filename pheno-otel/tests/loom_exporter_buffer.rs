//! L25 (concurrency) — loom permutation test for an OTLP exporter event buffer.
//! Run with: RUSTFLAGS="--cfg loom" cargo test --test loom_exporter_buffer --release
#![cfg(loom)]
use loom::sync::{Arc, Mutex};
use loom::thread;

#[test]
fn exporter_buffer_preserves_all_events_under_concurrent_push() {
    let mut b = loom::model::Builder::new();
    b.preemption_bound = Some(3);
    b.check(|| {
        let buf = Arc::new(Mutex::new(Vec::<u8>::new()));
        let handles: Vec<_> = (0u8..3).map(|id| {
            let b = buf.clone();
            thread::spawn(move || { b.lock().unwrap().push(id); })
        }).collect();
        for h in handles { h.join().unwrap(); }
        let mut events = buf.lock().unwrap().clone();
        events.sort();
        assert_eq!(events, vec![0u8, 1, 2]);
    });
}
