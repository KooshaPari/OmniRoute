//! Cryptographic signing and verification for manifests

use crate::manifest::{Manifest, VerificationResult};
use anyhow::{anyhow, Context, Result};
use ed25519_dalek::{SigningKey, VerifyingKey, Signature, Signer, Verifier};
use std::fs;
use std::path::Path;

/// Load Ed25519 signing key from PEM or raw file
pub fn load_signing_key(path: &Path) -> Result<SigningKey> {
    let content = fs::read_to_string(path)
        .with_context(|| format!("Failed to read key file: {}", path.display()))?;

    // Try PEM format first
    if content.contains("-----BEGIN") {
        let pem = pem::parse(content)
            .map_err(|e| anyhow!("Invalid PEM: {}", e))?;
        if pem.tag.contains("PRIVATE KEY") || pem.tag.contains("PRIVATE") {
            let key = SigningKey::from_bytes(&pem.contents[..32].try_into()?)?;
            return Ok(key);
        }
    }

    // Try raw base64
    let bytes = base64::decode(content.trim())?;
    if bytes.len() == 32 {
        return Ok(SigningKey::from_bytes(&bytes.try_into()?)?);
    }

    // Try raw hex
    let bytes = hex::decode(content.trim())?;
    if bytes.len() == 32 {
        return Ok(SigningKey::from_bytes(&bytes.try_into()?)?);
    }

    Err(anyhow!("Key must be 32 bytes (Ed25519 seed)"))
}

/// Load Ed25519 verifying key from PEM or raw file
pub fn load_verifying_key(path: &Path) -> Result<VerifyingKey> {
    let content = fs::read_to_string(path)
        .with_context(|| format!("Failed to read public key: {}", path.display()))?;

    // Try PEM format
    if content.contains("-----BEGIN") {
        let pem = pem::parse(content)
            .map_err(|e| anyhow!("Invalid PEM: {}", e))?;
        if pem.tag.contains("PUBLIC KEY") {
            let key = VerifyingKey::from_bytes(&pem.contents[..32].try_into()?)?;
            return Ok(key);
        }
    }

    // Try raw base64
    let bytes = base64::decode(content.trim())?;
    if bytes.len() == 32 {
        return Ok(VerifyingKey::from_bytes(&bytes.try_into()?)?);
    }

    // Try raw hex
    let bytes = hex::decode(content.trim())?;
    if bytes.len() == 32 {
        return Ok(VerifyingKey::from_bytes(&bytes.try_into()?)?);
    }

    Err(anyhow!("Public key must be 32 bytes (Ed25519)"))
}

/// Sign a manifest with Ed25519
pub fn sign_manifest(manifest: &mut Manifest, key: &SigningKey) -> Result<()> {
    let canonical = manifest.canonical_json()?;
    let signature = key.sign(&canonical);
    manifest.signature = base64::encode(signature.to_bytes());
    manifest.public_key = base64::encode(key.verifying_key().to_bytes());
    Ok(())
}

/// Verify a manifest's signature and structure
pub fn verify_manifest(
    manifest: &Manifest,
    pubkey: &VerifyingKey,
    require_all_pillars: bool,
    min_health_score: f64,
    max_age_hours: u64,
) -> VerificationResult {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // 1. Validate structure
    if let Err(e) = manifest.validate() {
        errors.push(format!("Manifest validation failed: {}", e));
        return VerificationResult::failure(errors);
    }

    // 2. Verify signature
    let canonical = match manifest.canonical_json() {
        Ok(c) => c,
        Err(e) => {
            errors.push(format!("Canonical serialization failed: {}", e));
            return VerificationResult::failure(errors);
        }
    };

    let signature = match base64::decode(&manifest.signature.as_bytes()) {
        Ok(bytes) if bytes.len() == 64 => Signature::from_bytes(&bytes.try_into().unwrap()),
        _ => {
            errors.push("Invalid signature encoding".into());
            return VerificationResult::failure(errors);
        }
    };

    if pubkey.verify(&canonical, &signature).is_err() {
        errors.push("Signature verification failed".into());
        return VerificationResult::failure(errors);
    }

    // 3. Check expiration
    let now = chrono::Utc::now();
    if now > manifest.expires_at {
        errors.push(format!("Manifest expired at {} (now {})", manifest.expires_at, now));
    }

    // 4. Check max age
    let age_hours = (now - manifest.generated_at).num_hours();
    if age_hours > max_age_hours as i64 {
        warnings.push(format!("Manifest age {}h exceeds max {}h", age_hours, max_age_hours));
    }

    // 5. Check health score
    if manifest.health_score < min_health_score {
        errors.push(format!(
            "Health score {:.2} below minimum {:.2}",
            manifest.health_score, min_health_score
        ));
    }

    // 6. Check pillars present
    if require_all_pillars {
        let pillars = [
            ("quality", &manifest.pillars.quality),
            ("security", &manifest.pillars.security),
            ("perf", &manifest.pillars.perf),
            ("compliance", &manifest.pillars.compliance),
            ("docs", &manifest.pillars.docs),
        ];
        for (name, pillar) in pillars {
            if pillar.checks.is_empty() && pillar.skip_reason.is_none() {
                errors.push(format!("Pillar '{}' has no checks and no skip reason", name));
            }
        }
    }

    if !errors.is_empty() {
        return VerificationResult::failure(errors);
    }

    VerificationResult::success(manifest.clone())
}

/// Generate a new Ed25519 keypair
pub fn generate_keypair() -> (SigningKey, VerifyingKey) {
    use rand::rngs::OsRng;
    let mut csprng = OsRng;
    let signing_key = SigningKey::generate(&mut csprng);
    let verifying_key = signing_key.verifying_key();
    (signing_key, verifying_key)
}

/// Save keypair to PEM files
pub fn save_keypair(
    signing_key: &SigningKey,
    verifying_key: &VerifyingKey,
    private_path: &Path,
    public_path: &Path,
) -> Result<()> {
    // Private key PEM
    let private_pem = pem::encode(&pem::Pem {
        tag: "PRIVATE KEY".into(),
        contents: signing_key.to_bytes().to_vec(),
    });
    fs::write(private_path, private_pem)?;

    // Public key PEM
    let public_pem = pem::encode(&pem::Pem {
        tag: "PUBLIC KEY".into(),
        contents: verifying_key.to_bytes().to_vec(),
    });
    fs::write(public_path, public_pem)?;

    Ok(())
}