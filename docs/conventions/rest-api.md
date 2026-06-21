# REST API design conventions (v16 T2 / L9)

**Date:** 2026-06-21
**Pillar:** L9 (REST API design conventions — resource naming, status codes,
RFC 7807 error envelope, pagination, versioning, idempotency, auth, rate limit)
**Owner:** substrate-platform circle
**Status:** ACCEPTED — binding for all Phenotype fleet services.

## Overview

Every Phenotype service that exposes a public HTTP surface MUST follow this
convention. The goals: predictable URLs, machine-readable errors, safe retries,
and a uniform rate-limit contract that fleet-wide observability can depend on.

The convention is opinionated in eight places and silent elsewhere. Where this
doc is silent, follow [Microsoft REST API Guidelines][ms-rest] and
[RFC 9110 (HTTP Semantics)][rfc9110]. Where this doc contradicts them, this doc
wins.

[ms-rest]: https://github.com/microsoft/api-guidelines
[rfc9110]: https://www.rfc-editor.org/rfc/rfc9110

## 1. Resource naming

- **Plural nouns** for collection resources (`/users`, `/orders`, `/plugins`).
  Singular only for singleton config (`/config`, `/health`).
- **kebab-case** for multi-word resources (`/rate-limit-policies`,
  `/plugin-manifests`, `/api-keys`). snake_case and camelCase are forbidden in
  URL paths.
- **Hierarchical nesting** for owned sub-resources only when the parent ID is
  in the path: `/users/{user_id}/orders/{order_id}/items`. Maximum 2 levels of
  nesting — flatten beyond that.
- **Verbs in URLs are forbidden** (`/getUser` is wrong; `GET /users/{id}` is
  right). Exceptions: actions that do not map to CRUD
  (`POST /plugins/{id}/enable`, `POST /orders/{id}/cancel`).
- **Trailing slashes are forbidden** — redirect 308 if a client sends one.
- **Lowercase only.** Paths are case-sensitive; `/Plugins` and `/plugins` are
  different resources. Always emit lowercase.

```text
GET    /v1/plugins
POST   /v1/plugins
GET    /v1/plugins/{plugin_id}
PATCH  /v1/plugins/{plugin_id}
DELETE /v1/plugins/{plugin_id}
POST   /v1/plugins/{plugin_id}/enable
```

## 2. HTTP status codes

Use the **lowest status code that honestly describes the outcome**. Never send
`200 OK` for an error. Never send `500` for a client mistake.

| Outcome | Code | When |
|---------|------|------|
| Resource created | **201 Created** | `POST` returned a new resource. Send `Location` header. |
| Resource updated | **200 OK** | `PATCH` / `PUT` returned the updated representation. |
| Resource deleted | **204 No Content** | `DELETE` succeeded; no body. |
| Accepted, not yet processed | **202 Accepted** | Async work enqueued. Send `Location` pointing at a status endpoint. |
| No change needed | **304 Not Modified** | Conditional GET saw `If-None-Match` match. |
| Bad input from client | **400 Bad Request** | Malformed JSON, missing required field, schema violation. |
| Auth missing / invalid | **401 Unauthorized** | No token, expired token, signature mismatch. |
| Auth valid but insufficient | **403 Forbidden** | Token is fine; the principal cannot perform this action. |
| Resource not found | **404 Not Found** | URL does not exist OR the principal cannot see it (security: never confirm existence of resources they cannot see). |
| Method not allowed | **405 Method Not Allowed** | Right URL, wrong verb. Always send `Allow` header. |
| Conflict with current state | **409 Conflict** | Optimistic concurrency loss, duplicate key, version mismatch. |
| Resource gone | **410 Gone** | Resource was deliberately removed; do not retry. |
| Validation failed | **422 Unprocessable Entity** | Body parsed fine but semantically invalid (e.g. credit limit negative). |
| Rate limited | **429 Too Many Requests** | Send `Retry-After`. See § 8. |
| Server error | **500 Internal Server Error** | Unexpected failure. Logged with trace ID. |
| Bad gateway / upstream down | **502 Bad Gateway** / **503 Service Unavailable** / **504 Gateway Timeout** | Upstream dependency failed. Send `Retry-After` on 503. |

