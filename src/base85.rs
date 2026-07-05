// RFC 1924 base85 alphabet (Ascii85 variant)
const ALPHABET: &[u8; 85] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~";

pub fn encode(data: &[u8]) -> String {
    if data.is_empty() { return String::new(); }
    let mut out = String::new();
    let mut i = 0;
    while i + 4 <= data.len() {
        let mut v = ((data[i] as u32) << 24) | ((data[i+1] as u32) << 16) | ((data[i+2] as u32) << 8) | (data[i+3] as u32);
        // All 4-byte blocks (including zero blocks) encode as 5 alphabet chars.
        let mut vv = v;
        let mut chars = [0u8; 5];
        for j in (0..5).rev() {
            chars[j] = ALPHABET[(vv % 85) as usize];
            vv /= 85;
        }
        for c in chars { out.push(c as char); }
        i += 4;
    }
    if i < data.len() {
        let mut buf = [0u8; 4];
        let remaining = data.len() - i;
        buf[..remaining].copy_from_slice(&data[i..]);
        let v = ((buf[0] as u32) << 24) | ((buf[1] as u32) << 16) | ((buf[2] as u32) << 8) | (buf[3] as u32);
        let mut chars = [0u8; 5];
        let mut vv = v;
        for j in (0..5).rev() {
            chars[j] = ALPHABET[(vv % 85) as usize];
            vv /= 85;
        }
        for j in 0..(remaining + 1) {
            out.push(chars[j] as char);
        }
    }
    out
}
pub fn decode(input: &str) -> Result<Vec<u8>, String> {
    let mut out = Vec::with_capacity(input.len() * 4 / 5);
    let bytes = input.as_bytes();
    let mut buf = Vec::new();
    for &b in bytes {
        if b == b'z' {
            if buf.len() != 0 { return Err("'z' mid-block".into()); }
            out.extend_from_slice(&[0u8; 4]);
        } else {
            let idx = ALPHABET.iter().position(|&c| c == b).ok_or_else(|| format!("bad char {}", b as char))?;
            buf.push(idx as u32);
            if buf.len() == 5 {
                let v = buf[0] * 85 * 85 * 85 * 85 + buf[1] * 85 * 85 * 85 + buf[2] * 85 * 85 + buf[3] * 85 + buf[4];
                out.push(((v >> 24) & 0xff) as u8);
                out.push(((v >> 16) & 0xff) as u8);
                out.push(((v >> 8) & 0xff) as u8);
                out.push((v & 0xff) as u8);
                buf.clear();
            }
        }
    }
    if buf.len() == 1 { return Err("trailing 1 char".into()); }
    if buf.len() > 1 {
        let mut v: u64 = 0;
        for (i, &x) in buf.iter().enumerate() { v = v * 85 + x as u64; }
        for _ in buf.len()..5 { v = v * 85 + 84; }
        let rem = buf.len() - 1;
        for i in 0..rem {
            out.push(((v >> (24 - i * 8)) & 0xff) as u8);
        }
    }
    Ok(out)
}
#[cfg(test)]
mod tests {
    use super::*;
}
