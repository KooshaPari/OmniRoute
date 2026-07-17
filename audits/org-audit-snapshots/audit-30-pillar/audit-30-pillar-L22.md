# L22 — Cryptography & key management

## Scope
Algorithm choice, key derivation, side-channel mitigations, HSM/KMS integration, and FIPS posture across the Phenotype bloc (AgilePlus + thegent + Tracely + Tracera + satellites).

## SOTA 2026
- **AEAD:** AES-GCM (NIST SP 800-38D) and ChaCha20-Poly1305 (RFC 8439) for symmetric confidentiality+integrity.
- **Signatures:** Ed25519 (RFC 8032), ECDSA P-256, RSA-PSS (≥2048-bit).
- **KDF:** Argon2id (RFC 9106, memory-hard) for passwords; HKDF (RFC 5869) for context-bound expansion; scrypt (RFC 7914) where Argon2 is unavailable.
- **Commit signing:** Sigstore (Fulcio + Rekor + OIDC) and SSH `ssh-keygen -Y sign` are the de-facto 2026 standards; GPG remains in support for legacy.
- **KMS/HSM:** Cloud KMS (AWS KMS, GCP KMS, Azure Key Vault), HashiCorp Vault Transit, or PKCS#11 HSMs are expected for any production key custody.
- **Side-channel:** constant-time primitives (`subtle`, `constant_time_eq`, `crypto_secretbox`); avoid hand-rolled comparison.
- **FIPS 140-2/140-3:** required for FedRAMP, federal, and most regulated industries.
- **References:** NIST SP 800-131A Rev 2 (2024), NIST SP 800-63B (digital identity), RFC 9106 (Argon2), Sigstore project (2021+).

## Phenotype state

| Crate | File:Line | What | Status |
|---|---|---|---|
| `thegent-crypto` | `thegent/crates/thegent-crypto/src/lib.rs:14-22` | `artifact_hash_bytes` — SHA-256 via `sha2` crate | ✓ primitive correct |
| `thegent-crypto` | `thegent/crates/thegent-crypto/src/lib.rs:26-34` | `sign_artifact_bytes` — HMAC-SHA256 via `hmac` crate (symmetric MAC) | ✓ primitive correct (MAC not signature — see Gap 1) |
| `thegent-crypto` | `thegent/crates/thegent-crypto/src/lib.rs:38-45` | `verify_signature_bytes` — **constant-time comparison via `subtle::ConstantTimeEq`** | ✓ side-channel correct |
| `thegent-crypto` | `thegent/crates/thegent-crypto/Cargo.toml:11-18` | Deps: `hmac 0.13`, `sha2 0.11`, `subtle 2.6.1`, `base16ct 1.0`, `serde`, `pyo3` (opt) | △ narrow dep set — no AEAD, no KDF, no signature scheme (see Gap 1) |
| `agileplus-refinery` | `agileplus-refinery/src/sign.rs:8-13` | `Signer` trait — pluggable commit signer | ✓ trait shape |
| `agileplus-refinery` | `agileplus-refinery/src/sign.rs:17-90` | `GpgSigner` — feature-gated `gpgme` (Rust) or shell-out to `gpg --detach-sign` | ✓ GPG path; △ shell-out fallback ignores errors when `gpgme` feature off (see Gap 2) |
| `agileplus-refinery` | `agileplus-refinery/src/sign.rs:95-164` | `SshSigner` — feature-gated `ssh-key` (Rust) or shell-out to `ssh-keygen -Y sign -n git` | ✓ SSH path; △ shell-out fallback identical to GPG concerns |
| `agileplus-refinery` | `agileplus-refinery/src/sign.rs:167-176` | `MockSigner` — test-only `[signed]` suffix | ✓ isolated to `#[cfg(test)]` analog (no test gate, but clearly named) |
| `agileplus-refinery` | `agileplus-refinery/src/sign.rs:262-300` | `amend_commit_with_gpg_signature` / `amend_commit_with_ssh_signature` — manual `gpgsig` header rewrite | △ bypasses git's normal signing path (see Gap 2) |
| `thegent-memory` | `thegent/crates/thegent-memory/Cargo.toml:26` | `ed25519-dalek = "3.0.0-pre.6"` declared as dep | △ declared but no `use` evidence in local source (only in `.venv/site-packages`); not wired to signer trait |
| `thegent/integrations` | `thegent/src/thegent/integrations/encrypted_artifact.py:1-?` | `EncryptedArtifactStore` with `ArtifactEncryptionConfig(algorithm="AES-256"\|"ChaCha20", key_id=…)` and validation rejecting empty | △ declared (AES-256/ChaCha20 options) but `EncryptedArtifactStore.__init__` body is stub — no real AEAD call wired (see Gap 3) |
| `thegent/agents/identity` | `thegent/src/thegent/agents/identity.py:49` | `"type": "Ed25519VerificationKey2020"` — DID method reference | △ declared in JSON spec but actual key generation/verification not located in local code (lives in libp2p-style vendor) |
| `agileplus-api` | `agileplus-api/src/middleware/auth.rs:4` | Comment: "constant-time comparison. JWT and Authvault integration remain follow-up" | ✗ authn path is **TODO** — only constant-time string compare; no JWT verify (see Gap 4) |
| `agileplus-api` | `agileplus-api/src/middleware/token_verifier.rs:3-29` | `TokenVerifier` trait — "shared-secret, JWT, Authvault" stubs, comment: "Follow-up: replace with JWT/Authvault adapter for FR-AGP-012" | ✗ authn adapter is a stub (see Gap 4) |

