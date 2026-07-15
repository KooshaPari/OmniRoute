use ed25519_dalek::Verifier;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SigningError {
    #[error("key generation failed: {0}")]
    KeyGenFailed(String),
    #[error("signing failed: {0}")]
    SignFailed(String),
    #[error("verification failed: {0}")]
    VerifyFailed(String),
}

#[derive(Debug, Clone)]
pub struct Ed25519Keypair([u8; 64]);

impl Ed25519Keypair {
    pub fn generate() -> Result<Self, SigningError> {
        let mut seed = [0u8; 32];
        getrandom::getrandom(&mut seed)
            .map_err(|e| SigningError::KeyGenFailed(e.to_string()))?;
        let signing_key = ed25519_dalek::SigningKey::from_bytes(&seed);
        let verifying_key: ed25519_dalek::VerifyingKey = signing_key.verifying_key();
        let mut keypair_bytes = [0u8; 64];
        keypair_bytes[..32].copy_from_slice(&signing_key.to_bytes());
        keypair_bytes[32..].copy_from_slice(&verifying_key.to_bytes());
        Ok(Self(keypair_bytes))
    }

    pub fn sign(&self, msg: &[u8]) -> Result<Vec<u8>, SigningError> {
        let signing_key = ed25519_dalek::SigningKey::from_bytes(
            &self.0[..32].try_into().map_err(|_| SigningError::SignFailed("invalid key length".into()))?,
        );
        use ed25519_dalek::Signer;
        Ok(signing_key.sign(msg).to_bytes().to_vec())
    }

    pub fn verify(pk_bytes: &[u8; 32], msg: &[u8], sig: &[u8]) -> Result<(), SigningError> {
        let verifying_key = ed25519_dalek::VerifyingKey::from_bytes(pk_bytes)
            .map_err(|e| SigningError::VerifyFailed(e.to_string()))?;
        let sig_bytes: [u8; 64] = sig
            .try_into()
            .map_err(|_| SigningError::VerifyFailed("signature len mismatch".into()))?;
        let signature = ed25519_dalek::Signature::from_bytes(&sig_bytes);
        verifying_key
            .verify(msg, &signature)
            .map_err(|e| SigningError::VerifyFailed(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sign_and_verify() {
        let kp = Ed25519Keypair::generate().unwrap();
        let msg = b"hello world";
        let sig = kp.sign(msg).unwrap();
        let mut pk = [0u8; 32];
        pk.copy_from_slice(&kp.0[32..]);
        assert!(Ed25519Keypair::verify(&pk, msg, &sig).is_ok());
    }

    #[test]
    fn test_verify_wrong_key() {
        let kp = Ed25519Keypair::generate().unwrap();
        let kp2 = Ed25519Keypair::generate().unwrap();
        let msg = b"hello world";
        let sig = kp.sign(msg).unwrap();
        let mut pk2 = [0u8; 32];
        pk2.copy_from_slice(&kp2.0[32..]);
        assert!(Ed25519Keypair::verify(&pk2, msg, &sig).is_err());
    }
}
