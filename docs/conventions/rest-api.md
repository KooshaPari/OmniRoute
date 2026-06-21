# REST API Conventions (L9 — RFC 7807 Error Envelope)

**Date:** 2026-06-21
**Cycle:** v16 / Cycle 6 / T2
**Pillar:** L9 — API Design Conventions
**Status:** ✅ CONVENTION RATIFIED
**Refs:** ADR-024 (71-pillar framework, L9 scoring), `findings/2026-06-21-v16-L9-api-conventions.md`
(strategic overview), `findings/71-pillar-2026-06-17-schema.md` § L9 rubric.

## Purpose

This document is the **monorepo-level source of truth** for REST API conventions in the
Phenotype fleet. Every service that exposes an HTTP surface MUST follow these rules. The
rules are enforced by:

1. **CI gate** — `pheno-api-lint` workflow in `.github/workflows/api-lint.yml` fails the
   build if `openapi.json` diverges from the conventions.
2. **README convention** — every service `README.md` MUST include a "Quickstart" section
   with curl examples matching § Curl Template below. The 5 README curl-block PRs in this
   cycle are the first wave of adoption.
3. **Review checklist** — every PR that touches a service's HTTP handlers must reference
   this file in its description.

## URL structure

```
/api/v{MAJOR}/<service>/<resource>[/<id>[/<sub-resource>[/<sub-id>]]]
```

| Segment | Rule | Example |
|---------|------|---------|
| `/api/v{MAJOR}/` | explicit version prefix; never bare `/v1/` | `/api/v1/` |
| `<service>` | kebab-case; matches repo name | `pheno-port-adapter` |
| `<resource>` | plural noun in kebab-case | `connectors`, `metrics`, `spans` |
| `<id>` | opaque server-assigned ID; clients MUST treat as opaque | `cnn_01HXYZ...` |
| `<sub-resource>` | nested plural noun | `connectors/{id}/health` |

## Methods (canonical)

| Method | Idempotent | Safe | Purpose |
|--------|:----------:|:----:|---------|
| `GET`   | ✅ | ✅ | Read resource(s) |
| `POST`  | ❌ | ❌ | Create; URL returns `Location` header |
| `PUT`   | ✅ | ❌ | Replace resource entirely |
| `PATCH` | ❌ | ❌ | Partial update (RFC 6902 JSON Patch) |
| `DELETE`| ✅ | ❌ | Delete; `204 No Content` on success |

Non-conforming verbs (`SEARCH`, `VIEW`, `LIST`, `PURGE`) are **FORBIDDEN**. Use `GET` with
query params instead.

## Status codes (canonical)

| Code | Meaning | When |
|-----:|---------|------|
| **200** | OK | Successful read |
| **201** | Created | Successful create (with `Location` header) |
| **202** | Accepted | Async operation queued |
| **204** | No Content | Successful delete |
| **400** | Bad Request | Validation failed (with `error.code` and `error.message`) |
| **401** | Unauthorized | Missing/invalid auth |
| **403** | Forbidden | Auth valid but lacks permission |
| **404** | Not Found | Resource doesn't exist |
| **409** | Conflict | State conflict (e.g., duplicate key) |
| **422** | Unprocessable Entity | Semantic validation failed |
| **429** | Too Many Requests | Rate-limited (with `Retry-After` header) |
| **500** | Internal Server Error | Unexpected server error |
| **502** | Bad Gateway | Upstream service failure |
| **503** | Service Unavailable | Service is down or overloaded |
| **504** | Gateway Timeout | Upstream timeout |

Non-canonical codes (e.g., `418 I'm a teapot`) MUST NOT be used.

## Error response body (RFC 7807 — Problem Details for HTTP APIs)

**RFC 7807 is the canonical error envelope for the entire fleet.** All ≥400 responses MUST
use this shape. The `type` URI is dereferenceable (resolves to a human-readable page on
`phenotype.dev`).

```json
{
  "type": "https://phenotype.dev/errors/validation-failed",
  "title": "Validation Failed",
  "status": 400,
  "detail": "Field 'name' must be a non-empty string",
  "instance": "/api/v1/pheno-port-adapter/connectors",
  "code": "VALIDATION_FAILED",
  "errors": [
    {"field": "name", "code": "REQUIRED", "message": "Field is required"}
  ]
}
```

### Required fields (RFC 7807 § 3.1)

| Field | Type | Required | Source |
|-------|------|:--------:|--------|
| `type` | URI string | ✅ (default `"about:blank"` if absent) | per-error class |
| `title` | string | ✅ | short human-readable summary |
| `status` | integer | ✅ | mirrors HTTP status code |
| `detail` | string | ❌ (recommended) | human-readable explanation specific to this occurrence |
| `instance` | URI string | ❌ (recommended) | request path or correlation ID |

### Phenotype extensions (RFC 7807 § 3.2 allows extension members)

| Field | Type | Purpose |
|-------|------|---------|
| `code` | SCREAMING_SNAKE_CASE | machine-readable error code (stable across versions) |
| `errors[]` | array of `{field, code, message}` | per-field validation failures (400 / 422 only) |
| `request_id` | UUID | correlates with `pheno-tracing` span |
| `trace_id` | W3C trace-context ID | correlates with OTel span |
| `documentation_url` | URL | optional pointer to runbook |

### Content-Type for errors

- Successful responses: `Content-Type: application/json; charset=utf-8`
- Error responses: `Content-Type: application/problem+json` (RFC 7807 § 3)

## Pagination

Cursor-based (NOT offset-based) for all list endpoints:

