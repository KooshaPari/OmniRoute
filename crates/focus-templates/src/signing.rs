// SPDX-License-Identifier: MIT OR Apache-2.0

//! Detached ed25519 signing for [`TemplatePack`]s.
//!
//! Traces to: FR-TEMPLATE-SIGN-001.
//!
//! # Canonical encoding
//!
//! A pack's signature is computed over a **canonical JSON** serialization:
//! `serde_json::to_vec` produced from a [`serde_json::Value`] rebuilt with
//! sorted `Map` keys. This avoids TOML's ambient-whitespace and
//! comment-preservation quirks and guarantees any serializer (Rust, Swift,
//! Kotlin) can reproduce the same bytes.
//!
//! # Trust model
//!
//! [`PHENOTYPE_ROOT_PUBKEYS`] is the *compile-time* root-of-trust list —
//! ops-managed ed25519 public keys (hex-encoded) that the app trusts
//! unconditionally. **Today it is empty**; the first real key is added
//! when ops generates a signing keypair. Callers may still supply an
//! ad-hoc [`VerifyingKey`] to [`verify_pack`] for user-imported packs
//! ("I trust this pack because I generated it").

use crate::{TemplateError, TemplatePack};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use sha2::Digest;

/// Root-of-trust public keys. Each entry is a 64-char lowercase hex string
/// of the raw 32-byte ed25519 public key. Empty until ops ships the first
/// signing key.
///
/// TODO(ops-signing): populate when the Phenotype signing keypair is
/// generated and the key custody process is documented.
pub const PHENOTYPE_ROOT_PUBKEYS: &[&str] = &[];

/// Canonicalize a pack → deterministic bytes suitable for signing.
///
/// Round-trips through `serde_json::Value` with sorted `Map` keys (BTreeMap
/// ordering). Any platform implementing "sort JSON object keys, emit
/// minimal JSON" produces the same output. Floating-point, datetime, and
/// integer formatting follow `serde_json`'s defaults — no floats appear in
/// the pack schema, so precision drift is not a concern today.
pub fn canonical_bytes(pack: &TemplatePack) -> Result<Vec<u8>, TemplateError> {
    let v = serde_json::to_value(pack)
        .map_err(|e| TemplateError::TomlSerialize(format!("canonical: {e}")))?;
    let sorted = sort_value(v);
    serde_json::to_vec(&sorted)
        .map_err(|e| TemplateError::TomlSerialize(format!("canonical emit: {e}")))
}

fn sort_value(v: serde_json::Value) -> serde_json::Value {
    match v {
        serde_json::Value::Object(map) => {
            let mut btree = std::collections::BTreeMap::new();
            for (k, val) in map {
                btree.insert(k, sort_value(val));
            }
            // serde_json::Map preserves insertion order — rebuild from BTreeMap.
            let mut out = serde_json::Map::new();
            for (k, val) in btree {
                out.insert(k, val);
            }
            serde_json::Value::Object(out)
        }
        serde_json::Value::Array(arr) => {
            serde_json::Value::Array(arr.into_iter().map(sort_value).collect())
        }
        other => other,
    }
}

/// Sign a pack with `key`. Returns a detached ed25519 signature.
pub fn sign_pack(pack: &TemplatePack, key: &SigningKey) -> Result<Signature, TemplateError> {
    let bytes = canonical_bytes(pack)?;
    Ok(key.sign(&bytes))
}

/// Verify a pack against a detached signature and an explicit verifying key.
///
/// Callers pass the trusted [`VerifyingKey`] directly; this function does
/// not consult [`PHENOTYPE_ROOT_PUBKEYS`]. The root-key list is a hint for
/// UI / trust-on-first-use policies one layer up — kept explicit so
/// user-supplied keys continue to work even when the root list is empty.
pub fn verify_pack(
    pack: &TemplatePack,
    sig: &Signature,
    pubkey: &VerifyingKey,
) -> Result<(), TemplateError> {
    let bytes = canonical_bytes(pack)?;
    pubkey
        .verify(&bytes, sig)
        .map_err(|e| TemplateError::Signature(e.to_string()))
}

/// Verify a pack's raw bytes against a detached signature and verifying key.
/// Used when pack is loaded from disk as bytes and hasn't been deserialized yet.
pub fn verify_pack_bytes(
    pack_bytes: &[u8],
    sig: &Signature,
    pubkey: &VerifyingKey,
) -> Result<(), TemplateError> {
    pubkey
        .verify(pack_bytes, sig)
        .map_err(|e| TemplateError::Signature(e.to_string()))
}

/// Compute SHA-256 digest of a pack's canonical bytes (hex-encoded).
pub fn digest_pack(pack: &TemplatePack) -> Result<String, TemplateError> {
    let bytes = canonical_bytes(pack)?;
    Ok(format!("{:x}", sha2::Sha256::digest(&bytes)))
}

/// Extract the first 16 characters of a hex public key (fingerprint for UI).
pub fn pubkey_fingerprint(hex: &str) -> String {
    hex.chars().take(16).collect()
}

