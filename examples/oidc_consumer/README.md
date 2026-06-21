# oidc_consumer — Reference OIDC Consumer Example

**v19 cycle 9 T3 / L54 / ADR-079.** Standalone Rust example demonstrating
bearer-token + JWKS verification using the same patterns as
[`pheno-context/src/oidc.rs`](../../pheno-context/src/oidc.rs).

## Why this exists

The Phenotype fleet needs a single canonical OIDC client across substrate
services (router, observability, mcp-router, registry). `pheno-context` is
the substrate crate, but it's not buildable on the current branch's
sparse-checkout cone (no `Cargo.toml` is checked in). This example
provides the **buildable surface** so consumers can dogfood the API
before the substrate lands on main. See ADR-079 § "Reference
implementation" for the migration plan.

## Build

```bash
cd examples/oidc_consumer
cargo build --release
```

Build is hermetic — no workspace dependencies. Output: `./target/release/oidc_consumer`.

## Usage

### `verify` — verify a token against a live issuer's JWKS

```bash
./target/release/oidc_consumer verify "$ID_TOKEN" "https://your-tenant.auth0.com/" "https://your-api.example.com"
```

Fetches `${issuer}/.well-known/jwks.json`, looks up the key by `kid`,
verifies the signature + 5 standard claims (iss, aud, exp, iat, nbf),
and prints the decoded claims as JSON. Exits non-zero on any failure.

### `mock` — end-to-end happy path with a self-signed test token

```bash
./target/release/oidc_consumer mock
```

Generates an RS256-signed ID token in-process using a frozen test
RSA-2048 keypair (committed at `test_rsa.pem` / `test_rsa.pub`), then
verifies it against an in-memory JWKS containing the matching public
key. Use this to confirm the verification path works before pointing
at a real issuer.

### `info` — print the test public key as a JWK

```bash
./target/release/oidc_consumer info
```

Outputs the test public key in JWK format (`kty`, `n`, `e`, plus
`kid`/`alg`/`use` metadata) followed by the PEM body. Helpful for
debugging signature mismatches and for pasting into a test JWKS
document.

## What gets validated

Per ADR-079 §5 (Trust Model):

| Claim | Check |
|---|---|
| `iss` | exact match against configured issuer |
| `aud` | exact match (string or array containment) |
| `exp` | `> now` (UTC epoch seconds) |
| `iat` | present, not in the future |
| `nbf` | if present, `<= now` |
| `azp` | if present, must be in `PHENO_FEDERATION_AUTHORIZED_PARTIES` |
| signature | RS256 via JWKS lookup by `kid` |

Algorithm pinning (RS256 only) prevents `alg=none` and HS256-confusion
attacks. See `Authvault/src/domain/signing.rs` for the canonical
algorithm-binding pattern used elsewhere in the fleet.

## Sandbox providers

Any OIDC-compliant issuer works. Free developer sandboxes:

- [Auth0 free tier](https://auth0.com/signup) — fastest setup, M2M + user flows
- [Okta developer account](https://developer.okta.com/signup/) — full OIDC + SAML
- [Keycloak Getting Started](https://www.keycloak.org/getting-started) — self-hosted, no external dep

For each, register an API audience, create a client, and mint a test
token via the provider's token endpoint. Then run `verify` against
their JWKS URL (typically `${issuer}/.well-known/jwks.json`).

## Reference

- **ADR-079** — [OIDC Federation Reference Implementation](../../docs/adr/2026-06-21/ADR-079-oidc-federation-reference.md)
- **ADR-046** — Federation mTLS + OIDC (the joint model)
- **`pheno-context/src/oidc.rs`** — substrate reference impl (canonical API surface)
- **RFC 7519** — JSON Web Token
- **OIDC Core 1.0** — §3.1.3.7 (ID Token validation)

## Files

| File | Purpose |
|---|---|
| `Cargo.toml` | Standalone crate, no workspace deps |
| `src/main.rs` | 3 subcommands (verify, mock, info) + verify logic |
| `test_rsa.pem` / `test_rsa.pub` | Frozen RSA-2048 keypair for the mock + info paths |
