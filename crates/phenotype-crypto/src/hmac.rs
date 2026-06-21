// SPDX-License-Identifier: MIT OR Apache-2.0

//! HMAC-SHA256 message authentication.

use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256Type = Hmac<Sha256>;

/// HMAC-SHA256 wrapper.
#[derive(Clone)]
pub struct HmacSha256 {
    mac: HmacSha256Type,
}

impl HmacSha256 {
    pub fn new(key: &[u8]) -> Self {
        let mac = HmacSha256Type::new_from_slice(key)
            .expect("HMAC can take key of any size");
        Self { mac }
    }

    pub fn update(&mut self, data: &[u8]) {
        self.mac.update(data);
    }

    pub fn finalize(self) -> Vec<u8> {
        self.mac.finalize().into_bytes().to_vec()
    }

    pub fn verify(self, signature: &[u8]) -> std::result::Result<(), HmacError> {
        self.mac
            .verify_slice(signature)
            .map_err(|_| HmacError)
    }
}

/// HMAC verification error.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HmacError;

impl std::fmt::Display for HmacError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "HMAC verification failed")
    }
}

impl std::error::Error for HmacError {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hmac_basic() {
        let mut mac = HmacSha256::new(b"key");
        mac.update(b"message");
        let result = mac.finalize();
        assert_eq!(result.len(), 32);
    }

    #[test]
    fn test_hmac_verification() {
        let mut mac = HmacSha256::new(b"key");
        mac.update(b"message");
        let sig = mac.finalize();

        let mut verify_mac = HmacSha256::new(b"key");
        verify_mac.update(b"message");
        assert!(verify_mac.verify(&sig).is_ok());
    }

    #[test]
    fn test_hmac_wrong_key_fails() {
        let mut mac = HmacSha256::new(b"key1");
        mac.update(b"message");
        let sig = mac.finalize();

        let mut verify_mac = HmacSha256::new(b"key2");
        verify_mac.update(b"message");
        assert!(verify_mac.verify(&sig).is_err());
    }
}
