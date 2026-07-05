use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

pub struct ObjectPool<T> { items: Arc<Mutex<VecDeque<T>>>, capacity: usize }
impl<T> ObjectPool<T> {
    pub fn new(capacity: usize) -> Self { Self { items: Arc::new(Mutex::new(VecDeque::new())), capacity } }
    pub fn put(&self, item: T) -> bool {
        let mut g = self.items.lock().unwrap();
        if g.len() >= self.capacity { false } else { g.push_back(item); true }
    }
    pub fn take(&self) -> Option<T> { self.items.lock().unwrap().pop_front() }
    pub fn available(&self) -> usize { self.items.lock().unwrap().len() }
    pub fn capacity(&self) -> usize { self.capacity }
    pub fn is_empty(&self) -> bool { self.available() == 0 }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn put_and_take() { let p: ObjectPool<i32> = ObjectPool::new(3); p.put(42); assert_eq!(p.take(), Some(42)); }
    #[test] fn capacity_cap() { let p: ObjectPool<i32> = ObjectPool::new(2); assert!(p.put(1)); assert!(p.put(2)); assert!(!p.put(3)); }
    #[test] fn take_empty() { let p: ObjectPool<i32> = ObjectPool::new(3); assert_eq!(p.take(), None); }
    #[test] fn fifo_order() { let p: ObjectPool<&str> = ObjectPool::new(3); p.put("a"); p.put("b"); assert_eq!(p.take(), Some("a")); assert_eq!(p.take(), Some("b")); }
    #[test] fn is_empty() { let p: ObjectPool<i32> = ObjectPool::new(3); assert!(p.is_empty()); p.put(1); assert!(!p.is_empty()); }
}
