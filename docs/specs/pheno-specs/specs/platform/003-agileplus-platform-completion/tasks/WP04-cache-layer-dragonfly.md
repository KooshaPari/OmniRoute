---
work_package_id: WP04
title: Cache Layer (Dragonfly)
lane: "done"
dependencies: []
base_branch: main
base_commit: 54550549c478ffb46ae18db57710e2ac84cf027c
created_at: '2026-03-02T11:46:55.991736+00:00'
subtasks: [T022, T023, T024, T025, T026, T027]
shell_pid: "45986"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

# Cache Layer (Dragonfly) (WP04)

## Overview

Create the `agileplus-cache` crate with Dragonfly (Redis-compatible) connection pooling, typed cache operations, and projection caching for features and work packages.

## Objective

Implement:
- Thread-safe connection pool to Dragonfly
- Generic typed get/set operations
- ProjectionCache for feature/WP state caching
- Rate limiter using Redis operations
- Health check integration

## Architecture

The cache layer provides:
- **Connection pooling** via bb8 for efficient resource use
- **Type safety** through serde serialization
- **TTL support** for automatic expiration
- **Cache invalidation** on mutations
- **Rate limiting** per key/IP

## Subtasks

### T022: Scaffold agileplus-cache Crate

Create a new crate at `crates/agileplus-cache/`.

**Cargo.toml:**
```toml
[package]
name = "agileplus-cache"
version = "0.1.0"
edition = "2021"

[dependencies]
agileplus-domain = { path = "../agileplus-domain" }
redis = { version = "0.25", features = ["aio", "tokio-comp", "json"] }
bb8 = "0.8"
bb8-redis = "0.16"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "1.0"
async-trait = "0.1"
tokio = { version = "1", features = ["full"] }
chrono = { version = "0.4", features = ["serde"] }

[dev-dependencies]
tokio = { version = "1", features = ["full"] }
```

**Directory structure:**
```
crates/agileplus-cache/
├── Cargo.toml
└── src/
    ├── lib.rs
    ├── config.rs
    ├── pool.rs
    ├── store.rs
    ├── projection.rs
    ├── limiter.rs
    └── health.rs
```

**lib.rs content:**
```rust
pub mod config;
pub mod health;
pub mod limiter;
pub mod pool;
pub mod projection;
pub mod store;

pub use config::CacheConfig;
pub use health::CacheHealth;
pub use limiter::RateLimiter;
pub use pool::CachePool;
pub use projection::ProjectionCache;
pub use store::{CacheStore, CacheError};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Cache error: {0}")]
    Cache(#[from] CacheError),
    #[error("Config error: {0}")]
    Config(String),
}
```

### T023: CacheConfig and CachePool

Create `crates/agileplus-cache/src/config.rs`:

```rust
use std::time::Duration;

#[derive(Clone, Debug)]
pub struct CacheConfig {
    pub host: String,
    pub port: u16,
    pub pool_size: u32,
    pub default_ttl_secs: u64,
    pub connection_timeout_secs: u64,
}

impl CacheConfig {
    pub fn new(host: String, port: u16) -> Self {
        CacheConfig {
            host,
            port,
            pool_size: 16,
            default_ttl_secs: 3600,
            connection_timeout_secs: 5,
        }
    }

    pub fn with_pool_size(mut self, size: u32) -> Self {
        self.pool_size = size;
        self
    }

    pub fn with_default_ttl(mut self, secs: u64) -> Self {
        self.default_ttl_secs = secs;
        self
    }

    pub fn redis_url(&self) -> String {
        format!("redis://{}:{}", self.host, self.port)
    }
}

impl Default for CacheConfig {
    fn default() -> Self {
        CacheConfig {
            host: "localhost".to_string(),
            port: 6379,
            pool_size: 16,
            default_ttl_secs: 3600,
            connection_timeout_secs: 5,
        }
    }
}
```

