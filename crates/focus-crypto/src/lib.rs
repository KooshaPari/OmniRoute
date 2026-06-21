// SPDX-License-Identifier: MIT OR Apache-2.0

//! Token wrapping, secure-storage helpers.
//!
//! The `unlock` module (QR/NFC proofs) has been archived to
//! `.archive/unlock-proof-v0/` per the 2026-04-22 scope redirect toward
//! connector-reward-gamification. Revive when the feature is prioritized again.

pub mod keychain;
#[cfg(target_vendor = "apple")]
pub use keychain::AppleKeychainStore;
#[cfg(all(target_os = "linux", not(target_vendor = "apple")))]
pub use keychain::LinuxSecretServiceStore;
pub use keychain::{default_secure_store, InMemorySecretStore, NullSecureStore};

use secrecy::{ExposeSecret, SecretString};

pub trait SecureSecretStore: Send + Sync {
    fn store(&self, key: &str, value: SecretString) -> anyhow::Result<()>;
    fn load(&self, key: &str) -> anyhow::Result<Option<SecretString>>;
    fn delete(&self, key: &str) -> anyhow::Result<()>;
}

pub struct TokenWrap {
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
}

impl TokenWrap {
    pub fn new(_key: &SecretString, _plaintext: &[u8]) -> anyhow::Result<Self> {
        // Stub: AEAD via ring::aead when implemented.
        let _ = _key.expose_secret();
        anyhow::bail!("TokenWrap::new not implemented")
    }
}

pub struct IntegrityDigest(pub [u8; 32]);
