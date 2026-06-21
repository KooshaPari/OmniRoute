// SPDX-License-Identifier: MIT OR Apache-2.0

//! Plugin signature verification using Ed25519.

use ed25519_dalek::{Signature, SigningKey, VerifyingKey, Signer};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

/// Plugin signature metadata.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginSignature {
    pub algorithm: String,
    pub public_key: Vec<u8>,
    pub signature: Vec<u8>,
}

impl PluginSignature {
    /// Verify signature against WASM bytes.
    pub fn verify(&self, wasm_bytes: &[u8]) -> Result<(), String> {
        if self.algorithm != "ed25519" {
            return Err("Unsupported signature algorithm".to_string());
        }

        let public_key_array: [u8; 32] = self
            .public_key
            .as_slice()
            .try_into()
            .map_err(|_| "Invalid public key size".to_string())?;

        let public_key = VerifyingKey::from_bytes(&public_key_array)
            .map_err(|e| format!("Public key parse failed: {}", e))?;

        let sig_array: [u8; 64] = self
            .signature
            .as_slice()
            .try_into()
            .map_err(|_| "Invalid signature size".to_string())?;

        let sig = Signature::from_bytes(&sig_array);
        let hash = Sha256::digest(wasm_bytes);

        // ed25519-dalek v2 uses sign instead of sign_digest
        public_key
            .verify_strict(&hash, &sig)
            .map_err(|e| format!("Signature verification failed: {}", e))?;

        Ok(())
    }

    /// Sign WASM bytes with private key.
    pub fn sign(wasm_bytes: &[u8], signing_key: &SigningKey) -> Self {
        let hash = Sha256::digest(wasm_bytes);
        let signature = signing_key.sign(&hash);
        let verifying_key = VerifyingKey::from(signing_key);

        Self {
            algorithm: "ed25519".to_string(),
            public_key: verifying_key.to_bytes().to_vec(),
            signature: signature.to_bytes().to_vec(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand_core::OsRng;

    #[test]
    fn test_plugin_signature_roundtrip() {
        let signing_key = SigningKey::generate(&mut OsRng);
        let wasm_bytes = b"test-plugin-wasm-data";

        let signature = PluginSignature::sign(wasm_bytes, &signing_key);

        assert_eq!(signature.algorithm, "ed25519");
        assert_eq!(signature.public_key.len(), 32);
        assert_eq!(signature.signature.len(), 64);

        // Verify should succeed
        assert!(signature.verify(wasm_bytes).is_ok());

        // Verify with wrong data should fail
        assert!(signature.verify(b"corrupted-data").is_err());
    }

    #[test]
    fn test_unsigned_plugin_rejection() {
        let wasm_bytes = b"unsigned-plugin-data";

        // Empty signature should fail verification
        let bad_sig = PluginSignature {
            algorithm: "ed25519".to_string(),
            public_key: vec![0u8; 32],
            signature: vec![0u8; 64],
        };

        assert!(bad_sig.verify(wasm_bytes).is_err());
    }
}
