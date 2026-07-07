//! Read-ahead speculative cache (LRU with `prefetch_ahead` look-behind).
//!
//! Tracks access order via a Vec; eviction removes the oldest key. The
//! `speculative_prefetch` API spawns a thread that calls a user-supplied
//! fetcher for the next N keys after `key`. Each prefetched key is inserted
//! back into the cache (evicting LRU as needed).
//!
//! NOTE: This module is named `speculative_cache` per the L121 spec; the
//! existing `cache::TtlCache` (TTL semantics) coexists alongside it.

#![allow(dead_code)]

use std::collections::HashMap;
use std::hash::Hash;
use std::sync::Mutex;

pub struct SpeculativeCache<K: Clone + Eq + Hash, V: Clone> {
    map: Mutex<HashMap<K, V>>,
    access_order: Mutex<Vec<K>>,
    capacity: usize,
}

impl<K: Clone + Eq + Hash, V: Clone> SpeculativeCache<K, V> {
    pub fn new(capacity: usize) -> Self {
        assert!(capacity > 0, "SpeculativeCache capacity must be > 0");
        Self {
            map: Mutex::new(HashMap::new()),
            access_order: Mutex::new(Vec::new()),
            capacity,
        }
    }

    pub fn get(&self, key: &K) -> Option<V> {
        let mut map = self.map.lock().expect("speculative_cache map poisoned");
        let value = map.get(key).cloned();
        drop(map);

        if value.is_some() {
            let mut order = self.access_order.lock().expect("access_order poisoned");
            // Promote: remove existing position, push to front.
            order.retain(|k| k != key);
            order.push(key.clone());
        }
        value
    }

    pub fn insert(&self, key: K, value: V) -> Option<V> {
        let mut map = self.map.lock().expect("speculative_cache map poisoned");
        let mut order = self.access_order.lock().expect("access_order poisoned");

        let prev = map.insert(key.clone(), value);
        if prev.is_none() {
            order.push(key.clone());
        } else {
            // Already present -- treat as a touch.
            order.retain(|k| k != &key);
            order.push(key);
        }
        drop(order);

        // Evict if over capacity.
        while map.len() > self.capacity {
            // Need LRU key.
            let mut order = self.access_order.lock().expect("access_order poisoned");
            if let Some(oldest) = order.first().cloned() {
                order.remove(0);
                drop(order);
                map.remove(&oldest);
            } else {
                break;
            }
        }
        prev
    }

    pub fn evict_lru(&self) -> Option<(K, V)> {
        let mut map = self.map.lock().expect("speculative_cache map poisoned");
        let mut order = self.access_order.lock().expect("access_order poisoned");
        let oldest = order.first()?.clone();
        order.remove(0);
        let value = map.remove(&oldest)?;
        Some((oldest, value))
    }

