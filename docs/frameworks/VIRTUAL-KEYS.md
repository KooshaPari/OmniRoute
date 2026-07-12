---
title: "Virtual Keys & Cost Tracking"
version: 3.8.6
lastUpdated: 2026-06-18
---

# Virtual Keys & Cost Tracking

> **Source of truth:** `src/lib/db/virtualKeys.ts`, `src/lib/db/costTracking.ts`, `src/lib/a2a/skills/mintVirtualKey.ts`
> **Last updated:** 2026-06-18 — v3.8.6 (B5 of v8.1 Bifrost track, ADR-031)

A **virtual key** is a per-tenant scoped credential that OmniRoute mints, hands to the user, and resolves to a real upstream key at request time. The raw key is shown exactly once on creation; from that point on the server only retains a sha256 hex digest of the raw value, and every state-mutating path runs as a single SQL `UPDATE` with the cap baked into the `WHERE` clause.

This document covers activation, lifecycle, cost-event ingestion, dashboard usage, and the security model. For the broader Bifrost Tier-1 router rollout, see [`docs/adr/0031-bifrost-tier1-router.md`](#) and `PLAN.md` § 2.5.2.

---

## Activation

Virtual keys are enabled automatically on first start. The two new migrations run in order:

- `102_virtual_keys.sql` — creates `virtual_keys` and its three indexes
- `103_cost_events.sql` — creates the `cost_events` append-only ledger

The migration runner is the existing one in `src/lib/db/migrationRunner.ts`; no new env vars are required. To verify a fresh deployment:

```bash
sqlite3 "$DATA_DIR/storage.sqlite" "SELECT version, name FROM _omniroute_migrations WHERE version IN ('102','103');"
```

Both rows should be present. If a deployment has been running an older build and the new columns / tables are already present, the migration runner is idempotent (it checks `sqlite_master` before applying).

---

## Lifecycle

```
   mint                    consume / resolve
 ┌────────┐  POST /api/virtual-keys   ┌────────────────────────┐
 │  user  │ ────────────────────────▶ │  virtual_keys row      │
 └────────┘                           │  (rawKey shown ONCE)   │
      ▲                               │                        │
      │ rawKey                         │  id, hashed_key,       │
      │ (copy now)                     │  max_cost_usd, max_rpd,│
      │                                │  current_cost_usd,     │
      │                                │  current_rpd,          │
      │                                │  expires_at,           │
      │                                │  revoked_at            │
      │                                └────────────────────────┘
      │                                          │
      │  DELETE /api/virtual-keys/:id            │  recordVirtualKeyUsage
      │ ─────────────────────────────────────────▶  (atomic budget debit)
      │  +1 cost_event row in cost_events         │  + cost_events row
      ▼                                          ▼
  revoked                                    ledger grows
```

### States

| State             | `revoked_at` | `expires_at` | What happens on resolve / recordUsage |
| :---------------- | :----------- | :----------- | :-------------------------------------- |
| **active**        | `NULL`       | future / `NULL` | counter bumps, request allowed        |
| **expired**       | `NULL`       | past         | `resolveVirtualKey` returns `null`     |
| **at-cap**        | `NULL`       | future / `NULL` | next `recordUsage` returns `over_budget` / `over_rpd` |
| **revoked**       | set          | any          | `resolve` and `recordUsage` both reject |

### Idempotency

- `revokeVirtualKey(id)` returns `true` on the active → revoked transition and `false` on every subsequent call. There is no "un-revoke" path.
- `mintVirtualKey` always returns a fresh row. Two mints in the same millisecond produce different raw keys (32 bytes of `crypto.randomBytes` is enough entropy for the lifetime of a deployment).

---

## Cost-event Ingestion

Every successful `recordVirtualKeyUsage` writes one `cost_events` row with the same provider / model / token / cost fields. The write is best-effort — a failure is logged but does not roll back the budget counters, since the request was already allowed.

If you need to backfill from upstream receipts, use `recordCostEvent` directly:

```ts
import { recordCostEvent } from "@/lib/db/costTracking";

recordCostEvent({
  virtualKeyId: "vkey-...",
  tenantId: "tenant_...",
  provider: "openai",
  model: "gpt-4o",
  promptTokens: 1234,
  completionTokens: 567,
  costUsd: 0.042,
  occurredAt: new Date().toISOString(), // optional, defaults to now
});
```

### Retention

The `cost_events` table is append-only. There is no automatic prune; operators are expected to drop or archive rows older than their retention window. A simple example:

```sql
DELETE FROM cost_events WHERE occurred_at < datetime('now', '-180 days');
```

Tune the threshold to your reporting window. The dashboard defaults to a 30-day view; longer windows just need the index (`idx_cost_events_occurred_at`) which is already in place.

---

## Dashboard Usage

The operator UI lives at `http://localhost:20128/dashboard/keys` (or your configured host). It uses three REST endpoints:

| Verb + path                          | Purpose                                          |
| :----------------------------------- | :----------------------------------------------- |
| `POST /api/virtual-keys`             | Mint a key (returns `rawKey` ONCE)               |
| `GET  /api/virtual-keys?tenantId=…`  | List keys for a tenant                           |
| `DELETE /api/virtual-keys/:id`       | Revoke a key                                     |
| `GET  /api/virtual-keys/:id/cost`    | Cost summary for a single key (last 30 days)     |

The cost summary response includes `byDay`, `byProvider`, `byModel` series. The dashboard attaches them to a `data-cost-by-day` attribute on the chart placeholder so a follow-up chart-library PR can render without re-fetching.

All routes use the existing `requireManagementAuth` middleware — the same gate as the legacy `/api/keys` CRUD.

### A2A

Equivalent capability is exposed via the `mint-virtual-key` A2A skill (gated by the `keys:write` scope). The skill is registered in `A2A_SKILL_HANDLERS` under that name; call it via JSON-RPC at `POST /a2a` with `skill: "mint-virtual-key"`.

---

## Security Model

> **One line:** The raw key is a 32-byte random hex string shown exactly once on mint and stored as a sha256 hex digest thereafter; every state-mutating path is a single SQL `UPDATE` whose `WHERE` clause enforces the cap atomically.

### Key generation

- 32 bytes from `crypto.randomBytes` (Node built-in, no extra deps).
- Encoded as lowercase hex and prefixed with `vk_` for log/UI identification.
- The first 8 characters (`vk_xxxx`) are stored as `key_prefix` so operators can identify a key without exposing the secret.

### Storage

- `hashed_key` is `sha256(rawKey)` in lowercase hex (64 chars).
- `UNIQUE` constraint on `hashed_key` — even if two mints collide on the 64-bit prefix, the digest collision space (2²⁵⁶) is unreachable in practice.
- `rawKey` is **never** persisted. It is returned only in the `POST /api/virtual-keys` response and the `mint-virtual-key` A2A artifact, and the caller is responsible for surfacing it to the user.

### Resolve path

`resolveVirtualKey(rawKey)` hashes the argument and looks up the row by digest. If the row is missing, revoked, or expired, the function returns `null` and the request is treated as unauthenticated. As a best-effort side-effect, `last_used_at` is bumped on success — this is informational, not a security primitive.

### Atomic budget enforcement

```sql
UPDATE virtual_keys
   SET current_cost_usd = current_cost_usd + ?,
       current_rpd      = CASE WHEN last_reset_day = ? THEN current_rpd + 1 ELSE 1 END,
       last_used_at     = ?,
       last_reset_day   = ?
 WHERE id = ?
   AND revoked_at IS NULL
   AND (max_cost_usd IS NULL OR current_cost_usd + ? <= max_cost_usd)
   AND (max_rpd      IS NULL OR last_reset_day <> ? OR current_rpd + 1 <= max_rpd)
```

The cap is in the `WHERE` clause, not in application code. SQLite serialises writes; the loser of a concurrent debit sees `changes() === 0` and is mapped to `over_budget` or `over_rpd` by the caller. There is no read-then-write window.

### What an attacker can and cannot do

| Threat                                                | Mitigation                                         |
| :---------------------------------------------------- | :------------------------------------------------- |
| Steal raw key from another tenant's `listVirtualKeysForTenant` | `list*` returns the metadata row only; `hashed_key` is never sent (the `/cost` route does not need it). |
| Replay a raw key after revocation                     | `resolveVirtualKey` filters `revoked_at IS NULL`; revoked rows hash-lookup fails. |
| Replay a raw key after expiry                         | `resolveVirtualKey` filters `(expires_at IS NULL OR expires_at > now)`. |
| Race the budget cap                                   | Single-statement `UPDATE` with the cap in the `WHERE` clause; SQLite serialisation enforces ordering. |
| Recover the raw key from a database dump              | The stored value is `sha256(rawKey)`; pre-image resistance + the rawKey entropy (2²⁵⁶) make brute force infeasible. |

### Out of scope (for B5)

- Rate limiting per IP / per session — handled at the edge / proxy layer.
- Per-model `allowedModels` enforcement at request time — the field is stored and surfaced in the dashboard, but the request-pipeline integration is a follow-up. The `BifrostBackend` executor (PR #72) is the integration point.
- Webhook on revocation — a follow-up PR can subscribe to the row state change in the existing `audit_log`.

---

## Cross-references

- ADR-031 § 1.3 — virtual keys
- ADR-031 § 2.3 — atomic guards
- ADR-031 § 4 — cost tracking
- `PLAN.md` § 2.5.2 — B5 description
- `src/lib/a2a/skills/mintVirtualKey.ts` — A2A skill
- `src/lib/db/virtualKeys.ts` — DB module
- `src/lib/db/costTracking.ts` — ledger
- `src/app/api/virtual-keys/route.ts` — REST surface
- `src/app/(dashboard)/dashboard/keys/page.tsx` — operator UI
