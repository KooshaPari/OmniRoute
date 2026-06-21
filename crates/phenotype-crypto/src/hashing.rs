// SPDX-License-Identifier: MIT OR Apache-2.0

//! Hashing utilities for SHA-256 and BLAKE3.

use sha2::{Digest, Sha256};
use blake3::Hasher as Blake3Hasher;

/// Available hash algorithms.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum HashAlgorithm {
    #[default]
    Sha256,
    Blake3,
}

/// Unified hash output type.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Hash(pub Vec<u8>);

impl Hash {
    pub fn as_bytes(&self) -> &[u8] { &self.0 }
    pub fn as_hex(&self) -> String { hex::encode(&self.0) }
    pub fn len(&self) -> usize { self.0.len() }
    pub fn is_empty(&self) -> bool { self.0.is_empty() }
}

impl AsRef<[u8]> for Hash {
    fn as_ref(&self) -> &[u8] { &self.0 }
}

impl From<Vec<u8>> for Hash {
    fn from(v: Vec<u8>) -> Self { Hash(v) }
}

/// Hash builder for configurable hashing.
#[derive(Debug, Clone, Default)]
pub struct Hasher {
    algorithm: HashAlgorithm,
}

impl Hasher {
    pub fn new() -> Self { Self { algorithm: HashAlgorithm::default() } }
    pub fn sha256() -> Self { Self { algorithm: HashAlgorithm::Sha256 } }
    pub fn blake3() -> Self { Self { algorithm: HashAlgorithm::Blake3 } }
    pub fn with_algorithm(algorithm: HashAlgorithm) -> Self { Self { algorithm } }

    pub fn hash(&self, data: &[u8]) -> Hash {
        match self.algorithm {
            HashAlgorithm::Sha256 => {
                let mut hasher = Sha256::new();
                hasher.update(data);
                hasher.finalize().to_vec().into()
            }
            HashAlgorithm::Blake3 => {
                let mut hasher = Blake3Hasher::new();
                hasher.update(data);
                blake3::Hasher::finalize(&hasher).as_bytes().to_vec().into()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hasher_sha256() {
        let hasher = Hasher::sha256();
        let hash = hasher.hash(b"test");
        assert_eq!(hash.len(), 32);
    }

    #[test]
    fn test_hasher_blake3() {
        let hasher = Hasher::blake3();
        let hash = hasher.hash(b"test");
        assert_eq!(hash.len(), 32);
    }

    #[test]
    fn test_hash_hex() {
        let hash = Hasher::sha256().hash(b"hello");
        assert_eq!(hash.as_hex().len(), 64);
    }
}