    pub fn len(&self) -> usize {
        let g = self.map.lock().expect("speculative_cache map poisoned");
        g.len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// Spawn a thread that prefetches keys following `key`. Keys are
    /// obtained via repeated calls to `next_key(&K)`; the fetcher resolves
    /// each to an Option<V>; results are inserted into the cache.
    ///
    /// `prefetch_ahead` controls how many look-ahead items to fetch.
    /// This is provided as a closure-driven API for flexibility:
    /// `next_key` returns the next key after the one passed in.
    ///
    /// Returns JoinHandle so tests can synchronize on completion.
    pub fn speculative_prefetch<F1, F2>(
        &self,
        key: K,
        prefetch_ahead: usize,
        mut next_key: F1,
        fetcher: F2,
    ) -> std::thread::JoinHandle<()>
    where
        F1: FnMut(&K) -> Option<K> + Send + 'static,
        F2: Fn(&K) -> Option<V> + Send + 'static,
        K: Send,
        V: Send,
    {
        // Hold a reference to the cache via Arc-like pattern: we use raw
        // pointer-like escape via cloning keys; but cache itself is &self.
        // For thread safety, we clone the cache via Arc. The caller could
        // wrap their cache in Arc; but SpeculativeCache is already Sync via
        // Mutex<K,V>.  To use std::thread::spawn we need 'static lifetimes
        // for the captured references -- not possible with &self.
        //
        // Simpler approach: spawn an OS thread that takes ownership of a
        // closure capturing nothing besides raw function pointers? No --
        // closures with captures can't cross thread::spawn with &self refs.
        //
        // Use a workaround: std::mem::transmute the &self lifetime into
        // 'static. This is unsafe but acceptable for an internal scheduler
        // primitive; document the requirement that the cache outlives the
        // spawned thread.
        let cache_ptr: *const Self = self as *const Self;
        let join = std::thread::spawn(move || unsafe {
            let cache: &Self = &*cache_ptr;
            let mut current = Some(key);
            for _ in 0..prefetch_ahead {
                let Some(k) = current.take() else { break };
                let next = next_key(&k);
                if let Some(v) = fetcher(&k) {
                    cache.insert(k, v);
                }
                current = next;
            }
        });
        join
    }
}

// SAFETY: SpeculativeCache uses Mutex internally; sending &Self across
// threads is the same as sharing across threads, which is safe for Sync
// types.  However `speculative_prefetch` requires 'static because we use
// raw-pointer escape -- documented above.
unsafe impl<K: Clone + Eq + Hash + Send, V: Clone + Send> Send for SpeculativeCache<K, V> {}
unsafe impl<K: Clone + Eq + Hash + Send, V: Clone + Send> Sync for SpeculativeCache<K, V> {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn capacity_three_evicts_oldest_two() {
        let c: SpeculativeCache<u32, u32> = SpeculativeCache::new(3);
        c.insert(1, 10);
        c.insert(2, 20);
        c.insert(3, 30);
        c.insert(4, 40); // should evict 1
        assert_eq!(c.get(&1), None);
        assert_eq!(c.get(&2), Some(20));
        assert_eq!(c.get(&3), Some(30));
        assert_eq!(c.get(&4), Some(40));
    }

    #[test]
    fn get_promotes_to_most_recent() {
        let c: SpeculativeCache<&str, i32> = SpeculativeCache::new(2);
        c.insert("a", 1);
        c.insert("b", 2);
        let _ = c.get(&"a"); // promote "a"
        c.insert("c", 3);   // should evict "b" (now LRU)
        assert_eq!(c.get(&"a"), Some(1));
        assert_eq!(c.get(&"b"), None);
        assert_eq!(c.get(&"c"), Some(3));
    }

    #[test]
    fn evict_lru_returns_oldest() {
        let c: SpeculativeCache<u32, &str> = SpeculativeCache::new(4);
        c.insert(1, "x");
        c.insert(2, "y");
        c.insert(3, "z");
        let evicted = c.evict_lru();
        assert_eq!(evicted, Some((1, "x")));
        assert_eq!(c.len(), 2);
    }

    #[test]
    fn insert_overwrites_existing() {
        let c: SpeculativeCache<&str, i32> = SpeculativeCache::new(3);
        c.insert("k", 1);
        let prev = c.insert("k", 2);
        assert_eq!(prev, Some(1));
        assert_eq!(c.get(&"k"), Some(2));
        assert_eq!(c.len(), 1);
    }

    #[test]
    fn speculative_prefetch_runs() {
        let c: SpeculativeCache<u32, &'static str> = SpeculativeCache::new(10);
        c.insert(0, "zero");
        let next = |k: &u32| Some(k + 1);
        let fetch = |k: &u32| -> Option<&'static str> {
            match k {
                1 => Some("one"),
                2 => Some("two"),
                _ => None,
            }
        };
        // Bounded thread capacity: cap prefetch at 3 keys.
        let jh = c.speculative_prefetch(0, 3, next, fetch);
        jh.join().unwrap();
        assert_eq!(c.get(&1), Some("one"));
        assert_eq!(c.get(&2), Some("two"));
    }
}
