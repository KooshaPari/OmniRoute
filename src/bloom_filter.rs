pub struct BloomFilter {
    bits: Vec<u64>,
    size_bits: usize,
    hash_count: u32,
}
impl BloomFilter {
    pub fn new(capacity: usize, false_positive_rate: f64) -> Self {
        let ln2 = std::f64::consts::LN_2;
        let size_bits = (-((capacity as f64) * false_positive_rate.ln() / (ln2 * ln2))).ceil() as usize;
        let size_bits = size_bits.max(64);
        let hash_count = ((size_bits as f64 / capacity.max(1) as f64) * ln2).round().max(1.0) as u32;
        Self {
            bits: vec![0u64; (size_bits + 63) / 64],
            size_bits,
            hash_count,
        }
    }
    pub fn from_size(size_bits: usize, hash_count: u32) -> Self {
        Self { bits: vec![0u64; (size_bits + 63) / 64], size_bits, hash_count }
    }
    fn hashes<T: std::hash::Hash>(&self, item: &T) -> Vec<usize> {
        use std::hash::{BuildHasher, Hasher, RandomState};
        // Use a fixed state (zeroed seeds) for stable hashing across calls.
        static RS: std::sync::OnceLock<RandomState> = std::sync::OnceLock::new();
        let rs = RS.get_or_init(|| RandomState::new());
        let mut h1 = rs.build_hasher();
        item.hash(&mut h1);
        let a = h1.finish();
        let mut h2 = rs.build_hasher();
        item.hash(&mut h2);
        let b = h2.finish();
        (0..self.hash_count).map(|i| ((a.wrapping_add((i as u64).wrapping_mul(b))) % (self.size_bits as u64)) as usize).collect()
    }
    pub fn insert<T: std::hash::Hash>(&mut self, item: &T) {
        for pos in self.hashes(item) {
            self.bits[pos / 64] |= 1u64 << (pos % 64);
        }
    }
    pub fn contains<T: std::hash::Hash>(&self, item: &T) -> bool {
        self.hashes(item).iter().all(|&pos| (self.bits[pos / 64] >> (pos % 64)) & 1 == 1)
    }
    pub fn false_positive_estimate(&self, items_inserted: usize) -> f64 {
        let k = self.hash_count as f64;
        let m = self.size_bits as f64;
        let n = items_inserted as f64;
        (1.0 - (-k * n / m).exp()).powf(k)
    }
    pub fn len(&self) -> usize { self.size_bits }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn insert_contains() {
        let mut bf = BloomFilter::new(1000, 0.01);
        bf.insert(&"hello");
        bf.insert(&"world");
        assert!(bf.contains(&"hello"));
        assert!(bf.contains(&"world"));
        assert!(!bf.contains(&"absent"));
    }
    #[test] fn int_keys() {
        let mut bf = BloomFilter::new(100, 0.05);
        for i in 0..50 { bf.insert(&i); }
        for i in 0..50 { assert!(bf.contains(&i)); }
    }
    #[test] fn from_size() {
        let mut bf = BloomFilter::from_size(1024, 4);
        bf.insert(&"abc");
        assert!(bf.contains(&"abc"));
    }
    #[test] fn len() {
        let bf = BloomFilter::from_size(512, 3);
        assert_eq!(bf.len(), 512);
    }
    #[test] fn false_positive_low() {
        let mut bf = BloomFilter::new(10000, 0.001);
        for i in 0..1000 { bf.insert(&i); }
        let mut false_positives = 0;
        for i in 10000..20000 {
            if bf.contains(&i) { false_positives += 1; }
        }
        // should be well under 5% for proper parameters
        assert!(false_positives < 500, "fp rate too high: {}", false_positives);
    }
}
