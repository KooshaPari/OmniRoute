# ADR-079: OIDC Federation Reference Implementation (L54)

| Field | Value |
|---|---|
| Status | ACCEPTED |
| Date | 2026-06-21 |
| Deciders | Architecture guild, Security guild, Orchestrator (L5-151) |
| Related | ADR-046 (federation mTLS + OIDC), ADR-077 (vault migration), ADR-078 (encryption-at-rest), examples/oidc_consumer/ |
| Supersedes | — |
| Cycle | v19 (cycle 9) |
| Pillar | L54 (Federation mTLS + OIDC) |

## Context

The fleet has multiple substrate services (router, observability, mcp-router, registry) that need to authenticate calls from peer services and from external clients. ADR-046 (L5-111) committed to mTLS for transport and OIDC for identity, but the reference implementation was left as future work.

In the interim:
1. Each service implemented its own ad-hoc token verifier (jose, jansson, custom parse).
2. None of them validate `iss` (issuer), `aud` (audience), or `azp` (authorized party) consistently.
3. None of them enforce a token shape contract — a service that expects `sub` would happily accept a token that only has `email`.

We need a single Rust crate that:
- Accepts a `ProviderConfig { issuer, audience, jwks_uri, refresh_interval }`
- Fetches and caches JWKS
- Validates the 5 standard claims (`iss`, `aud`, `exp`, `iat`, `nbf`) plus the custom `azp`
- Returns a typed `Identity { subject, email, groups, scopes, azp }`
- Is `no_std`-compatible for the embedded router spike target
- Exposes a `FederationClient` for outbound calls (mTLS + bearer injection)

This ADR captures the design and the reference implementation at `examples/oidc_consumer/`.

## Decision

We adopt **`pheno-context::oidc::FederationClient`** as the canonical OIDC client across the fleet, with these design points:

1. **Single dependency surface**: `pheno-context` is the only crate that depends on `jsonwebtoken`, `reqwest` (rustls), and `tokio-rustls`. Other crates depend on `pheno-context` only.
2. **Issuer allowlist via config**: bootstrap reads `PHENO_FEDERATION_ISSUERS` (comma-separated), refuses to validate tokens from issuers not in the allowlist.
3. **Audience enforcement**: `aud` claim must equal the configured `PHENO_FEDERATION_AUDIENCE` exactly (not just "contains").
4. **`azp` enforcement**: if the token has `azp`, it must equal one of the `PHENO_FEDERATION_AUTHORIZED_PARTIES` entries. This prevents confused-deputy attacks.
5. **JWKS caching**: 5-minute TTL with 10% jitter to prevent thundering herd. Cache key is `(issuer, kid)`.
6. **Refresh on `kid` miss**: if a token references a `kid` not in the cache, trigger a refresh and retry once before failing.
7. **Reference impl at `examples/oidc_consumer/`**: the canonical usage pattern. Pheno-router, pheno-observability, and pheno-mcp-router MUST consume this example as a template for their own client.

## Reference implementation

`examples/oidc_consumer/src/oidc.rs` provides:

- `FederationClient::new(config: FederationConfig) -> Result<Self, OidcError>`
- `FederationClient::verify(token: &str) -> Result<Identity, OidcError>`
- `FederationClient::middleware() -> impl Fn(Request) -> Request` — bearer injection for outbound
- `Identity { subject, email, groups, scopes, azp, expires_at }`

`examples/oidc_consumer/src/main.rs` shows a 60-line `axum` server that:
1. Loads config from env (`PHENO_FEDERATION_ISSUER`, `PHENO_FEDERATION_AUDIENCE`, `PHENO_FEDERATION_JWKS_URI`)
2. Verifies the bearer token on every request
3. Logs `subject + azp` to stdout
4. Exposes a single `GET /whoami` endpoint

## Consequences

**Positive:**
- One crate, one set of tests, one set of CVEs to track.
- The 5 standard claims + `azp` are now uniformly enforced.
- The reference impl at `examples/oidc_consumer/` is a 60-line copy-paste target for new services.

**Negative:**
- All services that currently use ad-hoc token verification need a 1-2 day migration. Pheno-router and pheno-observability are in scope for v20.
- The `no_std` constraint requires `jsonwebtoken` to expose a `no_std` feature, which it does as of v9.x.

**Neutral:**
- The mTLS path is independent and lives in `pheno-context::mtls`. ADR-046 covers the joint model.

## Alternatives considered

1. **Per-service custom verifiers** — rejected; ADR-046 was explicit that this is the wrong path.
2. **`jsonwebtoken` direct in each service** — rejected; duplicates the 5-claim + `azp` logic 5 times.
3. **`oauth2` crate** — rejected; too heavy, async-first but pulls in `tokio` and is not `no_std`.
4. **`openidconnect` crate** — rejected; verbose, exposes the full discovery flow when we only need JWKS.

## Migration plan

| Service | Migration PR target | Effort |
|---|---|---|
| `pheno-router` | `pheno-context = "0.5"` in Cargo.toml | 2 days |
| `pheno-observability` | same | 1 day |
| `pheno-mcp-router` | same | 2 days |
| `phenotype-router` (spike→prod) | same | 1 day |

Target: all 4 services on `pheno-context::oidc::FederationClient` by v20 closure (target 2026-06-28).

## References

- ADR-046 (federation mTLS + OIDC)
- ADR-077 (vault migration roadmap)
- ADR-078 (encryption-at-rest mandate)
- OIDC Core 1.0 spec, RFC 7519 (JWT)
- examples/oidc_consumer/ (reference implementation)
