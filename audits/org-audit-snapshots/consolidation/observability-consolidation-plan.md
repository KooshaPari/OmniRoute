# Observability Consolidation Plan

**Date:** 2026-06-29
**Author:** Observability audit (forge agent)
**Scope:** PhenoObservability, Logify, pheno-tracing, Tracely, Tokn
**Status:** DRAFT — no repos modified; read-only analysis.

---

## Executive Summary

Of the 5 repos analyzed, **only 2 pairs involve real code duplication** (tracely-core and tracely-sentinel copied between PhenoObservability and Tracely). The remaining relationships are **complementary layers** in an observability stack — not duplicates that need consolidation, but co-existing abstractions at different architectural levels.

**Canonical SSOT recommendation:** `KooshaPari/PhenoObservability` — the 13-crate monorepo that already absorbed Metron (`metrickit`), Traceon (`tracingkit`), and Logify (`logkit` as subtree).

---

## 1. Repo Inventory

| # | Repo | Language | Crates/Packages | Description (from README) | Lines of code (approx) |
|---|------|----------|-----------------|---------------------------|----------------------|
| 1 | **PhenoObservability** | Rust (workspace) | 13 crates | "Comprehensive observability infrastructure — tracing, metrics, structured logging, alerting. Rust + Python monorepo." | ~5000+ across crates |
| 2 | **Logify** | Rust (single crate: `logkit`) | 1 crate | "Zero-cost structured logging framework with multiple sinks" | ~500 |
| 3 | **pheno-tracing** | Rust (single crate) | 1 crate | "Canonical port-driven distributed tracing substrate for the pheno-* fleet (ADR-036)" | ~6000 |
| 4 | **Tracely** | Rust (workspace) | 2 crates tracely-core, tracely-sentinel | "Unified observability library wrapping tracing, metrics, structured logging behind one ergonomic API" | ~1500 |
| 5 | **Tokn** | Rust (workspace + binary) | 2 crates tokenledger, pareto-rs | "TokenLedger — LLM cost and usage tracking. Enterprise-grade token management and pricing governance for AI coding agents." | ~15000 |

### Source tree snapshots

```
PhenoObservability/crates/
├── helix-logging/          # Structured logging (deprecated → tracely-core)
├── logkit/                 # Logify subtree (hexagonal structured logging)
├── metrickit/              # Metrics (Metron absorption)
├── pheno-dragonfly/        # Dragonfly cache observability
├── pheno-questdb/          # QuestDB time-series storage
├── phenotype-llm/          # LLM observability (☠ stale, no domain code)
├── phenotype-mcp-server/   # MCP server (☠ stale, no domain code)
├── phenotype-observably-*/ # Core tracing, logging, sentinel, macros, ports
├── tracely-core/           # Tracing + logging primitives ✦ DUPLICATED
├── tracely-sentinel/       # Sentinel/alerting (circuit-breaker, rate-limiter) ✦ DUPLICATED
└── tracingkit/             # High-level tracing (Traceon absorption)

Logify/src/
├── domain/   # LogEntry, LogLevel, Logger (trait)
├── application/ # LoggerBuilder
├── adapters/ # Sinks
└── infrastructure/

pheno-tracing/src/
├── port.rs       # TracePort trait + TraceId/SpanId/TraceOperation
├── adapters.rs   # InMemoryAdapter, StdoutAdapter
├── sampling.rs   # 6 sampling strategies (52KB!)
├── cardinality.rs# CardinalityCap
└── compat.rs     # tracing 0.1/0.2 compat shim

Tracely/crates/
├── tracely-core/     # tracing.rs + logging.rs ✦ DUPLICATED with above
└── tracely-sentinel/ # rate_limiter, circuit_breaker, bulkhead ✦ DUPLICATED

Tokn/src/
├── cost.rs, pricing.rs, analytics.rs # Financial domain
├── routing/  # Pareto cost optimization (hexagonal)
├── ingest/   # Multi-provider event ingestion
├── cache.rs  # Aggregate cache
└── cli.rs    # 11 subcommands (daily, monthly, ingest, pricing-*, etc.)
```

---

## 2. Dedup Map: Tracing vs Metrics vs Logging vs Token-Accounting

### 2.1 Real Duplication (code-level copies with drift)

