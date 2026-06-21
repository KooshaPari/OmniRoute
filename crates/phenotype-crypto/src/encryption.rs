// SPDX-License-Identifier: MIT OR Apache-2.0

//! AES-256-GCM symmetric encryption.

use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use rand::RngCore;

use crate::{AES256_KEY_SIZE, AES_GCM_NONCE_SIZE, CryptoError, Result};

/// AES-GCM encryption error types.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AesGcmError {
    InvalidKeySize,
    InvalidNonceSize,
    EncryptionFailed,
    DecryptionFailed,
}

impl std::fmt::Display for AesGcmError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidKeySize => write!(f, "invalid key size"),
            Self::InvalidNonceSize => write!(f, "invalid nonce size"),
            Self::EncryptionFailed => write!(f, "encryption failed"),
            Self::DecryptionFailed => write!(f, "decryption failed"),
        }
    }
}

impl std::error::Error for AesGcmError {}

/// AES-256-GCM encryptor/decryptor.
#[derive(Clone)]
pub struct AesGcmEncryptor {
    cipher: Aes256Gcm,
}

impl AesGcmEncryptor {
    /// Create a new encryptor with the given 32-byte key.
    pub fn new(key: &[u8]) -> Result<Self> {
        if key.len() != AES256_KEY_SIZE {
            return Err(CryptoError::InvalidKeySize {
                expected: AES256_KEY_SIZE,
                actual: key.len(),
            });
        }
        let cipher = Aes256Gcm::new_from_slice(key)
            .map_err(|_| CryptoError::EncryptionFailed("failed to create cipher".into()))?;
        Ok(Self { cipher })
    }

    /// Generate a random 32-byte key.
    pub fn generate_key() -> Vec<u8> {
        let mut key = vec![0u8; AES256_KEY_SIZE];
        OsRng.fill_bytes(&mut key);
        key
    }

    /// Generate a random 12-byte nonce.
    pub fn generate_nonce() -> Vec<u8> {
        let mut nonce = vec![0u8; AES_GCM_NONCE_SIZE];
        OsRng.fill_bytes(&mut nonce);
        nonce
    }

    /// Encrypt plaintext, returning (ciphertext, nonce).
    pub fn encrypt(&self, plaintext: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
        let nonce = Self::generate_nonce();
        self.encrypt_with_nonce(plaintext, &nonce)
    }

    /// Encrypt with a provided nonce.
    pub fn encrypt_with_nonce(&self, plaintext: &[u8], nonce: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
        if nonce.len() != AES_GCM_NONCE_SIZE {
            return Err(CryptoError::InvalidNonceSize {
                expected: AES_GCM_NONCE_SIZE,
                actual: nonce.len(),
            });
        }
        let nonce = Nonce::from_slice(nonce);
        let ciphertext = self.cipher
            .encrypt(nonce, plaintext)
            .map_err(|_| CryptoError::EncryptionFailed("encryption failed".into()))?;
        Ok((ciphertext, nonce.to_vec()))
    }

    /// Decrypt ciphertext using the given nonce.
    pub fn decrypt(&self, ciphertext: &[u8], nonce: &[u8]) -> Result<Vec<u8>> {
        if nonce.len() != AES_GCM_NONCE_SIZE {
            return Err(CryptoError::InvalidNonceSize {
                expected: AES_GCM_NONCE_SIZE,
                actual: nonce.len(),
            });
        }
        let nonce = Nonce::from_slice(nonce);
        self.cipher
            .decrypt(nonce, ciphertext)
            .map_err(|_| CryptoError::DecryptionFailed("decryption failed".into()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let key = AesGcmEncryptor::generate_key();
        let encryptor = AesGcmEncryptor::new(&key).unwrap();
        let (ct, nonce) = encryptor.encrypt(b"secret").unwrap();
        let pt = encryptor.decrypt(&ct, &nonce).unwrap();
        assert_eq!(pt, b"secret");
    }

    #[test]
    fn test_invalid_key_size() {
        let short_key = vec![0u8; 16];
        assert!(AesGcmEncryptor::new(&short_key).is_err());
    }

    #[test]
    fn test_tampered_ciphertext_fails() {
        let key = AesGcmEncryptor::generate_key();
        let encryptor = AesGcmEncryptor::new(&key).unwrap();
        let (mut ct, nonce) = encryptor.encrypt(b"secret").unwrap();
        ct[0] ^= 0xFF;
        assert!(encryptor.decrypt(&ct, &nonce).is_err());
    }
}
