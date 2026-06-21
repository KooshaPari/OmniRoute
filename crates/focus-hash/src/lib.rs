// SPDX-License-Identifier: MIT OR Apache-2.0

//! # focus-hash
//!
//! Unified hashing interface for the Focus ecosystem. Wraps `phenotype-crypto`
//! and integrates with `focus-errors` for consistent error handling.
//!
//! Provides a single [`FocusHash`] type that can be produced by SHA-256 or BLAKE3,
//! with hex encoding and comparison helpers.
//!
//! ## Usage
//!
//! ```rust
//! use focus_hash::{HashAlgorithm, FocusHasher};
//!
//! let hasher = FocusHasher::sha256();
//! let hash = hasher.hash(b"hello world");
//! assert_eq!(hash.len(), 32);
//! ```

use focus_errors::FocusError;
use focus_result::FocusResult;
use phenotype_crypto::{Hasher, Hash as CryptoHash};

pub use phenotype_crypto::HashAlgorithm;

/// A hash value produced by the Focus hashing system.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct FocusHash(Vec<u8>);

impl FocusHash {
    /// Create a FocusHash from raw bytes.
    pub fn new(bytes: Vec<u8>) -> Self {
        Self(bytes)
    }

    /// Return the hash as a hex-encoded string.
    pub fn to_hex(&self) -> String {
        hex::encode(&self.0)
    }

    /// Return the raw bytes.
    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }

    /// Return the length of the hash in bytes.
    pub fn len(&self) -> usize {
        self.0.len()
    }

    /// Check if the hash is empty.
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl From<CryptoHash> for FocusHash {
    fn from(hash: CryptoHash) -> Self {
        Self(hash.as_bytes().to_vec())
    }
}

impl From<Vec<u8>> for FocusHash {
    fn from(v: Vec<u8>) -> Self {
        Self(v)
    }
}

impl AsRef<[u8]> for FocusHash {
    fn as_ref(&self) -> &[u8] {
        &self.0
    }
}

/// Unified hasher for the Focus ecosystem.
#[derive(Debug, Clone)]
pub struct FocusHasher {
    inner: Hasher,
}

impl FocusHasher {
    /// Create a new SHA-256 hasher.
    pub fn sha256() -> Self {
        Self {
            inner: Hasher::sha256(),
        }
    }

    /// Create a new BLAKE3 hasher.
    pub fn blake3() -> Self {
        Self {
            inner: Hasher::blake3(),
        }
    }

    /// Create a hasher with the specified algorithm.
    pub fn with_algorithm(algo: HashAlgorithm) -> Self {
        Self {
            inner: Hasher::with_algorithm(algo),
        }
    }

    /// Hash the input data and return a FocusHash.
    pub fn hash(&self, data: &[u8]) -> FocusHash {
        self.inner.hash(data).into()
    }

    /// Hash the input data and return a hex string.
    pub fn hash_hex(&self, data: &[u8]) -> String {
        self.hash(data).to_hex()
    }
}

/// Convenience function: SHA-256 hash of data.
pub fn sha256(data: &[u8]) -> FocusHash {
    FocusHasher::sha256().hash(data)
}

/// Convenience function: SHA-256 hash as hex string.
pub fn sha256_hex(data: &[u8]) -> String {
    FocusHasher::sha256().hash_hex(data)
}

/// Convenience function: BLAKE3 hash of data.
pub fn blake3(data: &[u8]) -> FocusHash {
    FocusHasher::blake3().hash(data)
}

/// Convenience function: BLAKE3 hash as hex string.
pub fn blake3_hex(data: &[u8]) -> String {
    FocusHasher::blake3().hash_hex(data)
}

/// Hash a string using SHA-256 (Focus-compatible).
pub fn hash_string(input: &str) -> FocusHash {
    sha256(input.as_bytes())
}

/// Hash a string and return hex (Focus-compatible).
pub fn hash_string_hex(input: &str) -> String {
    sha256_hex(input.as_bytes())
}

/// Compute a hash for a list of bytes (useful for event content hashing).
pub fn hash_chunks(chunks: &[&[u8]]) -> FocusHash {
    // Concatenate all chunks and hash
    let combined: Vec<u8> = chunks.iter().flat_map(|c| c.iter().copied()).collect();
    FocusHasher::sha256().hash(&combined)
}

