# Below-Byteport Layer Audit

**Date:** 2026-07-05 08:20Z | **One paragraph per repo + Y/N absorb decision**

## PhenoCompose/
- **Role:** Rust-based compute/infra composition (orchestration, replacement for docker-compose/k8s in micro form)
- **State:** ACTIVE, 50% complete, A9 DAG phase
- **Absorb into Byteport?** **YES, P1** — `byteport-orchestration` crate via git subtree
- **Why:** PhenoCompose IS the orchestrator Byteport needs to be a real platform; today Byteport only does deploy, not orchestrate

## nanovms/
- **Role:** MicroVM runtime (the substrate Byteport deploys to)
- **State:** AI-DD managed, branch feat/scorecard-lift-65
- **Absorb into Byteport?** **NO — stays as-is, integrated as substrate**
- **Why:** nanovms is the VM. Byteport shouldn't BE the VM; it should MANAGE VMs. Keep clean separation

## HexaKit/
- **Role:** Rust workspace of reusable infra primitives (error, contracts, policy, telemetry, health, adapter/port)
- **State:** ACTIVE, 8/10 (qgate-rollout-spectrum)
- **Absorb into Byteport?** **YES, P1** — `byteport-primitives` crate via git subtree
- **Why:** every byteport-* crate needs these primitives; today they re-implement error/policy/telemetry. Absorb + re-export

## pheno-cdylib-bridge/
- **Role:** C-ABI shared library exposing pheno-* Rust crates to Go (FFI)
- **State:** minimal, 2 commits
- **Absorb into Byteport?** **YES, P1** — `byteport-ffi` crate (replace the standalone)
- **Why:** the Go backend (`backend/handlers.go`, gin) needs to call into the Rust crates. Today they duplicate the types. Consolidate

## pheno-drift-detector/
- **Role:** App-substrate drift detector (ADR-049, L74)
- **State:** minimal
- **Absorb into Byteport?** **YES, P2** — `byteport-drift` crate
- **Why:** "the deployed app diverged from the manifest" is a platform-level concern. Every production PaaS has this

## helios-cli/
- **Role:** Rust CLI tool (4196 commits — substantial)
- **State:** pinned MSRV, cargo-deny config; branch chore/absorb-helioscli-final-2026-06-20
- **Absorb into Byteport?** **YES (P2, conditional)** — `byteport-cli` consolidation
- **Why:** if helios-cli commands overlap with byteport-cli, consolidate; if not, leave. Audit first

## KWatch/
- **Role:** Security monitoring / audit (security-audit-v11-081)
- **State:** AI-DD managed, 131 commits
- **Absorb into Byteport?** **YES, P2** — `byteport-security-audit` crate
- **Why:** every PaaS ships security monitoring. Byteport's gap here is visible

## KDesktopVirt/ KMobile/ KlipDot/
- **Role:** Desktop-automation tier, mobile device farm, dot/clipboard utility
- **State:** various (KDesktopVirt 70% ACTIVE; KMobile/KlipDot AI-DD)
- **Absorb into Byteport?** **NO — stay separate**
- **Why:** these are device-farm / desktop-automation, not platform primitives. Not Byteport's concern

## KodeVibe/
- **Role:** "Genesis documentation scaffold" (scaffold for new repos using hexakit)
- **State:** 31 commits
- **Absorb into Byteport?** **DEPRECATE (P3)** — replace with `byteport init` template
- **Why:** scaffolding is Byteport's natural surface; hexakit genesis scaffold is a parallel solution

## HexaKit/ (already covered above)

## apikit-httpora-final/
- **Role:** HTTP toolkit (REST, GraphQL, WebSocket)
- **State:** docs/absorb-httpora-contract-2026-06-20
- **Absorb into Byteport?** **YES (P4, low priority)** — `byteport-http` crate
- **Why:** Byteport's HTTP API surface needs a toolkit. apikit is the right primitive

## Httpora/
- **Role:** "BLOCK A app placeholder, never populated"
- **State:** 1 commit, README says "DEPRECATED — ARCHIVE RECOMMENDED"
- **Absorb into Byteport?** **NO — DELETE (P0)**
- **Why:** never had content; no consumers

## Apisync/
- **Role:** Rust API toolkit (REST, GraphQL, WebSocket)
- **State:** 60% DOCS POLISH
- **Absorb into Byteport?** **NO — stays separate**
- **Why:** Apisync is a general-purpose API toolkit; not a Byteport primitive. Parallel work, not absorbed

## Eidolon/
- **Role:** spec+test+trace layer (Phase 3)
- **State:** 80%
- **Absorb into Byteport?** **NO — stays as separate layer**
- **Why:** Eidolon is the meta layer that specs/tests/traces Byteport; it shouldn't be IN Byteport

## Eventra/
- **Role:** Rust event-driven systems (CQRS, event bus, outbox)
- **State:** 64 commits
- **Absorb into Byteport?** **YES, P2** — `byteport-queue` crate
- **Why:** "queue" capability requires an event bus. Eventra is the right primitive

## Configra/
- **Role:** Config management (Rust)
- **State:** 136 commits
- **Absorb into Byteport?** **NO — stays separate**
- **Why:** config is its own concern; not a Byteport primitive

## Conft/
- **Role:** Config (separate from Configra — investigate overlap)
- **State:** 48 commits
- **Absorb into Byteport?** **INVESTIGATE — possible merge with Configra first**
- **Why:** two config repos is suspicious; possibly consolidate before any Byteport absorption

## DataKit/
- **Role:** Data tooling (Rust)
- **State:** 68 commits
- **Absorb into Byteport?** **NO — stays separate**
- **Why:** data tooling is its own domain

## Logify/
- **Role:** Logging (Rust)
- **State:** 20 commits
- **Absorb into Byteport?** **INVESTIGATE — possibly absorb into byteport-otel as the log adapter**
- **Why:** if Logify is the log adapter for byteport-otel, it belongs in P1.5

## Summary table

| Repo                | Decision                | Phase |
|---------------------|-------------------------|-------|
| PhenoCompose        | ABSORB byteport-orchestration | P1 |
| nanovms             | stays (substrate)       | -     |
| HexaKit             | ABSORB byteport-primitives    | P1 |
| pheno-cdylib-bridge | ABSORB byteport-ffi           | P1 |
| pheno-drift-detector| ABSORB byteport-drift         | P2 |
| helios-cli          | CONDITIONAL ABSORB byteport-cli | P2 |
| KWatch              | ABSORB byteport-security-audit | P2 |
| Eventra             | ABSORB byteport-queue         | P2 |
| KodeVibe            | DEPRECATE                     | P3 |
| Httpora             | DELETE                        | P0 |
| apikit-httpora-final| LOW-PRIORITY ABSORB           | P4 |
| Eidolon             | stays                         | -     |
| Apisync             | stays                         | -     |
| KDesktopVirt/etc    | stays                         | -     |
| Configra/Conft      | INVESTIGATE merge             | P0    |
| DataKit             | stays                         | -     |
| Logify              | INVESTIGATE in byteport-otel  | P1.5  |
