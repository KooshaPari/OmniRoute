// SPDX-License-Identifier: MIT OR Apache-2.0

//! Key derivation using PBKDF2-HMAC-SHA256.

use pbkdf2::pbkdf2_hmac_array;
use sha2::Sha256;

use crate::{PBKDF2_DEFAULT_ITERATIONS, PBKDF2_SALT_SIZE, CryptoError, Result};

/// PBKDF2 parameters.
#[derive(Debug, Clone)]
pub struct KdfParams {
    pub iterations: u32,
    pub salt: Vec<u8>,
}

impl Default for KdfParams {
    fn default() -> Self {
        Self {
            iterations: PBKDF2_DEFAULT_ITERATIONS,
            salt: Kdf::generate_salt(),
        }
    }
}

impl KdfParams {
    pub fn new(iterations: u32, salt: Vec<u8>) -> Self {
        Self { iterations, salt }
    }
}

/// PBKDF2 key derivation error.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Pbkdf2Error {
    InvalidIterations,
}

impl std::fmt::Display for Pbkdf2Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidIterations => write!(f, "iterations must be > 0"),
        }
    }
}

impl std::error::Error for Pbkdf2Error {}

/// PBKDF2 key derivation function.
#[derive(Debug, Clone)]
pub struct Kdf;

impl Kdf {
    pub fn new() -> Self { Self }

    /// Generate a random salt.
    pub fn generate_salt() -> Vec<u8> {
        use rand::RngCore;
        let mut salt = vec![0u8; PBKDF2_SALT_SIZE];
        rand::rngs::OsRng.fill_bytes(&mut salt);
        salt
    }

    /// Derive a key from password and salt.
    pub fn derive(&self, password: &[u8], params: &KdfParams) -> Result<Vec<u8>> {
        if params.iterations == 0 {
            return Err(CryptoError::KeyDerivationFailed(
                "iterations must be > 0".into(),
            ));
        }
        let key = pbkdf2_hmac_array::<Sha256, 32>(password, &params.salt, params.iterations);
        Ok(key.to_vec())
    }

    /// Derive with default parameters.
    pub fn derive_default(&self, password: &[u8]) -> (Vec<u8>, KdfParams) {
        let params = KdfParams::default();
        let key = self.derive(password, &params).unwrap();
        (key, params)
    }
}

impl Default for Kdf {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_key() {
        let kdf = Kdf::new();
        let params = KdfParams::new(1000, vec![0u8; 16]);
        let key = kdf.derive(b"password", &params).unwrap();
        assert_eq!(key.len(), 32);
    }

    #[test]
    fn test_derive_deterministic() {
        let kdf = Kdf::new();
        let params = KdfParams::new(1000, vec![0u8; 16]);
        let key1 = kdf.derive(b"test", &params).unwrap();
        let key2 = kdf.derive(b"test", &params).unwrap();
        assert_eq!(key1, key2);
    }

    #[test]
    fn test_invalid_iterations() {
        let kdf = Kdf::new();
        let params = KdfParams::new(0, vec![0u8; 16]);
        assert!(kdf.derive(b"password", &params).is_err());
    }
}