| Duplicate Group | Repos | Details | Severity |
|-----------------|-------|---------|----------|
| **tracely-core** | PhenoObservability + Tracely | Identical files (`lib.rs`, `tracing.rs`, `logging.rs`) with minor drift (PhenoObservability version has more tests; Tracely version uses `thiserror` for error types) | **HIGH** — same crate name, same path, actively diverging |
| **tracely-sentinel** | PhenoObservability + Tracely | Identical structure (`lib.rs`, `rate_limiter.rs`, `circuit_breaker.rs`, `bulkhead.rs`, `validation.rs`) with drift (PhenoObservability version has requirement-trace annotations in test names; Tracely version has richer error types) | **HIGH** — same crate name, same path, actively diverging |

### 2.2 Already-Absorbed (no action needed)

| Subtree | Source Repo | Absorbed Into | Status |
|---------|-------------|---------------|--------|
| **logkit** | Logify | PhenoObservability `crates/logkit/` | Subtree already merged. Standalone Logify repo still exists as upstream. |
| **metrickit** | Metron (archived) | PhenoObservability `crates/metrickit/` | Fully absorbed per PR#157. Metron archived. |
| **tracingkit** | Traceon (archived) | PhenoObservability `crates/tracingkit/` | Fully absorbed per PR#161. Traceon archived. |

### 2.3 Complementary Layers (NOT duplication — co-existing architectural levels)

These repos serve different roles in the observability stack. Consolidating them would be **architecturally wrong**.

```
Application Layer
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│  Tracely (unified ergonomic facade)                      │
│  "One init call for all observability"                   │
│  Wraps tracing + metrics + logging behind single API     │
└────────────────────┬─────────────────────────────────────┘
                     │ depends on
┌────────────────────▼─────────────────────────────────────┐
│  PhenoObservability (implementation workspace)           │
│  Concrete crates: metrickit, tracingkit, logkit,         │
│  tracely-core, tracely-sentinel, helix-logging           │
│  Storage backends: pheno-dragonfly, pheno-questdb        │
│  LLM observability: phenotype-llm                        │
└────┬──────────────┬──────────────┬───────────────────────┘
     │              │              │
     │ depends on   │ depends on   │
     ▼              ▼              ▼
┌──────────┐ ┌───────────┐ ┌────────────────────┐
│pheno-    │ │pheno-otel │ │Tokn (tokenledger)  │
│tracing   │ │(OTLP      │ │LLM token & cost    │
│(TracePort│ │substrate) │ │accounting          │
│contract) │ │           │ │—— FinOps for AI    │
└──────────┘ └───────────┘ └────────────────────┘
```

**Layer-by-layer verdict:**

| Layer | Repo | Verdict | Rationale |
|-------|------|---------|-----------|
| **Tracing PORT contract** | pheno-tracing | **Keep separate** per ADR-036 | Lightweight port crate (~3KB of trait + types). Fleet crates (pheno-errors, pheno-context, pheno-config) depend on this WITHOUT pulling in a 13-crate workspace. Making it part of PhenoObservability would create heavyweight dependency bloat. |
| **Tracing IMPLEMENTATION** | PhenoObservability (tracingkit, tracely-core, phenotype-observably-tracing) | **Canonical SSOT** | Concrete span processing, OTLP adapters, batch processors. |
| **Metrics** | PhenoObservability (metrickit, phenotype-observably-ports) | **Canonical SSOT** | Already absorbed from Metron. No overlap with others. |
| **Logging** | Logify ↔ PhenoObservability (logkit subtree) | **Subtree sync** | Logify is the canonical upstream; PhenoObservability has the subtree. Clean relationship, just needs documented sync cadence. |
| **Structured logging (old)** | PhenoObservability (helix-logging) | **Deprecated** | Marked as merged-into-tracely-core. Remove in favor of logkit. |
| **Sentinel/Alerting** | PhenoObservability (tracely-sentinel) | **Canonical SSOT** | Circuit breaker + rate limiter + health framework. |
| **Token Accounting** | Tokn (tokenledger + pareto-rs) | **Keep separate** | Completely different domain (FinOps for AI agent usage). Tokn tracks tokens spent per session/provider, computes blended $/MTok, enables pricing governance. It consumes (but does not contain) observability data. Not tracing, not metrics, not logging — it's **financial accounting**. |
| **Unified facade** | Tracely (standalone) | **Eliminate duplication** | Its only unique crates (tracely-core, tracely-sentinel) are identical copies of what exists in PhenoObservability. The "unified API" concept lives in PhenoObservability's phenotype-observably-* crates already. |

