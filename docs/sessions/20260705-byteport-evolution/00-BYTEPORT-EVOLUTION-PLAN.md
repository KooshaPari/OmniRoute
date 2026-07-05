# Byteport Evolution Plan — Surface 100%

**Author:** root (parent agent, subagent slot exhausted mid-dispatch)
**Date:** 2026-07-05 08:20Z
**Scope:** the ABSORPTIONS path only. The user does NOT own Byteport itself.
**Status:** plan locked, awaiting sponsor go/no-go

## Top bracket

```
[byteport: 8 rust crates + go backend + sveltekit + 5 packaging targets
 | current = IaC + portfolio UX
 | target  = surface 100% (aws/gcp/vercel/supabase composite)
 | below   = pheno-compose (orchestration) + nanovms (vm) + hexakit (primitives)
 | abs path = 6 phases / 2026 Q3-Q4
 | phase 0 = decide "surface only" vs "surface + identity" (sponsor D5: BOTH after abs done)
 | anti-big-cloud = no lock-in, all OSS, poly-host, self-hostable
 | web research = coolify/dokku/cloudflare/vercel/sst/modal patterns cited]
```

## 1. What Byteport becomes (north star)

Byteport stops being "deploy my project and make a portfolio page". It becomes
the user's **owned Surface 100%** — a single composite of the capabilities that
AWS, GCP, Vercel, Supabase, Cloudflare, and Render each provide a slice of. The
end state: a developer writes one declarative manifest, gets:

- **Compute** (managed MicroVMs via nanovms; cold-start, autoscaling, multi-region)
- **Storage** (object store, kv, blob, sqlite/postgres, vector, RAG)
- **Networking** (HTTP routes, custom domains, TLS, edge functions, WAF)
- **IAM** (AuthKit integration; orgs, users, roles, policies, audit)
- **Secrets** (Vault + KMS-backed envelope encryption; rotation)
- **Queue** (event bus via Eventra, work queue via pheno-dag)
- **Observability** (OTel-native; byteport-otel crate, traces, metrics, logs)
- **Billing** (per-org metering; cost dashboards; usage_history like OmniRoute)
- **Audit** (signed event log; compliance-ready)
- **Edge** (Cloudflare-style CDN + Workers-equivalent in Rust)
- **DX** (CLI + dashboard + SDK + Webhooks + MCP server)

The polyrepo layout below:

```
                Byteport (surface, multi-tenant, public-facing)
                /         |            |              \
          PhenoCompose  nanovms   HexaKit        Eidolon
          (orchestration) (vm)    (primitives)   (spec/test/trace)
              \___________|___________|___________/
                         phenotype-org-audits (audit/inventory spine)
```

## 2. Surface map (10 capabilities, current vs target)

| # | Capability              | Current Byteport | Target  | Absorption path                              |
|---|-------------------------|------------------|---------|----------------------------------------------|
| 1 | Compute (VM)            | nanovms MicroVM  | full    | already there; expose API + multi-region     |
| 2 | Compute (serverless)    | none             | full    | byteport-engine + edge runtime (Rust Wasm)   |
| 3 | Storage (object)        | S3 via AWS SDK   | full    | already there; add R2/Cloudflare adapter     |
| 4 | Storage (kv/blob)       | sqlite + KV      | full    | already there; add Cloudflare KV adapter     |
| 5 | Networking (HTTP route) | bytebridge + odin.nvms | full | already there; add edge proxy               |
| 6 | Networking (TLS/cert)   | none (self-signed local) | full | Caddy/ACME integration, lego crate        |
| 7 | IAM                     | WorkOS only      | full    | AuthKit primary, WorkOS fallback for SSO/SAML |
| 8 | Secrets                 | Vault + AWS SM   | full    | already there; add rotation + DPoP          |
| 9 | Queue                   | none             | full    | Eventra (CQRS/event bus) absorbed into byteport-queue crate |
|10 | RAG / vector            | none             | partial | sqlite-vec + llama.cpp backend, optional    |
|11 | Observability           | byteport-otel    | full    | already there; add OTel collector + Tempo    |
|12 | Billing                 | none             | full    | usage_history like OmniRoute; per-org ledger |
|13 | Audit                   | none             | full    | phenotype-org-audits integration             |
|14 | Edge                    | none             | partial | Vercel-equivalent: Rust+Wasm runtime at edge |
|15 | DX (CLI+SDK+MCP)        | byteport-cli, Go SDK | full | add Rust SDK (omni-sdk pattern), MCP server (rmcp) |

## 3. Below-Byteport absorptions (the user's lane)

