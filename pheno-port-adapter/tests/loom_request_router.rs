//! L25 (concurrency) — loom permutation test for a port-adapter request router.
//! Run with: RUSTFLAGS="--cfg loom" cargo test --test loom_request_router --release
#![cfg(loom)]
use loom::sync::{Arc, RwLock};
use loom::thread;
use std::collections::HashMap;

#[test]
fn request_router_lookups_are_safe_under_concurrent_writes() {
    let mut b = loom::model::Builder::new();
    b.preemption_bound = Some(3);
    b.check(|| {
        let routes = Arc::new(RwLock::new(HashMap::<&str, &str>::new()));
        let w = routes.clone();
        let writer = thread::spawn(move || w.write().unwrap().insert("/v1/health", "health"));
        let r = routes.clone();
        let reader = thread::spawn(move || { let _g = r.read().unwrap(); });
        writer.join().unwrap(); reader.join().unwrap();
        assert_eq!(routes.read().unwrap().get("/v1/health").copied(), Some("health"));
    });
}
