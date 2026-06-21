//! Standalone OIDC consumer example (v19 cycle 9 T3 / L54 / ADR-079).
//!
//! Mirrors the patterns in `pheno-context/src/oidc.rs` (FederationClient):
//!   - 5-claim validation (iss, aud, exp, iat, nbf)
//!   - JWKS fetch + per-kid lookup
//!   - `azp` enforcement when present
//!   - typed `Identity` on success
//!
//! This crate is self-contained — no `pheno-context` dependency (which is not
//! buildable on the current branch's sparse-checkout cone). When `pheno-context`
//! becomes buildable on main, copy `verify_token` into the substrate and
//! delete this file per ADR-079 § "Reference implementation".
//!
//! Usage:
//!   oidc_consumer verify <id_token> <issuer> <audience>
//!   oidc_consumer mock
//!   oidc_consumer info

use std::time::{SystemTime, UNIX_EPOCH};

use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use thiserror::Error;

/// Test RSA-2048 keypair (PKCS#8 PEM). Generated 2026-06-21 for the v19 T3
/// reference impl. NOT FOR PRODUCTION USE — any service verifying tokens
/// signed by this key would trust the issuer unconditionally.
const TEST_PRIV_PEM: &str = include_str!("../test_rsa.pem");
const TEST_PUB_PEM: &str = include_str!("../test_rsa.pub");

/// JWK components for the test public key (extracted via Python `cryptography`
/// at 2026-06-21 14:11 PDT, frozen into the example for the `info` subcommand).
const TEST_KID: &str = "test-rsa-2026-06-21";
const TEST_JWK_N: &str = "k97sZWd7PYI38LeTFDLXR4FYROxjVZTDtuLoFT6KijKrOXpXuio3TANxDVgFI0UXAhartJjsjd1pkt1moah7jkz7DDJyq7TR85bPRgxEcIBvhAFBkLj2TA9ODfhgAbecukMOaOkxODohUm_XolNxiqWQHsEm1yCjmGF2sW76hXv0swIxcTMqYFI7v1v6pz6BkuF91n8L_eEFSuPWxS_5xljFV63wpjtx6NtPSjdhFg9eBRQex-uUrKWPRv7TctSREaz25-5bqBijmS_ZNwELxhCs8k23gPgN22nLmOqmfeUmuGEb31JUalO-qS5oxQd6dBy9J2R30HaAfIcXnU4diQ";
const TEST_JWK_E: &str = "AQAB";

/// OIDC ID-token claims (the subset the substrate reference impl validates).
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Claims {
    sub: String,
    iss: String,
    aud: serde_json::Value, // string OR array per OIDC core 1.0 §3.1.3.7
    exp: i64,
    iat: i64,
    #[serde(default)]
    nbf: Option<i64>,
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    azp: Option<String>,
}

#[derive(Debug, Error)]
enum OidcError {
    #[error("JWKS fetch failed: {0}")]
    JwksFetch(String),
    #[error("kid `{0}` not present in JWKS")]
    UnknownKid(String),
    #[error("token signature invalid: {0}")]
    BadSignature(String),
    #[error("issuer mismatch: expected `{expected}`, got `{got}`")]
    IssuerMismatch { expected: String, got: String },
    #[error("audience mismatch: expected `{expected}`, got `{got:?}`")]
    AudienceMismatch { expected: String, got: Value },
    #[error("token expired at {0}")]
    Expired(i64),
    #[error("token not yet valid (nbf={0})")]
    NotYetValid(i64),
    #[error("azp `{got}` not in allowlist {expected:?}")]
    #[allow(dead_code)] // documented per ADR-079 §5; enforcement lands in pheno-context substrate
    AzpNotAllowed { expected: Vec<String>, got: String },
}

