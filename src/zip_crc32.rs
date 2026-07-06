// CRC32 used in ZIP / PNG / Ethernet (polynomial 0xEDB88320, reflected).
const TABLE: [u32; 256] = {
    let mut t = [0u32; 256];
    let mut i = 0;
    while i < 256 {
        let mut c = i as u32;
        let mut j = 0;
        while j < 8 {
            c = if c & 1 != 0 { 0xedb88320 ^ (c >> 1) } else { c >> 1 };
            j += 1;
        }
        t[i] = c;
        i += 1;
    }
    t
};
pub fn crc32(data: &[u8]) -> u32 {
    let mut crc: u32 = 0xffffffff;
    for &b in data {
        let idx = ((crc ^ b as u32) & 0xff) as usize;
        crc = (crc >> 8) ^ TABLE[idx];
    }
    crc ^ 0xffffffff
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn empty() { assert_eq!(crc32(&[]), 0); }
    #[test] fn known_abc() {
        // CRC32 of "abc" is 0x352441c2
        assert_eq!(crc32(b"abc"), 0x352441c2);
    }
    #[test] fn known_123456789() {
        assert_eq!(crc32(b"123456789"), 0xcbf43926);
    }
    #[test] fn zero_bytes() {
        assert_eq!(crc32(&[0u8; 4]), 0x2144df1c);
    }
    #[test] fn deterministic() {
        let a = crc32(b"hello world");
        let b = crc32(b"hello world");
        assert_eq!(a, b);
    }
    #[test] fn different() {
        assert_ne!(crc32(b"hello"), crc32(b"world"));
    }
    #[test] fn one_byte() {
        assert_eq!(crc32(&[0x61]), 0xe8b7be43);
    }
    #[test] fn long_buffer() {
        let data: Vec<u8> = (0..=255u8).collect();
        let h = crc32(&data);
        // Just verify it's non-zero and deterministic
        assert_ne!(h, 0);
        assert_eq!(h, crc32(&data));
    }
}
