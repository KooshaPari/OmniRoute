// RFC 2045 quoted-printable encoding/decoding.
// Encodes bytes as =XX hex for non-printable or = for soft line break.
const MAX_LINE: usize = 76;
pub fn encode(input: &[u8]) -> String {
    let mut out = String::new();
    let mut line_len = 0;
    let bytes = input;
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        let enc_len = match b {
            b'=' => 3,
            b'\r' | b'\n' => 1,
            0x20..=0x7e => 1,
            _ => 3,
        };
        if line_len + enc_len > MAX_LINE - 1 {
            out.push_str("=\r\n");
            line_len = 0;
        }
        match b {
            b'=' => { out.push_str("=3D"); line_len += 3; }
            b'\r' | b'\n' => { out.push(b as char); line_len += 1; }
            0x20..=0x7e => { out.push(b as char); line_len += 1; }
            _ => {
                out.push_str(&format!("={:02X}", b));
                line_len += 3;
            }
        }
        i += 1;
    }
    out
}
pub fn decode(input: &str) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    let bytes = input.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let b = bytes[i];
        if b == b'=' {
            if i + 1 >= bytes.len() { return Err("trailing =".into()); }
            if bytes[i + 1] == b'\r' || bytes[i + 1] == b'\n' {
                // soft line break
                if bytes[i + 1] == b'\r' && i + 2 < bytes.len() && bytes[i + 2] == b'\n' {
                    i += 3;
                } else if bytes[i + 1] == b'\n' {
                    i += 2;
                } else {
                    i += 2;
                }
                continue;
            }
            if i + 2 >= bytes.len() { return Err("truncated =XX".into()); }
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).map_err(|_| "bad utf8")?;
            let v = u8::from_str_radix(hex, 16).map_err(|_| format!("bad hex: {}", hex))?;
            out.push(v);
            i += 3;
        } else {
            out.push(b);
            i += 1;
        }
    }
    Ok(out)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn encode_printable() {
        assert_eq!(encode(b"hello world"), "hello world");
    }
    #[test] fn encode_special() {
        assert_eq!(encode(b"a=b"), "a=3Db");
        assert_eq!(encode(b"line1\nline2"), "line1\nline2");
        assert_eq!(encode(b"x=y=z"), "x=3Dy=3Dz");
    }
    #[test] fn encode_high_bytes() {
        assert_eq!(encode(&[0xff, 0xfe, 0xfd]), "=FF=FE=FD");
    }
    #[test] fn encode_long_line_wraps() {
        let input = b"a".repeat(100);
        let e = encode(&input);
        assert!(e.contains("=\r\n"));
    }
    #[test] fn decode_basic() {
        let d = decode("hello=20world").unwrap();
        assert_eq!(d, b"hello world");
    }
    #[test] fn decode_special() {
        let d = decode("a=3Db").unwrap();
        assert_eq!(d, b"a=b");
    }
    #[test] fn decode_soft_break() {
        let d = decode("hello=\r\nworld").unwrap();
        assert_eq!(d, b"helloworld");
    }
    #[test] fn round_trip_basic() {
        let original = b"hello world\na=b";
        let e = encode(original);
        let d = decode(&e).unwrap();
        assert_eq!(d, original);
    }
    #[test] fn round_trip_long() {
        let original = vec![b'a'; 200];
        let e = encode(&original);
        let d = decode(&e).unwrap();
        assert_eq!(d, original);
    }
    #[test] fn round_trip_mixed() {
        let original: Vec<u8> = (0..=255u8).collect();
        let e = encode(&original);
        let d = decode(&e).unwrap();
        assert_eq!(d, original);
    }
    #[test] fn decode_trailing_equals() {
        assert!(decode("hello=").is_err());
    }
    #[test] fn decode_bad_hex() {
        assert!(decode("=ZZ").is_err());
    }
}