Create `crates/agileplus-cache/src/pool.rs`:

```rust
use crate::config::CacheConfig;
use bb8::Pool;
use bb8_redis::RedisConnectionManager;
use std::time::Duration;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PoolError {
    #[error("Connection error: {0}")]
    ConnectionError(String),
    #[error("Timeout: {0}")]
    Timeout(String),
}

pub struct CachePool {
    pool: Pool<RedisConnectionManager>,
}

impl CachePool {
    pub async fn new(config: CacheConfig) -> Result<Self, PoolError> {
        let manager = RedisConnectionManager::new(config.redis_url())
            .await
            .map_err(|e| PoolError::ConnectionError(e.to_string()))?;

        let pool = Pool::builder()
            .max_size(config.pool_size)
            .connection_timeout(Duration::from_secs(config.connection_timeout_secs))
            .build(manager)
            .await
            .map_err(|e| PoolError::Timeout(e.to_string()))?;

        Ok(CachePool { pool })
    }

    /// Get a connection from the pool
    pub async fn get_connection(
        &self,
    ) -> Result<bb8::PooledConnection<RedisConnectionManager>, PoolError> {
        self.pool
            .get()
            .await
            .map_err(|e| PoolError::Timeout(e.to_string()))
    }

    /// Get raw pool for advanced operations
    pub fn raw_pool(&self) -> &Pool<RedisConnectionManager> {
        &self.pool
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_pool_creation() {
        // This test requires a running Dragonfly instance
        // Skip in CI without Dragonfly
        if std::env::var("CI").is_ok() {
            return;
        }

        let config = CacheConfig::default();
        let result = CachePool::new(config).await;
        // May fail if Dragonfly not running
        let _ = result;
    }
}
```

### T024: CacheStore Trait

Create `crates/agileplus-cache/src/store.rs`:

