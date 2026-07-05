use std::collections::{HashMap, VecDeque};
pub struct LruCache<K, V> {
    capacity: usize,
    map: HashMap<K, V>,
    order: VecDeque<K>,
}
impl<K, V> LruCache<K, V>
where K: std::hash::Hash + Eq + Clone,
{
    pub fn new(capacity: usize) -> Self {
        Self { capacity: capacity.max(1), map: HashMap::new(), order: VecDeque::new() }
    }
    pub fn put(&mut self, key: K, value: V) -> Option<V> {
        let prev = self.map.insert(key.clone(), value);
        self.order.retain(|k| k != &key);
        self.order.push_back(key);
        if self.map.len() > self.capacity {
            if let Some(oldest) = self.order.pop_front() {
                self.map.remove(&oldest);
            }
        }
        prev
    }
    pub fn get(&mut self, key: &K) -> Option<&V> {
        if self.map.contains_key(key) {
            self.order.retain(|k| k != key);
            self.order.push_back(key.clone());
            self.map.get(key)
        } else {
            None
        }
    }
    pub fn peek(&self, key: &K) -> Option<&V> {
        self.map.get(key)
    }
    pub fn len(&self) -> usize { self.map.len() }
    pub fn is_empty(&self) -> bool { self.map.is_empty() }
    pub fn capacity(&self) -> usize { self.capacity }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn capacity_zero_clamped() {
        let c: LruCache<String, i32> = LruCache::new(0);
        assert_eq!(c.capacity(), 1);
    }
    #[test] fn empty() {
        let c: LruCache<i32, i32> = LruCache::new(10);
        assert!(c.is_empty());
        assert_eq!(c.len(), 0);
    }
    #[test] fn put_get() {
        let mut c: LruCache<&str, i32> = LruCache::new(3);
        c.put("a", 1);
        c.put("b", 2);
        assert_eq!(c.get(&"a"), Some(&1));
        assert_eq!(c.get(&"b"), Some(&2));
        assert_eq!(c.len(), 2);
    }
    #[test] fn eviction_at_capacity() {
        let mut c: LruCache<&str, i32> = LruCache::new(2);
        c.put("a", 1);
        c.put("b", 2);
        c.put("c", 3);
        assert_eq!(c.len(), 2);
        assert!(c.peek(&"a").is_none());
        assert!(c.peek(&"b").is_some());
        assert!(c.peek(&"c").is_some());
    }
    #[test] fn replace_value() {
        let mut c: LruCache<&str, i32> = LruCache::new(3);
        assert_eq!(c.put("a", 1), None);
        assert_eq!(c.put("a", 2), Some(1));
        assert_eq!(c.len(), 1);
    }
    #[test] fn peek_does_not_update_order() {
        let mut c: LruCache<&str, i32> = LruCache::new(2);
        c.put("a", 1);
        c.put("b", 2);
        let _ = c.peek(&"a");
        c.put("c", 3);
        // "a" was peeked (not get), so still at front; "b" should still be there
        assert!(c.peek(&"a").is_none());
        assert!(c.peek(&"b").is_some());
    }
}
