//! URL-safe Base64 encoder/decoder (RFC 4648 §5).
//!
//! Uses `-` and `_` instead of `+` and `/`, which makes the output safe for use
//! in URLs and file names without percent-encoding. Trailing `=` padding is
//! optional: [`decode`] accepts both padded and unpadded inputs, while
//! [`decode_unchecked`] expects unpadded inputs only.
//!
//! ## Examples
//!
//! ```
//! use sharecli::url_safe_base64::{encode, decode, decode_unchecked};
//!
//! assert_eq!(encode(b"hello world"), "aGVsbG8gd29ybGQ");
//! assert_eq!(decode("aGVsbG8gd29ybGQ").unwrap(), b"hello world");
//! assert_eq!(decode_unchecked("aGVsbG8gd29ybGQ").unwrap(), b"hello world");
//! ```

const ALPHABET: &[u8; 64] =
    b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/// Reverse alphabet for fast lookup. Value 64 is the "padding / invalid" sentinel.
const DECODE_TABLE: [u8; 256] = build_decode_table();

const fn build_decode_table() -> [u8; 256] {
    let mut t = [64u8; 256];
    let mut i = 0;
    while i < 64 {
        t[ALPHABET[i] as usize] = i as u8;
        i += 1;
    }
    // Accept standard '+' and '/' too so callers can hand in either form
    // without forcing a translation step.
    t[b'+' as usize] = 62;
    t[b'/' as usize] = 63;
    t
}

