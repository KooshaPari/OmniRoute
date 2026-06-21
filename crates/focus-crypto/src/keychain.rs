// SPDX-License-Identifier: MIT OR Apache-2.0

//! Secure secret storage backends.
//!
//! Three implementations are provided, dispatched via [`default_secure_store`]
//! at compile time based on the build target:
//!
//! - **macOS / iOS**: [`AppleKeychainStore`] — Apple Security framework
//!   (`SecItemAdd` / `SecItemCopyMatching` / `SecItemDelete`) via the
//!   `security-framework` crate. Works for real multi-session persistence.
//! - **Linux**: `LinuxSecretServiceStore` — freedesktop Secret Service
//!   (GNOME Keyring / KWallet) via the `secret-service` crate. Primarily
//!   useful for dev Macs running Rust workspace tests on Linux CI / WSL.
//! - **Other platforms (Windows, etc.)**: [`NullSecureStore`] — returns a
//!   clear `Err("platform unsupported")` from every operation so callers can
//!   explicitly decide to fall back to an in-memory store.
//!
//! Additionally, [`InMemorySecretStore`] exists for hermetic tests.
//!
//! Traces to: FR-DATA-002.

use std::sync::Mutex;

use secrecy::{ExposeSecret, SecretString};

use crate::SecureSecretStore;

// -- InMemory (tests and fallbacks) -----------------------------------------

/// Thread-safe in-memory [`SecureSecretStore`]. Contents are lost at process
/// exit. Intended for tests and as an explicit fallback on unsupported
/// platforms when the caller has decided RAM-only is acceptable.
#[derive(Debug, Default)]
pub struct InMemorySecretStore {
    inner: Mutex<std::collections::HashMap<String, String>>,
}

impl InMemorySecretStore {
    pub fn new() -> Self {
        Self::default()
    }
}

impl SecureSecretStore for InMemorySecretStore {
    fn store(&self, key: &str, value: SecretString) -> anyhow::Result<()> {
        self.inner
            .lock()
            .map_err(|e| anyhow::anyhow!("poisoned mutex: {e}"))?
            .insert(key.to_string(), value.expose_secret().to_string());
        Ok(())
    }

    fn load(&self, key: &str) -> anyhow::Result<Option<SecretString>> {
        let guard = self.inner.lock().map_err(|e| anyhow::anyhow!("poisoned mutex: {e}"))?;
        Ok(guard.get(key).map(|v| SecretString::from(v.clone())))
    }

    fn delete(&self, key: &str) -> anyhow::Result<()> {
        self.inner.lock().map_err(|e| anyhow::anyhow!("poisoned mutex: {e}"))?.remove(key);
        Ok(())
    }
}

// -- Null (unsupported platforms) -------------------------------------------

/// No-op [`SecureSecretStore`] that returns a clear error from every method.
/// Used on build targets without a real keychain backend (e.g. Windows).
/// Callers that want to tolerate this can fall back to [`InMemorySecretStore`].
#[derive(Debug, Default)]
pub struct NullSecureStore;

impl NullSecureStore {
    pub fn new() -> Self {
        Self
    }
}

const NULL_MSG: &str =
    "secure secret store: platform unsupported; wire an in-memory fallback if acceptable";

impl SecureSecretStore for NullSecureStore {
    fn store(&self, _key: &str, _value: SecretString) -> anyhow::Result<()> {
        anyhow::bail!(NULL_MSG)
    }
    fn load(&self, _key: &str) -> anyhow::Result<Option<SecretString>> {
        anyhow::bail!(NULL_MSG)
    }
    fn delete(&self, _key: &str) -> anyhow::Result<()> {
        anyhow::bail!(NULL_MSG)
    }
}

// -- Apple (macOS / iOS) ----------------------------------------------------

#[cfg(target_vendor = "apple")]
pub use apple::AppleKeychainStore;

#[cfg(target_vendor = "apple")]
mod apple {
    use super::*;
    use security_framework::passwords::{
        delete_generic_password, get_generic_password, set_generic_password,
    };

    /// Apple Security framework–backed [`SecureSecretStore`]. Items are stored
    /// as generic passwords under `(service_name, key)`. Survives process
    /// restart and (on macOS) device reboot, subject to the user's keychain
    /// ACLs.
    ///
    /// Traces to: FR-DATA-002.
    pub struct AppleKeychainStore {
        service_name: String,
    }

    impl AppleKeychainStore {
        pub fn new(service_name: impl Into<String>) -> Self {
            Self { service_name: service_name.into() }
        }

        pub fn service_name(&self) -> &str {
            &self.service_name
        }
    }

