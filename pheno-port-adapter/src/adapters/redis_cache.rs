//! [`RedisAdapter`] — RESP wire-protocol adapter for [`HexCachePort`].
//!
//! Wraps a `redis::Client` (configured with the connection URL the
//! adapter was constructed with) and lazily opens a multiplexed async
//! connection via [`redis::aio::ConnectionManager`]. The connection
//! manager transparently reconnects on transient failures, so this
//! adapter is safe to share across tasks via `Arc<RedisAdapter>`.
//!
//! ## Connection lifecycle
//!
//! - The adapter is constructed with a URL (`redis://host:port/db` or
//!   `rediss://...` for TLS); `Client::open` only parses the URL, it does
//!   not connect.
//! - The first operation opens a connection lazily and caches it in an
//!   `Arc<Mutex<Option<ConnectionManager>>>`. Subsequent operations reuse
//!   the cached connection.
//! - `ConnectionManager` handles reconnection internally; this adapter
//!   does not need explicit retry logic.
//!
//! ## TTL semantics
//!
//! - `Duration::ZERO` maps to "no expiration" (Redis `PERSIST` after
//!   `SET` is not needed; we just omit the `EX` argument).
//! - Sub-second TTLs are rounded UP to the next whole second because the
//!   Redis `EX` argument takes an integer number of seconds. Sub-second
//!   resolution would require `PEX` which is intentionally not exposed
//!   here to keep the port simple.

use std::sync::Arc;
use std::time::Duration;

use async_trait::async_trait;
use redis::AsyncCommands;
use tokio::sync::Mutex;

use crate::ports::{CacheError, HexCachePort};

/// Redis-backed adapter for [`HexCachePort`].
///
/// Cheap to clone (`Arc` internally); cloning shares the same
/// connection. Construct with [`RedisAdapter::new`] (parses the URL) or
/// [`RedisAdapter::from_client`] (re-use an externally-managed
/// `redis::Client`).
#[derive(Clone)]
pub struct RedisAdapter {
    client: redis::Client,
    // `Option` so the first operation can lazily initialize the
    // connection without paying the TCP handshake in `new()`.
    conn: Arc<Mutex<Option<redis::aio::ConnectionManager>>>,
}

impl std::fmt::Debug for RedisAdapter {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RedisAdapter")
            .field("client", &self.client)
            .finish_non_exhaustive()
    }
}

impl RedisAdapter {
    /// Parse a Redis connection URL (e.g. `redis://127.0.0.1:6379/0`).
    /// Does not connect; the first cache operation opens the connection.
    pub fn new(url: &str) -> Result<Self, CacheError> {
        let client = redis::Client::open(url).map_err(|e| {
            CacheError::Backend(format!("invalid redis url {url}: {e}"))
        })?;
        Ok(Self {
            client,
            conn: Arc::new(Mutex::new(None)),
        })
    }

    /// Re-use an already-configured `redis::Client`. Useful when the
    /// caller manages the connection pool externally.
    pub fn from_client(client: redis::Client) -> Self {
        Self {
            client,
            conn: Arc::new(Mutex::new(None)),
        }
    }

    /// Return a clonable handle to the underlying `redis::Client`.
    pub fn client(&self) -> redis::Client {
        self.client.clone()
    }

    /// Establish the multiplexed async connection (idempotent).
    async fn conn(&self) -> Result<redis::aio::ConnectionManager, CacheError> {
        let mut guard = self.conn.lock().await;
        if let Some(existing) = guard.as_ref() {
            return Ok(existing.clone());
        }
        let mgr = redis::aio::ConnectionManager::new(self.client.clone())
            .await
            .map_err(|e| CacheError::Backend(format!("redis connect: {e}")))?;
        *guard = Some(mgr.clone());
        Ok(mgr)
    }
}

#[async_trait]
impl HexCachePort for RedisAdapter {
    async fn get(&self, key: &str) -> Result<Option<Vec<u8>>, CacheError> {
        if key.is_empty() {
            return Err(CacheError::InvalidKey("empty key".to_string()));
        }
        if key.contains(' ') || key.contains('\0') {
            return Err(CacheError::InvalidKey(format!(
                "key contains forbidden byte: {key:?}"
            )));
        }
        let mut conn = self.conn().await?;
        let value: Option<Vec<u8>> = conn
            .get(key)
            .await
            .map_err(|e| CacheError::Backend(format!("redis GET {key}: {e}")))?;
        Ok(value)
    }

    async fn put(&self, key: &str, value: Vec<u8>, ttl: Duration) -> Result<(), CacheError> {
        if key.is_empty() {
            return Err(CacheError::InvalidKey("empty key".to_string()));
        }
        if key.contains(' ') || key.contains('\0') {
            return Err(CacheError::InvalidKey(format!(
                "key contains forbidden byte: {key:?}"
            )));
        }
        let mut conn = self.conn().await?;
        if ttl.is_zero() {
            // No expiration.
            let _: () = conn
                .set(key, value)
                .await
                .map_err(|e| CacheError::Backend(format!("redis SET {key}: {e}")))?;
        } else {
            // Round sub-second TTLs up to the next whole second. Redis EX
            // is integer-second only; a 100ms TTL still needs a 1s EX.
            let secs = ttl.as_secs().max(1);
            let _: () = conn
                .set_ex(key, value, secs)
                .await
                .map_err(|e| {
                    CacheError::Backend(format!("redis SETEX {key}: {e}"))
                })?;
        }
        Ok(())
    }

    async fn invalidate(&self, key: &str) -> Result<(), CacheError> {
        if key.is_empty() {
            return Err(CacheError::InvalidKey("empty key".to_string()));
        }
        let mut conn = self.conn().await?;
        // DEL returns the count of keys removed; we don't care, per the
        // idempotent-invalidate contract.
        let _: i64 = conn
            .del(key)
            .await
            .map_err(|e| CacheError::Backend(format!("redis DEL {key}: {e}")))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_rejects_malformed_url() {
        let result = RedisAdapter::new("not a redis url");
        assert!(matches!(result, Err(CacheError::Backend(_))));
    }

    #[test]
    fn new_accepts_well_formed_url_without_connecting() {
        // Construction must not connect — only parse. If this test hangs
        // or errors with a connection error, the implementation regressed.
        let adapter = RedisAdapter::new("redis://127.0.0.1:6379/0").unwrap();
        // Debug-printable so test exercises the `Debug` impl too.
        let _ = format!("{adapter:?}");
    }

    #[tokio::test]
    async fn empty_key_is_rejected() {
        let adapter = RedisAdapter::new("redis://127.0.0.1:6379/0").unwrap();
        assert!(matches!(
            adapter.get("").await,
            Err(CacheError::InvalidKey(_))
        ));
        assert!(matches!(
            adapter.put("", b"v".to_vec(), Duration::from_secs(1)).await,
            Err(CacheError::InvalidKey(_))
        ));
        assert!(matches!(
            adapter.invalidate("").await,
            Err(CacheError::InvalidKey(_))
        ));
    }
}
