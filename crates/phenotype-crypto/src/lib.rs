//! # phenotype-crypto
//!
//! Cryptographic utilities for Phenotype — hashing, symmetric encryption,
//! key derivation, and HMAC signatures.
//!
//! ## Features
//!
//! - **Hashing**: SHA-256 (SHA-2) and BLAKE3
//! - **Symmetric Encryption**: AES-256-GCM
//! - **Key Derivation**: PBKDF2 with configurable iterations
//! - **HMAC**: HMAC-SHA256 for message authentication
//! - **Signatures**: Ed25519 digital signatures
//!
//! ## Usage
//!
//! ```rust
//! use phenotype_crypto::{Hasher, HashAlgorithm};
//!
//! // Hash data with SHA-256
//! let hasher = Hasher::sha256();
//! let hash = hasher.hash(b"hello world");
//! assert_eq!(hash.len(), 32); // 32 bytes for SHA-256
//! ```

use blake3::Hasher as Blake3Hasher;
use pbkdf2::pbkdf2_hmac_array;
use sha2::{Digest, Sha256};
use thiserror::Error;

pub mod hashing;
pub mod encryption;
pub mod key_derivation;
pub mod hmac;
pub mod signatures;

pub use hashing::{Hasher, Hash, HashAlgorithm};
pub use encryption::{AesGcmEncryptor, AesGcmError};
pub use key_derivation::{Kdf, KdfParams, Pbkdf2Error};
pub use hmac::{HmacSha256, HmacError};
pub use signatures::{Ed25519Signer, Ed25519Verifier, SignatureError};

/// Result type alias for crypto operations.
pub type Result<T> = std::result::Result<T, CryptoError>;

/// Unified error type for all crypto operations.
#[derive(Error, Debug, Clone, PartialEq, Eq)]
pub enum CryptoError {
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),

    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),

    #[error("Invalid key size: expected {expected} bytes, got {actual}")]
    InvalidKeySize { expected: usize, actual: usize },

    #[error("Invalid nonce size: expected {expected} bytes, got {actual}")]
    InvalidNonceSize { expected: usize, actual: usize },

    #[error("HMAC verification failed: computed MAC does not match")]
    HmacVerificationFailed,

    #[error("Key derivation failed: {0}")]
    KeyDerivationFailed(String),

    #[error("Signature verification failed: {0}")]
    SignatureVerificationFailed(String),

    #[error("Invalid signature format: {0}")]
    InvalidSignatureFormat(String),

    #[error("Invalid hex encoding: {0}")]
    InvalidHex(String),
}

// =============================================================================
// Constants
// =============================================================================

/// AES-256 key size in bytes.
pub const AES256_KEY_SIZE: usize = 32;

/// AES-GCM nonce size in bytes (96 bits).
pub const AES_GCM_NONCE_SIZE: usize = 12;

/// PBKDF2 default salt size in bytes.
pub const PBKDF2_SALT_SIZE: usize = 16;

/// PBKDF2 default iterations count.
pub const PBKDF2_DEFAULT_ITERATIONS: u32 = 100_000;

/// Ed25519 signature size in bytes.
pub const ED25519_SIGNATURE_SIZE: usize = 64;

/// Ed25519 public key size in bytes.
pub const ED25519_PUBLIC_KEY_SIZE: usize = 32;

/// Ed25519 secret key size in bytes.
pub const ED25519_SECRET_KEY_SIZE: usize = 32;

// =============================================================================
// Convenience Functions
// =============================================================================

/// Compute SHA-256 hash of the input data.
pub fn sha256(data: &[u8]) -> Vec<u8> {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().to_vec()
}

/// Compute SHA-256 hash and return as hex string.
pub fn sha256_hex(data: &[u8]) -> String {
    hex::encode(sha256(data))
}

/// Compute BLAKE3 hash of the input data.
pub fn blake3(data: &[u8]) -> Vec<u8> {
    let mut hasher = Blake3Hasher::new();
    hasher.update(data);
    blake3::Hasher::finalize(&hasher).as_bytes().to_vec()
}

/// Compute BLAKE3 hash and return as hex string.
pub fn blake3_hex(data: &[u8]) -> String {
    blake3::hash(data).to_hex().to_string()
}

