pub fn encode(value: u32) -> Vec<u8> {
    let mut out = Vec::new();
    let mut v = value & 0x7fffffff;
    loop {
        let b = (v & 0x7f) as u8;
        v >>= 7;
        if v == 0 { out.push(b | 0x80); break; }
        out.push(b);
    }
    out
}
pub fn decode(bytes: &[u8]) -> Option<(u32, usize)> {
    let mut value: u32 = 0;
    for (i, &b) in bytes.iter().enumerate() {
        if i >= 5 { return None; }
        let low = (b & 0x7f) as u32;
        value |= low << (7 * i);
        if b & 0x80 != 0 { return Some((value, i + 1)); }
    }
    None
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn small() { let enc = encode(5); let (v, n) = decode(&enc).unwrap(); assert_eq!(v, 5); assert_eq!(n, enc.len()); }
    #[test] fn zero() { let enc = encode(0); let (v, _) = decode(&enc).unwrap(); assert_eq!(v, 0); }
    #[test] fn large() { let v = 0x12345678u32; let enc = encode(v); let (decoded, n) = decode(&enc).unwrap(); assert_eq!(decoded, v); assert_eq!(n, enc.len()); }
    #[test] fn roundtrip_many() { for v in [0, 1, 127, 128, 16383, 16384, 1_000_000u32, 0x7fffffff] { let enc = encode(v); let (d, _) = decode(&enc).unwrap(); assert_eq!(d, v); } }
}
