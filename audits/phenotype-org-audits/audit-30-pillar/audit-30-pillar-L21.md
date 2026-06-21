# L21 — AuthN / AuthZ (OAuth / SAML / JWT)

**Owner:** forge-A11 (security)
**Bloc scope:** AgilePlus + thegent + Tracely + Tracera

## Scope

Authentication and authorization across the Phenotype bloc: OAuth 2.0 / OIDC, SAML SSO, JWT (signed tokens), API-key patterns, session management, RBAC / ABAC, MFA / TOTP / WebAuthn, token rotation and expiry. The bloc is mostly an *agent runtime* (calls LLM providers, runs the factory loop) — outbound auth (provider API keys) is part of scope. Bloc exposure to inbound auth is via `agileplus-api` (axum HTTP), `agileplus-mcp-intent` (MCP HTTP), `thegent` MCP server, and `Tracera` FastAPI.

## SOTA 2026

- **OAuth 2.0 + OIDC** — Authorization Code + PKCE (RFC 7636) for first-party; Client Credentials for service-to-service. Libraries: `oauth2` (Rust), `authlib` (Python), `next-auth` (TS). Discovery via `.well-known/openid-configuration`.
- **SAML 2.0 SSO** — enterprise federation; libs `python3-saml`, `rust-saml`. Most 2026 SaaS offers SAML on the enterprise tier.
- **JWT (RFC 7519)** — `jsonwebtoken` (Rust), `pyjwt` (Python), `jose` (TS). Algorithm: RS256/ES256 (asymmetric) preferred; HS256 only for service-to-service. Token introspection endpoint. Refresh-token rotation. JTI for replay protection. `kid` header for key rotation.
- **API keys** — 32-byte random, base64url, with prefix (e.g., `agp_`, `sk-`). SHA-256 hash at rest. `Authorization: Bearer` or `X-API-Key` header. Constant-time comparison. No `?api_key=…` in URL (logs).
- **Sessions** — server-side store (Redis, Postgres) or stateless JWT. `Secure`, `HttpOnly`, `SameSite=Lax` cookies. CSRF token on state-changing methods.
- **RBAC / ABAC** — role enum + permission set, OR Rego (OPA) policy with `allow { … }` rules. ReBAC (Zanzibar) for graph-shaped perms.
- **MFA / WebAuthn / TOTP** — WebAuthn (FIDO2) for phishing-resistant; TOTP (RFC 6238) for low-friction; `pyotp`, `webauthn-rs`.
- **Token rotation** — refresh tokens single-use; rotation on every refresh; revoke on compromise. JWT `exp` ≤ 1h; refresh ≤ 30d.
- **Federated exemplar:** `thegent/thegent-wtrees/threat-model-2026-06-16/SECURITY.md:60-160` documents CRUN's full auth model (env-var, JWT, API key, OAuth2/OIDC + RBAC matrix).

## Phenotype state

### OAuth 2.0 / OIDC

- **AgilePlus:** No OAuth/OIDC code cited. `agileplus-github/src/client.rs:1-233` is a GitHub REST+GraphQL client — does it use OAuth or PAT? Not line-cited. The auth middleware in `agileplus-api/src/middleware/token_verifier.rs:42-55` accepts `Bearer <token>` and `X-API-Key` only. — **status ✗** (no OAuth path)
- **thegent:** No OAuth provider implementation. The threat model line 143-145 mentions "Optional `PyJWT>=2.12.0` bearer token" for the MCP server but no OIDC discovery / token-introspection wiring. — **status ✗** (OAuth absent)
- **CRUN (thegent subproject, documentation only):** `thegent/thegent-wtrees/threat-model-2026-06-16/SECURITY.md:138-157` documents OAuth2/OIDC with `CRUN_OAUTH_PROVIDER`, `CRUN_OAUTH_CLIENT_ID`, `CRUN_OAUTH_CLIENT_SECRET`, `CRUN_OAUTH_REDIRECT_URI` env vars — but these are *spec docs*, not implementation. CRUN is a thegent subproject; not active. — **status ✗** (spec only)
- **Tracely / Tracera:** No OAuth code cited. — **status ✗**

### SAML SSO

- No SAML libraries (`python3-saml`, `rust-saml`, `saml2`) cited in any of the 4 repos. No `saml/`, `saml2/`, `idp/`, `sp/` directories. — **status ✗** (SAML absent bloc-wide)