/// Parse a hex-encoded root pubkey into a [`VerifyingKey`]. Helper for the
/// host app to iterate [`PHENOTYPE_ROOT_PUBKEYS`] at startup.
pub fn parse_root_pubkey(hex: &str) -> Result<VerifyingKey, TemplateError> {
    if hex.len() != 64 {
        return Err(TemplateError::Signature(format!("expected 64 hex chars, got {}", hex.len())));
    }
    let mut raw = [0u8; 32];
    for i in 0..32 {
        let byte = u8::from_str_radix(&hex[i * 2..i * 2 + 2], 16)
            .map_err(|e| TemplateError::Signature(format!("hex: {e}")))?;
        raw[i] = byte;
    }
    VerifyingKey::from_bytes(&raw).map_err(|e| TemplateError::Signature(e.to_string()))
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::TemplatePack;
    use ed25519_dalek::SigningKey;
    use rand_core::OsRng;

    fn mk_pack(id: &str) -> TemplatePack {
        TemplatePack {
            id: id.into(),
            name: "t".into(),
            version: "0.1.0".into(),
            author: "me".into(),
            description: String::new(),
            rules: vec![],
            recommended_connectors: vec!["gcal".into()],
            mascot_copy: Default::default(),
        }
    }

    #[test]
    fn sign_then_verify_succeeds() {
        let key = SigningKey::generate(&mut OsRng);
        let pack = mk_pack("p1");
        let sig = sign_pack(&pack, &key).unwrap();
        verify_pack(&pack, &sig, &key.verifying_key()).unwrap();
    }

    #[test]
    fn tampered_pack_fails_verification() {
        let key = SigningKey::generate(&mut OsRng);
        let pack = mk_pack("p1");
        let sig = sign_pack(&pack, &key).unwrap();
        let mut tampered = pack.clone();
        tampered.name = "stealth-rename".into();
        let err = verify_pack(&tampered, &sig, &key.verifying_key()).unwrap_err();
        assert!(matches!(err, TemplateError::Signature(_)));
    }

    #[test]
    fn wrong_key_fails_verification() {
        let k1 = SigningKey::generate(&mut OsRng);
        let k2 = SigningKey::generate(&mut OsRng);
        let pack = mk_pack("p1");
        let sig = sign_pack(&pack, &k1).unwrap();
        let err = verify_pack(&pack, &sig, &k2.verifying_key()).unwrap_err();
        assert!(matches!(err, TemplateError::Signature(_)));
    }

    #[test]
    fn empty_root_list_still_allows_user_supplied_key_verification() {
        // The invariant: even when PHENOTYPE_ROOT_PUBKEYS is empty, a
        // caller-supplied key can still verify. This guards against a
        // future regression where we accidentally gate verify_pack on the
        // root list.
        assert!(PHENOTYPE_ROOT_PUBKEYS.is_empty());
        let key = SigningKey::generate(&mut OsRng);
        let pack = mk_pack("p1");
        let sig = sign_pack(&pack, &key).unwrap();
        verify_pack(&pack, &sig, &key.verifying_key()).unwrap();
    }

    #[test]
    fn canonical_bytes_are_stable_across_calls() {
        let pack = mk_pack("p1");
        let a = canonical_bytes(&pack).unwrap();
        let b = canonical_bytes(&pack).unwrap();
        assert_eq!(a, b);
    }

    #[test]
    fn parse_root_pubkey_rejects_bad_hex() {
        assert!(parse_root_pubkey("short").is_err());
        assert!(parse_root_pubkey(&"zz".repeat(32)).is_err());
    }

    #[test]
    fn digest_pack_is_stable() {
        let pack = mk_pack("p1");
        let a = digest_pack(&pack).unwrap();
        let b = digest_pack(&pack).unwrap();
        assert_eq!(a, b);
        assert_eq!(a.len(), 64); // SHA-256 hex is 64 chars
    }

    #[test]
    fn pubkey_fingerprint_takes_first_16_chars() {
        let hex = format!("0123456789abcdef{}", "f".repeat(48));
        let fp = pubkey_fingerprint(&hex);
        assert_eq!(fp, "0123456789abcdef");
    }

    #[test]
    fn verify_pack_bytes_succeeds_with_correct_signature() {
        let key = SigningKey::generate(&mut OsRng);
        let pack = mk_pack("p1");
        let sig = sign_pack(&pack, &key).unwrap();
        let bytes = canonical_bytes(&pack).unwrap();
        verify_pack_bytes(&bytes, &sig, &key.verifying_key()).unwrap();
    }

    #[test]
    fn verify_pack_bytes_fails_with_tampered_bytes() {
        let key = SigningKey::generate(&mut OsRng);
        let pack = mk_pack("p1");
        let sig = sign_pack(&pack, &key).unwrap();
        let mut bytes = canonical_bytes(&pack).unwrap();
        bytes[0] ^= 0xff; // flip bits
        assert!(verify_pack_bytes(&bytes, &sig, &key.verifying_key()).is_err());
    }
}
