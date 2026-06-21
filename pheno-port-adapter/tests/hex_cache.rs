//! Integration smoke tests for the hex-port [`HexCachePort`] surface.
//!
//! These tests live in `tests/` (not `src/`) so they exercise only the
//! **public** crate API — they are the surface a downstream consumer
//! actually sees. The matching `cargo test --test hex_cache` invocation
//! is wired into CI alongside the existing `chaos_test.rs` integration
//! target.
//!
//! Scenarios demonstrated:
//!
//! 1. **Trait-object round-trip** — store `InMemoryCache` behind an
//!    `Arc<dyn HexCachePort>` to prove the trait is object-safe (the
//!    whole point of using `async-trait` instead of native `async fn`).
//! 2. **End-to-end put/get/invalidate** against the concrete
//!    `InMemoryCache` adapter.
//! 3. **Lazy expiration** — a short TTL expires on read; a zero TTL
//!    never expires.
//! 4. **Adapter construction** — `RedisAdapter::new` parses a URL
//!    without connecting (a regression here would hang the test on
//!    DNS resolution).

use std::sync::Arc;
use std::time::Duration;

use pheno_port_adapter::adapters::{InMemoryCache, RedisAdapter};
use pheno_port_adapter::{CacheError, HexCachePort};

// ---------------------------------------------------------------------------
// 1. Trait-object round-trip (object-safety of the async trait).
// ---------------------------------------------------------------------------

#[tokio::test]
async fn hex_cache_port_is_object_safe() {
    let cache: Arc<dyn HexCachePort> = Arc::new(InMemoryCache::new());

    cache
        .put("k", b"v".to_vec(), Duration::from_secs(60))
        .await
        .expect("put via trait object");
    let got = cache.get("k").await.expect("get via trait object");
    assert_eq!(got.as_deref(), Some(&b"v"[..]));
    cache.invalidate("k").await.expect("invalidate via trait object");
    assert!(cache.get("k").await.expect("get miss").is_none());
}

// ---------------------------------------------------------------------------
// 2. End-to-end put/get/invalidate against concrete InMemoryCache.
// ---------------------------------------------------------------------------

#[tokio::test]
async fn in_memory_cache_round_trip() {
    let cache = InMemoryCache::new();
    cache
        .put("user:42", b"alice".to_vec(), Duration::from_secs(60))
        .await
        .unwrap();
    assert_eq!(
        cache.get("user:42").await.unwrap().as_deref(),
        Some(&b"alice"[..])
    );
    cache.invalidate("user:42").await.unwrap();
    assert!(cache.get("user:42").await.unwrap().is_none());
}

// ---------------------------------------------------------------------------
// 3. Lazy expiration.
// ---------------------------------------------------------------------------

#[tokio::test]
async fn zero_ttl_never_expires() {
    let cache = InMemoryCache::new();
    cache
        .put("forever", b"x".to_vec(), Duration::ZERO)
        .await
        .unwrap();
    // No sleep — TTL=0 must collapse to no-expiration, not "expired
    // immediately".
    assert_eq!(
        cache.get("forever").await.unwrap().as_deref(),
        Some(&b"x"[..])
    );
}

#[tokio::test]
async fn short_ttl_expires_on_next_get() {
    let cache = InMemoryCache::new();
    cache
        .put("ephemeral", b"x".to_vec(), Duration::from_millis(1))
        .await
        .unwrap();
    // Sleep just long enough for the deadline to pass deterministically
    // without making the test flaky on a loaded CI runner.
    tokio::time::sleep(Duration::from_millis(50)).await;
    assert!(
        cache.get("ephemeral").await.unwrap().is_none(),
        "entry should have expired"
    );
}

#[tokio::test]
async fn empty_key_is_a_validation_error() {
    let cache = InMemoryCache::new();
    assert!(matches!(cache.get("").await, Err(CacheError::InvalidKey(_))));
    assert!(matches!(
        cache.put("", b"v".to_vec(), Duration::from_secs(1)).await,
        Err(CacheError::InvalidKey(_))
    ));
    assert!(matches!(
        cache.invalidate("").await,
        Err(CacheError::InvalidKey(_))
    ));
}

// ---------------------------------------------------------------------------
// 4. Adapter construction (no live Redis required).
// ---------------------------------------------------------------------------

#[test]
fn redis_adapter_parses_url_without_connecting() {
    // `new` must only parse the URL — if it tried to TCP-connect, this
    // test would block forever waiting for a non-existent server (or
    // fail with ECONNREFUSED on the test runner). If this regresses the
    // test will hang or fail with a connection error.
    let adapter = RedisAdapter::new("redis://127.0.0.1:6379/0")
        .expect("parse redis url");
    // Clone-able so callers can share an adapter across tasks.
    let _cloned = adapter.clone();
}

#[test]
fn redis_adapter_rejects_malformed_url() {
    let result = RedisAdapter::new("not a redis url");
    assert!(matches!(result, Err(CacheError::Backend(_))));
}
