# Tier 3.8 — PhenoCompose Multi-Tenant Compose

**Target**: `PhenoCompose/` (existing Rust workspace)  
**Depends**: BytePort Phase 3 RBAC (`backend/internal/infrastructure/http/middleware/rbac.go`)

## Gap

PhenoCompose has a single `docker-compose.yml`-like manifest system but no multi-tenant isolation. Every deployment shares the same Compose namespace.

## Design

```
┌──────────────────────┐     ┌─────────────────────┐
│  BytePort RBAC       │────→│  PhenoCompose        │
│  RequireOrgRole()    │     │  /orgs/{org_id}/deploy│
└──────────────────────┘     └─────────┬───────────┘
                                       │
              ┌────────────────────────┼─────────────────┐
              │ org=acme                │ org=bigcorp      │
              ▼                         ▼                  ▼
    /var/lib/byteport/orgs/acme/   /var/lib/byteport/orgs/bigcorp/
    ├── compose.yaml               ├── compose.yaml
    ├── .env                       ├── .env
    ├── networks/                  ├── networks/
    └── volumes/                   └── volumes/
```

## Implementation plan

### Phase 1 — Org-scoped directory (1 session)

1. PhenoCompose reads `BYTEPORT_ORG_ID` env var  
2. `BYTEPORT_DATA_DIR/orgs/{org_id}/` is the working directory for Docker Compose  
3. Each org gets its own `compose.yaml`, `.env`, isolated Docker networks

### Phase 2 — RBAC gating (1 session)

1. BytePort `deploy` endpoint calls PhenoCompose with the org-scoped path  
2. RBAC middleware asserts the caller is `RoleOwner|RoleAdmin` of that org  
3. `nvms deploy` and `byteport deploy` both respect the org boundary

### Phase 3 — Resource quotas (2 sessions)

1. SQLite-backed org quota table: max containers, max RAM, max storage  
2. PhenoCompose checks quota before accepting a deployment  
3. BytePort dashboard shows per-org utilization (planned, not built)

## Files to modify

```bash
PhenoCompose/src/
├── compose.rs          # Read BYTEPORT_ORG_ID, use org-scoped working directory
├── deploy.rs           # Accept org_id as parameter
└── quarantine.rs       # Quota enforcement (Phase 3)
```

## Acceptance criteria

1. `BYTEPORT_ORG_ID=acme byteport deploy` creates `compose.acme.yaml`  
2. `BYTEPORT_ORG_ID=bigcorp byteport deploy` creates `compose.bigcorp.yaml` — isolated  
3. RBAC middleware rejects cross-org requests (UserA cannot deploy to UserB's org)  
4. Quota enforcement: 10-container limit per org in Free tier  
5. All existing PhenoCompose tests continue to pass (no regression)
