use std::collections::HashMap;
use std::time::{Duration, Instant};

pub struct CacheEntry<V> { pub value: V, pub expires_at: Instant }

pub struct TtlCache<K, V> { entries: HashMap<K, CacheEntry<V>>, default_ttl: Duration }
impl<K: std::hash::Hash + Eq + Clone, V: Clone> TtlCache<K, V> {
    pub fn new(default_ttl: Duration) -> Self { Self { entries: HashMap::new(), default_ttl } }
    pub fn put(&mut self, k: K, v: V) { self.entries.insert(k, CacheEntry { value: v, expires_at: Instant::now() + self.default_ttl }); }
    pub fn put_with_ttl(&mut self, k: K, v: V, ttl: Duration) { self.entries.insert(k, CacheEntry { value: v, expires_at: Instant::now() + ttl }); }
    pub fn get(&self, k: &K) -> Option<V> {
        self.entries.get(k).and_then(|e| if e.expires_at > Instant::now() { Some(e.value.clone()) } else { None })
    }
    pub fn invalidate(&mut self, k: &K) { self.entries.remove(k); }
    pub fn len(&self) -> usize { self.entries.len() }
    pub fn clear(&mut self) { self.entries.clear(); }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn put_and_get() { let mut c: TtlCache<&str, i32> = TtlCache::new(Duration::from_secs(60)); c.put("a", 1); assert_eq!(c.get(&"a"), Some(1)); }
    #[test] fn get_missing() { let c: TtlCache<&str, i32> = TtlCache::new(Duration::from_secs(60)); assert_eq!(c.get(&"x"), None); }
    #[test] fn invalidate() { let mut c: TtlCache<&str, i32> = TtlCache::new(Duration::from_secs(60)); c.put("a", 1); c.invalidate(&"a"); assert_eq!(c.get(&"a"), None); }
    #[test] fn expired() { let mut c: TtlCache<&str, i32> = TtlCache::new(Duration::ZERO); c.put_with_ttl("a", 1, Duration::ZERO); assert_eq!(c.get(&"a"), None); }
    #[test] fn clear_all() { let mut c: TtlCache<&str, i32> = TtlCache::new(Duration::from_secs(60)); c.put("a", 1); c.clear(); assert_eq!(c.len(), 0); }
}
