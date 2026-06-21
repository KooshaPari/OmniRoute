// SPDX-License-Identifier: MIT OR Apache-2.0

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::RwLock;
use std::time::Instant;

/// Token bucket for per-IP rate limiting
#[derive(Clone, Debug)]
struct TokenBucket {
    tokens: f64,
    last_refill: Instant,
    capacity: f64,
    refill_per_sec: f64,
}

impl TokenBucket {
    fn new(capacity: f64, refill_per_sec: f64) -> Self {
        Self {
            tokens: capacity,
            last_refill: Instant::now(),
            capacity,
            refill_per_sec,
        }
    }

    /// Lazily refill tokens based on elapsed time
    fn refill(&mut self) {
        let now = Instant::now();
        let elapsed = now.duration_since(self.last_refill).as_secs_f64();
        self.tokens = (self.tokens + elapsed * self.refill_per_sec).min(self.capacity);
        self.last_refill = now;
    }

    /// Check if a token can be consumed; returns true if allowed
    fn allow(&mut self) -> bool {
        self.refill();
        if self.tokens >= 1.0 {
            self.tokens -= 1.0;
            true
        } else {
            false
        }
    }
}

/// Simple per-IP rate limiter: 100 req/min = 100.0/60.0 tokens/sec
pub struct RateLimiter {
    buckets: RwLock<HashMap<IpAddr, TokenBucket>>,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            buckets: RwLock::new(HashMap::new()),
        }
    }

    /// Check if the given IP is allowed to make a request
    pub fn allow(&self, ip: IpAddr) -> bool {
        let mut buckets = self.buckets.write().unwrap();
        let bucket = buckets
            .entry(ip)
            .or_insert_with(|| TokenBucket::new(100.0, 100.0 / 60.0));
        bucket.allow()
    }
}

impl Default for RateLimiter {
    fn default() -> Self {
        Self::new()
    }
}