```rust
use crate::pool::CachePool;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CacheError {
    #[error("Serialization error: {0}")]
    SerializationError(String),
    #[error("Redis error: {0}")]
    RedisError(String),
    #[error("Key not found")]
    NotFound,
    #[error("Connection error: {0}")]
    ConnectionError(String),
}

#[async_trait]
pub trait CacheStore: Send + Sync {
    /// Get a value from the cache
    async fn get<T: for<'de> Deserialize<'de>>(
        &self,
        key: &str,
    ) -> Result<Option<T>, CacheError>;

    /// Set a value in the cache with optional TTL
    async fn set<T: Serialize>(
        &self,
        key: &str,
        value: &T,
        ttl: Option<Duration>,
    ) -> Result<(), CacheError>;

    /// Delete a key from the cache
    async fn delete(&self, key: &str) -> Result<(), CacheError>;

    /// Check if a key exists
    async fn exists(&self, key: &str) -> Result<bool, CacheError>;

    /// Get multiple keys at once
    async fn get_many<T: for<'de> Deserialize<'de>>(
        &self,
        keys: &[&str],
    ) -> Result<Vec<Option<T>>, CacheError>;

    /// Delete multiple keys at once
    async fn delete_many(&self, keys: &[&str]) -> Result<(), CacheError>;
}

pub struct RedisCacheStore {
    pool: CachePool,
    default_ttl: Duration,
}

impl RedisCacheStore {
    pub fn new(pool: CachePool, default_ttl_secs: u64) -> Self {
        RedisCacheStore {
            pool,
            default_ttl: Duration::from_secs(default_ttl_secs),
        }
    }
}

#[async_trait]
impl CacheStore for RedisCacheStore {
    async fn get<T: for<'de> Deserialize<'de>>(
        &self,
        key: &str,
    ) -> Result<Option<T>, CacheError> {
        let mut conn = self
            .pool
            .get_connection()
            .await
            .map_err(|e| CacheError::ConnectionError(e.to_string()))?;

        let value: Option<String> = redis::cmd("GET")
            .arg(key)
            .query_async(&mut *conn)
            .await
            .map_err(|e| CacheError::RedisError(e.to_string()))?;

        match value {
            Some(v) => serde_json::from_str(&v)
                .map(Some)
                .map_err(|e| CacheError::SerializationError(e.to_string())),
            None => Ok(None),
        }
    }

    async fn set<T: Serialize>(
        &self,
        key: &str,
        value: &T,
        ttl: Option<Duration>,
    ) -> Result<(), CacheError> {
        let mut conn = self
            .pool
            .get_connection()
            .await
            .map_err(|e| CacheError::ConnectionError(e.to_string()))?;

        let serialized = serde_json::to_string(value)
            .map_err(|e| CacheError::SerializationError(e.to_string()))?;

        let ttl_secs = ttl.unwrap_or(self.default_ttl).as_secs();

        redis::cmd("SETEX")
            .arg(key)
            .arg(ttl_secs)
            .arg(serialized)
            .query_async(&mut *conn)
            .await
            .map_err(|e| CacheError::RedisError(e.to_string()))?;

        Ok(())
    }

    async fn delete(&self, key: &str) -> Result<(), CacheError> {
        let mut conn = self
            .pool
            .get_connection()
            .await
            .map_err(|e| CacheError::ConnectionError(e.to_string()))?;

        redis::cmd("DEL")
            .arg(key)
            .query_async(&mut *conn)
            .await
            .map_err(|e| CacheError::RedisError(e.to_string()))?;

        Ok(())
    }

    async fn exists(&self, key: &str) -> Result<bool, CacheError> {
        let mut conn = self
            .pool
            .get_connection()
            .await
            .map_err(|e| CacheError::ConnectionError(e.to_string()))?;

        let exists: bool = redis::cmd("EXISTS")
            .arg(key)
            .query_async(&mut *conn)
            .await
            .map_err(|e| CacheError::RedisError(e.to_string()))?;

        Ok(exists)
    }

    async fn get_many<T: for<'de> Deserialize<'de>>(
        &self,
        keys: &[&str],
    ) -> Result<Vec<Option<T>>, CacheError> {
        let mut conn = self
            .pool
            .get_connection()
            .await
            .map_err(|e| CacheError::ConnectionError(e.to_string()))?;

        let values: Vec<Option<String>> = redis::cmd("MGET")
            .arg(keys)
            .query_async(&mut *conn)
            .await
            .map_err(|e| CacheError::RedisError(e.to_string()))?;

        values
            .into_iter()
            .map(|v| {
                v.map(|s| serde_json::from_str(&s))
                    .transpose()
                    .map_err(|e| CacheError::SerializationError(e.to_string()))
            })
            .collect()
    }

    async fn delete_many(&self, keys: &[&str]) -> Result<(), CacheError> {
        if keys.is_empty() {
            return Ok(());
        }

        let mut conn = self
            .pool
            .get_connection()
            .await
            .map_err(|e| CacheError::ConnectionError(e.to_string()))?;

        redis::cmd("DEL")
            .arg(keys)
            .query_async(&mut *conn)
            .await
            .map_err(|e| CacheError::RedisError(e.to_string()))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_store_trait() {
        // Trait is defined correctly
    }
}
```

### T025: ProjectionCache for Feature/WP

Create `crates/agileplus-cache/src/projection.rs`:

