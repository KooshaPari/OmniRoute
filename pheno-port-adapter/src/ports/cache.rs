//! [`HexCachePort`] — async key/value cache port.
//!
//! This is the *port* (hexagonal "P") for cache access. Adapters in
//! `crate::adapters` (in-memory, Redis, memcached, ...) provide concrete
//! implementations; application code depends only on this trait.
//!
//! ## Contract
//!
//! Adapters MUST uphold:
//!
//! - `get` returns `Ok(None)` when the key is absent, `Ok(Some(_))` when
//!   present, and `Err(CacheError::Backend(_))` on a transport/backend
//!   failure. `Err(CacheError::Backend(_))` MUST NOT be returned for
//!   ordinary cache misses.
//! - `put` with `ttl == Duration::ZERO` is treated as "no expiration" and
//!   stored forever (or until explicit `invalidate`). Adapters that cannot
//!   store indefinitely MUST round up to their minimum-supported TTL.
//! - `put` returns `Err(CacheError::Backend(_))` on failure and `Ok(())`
//!   on success. A successful `put` does NOT guarantee a subsequent `get`
//!   from another process — only the same adapter instance's guarantees
//!   are defined here. Cross-instance consistency is the caller's job.
//! - `invalidate` is idempotent: deleting a missing key returns `Ok(())`.
//!
//! ## Out of scope
//!
//! - Atomic get-or-set (e.g. SETNX). Callers compose `get` + conditional
//!   `put` if they need it.
//! - Listing keys / SCAN-style iteration. Add a separate port if needed.
//! - Serialization. Values are opaque `Vec<u8>`; serialization is the
//!   caller's concern (serde_json, rmp_serde, bincode, ...).
//!
//! ## Errors
//!
//! [`CacheError`] is the single error type for the port. Adapters map
//! their backend-specific errors into one of the variants:
//!
//! - [`CacheError::Backend`] — transport/server failure.
//! - [`CacheError::InvalidKey`] — caller passed an empty key or one that
//!   the adapter rejects (e.g. Redis keys with NUL or whitespace).
//! - [`CacheError::Serialization`] — adapter-side serialization failure
//!   (currently unused; reserved for future adapters that serialize
//!   internally).

use std::time::Duration;

use async_trait::async_trait;

/// Error type for [`HexCachePort`] operations.
#[derive(Debug, thiserror::Error)]
pub enum CacheError {
    /// Backend / transport failure (connection refused, timeout, OOM, ...).
    #[error("cache backend error: {0}")]
    Backend(String),
    /// Caller passed an invalid key (empty, contains forbidden bytes, ...).
    #[error("invalid cache key: {0}")]
    InvalidKey(String),
    /// Reserved for adapters that perform serialization internally.
    /// Currently unused by the in-tree adapters (values are passed as raw
    /// `Vec<u8>` and serialization is the caller's job).
    #[error("serialization error: {0}")]
    Serialization(String),
}

/// Async key/value cache port (hexagonal "P").
///
/// `Send + Sync` is required so the trait can be stored in
/// `Arc<dyn HexCachePort>` and shared across async tasks on a multi-thread
/// runtime.
///
/// Adapters implement this trait via `#[async_trait]` to keep the trait
/// object-safe (callers may want `Box<dyn HexCachePort>` for late binding).
#[async_trait]
pub trait HexCachePort: Send + Sync {
    /// Fetch the value for `key`. Returns `Ok(None)` on cache miss.
    async fn get(&self, key: &str) -> Result<Option<Vec<u8>>, CacheError>;

    /// Store `value` under `key` with the given `ttl`. Use
    /// `Duration::ZERO` for "no expiration".
    async fn put(&self, key: &str, value: Vec<u8>, ttl: Duration) -> Result<(), CacheError>;

    /// Remove `key` from the cache. Idempotent: removing a missing key
    /// returns `Ok(())`.
    async fn invalidate(&self, key: &str) -> Result<(), CacheError>;
}