    impl SecureSecretStore for AppleKeychainStore {
        fn store(&self, key: &str, value: SecretString) -> anyhow::Result<()> {
            set_generic_password(&self.service_name, key, value.expose_secret().as_bytes())
                .map_err(|e| anyhow::anyhow!("keychain set_generic_password: {e}"))
        }

        fn load(&self, key: &str) -> anyhow::Result<Option<SecretString>> {
            match get_generic_password(&self.service_name, key) {
                Ok(bytes) => {
                    let s = String::from_utf8(bytes)
                        .map_err(|e| anyhow::anyhow!("keychain value not utf8: {e}"))?;
                    Ok(Some(SecretString::from(s)))
                }
                Err(e) => {
                    // security-framework returns an error when item is absent.
                    // There's no stable cross-version enum for "not found",
                    // so match by OSStatus code: errSecItemNotFound = -25300.
                    if e.code() == -25300 {
                        Ok(None)
                    } else {
                        Err(anyhow::anyhow!("keychain get_generic_password: {e}"))
                    }
                }
            }
        }

        fn delete(&self, key: &str) -> anyhow::Result<()> {
            match delete_generic_password(&self.service_name, key) {
                Ok(()) => Ok(()),
                Err(e) if e.code() == -25300 => Ok(()), // already absent -> success
                Err(e) => Err(anyhow::anyhow!("keychain delete_generic_password: {e}")),
            }
        }
    }
}

// -- Linux (Secret Service) -------------------------------------------------

#[cfg(all(target_os = "linux", not(target_vendor = "apple")))]
pub use linux::LinuxSecretServiceStore;

#[cfg(all(target_os = "linux", not(target_vendor = "apple")))]
mod linux {
    use super::*;
    use secret_service::blocking::SecretService;
    use secret_service::EncryptionType;
    use std::collections::HashMap;

    /// freedesktop Secret Service–backed [`SecureSecretStore`]. Talks to the
    /// session-bus secret daemon (GNOME Keyring, KWallet). Used on Linux
    /// dev / CI hosts.
    ///
    /// Traces to: FR-DATA-002.
    pub struct LinuxSecretServiceStore {
        service_name: String,
    }

    impl LinuxSecretServiceStore {
        pub fn new(service_name: impl Into<String>) -> Self {
            Self { service_name: service_name.into() }
        }

        fn attrs<'a>(&'a self, key: &'a str) -> HashMap<&'a str, &'a str> {
            let mut m = HashMap::new();
            m.insert("service", self.service_name.as_str());
            m.insert("account", key);
            m
        }
    }

    impl SecureSecretStore for LinuxSecretServiceStore {
        fn store(&self, key: &str, value: SecretString) -> anyhow::Result<()> {
            let ss = SecretService::connect(EncryptionType::Dh)
                .map_err(|e| anyhow::anyhow!("secret-service connect: {e}"))?;
            let collection = ss
                .get_default_collection()
                .map_err(|e| anyhow::anyhow!("secret-service default collection: {e}"))?;
            collection
                .create_item(
                    &format!("{}:{}", self.service_name, key),
                    self.attrs(key),
                    value.expose_secret().as_bytes(),
                    true,
                    "text/plain",
                )
                .map_err(|e| anyhow::anyhow!("secret-service create_item: {e}"))?;
            Ok(())
        }

        fn load(&self, key: &str) -> anyhow::Result<Option<SecretString>> {
            let ss = SecretService::connect(EncryptionType::Dh)
                .map_err(|e| anyhow::anyhow!("secret-service connect: {e}"))?;
            let items = ss
                .search_items(self.attrs(key))
                .map_err(|e| anyhow::anyhow!("secret-service search: {e}"))?;
            let found = items.unlocked.first().or_else(|| items.locked.first());
            let Some(item) = found else {
                return Ok(None);
            };
            let secret =
                item.get_secret().map_err(|e| anyhow::anyhow!("secret-service get_secret: {e}"))?;
            let s = String::from_utf8(secret)
                .map_err(|e| anyhow::anyhow!("secret-service value not utf8: {e}"))?;
            Ok(Some(SecretString::from(s)))
        }

        fn delete(&self, key: &str) -> anyhow::Result<()> {
            let ss = SecretService::connect(EncryptionType::Dh)
                .map_err(|e| anyhow::anyhow!("secret-service connect: {e}"))?;
            let items = ss
                .search_items(self.attrs(key))
                .map_err(|e| anyhow::anyhow!("secret-service search: {e}"))?;
            for item in items.unlocked.iter().chain(items.locked.iter()) {
                item.delete().map_err(|e| anyhow::anyhow!("secret-service delete: {e}"))?;
            }
            Ok(())
        }
    }
}

