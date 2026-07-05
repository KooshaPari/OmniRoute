# Byteport Surface Map — 15 capabilities

**Date:** 2026-07-05 08:20Z | **Source:** Byteport/ARCHITECTURE.md + byteport-* crates + backend/

## Coverage legend
- **none** — not in Byteport today
- **partial** — exists, narrow scope
- **full** — production-grade, multi-tenant, audited

## The 15 capabilities

### 1. Compute (managed MicroVMs)
- **Current:** nanovms MicroVM runtime, single-region, manual scale (byteport-dag + byteport-engine)
- **Target:** full (multi-region, autoscaling, cold-start, right-sizing)
- **Gap:** no multi-region; no autoscaler; no spot/spot-fallback
- **Phase:** P2.5

### 2. Compute (serverless)
- **Current:** none
- **Target:** full (Wasm runtime, request-scoped, sub-10ms cold start)
- **Gap:** no byteport-engine Wasm backend; only the abstraction exists
- **Phase:** P2.1

### 3. Storage (object)
- **Current:** partial (S3 via AWS SDK in backend/handlers.go)
- **Target:** full (S3, R2, GCS, MinIO, local FS; one adapter interface)
- **Gap:** no adapter abstraction; Cloudflare R2 missing
- **Phase:** P2.5

### 4. Storage (kv/blob)
- **Current:** partial (sqlite + map; no Redis-compatible layer)
- **Target:** full (kv via sqlite + Redis; blob via object store)
- **Gap:** no Redis backend; no TTL primitive
- **Phase:** P3 (P3.3 webhooks need kv)

### 5. Networking (HTTP route)
- **Current:** full (bytebridge + odin.nvms manifest; routes per service)
- **Target:** full (already there)
- **Gap:** no edge proxy; no rate-limit middleware (planned in AuthKit AUT-SOTA-007)
- **Phase:** P1.4 (AuthKit integration) + P2.5 (edge)

### 6. Networking (TLS/cert)
- **Current:** none (self-signed local dev only)
- **Target:** full (ACME/Caddy/lego; per-host cert; auto-renew)
- **Gap:** the entire TLS automation story
- **Phase:** P2.6

### 7. IAM
- **Current:** partial (WorkOS only, in backend/go.mod)
- **Target:** full (AuthKit primary, WorkOS fallback for enterprise SSO/SAML/SCIM)
- **Gap:** AuthKit not wired; multi-tenant org/role/policy model not in handlers
- **Phase:** P1.4

### 8. Secrets
- **Current:** full (Vault + AWS Secrets Manager via backend/handlers.go)
- **Target:** full (already there)
- **Gap:** no automatic rotation; no DPoP (AuthKit AUT-SOTA-002/005)
- **Phase:** P3 (with AuthKit cross-pollination)

### 9. Queue
- **Current:** none
- **Target:** full (event bus + work queue, Eventra absorption)
- **Gap:** no eventing at all
- **Phase:** P2.2

### 10. RAG / vector
- **Current:** none
- **Target:** partial (sqlite-vec + llama.cpp backend, optional)
- **Gap:** no vector store; no embedding service integration
- **Phase:** P4.2

### 11. Observability
- **Current:** partial (byteport-otel crate; OTel SDK)
- **Target:** full (collector + Tempo + Loki; traces/metrics/logs)
- **Gap:** no collector deploy; no Tempo/Loki; no log aggregation
- **Phase:** P1.5

### 12. Billing
- **Current:** none
- **Target:** full (usage_history per org; per-resource meter; cost dashboards)
- **Gap:** no metering; no cost ledger; no Stripe integration
- **Phase:** P3.4

### 13. Audit
- **Current:** none (besides what byteport-otel emits)
- **Target:** full (signed event log via phenotype-org-audits)
- **Gap:** no audit log; no signed events
- **Phase:** P3.5

### 14. Edge
- **Current:** none
- **Target:** partial (Vercel-equivalent: Rust+Wasm at the edge; CF Workers analog)
- **Gap:** entire edge runtime missing
- **Phase:** P4.1

### 15. DX (CLI + SDK + MCP + Webhooks)
- **Current:** partial (byteport-cli only; Go SDK via internal; no MCP; no webhooks)
- **Target:** full (CLI + Rust SDK + Go SDK + Python SDK + MCP server + webhooks)
- **Gap:** Rust SDK; MCP; webhooks; Python SDK
- **Phase:** P3.1-P3.3

## Summary

| Coverage | Capabilities |
|----------|--------------|
| full today      | 1 (none, actually), 5, 8 |
| partial today   | 3, 4, 7, 11, 15 |
| none today      | 2, 6, 9, 10, 12, 13, 14 |

**Total: 0 full / 5 partial / 10 none today. The "owned Surface 100%" target = 15 full.**