### JWT (jsonwebtoken / pyjwt / jose)

- **AgilePlus:** `agileplus-api/Cargo.toml` does **not** depend on `jsonwebtoken` or `jwt-simple` (only `SharedSecretVerifier` is implemented). `agileplus-api/src/middleware/token_verifier.rs:30-31` comment: "Follow-up: replace with JWT/Authvault adapter for FR-AGP-012 (JWT/Authvault integration noted as future work)". — **status △** (planned, not implemented)
- **thegent:** `PyJWT>=2.12.0` mentioned in threat model line 143 as an *optional* dependency for the MCP server. `thegent/pyproject.toml` — verify pinning (not line-cited). — **status △** (optional, not enforced)
- **Tracely / Tracera:** No JWT lib cited. — **status ✗**
- Bloc-wide, JWT validation is **not** enforced on any HTTP surface. The Bearer header is accepted but treated as opaque shared-secret (AgilePlus) or fail-open (thegent MCP). — **status △** (Bearer wire, no JWT validation)

### API key patterns

- **`AgilePlus/crates/agileplus-api/src/api_key.rs:1-137`** — full API-key lifecycle. Line 22 `KEY_PREFIX: &str = "agp_"`; line 27-31 32-byte random via `rand::thread_rng().fill_bytes`; line 30 base64url-encoded (`URL_SAFE_NO_PAD`); line 34-38 `hash_key` uses SHA-256; line 41-47 default path `~/.config/agileplus/api-key`; line 75-85 0600 permissions on Unix. — **status ✓** (SOTA-grade key gen)
- **`AgilePlus/crates/agileplus-api/src/middleware/token_verifier.rs:56-81`** — `SharedSecretVerifier` with **constant-time comparison** using `fold(0u8, |acc, (a, b)| acc | (a ^ b))` and `std::hint::black_box` to defeat optimiser short-circuit; CSV env var `AGILEPLUS_API_KEY`; rejects length-mismatch with `black_box(0u8)` to keep timing uniform. — **status ✓** (SOTA constant-time)
- **`AgilePlus/crates/agileplus-api/src/middleware/auth.rs:42-55`** — `extract_token` reads `Authorization: Bearer` *or* `X-API-Key`; trims; returns `401` on missing/invalid. — **status ✓**
- **`AgilePlus/crates/agileplus-api/src/api_key.rs:69-72`** — plaintext stored in the credential store alongside the hash; line 67-72 comment: "Store the plaintext directly in the credential store for validation (the default InMemoryCredentialStore / FileCredentialStore validate against comma-separated plaintext keys — see credentials.rs)". — **status △** (the default credential store keeps plaintext; the hash is computed but not used for default validation; audit-only path)
- **`AgilePlus/crates/agileplus-domain/src/credentials.rs:1-101`** — 101-line credential store (InMemory + File). — **status △** (existence; not line-cited for crypto review)
- **thegent:** API key handling is via `pydantic-settings` reading env (per threat model line 111). No typed key-store / no prefix. — **status △** (env-var only; no key-store)
- **Tracely / Tracera:** No API-key code cited. — **status ✗**

### Session management

- No session middleware in any of the 4 repos. `grep -rln "session\|cookie\|csrf\|Set-Cookie" --include="*.rs" --include="*.py"` returns 0 hits for cookie/session middleware. — **status ✗** (stateless; correct for agentic runtimes; absence is intentional)

### RBAC / ABAC