## 3. Error envelope (RFC 7807 — `application/problem+json`)

All errors MUST be returned as RFC 7807 problem documents with content type
`application/problem+json`. The five required fields:

```json
{
  "type": "https://phenotype.dev/probs/out-of-credit",
  "title": "You do not have enough credit.",
  "detail": "Your current balance is 30, but that costs 50.",
  "instance": "/account/12345/msgs/abc",
  "status": 403
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `type` | URI | Stable identifier of the error class. Resolves to a doc page. Use the `https://phenotype.dev/probs/<slug>` namespace. |
| `title` | string | Short, human-readable summary. **Same value for every occurrence of the same `type`** — not parameterized. |
| `detail` | string | Human-readable explanation specific to this occurrence. Safe to log. |
| `instance` | URI | The request path that produced the error. |
| `status` | int | Mirrors the HTTP status code. |

**Allowed extension fields** (advisory, not required):

- `trace_id` — OTel trace ID for cross-system correlation (see ADR-012).
- `errors` — array of field-level validation errors for 422 responses.

```json
{
  "type": "https://phenotype.dev/probs/validation-failed",
  "title": "Validation failed.",
  "detail": "One or more fields did not pass validation.",
  "instance": "/v1/users",
  "status": 422,
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "errors": [
    {"field": "email", "code": "invalid_format", "message": "must be a valid email"}
  ]
}
```

Clients MUST NOT parse `detail` programmatically; parse `type` + `status` only.

## 4. Pagination

Cursor-based pagination is the **only** sanctioned method. Offset/limit is
forbidden on resources with > 1,000 rows because skip-cost grows linearly.

### Request

```text
GET /v1/plugins?limit=50&cursor=eyJpZCI6IjEyMyJ9
```

| Query param | Default | Constraint |
|-------------|---------|------------|
| `limit` | 50 | Min 1, max 200. |
| `cursor` | (omitted → first page) | Opaque base64url string from previous `next_cursor`. |

### Response

```json
{
  "data": [ {"id": "p_001", "name": "rate-limit"}, ... ],
  "next_cursor": "eyJpZCI6IjE3MCJ9",
  "has_more": true
}
```

When `has_more` is `false`, `next_cursor` is omitted (not `null`).

**Server constraints:**

- Cursor MUST be opaque — clients MUST NOT parse it.
- Cursor MUST NOT leak resource IDs in plaintext (encrypt or HMAC).
- Cursor MUST expire after 24h; expired cursors return 400 with
  `type=https://phenotype.dev/probs/cursor-expired`.

## 5. Versioning

**URL-path versioning** is mandatory. Header-based versioning (`Accept:
application/vnd.phenotype.v2+json`) is forbidden.

```text
/v1/plugins
/v2/plugins
```

Rules:

- **Major** version is the only version exposed in the URL.
- Breaking changes require a new major version. Run **both** versions in
  parallel for a minimum of 6 months after deprecation announcement.
- The `Sunset` response header MUST be sent on the previous version:
  `Sunset: Wed, 01 Jan 2027 00:00:00 GMT`.
- The `Deprecation` response header MAY be sent earlier as a soft signal.
- A `Link: <https://phenotype.dev/docs/migration-v1-v2>; rel="deprecation"`
  header MAY be sent pointing at the migration guide.

## 6. Idempotency

`POST`, `PATCH`, and `DELETE` requests that are **not** pure reads MUST accept
an optional `Idempotency-Key` header. The semantics:

```text
POST /v1/plugins
Idempotency-Key: 8d2e3a40-1f23-4f10-9b1f-3a8b8c0e1d22
Content-Type: application/json

{"name": "rate-limit", "version": "1.0.0"}
```

- The key MUST be a UUIDv4 or stronger random string (≥ 128 bits entropy).
- The server stores `(key, principal_id, request_body_hash, response)` for
  **at least 24 hours**.
- A second request with the **same key + same body hash** returns the cached
  response verbatim (same status, same headers, same body).