// -- Default dispatch -------------------------------------------------------

/// Return the best available secure store for the current build target.
///
/// - Apple (macOS/iOS) → [`AppleKeychainStore`]
/// - Linux → `LinuxSecretServiceStore`
/// - Otherwise → [`NullSecureStore`] (all ops return Err so callers can choose
///   to fall back to [`InMemorySecretStore`] explicitly).
pub fn default_secure_store(service: &str) -> Box<dyn SecureSecretStore> {
    #[cfg(target_vendor = "apple")]
    {
        Box::new(AppleKeychainStore::new(service))
    }
    #[cfg(all(target_os = "linux", not(target_vendor = "apple")))]
    {
        Box::new(LinuxSecretServiceStore::new(service))
    }
    #[cfg(not(any(target_vendor = "apple", target_os = "linux")))]
    {
        let _ = service;
        Box::new(NullSecureStore::new())
    }
}

// -- Tests ------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // Traces to: FR-DATA-002
    #[test]
    fn in_memory_roundtrip() {
        let s = InMemorySecretStore::new();
        assert!(s.load("k").unwrap().is_none());
        s.store("k", SecretString::from("v1")).unwrap();
        assert_eq!(s.load("k").unwrap().unwrap().expose_secret(), "v1");
        s.store("k", SecretString::from("v2")).unwrap();
        assert_eq!(s.load("k").unwrap().unwrap().expose_secret(), "v2");
        s.delete("k").unwrap();
        assert!(s.load("k").unwrap().is_none());
    }

    // Traces to: FR-DATA-002
    #[test]
    fn in_memory_isolates_keys() {
        let s = InMemorySecretStore::new();
        s.store("a", SecretString::from("A")).unwrap();
        s.store("b", SecretString::from("B")).unwrap();
        assert_eq!(s.load("a").unwrap().unwrap().expose_secret(), "A");
        assert_eq!(s.load("b").unwrap().unwrap().expose_secret(), "B");
        s.delete("a").unwrap();
        assert!(s.load("a").unwrap().is_none());
        assert_eq!(s.load("b").unwrap().unwrap().expose_secret(), "B");
    }

    // Traces to: FR-DATA-002
    #[test]
    fn in_memory_delete_missing_is_ok() {
        let s = InMemorySecretStore::new();
        s.delete("never-stored").unwrap();
    }

    // Traces to: FR-DATA-002
    #[test]
    fn null_store_errors_loudly() {
        let s = NullSecureStore::new();
        let e1 = s.store("k", SecretString::from("v")).unwrap_err();
        let e2 = s.load("k").unwrap_err();
        let e3 = s.delete("k").unwrap_err();
        for e in [e1, e2, e3] {
            assert!(e.to_string().contains("platform unsupported"), "got: {e}");
        }
    }

    // Traces to: FR-DATA-002
    #[test]
    fn default_secure_store_returns_some_box() {
        // Just checks the dispatch compiles and returns a usable trait object.
        // We don't hit the OS keychain here (see keychain_live test below).
        let _s: Box<dyn SecureSecretStore> = default_secure_store("focalpoint.test");
    }

    /// Real macOS/iOS keychain round-trip. `#[ignore]`-gated so CI (Linux) and
    /// `cargo test --workspace` on dev Macs don't pollute the user's keychain.
    /// Run manually with:
    ///
    /// ```text
    /// cargo test -p focus-crypto --test-threads=1 -- --ignored keychain_live
    /// ```
    ///
    /// Traces to: FR-DATA-002
    #[cfg(target_vendor = "apple")]
    #[test]
    #[ignore = "hits the real macOS/iOS keychain; run manually on a dev Mac"]
    fn keychain_live_roundtrip() {
        let store = AppleKeychainStore::new("com.focalpoint.tests.focus-crypto");
        let key = format!("live-{}", uuid::Uuid::new_v4());
        // Ensure clean slate.
        let _ = store.delete(&key);
        assert!(store.load(&key).unwrap().is_none());

        store.store(&key, SecretString::from("hunter2")).unwrap();
        assert_eq!(store.load(&key).unwrap().unwrap().expose_secret(), "hunter2");

        store.store(&key, SecretString::from("correcthorse")).unwrap();
        assert_eq!(store.load(&key).unwrap().unwrap().expose_secret(), "correcthorse");

        store.delete(&key).unwrap();
        assert!(store.load(&key).unwrap().is_none());
        // Idempotent delete.
        store.delete(&key).unwrap();
    }
}