## Gaps

1. **`thegent-crypto` is MAC-only — no public-key signature, no AEAD, no KDF** — `thegent/crates/thegent-crypto/src/lib.rs:1-398`
   - Only HMAC-SHA256 + SHA-256. No Ed25519, no ECDSA, no RSA-PSS.
   - No AES-GCM, no ChaCha20-Poly1305 — meaning we cannot encrypt artifacts or secrets.
   - No Argon2id, no HKDF, no scrypt — meaning password hashing and KDF must be re-implemented in callers (or skipped).
   - The SOTA claim in `AUDIT_BLOC_VS_2026_SOTA.md:123` that `thegent-crypto` does "ECIES / AES-GCM / ed25519" is **aspirational**; the source does not implement any of these.
   - **Effort:** M. Add `ed25519-dalek` (already in `thegent-memory`), `aes-gcm`, `chacha20poly1305`, `argon2`, `hkdf` deps; expose `ed25519_sign/verify`, `aes_gcm_encrypt/decrypt`, `argon2id_hash/verify`, `hkdf_expand`. Tests + docstring updates.

2. **`agileplus-refinery` commit-signing shell-out path bypasses `gpgme`/`ssh-key` and rewrites `gpgsig` by hand** — `agileplus-refinery/src/sign.rs:49-89, 123-163, 262-300`
   - When `gpg`/`ssh-sign` features are off, code shells out to the binary; the resulting signature is base64-armored and stuffed into a `gpgsig` header that we hand-craft (line 271-287). If the binary exits non-zero we `bail!` (line 81), so failure is loud — good. But the manual header rewrite is fragile: a single off-by-one in the `replace('\n', "\n ")` (line 276, 285) yields a malformed commit object and `git fsck` rejects it.
   - When features are on, `gpgme`/`ssh-key` are used; the in-process path is safer.
   - **Effort:** S. Default `gpg` and `ssh-sign` features **on** in `Cargo.toml` so the in-process path is always taken. Add a `git fsck` post-sign check.

3. **`EncryptedArtifactStore` is declared but not implemented** — `thegent/src/thegent/integrations/encrypted_artifact.py:52-?`
   - `ArtifactEncryptionConfig` validates algorithm name and key_id (line 22-50 of the test file). But the class body in `encrypted_artifact.py:52` is a stub — `__init__` logs a debug line and does not call `cryptography.hazmat.primitives.ciphers.aead.AESGCM` or `chacha20poly1305.ChaCha20Poly1305`.
   - WL-254 test (`test_wl254_encrypted_artifact.py:47-49`) only checks `store is not None` — does **not** exercise encryption round-trip.
   - **Effort:** M. Wire `cryptography` (already a `thegent` venv dep per `.venv/site-packages`) into `EncryptedArtifactStore.encrypt/decrypt`. Add a round-trip + tamper test.