### 2.4 Summary Venn

```
                    OBSERVABILITY (SRE)
                    ┌───────────────────────┐
                    │  PhenoObservability   │
                    │  (monorepo umbrella)  │
                    │                       │
  TRACING PORT      │  ┌─────────────────┐  │   TOKEN ACCOUNTING
  ┌──────────┐      │  │ tracely-core    │  │   ┌──────────────┐
  │ pheno-   │◄─────│──│ tracely-sentinel│  │   │   Tokn       │
  │ tracing  │      │  │ metrickit       │  │   │ (tokenledger │
  │(contract)│      │  │ tracingkit      │  │   │  + pareto-rs)│
  └──────────┘      │  │ logkit (Logify) │  │   └──────────────┘
                     │  │ helix-logging   │  │
                     │  └─────────────────┘  │
                     │                       │
                     │   COPIES              │   COMPLEMENTARY
                     │   (tracely-*)         │   (not observability)
                     └───────────────────────┘
                              ▲
                              │ duplicates
                    ┌─────────┴─────────┐
                    │    Tracely        │
                    │ (standalone repo) │
                    │ tracely-core      │
                    │ tracely-sentinel  │
                    └───────────────────┘
```

---

## 3. Verdict: Canonical SSOT

| Role | Repo | Action |
|------|------|--------|
| **Canonical SSOT** | **`KooshaPari/PhenoObservability`** | **Absorb the two drifting crates** from Tracely, **continue subtree-syncing** Logify, **document boundary** with pheno-tracing and Tokn |
| **Archived as-readonly** | `KooshaPari/Tracely` | Merge meaningful drift into PhenoObservability, then archive. No new development. |
| **Upstream kept (subtree source)** | `KooshaPari/Logify` | Keep standalone as the canonical upstream for `logkit`. PhenoObservability vendors via subtree. Sync periodically. |
| **Keep separate** | `KooshaPari/pheno-tracing` | Fleet-wide port contract. Lightweight dep for all pheno-* crates. Documented boundary. |
| **Keep separate** | `KooshaPari/Tokn` | FinOps for AI. Token accounting is its own domain. Will produce usage data that feeds into observability dashboards but is not itself observability infrastructure. |

### Tokn adjacency

Tokn and PhenoObservability are **peers** that should integrate via API:

- Tokn emits `UsageEvent` records (tokens/cost per provider/session)
- PhenoObservability could consume these as a custom metric source
- No code merging needed; just a documented integration contract

---

## 4. Forward-Only Migration DAG

```
Phase 1: RESOLVE DRIFT (tracely-core + tracely-sentinel)
────────────────────────────────────────────────────────
  Tracely (standalone)             PhenoObservability
  ┌─────────────────┐             ┌────────────────────┐
  │ tracely-core    │──drift──►   │ tracely-core       │
  │  (thiserror      │  merge     │  (absorb richer     │
  │   error types)   │  into      │   error types;      │
  │ tracely-sentinel │  PO        │   keep test         │
  │  (richer errors) │            │   traceability)     │
  └─────────────────┘             └────────────────────┘
         │                               │
         │ Archive Tracely                │ Update all Cargo.toml
         ▼                               ▼
  [ARCHIVED]                     [SSOT — all consumers
                                  depend on this]

Phase 2: DOCUMENT SUBTREE SYNC (Logify ↔ logkit in PO)
────────────────────────────────────────────────────────
  Logify (upstream)  ──subtree──►  PhenoObservability/crates/logkit/
  ┌──────────────┐    sync     ┌────────────────────────────┐
  │ logkit crate │    ──────►  │ subtree pull (git subtree) │
  │ (SSOT for    │  ◄────────  │                            │
  │  logging)    │  manual     │ Any Logify fix first here, │
  └──────────────┘  backport   │ then subtree push to PO    │

Phase 3: CLEANUP STALE CRATES (PhenoObservability)
────────────────────────────────────────────────────────
  Stale / no-code crates:
  ┌────────────────────┐
  │ phenotype-llm      │──► Remove or assign domain owner
  │ phenotype-mcp-     │──► Remove or assign domain owner
  │   server           │
  │ helix-logging      │──► Remove (superseded by logkit)
  └────────────────────┘

Phase 4: BOUNDARY DOCUMENTATION
────────────────────────────────────────────────────────
  Update these files with the consolidation decision:
  - PhenoObservability/BOUNDARY.md   — add Tokn as "does NOT own"
  - PhenoObservability/AGENTS.md     — update drift section
  - Tracely/AGENTS.md                — add archival notice
  - pheno-tracing/SSOT.md            — confirm boundary
  - Tokn/AGENTS.md                   — document relationship
```