- **`thegent/src/thegent/security/rbac.py:1-219`** — comprehensive RBAC. Line 9-16: 6 `Role` enum (ADMIN, OPERATOR, AUDITOR, INCIDENT_COMMANDER, DEVELOPER, VIEWER). Line 19-27: 7 `Permission` enum (RUN_AGENT, PURGE_DATA, VIEW_LOGS, MANAGE_USERS, VIEW_METRICS, CONFIGURE_SYSTEM, EMERGENCY_OVERRIDE). Line 30-61: `ROLE_PERMISSIONS` matrix. Line 64-69: 4 `LANE_ACCESS` lanes (standard/critical/restricted/emergency). Line 72-89: `OPERATION_PERMISSION_MAP` (17 operation strings → permission). Line 92-212: `RBACManager` with `has_permission`, `check_access`, `get_role_permissions`, `get_lane_access`. — **status ✓** (rich RBAC substrate)
- **thegent RBAC vulnerability (line 178-180):** `_map_operation_to_permission` uses `if op_pattern in op_lower` — **substring containment, not exact match**. Operation `"purge the logs"` would match the `"purge"` pattern and grant `PURGE_DATA` even when the user only intended to view logs. — **status △** (logic gap; security implication)
- **`thegent/src/thegent/security/rbac.py:184-190`** — `_role_from_settings` always returns `Role.VIEWER` (stub; doesn't actually read settings). — **status △** (placeholder)
- **`AgilePlus/crates/agileplus-governance/src/policy.rs:1-541`** — Rego-style policy with `Policy { id, name, resource, action, effect, conditions, priority, enabled }`; 541 lines. — **status ✓** (ABAC substrate; not currently wired to `agileplus-api` router)
- **`AgilePlus/crates/agileplus-api/src/middleware/auth.rs:20-40`** — no permission check, only authentication (verify token). No per-route RBAC. — **status ✗** (any authenticated caller can hit any protected route)
- **Tracely / Tracera:** No RBAC code cited. — **status ✗**

### MFA / TOTP / WebAuthn

- `find … -name "mfa*" -o -name "totp*" -o -name "webauthn*" -o -name "fido*"` returns **0 hits** across all 4 repos. No `pyotp`, no `webauthn-rs`, no FIDO2. — **status ✗** (MFA absent bloc-wide)

### Token rotation / expiry

- **`thegent/src/thegent/integrations/auth_expiry.py:1-174`** — `AuthExpiryDetector` with `ExpiryStatus` (VALID/EXPIRING_SOON/EXPIRED); 24-hour threshold; 1-hour "critical" threshold; supports `expires_at`, `expiry_timestamp`, `ttl`, `expires_in` formats. — **status ✓** (174 lines, well-typed)
- **thegent:** no JWT-refresh-rotation flow (because no JWT is validated).
- **AgilePlus:** `SharedSecretVerifier` has no rotation. API key is generated once; rotation = `agileplus-api/src/api_key.rs` re-generation. No scheduled rotation. — **status △** (manual rotation only)
- **Tracely / Tracera:** No rotation logic cited. — **status ✗**

### Cryptographic identities (cross-ref L22)

- **`thegent/crates/thegent-crypto/`** — ECIES / AES-GCM / ed25519 (per `AUDIT_BLOC_VS_2026_SOTA.md:122-123`). — **status ✓** (crypto substrate)
- **`AgilePlus/crates/agileplus-p2p/src/device.rs:1-245`** — P2P device identity (per `AUDIT_BLOC_VS_2026_SOTA.md:77`). — **status ✓**
- **`AgilePlus/crates/agileplus-refinery/src/sign.rs`** — Sigstore/PGP commit signing (per `AUDIT_BLOC_VS_2026_SOTA.md:49`). — **status ✓** (provenance, not user auth)

### MCP server authentication

- **`thegent/src/thegent/mcp/server/auth.py:1-154`** — `AuthProvider` (line 24-48) in-memory `dict[str, str]` of users → tokens; `AuthContext` (line 11-21); `BearerAuthMiddleware` (line 75-119). — **status △** (impl present; L21 gap #2 fail-open below)
- **thegent MCP auth vulnerability (line 30-33):** `AuthProvider.authenticate(user_id, token)` **always returns `True`** — just stores the pair in `_users`. No password check, no signature check, no token introspection. — **status ✗** (broken — accepts any (user_id, token) pair)
- **thegent MCP auth vulnerability (line 35-40):** `AuthProvider.verify(token)` uses `stored_token == token` — **non-constant-time string compare** (timing attack). — **status ✗** (timing oracle)
- **thegent MCP auth vulnerability (line 96-119):** `BearerAuthMiddleware.dispatch` — when no valid Bearer is present, line 116-119 falls through to `await call_next(request)` (no 401). The comment "No valid auth - let the app handle it" describes **fail-open** behaviour. — **status ✗** (fail-open; should be 401)
- **`AgilePlus/crates/agileplus-mcp-intent/src/http.rs:1-159`** — typed HTTP transport; L21 auth wiring not cited. — **status ✗** (no auth layer)

### Provider auth (outbound to LLM providers)

- **`thegent/crates/thegent-router/`** — LLM provider router (Anthropic, OpenAI, local) per `AUDIT_BLOC_VS_2026_SOTA.md:119`. Auth = API key in env (`pydantic-settings`). Per threat model line 111, mitigation = "pydantic-settings loads keys from env only; .gitignore blocks .env; pre-commit-config.yaml runs gitleaks + trufflehog". — **status △** (env-only, no key rotation, no key vault)
- **`phenotype-dep-guard/src/phenotype_dep_guard/agent.py:11-43`** — `LLMClient` reads `minimax-m2.7-highspeed` default, falls back to mock. No secret in code. — **status ✓** (no hard-coded secret; L18 cross-ref)

## Gaps

1. **No OAuth 2.0 / OIDC in any inbound surface** — `agileplus-api`, `agileplus-mcp-intent`, `thegent` MCP, `Tracera` API all accept Bearer/API-key only. No Authorization Code + PKCE, no OIDC discovery, no token introspection. For enterprise federation, the bloc is **invisible to IdPs** (Okta, Azure AD, Google Workspace). — **effort: L** (add `oauth2` (Rust) + `authlib` (Python) wrappers; ~1-2 weeks per crate)
2. **`thegent/src/thegent/mcp/server/auth.py` is fail-open and broken** — three stacked issues: (a) `authenticate()` returns True unconditionally (line 30-33), (b) `verify()` is non-constant-time (line 38), (c) `BearerAuthMiddleware.dispatch` lets unauthenticated requests through (line 116-119). **High-severity; pre-production blocker for any user-facing deployment.** — **effort: S** (fix in-place: real backend, constant-time compare, 401 on no/invalid token)
3. **No JWT validation anywhere** — `agileplus-api` accepts `Bearer <opaque>` and treats it as a shared secret. `agileplus-api/src/middleware/token_verifier.rs:30-31` explicitly notes "Follow-up: replace with JWT/Authvault adapter for FR-AGP-012". — **effort: M** (add `JwtVerifier` implementing the existing `TokenVerifier` trait at `agileplus-api/src/middleware/token_verifier.rs:13-19`; use `jsonwebtoken` crate; support RS256/ES256)
4. **No SAML SSO bloc-wide** — `find … -name "saml*"` returns 0 hits. For enterprise customers, this excludes the bloc from a whole class of B2B deals. — **effort: L** (add `python3-saml` (Python) or `samael` (Rust); ~2 weeks; only worth it for SaaS deployment)
5. **No MFA / WebAuthn / TOTP bloc-wide** — `find … -name "totp*" -o -name "webauthn*"` returns 0 hits. A compromised API key = full access; no second factor. — **effort: L** (add TOTP via `pyotp` for thegent, `totp-rs` for Rust; WebAuthn via `webauthn-rs`; only meaningful if user-facing auth exists)
6. **No per-route RBAC in `agileplus-api`** — `agileplus-api/src/middleware/auth.rs:20-40` checks "is the token valid?" but not "does this role have permission for this route?". Any authenticated caller can `POST /api/v1/features` or `DELETE /api/v1/work-packages/:id` (if DELETE exists). — **effort: M** (wire `agileplus-governance::policy::Policy` into the router as a second middleware; check `resource + action` per request)
7. **`thegent/src/thegent/security/rbac.py:178-180` substring-match op mapping** — `if op_pattern in op_lower` means `"purge the logs"` matches `"purge"` and grants `PURGE_DATA`. — **effort: S** (use `==` on a normalised key, or word-boundary regex)
8. **`thegent/src/thegent/security/rbac.py:184-190` `_role_from_settings` always returns `Role.VIEWER`** — RBAC is effectively stubbed; the actual role is never read from settings. — **effort: S** (implement real read from `ThegentSettings`; fail-closed on missing)
9. **`AgilePlus/crates/agileplus-api/src/api_key.rs:69-72` stores plaintext in the credential store** — the SHA-256 hash is computed (line 34-38) but the default `InMemoryCredentialStore` validates against *plaintext* (per comment line 67-72). Hash-at-rest is documented but not enforced. — **effort: S** (change `InMemoryCredentialStore` / `FileCredentialStore` to compare hash-of-input against stored hash)
10. **No token-rotation cadence for AgilePlus API keys** — `AGILEPLUS_API_KEY` is set once; no scheduler, no expiry. — **effort: S** (add `agileplus-api/src/key_rotation.rs` + a 90-day rotation reminder in `agileplus-governance/audit.rs`)
11. **No key vault (Vault / AWS Secrets Manager) for outbound provider auth** — `thegent` reads LLM API keys from env. Per L18 evidence, no `phenotype-secret-loader` exists. — **effort: L** (wrap Vault client; rotate keys centrally; L18 gap #2)
12. **Tracera has only `.pyc` for auth (no source)** — `Tracera/src/tracertm/api/middleware/auth.cpython-313.pyc` (and 9 sibling `auth*.cpython-313.pyc` files) have no `.py` counterpart in the repo. Cannot audit. — **effort: S** (restore .py sources; or document the build-from-source path)
13. **`agileplus-mcp-intent/src/http.rs:1-159` has no auth layer** — 30+ MCP tools exposed, transport is HTTP, no Bearer middleware. — **effort: M** (port the trait from `agileplus-api/src/middleware/auth.rs:20-40`; plug into the transport)

## Recommendations

1. **Fix the thegent MCP auth code now (`thegent/src/thegent/mcp/server/auth.py:1-154`).** (a) `authenticate()` must verify (e.g., HMAC compare against a shared secret loaded from env); (b) `verify()` must use `hmac.compare_digest` for constant-time compare; (c) `BearerAuthMiddleware.dispatch` must return `401` when no/invalid Bearer is present. Effort: S. **High-severity.**
2. **Implement a `JwtVerifier` for `agileplus-api`.** Implement the existing `TokenVerifier` trait (`agileplus-api/src/middleware/token_verifier.rs:13-19`) with a `JwtVerifier` that uses `jsonwebtoken` (RS256/ES256, JWKS, `exp`/`nbf`/`iss`/`aud` validation). Closes FR-AGP-012. Effort: M.
3. **Add OAuth 2.0 + OIDC to one user-facing surface (recommend `agileplus-dashboard`).** Add `oauth2` (Rust, Authorization Code + PKCE). Discover via `/.well-known/openid-configuration`. Map IdP claims → `agileplus-governance::policy::Policy` roles. Effort: L.
4. **Wire `agileplus-governance::policy` into `agileplus-api` router as a second middleware** (after `authorize`). Each route declares required `(resource, action)`; policy decides allow/deny. Closes the "any-authenticated-can-do-anything" gap. Effort: M.
5. **Fix the thegent RBAC substring-match** (`rbac.py:178-180`) and the stub `_role_from_settings` (`rbac.py:184-190`). Word-boundary match + real settings read. Effort: S.
6. **Hash-at-rest for the default `agileplus-domain::credentials::CredentialStore`.** Compare hash-of-input against stored hash. Keep the plaintext file at `~/.config/agileplus/api-key` for operator convenience, but the in-memory + file store should only hold hashes. Effort: S.
7. **Add TOTP-based 2FA to the thegent CLI** (if/when user-facing login lands). `pyotp` for Python; user-scoped secret stored in the credential store; TOTP required for `EMERGENCY_OVERRIDE` and `CONFIGURE_SYSTEM` permissions. Effort: M.
8. **Restore Tracera `.py` auth sources** to the repo (or add a documented build-from-source step). Effort: S.
9. **Add `agileplus-mcp-intent::http` Bearer middleware** (port `agileplus-api::middleware::auth` trait). Closes the "30+ MCP tools on HTTP with no auth" gap. Effort: M.
10. **Document a SAML-on-the-enterprise-tier story** (do not implement until SaaS). Tracera FastAPI is the most likely user-facing surface; `python3-saml` integrates with FastAPI via `fastapi-saml`. Effort: L (deferred).
11. **Add a 90-day API-key rotation reminder** in `agileplus-governance::audit.rs` + a `key_rotation` CLI subcommand. Effort: S.
12. **Land the OAuth scopes ↔ `agileplus-graph::RelType` mapping** (per MCP 2025-Spec §5.1 cited in `AUDIT_BLOC_VS_2026_SOTA.md:318`). Each scope = a `RelType` the caller can read. Closes the "no OAuth scope-based tool discovery" gap. Effort: M.
