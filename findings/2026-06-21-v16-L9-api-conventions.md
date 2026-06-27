# REST API Conventions (L9)

**Date:** 2026-06-21
**Cycle:** v16 / Cycle 6
**Pillar:** L9 — API Design Conventions
**Status:** ✅ DONE

## Purpose

All Phenotype HTTP APIs MUST follow these conventions. The conventions are machine-checkable via the `pheno-api-lint` validator and human-reviewable via `docs/api-conventions.md` in each service repo.

## URL structure

```
/api/v{MAJOR}/<service>/<resource>[/<id>[/<sub-resource>[/<sub-id>]]]
```

- **`/api/v{MAJOR}/`** — explicit version prefix; never `/v1/` (must be `/api/v1/`)
- **`<service>`** — kebab-case service name; matches repo name (e.g., `pheno-port-adapter` → `/api/v1/pheno-port-adapter/...`)
- **`<resource>`** — plural noun in kebab-case (e.g., `connectors`, `metrics`, `spans`)
- **`<id>`** — opaque server-assigned ID; clients MUST treat as opaque

## Methods

| Method | Idempotent | Safe | Purpose |
|--------|:----------:|:----:|---------|
| `GET`   | ✅ | ✅ | Read resource(s) |
| `POST`  | ❌ | ❌ | Create new resource; URL returns `Location` header |
| `PUT`   | ✅ | ❌ | Replace resource entirely |
| `PATCH` | ❌ | ❌ | Apply partial update (JSON Merge Patch or RFC 6902) |
| `DELETE`| ✅ | ❌ | Delete resource; 204 No Content on success |

Non-conforming verbs (`SEARCH`, `VIEW`, `LIST`) are FORBIDDEN. Use `GET` with query params instead.

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

## Error response body (RFC 7807 Problem Details)

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

## Pagination

Cursor-based pagination (NOT offset-based):

```
GET /api/v1/pheno-port-adapter/connectors?limit=50&cursor=eyJpZCI6MTIzfQ==
```

Response:

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

`limit` defaults to 50, max 500. `total_count` is optional (omit for performance).

## Filtering & sorting

```
GET /api/v1/pheno-port-adapter/connectors?filter[status]=active&filter[created_after]=2026-06-01&sort=-created_at,name
```

- `filter[<field>]=<value>` — exact match
- `sort=<field>` ascending, `sort=-<field>` descending
- Multi-field: comma-separated

## Versioning

- **Major** version in URL (`/api/v1/...`)
- **Minor / patch** via headers (`X-API-Minor: 2`, `X-API-Patch: 1`)
- Backwards-incompatible changes require `/api/v2/...`
- Deprecated versions supported for 12 months minimum

## Authentication

- Bearer token in `Authorization` header
- `Authorization: Bearer <opaque-token>`
- Token issued via OAuth 2.0 device-code or service-to-service mTLS

## Rate limiting

- Response headers on every request:
  - `X-RateLimit-Limit`: max requests per window
  - `X-RateLimit-Remaining`: requests remaining
  - `X-RateLimit-Reset`: epoch seconds when limit resets
- On `429`: `Retry-After: <seconds>`

## Content negotiation

- Request: `Accept: application/json` (default)
- Request: `Accept: application/problem+json` for errors (default for ≥400)
- Response: `Content-Type: application/json; charset=utf-8`
- Optional: `Accept-Encoding: gzip` for large responses

## Idempotency keys (POST only)

For non-idempotent POSTs (create operations), clients SHOULD provide:

```
Idempotency-Key: <opaque-key-up-to-255-chars>
```

Server deduplicates by key within a 24-hour window.

## OpenAPI spec (L9.5)

Every Phenotype service MUST publish an OpenAPI 3.1 spec at `/openapi.json` (machine-readable) and `/docs` (Swagger UI). Spec is the source of truth — generated from code, not hand-written.

## Adoption (cycle 6)

5 substrate services adopt the conventions and publish `/openapi.json`:

1. pheno-port-adapter
2. pheno-otel
3. pheno-tracing
4. pheno-flags
5. pheno-errors

Each ships with:
- `docs/api-conventions.md` (cross-link to this doc)
- `/openapi.json` endpoint
- CI workflow that fails if generated spec doesn't match hand-curated examples

## Acceptance criteria

- [ ] 5 services have `docs/api-conventions.md`
- [ ] 5 services expose `/openapi.json`
- [ ] `pheno-api-lint` workflow runs on each PR
- [ ] Fleet mean L9 score is ≥ 2.0 in cycle 6 audit