| Source repo (top-level)        | Absorb into                       | Phase | Reason                                    |
|--------------------------------|-----------------------------------|-------|-------------------------------------------|
| PhenoCompose/                  | byteport-orchestration crate      | P1    | docker-compose/k8s replacement; orchestr. |
| nanovms/                       | stays as-is (already integrated)  | -     | MicroVM runtime is the substrate          |
| HexaKit/                       | absorbed into byteport-primitives | P1    | reusable infra primitives                 |
| pheno-cdylib-bridge/           | absorbed into byteport-ffi crate  | P1    | Rust-to-Go FFI bridge                     |
| pheno-drift-detector/          | byteport-drift crate              | P2    | substrate drift detection                 |
| helios-cli/ (4196 commits)     | byteport-cli (consolidation)      | P2    | CLI surface; absorb if not duplicate      |
| KWatch/                        | byteport-security-audit crate     | P2    | security monitoring                       |
| Eidolon/                       | stays (spec/test/trace layer)     | -     | below surface; not absorbed               |
| Eventra/                       | byteport-queue crate              | P3    | event bus + CQRS                          |
| Apisync/                       | stays separate (Apisync is its own)| -    | parallel API toolkit, not absorbed        |
| Configra/ Conft/ DataKit/      | stay separate                     | -     | config, secret-mgmt                       |
| KodeVibe/                      | deprecate                         | P3    | "genesis docs scaffold"; not load-bearing |
| Httpora/                       | DELETE (already deprecated)       | P0    | per apikit-httpora-final/README           |
| apikit-httpora-final/          | byteport-http (low priority)      | P4    | HTTP toolkit, nice-to-have                |
| KDesktopVirt/ KMobile/ KlipDot/| stay separate                     | -     | desktop/mobile device farms               |
| KaskMan/                       | DELETE (strict-pause banner)      | P0    | per portfolio strategy D4                 |
| AtomsBot/                      | DELETE (strict-pause banner)      | P0    | per portfolio strategy D4                 |
| GDK/                           | DELETE (already archived)         | P0    | per portfolio strategy D4                 |

## 4. Hardening (mandatory before P3)

1. **Auth**: integrate AuthKit as primary; WorkOS as fallback for SSO/SAML/SCIM
2. **Multi-tenant**: every surface object is org-scoped; tenant_id in every row
3. **Audit**: every API call goes through phenotype-org-audits; signed event log
4. **Secrets**: Vault + AWS KMS; automatic rotation; DPoP tokens (AUT-SOTA-002/005)
5. **Observability**: OTel-native; byteport-otel already there; add collector deploy
6. **Rate limit**: AUT-SOTA-007 (planned in AuthKit); per-tenant + per-key
7. **MCP server**: rmcp-based; mirrors CLI; for AI agents to manage Byteport

## 5. Anti-BigCloud stance (deliberate non-goals)

- NO proprietary lock-in (every adapter is OSS, swappable, in the byteport-adapters crate)
- NO "AI-DD" magic (we document everything; the user is the human operator)
- NO vendor-specific features (no Cloudflare-only, no AWS-only paths in core)
- NO closed APIs (every endpoint has an OSS reference client; SDK is dual-licensed Apache-2.0)
- NO "free tier" complexity (one billable unit = compute-second + GB-second + request)
- NO per-tenant dashboards-as-a-service (we ship the dashboard, you self-host it)

## 6. Roadmap (4 phases, 2026 Q3-Q4)

### Phase 0 — decision (now, sponsor go/no-go)
- D5: "Surface only" vs "Surface + identity" — user said BOTH after absorptions done
- This plan: BOTH; identity is AuthKit integration, surface is everything else

### Phase 1 — foundations (2026 Q3, ~8 weeks)
- P1.1 absorb PhenoCompose → byteport-orchestration
- P1.2 absorb HexaKit → byteport-primitives (error/policy/telemetry/health)
- P1.3 absorb pheno-cdylib-bridge → byteport-ffi
- P1.4 wire AuthKit into bytebridge handlers
- P1.5 add OTel collector deploy + Tempo backend
- Deliverable: byteport-1.0 with 8 absorbed crates; AuthKit SSO works

### Phase 2 — surface expansion (2026 Q3-Q4, ~6 weeks)
- P2.1 add byteport-engine (Wasm serverless runtime)
- P2.2 add byteport-queue (Eventra absorption)
- P2.3 add byteport-drift (pheno-drift-detector)
- P2.4 add byteport-security-audit (KWatch absorption)
- P2.5 Cloudflare R2 + KV adapters
- P2.6 Caddy/ACME for TLS
- Deliverable: 12-capability surface; deploy anything, anywhere

### Phase 3 — DX + monetization (2026 Q4, ~6 weeks)
- P3.1 Rust SDK (mirror omni-sdk pattern)
- P3.2 MCP server (rmcp-based)
- P3.3 Webhooks + event subscriptions
- P3.4 usage_history + per-org billing ledger
- P3.5 audit/event-log integration with phenotype-org-audits
- Deliverable: third parties can build on Byteport; it's a real platform

### Phase 4 — edge + RAG (2027 Q1, ongoing)
- P4.1 edge runtime (Rust+Wasm at the edge; CF Workers equivalent)
- P4.2 RAG primitive (sqlite-vec + llama.cpp backend; optional)
- P4.3 multi-region replication
- P4.4 cost-optimization passes (right-sizing, spot VMs)
- Deliverable: feature parity with Vercel + Cloudflare for the workloads we care about

## 7. Cross-references

- Sponsor decision D5: docs/sessions/2026-07-05-polyrepo-portfolio-strategy/00_MASTER_SYNTHESIS.md §3
- Byteport current ARCHITECTURE.md and CHARTER.md (read in this audit)
- pheno-*/hexakit/eidolon/eventra current state (read in this audit)
- Phenotype portfolio strategy session: docs/sessions/2026-07-05-polyrepo-portfolio-strategy/

## 8. Open questions for sponsor

1. D5 — confirm "Surface + identity" (BOTH) is the goal, not "Surface only"
2. Phase 1 budget: are 8 weeks / 4 crate absorptions + AuthKit integration realistic?
3. The above-Byteport layers (PhenoCompose, HexaKit) — absorb via git subtree, or rewrite as
   new byteport-* crates that re-export the same types? Recommendation: subtree, keep history.
4. Is "Anti-BigCloud" stance (no lock-in, OSS-everything) correct, or do we want at least
   one "easy button" (e.g., "deploy to AWS in 1 click")? My read: keep easy-button optional.
