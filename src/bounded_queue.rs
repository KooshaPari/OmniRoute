//! Backpressure-aware bounded queue.
//!
//! NOTE: Named `bounded_queue` (not `queue`) to avoid collision with the
//! existing `queue::TaskQueue` module already present in sharecli.
//! Both modules belong to the hypervisor/scheduler primitive layer
//! specified in L121; the spec describes a BoundedQueue, which we expose
//! under this precise name.

#![allow(clippy::len_without_is_empty)]
#![allow(clippy::result_unit_err)]

use std::collections::VecDeque;
use std::sync::Mutex;

/// Returned when push would exceed `capacity`. Contains the rejected value
/// so the caller can retry, drop, or escalate.
#[derive(Debug)]
pub struct QueueFullError<T>(pub T);

impl<T> std::fmt::Display for QueueFullError<T> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "queue full")
    }
}

impl<T: std::fmt::Debug> std::error::Error for QueueFullError<T> {}

pub struct BoundedQueue<T> {
    items: Mutex<VecDeque<T>>,
    capacity: usize,
}

impl<T> BoundedQueue<T> {
    pub fn new(capacity: usize) -> Self {
        assert!(capacity > 0, "BoundedQueue capacity must be > 0");
        Self {
            items: Mutex::new(VecDeque::with_capacity(capacity)),
            capacity,
        }
    }

    pub fn push(&self, value: T) -> Result<(), QueueFullError<T>> {
        let mut g = self.items.lock().expect("bounded_queue mutex poisoned");
        if g.len() >= self.capacity {
            return Err(QueueFullError(value));
        }
        g.push_back(value);
        Ok(())
    }

    pub fn pop(&self) -> Option<T> {
        let mut g = self.items.lock().expect("bounded_queue mutex poisoned");
        g.pop_front()
    }

    pub fn len(&self) -> usize {
        let g = self.items.lock().expect("bounded_queue mutex poisoned");
        g.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn is_full(&self) -> bool {
        let g = self.items.lock().expect("bounded_queue mutex poisoned");
        g.len() >= self.capacity
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_until_full_then_err() {
        let q: BoundedQueue<u32> = BoundedQueue::new(3);
        assert!(q.push(1).is_ok());
        assert!(q.push(2).is_ok());
        assert!(q.push(3).is_ok());
        match q.push(4) {
            Err(QueueFullError(v)) => assert_eq!(v, 4),
            Ok(()) => panic!("expected Err when full"),
        }
        assert!(q.is_full());
        assert_eq!(q.len(), 3);
    }

    #[test]
    fn pop_fifo() {
        let q: BoundedQueue<&str> = BoundedQueue::new(5);
        q.push("a").unwrap();
        q.push("b").unwrap();
        assert_eq!(q.pop(), Some("a"));
        assert_eq!(q.pop(), Some("b"));
        assert_eq!(q.pop(), None);
    }

    #[test]
    fn pop_frees_capacity() {
        let q: BoundedQueue<i32> = BoundedQueue::new(2);
        q.push(1).unwrap();
        q.push(2).unwrap();
        assert!(q.is_full());
        assert_eq!(q.pop(), Some(1));
        assert!(!q.is_full());
        assert!(q.push(3).is_ok());
    }

    #[test]
    fn is_empty_basic() {
        let q: BoundedQueue<u8> = BoundedQueue::new(4);
        assert!(q.is_empty());
        q.push(7).unwrap();
        assert!(!q.is_empty());
    }

    #[test]
    #[should_panic]
    fn zero_capacity_panics_on_construct() {
        let _: BoundedQueue<u32> = BoundedQueue::new(0);
    }
}
