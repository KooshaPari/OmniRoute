// SPDX-License-Identifier: MIT OR Apache-2.0

//! Ed25519 digital signatures.

use ed25519_dalek::{Signature as Ed25519Signature, Signer, SigningKey, Verifier, VerifyingKey};

use crate::{CryptoError, Result, ED25519_PUBLIC_KEY_SIZE, ED25519_SECRET_KEY_SIZE};

/// Ed25519 signing error.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignatureError(pub String);

impl std::fmt::Display for SignatureError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "signature error: {}", self.0)
    }
}

impl std::error::Error for SignatureError {}

/// Ed25519 signer.
#[derive(Clone)]
pub struct Ed25519Signer {
    signing_key: SigningKey,
}

impl Ed25519Signer {
    pub fn new() -> Self {
        let signing_key = SigningKey::generate(&mut rand::rngs::OsRng);
        Self { signing_key }
    }

    /// Create a new key pair, returning both signer and verifier.
    pub fn new_pair() -> (Self, Ed25519Verifier) {
        let signer = Self::new();
        let verifier = Ed25519Verifier::from_public_key(&signer.public_key()).unwrap();
        (signer, verifier)
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self> {
        let bytes: [u8; ED25519_SECRET_KEY_SIZE] = bytes
            .try_into()
            .map_err(|_| CryptoError::InvalidSignatureFormat("invalid key length".into()))?;
        let signing_key = SigningKey::from_bytes(&bytes);
        Ok(Self { signing_key })
    }

    pub fn sign(&self, message: &[u8]) -> Result<Vec<u8>> {
        let signature = self.signing_key.sign(message);
        Ok(signature.to_bytes().to_vec())
    }

    pub fn public_key(&self) -> Vec<u8> {
        self.signing_key.verifying_key().to_bytes().to_vec()
    }

    pub fn verify(&self, message: &[u8], signature: &[u8], public_key: &[u8]) -> Result<()> {
        let sig_bytes: [u8; 64] = signature
            .try_into()
            .map_err(|_| CryptoError::InvalidSignatureFormat("invalid signature length".into()))?;
        let pk_bytes: [u8; ED25519_PUBLIC_KEY_SIZE] = public_key
            .try_into()
            .map_err(|_| CryptoError::InvalidSignatureFormat("invalid public key length".into()))?;

        let signature = Ed25519Signature::from_bytes(&sig_bytes);
        let verifying_key = VerifyingKey::from_bytes(&pk_bytes)
            .map_err(|e| CryptoError::SignatureVerificationFailed(e.to_string()))?;

        verifying_key
            .verify(message, &signature)
            .map_err(|_| CryptoError::SignatureVerificationFailed("verification failed".into()))?;

        Ok(())
    }
}

impl Default for Ed25519Signer {
    fn default() -> Self { Self::new() }
}

/// Ed25519 verifier.
#[derive(Clone)]
pub struct Ed25519Verifier {
    verifying_key: VerifyingKey,
}

impl Ed25519Verifier {
    pub fn new() -> Result<Self> {
        let signing_key = SigningKey::generate(&mut rand::rngs::OsRng);
        let verifying_key = signing_key.verifying_key();
        Ok(Self { verifying_key })
    }

    pub fn from_public_key(public_key: &[u8]) -> Result<Self> {
        let pk_bytes: [u8; 32] = public_key
            .try_into()
            .map_err(|_| CryptoError::InvalidSignatureFormat("invalid public key length".into()))?;
        let verifying_key = VerifyingKey::from_bytes(&pk_bytes)
            .map_err(|e| CryptoError::SignatureVerificationFailed(e.to_string()))?;
        Ok(Self { verifying_key })
    }

    pub fn public_key(&self) -> Vec<u8> {
        self.verifying_key.to_bytes().to_vec()
    }

    pub fn verify(&self, message: &[u8], signature: &[u8], _public_key: &[u8]) -> Result<()> {
        // Note: public_key parameter is unused as we use self.verifying_key
        let sig_bytes: [u8; 64] = signature
            .try_into()
            .map_err(|_| CryptoError::InvalidSignatureFormat("invalid signature length".into()))?;

        let signature = Ed25519Signature::from_bytes(&sig_bytes);
        self.verifying_key
            .verify(message, &signature)
            .map_err(|_| CryptoError::SignatureVerificationFailed("verification failed".into()))?;

        Ok(())
    }
}

impl Default for Ed25519Verifier {
    fn default() -> Self {
        Self::new().expect("failed to generate verifier")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sign_and_verify() {
        let signer = Ed25519Signer::new();
        let verifier = Ed25519Verifier::from_public_key(&signer.public_key()).unwrap();

        let message = b"test message";
        let signature = signer.sign(message).unwrap();

        assert!(verifier.verify(message, &signature, &signer.public_key()).is_ok());
    }

    #[test]
    fn test_invalid_signature() {
        let signer = Ed25519Signer::new();
        let verifier = Ed25519Verifier::from_public_key(&signer.public_key()).unwrap();

        let bad_sig = vec![0u8; 64];
        assert!(verifier.verify(b"message", &bad_sig, &signer.public_key()).is_err());
    }
}