```
GET /api/v1/pheno-port-adapter/connectors?limit=50&cursor=eyJpZCI6MTIzfQ==
```

```json
{
  "data": [...],
  "page_info": {
    "next_cursor": "eyJpZCI6MTczfQ==",
    "has_more": true,
    "total_count": 1234
  }
}
```

- `limit` defaults to 50, max 500.
- `total_count` is OPTIONAL (omit for performance on large datasets).

## Filtering & sorting

```
GET /api/v1/pheno-port-adapter/connectors?filter[status]=active&filter[created_after]=2026-06-01&sort=-created_at,name
```

- `filter[<field>]=<value>` — exact match.
- `sort=<field>` ascending; `sort=-<field>` descending.
- Multi-field: comma-separated, applied left-to-right.

## Versioning

- **Major** version in URL (`/api/v1/...`).
- **Minor / patch** via headers (`X-API-Minor: 2`, `X-API-Patch: 1`).
- Backwards-incompatible changes require `/api/v2/...`.
- Deprecated versions supported for **12 months minimum**.

## Authentication

- Bearer token in `Authorization` header: `Authorization: Bearer <opaque-token>`.
- Token issued via OAuth 2.0 device-code or service-to-service mTLS.
- Per ADR-046: cross-org federation uses mTLS + OIDC.

## Rate limiting

Response headers on every request:

| Header | Meaning |
|--------|---------|
| `X-RateLimit-Limit` | max requests per window |
| `X-RateLimit-Remaining` | requests remaining |
| `X-RateLimit-Reset` | epoch seconds when limit resets |

On `429`: `Retry-After: <seconds>` (RFC 7231 § 7.1.3).

## Content negotiation

- Request: `Accept: application/json` (default).
- Request: `Accept: application/problem+json` for errors (default for ≥400).
- Response: `Content-Type: application/json; charset=utf-8`.
- Optional: `Accept-Encoding: gzip` for large responses.

## Idempotency keys (POST only)

For non-idempotent POSTs (create operations), clients SHOULD provide:

```
Idempotency-Key: <opaque-key-up-to-255-chars>
```

Server deduplicates by key within a 24-hour window.

## OpenAPI spec (L9.5)

Every Phenotype service MUST publish:

1. `/openapi.json` — OpenAPI 3.1 machine-readable spec.
2. `/docs` — Swagger UI for human readers.

The spec is the source of truth — generated from code, not hand-written.

## Curl template (for README adoption)

This is the canonical curl block that every service README MUST include. Replace the
placeholders (`<service>`, `<host>`, `<resource>`, `<id>`) with service-specific values.

### Successful read

```bash
curl -sS -X GET \
  -H "Accept: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  "https://<host>/api/v1/<service>/<resource>"
```

### Successful create

```bash
curl -sS -X POST \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"name": "my-resource", "config": {"key": "value"}}' \
  "https://<host>/api/v1/<service>/<resource>"
```

### Validation error (RFC 7807 envelope)

```bash
curl -sS -X POST \
  -H "Accept: application/problem+json" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{}' \
  "https://<host>/api/v1/<service>/<resource>"
```

Response (HTTP 400):

```json
{
  "type": "https://phenotype.dev/errors/validation-failed",
  "title": "Validation Failed",
  "status": 400,
  "detail": "Field 'name' is required",
  "instance": "/api/v1/<service>/<resource>",
  "code": "VALIDATION_FAILED",
  "errors": [
    {"field": "name", "code": "REQUIRED", "message": "Field is required"}
  ]
}
```

### Rate-limited (HTTP 429)

```bash
curl -sS -i -X GET \
  -H "Accept: application/json" \
  "https://<host>/api/v1/<service>/<resource>"
```

Response headers:

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/problem+json
Retry-After: 60
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1718947200
```

## Adoption (cycle 6 T2 — 5 README curl-block PRs)

| # | Repo | Path in this cycle | Status |
|---|------|--------------------|--------|
| 1 | `phenotype-router` | README "Quickstart" section | ✅ PR opened |
| 2 | `nanovms` (`Dmouse92/NanovmsPhenotype`) | README "Quickstart" section | ⚠️ BLOCKED — repo archived 2026-06-18 |
| 3 | `pheno-mcp-router` | README "Quickstart" section | ⚠️ BLOCKED — repo does not exist |
| 4 | `pheno-port-adapter` (local in phenotype-apps monorepo) | `pheno-port-adapter/README.md` "Quickstart" | ✅ PR opened (against phenotype-apps) |
| 5 | `Civis` | README "Quickstart" section | ✅ PR opened |

Net: 4 of 5 PRs opened in cycle 6 T2. Blockers documented in
`findings/2026-06-21-v16-T2-blocked-repos.md`.

## Acceptance criteria

- [x] Convention doc ratified (this file).
- [ ] 4 of 5 README curl blocks merged (1 blocked: nanovms archived; 1 blocked: pheno-mcp-router not created).
- [ ] `pheno-api-lint` workflow runs on each PR (cycle 7).
- [ ] Fleet mean L9 score ≥ 2.0 in cycle 6 audit.

## References

- RFC 7807 — Problem Details for HTTP APIs (the canonical error envelope).
- RFC 7231 — HTTP/1.1 Semantics and Content.
- RFC 6902 — JavaScript Object Notation (JSON) Patch.
- ADR-024 — 71-pillar framework (L9 = API Design Conventions).
- ADR-046 — Federation mTLS + OIDC.
- `findings/2026-06-21-v16-L9-api-conventions.md` — strategic L9 closure finding.
- `findings/71-pillar-2026-06-17-schema.md` § L9 rubric — scoring criteria (0-3 scale).
