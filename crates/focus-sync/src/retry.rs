// SPDX-License-Identifier: MIT OR Apache-2.0

//! Retry policy with exponential backoff and bounded jitter.
//!
//! Traces to: FR-CONN-003

use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryPolicy {
    pub max_attempts: u32,
    pub base_delay: Duration,
    pub max_delay: Duration,
    pub jitter: bool,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_attempts: 5,
            base_delay: Duration::from_secs(1),
            max_delay: Duration::from_secs(60),
            jitter: true,
        }
    }
}

/// Simple deterministic-ish PRNG so we avoid pulling in a rand crate.
fn pseudo_random_u64(seed: u64) -> u64 {
    // SplitMix64
    let mut z = seed.wrapping_add(0x9E37_79B9_7F4A_7C15);
    z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    z ^ (z >> 31)
}

/// Compute the delay for a given attempt (1-indexed).
///
/// Attempt 1 returns `base_delay`; attempt N returns `min(base_delay * 2^(N-1), max_delay)`.
/// With jitter, returns a uniformly random value in `[0, capped_delay]`.
pub fn next_delay(attempt: u32, policy: &RetryPolicy) -> Duration {
    if attempt == 0 {
        return Duration::ZERO;
    }
    let base = policy.base_delay.as_millis() as u64;
    let shift = (attempt - 1).min(32);
    let raw = base.saturating_mul(1u64 << shift);
    let cap = policy.max_delay.as_millis() as u64;
    let capped = raw.min(cap);

    let ms = if policy.jitter && capped > 0 {
        // Seed from attempt + nanos of base_delay to keep some variability
        let seed = (attempt as u64)
            .wrapping_mul(0x9E37_79B9_7F4A_7C15)
            .wrapping_add(policy.base_delay.as_nanos() as u64);
        let r = pseudo_random_u64(seed);
        r % (capped + 1)
    } else {
        capped
    };
    Duration::from_millis(ms)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-CONN-003
    #[test]
    fn next_delay_monotonic_without_jitter() {
        let policy = RetryPolicy {
            max_attempts: 6,
            base_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(10),
            jitter: false,
        };
        let d1 = next_delay(1, &policy);
        let d2 = next_delay(2, &policy);
        let d3 = next_delay(3, &policy);
        let d4 = next_delay(4, &policy);
        assert!(d1 <= d2);
        assert!(d2 <= d3);
        assert!(d3 <= d4);
        assert_eq!(d1, Duration::from_millis(100));
        assert_eq!(d2, Duration::from_millis(200));
        assert_eq!(d3, Duration::from_millis(400));
    }

    // Traces to: FR-CONN-003
    #[test]
    fn next_delay_capped_at_max() {
        let policy = RetryPolicy {
            max_attempts: 20,
            base_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(1),
            jitter: false,
        };
        for a in 5..15 {
            assert!(next_delay(a, &policy) <= policy.max_delay);
        }
        assert_eq!(next_delay(20, &policy), Duration::from_secs(1));
    }

    // Traces to: FR-CONN-003
    #[test]
    fn next_delay_jitter_bounded() {
        let policy = RetryPolicy {
            max_attempts: 10,
            base_delay: Duration::from_millis(100),
            max_delay: Duration::from_secs(2),
            jitter: true,
        };
        for attempt in 1..8 {
            for _ in 0..32 {
                let d = next_delay(attempt, &policy);
                assert!(d <= policy.max_delay, "jittered delay exceeded max");
            }
        }
    }

    #[test]
    fn next_delay_attempt_zero_is_zero() {
        let policy = RetryPolicy::default();
        assert_eq!(next_delay(0, &policy), Duration::ZERO);
    }
}