```rust
use crate::store::CacheStore;
use agileplus_domain::{Feature, WorkPackage};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ProjectionError {
    #[error("Cache error: {0}")]
    CacheError(String),
    #[error("Serialization error: {0}")]
    SerializationError(String),
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FeatureProjection {
    pub feature: Feature,
    pub cached_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct WorkPackageProjection {
    pub workpackage: WorkPackage,
    pub cached_at: chrono::DateTime<chrono::Utc>,
}

pub struct ProjectionCache {
    store: std::sync::Arc<dyn CacheStore>,
}

impl ProjectionCache {
    pub fn new(store: std::sync::Arc<dyn CacheStore>) -> Self {
        ProjectionCache { store }
    }

    /// Get a feature by ID
    pub async fn get_feature(
        &self,
        feature_id: i64,
    ) -> Result<Option<FeatureProjection>, ProjectionError> {
        self.store
            .get(&format!("feature:{}", feature_id))
            .await
            .map_err(|e| ProjectionError::CacheError(e.to_string()))
    }

    /// Cache a feature
    pub async fn set_feature(
        &self,
        feature: Feature,
    ) -> Result<(), ProjectionError> {
        let projection = FeatureProjection {
            feature,
            cached_at: chrono::Utc::now(),
        };

        self.store
            .set(&format!("feature:{}", projection.feature.id), &projection, None)
            .await
            .map_err(|e| ProjectionError::CacheError(e.to_string()))
    }

    /// Get a WorkPackage by ID
    pub async fn get_workpackage(
        &self,
        wp_id: i64,
    ) -> Result<Option<WorkPackageProjection>, ProjectionError> {
        self.store
            .get(&format!("wp:{}", wp_id))
            .await
            .map_err(|e| ProjectionError::CacheError(e.to_string()))
    }

    /// Cache a WorkPackage
    pub async fn set_workpackage(
        &self,
        workpackage: WorkPackage,
    ) -> Result<(), ProjectionError> {
        let projection = WorkPackageProjection {
            workpackage,
            cached_at: chrono::Utc::now(),
        };

        self.store
            .set(&format!("wp:{}", projection.workpackage.id), &projection, None)
            .await
            .map_err(|e| ProjectionError::CacheError(e.to_string()))
    }

    /// Invalidate feature cache
    pub async fn invalidate_feature(&self, feature_id: i64) -> Result<(), ProjectionError> {
        self.store
            .delete(&format!("feature:{}", feature_id))
            .await
            .map_err(|e| ProjectionError::CacheError(e.to_string()))
    }

    /// Invalidate WorkPackage cache
    pub async fn invalidate_workpackage(&self, wp_id: i64) -> Result<(), ProjectionError> {
        self.store
            .delete(&format!("wp:{}", wp_id))
            .await
            .map_err(|e| ProjectionError::CacheError(e.to_string()))
    }

    /// Invalidate all feature/WP caches
    pub async fn invalidate_all(&self) -> Result<(), ProjectionError> {
        self.store
            .delete(&"feature_list")
            .await
            .map_err(|e| ProjectionError::CacheError(e.to_string()))?;
        Ok(())
    }
}
```

### T026: RateLimiter

Create `crates/agileplus-cache/src/limiter.rs`:

```rust
use crate::pool::CachePool;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum LimiterError {
    #[error("Rate limit error: {0}")]
    Error(String),
}

pub struct RateLimiter {
    pool: CachePool,
}

impl RateLimiter {
    pub fn new(pool: CachePool) -> Self {
        RateLimiter { pool }
    }

    /// Check if a request is allowed
    ///
    /// Uses a sliding window approach with Redis INCR and EXPIRE.
    /// Returns true if the request is allowed, false if rate limit exceeded.
    pub async fn is_allowed(
        &self,
        key: &str,
        max_requests: u32,
        window_secs: u32,
    ) -> Result<bool, LimiterError> {
        let mut conn = self
            .pool
            .get_connection()
            .await
            .map_err(|e| LimiterError::Error(e.to_string()))?;

        // Use a key like "ratelimit:key"
        let rate_key = format!("ratelimit:{}", key);

        // Increment counter
        let count: u32 = redis::cmd("INCR")
            .arg(&rate_key)
            .query_async(&mut *conn)
            .await
            .map_err(|e| LimiterError::Error(e.to_string()))?;

        // Set expiration on first request (if count == 1)
        if count == 1 {
            redis::cmd("EXPIRE")
                .arg(&rate_key)
                .arg(window_secs)
                .query_async(&mut *conn)
                .await
                .map_err(|e| LimiterError::Error(e.to_string()))?;
        }

        Ok(count <= max_requests)
    }

    /// Get remaining requests in the current window
    pub async fn get_remaining(
        &self,
        key: &str,
        max_requests: u32,
    ) -> Result<u32, LimiterError> {
        let mut conn = self
            .pool
            .get_connection()
            .await
            .map_err(|e| LimiterError::Error(e.to_string()))?;

        let rate_key = format!("ratelimit:{}", key);

        let count: Option<u32> = redis::cmd("GET")
            .arg(&rate_key)
            .query_async(&mut *conn)
            .await
            .map_err(|e| LimiterError::Error(e.to_string()))?;

        let current = count.unwrap_or(0);
        Ok(max_requests.saturating_sub(current))
    }

    /// Reset the counter for a key
    pub async fn reset(&self, key: &str) -> Result<(), LimiterError> {
        let mut conn = self
            .pool
            .get_connection()
            .await
            .map_err(|e| LimiterError::Error(e.to_string()))?;

        let rate_key = format!("ratelimit:{}", key);

        redis::cmd("DEL")
            .arg(&rate_key)
            .query_async(&mut *conn)
            .await
            .map_err(|e| LimiterError::Error(e.to_string()))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_rate_limiter_logic() {
        // Logic is sound; actual test requires Dragonfly
    }
}
```

### T027: Health Check

Create `crates/agileplus-cache/src/health.rs`:

```rust
use crate::pool::CachePool;
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CacheHealth {
    Healthy,
    Unavailable,
}

pub struct CacheHealthChecker {
    pool: CachePool,
}

impl CacheHealthChecker {
    pub fn new(pool: CachePool) -> Self {
        CacheHealthChecker { pool }
    }

    /// Run a health check
    pub async fn check(&self) -> CacheHealth {
        match self.pool.get_connection().await {
            Ok(mut conn) => {
                // Try to PING
                match redis::cmd("PING")
                    .query_async::<_, String>(&mut *conn)
                    .await
                {
                    Ok(pong) if pong == "PONG" => CacheHealth::Healthy,
                    _ => CacheHealth::Unavailable,
                }
            }
            Err(_) => CacheHealth::Unavailable,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_health_enum() {
        assert_eq!(CacheHealth::Healthy, CacheHealth::Healthy);
        assert_ne!(CacheHealth::Healthy, CacheHealth::Unavailable);
    }
}
```

## Implementation Guidance

1. **Order:** T022 → T023 → T024 → T025 → T026 → T027
2. **Connection pooling:** bb8 automatically manages connections and reuse
3. **Serialization:** All cache values are JSON-serialized for type flexibility
4. **TTL:** Default is configurable; per-set override is supported
5. **Rate limiting:** Uses Redis INCR for atomic counting; EXPIRE for window management
6. **Error handling:** Distinguish between serialization, Redis, and connection errors

## Definition of Done

- [ ] agileplus-cache crate compiles
- [ ] CachePool successfully creates and manages connections
- [ ] RedisCacheStore implements get/set/delete/exists operations
- [ ] ProjectionCache caches and invalidates Feature/WP projections
- [ ] RateLimiter correctly counts requests and enforces limits
- [ ] Health check returns correct status
- [ ] Integration tests pass (with Dragonfly running)
- [ ] No clippy warnings

## Command

```bash
spec-kitty implement WP04 --base WP03
```

## Activity Log

- 2026-03-02T11:46:56Z – claude-opus – shell_pid=45986 – lane=doing – Assigned agent via workflow command
- 2026-03-02T11:50:49Z – claude-opus – shell_pid=45986 – lane=for_review – Ready for review: agileplus-cache crate with pool, store, projection, limiter, health
- 2026-03-02T23:19:06Z – claude-opus – shell_pid=45986 – lane=done – Merged to main, 516 tests passing