/// Encode `input` as URL-safe Base64 with `=` padding (RFC 4648 §4 padding rules).
pub fn encode(input: &[u8]) -> String {
    let mut out = String::with_capacity(input.len().div_ceil(3) * 4);
    for chunk in input.chunks(3) {
        let b0 = chunk[0];
        let b1 = chunk.get(1).copied().unwrap_or(0);
        let b2 = chunk.get(2).copied().unwrap_or(0);
        let n = ((b0 as u32) << 16) | ((b1 as u32) << 8) | (b2 as u32);
        let idx0 = ((n >> 18) & 0x3f) as usize;
        let idx1 = ((n >> 12) & 0x3f) as usize;
        let idx2 = if chunk.len() > 1 { ((n >> 6) & 0x3f) as usize } else { 64 };
        let idx3 = if chunk.len() > 2 { (n & 0x3f) as usize } else { 64 };
        out.push(ALPHABET[idx0] as char);
        out.push(ALPHABET[idx1] as char);
        if chunk.len() > 1 {
            out.push(ALPHABET[idx2] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(ALPHABET[idx3] as char);
        } else {
            out.push('=');
        }
    }
    out
}

/// Encode without `=` padding (useful for tokens / JWT-style payloads).
pub fn encode_unpadded(input: &[u8]) -> String {
    let s = encode(input);
    s.trim_end_matches('=').to_string()
}

/// Decode a URL-safe Base64 string. Accepts both padded and unpadded inputs.
///
/// Returns `Err(msg)` for invalid characters or malformed padding.
pub fn decode(input: &str) -> Result<Vec<u8>, String> {
    if input.is_empty() {
        return Ok(Vec::new());
    }
    let bytes = input.as_bytes();
    // length % 4 == 1 is illegal in both padded and unpadded variants.
    let rem = bytes.len() % 4;
    if rem == 1 {
        return Err(format!("invalid input length: {}", bytes.len()));
    }
    // Pad with '=' on the right to make the total length a multiple of 4.
    let mut padded: Vec<u8> = Vec::with_capacity(bytes.len() + 2);
    padded.extend_from_slice(bytes);
    let pad_count = match rem {
        0 => 0,
        2 => 2,
        3 => 1,
        _ => unreachable!(),
    };
    for _ in 0..pad_count {
        padded.push(b'=');
    }
    let working_len = padded.len();
    let mut out = Vec::with_capacity(working_len / 4 * 3);
    let chunk_count = working_len / 4;
    for ci in 0..chunk_count {
        let chunk_start = ci * 4;
        let mut buf = [b'A'; 4];
        for i in 0..4 {
            buf[i] = padded[chunk_start + i];
        }
        // Compute trailing '=' count and reject '=' chars that aren't part of a
        // trailing run.
        let mut pad = 0;
        for i in (0..4).rev() {
            if buf[i] == b'=' {
                pad += 1;
            } else {
                break;
            }
        }
        for i in 0..(4 - pad) {
            if buf[i] == b'=' {
                return Err(format!(
                    "stray '=' (not part of a trailing run) at chunk {} byte {}",
                    ci, i
                ));
            }
        }
        // A 'buf' of [x, '=', '=', '='] (3 pad) is never legal.
        if pad == 3 {
            return Err("invalid padding: 3 trailing '=' is never legal".to_string());
        }
        if pad == 4 {
            return Err("invalid padding: 4 trailing '=' is never legal".to_string());
        }
        // '=' is only ever present in the LAST chunk of `padded`.
        let is_last = ci + 1 == chunk_count;
        if !is_last && pad != 0 {
            return Err("padding appears in a non-final chunk".to_string());
        }
        let v0 = if buf[0] == b'=' { 0 } else { lookup(buf[0])? };
        let v1 = if buf[1] == b'=' { 0 } else { lookup(buf[1])? };
        let v2 = if buf[2] == b'=' { 0 } else { lookup(buf[2])? };
        let v3 = if buf[3] == b'=' { 0 } else { lookup(buf[3])? };
        let n = ((v0 as u32) << 18) | ((v1 as u32) << 12) | ((v2 as u32) << 6) | (v3 as u32);
        let real_bytes = 3 - pad;
        if real_bytes >= 1 {
            out.push(((n >> 16) & 0xff) as u8);
        }
        if real_bytes >= 2 {
            out.push(((n >> 8) & 0xff) as u8);
        }
        if real_bytes >= 3 {
            out.push((n & 0xff) as u8);
        }
        // Suppress the unused-variable warning for is_last — kept for clarity
        // in the validation path above.
        let _ = is_last;
    }
    Ok(out)
}

/// Decode an UNPADDED URL-safe Base64 string. Internally adds 0–2 trailing `=`
/// to satisfy the 4-byte frame width but does NOT validate padding bits.
pub fn decode_unchecked(input: &str) -> Result<Vec<u8>, String> {
    let unpadded = input.trim_end_matches('=');
    let len = unpadded.len();
    let rem = len % 4;
    if rem == 1 {
        return Err(format!("invalid input length: {}", len));
    }
    let padded = match rem {
        0 => unpadded.to_string(),
        2 => format!("{}==", unpadded),
        3 => format!("{}=", unpadded),
        _ => unreachable!(),
    };
    decode(&padded)
}

fn lookup(b: u8) -> Result<u8, String> {
    let v = DECODE_TABLE[b as usize];
    if v == 64 {
        Err(format!("invalid character: {:?}", b as char))
    } else {
        Ok(v)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rfc4648_known_vectors() {
        assert_eq!(encode(b""), "");
        assert_eq!(encode(b"f"), "Zg==");
        assert_eq!(encode(b"fo"), "Zm8=");
        assert_eq!(encode(b"foo"), "Zm9v");
        assert_eq!(encode(b"foob"), "Zm9vYg==");
        assert_eq!(encode(b"fooba"), "Zm9vYmE=");
        assert_eq!(encode(b"foobar"), "Zm9vYmFy");
    }

    #[test]
    fn url_safe_substitution() {
        let bytes = [0xfb, 0xec];
        let encoded = encode(&bytes);
        // URL-safe alphabet uses '-' (62) and '_' (63) — standard base64 uses
        // '+' (62) and '/' (63). Confirm the encoder emits the URL-safe form.
        assert!(
            encoded.starts_with("--") || encoded.starts_with("-_") || encoded.starts_with("__"),
            "expected url-safe leading chars, got {:?}",
            encoded
        );
        // Round-trip via URL-safe form must reproduce the input.
        assert_eq!(decode(&encoded).unwrap(), bytes.to_vec());
        // Standard alphabet form is also accepted (courtesy for mixed inputs).
        // '+' = 62, '/' = 63 → bits 111110 111111 110000 → bytes 0xfb 0xfc.
        assert_eq!(decode("+/w=").unwrap(), vec![0xfb, 0xfc]);
    }

    #[test]
    fn unpadded_encode_decode_roundtrip() {
        let data = b"hello world";
        let enc = encode(data);
        let unp = encode_unpadded(data);
        assert_eq!(unp, enc.trim_end_matches('='));
        assert_eq!(decode(&enc).unwrap(), data);
        assert_eq!(decode(&unp).unwrap(), data);
        assert_eq!(decode_unchecked(&unp).unwrap(), data);
    }

    #[test]
    fn decode_with_and_without_padding() {
        assert_eq!(decode("Zm9vYmFy").unwrap(), b"foobar");
        assert_eq!(decode("Zm9vYg==").unwrap(), b"foob");
        // length % 4 == 1 is illegal — 13 chars here.
        assert!(decode("Zm9vYmFyA").is_err());
        // All-'=' chunk is illegal (pad=4).
        assert!(decode("====").is_err());
        // Three trailing '=' is illegal.
        assert!(decode("Zm9v====").is_err());
    }

    #[test]
    fn round_trip_binary_with_null_bytes() {
        let data: Vec<u8> = (0u8..=255).collect();
        let enc = encode(&data);
        let dec = decode(&enc).unwrap();
        assert_eq!(dec, data);
    }

    #[test]
    fn round_trip_empty() {
        assert_eq!(encode(b""), "");
        assert_eq!(decode("").unwrap(), b"");
        assert_eq!(decode_unchecked("").unwrap(), b"");
    }

    #[test]
    fn invalid_character_rejected() {
        assert!(decode("@@@@").is_err());
        assert!(decode("Zm9v*").is_err());
    }

    #[test]
    fn invalid_length_rejected() {
        // length % 4 == 1 is always illegal.
        assert!(decode("Z").is_err());
        // All-'=' is illegal (pad=4 with no data).
        assert!(decode("====").is_err());
        // Trailing pad == 3 is illegal.
        assert!(decode("Z===").is_err());
        // Mixed case: "YQ==" is valid 1-byte input — confirm we DON'T reject it.
        assert!(decode("YQ==").is_ok());
    }

    #[test]
    fn decode_unchecked_accepts_unpadded() {
        assert_eq!(decode_unchecked("Zm9vYmFy").unwrap(), b"foobar");
        assert_eq!(decode_unchecked("Zg").unwrap(), b"f");
        assert_eq!(decode_unchecked("Zm8").unwrap(), b"fo");
        // Padded input is also tolerated — the helper just trims '=' first.
        assert_eq!(decode_unchecked("Zg==").unwrap(), b"f");
    }
}
