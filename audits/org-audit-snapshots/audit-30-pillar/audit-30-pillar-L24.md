# L24 — Multi-tenant isolation & data privacy

**Owner:** forge-A13 (tick28-holistic-audit)
**Date:** 2026-06-16
**Bloc:** AgilePlus (45+) + thegent (25+) + Tracely (5) + Tracera (1) + helios-* + PhenoContracts

## Scope
Multi-tenant data isolation, PII handling, and tenant-scoped controls across the bloc. Where the bloc is single-tenant, the equivalent boundary (per-claim / per-project / per-worktree) is evaluated instead.

## SOTA 2026
- **Auth0 / WorkOS / Clerk / Stytch** — tenant_id as first-class column, row-level security, per-tenant JWT claims, tenant-scoped API keys
- **Neon / PlanetScale / Supabase** — Postgres RLS policies, branching per-tenant, encrypted-at-rest with per-tenant DEKs
- **GDPR/CCPA tooling** — `delete_user` pipelines, audit log of access, PII redaction in logs, DPA tooling (e.g. Fides, OpenLineage + PII tags)
- **Vault / AWS KMS / GCP KMS** — envelope encryption with per-tenant DEKs, BYOK support
- **Ref:** repos/AUDIT_BLOC_VS_2026_SOTA.md §0.1 (claim & graph primitives) and §1.2 (gastown multi-agent shape)

## Phenotype state

### Tenant isolation boundaries
- `AgilePlus/crates/agileplus-triage/src/claim.rs:40-49` — `ClaimKind` enum (`Repo`, `Branch`, `Worktree`, **`Subproject`**) — `Subproject` is the closest tenant-equivalent scope — **△** (claim-scoped, not org/workspace-scoped)
- `AgilePlus/crates/agileplus-graph/src/types.rs:4-10` — `NodeType::Project` provides a project boundary node, but no row-level enforcement at the storage layer — **△**
- `AgilePlus/crates/agileplus-git/src/claim_bound.rs:124-138` — `ClaimBoundWorktree::validate` rejects non-`Worktree` kind or non-`Active` state — **✓** (claim-level gate)
- `AgilePlus/crates/agileplus-mcp-intent/src/types.rs:1-384` — MCP tool surface (30+ tools) — no per-caller/tenant ACL on tools beyond GitHub token scope — **△**
- **No `tenant_id` / `workspace_id` / `org_id` columns or types anywhere in the bloc** (grep across all *.rs in AgilePlus/thegent/Tracely/Tracera/helios-*/PhenoContracts returns zero hits) — **✗**

### Per-tenant data partitioning
- `AgilePlus/crates/agileplus-triage/src/claim_store_sqlite.rs` — SQLite claim store is single-DB, no per-claim sharding — **△**
- `AgilePlus/crates/agileplus-plane/src/` (2613 lines, sync engine) — sync queue is global, not tenant-partitioned — **△**
- The bloc is a **single-tenant developer tool** (CLI runs in one user's shell against one or more local repos). Multi-tenant data partitioning is not a current requirement — **N/A by design**

### GDPR / CCPA right to delete
- **No `delete_user` / `right_to_be_forgotten` / `gdpr` / `ccpa` code anywhere in the bloc** (grep returns zero hits in source) — **✗**
- `AgilePlus/crates/agileplus-cache/src/` has TTL-based expiry (Redis) but no user-driven purge API — **△**
- The bloc does not collect user PII (it orchestrates git/CI work, not end-user accounts), so right-to-delete is mostly a non-applicable control — **N/A**, but worth documenting for hosted/SaaS mode

### PII handling (encryption at rest / in transit)
- `thegent/crates/thegent-crypto/src/lib.rs` — exists; SOTA doc §0.2 lists it as "ECIES / AES-GCM / ed25519" — used for **agent identity & inter-agent message crypto**, not for PII-at-rest — **△**
- `thegent/crates/thegent-zmx/`, `thegent-zmx-interop` — ZMQ-style shared-memory IPC; transport-level encryption not surfaced in the readme — **△**
- No `pii_redact` / `redact_pii` / `kms_envelope` / `pii_tag` in any crate (grep returns zero hits) — **✗** for hosted PII
- TLS termination is delegated to the runtime (axum, hyper) — no app-level cert pinning or mTLS — **△**

### Tenant quotas
- **No per-tenant / per-user quotas anywhere** — only per-action token-bucket limits in `agileplus-governance/src/rate_limiter.rs:11-26` keyed by `(user_id?, client_ip?, action)` — **△** (rate-limited, not quota'd)
- No seat limits, no storage caps, no API-call caps per actor — **✗**

## Gaps
1. **`AgilePlus/crates/` — no tenant identity type** — there's no `TenantId` / `WorkspaceId` newtype or middleware. Bloc is implicitly single-tenant; if a hosted mode ships, this becomes the first gap — effort: **L**
2. **`AgilePlus/crates/agileplus-triage/src/claim_store_sqlite.rs` — no PII purge API** — claim store retains data indefinitely; need a `purge_actor(actor_id)` and `purge_subproject(sub_id)` — effort: **M**
3. **Whole bloc — no GDPR/CCPA `delete_user` pipeline** — needed only if hosted; for a CLI tool, document the absence explicitly in `docs/governance/data_handling.md` — effort: **S** (doc) or **L** (impl)
4. **`thegent/crates/thegent-crypto/src/` — no PII envelope encryption** — crypto exists but is for agent identity, not user data. Add `encrypt_pii(tenant_key, plaintext)` helper if hosted — effort: **M**
5. **`AgilePlus/crates/agileplus-governance/src/rate_limiter.rs:11-26` — no quota dimension** — only time-windowed rate limits; add `Quota{actor, dim, cap, period}` to support storage/seat/call caps — effort: **M**

## Recommendations
1. **Document the single-tenant model** in a new `docs/governance/multi_tenant_model.md` — explicitly state that the bloc is a single-user CLI tool, what data is stored, and what the deletion story is. Effort: **S**.
2. **Add `WorkspaceId` newtype** in `agileplus-domain/src/ports.rs` even if unused today — keeps the door open for hosted mode without a big refactor. Effort: **S**.
3. **Add `purge_*` methods to `ClaimStoreTrait`** (`agileplus-triage/src/claim_store_sqlite.rs`) for `purge_actor`, `purge_subproject`, `purge_all_for_repo`. Effort: **M**.
4. **Add per-actor quota tracking** alongside the rate limiter in `agileplus-governance/src/rate_limiter.rs` (storage bytes, request count, LLM tokens). Effort: **M**.
5. **PII redaction in logs** — add a `redact(value: &str) -> Cow<str>` helper in `agileplus-telemetry/` and wire into the OTel layer's `tracing-subscriber` filter. Effort: **S**.

## Status
| Sub-criterion | Status | Reason |
|---|---|---|
| Tenant isolation boundaries | △ | `Subproject` claim kind + `Project` node are equivalent; no `TenantId` |
| Per-tenant data partitioning | N/A | Single-tenant by design (CLI tool) |
| GDPR/CCPA right to delete | ✗ | No `delete_user`/purge code; absent by design but undocumented |
| PII handling | △ | `thegent-crypto` exists for agent identity; no PII envelope crypto |
| Tenant quotas | △ | Rate limit exists; no storage/seat/call caps |

**Overall:** △ (partial — claim/project scoping works for current model; gaps are deferred until hosted/SaaS mode is in scope).