### Migration dependency graph (who moves first)

```
Phase 1 ──────► Phase 2 ──────► Phase 3 ──────► Phase 4
  │                │               │               │
  │ Resolve         │ Document      │ Remove         │ Update
  │ Tracely drift   │ subtree sync  │ stale crates   │ docs
  │ Archive         │ for Logify    │ in PO          │ everywhere
  │ Tracely         │               │                │
  ▼                ▼               ▼                ▼
  PROD LOCKED     PROD LOCKED     PROD LOCKED     PROD LOCKED
  (no consumer     (sync only      (dead code       (informational
   impact)          — no impact)    removal)         — no impact)
```

All 4 phases can be done in **any order** since they are independent, but Phase 1 (drift resolution) has the highest urgency because two copies of the same code are actively diverging.

---

## 5. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **Phase 1 merge conflict**: The two versions of tracely-core/sentinel have drifted enough that auto-merge may conflict | Medium | Medium — manual resolution needed on ~5 files | Run `diff` before merging. Resolve each conflict with preference for **PhenoObservability's test annotations** + **Tracely's error type improvements**. Verify via `cargo build` + `cargo test`. |
| **Orphaned consumers**: Some downstream crate depends on the standalone `Tracely` repo and will break when archived | Low | Medium — broken builds until migration | Search `Cargo.toml` files across all phenotype repos for `KooshaPari/Tracely` references. Update them to `KooshaPari/PhenoObservability` as part of Phase 1. |
| **Logify subtree drift**: Logify evolves independently and the subtree in PhenoObservability falls behind | Low | Low — Logify is at ~17 files and changing slowly | Set a calendar reminder for monthly `git subtree pull` or add a CI check that compares SHAs. |
| **Tokn dependency confusion**: Someone tries to "merge Tokn into PhenoObservability" because "they're both observability" | Medium | High — architectural damage | Document clearly in both `BOUNDARY.md` and this plan that Tokn is **not** observability — it is FinOps for AI agents. Add `Tokn` to PhenoObservability's "Does NOT own" section. |
| **False assumption of duplication**: Future developer sees 5 repos and assumes they all overlap | Medium | Low — wasted analysis time | This plan serves as the authoritative dedup reference. Link to it from `AGENTS.md` files in all 5 repos. |
| **Tracely has legitimately unique code** beyond the duplicated crates: The standalone repo has fewer non-tracely-* directories (helix-tracing, pheno-logging-zig, zerokit) that may hold unique code | Low | Low — these dirs are empty (0 .rs files) | Verify during archival that no unique code is lost. |

### Zero-downtime verification

Each phase is safe because:

1. **Phase 1** (drift resolution): Update consumers' Cargo.toml from `Tracely` to `PhenoObservability`. Archive only after no remaining consumers.
2. **Phase 2** (subtree sync): No consumer impact — same crate name, same code.
3. **Phase 3** (stale crate removal): Only removes crates with no domain code. `cargo check` on the workspace will confirm no breakage.
4. **Phase 4** (docs): Informational only.

---

## 6. Concrete Action Items

### Must-do (blocking)

- [ ] **RESOLVE DRIFT (Phase 1)**: Merge tracely-core and tracely-sentinel from `KooshaPari/Tracely` into `KooshaPari/PhenoObservability`, preferring richer error types from Tracely and keeping test annotations from PhenoObservability
- [ ] **SEARCH CONSUMERS**: `grep -r "KooshaPari/Tracely" --include="Cargo.toml"` across all phenotype repos; update each to point to `KooshaPari/PhenoObservability`
- [ ] **ARCHIVE Tracely**: Add `"archived": true` to repo settings + archival notice to README
- [ ] **DOCUMENT IN PO BOUNDARY.md**: Add Tokn as "complementary — not owned"

