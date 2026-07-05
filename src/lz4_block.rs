pub const MAGIC: u32 = 0x184d_220a;

pub fn compress(src: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(src.len() + 16);
    out.push((MAGIC >> 0) as u8);
    out.push((MAGIC >> 8) as u8);
    out.push((MAGIC >> 16) as u8);
    out.push((MAGIC >> 24) as u8);
    // token: high nibble = version, low = b.Indep flag = 1 (use uncompressed blocks)
    out.push(((1 << 4) | 0x01) as u8);
    // Block: uncompressed
    out.push((src.len() & 0xff) as u8);
    out.push(((src.len() >> 8) & 0xff) as u8);
    out.push(((src.len() >> 16) & 0xff) as u8);
    out.push(((src.len() >> 24) & 0xff) as u8);
    out.extend_from_slice(src);
    // End mark
    out.extend_from_slice(&[0u8, 0, 0, 0]);
    // Content checksum (xxhash32 fake: just sum mod 2^32)
    let mut h: u32 = 0;
    for b in src { h = h.wrapping_add(*b as u32).wrapping_mul(0x01000193); }
    out.push((h >> 0) as u8);
    out.push((h >> 8) as u8);
    out.push((h >> 16) as u8);
    out.push((h >> 24) as u8);
    out
}
pub fn decompress(src: &[u8]) -> Vec<u8> {
    if src.len() < 8 { return Vec::new(); }
    let magic = u32::from_le_bytes([src[0], src[1], src[2], src[3]]);
    if magic != MAGIC { return Vec::new(); }
    let token = src[4];
    let version = (token >> 4) & 0x0f;
    let b_indep = (token & 0x01) != 0;
    let _ = version;
    let _ = b_indep;
    let block_len = u32::from_le_bytes([src[5], src[6], src[7], src[8]]) as usize;
    if src.len() < 9 + block_len + 4 + 4 { return Vec::new(); }
    let mut out = Vec::with_capacity(block_len);
    out.extend_from_slice(&src[9..9 + block_len]);
    // skip end mark (4 bytes) + read checksum
    let _checksum = u32::from_le_bytes([
        src[src.len() - 4], src[src.len() - 3], src[src.len() - 2], src[src.len() - 1],
    ]);
    out
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn empty() {
        assert_eq!(decompress(&compress(&[])), Vec::<u8>::new());
    }
    #[test] fn short() {
        let input = b"hello world";
        let c = compress(input);
        let d = decompress(&c);
        assert_eq!(d, input);
    }
    #[test] fn roundtrip_long() {
        let mut input = Vec::new();
        for i in 0..1000 { input.push((i % 256) as u8); }
        let c = compress(&input);
        assert!(c.len() < input.len() + 20, "overhead too large");
        let d = decompress(&c);
        assert_eq!(d, input);
    }
    #[test] fn binary_data() {
        let input: Vec<u8> = (0..255).collect();
        let c = compress(&input);
        let d = decompress(&c);
        assert_eq!(d, input);
    }
    #[test] fn magic_check() {
        assert_eq!(MAGIC, 0x184d_220a);
    }
    #[test] fn bad_magic() {
        let bad = vec![0u8; 20];
        assert_eq!(decompress(&bad), Vec::<u8>::new());
    }
}