- A second request with the **same key + different body hash** returns 422
  with `type=https://phenotype.dev/probs/idempotency-key-mismatch`.
- A second request with a **new key** is treated as a fresh operation.
- Idempotency keys are scoped to `(principal_id, endpoint)` — different
  endpoints may reuse the same key.

## 7. Authentication

**Bearer JWT** is the only sanctioned transport-level auth scheme. mTLS is
permitted on internal mesh but not exposed to clients.

```text
GET /v1/plugins
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

Rules:

- Tokens MUST be RS256-signed JWTs (no HS256 shared-secret, no `none`).
- Tokens MUST carry an `exp` claim; expired tokens return 401 with
  `type=https://phenotype.dev/probs/token-expired`.
- Tokens MUST NOT appear in URLs (no `?access_token=...`).
- Refresh tokens (if used) are opaque, sent only on the auth endpoint, and
  scoped to `refresh_token`.
- Service-to-service calls in the fleet carry an additional header
  `X-Phenotype-Service: <service-id>` for audit trail.

**Authorization errors** never disclose whether a resource exists:

```text
GET /v1/plugins/p_secret
Authorization: Bearer <unauthorized-principal>

→ 404 Not Found   (not 403 — never confirm existence)
```

## 8. Rate limiting

Standard headers on **every** response (success or error):

```text
X-RateLimit-Limit:     1000
X-RateLimit-Remaining: 742
X-RateLimit-Reset:     1719005460         # Unix epoch seconds
Retry-After:           60                 # only on 429
```

Rules:

- The limit window is **per principal per endpoint group**. Window is fixed at
  60s rolling.
- On 429 the body MUST be the RFC 7807 envelope with
  `type=https://phenotype.dev/probs/rate-limited` and `Retry-After` set to the
  integer seconds until the next quota refresh.
- Limits MUST be advertised in the response headers **before** a client hits
  them (do not withhold until 429).
- Internal services have an explicit higher tier (`X-RateLimit-Tier: internal`)
  surfaced via the `X-Phenotype-Service` header from § 7.

### Default tiers

| Tier | Limit (req / 60s) | Principal |
|------|-------------------|-----------|
| `public` | 60 | unauthenticated clients |
| `standard` | 1,000 | authenticated principals |
| `internal` | 100,000 | fleet service-to-service |
| `partner` | 10,000 | negotiated via ADR-046 federation contract |

## Reference implementations

The following services implement this convention (see their `## REST API
examples` sections):

1. `phenotype-router`
2. `pheno-mcp-router` *(pending local checkout)*
3. `nanovms` *(pending local checkout)*
4. `Eidolon`
5. `agent-platform`

## Migration checklist (per service)

- [ ] All collection URLs use plural nouns + kebab-case.
- [ ] All errors return `application/problem+json` with the 5 required fields.
- [ ] Cursor pagination on every list endpoint (`?cursor=`, `?limit=`).
- [ ] All endpoints are versioned under `/v{N}/`.
- [ ] Mutating endpoints accept `Idempotency-Key`.
- [ ] Auth via `Authorization: Bearer <jwt>`; RS256 only.
- [ ] Rate-limit headers on every response.
- [ ] README has a `## REST API examples` section with ≥ 3 curl blocks.

## References

- [RFC 7807 — Problem Details for HTTP APIs][rfc7807]
- [RFC 9110 — HTTP Semantics][rfc9110]
- [Microsoft REST API Guidelines][ms-rest]
- [Stripe API — Idempotency Requests][stripe-idem]
- [GitHub REST API — Versioning][gh-ver]
- [IETF draft — Problem Details for HTTP APIs (revised)][rfc7807bis]
- [OWASP API Security Top 10 — API3:2023 (Broken Object Property Level Auth)][owasp]

[rfc7807]: https://www.rfc-editor.org/rfc/rfc7807
[rfc7807bis]: https://datatracker.ietf.org/doc/draft-ietf-httpapi-rfc7807bis/
[stripe-idem]: https://stripe.com/docs/api/idempotent_requests
[gh-ver]: https://docs.github.com/en/rest/about-the-rest-api/api-versions
[owasp]: https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/