### Should-do (quality of life)

- [ ] **DOCUMENT SUBTREE SYNC CADENCE**: Decide monthly/quarterly sync for Logify→logkit
- [ ] **STALE CRATE CLEANUP**: Remove phenotype-llm, phenotype-mcp-server, helix-logging from PhenoObservability workspace
- [ ] **SSOT ANNOTATIONS**: Add `SSOT.md` files to all 5 repos linking to this plan

### Don't-do (intentionally out of scope)

- ❌ Merge `pheno-tracing` into PhenoObservability — wrong abstraction level
- ❌ Merge `Tokn` into PhenoObservability — wrong domain entirely
- ❌ Create a "super monorepo" combining all 5 — no architectural benefit; increased build times

---

## 7. Current State Diagram (as of 2026-06-29)

```
                        ┌──────────────────────┐
                        │    PhenoObservability │ ◄── SSOT
                        │    (13 crates)        │
                        └──┬───┬───┬───┬───┬───┘
                           │   │   │   │   │
          ┌────────────────┘   │   │   │   └─────────────┐
          │         ┌──────────┘   │   └──────────┐      │
          ▼         ▼              ▼              ▼      ▼
     tracely-   tracely-      metrickit      logkit  (others)
     core       sentinel      (Metron)       (Logify)
     ┌─────┐    ┌──────┐     ┌────────┐     ┌──────┐
     │ DUPE│    │ DUPE │     │ done   │     │ ok   │
     └──┬──┘    └──┬───┘     └────────┘     └──────┘
        │          │
        │ copied   │ copied (with drift)
        ▼          ▼
     ┌──────┐ ┌────────┐
     │Trace │ │ Tracely│
     │ly    │ │ senti- │
     │core  │ │ nel    │
     └──────┘ └────────┘
     ┌──────────────────────┐
     │   Tracely (standalone)│ ◄── will archive
     └──────────────────────┘

┌──────────────┐     ┌──────────────────────┐     ┌──────────────┐
│ pheno-tracing│     │    pheno-otel        │     │   Tokn       │
│ (TracePort)  │     │ (OTLP substrate)     │     │ (tokenledger)│
│ KEEP SEPARATE│     │ KEEP SEPARATE        │     │ KEEP SEPARATE│
└──────────────┘     └──────────────────────┘     └──────────────┘
```

---

## Appendix A: Cargo dependency relationships

```
pheno-tracing
  └─dep: pheno-otel (for self-instrumentation)

PhenoObservability
  ├─dep: pheno-otel (as path dep, for L62 error-rate observability)
  └─dep: phenotype-error-core (git dep on phenotype-types)
  └─dep: phenotype-errors, phenotype-event-bus (vendor dir)

Tokn
  └─dep: tracing, tracing-subscriber (for its OWN instrumentation)
  └─dep: reqwest (HTTP), clap (CLI), serde, chrono, walkdir, etc.

Logify
  └─dep: serde, serde_json, thiserror, anyhow, async-trait, parking_lot, chrono, uuid, tokio

Tracely
  └─dep: (no external deps beyond tracing ecosystem — very thin)
```

**Notable:** Tokn does NOT depend on any of the other 4 repos. It uses `tracing` for its own internal instrumentation but does not import PhenoObservability, pheno-tracing, or Logify. This confirms its orthogonal domain.

## Appendix B: Key files reviewed

| File | Repo | Purpose |
|------|------|---------|
| `Cargo.toml` | All 5 | Workspace/crate configuration |
| `README.md` | All 5 | Purpose & scope |
| `SPEC.md` | pheno-tracing, PhenoObservability, Tracely | Formal specification |
| `PRD.md` | PhenoObservability, Tokn | Product requirements |
| `ARCHITECTURE.md` | PhenoObservability | Component architecture & crate deps |
| `BOUNDARY.md` | PhenoObservability | Own/does-not-own boundary |
| `PLAN.md` | Tracely | Development roadmap |
| `lib.rs` + key `src/` | All 5 | Actual code structure |
| `src/domain/*.rs` | Logify | Logger trait + types |
| `src/port.rs` | pheno-tracing | TracePort trait contract |
| `src/routing/mod.rs` | Tokn | Pareto routing ports/adapter |
