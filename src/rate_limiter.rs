use std::time::{Duration, Instant};

pub struct RateLimiter { max_per_window: usize, window: Duration, hits: Vec<Instant> }
impl RateLimiter {
    pub fn new(max_per_window: usize, window: Duration) -> Self { Self { max_per_window, window, hits: Vec::new() } }
    pub fn try_acquire(&mut self) -> bool {
        let now = Instant::now();
        let cutoff = now - self.window;
        self.hits.retain(|t| *t > cutoff);
        if self.hits.len() < self.max_per_window { self.hits.push(now); true } else { false }
    }
    pub fn available(&self) -> usize { self.max_per_window.saturating_sub(self.hits.len()) }
    pub fn reset(&mut self) { self.hits.clear(); }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn allows_within() { let mut r = RateLimiter::new(3, Duration::from_secs(60)); assert!(r.try_acquire()); assert!(r.try_acquire()); assert!(r.try_acquire()); }
    #[test] fn blocks_over() { let mut r = RateLimiter::new(2, Duration::from_secs(60)); r.try_acquire(); r.try_acquire(); assert!(!r.try_acquire()); }
    #[test] fn available_decrements() { let mut r = RateLimiter::new(5, Duration::from_secs(60)); r.try_acquire(); r.try_acquire(); assert_eq!(r.available(), 3); }
    #[test] fn reset() { let mut r = RateLimiter::new(1, Duration::from_secs(60)); r.try_acquire(); r.reset(); assert!(r.try_acquire()); }
}
