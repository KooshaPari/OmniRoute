//! Coalescer: combine N rapid-fire events into 1 emission within a time window.
//!
//! Trailing-edge coalescing. The first event in a quiet window emits;
//! subsequent events within `window` are absorbed. `drain()` returns the
//! pending value when the window has elapsed since the last push.

#![allow(clippy::needless_collect)]

use std::sync::Mutex;
use std::time::{Duration, Instant};

pub struct Coalescer<T: Clone> {
    state: Mutex<Option<(T, Instant)>>,
    window: Duration,
}

impl<T: Clone> Coalescer<T> {
    pub fn new(window: Duration) -> Self {
        Self {
            state: Mutex::new(None),
            window,
        }
    }

    /// Push a value. Returns `Some(value)` if this is the first event in the
    /// current window (caller should emit). Returns `None` if the value was
    /// absorbed into the pending slot.
    pub fn push(&self, value: T) -> Option<T> {
        let now = Instant::now();
        let mut guard = self.state.lock().expect("coalescer mutex poisoned");
        match guard.as_ref() {
            Some((_, last)) if now.duration_since(*last) < self.window => {
                // Replace the buffered value (last-write-wins semantics).
                *guard = Some((value, *last));
                None
            }
            _ => {
                *guard = Some((value.clone(), now));
                Some(value)
            }
        }
    }

    /// Returns the buffered value if its window has elapsed, draining it.
    pub fn drain(&self) -> Option<T> {
        let now = Instant::now();
        let mut guard = self.state.lock().expect("coalescer mutex poisoned");
        match guard.as_ref() {
            Some((_, last)) if now.duration_since(*last) >= self.window => {
                let (v, _) = guard.take().unwrap();
                Some(v)
            }
            _ => None,
        }
    }

    pub fn window(&self) -> Duration {
        self.window
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread::sleep;
    use std::sync::{Arc, Mutex as StdMutex};

    #[test]
    fn first_event_emits() {
        let c: Coalescer<u32> = Coalescer::new(Duration::from_millis(50));
        assert_eq!(c.push(1), Some(1));
    }

    #[test]
    fn rapid_pushes_coalesce() {
        let window = Duration::from_millis(50);
        let c: Coalescer<u32> = Coalescer::new(window);
        let mut emitted = 0;
        for i in 0..100 {
            if c.push(i).is_some() {
                emitted += 1;
            }
        }
        assert_eq!(emitted, 1, "100 rapid pushes should coalesce to 1 emission");
    }

    #[test]
    fn drain_returns_after_window() {
        let c: Coalescer<&'static str> = Coalescer::new(Duration::from_millis(10));
        let _ = c.push("hello");
        assert!(c.drain().is_none(), "drain before window expired returns None");
        sleep(Duration::from_millis(15));
        assert_eq!(c.drain(), Some("hello"));
    }

    #[test]
    fn drain_resets_window() {
        let c: Coalescer<u32> = Coalescer::new(Duration::from_millis(10));
        let _ = c.push(7);
        sleep(Duration::from_millis(15));
        assert_eq!(c.drain(), Some(7));
        // After drain, the slot is empty — drain returns None.
        assert!(c.drain().is_none());
    }

    #[test]
    fn concurrent_pushes_are_safe() {
        let c: Arc<Coalescer<u32>> = Arc::new(Coalescer::new(Duration::from_millis(500)));
        let count: Arc<StdMutex<u32>> = Arc::new(StdMutex::new(0));
        let mut handles = vec![];
        for tid in 0..4 {
            let c = Arc::clone(&c);
            let count = Arc::clone(&count);
            handles.push(std::thread::spawn(move || {
                for i in 0..50 {
                    if c.push((tid * 1000 + i) as u32).is_some() {
                        *count.lock().unwrap() += 1;
                    }
                }
            }));
        }
        for h in handles {
            h.join().unwrap();
        }
        // At most a small handful of emissions despite 200 pushes.
        let n = *count.lock().unwrap();
        assert!(n <= 4, "expected <=4 emissions under contention, got {}", n);
    }
}