/// Parse a hex-encoded hash string back into a FocusHash.
pub fn hash_from_hex(hex_str: &str) -> FocusResult<FocusHash> {
    let bytes = hex::decode(hex_str)
        .map_err(|e| FocusError::invalid_input("hex_str", format!("invalid hex: {e}")))?;
    Ok(FocusHash::new(bytes))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sha256_hash() {
        let hash = sha256(b"hello world");
        assert_eq!(hash.len(), 32);
        assert_eq!(
            hash.to_hex(),
            "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
        );
    }

    #[test]
    fn test_blake3_hash() {
        let hash = blake3(b"hello world");
        assert_eq!(hash.len(), 32);
        assert_eq!(
            hash.to_hex(),
            "d74981efa70a0c880b8d8c1985d075dbcbf679b99a5f9914e5aaf96b831a9e24"
        );
    }

    #[test]
    fn test_focus_hasher_sha256() {
        let hasher = FocusHasher::sha256();
        let hash = hasher.hash(b"test");
        assert_eq!(hash.len(), 32);
    }

    #[test]
    fn test_focus_hasher_blake3() {
        let hasher = FocusHasher::blake3();
        let hash = hasher.hash(b"test");
        assert_eq!(hash.len(), 32);
    }

    #[test]
    fn test_hash_hex() {
        let hash = sha256(b"test");
        let hex = hash.to_hex();
        assert_eq!(hex.len(), 64);
    }

    #[test]
    fn test_hash_string() {
        let hash = hash_string("hello world");
        assert_eq!(hash.len(), 32);
    }

    #[test]
    fn test_hash_string_hex() {
        let hex = hash_string_hex("hello world");
        assert_eq!(hex.len(), 64);
    }

    #[test]
    fn test_hash_chunks() {
        let hash = hash_chunks(&[b"part1", b"part2", b"part3"]);
        assert_eq!(hash.len(), 32);
        // Should be same as concatenating then hashing
        let combined = sha256(b"part1part2part3");
        assert_eq!(hash, combined);
    }

    #[test]
    fn test_hash_from_hex_valid() {
        let hash = sha256(b"test");
        let hex = hash.to_hex();
        let parsed = hash_from_hex(&hex).unwrap();
        assert_eq!(hash, parsed);
    }

    #[test]
    fn test_hash_from_hex_invalid() {
        let result = hash_from_hex("not_valid_hex!");
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("invalid hex"));
    }

    #[test]
    fn test_hash_from_hex_odd_length() {
        let result = hash_from_hex("abc");
        assert!(result.is_err());
    }

    #[test]
    fn test_focus_hash_as_ref() {
        let hash = sha256(b"test");
        let bytes: &[u8] = hash.as_ref();
        assert_eq!(bytes.len(), 32);
    }

    #[test]
    fn test_focus_hash_from_vec() {
        let v = vec![0u8; 32];
        let hash: FocusHash = v.into();
        assert_eq!(hash.len(), 32);
    }

    #[test]
    fn test_different_algorithms_produce_different_hashes() {
        let data = b"phenotype";
        let sha = sha256(data);
        let blake = blake3(data);
        assert_ne!(sha, blake);
    }

    #[test]
    fn test_focus_hasher_with_algorithm() {
        let hasher = FocusHasher::with_algorithm(HashAlgorithm::Sha256);
        let hash = hasher.hash(b"test");
        assert_eq!(hash.len(), 32);

        let hasher = FocusHasher::with_algorithm(HashAlgorithm::Blake3);
        let hash = hasher.hash(b"test");
        assert_eq!(hash.len(), 32);
    }

    #[test]
    fn test_hash_empty_input() {
        let empty: &[u8] = &[];
        let hash = sha256(empty);
        assert_eq!(hash.len(), 32);
        assert!(!hash.is_empty());
    }

    #[test]
    fn test_hash_large_input() {
        let large = vec![0xABu8; 1_000_000];
        let hash = sha256(&large);
        assert_eq!(hash.len(), 32);
    }

    #[test]
    fn test_hash_consistency() {
        let data = b"consistent";
        let h1 = sha256(data);
        let h2 = sha256(data);
        assert_eq!(h1, h2);
    }

    #[test]
    fn test_hash_ordering() {
        let h1 = sha256(b"a");
        let h2 = sha256(b"b");
        assert!(h1 != h2);
        assert!(h1 < h2 || h1 > h2);
    }
}
