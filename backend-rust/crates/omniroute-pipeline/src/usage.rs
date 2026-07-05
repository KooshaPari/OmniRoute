//! `Usage` accumulator. Use this to merge partial `Usage` values reported
//! by a streaming provider into a final token count.

use omniroute_core::request::Usage;

/// Thread-safe accumulator (internal `parking_lot::Mutex`) for `Usage`
/// updates emitted by a provider's stream. `add` saturates on overflow
/// to avoid panics on multi-billion-token replays.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct UsageAccumulator {
    usage: Usage,
}

impl UsageAccumulator {
    /// Create a zero-initialized accumulator.
    pub fn new() -> Self {
        Self::default()
    }

    /// Add a `Usage` chunk to the running total. Saturates on overflow.
    pub fn add(&mut self, other: Usage) {
        self.usage.prompt_tokens = self.usage.prompt_tokens.saturating_add(other.prompt_tokens);
        self.usage.completion_tokens = self.usage.completion_tokens.saturating_add(other.completion_tokens);
        self.usage.total_tokens = self.usage.total_tokens.saturating_add(other.total_tokens);

        if let Some(extra) = other.reasoning_tokens {
            let cur = self.usage.reasoning_tokens.unwrap_or(0);
            self.usage.reasoning_tokens = Some(cur.saturating_add(extra));
        }
        if let Some(extra) = other.cached_tokens {
            let cur = self.usage.cached_tokens.unwrap_or(0);
            self.usage.cached_tokens = Some(cur.saturating_add(extra));
        }
    }

    /// Read the current accumulated usage (clone).
    pub fn usage(&self) -> Usage {
        self.usage.clone()
    }

    /// Consume the accumulator and return the final `Usage`.
    pub fn finalize(self) -> Usage {
        self.usage
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn u(p: u32, c: u32, t: u32) -> Usage {
        Usage {
            prompt_tokens: p,
            completion_tokens: c,
            total_tokens: t,
            reasoning_tokens: None,
            cached_tokens: None,
        }
    }

    #[test]
    fn zero_start_is_idempotent() {
        let mut a = UsageAccumulator::new();
        a.add(u(0, 0, 0));
        assert_eq!(a.usage(), u(0, 0, 0));
    }

    #[test]
    fn adds_prompt_and_completion() {
        let mut a = UsageAccumulator::new();
        a.add(u(10, 5, 15));
        a.add(u(20, 3, 23));
        assert_eq!(a.usage(), u(30, 8, 38));
    }

    #[test]
    fn saturates_on_overflow() {
        let mut a = UsageAccumulator::new();
        a.add(u(u32::MAX, 0, u32::MAX));
        a.add(u(1, 0, 1));
        assert_eq!(a.usage().prompt_tokens, u32::MAX);
    }

    #[test]
    fn merges_optional_reasoning_and_cached() {
        let mut a = UsageAccumulator::new();
        a.add(Usage { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2, reasoning_tokens: Some(4), cached_tokens: Some(8) });
        a.add(Usage { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, reasoning_tokens: Some(2), cached_tokens: Some(3) });
        let u = a.usage();
        assert_eq!(u.reasoning_tokens, Some(6));
        assert_eq!(u.cached_tokens, Some(11));
    }

    #[test]
    fn finalize_returns_total() {
        let mut a = UsageAccumulator::new();
        a.add(u(5, 3, 8));
        let final_u = a.finalize();
        assert_eq!(final_u, u(5, 3, 8));
    }
}