4. **Auth path is a stub — no JWT/Authvault verifier** — `agileplus-api/src/middleware/auth.rs:4`, `agileplus-api/src/middleware/token_verifier.rs:3-29`
   - The `auth.rs` comment line 4 admits the gap: "JWT and Authvault integration remain follow-up". The `token_verifier.rs` trait accepts `shared-secret` only.
   - The bloc has JWT/Authvault catalog requirements (`docs/requirements/authvault-frnfr.md`, `agileplus-sqlite/src/bin/seed_requirements.rs:16`) but no verifier implementation.
   - **Effort:** M. Implement Ed25519 JWT verifier (using `jsonwebtoken` or `jwt` crate) backed by the future `thegent-crypto` Ed25519 path. Wire Authvault public-key fetch (JWKS).

5. **No KMS/HSM abstraction anywhere in the bloc**
   - No `aws-kms`, `gcp-kms`, `azure-keyvault`, `vault-rs`, or `pkcs11` deps found in any `Cargo.toml` across `AgilePlus/`, `thegent/`, `Tracera/`, `Tracely/`.
   - The bloc relies on local files / env vars for key custody — incompatible with SOC 2 / HIPAA / FedRAMP.
   - **Effort:** L. Introduce a `phenotype-kms` crate with a `KmsBackend` trait (local-file, env, AWS KMS, Vault). Wire `thegent-crypto` to load signing keys via the trait. Roadmap: HSM via PKCS#11 last.

6. **No FIPS 140-2/140-3 compliance posture**
   - No `fips` feature flag on any crypto crate. No `aws-lc-fips` or `ring`'s FIPS module is used.
   - The `AUDIT_BLOC_VS_2026_SOTA.md` does not claim FIPS, but the bloc's claims of "AI workflow security" (line 374) will not pass federal review without it.
   - **Effort:** L. Decide target (FedRAMP Moderate vs High). Adopt `aws-lc-rs` (FIPS-validated) under a `fips` cargo feature. Re-validate all primitives.

7. **No KDF for password / secret-derived keys**
   - `phenotype-auth-ts` and `agileplus-api` would derive keys from env-var secrets. No `argon2id`, no `hkdf`, no `scrypt` is used at runtime.
   - **Effort:** S. Add `hkdf` + `argon2` to `thegent-crypto` deps. Expose `derive_key(secret, salt, info, len)`.

## Recommendations
1. **(P0)** Expand `thegent-crypto` to cover Ed25519, AES-GCM, ChaCha20-Poly1305, Argon2id, HKDF — the bloc's claimed SOTA primitives must actually exist. Effort: 1 week. Acceptance: `cargo test -p thegent-crypto` round-trips Ed25519 sign/verify, AES-GCM encrypt/decrypt, ChaCha20-Poly1305 encrypt/decrypt, Argon2id hash/verify, HKDF expand.
2. **(P0)** Implement `EncryptedArtifactStore.encrypt/decrypt` against `cryptography.AESGCM` / `ChaCha20Poly1305`. Add tamper + round-trip tests. Effort: 2 days.
3. **(P1)** Default `gpg` and `ssh-sign` cargo features **on** in `agileplus-refinery`. Add a `git fsck` post-sign validator. Effort: 1 day.
4. **(P1)** Wire `phenotype-auth-ts` / `agileplus-api` to Ed25519 JWT verification backed by `thegent-crypto`. Add JWKS fetch for Authvault. Effort: 3 days.
5. **(P2)** Introduce `phenotype-kms` trait + local-file + AWS KMS backend. Effort: 1 week.
6. **(P2)** Adopt `aws-lc-rs` under a `fips` cargo feature. Document FIPS scope. Effort: 1 week (incl. re-validation).
7. **(P3)** Document the current `thegent-crypto` "MAC-only" scope in the crate README so callers do not assume public-key or AEAD. Effort: 1 hour.
