# Byteport Absorption Order (dependency-respecting)

**Date:** 2026-07-05 08:20Z | **Ordered list with dependency edges**

## Phase 0 (now — preconditions)
- [ ] D5 confirm: BOTH (Surface + identity) [sponsor]
- [ ] Httpora repo: DELETE [already deprecated per README]
- [ ] Configra + Conft: decide merge-or-keep [sponsor or owner]
- [ ] gh auth status: confirm KooshaPari write access
- [ ] D4 archive banner apply: KaskMan, AtomsBot, GDK [already in PR-B]
- Owner: byteport-evolution lead
- ETA: 1-2 days

## Phase 1 (2026 Q3, ~8 weeks)

| Week | Workstream | Deliverable | Depends on |
|------|------------|-------------|------------|
| W1   | P1.2 absorb HexaKit                    | byteport-primitives crate           | -          |
| W1   | P1.3 absorb pheno-cdylib-bridge        | byteport-ffi crate                  | -          |
| W2   | P1.1 absorb PhenoCompose               | byteport-orchestration crate        | P1.2       |
| W2   | P1.5 OTel collector + Tempo            | deployable collector + backend      | byteport-otel |
| W3   | P1.4 wire AuthKit into bytebridge      | SSO + org-scoped routes             | AuthKit    |
| W4   | P1.5 add Logify as log adapter         | byteport-otel log adapter           | P1.5       |
| W5-6 | P1.6 cross-crate integration tests     | end-to-end test coverage            | P1.1-P1.5  |
| W7-8 | P1.7 stabilization + 1.0 release       | byteport-1.0                        | P1.6       |

**Critical path:** HexaKit → PhenoCompose → AuthKit integration → 1.0

## Phase 2 (2026 Q3-Q4, ~6 weeks)

| Week | Workstream | Deliverable | Depends on |
|------|------------|-------------|------------|
| W1   | P2.1 byteport-engine Wasm backend      | serverless runtime                  | P1.7       |
| W1   | P2.5 Cloudflare R2 + KV adapters       | swappable storage backends          | P1.2       |
| W2   | P2.2 absorb Eventra → byteport-queue   | event bus + work queue              | -          |
| W2   | P2.6 Caddy/ACME for TLS                | per-host cert + auto-renew          | P1.7       |
| W3   | P2.3 absorb pheno-drift-detector       | byteport-drift crate                | P1.2       |
| W4   | P2.4 absorb KWatch                     | byteport-security-audit             | P1.5       |
| W4   | P2.7 conditional absorb helios-cli     | consolidated byteport-cli           | P1.7 (audit first) |
| W5-6 | P2.8 cross-feature integration         | deploy anything, anywhere           | P2.1-P2.7  |

**Critical path:** Wasm runtime → Eventra queue → Caddy TLS

## Phase 3 (2026 Q4, ~6 weeks)

| Week | Workstream | Deliverable | Depends on |
|------|------------|-------------|------------|
| W1-2 | P3.1 Rust SDK                          | byteport-sdk (mirror omni-sdk)      | P1.7       |
| W2   | P3.2 MCP server (rmcp)                 | AI-agent-manageable Byteport        | P3.1       |
| W3   | P3.3 Webhooks + event subscriptions    | per-org event hooks                 | P2.2       |
| W3-4 | P3.4 usage_history + billing ledger    | per-org metering + cost dashboards  | P1.7       |
| W4-5 | P3.5 audit/event-log integration       | signed event log via org-audits     | P1.7       |
| W5-6 | P3.6 KodeVibe deprecate + replace      | `byteport init` template            | P3.1       |

**Critical path:** SDK → MCP → webhooks → billing

## Phase 4 (2027 Q1, ongoing)

| Workstream | Deliverable | Depends on |
|------------|-------------|------------|
| P4.1 edge runtime                          | Rust+Wasm at the edge              | P2.1       |
| P4.2 RAG primitive (sqlite-vec + llama.cpp)| vector store + embedding           | P1.7       |
| P4.3 multi-region replication              | cross-region byteport state        | P1.7       |
| P4.4 cost optimization (right-sizing, spot)| cheaper runtime for the same SLA   | P2.7       |
| P4.5 absorb apikit-httpora-final (low prio)| byteport-http crate                | P3.1       |

**Critical path:** edge runtime first (CF Workers equivalent)

## Dependency graph (ASCII)

```
Phase 0 -- D5 confirm, Httpora delete, Configra/Conft merge
  |
Phase 1 -- HexaKit -> PhenoCompose -> AuthKit -> byteport-1.0
  |                                       |
Phase 2 -- Wasm engine -> Eventra -> Caddy (parallel)
  |                \         |        /
Phase 3 -- SDK -> MCP -> webhooks -> billing + audit + deprecate KodeVibe
  |                              |
Phase 4 -- edge -> RAG -> multi-region -> cost-opt -> apikit absorb
```

## Sponsor decision points (gate the phases)

1. **End of P1 (week 8):** is AuthKit integration solid? If no, pause and stabilize.
2. **End of P2 (week 14):** is "deploy anything, anywhere" demonstrable? If no, pause.
3. **End of P3 (week 20):** is the third-party DX (SDK + MCP + webhooks) actually usable?
   If yes, Byteport is a real platform. If no, pause and stabilize DX.
4. **End of P4 (ongoing):** is the edge runtime competitive with CF Workers / Vercel Edge?

## What does NOT block the absorptions

- nanovms substrate (already integrated)
- Below-Byteport repos that are NOT being absorbed (KDesktopVirt, KMobile, KlipDot, Configra, Conft, DataKit, Apisync, Eidolon)
- Frontend work (SvelteKit dashboard; out of byteport-evolution scope)
