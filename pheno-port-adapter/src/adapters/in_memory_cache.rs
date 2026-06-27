//! [`InMemoryCache`] — process-local adapter for [`HexCachePort`].
//!
//! Stores entries in a `tokio::sync::Mutex<HashMap<String, Entry>>` and
//! checks expiration lazily on `get` (a `Duration::ZERO` TTL disables
//! expiration). This is the default adapter used by tests and single-node
//! binaries; production deployments that need cross-process caching use
//! [`crate::adapters::redis_cache::RedisAdapter`] instead.
//!
//! ## Why `tokio::sync::Mutex` and not `std::sync::Mutex`?
//!
//! The trait methods are `async fn`, so the lock guard crosses an
//! `.await` point when the entry is missing or expired. `std::sync::Mutex`
//! is not held across `.await` cleanly (a parked task holding the guard
//! stalls every other task). `tokio::sync::Mutex` is the right primitive
//! for "async-critical section" patterns.

use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use tokio::sync::Mutex;

use crate::ports::{CacheError, HexCachePort};

/// Internal entry: value bytes + optional expiration deadline.
///
/// `Option<Instant>` is used (rather than a sentinel `Instant`) so that a
/// `Duration::ZERO` TTL cleanly maps to "never expires" without needing to
/// pick an arbitrary far-future sentinel that could overflow on 32-bit
/// platforms.
#[derive(Debug, Clone)]
struct Entry {
    value: Vec<u8>,
    expires_at: Option<Instant>,
}

/// Process-local in-memory cache adapter for [`HexCachePort`].
///
/// Stores entries in a `tokio::sync::Mutex<HashMap<String, Entry>>` and
/// checks expiration lazily on `get` (a `Duration::ZERO` TTL disables
/// expiration). This is the default adapter used by tests and single-node
/// binaries; production deployments that need cross-process caching use
/// [`crate::adapters::redis_cache::RedisAdapter`] instead.
///
/// # Examples
///
/// Round-trip a value through the cache using a single-shot tokio
/// runtime. `Duration::ZERO` disables expiration; a non-zero TTL stores
/// the entry with lazy eviction on the next `get` past the deadline.
///
/// ```
/// use pheno_port_adapter::adapters::InMemoryCache;
/// use pheno_port_adapter::ports::HexCachePort;
/// use std::time::Duration;
///
/// tokio::runtime::Runtime::new().unwrap().block_on(async {
///     let cache = InMemoryCache::new();
///     cache
///         .put("greeting", b"hello".to_vec(), Duration::from_secs(60))
///         .await
///         .unwrap();
///
///     let got = cache.get("greeting").await.unwrap();
///     assert_eq!(got.as_deref(), Some(&b"hello"[..]));
///
///     // `invalidate` is idempotent: a missing key returns `Ok(())`.
///     cache.invalidate("greeting").await.unwrap();
///     assert!(cache.get("greeting").await.unwrap().is_none());
/// });
/// ```
#[derive(Debug, Default, Clone)]
pub struct InMemoryCache {
    inner: Arc<Mutex<HashMap<String, Entry>>>,
}

impl InMemoryCache {
    /// Create an empty in-memory cache.
    pub fn new() -> Self {
        Self::default()
    }

    /// Snapshot of the number of *unexpired* entries. Best-effort; mainly
    /// useful for tests and metrics.
    pub async fn len(&self) -> usize {
        let guard = self.inner.lock().await;
        let now = Instant::now();
        guard
            .iter()
            .filter(|(_, e)| e.expires_at.map(|deadline| deadline > now).unwrap_or(true))
            .count()
    }
}

#[async_trait]
impl HexCachePort for InMemoryCache {
    async fn get(&self, key: &str) -> Result<Option<Vec<u8>>, CacheError> {
        if key.is_empty() {
            return Err(CacheError::InvalidKey("empty key".to_string()));
        }
        let mut guard = self.inner.lock().await;
        let Some(entry) = guard.get(key).cloned() else {
            return Ok(None);
        };
        // Lazy expiration: drop the entry on read if its deadline has passed.
        // We return `Ok(None)` so callers treat it as a cache miss.
        if let Some(deadline) = entry.expires_at {
            if Instant::now() >= deadline {
                guard.remove(key);
                return Ok(None);
            }
        }
        Ok(Some(entry.value))
    }

    async fn put(&self, key: &str, value: Vec<u8>, ttl: Duration) -> Result<(), CacheError> {
        if key.is_empty() {
            return Err(CacheError::InvalidKey("empty key".to_string()));
        }
        let expires_at = if ttl.is_zero() {
            None
        } else {
            Some(Instant::now() + ttl)
        };
        let mut guard = self.inner.lock().await;
        guard.insert(
            key.to_string(),
            Entry {
                value,
                expires_at,
            },
        );
        Ok(())
    }

    async fn invalidate(&self, key: &str) -> Result<(), CacheError> {
        if key.is_empty() {
            return Err(CacheError::InvalidKey("empty key".to_string()));
        }
        let mut guard = self.inner.lock().await;
        // `remove` returns `Option<V>`; we don't care — invalidate is
        // idempotent by contract.
        guard.remove(key);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn get_on_empty_cache_returns_none() {
        let cache = InMemoryCache::new();
        let result = cache.get("missing").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn put_then_get_round_trips() {
        let cache = InMemoryCache::new();
        cache
            .put("k", b"v".to_vec(), Duration::from_secs(60))
            .await
            .unwrap();
        let got = cache.get("k").await.unwrap();
        assert_eq!(got.as_deref(), Some(&b"v"[..]));
    }

    #[tokio::test]
    async fn empty_key_is_rejected() {
        let cache = InMemoryCache::new();
        assert!(matches!(
            cache.get("").await,
            Err(CacheError::InvalidKey(_))
        ));
        assert!(matches!(
            cache.put("", b"v".to_vec(), Duration::from_secs(1)).await,
            Err(CacheError::InvalidKey(_))
        ));
        assert!(matches!(
            cache.invalidate("").await,
            Err(CacheError::InvalidKey(_))
        ));
    }

    #[tokio::test]
    async fn zero_ttl_means_no_expiration() {
        let cache = InMemoryCache::new();
        cache
            .put("k", b"v".to_vec(), Duration::ZERO)
            .await
            .unwrap();
        // No sleep — even a tight loop should see the value because
        // expiration is gated on `Some(deadline)` and `Duration::ZERO`
        // collapses to `None`.
        assert_eq!(
            cache.get("k").await.unwrap().as_deref(),
            Some(&b"v"[..])
        );
    }

    #[tokio::test]
    async fn invalidate_removes_key() {
        let cache = InMemoryCache::new();
        cache
            .put("k", b"v".to_vec(), Duration::from_secs(60))
            .await
            .unwrap();
        cache.invalidate("k").await.unwrap();
        assert!(cache.get("k").await.unwrap().is_none());
    }

    #[tokio::test]
    async fn invalidate_missing_key_is_ok() {
        let cache = InMemoryCache::new();
        assert!(cache.invalidate("never-existed").await.is_ok());
    }
}