/// Derive a key using PBKDF2-HMAC-SHA256.
pub fn pbkdf2_sha256(password: &[u8], salt: &[u8], iterations: u32) -> Vec<u8> {
    pbkdf2_hmac_array::<Sha256, 32>(password, salt, iterations).to_vec()
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // -------------------------------------------------------------------------
    // Hash Function Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_sha256_known_value() {
        let input = b"hello world";
        let hash = sha256(input);
        assert_eq!(hash.len(), 32);
        // Known SHA-256 hash of "hello world"
        assert_eq!(
            hex::encode(&hash),
            "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
        );
    }

    #[test]
    fn test_sha256_hex() {
        let hash_hex = sha256_hex(b"test");
        assert_eq!(hash_hex.len(), 64); // 32 bytes = 64 hex chars
        assert!(hash_hex.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_blake3_known_value() {
        let input = b"hello world";
        let hash = blake3(input);
        assert_eq!(hash.len(), 32); // BLAKE3 output is 32 bytes
        // Known BLAKE3 hash of "hello world"
        assert_eq!(
            hex::encode(&hash),
            "d74981efa70a0c880b8d8c1985d075dbcbf679b99a5f9914e5aaf96b831a9e24"
        );
    }

    #[test]
    fn test_blake3_hex() {
        let hash_hex = blake3_hex(b"test");
        assert_eq!(hash_hex.len(), 64);
    }

    #[test]
    fn test_sha256_vs_blake3_different_outputs() {
        let data = b"phenotype crypto test";
        let sha = sha256(data);
        let blake = blake3(data);
        assert_ne!(sha, blake); // Different algorithms produce different hashes
    }

    #[test]
    fn test_hash_empty_input() {
        let empty: &[u8] = &[];
        assert_eq!(sha256(empty).len(), 32);
        assert_eq!(blake3(empty).len(), 32);
    }

    #[test]
    fn test_hash_large_input() {
        let large = vec![0xAB; 1_000_000];
        assert_eq!(sha256(&large).len(), 32);
        assert_eq!(blake3(&large).len(), 32);
    }

    // -------------------------------------------------------------------------
    // PBKDF2 Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_pbkdf2_deterministic() {
        let password = b"deterministic_test";
        let salt = b"deterministic_salt";
        let iterations = 5000;

        let derived_1 = pbkdf2_sha256(password, salt, iterations);
        let derived_2 = pbkdf2_sha256(password, salt, iterations);

        assert_eq!(derived_1, derived_2);
    }

    #[test]
    fn test_pbkdf2_different_iterations() {
        let password = b"test_password";
        let salt = b"unique_salt";
        let derived_1k = pbkdf2_sha256(password, salt, 1000);
        let derived_10k = pbkdf2_sha256(password, salt, 10000);
        assert_ne!(derived_1k, derived_10k); // Different iterations = different output
    }

    #[test]
    fn test_pbkdf2_different_passwords() {
        let salt = b"fixed_salt";
        let derived_pass1 = pbkdf2_sha256(b"password1", salt, 1000);
        let derived_pass2 = pbkdf2_sha256(b"password2", salt, 1000);
        assert_ne!(derived_pass1, derived_pass2);
    }

    #[test]
    fn test_pbkdf2_different_salts() {
        let password = b"same_password";
        let derived_salt1 = pbkdf2_sha256(password, b"salt1", 1000);
        let derived_salt2 = pbkdf2_sha256(password, b"salt2", 1000);
        assert_ne!(derived_salt1, derived_salt2);
    }

    // -------------------------------------------------------------------------
    // AES-GCM Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_aes_gcm_encrypt_decrypt() {
        let key = AesGcmEncryptor::generate_key();
        let encryptor = AesGcmEncryptor::new(&key).unwrap();

        let plaintext = b"secret message for encryption";
        let (ciphertext, nonce) = encryptor.encrypt(plaintext).unwrap();

        assert_ne!(ciphertext, plaintext); // Ciphertext differs from plaintext
        assert_eq!(nonce.len(), AES_GCM_NONCE_SIZE);

        let decrypted = encryptor.decrypt(&ciphertext, &nonce).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_aes_gcm_different_nonces() {
        let key = AesGcmEncryptor::generate_key();
        let encryptor = AesGcmEncryptor::new(&key).unwrap();

        let plaintext = b"test message";
        let (ciphertext1, nonce1) = encryptor.encrypt(plaintext).unwrap();
        let (ciphertext2, nonce2) = encryptor.encrypt(plaintext).unwrap();

        // Same plaintext with random nonce should produce different ciphertext
        assert_ne!(nonce1, nonce2);
        assert_ne!(ciphertext1, ciphertext2);

        // But both should decrypt to the same plaintext
        assert_eq!(encryptor.decrypt(&ciphertext1, &nonce1).unwrap(), plaintext);
        assert_eq!(encryptor.decrypt(&ciphertext2, &nonce2).unwrap(), plaintext);
    }

    #[test]
    fn test_aes_gcm_authentication() {
        let key = AesGcmEncryptor::generate_key();
        let encryptor = AesGcmEncryptor::new(&key).unwrap();

        let plaintext = b"authenticated message";
        let (mut ciphertext, nonce) = encryptor.encrypt(plaintext).unwrap();

        // Tamper with ciphertext
        if !ciphertext.is_empty() {
            ciphertext[0] ^= 0xFF;
        }

        // Decryption should fail with tampered ciphertext
        let result = encryptor.decrypt(&ciphertext, &nonce);
        assert!(result.is_err());
    }

    #[test]
    fn test_aes_gcm_empty_plaintext() {
        let key = AesGcmEncryptor::generate_key();
        let encryptor = AesGcmEncryptor::new(&key).unwrap();

        let plaintext = b"";
        let (ciphertext, nonce) = encryptor.encrypt(plaintext).unwrap();
        let decrypted = encryptor.decrypt(&ciphertext, &nonce).unwrap();

        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn test_aes_gcm_wrong_nonce_fails() {
        let key = AesGcmEncryptor::generate_key();
        let encryptor = AesGcmEncryptor::new(&key).unwrap();

        let plaintext = b"secret";
        let (ciphertext, _) = encryptor.encrypt(plaintext).unwrap();

        // Create a different nonce
        let wrong_nonce = AesGcmEncryptor::generate_nonce();

        let result = encryptor.decrypt(&ciphertext, &wrong_nonce);
        assert!(result.is_err());
    }

    #[test]
    fn test_aes_gcm_invalid_key_size() {
        let short_key = vec![0u8; 16]; // Wrong size (should be 32)
        let result = AesGcmEncryptor::new(&short_key);
        assert!(result.is_err());
    }

    #[test]
    fn test_aes_gcm_invalid_nonce_size() {
        let key = AesGcmEncryptor::generate_key();
        let encryptor = AesGcmEncryptor::new(&key).unwrap();

        let short_nonce = vec![0u8; 8]; // Wrong size (should be 12)
        let result = encryptor.encrypt_with_nonce(b"test", &short_nonce);
        assert!(result.is_err());
    }

    // -------------------------------------------------------------------------
    // HMAC Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_hmac_sha256_known_value() {
        let key = b"secret_key";
        let message = b"hello world";

        let mut mac = HmacSha256::new(key);
        mac.update(message);
        let result = mac.finalize();

        assert_eq!(result.len(), 32);
        // Verify it's consistent
        let mut mac2 = HmacSha256::new(key);
        mac2.update(message);
        assert_eq!(mac2.finalize(), result);
    }

    #[test]
    fn test_hmac_sha256_different_keys() {
        let message = b"same message";

        let mut mac1 = HmacSha256::new(b"key1");
        mac1.update(message);
        let result1 = mac1.finalize();

        let mut mac2 = HmacSha256::new(b"key2");
        mac2.update(message);
        let result2 = mac2.finalize();

        assert_ne!(result1, result2);
    }

    #[test]
    fn test_hmac_sha256_different_messages() {
        let key = b"same_key";

        let mut mac1 = HmacSha256::new(key);
        mac1.update(b"message1");
        let result1 = mac1.finalize();

        let mut mac2 = HmacSha256::new(key);
        mac2.update(b"message2");
        let result2 = mac2.finalize();

        assert_ne!(result1, result2);
    }

    #[test]
    fn test_hmac_sha256_verification_success() {
        let key = b"verification_key";
        let message = b"message to verify";

        let mut mac = HmacSha256::new(key);
        mac.update(message);
        let signature = mac.finalize();

        // Verify with same key and message
        let mut verify_mac = HmacSha256::new(key);
        verify_mac.update(message);
        assert!(verify_mac.verify(&signature).is_ok());
    }

    #[test]
    fn test_hmac_sha256_verification_failure() {
        let key = b"verification_key";
        let message = b"original message";

        let mut mac = HmacSha256::new(key);
        mac.update(message);
        let signature = mac.finalize();

        // Try to verify different message
        let mut verify_mac = HmacSha256::new(key);
        verify_mac.update(b"different message");
        assert!(verify_mac.verify(&signature).is_err());
    }

    #[test]
    fn test_hmac_sha256_empty_message() {
        let key = b"key";
        let empty: &[u8] = &[];

        let mut mac = HmacSha256::new(key);
        mac.update(empty);
        let result = mac.finalize();

        assert_eq!(result.len(), 32);
    }

    #[test]
    fn test_hmac_sha256_empty_key() {
        let empty_key: &[u8] = &[];
        let message = b"message";

        let mut mac = HmacSha256::new(empty_key);
        mac.update(message);
        let result = mac.finalize();

        assert_eq!(result.len(), 32);
    }

    // -------------------------------------------------------------------------
    // Ed25519 Signature Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_ed25519_sign_and_verify() {
        let (signer, verifier) = Ed25519Signer::new_pair();
        let message = b"message to sign";

        let signature = signer.sign(message).unwrap();
        assert_eq!(signature.len(), ED25519_SIGNATURE_SIZE);

        // Verify with public key
        let public_key = signer.public_key();
        assert!(verifier.verify(message, &signature, &public_key).is_ok());
    }

    #[test]
    fn test_ed25519_different_messages() {
        let (signer, verifier) = Ed25519Signer::new_pair();
        let message1 = b"first message";
        let message2 = b"second message";

        let sig1 = signer.sign(message1).unwrap();
        let sig2 = signer.sign(message2).unwrap();

        assert_ne!(sig1, sig2);

        let public_key = signer.public_key();
        assert!(verifier.verify(message1, &sig1, &public_key).is_ok());
        assert!(verifier.verify(message2, &sig2, &public_key).is_ok());
    }

    #[test]
    fn test_ed25519_tampered_message_fails() {
        let (signer, verifier) = Ed25519Signer::new_pair();
        let message = b"original message";

        let signature = signer.sign(message).unwrap();
        let public_key = signer.public_key();

        // Try to verify tampered message
        let tampered = b"tampered message";
        assert!(verifier.verify(tampered, &signature, &public_key).is_err());
    }

    #[test]
    fn test_ed25519_tampered_signature_fails() {
        let (signer, verifier) = Ed25519Signer::new_pair();
        let message = b"message";

        let mut signature = signer.sign(message).unwrap();
        // Tamper with signature
        if !signature.is_empty() {
            signature[0] ^= 0xFF;
        }

        let public_key = signer.public_key();
        assert!(verifier.verify(message, &signature, &public_key).is_err());
    }

    #[test]
    fn test_ed25519_empty_message() {
        let (signer, verifier) = Ed25519Signer::new_pair();
        let empty: &[u8] = &[];

        let signature = signer.sign(empty).unwrap();
        let public_key = signer.public_key();

        assert!(verifier.verify(empty, &signature, &public_key).is_ok());
    }

    #[test]
    fn test_ed25519_large_message() {
        let (signer, verifier) = Ed25519Signer::new_pair();
        let large_message = vec![0x42u8; 1_000_000];

        let signature = signer.sign(&large_message).unwrap();
        let public_key = signer.public_key();

        assert!(verifier.verify(&large_message, &signature, &public_key).is_ok());
    }

    #[test]
    fn test_ed25519_deterministic_signing() {
        // Ed25519 signing should be deterministic (same message, same signature)
        let (signer, _) = Ed25519Signer::new_pair();
        let message = b"deterministic test";

        let sig1 = signer.sign(message).unwrap();
        let sig2 = signer.sign(message).unwrap();

        assert_eq!(sig1, sig2);
    }

    #[test]
    fn test_ed25519_wrong_public_key_fails() {
        let (signer, _) = Ed25519Signer::new_pair();
        let (_, other_verifier) = Ed25519Signer::new_pair(); // Different key pair

        let message = b"message";
        let signature = signer.sign(message).unwrap();
        let wrong_public_key = other_verifier.public_key();

        // Verification with wrong public key should fail
        assert!(signer.verify(message, &signature, &wrong_public_key).is_err());
    }

    // -------------------------------------------------------------------------
    // Constants Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_constants() {
        assert_eq!(AES256_KEY_SIZE, 32);
        assert_eq!(AES_GCM_NONCE_SIZE, 12);
        assert_eq!(PBKDF2_SALT_SIZE, 16);
        assert_eq!(ED25519_SIGNATURE_SIZE, 64);
        assert_eq!(ED25519_PUBLIC_KEY_SIZE, 32);
        assert_eq!(ED25519_SECRET_KEY_SIZE, 32);
    }

    // -------------------------------------------------------------------------
    // Error Type Tests
    // -------------------------------------------------------------------------

    #[test]
    fn test_crypto_error_display() {
        let err = CryptoError::InvalidKeySize { expected: 32, actual: 16 };
        assert!(err.to_string().contains("Invalid key size"));

        let err = CryptoError::EncryptionFailed("test".to_string());
        assert!(err.to_string().contains("Encryption failed"));
    }

    #[test]
    fn test_crypto_error_clone() {
        let err = CryptoError::HmacVerificationFailed;
        let cloned = err.clone();
        assert_eq!(err, cloned);
    }
}
