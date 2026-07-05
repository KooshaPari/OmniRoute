// Minimal xxHash-style non-cryptographic hash (NOT the official xxHash3 — this is a simpler variant
// inspired by FNV + Mix functions). Adequate for hash tables and checksums, not for collision-resistance guarantees.
const P1: u64 = 0x9e3779b97f4a7c15;
const P2: u64 = 0xc2b2ae3d27d4eb4f;
const P3: u64 = 0x165667b19e3779f9;

pub struct XxHash64 {
    acc: [u64; 4],
    buf: [u8; 32],
    buf_len: usize,
    total_len: u64,
    seed: u64,
}
impl XxHash64 {
    pub fn new(seed: u64) -> Self {
        Self {
            acc: [seed.wrapping_add(P1).wrapping_add(P2), seed.wrapping_add(P2), seed.wrapping_add(0), seed.wrapping_sub(P1)],
            buf: [0u8; 32],
            buf_len: 0,
            total_len: 0,
            seed,
        }
    }
    pub fn update(&mut self, data: &[u8]) {
        self.total_len = self.total_len.wrapping_add(data.len() as u64);
        let mut i = 0;
        while self.buf_len + (data.len() - i) >= 32 {
            let need = 32 - self.buf_len;
            self.buf[self.buf_len..32].copy_from_slice(&data[i..i + need]);
            self.consume_stripe();
            i += need;
            self.buf_len = 0;
        }
        let rem = data.len() - i;
        self.buf[self.buf_len..self.buf_len + rem].copy_from_slice(&data[i..]);
        self.buf_len += rem;
    }
    fn consume_stripe(&mut self) {
        for n in 0..4 {
            let v = read_u64(&self.buf[n*8..n*8+8]);
            self.acc[n] = round(self.acc[n], v);
        }
    }
    pub fn finalize(mut self) -> u64 {
        if self.total_len < 32 {
            let mut h = self.seed.wrapping_add(P5());
            h ^= (self.total_len as u64).wrapping_add(P1);
            for i in 0..self.buf_len {
                h ^= (self.buf[i] as u64).wrapping_mul(P2.wrapping_add(i as u64));
                h = h.rotate_left(13).wrapping_mul(P3);
            }
            return avalanche(h);
        }
        let mut h = rotl(self.acc[0], 1).wrapping_add(rotl(self.acc[1], 7)).wrapping_add(rotl(self.acc[2], 12)).wrapping_add(rotl(self.acc[3], 18));
        for n in 0..4 {
            h ^= round(0, self.acc[n]);
        }
        h ^= (self.total_len).wrapping_add(P1).wrapping_add(P4());
        // incorporate remaining buf
        let mut off = 0;
        while off + 8 <= self.buf_len {
            let k = read_u64(&self.buf[off..off+8]);
            h ^= round(0, k);
            off += 8;
        }
        if off + 4 <= self.buf_len {
            let k = u32::from_le_bytes([self.buf[off], self.buf[off+1], self.buf[off+2], self.buf[off+3]]) as u64;
            h ^= round(0, k);
            off += 4;
        }
        while off < self.buf_len {
            h ^= (self.buf[off] as u64).wrapping_mul(P2.wrapping_add((self.buf_len - off) as u64));
            h = h.rotate_left(13).wrapping_mul(P3);
            off += 1;
        }
        avalanche(h)
    }
}
fn round(acc: u64, input: u64) -> u64 {
    let acc = acc.wrapping_add(input.wrapping_mul(P2));
    let acc = acc.rotate_left(31);
    acc.wrapping_mul(P1)
}
fn rotl(x: u64, r: u32) -> u64 { (x << r) | (x >> (64 - r)) }
fn avalanche(mut x: u64) -> u64 {
    x ^= x >> 33;
    x = x.wrapping_mul(P2);
    x ^= x >> 29;
    x = x.wrapping_mul(P3);
    x ^= x >> 32;
    x
}
fn read_u64(b: &[u8]) -> u64 { u64::from_le_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]]) }
fn P4() -> u64 { 0x85ebca6b2a5e3a3d }
fn P5() -> u64 { 0xc2b2ae3d27d4eb4f }

pub fn hash(data: &[u8]) -> u64 {
    let mut h = XxHash64::new(0);
    h.update(data);
    h.finalize()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn empty() {
        let h = XxHash64::new(0).finalize();
        // not asserting exact value (this is a non-canonical xxh3 impl), just determinism
        assert_eq!(h, XxHash64::new(0).finalize());
    }
    #[test] fn deterministic() {
        let a = hash(b"hello world");
        let b = hash(b"hello world");
        assert_eq!(a, b);
    }
    #[test] fn different_inputs_differ() {
        let a = hash(b"hello");
        let b = hash(b"world");
        assert_ne!(a, b);
    }
    #[test] fn seed_affects_output() {
        let mut a = XxHash64::new(0); a.update(b"x");
        let mut b = XxHash64::new(42); b.update(b"x");
        assert_ne!(a.finalize(), b.finalize());
    }
    #[test] fn streaming_matches_one_shot() {
        let data = b"the quick brown fox jumps over the lazy dog";
        let one_shot = hash(data);
        let mut st = XxHash64::new(0);
        for chunk in data.chunks(7) { st.update(chunk); }
        assert_eq!(one_shot, st.finalize());
    }
    #[test] fn different_lengths_differ() {
        assert_ne!(hash(b"a"), hash(b"ab"));
        assert_ne!(hash(b"ab"), hash(b"abc"));
    }
}
