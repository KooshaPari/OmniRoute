const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

pub fn encode(input: &[u8]) -> String {
    let mut out = String::new();
    let chunks = input.chunks(3);
    for c in chunks {
        let b0 = c[0];
        let b1 = c.get(1).copied().unwrap_or(0);
        let b2 = c.get(2).copied().unwrap_or(0);
        let n = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);
        let idx0 = ((n >> 18) & 0x3f) as usize;
        let idx1 = ((n >> 12) & 0x3f) as usize;
        let idx2 = if c.len() > 1 { ((n >> 6) & 0x3f) as usize } else { 64 };
        let idx3 = if c.len() > 2 { (n & 0x3f) as usize } else { 64 };
        out.push(ALPHABET[idx0] as char);
        out.push(ALPHABET[idx1] as char);
        if c.len() > 1 { out.push(ALPHABET[idx2] as char); } else { out.push('='); }
        if c.len() > 2 { out.push(ALPHABET[idx3] as char); } else { out.push('='); }
    }
    out
}

pub fn is_valid(s: &str) -> bool {
    if s.len() % 4 != 0 { return false; }
    s.chars().all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/' || c == '=')
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn encode_empty() { assert_eq!(encode(b""), ""); }
    #[test] fn encode_hello() { assert_eq!(encode(b"hi"), "aGk="); }
    #[test] fn encode_3bytes() { assert_eq!(encode(b"abc"), "YWJj"); }
    #[test] fn encode_padding() { assert_eq!(encode(b"a"), "YQ=="); assert_eq!(encode(b"ab"), "YWI="); }
    #[test] fn valid_check() { assert!(is_valid("aGk=")); assert!(is_valid("YWJj")); }
    #[test] fn invalid_length() { assert!(!is_valid("abc")); }
    #[test] fn invalid_chars() { assert!(!is_valid("hello world!!!")); }
}
