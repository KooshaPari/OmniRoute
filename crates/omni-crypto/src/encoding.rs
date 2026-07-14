//! Encoding helpers — base64url (no-pad) and hex wrappers.
//!
//! These match the wire formats used across OmniRoute tokens and IDs.

/// Encode a byte slice as base64url with no padding.
pub fn base64url_encode(input: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(input)
}

/// Decode a base64url (no-pad) string back into bytes.
pub fn base64url_decode(input: &str) -> Result<Vec<u8>, base64::DecodeError> {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(input)
}

/// Encode a byte slice as lowercase hex.
pub fn hex_encode(input: &[u8]) -> String {
    hex::encode(input)
}

/// Decode a hex string back into bytes.
pub fn hex_decode(input: &str) -> Result<Vec<u8>, hex::FromHexError> {
    hex::decode(input)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base64url_round_trip() {
        let data = b"hello world";
        let enc = base64url_encode(data);
        let dec = base64url_decode(&enc).unwrap();
        assert_eq!(dec, data);
    }

    #[test]
    fn hex_round_trip() {
        let data = b"test data";
        let enc = hex_encode(data);
        let dec = hex_decode(&enc).unwrap();
        assert_eq!(dec, data);
    }
}
