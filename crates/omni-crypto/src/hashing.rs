//! Hashing — BLAKE3 / SHA-256 thin wrappers.

/// Returns the BLAKE3 digest of `data` as a hex-encoded string.
pub fn blake3_hash(data: &[u8]) -> String {
    let hash = blake3::hash(data);
    hash.to_hex().to_string()
}

/// Returns the SHA-256 digest of `data` as a hex-encoded string.
pub fn sha256_hash(data: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blake3_round_trip() {
        let h = blake3_hash(b"hello world");
        assert_eq!(h.len(), 64); // 32 bytes → 64 hex chars
    }

    #[test]
    fn sha256_round_trip() {
        let h = sha256_hash(b"hello world");
        assert_eq!(h.len(), 64); // 32 bytes → 64 hex chars
    }

    #[test]
    fn deterministic() {
        let a = sha256_hash(b"same data");
        let b = sha256_hash(b"same data");
        assert_eq!(a, b);
    }
}