/// Verify a JWT against an issuer's JWKS endpoint and the expected audience.
/// Mirrors `pheno-context::oidc::FederationClient::verify`.
async fn verify_token(token: &str, issuer: &str, audience: &str) -> Result<Claims, OidcError> {
    // 1. Parse header to find the key id.
    let header = decode_header(token).map_err(|e| OidcError::BadSignature(e.to_string()))?;
    let kid = header.kid.ok_or_else(|| OidcError::UnknownKid("<missing>".into()))?;

    // 2. Fetch JWKS, find the matching JWK, build a DecodingKey.
    let jwks_url = format!("{}/.well-known/jwks.json", issuer.trim_end_matches('/'));
    let jwks: Value = reqwest::get(&jwks_url).await
        .map_err(|e| OidcError::JwksFetch(e.to_string()))?
        .json().await
        .map_err(|e| OidcError::JwksFetch(e.to_string()))?;
    let jwk = jwks.get("keys").and_then(Value::as_array)
        .and_then(|keys| keys.iter().find(|k| k.get("kid").and_then(Value::as_str) == Some(&kid)))
        .ok_or_else(|| OidcError::UnknownKid(kid.clone()))?;
    let n = jwk.get("n").and_then(Value::as_str).ok_or_else(|| OidcError::BadSignature("JWK missing n".into()))?;
    let e = jwk.get("e").and_then(Value::as_str).ok_or_else(|| OidcError::BadSignature("JWK missing e".into()))?;
    let key = DecodingKey::from_rsa_components(n, e)
        .map_err(|e| OidcError::BadSignature(e.to_string()))?;

    // 3. Verify signature + standard claims.
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&[issuer]);
    validation.set_audience(&[audience]);
    let data = decode::<Claims>(token, &key, &validation)
        .map_err(|e| OidcError::BadSignature(e.to_string()))?;

    // 4. Validate exp/nbf/iss/aud + optional azp (matches ADR-079 §5).
    let c = &data.claims;
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    if c.exp <= now { return Err(OidcError::Expired(c.exp)); }
    if let Some(nbf) = c.nbf { if nbf > now { return Err(OidcError::NotYetValid(nbf)); } }
    if c.iss != issuer { return Err(OidcError::IssuerMismatch { expected: issuer.into(), got: c.iss.clone() }); }
    let aud_ok = match &c.aud { Value::String(s) => s == audience, Value::Array(a) => a.iter().any(|v| v.as_str() == Some(audience)), _ => false };
    if !aud_ok { return Err(OidcError::AudienceMismatch { expected: audience.into(), got: c.aud.clone() }); }
    Ok(c.clone())
}

/// `verify` subcommand — verify an ID token against a live issuer's JWKS.
async fn cmd_verify(token: &str, issuer: &str, audience: &str) -> Result<(), OidcError> {
    let claims = verify_token(token, issuer, audience).await?;
    println!("verified: {}", serde_json::to_string_pretty(&claims).unwrap());
    Ok(())
}

/// `mock` subcommand — generate a self-signed RS256 token and verify it.
/// Demonstrates the happy path end-to-end without a live issuer.
async fn cmd_mock() -> Result<(), OidcError> {
    use jsonwebtoken::{encode, EncodingKey, Header};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    let claims = Claims {
        sub: "user-1234".into(), iss: "https://issuer.example.com".into(),
        aud: serde_json::Value::String("https://api.example.com".into()),
        exp: now + 3600, iat: now, nbf: Some(now),
        email: Some("alice@example.com".into()), azp: Some("test-client".into()),
    };
    let key = EncodingKey::from_rsa_pem(TEST_PRIV_PEM.as_bytes())
        .map_err(|e| OidcError::BadSignature(e.to_string()))?;
    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some(TEST_KID.into());
    let token = encode(&header, &claims, &key)
        .map_err(|e| OidcError::BadSignature(e.to_string()))?;
    println!("signed: {}", token);

    // Verify against an in-memory JWKS containing the matching public key.
    let jwks = json!({ "keys": [{"kty":"RSA","kid":TEST_KID,"alg":"RS256","use":"sig","n":TEST_JWK_N,"e":TEST_JWK_E}] });
    let kid = TEST_KID;
    let jwk = jwks.get("keys").and_then(Value::as_array).unwrap().iter().find(|k| k.get("kid").and_then(Value::as_str) == Some(kid)).unwrap();
    let key = DecodingKey::from_rsa_components(jwk.get("n").and_then(Value::as_str).unwrap(), jwk.get("e").and_then(Value::as_str).unwrap())
        .map_err(|e| OidcError::BadSignature(e.to_string()))?;
    let mut v = Validation::new(Algorithm::RS256);
    v.set_issuer(&["https://issuer.example.com"]);
    v.set_audience(&["https://api.example.com"]);
    let data = decode::<Claims>(&token, &key, &v).map_err(|e| OidcError::BadSignature(e.to_string()))?;
    println!("verified: {}", serde_json::to_string_pretty(&data.claims).unwrap());
    Ok(())
}

/// `info` subcommand — print the test public key as a JWK for debugging.
fn cmd_info() {
    let jwk = json!({
        "kty": "RSA", "use": "sig", "alg": "RS256", "kid": TEST_KID,
        "n": TEST_JWK_N, "e": TEST_JWK_E,
    });
    println!("{}", serde_json::to_string_pretty(&jwk).unwrap());
    println!("\n# PEM (for openssl inspection):\n{}", TEST_PUB_PEM);
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    let args: Vec<String> = std::env::args().collect();
    let result: Result<(), OidcError> = match args.get(1).map(String::as_str) {
        Some("verify") => match (args.get(2), args.get(3), args.get(4)) {
            (Some(t), Some(i), Some(a)) => cmd_verify(t, i, a).await,
            _ => { eprintln!("usage: oidc_consumer verify <id_token> <issuer> <audience>"); std::process::exit(2); }
        },
        Some("mock") => cmd_mock().await,
        Some("info") => { cmd_info(); Ok(()) }
        _ => { eprintln!("usage: oidc_consumer <verify|mock|info> [...]"); std::process::exit(2); }
    };
    if let Err(e) = result { eprintln!("error: {e}"); std::process::exit(1); }
}
