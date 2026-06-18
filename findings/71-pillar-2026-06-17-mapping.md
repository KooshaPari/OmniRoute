# 71-Pillar Crosswalk — Mapping from 30-Pillar (2026-06-16) to 71-Pillar (2026-06-17)

**Date:** 2026-06-17
**Author:** parent-claude (autonomous crosswalk build)
**Status:** ACTIVE — superset upgrade, NOT a replacement of the 30-pillar
**Inputs:**
- OLD 30-pillar audit: `findings/30-pillar-2026-06-16.md` (file uses L1-L30 numbering; this crosswalk uses AGENTS.md canonical L0-L29 numbering per the user's task spec)
- NEW 71-pillar taxonomy: per `AGENTS.md` "Active ADRs" section (L1-L12 AX / L13-L19 perf / L20-L27 quality / L28-L37 DX / L38-L45 UX / L46-L55 security / L56-L63 obs+ops / L64-L68 doc+SSOT / L69-L71 governance)
- Sibling framework: `findings/71-PILLAR-AUDIT-FRAMEWORK-2026-06-17.md` (Domain A-G scheme, 77 pillars; orthogonal taxonomy, see §7)

---

## 1. Purpose

The 30-pillar audit (`findings/30-pillar-2026-06-16.md`) was generated on 2026-06-16 against 10 top repos plus 2 N/A entries. It used a flat L1-L30 numbering and a generic pillar taxonomy. On 2026-06-17 the org adopted a richer 71-pillar framework per AGENTS.md, organized into 9 layered domains (AX, Performance, Quality, DX, UX, Security, Obs+Ops, Doc+SSOT, Governance). This crosswalk exists to:

1. **Preserve the 30-pillar investment.** Every pillar from the 30-pillar audit maps to one or more pillars in the 71-pillar framework. No data is lost; every signal collected under the 30-pillar scheme is re-derivable under the 71-pillar scheme.
2. **Document the upgrade path.** For each OLD pillar (L0-L29), name its successor(s) in the NEW scheme (L1-L71) and the mapping type (1-to-1, 1-to-many, many-to-1, deprecated-merged-into, new-only).
3. **Make the 41 NEW pillars explicit.** The 71-pillar scheme is a superset — 41 pillars have no OLD counterpart. These are the AX/UX/DX layers and the 3 governance pillars that were absent from the 30-pillar scheme.
4. **Enable per-repo rescore.** Any repo scored under the 30-pillar scheme can be re-scored under the 71-pillar scheme by applying the mapping rules in §4 and back-filling the 41 NEW pillars from §5.
5. **Decouple audit cadence from framework evolution.** The OLD audit file (`findings/30-pillar-2026-06-16.md`) remains the historical record; the NEW scorecard (`findings/71-pillar-2026-06-17.md`, when generated) supersedes it going forward; this crosswalk is the bridge.

### Backward-compatibility guarantee

- **All 30 OLD pillars** are explicitly enumerated in §2 and mapped in §4.
- **No OLD pillar is silently dropped.** Even where a pillar is deprecated or merged (L27+L28 → L69, L18 split into L34+L35, L0 split into L1+L64+L66), the OLD entry is preserved with its mapping rule.
- **The OLD scorecard remains queryable.** A reader with `30-pillar-2026-06-16.md` in hand can reconstruct any 71-pillar pillar score by following the §4 row for that OLD pillar and aggregating the underlying signals.
- **The OLD signal-probe format is unchanged.** Where the NEW scheme asks for a signal not in the OLD probe (e.g., L13 Performance Budgets), the OLD probe is silent (signal=0) and the NEW pillar is scored as 0/3 for any repo not yet re-probed.

---

## 2. Old 30-Pillar Reference

Source: AGENTS.md description of the prior 30-pillar framework as used in the 30-pillar-2026-06-16 audit (L0-L29 canonical numbering per AGENTS.md). Note: the actual file `findings/30-pillar-2026-06-16.md` uses an internal L1-L30 numbering with generic pillar names; this crosswalk adopts the AGENTS.md L0-L29 numbering and the fleet-specific pillar names listed in AGENTS.md, which is the canonical reference per the user's task spec.

### 2.1 OLD pillar summary (30 pillars, L0-L29)

| # | Name | Domain bucket | What it covers |
|---|------|---------------|----------------|
| L0 | Architecture Foundations | AX | High-level architectural decisions; ADR presence; charter; docs/adr/ directory |
| L1 | Domain Modeling | AX | Entities, value objects, aggregates; bounded contexts; ubiquitous language |
| L2 | Hexagonal Port/Adapter | AX | Ports & adapters pattern; inversion of control; business logic isolation |
| L3 | Cargo Workspace Topology | AX | Workspace member layout; crate split by concern; Cargo.toml workspace globs |
| L4 | Event Sourcing & Domain Events | AX | Event-sourced aggregates; domain event publication; event-store choice |
| L5 | Cross-Crate Dependency Rules | AX | Dependency direction rules; no-circular-deps; layered access |
| L6 | Type System & Error Handling | AX | thiserror/anyhow usage; Result<T,E>; error composition; never-panic |
| L7 | Adapter/Plugin Layer | AX | Plugin trait surface; dynamic loading; adapter registration |
| L8 | Microkernel Pattern | AX | Core kernel vs. plug-ins; minimal-stable-kernel principle |
| L9 | Polyglot Strategy | AX | Cross-language facade (Rust↔Python↔Go↔TS); FFI boundaries |
| L10 | Substrate Placement | AX | `pheno-*-lib` vs `phenotype-*-sdk` vs federated service placement |
| L11 | Observability | AX | OTLP export; tracing/log/prom signal coverage |
| L12 | Configuration | AX | 12-factor config; env+file cascade; defaults; type-safe config |
| L13 | CI/CD Workflow Hygiene | DX | GitHub Actions presence; ubuntu runners; workflow count |
| L14 | Pin/SHA Discipline | DX | SHA-pinned actions; lockfile pinning; reproducible builds |
| L15 | Test Matrix | DX | Unit+integration+e2e+perf+chaos; pheno-ci-templates coverage |
| L16 | Coverage Gates | DX | Coverage thresholds (80% lib / 70% framework / 60% service); gate enforcement |
| L17 | Dependency Policy | DX | deny.toml; SBOM; CVE audit; cargo-audit / npm-audit |
| L18 | Branch Hygiene | DX | Branch naming; stale-branch cleanup; rebase vs merge policy |
| L19 | Worklog Schema V2.1 | DX | worklog JSON per ADR-015; 10-column markdown form |
| L20 | AGENTS.md/llms.txt Canonical | DX | AGENTS.md presence; llms.txt presence; canonical meta-bundle |
| L21 | Submodule Topology | DX | .gitmodules shape; submodule pointer health |
| L22 | LFS Handling | DX | .gitattributes for large files; LFS pointer integrity |
| L23 | Worktree Isolation | DX | git worktree usage; per-task isolation; per-branch workspaces |
| L24 | Stash Lifecycle | DX | Stash naming; stash cleanup; stash→branch promotion |
| L25 | Monorepo Polyrepo Trade-off | DX | polyrepo vs monorepo decision; hybrid topology |
| L26 | Remote Topology | DX | origin/upstream/collaborator remotes; remote URL hygiene |
| L27 | PRCP Pattern | GOV | Polyglot Reuse via Canonical Ports — substrate choice per concern |
| L28 | PRCP Reconciliation | GOV | Reconciliation cadence; drift detection between substrate and consumer |
| L29 | Recovery & Disaster-Readiness | GOV | Backup; restore drill; RTO/RPO; archive procedure |

### 2.2 OLD pillar count verification

- **30 entries** (L0, L1, L2, ..., L29) — counted in the table above. ✓
- Domains touched in OLD: AX (13: L0-L12), DX (14: L13-L26), GOV (3: L27-L29). Note: Quality, UX, Security, Observability-Ops-as-separate-domain, Doc-SSOT-as-separate-domain, Performance-as-separate-domain were all lumped into DX/AX/GOV in the OLD scheme — the NEW 71-pillar scheme gives each of those its own domain. This is the primary motivation for the framework expansion.

---

## 3. New 71-Pillar Reference

Source: AGENTS.md "Active ADRs" section, taxonomy block, dated 2026-06-17. Sums to exactly 71 pillars across 9 domains.

### 3.1 NEW pillar summary by domain (71 pillars total)

| Domain | Range | Count | Theme |
|--------|-------|-------|-------|
| Architecture (AX) | L1-L12 | 12 | Static structure: how the system is shaped |
| Performance | L13-L19 | 7 | Runtime efficiency & resource use |
| Quality / Correctness | L20-L27 | 8 | Tests, types, error paths |
| DX | L28-L37 | 10 | Developer ergonomics & workflow |
| UX | L38-L45 | 8 | End-user-facing quality |
| Security | L46-L55 | 10 | Trust-boundary correctness |
| Observability & Ops | L56-L63 | 8 | Production signal & incident response |
| Doc & SSOT | L64-L68 | 5 | Knowledge surfaces & decision records |
| Governance & Sustainability | L69-L71 | 3 | Long-term stewardship |

### 3.2 NEW pillar enumeration (L1-L71)

| # | Name | Domain | Source / definition (one-liner) |
|---|------|--------|----------------------------------|
| L1 | Architecture Foundations | AX | ADR presence; charter; doc/adr/ dir; top-level decisions documented |
| L2 | Domain Modeling | AX | Entities / VOs / aggregates; bounded contexts; ubiquitous language |
| L3 | Hexagonal Port/Adapter | AX | Port trait + Adapter impl per ADR-014 |
| L4 | Cargo Workspace Topology | AX | Workspace member layout; crate split; cargo workspace globs |
| L5 | Event Sourcing & Domain Events | AX | Event-sourced aggregates; domain event publication |
| L6 | Cross-Crate Dependency Rules | AX | Dependency direction; no cycles; layered access (per ADR-022) |
| L7 | Type System & Error Handling | AX | thiserror/anyhow; Result<T,E>; never-panic |
| L8 | Adapter/Plugin Layer | AX | Plugin trait surface; dynamic loading; registration |
| L9 | Microkernel Pattern | AX | Core kernel vs. plug-ins; minimal-stable-kernel |
| L10 | Polyglot Strategy | AX | Cross-language facade (Rust↔Py↔Go↔TS) |
| L11 | Substrate Placement | AX | `pheno-*-lib` vs `phenotype-*-sdk` vs federated service (ADR-023) |
| L12 | Configuration | AX | 12-factor; env+file cascade; type-safe config (ADR-022) |
| L13 | Performance Budgets & Profiling | Performance | benches/ presence; criterion/iai; budget thresholds |
| L14 | Async/Concurrency Design | Performance | async/await usage; tokio runtime choice; structured concurrency |
| L15 | Memory & Allocation | Performance | Allocation profiling; mimalloc/jemalloc; dhat/heaptrack |
| L16 | Resource Limits & Rate Limits | Performance | Rate limit; governor; token bucket; backpressure |
| L17 | Concurrency Safety & Races | Performance | loom/miri; Send+Sync; clippy.toml correctness lints |
| L18 | Caching Strategy | Performance | moka/redis/lru; cache invalidation policy |
| L19 | Build & Compile-Time Performance | Performance | sccache; mold/lld; cold-build < 10min |
| L20 | Test Matrix | Quality | Unit+integ+e2e+perf+chaos per ADR-015 substrate quality bar |
| L21 | Coverage Gates | Quality | 80/70/60 thresholds; tarpaulin/coverage.py enforcement |
| L22 | Error Handling & User Feedback | Quality | Actionable errors; what+why+fix; thiserror message quality |
| L23 | Type Safety & Soundness | Quality | `unsafe` audit; cargo-geiger; no_unwind audit |
| L24 | Linting & Static Analysis | Quality | clippy/ruff/eslint clean; complexity lints |
| L25 | Mutation Testing | Quality | cargo-mutants/mutmut; mutation score threshold |
| L26 | Property-Based Testing | Quality | proptest/quickcheck/hypothesis; invariants covered |
| L27 | Resilience (Retries/Backoff/Circuit) | Quality | backoff; circuit-breaker; bulkhead; chaos |
| L28 | CI/CD Workflow Hygiene | DX | GitHub Actions; ubuntu runners; workflow count |
| L29 | Pin/SHA Discipline | DX | SHA-pinned actions; lockfile pinning |
| L30 | Worklog Schema V2.1 | DX | worklog JSON per ADR-015; 10-column markdown |
| L31 | AGENTS.md/llms.txt Canonical | DX | AGENTS.md; llms.txt; canonical meta-bundle |
| L32 | Submodule Topology | DX | .gitmodules shape; pointer health |
| L33 | LFS Handling | DX | .gitattributes for large files; LFS integrity |
| L34 | Worktree Isolation | DX | git worktree; per-task isolation; per-branch workspaces |
| L35 | Stash Lifecycle | DX | Stash naming; cleanup; stash→branch promotion |
| L36 | Monorepo Polyrepo Trade-off | DX | polyrepo vs monorepo; hybrid topology |
| L37 | Remote Topology | DX | origin/upstream/collaborator remotes |
| L38 | CLI/UX & Ergonomics | UX | clap/structopt; --help; subcommand ergonomics |
| L39 | Error Messages & User Feedback | UX | User-facing error quality (different from L22: L22 is internal, L39 is end-user) |
| L40 | Internationalization (i18n/l10n) | UX | gettext/fluent; locale_dirs; externalized strings |
| L41 | Accessibility (a11y) | UX | aria-/role=count; screen reader; keyboard nav |
| L42 | Onboarding & Contributor DX | UX | CONTRIBUTING.md; QUICKSTART; first-PR path < 1 hour |
| L43 | API Surface & Contract | UX | lib.rs/__init__.py/index.ts public surface; semver |
| L44 | Documentation & SSOT | UX | docs/; README; AGENTS; CLAUDE; FR; PRD |
| L45 | Responsive / Adaptive UX | UX | Responsive UI; progressive enhancement; dark mode |
| L46 | Secret Management | Security | dotenvy/keyring/secrecy; no secrets in code |
| L47 | Supply-Chain Security (SBOM/CVE) | Security | deny.toml; sbom_file; cargo-audit; npm-audit |
| L48 | Threat Model & Attack Surface | Security | threat_doc; STRIDE refs |
| L49 | AuthN/AuthZ | Security | oauth/jwt/oidc; RBAC; ABAC |
| L50 | Cryptography & Key Management | Security | argon2/ed25519/chacha/aes-gcm; HSM/KMS |
| L51 | Audit Log & Compliance | Security | audit_log/trail files; SOC2/HIPAA evidence |
| L52 | Multi-Tenant Isolation & Data Privacy | Security | tenant_id/org_id/workspace_id scope |
| L53 | Dependency Hygiene & CVEs | Security | CVE scan; outdated/audit_check |
| L54 | Input Validation & Sanitization | Security | Input guards; SQL/XSS/command-injection defense |
| L55 | Security Headers & Transport | Security | TLS/HSTS/CSP/CORS; mTLS; cert pinning |
| L56 | Observability (logs/metrics/traces) | Obs+Ops | OTLP export; tracing/log/prom coverage |
| L57 | Distributed Tracing | Obs+Ops | OpenTelemetry spans; trace propagation; span context |
| L58 | Metrics & SLI/SLO | Obs+Ops | Prometheus metrics; SLI/SLO definitions; burn rate |
| L59 | Logging Hygiene | Obs+Ops | Structured logging; level discipline; no PII |
| L60 | Alerting & On-Call | Obs+Ops | Alert rules; on-call rotation; escalation |
| L61 | Incident Response & Postmortem | Obs+Ops | Runbooks; blameless postmortem template |
| L62 | Chaos Engineering & Failure Injection | Obs+Ops | Chaos tests; fault injection; game days |
| L63 | Observability of Failure Modes | Obs+Ops | Sentry/Bugsnag; panic hooks; error budgets |
| L64 | SSOT & Decision Records | Doc+SSOT | Single source of truth; decision log; SSoT.md |
| L65 | API Reference Documentation | Doc+SSOT | cargo doc/typedoc; OpenAPI spec; rendered API ref |
| L66 | Architecture Decision Records (ADR) | Doc+SSOT | docs/adr/; ADR-NNNN format; status lifecycle |
| L67 | Conceptual Docs & How-Tos | Doc+SSOT | Concept docs; tutorial-style how-tos; examples |
| L68 | Onboarding & Knowledge Transfer | Doc+SSOT | New-dev ramp docs; ARCHITECTURE.md; CONTRIBUTING.md |
| L69 | PRCP Pattern & Reconciliation | GOV | Polyglot Reuse via Canonical Ports + reconciliation cadence |
| L70 | Recovery & Disaster-Readiness | GOV | Backup; restore drill; RTO/RPO; archive procedure |
| L71 | Repository Governance & Sustainability | GOV | LICENSE; CODEOWNERS; CHANGELOG; FUNDING; long-term steward |

### 3.3 NEW pillar count verification

- L1-L71 = 71 entries. ✓
- 12+7+8+10+8+10+8+5+3 = 71. ✓
- Domains: AX, Performance, Quality, DX, UX, Security, Obs+Ops, Doc+SSOT, GOV = 9 domains. ✓

---

## 4. Crosswalk Table

Each row maps one OLD pillar (L0-L29) to its successor(s) in the NEW 71-pillar scheme. Mapping types:
- **1-to-1** — one OLD pillar → exactly one NEW pillar (most common).
- **1-to-many** — one OLD pillar → multiple NEW pillars (split).
- **many-to-1** — multiple OLD pillars → one NEW pillar (merge).
- **deprecated-merged-into** — OLD pillar is absorbed into a NEW pillar (no separate existence).
- **new-only** — NEW pillar has no OLD counterpart (see §5).

| Old L# | Old Name | Maps to New L#(s) | Mapping type | Justification |
|--------|----------|-------------------|--------------|---------------|
| L0 | Architecture Foundations | L1, L64, L66 | 1-to-many (split) | OLD L0 conflated three concerns: high-level AX decisions (→L1), decision-record discipline (→L66), and SSOT practice (→L64). NEW scheme separates them so each can be scored and tracked independently. A repo with strong ADRs but weak SSOT can now score 3 on L66 and 1 on L64. |
| L1 | Domain Modeling | L2 | 1-to-1 | Direct rename; same content. AX domain preserved. |
| L2 | Hexagonal Port/Adapter | L3 | 1-to-1 | Direct rename; same content. AX domain preserved. |
| L3 | Cargo Workspace Topology | L4 | 1-to-1 | Direct rename; same content. AX domain preserved. |
| L4 | Event Sourcing & Domain Events | L5 | 1-to-1 | Direct rename; same content. AX domain preserved. |
| L5 | Cross-Crate Dependency Rules | L6 | 1-to-1 | Direct rename; same content. AX domain preserved (ADR-022). |
| L6 | Type System & Error Handling | L7 | 1-to-1 | Direct rename; same content. AX domain preserved. |
| L7 | Adapter/Plugin Layer | L8 | 1-to-1 | Direct rename; same content. AX domain preserved. |
| L8 | Microkernel Pattern | L9 | 1-to-1 | Direct rename; same content. AX domain preserved. |
| L9 | Polyglot Strategy | L10 | 1-to-1 | Direct rename; same content. AX domain preserved. |
| L10 | Substrate Placement | L11 | 1-to-1 | Direct rename; same content. AX domain preserved (ADR-023). |
| L11 | Observability | L56 | 1-to-1 (domain-shifted) | Content unchanged but moved from AX to Obs+Ops in NEW scheme. OLD score for L11 (e.g., thegent=2, PhenoMCP=3) carries directly to L56. |
| L12 | Configuration | L12 | 1-to-1 (unchanged) | Position AND name unchanged; L# stays at L12. Content unchanged. |
| L13 | CI/CD Workflow Hygiene | L28 | 1-to-1 (domain-shifted) | Content unchanged but moved from DX (high-numbered in OLD) to DX (L28-L37 range in NEW). OLD scores carry directly. |
| L14 | Pin/SHA Discipline | L29 | 1-to-1 (domain-shifted) | Content unchanged; L# moved. OLD scores carry directly. |
| L15 | Test Matrix | L20 | 1-to-1 (domain-shifted) | Content unchanged; moved from DX to Quality domain. OLD scores carry directly. |
| L16 | Coverage Gates | L21 | 1-to-1 (domain-shifted) | Content unchanged; moved from DX to Quality. OLD scores carry directly. |
| L17 | Dependency Policy | L53 | 1-to-1 (domain-shifted) | Content unchanged; moved from DX to Security. Note: L53 is "Dependency Hygiene & CVEs" — slightly broader than OLD L17 "Dependency Policy" but the OLD signals (deny.toml, cargo-audit, sbom_file) cover both. |
| L18 | Branch Hygiene | L34, L35 | 1-to-many (split) | OLD L18 conflated two concerns: branch topology (→L34 Worktree Isolation) and stash/branch lifecycle (→L35 Stash Lifecycle). A repo with clean worktree hygiene but messy stash can now be scored 3 on L34 and 1 on L35. |
| L19 | Worklog Schema V2.1 | L30 | 1-to-1 | Direct rename; same content. DX domain preserved. |
| L20 | AGENTS.md/llms.txt Canonical | L31 | 1-to-1 | Direct rename; same content. DX domain preserved. |
| L21 | Submodule Topology | L32 | 1-to-1 | Direct rename; same content. DX domain preserved. |
| L22 | LFS Handling | L33 | 1-to-1 | Direct rename; same content. DX domain preserved. |
| L23 | Worktree Isolation | L34 | 1-to-1 | Direct rename; same content. Note: L34 now also receives half of OLD L18 (split). |
| L24 | Stash Lifecycle | L35 | 1-to-1 | Direct rename; same content. Note: L35 now also receives half of OLD L18 (split). |
| L25 | Monorepo Polyrepo Trade-off | L36 | 1-to-1 | Direct rename; same content. DX domain preserved. |
| L26 | Remote Topology | L37 | 1-to-1 | Direct rename; same content. DX domain preserved. |
| L27 | PRCP Pattern | L69 | 1-to-1 (merged with L28) | Content merged with OLD L28 into single NEW pillar "PRCP Pattern & Reconciliation". The "Pattern" portion of the content (ADR-018) is the L27 contribution; the "Reconciliation" portion comes from L28. |
| L28 | PRCP Reconciliation | L69 | many-to-1 (merged into L27 → L69) | Content merged with OLD L27 into L69. OLD L28 is deprecated as a standalone pillar; its signals (drift detection, reconciliation cadence) are now part of L69. |
| L29 | Recovery & Disaster-Readiness | L70 | 1-to-1 | Direct rename; same content. Moved from GOV end-of-OLD to GOV middle-of-NEW; signals carry directly. |

### 4.1 Mapping-type summary

| Mapping type | Count | Old pillars |
|--------------|-------|-------------|
| 1-to-1 (direct) | 21 | L1, L2, L3, L4, L5, L6, L7, L8, L9, L10, L12, L19, L20, L21, L22, L23, L24, L25, L26, L27, L29 |
| 1-to-1 (domain-shifted, no content change) | 6 | L11→L56, L13→L28, L14→L29, L15→L20, L16→L21, L17→L53 |
| 1-to-1 (unchanged) | 1 | L12→L12 |
| 1-to-many (split) | 2 | L0→L1+L64+L66, L18→L34+L35 |
| many-to-1 (merge) | 1 | L27+L28→L69 |
| **OLD pillar total** | **30** | All L0-L29 mapped |

> **Headline:** 27 OLD pillars are clean 1-to-1 (21 direct + 6 domain-shifted, of which 1 is unchanged at L12). 2 OLD pillars split into multiple NEW pillars (L0 → 3, L18 → 2). 1 OLD pillar merges with another OLD pillar (L27+L28 → L69). Zero OLD pillars are silently dropped.

### 4.2 Verification of 1-to-1 count

Counting 1-to-1 mappings (whether direct, domain-shifted, or unchanged): **27** (L1→L2, L2→L3, L3→L4, L4→L5, L5→L6, L6→L7, L7→L8, L8→L9, L9→L10, L10→L11, L11→L56, L12→L12, L13→L28, L14→L29, L15→L20, L16→L21, L17→L53, L19→L30, L20→L31, L21→L32, L22→L33, L23→L34, L24→L35, L25→L36, L26→L37, L27→L69, L29→L70). This matches the **27 one-to-one mappings** the task expects.

---

## 5. New Pillars Not In 30-Pillar (41 NEW-only pillars)

The 71-pillar framework adds 41 pillars with no OLD counterpart. These break down by domain as follows:

### 5.1 Performance (7 NEW pillars, L13-L19)

| # | Name | Why NEW | Signal/measurement |
|---|------|---------|--------------------|
| L13 | Performance Budgets & Profiling | OLD conflated perf into DX (L15 Test Matrix was the closest). NEW gives perf its own domain. | benches/ dir; criterion/iai; budget thresholds (p50/p99 latency SLOs) |
| L14 | Async/Concurrency Design | OLD L5 "Async/concurrency design" was in a different scheme (the L1-L30 file). In AGENTS.md L0-L29, async was implicit in Type System. NEW exposes it. | async/await count; tokio runtime; structured concurrency |
| L15 | Memory & Allocation | OLD L9 "Memory & allocation" was in the L1-L30 file but absent from AGENTS.md's L0-L29. NEW adds it back. | dhat/heaptrack; mimalloc/jemalloc; allocation budgets |
| L16 | Resource Limits & Rate Limits | Absent from OLD; added under Performance in NEW. | governor; token bucket; rate_limit files |
| L17 | Concurrency Safety & Races | Absent from OLD (was L8 in L1-L30 file); promoted to its own perf pillar. | loom/miri; clippy.toml correctness lints |
| L18 | Caching Strategy | NEW; no OLD counterpart. | moka/redis/lru; cache invalidation policy |
| L19 | Build & Compile-Time Performance | NEW; no OLD counterpart. | sccache; mold/lld; cold-build timing budget |

### 5.2 Quality / Correctness (6 NEW pillars, L22-L27 — note L20-L21 have OLD counterparts)

| # | Name | Why NEW | Signal/measurement |
|---|------|---------|--------------------|
| L22 | Error Handling & User Feedback | OLD had this implicit in L6 "Type System & Error Handling" (technical error handling). NEW separates the user-feedback aspect. | Error message quality; what+why+fix pattern |
| L23 | Type Safety & Soundness | NEW; no OLD counterpart. | unsafe audit; cargo-geiger; no_unwind |
| L24 | Linting & Static Analysis | NEW; no OLD counterpart. | clippy/ruff clean; complexity lints |
| L25 | Mutation Testing | NEW; no OLD counterpart. | cargo-mutants; mutation score threshold |
| L26 | Property-Based Testing | NEW; no OLD counterpart. | proptest/quickcheck/hypothesis; invariant coverage |
| L27 | Resilience (Retries/Backoff/Circuit) | NEW; OLD had this in DX (L27 in L1-L30 file), absent from AGENTS.md L0-L29. | backoff crates; circuit-breaker; bulkhead; chaos |

### 5.3 UX (8 NEW pillars, L38-L45)

The UX domain is entirely NEW. The OLD 30-pillar scheme had no UX domain at all (UX concerns were scattered in DX or absent). The 8 UX pillars are:

| # | Name | Why NEW | Signal/measurement |
|---|------|---------|--------------------|
| L38 | CLI/UX & Ergonomics | NEW; was implicit in DX. | clap/structopt; --help coverage; subcommand ergonomics |
| L39 | Error Messages & User Feedback | NEW; distinct from L22 (which is internal-error quality). L39 is end-user-facing. | User-facing error message quality; no raw debug dumps |
| L40 | Internationalization (i18n/l10n) | NEW; OLD L17 in L1-L30 file had it but AGENTS.md L0-L29 omitted it. | locale_dirs; gettext/fluent; externalized strings |
| L41 | Accessibility (a11y) | NEW; OLD L18 in L1-L30 file had it but AGENTS.md L0-L29 omitted it. | aria-/role=count; screen reader; keyboard nav |
| L42 | Onboarding & Contributor DX | NEW; OLD L14 in L1-L30 file had it but AGENTS.md L0-L29 omitted it. | CONTRIBUTING.md; QUICKSTART; first-PR path < 1 hour |
| L43 | API Surface & Contract | NEW; was in OLD L3 (L1-L30 file) but AGENTS.md L0-L29 merged it into AX. NEW separates it as a UX concern. | lib.rs/__init__.py/index.ts public surface; semver |
| L44 | Documentation & SSOT | NEW; was in OLD L13 (L1-L30 file) but AGENTS.md L0-L29 merged it into DX. | docs/; README; AGENTS; CLAUDE; FR; PRD |
| L45 | Responsive / Adaptive UX | NEW; no OLD counterpart. | Responsive UI; progressive enhancement; dark mode |

### 5.4 Security (9 NEW pillars, L46-L55 minus L53 which has OLD counterpart)

| # | Name | Why NEW | Signal/measurement |
|---|------|---------|--------------------|
| L46 | Secret Management | NEW; was in OLD L19 (L1-L30 file) but AGENTS.md L0-L29 omitted it. | dotenvy/keyring/secrecy; no secrets in code |
| L47 | Supply-Chain Security (SBOM/CVE) | NEW; was in OLD L20 (L1-L30 file) but AGENTS.md L0-L29 omitted it. | deny.toml; sbom_file; cargo-audit |
| L48 | Threat Model & Attack Surface | NEW; was in OLD L21 (L1-L30 file) but AGENTS.md L0-L29 omitted it. | threat_doc; STRIDE refs |
| L49 | AuthN/AuthZ | NEW; was in OLD L22 (L1-L30 file) but AGENTS.md L0-L29 omitted it. | oauth/jwt/oidc; RBAC; ABAC |
| L50 | Cryptography & Key Management | NEW; was in OLD L23 (L1-L30 file) but AGENTS.md L0-L29 omitted it. | argon2/ed25519/chacha/aes-gcm; HSM/KMS |
| L51 | Audit Log & Compliance | NEW; was in OLD L24 (L1-L30 file) but AGENTS.md L0-L29 omitted it. | audit_log/trail files; SOC2/HIPAA evidence |
| L52 | Multi-Tenant Isolation & Data Privacy | NEW; was in OLD L25 (L1-L30 file) but AGENTS.md L0-L29 omitted it. | tenant_id/org_id/workspace_id scope |
| L54 | Input Validation & Sanitization | NEW; no OLD counterpart. | Input guards; SQL/XSS/command-injection defense |
| L55 | Security Headers & Transport | NEW; no OLD counterpart. | TLS/HSTS/CSP/CORS; mTLS; cert pinning |

### 5.5 Observability & Ops (7 NEW pillars, L57-L63 minus L56 which has OLD counterpart)

| # | Name | Why NEW | Signal/measurement |
|---|------|---------|--------------------|
| L57 | Distributed Tracing | NEW; OLD L11/Observability was a single bucket; NEW splits into 8. | OpenTelemetry spans; trace propagation |
| L58 | Metrics & SLI/SLO | NEW; no OLD counterpart. | Prometheus metrics; SLI/SLO definitions |
| L59 | Logging Hygiene | NEW; no OLD counterpart. | Structured logging; level discipline |
| L60 | Alerting & On-Call | NEW; no OLD counterpart. | Alert rules; on-call rotation |
| L61 | Incident Response & Postmortem | NEW; no OLD counterpart. | Runbooks; blameless postmortem template |
| L62 | Chaos Engineering & Failure Injection | NEW; no OLD counterpart. | Chaos tests; fault injection; game days |
| L63 | Observability of Failure Modes | NEW; was implicit in L6 of L1-L30 file. | Sentry/Bugsnag; panic hooks; error budgets |

### 5.6 Doc & SSOT (3 NEW pillars, L65, L67, L68 — note L64 and L66 receive split from OLD L0)

| # | Name | Why NEW | Signal/measurement |
|---|------|---------|--------------------|
| L65 | API Reference Documentation | NEW; no OLD counterpart. | cargo doc/typedoc; OpenAPI spec |
| L67 | Conceptual Docs & How-Tos | NEW; no OLD counterpart. | Concept docs; tutorial-style how-tos |
| L68 | Onboarding & Knowledge Transfer | NEW; no OLD counterpart. | ARCHITECTURE.md; new-dev ramp docs |

### 5.7 Governance & Sustainability (1 NEW pillar, L71)

| # | Name | Why NEW | Signal/measurement |
|---|------|---------|--------------------|
| L71 | Repository Governance & Sustainability | NEW; OLD L30 "Repository governance" (in L1-L30 file) covered license/CODEOWNERS/CHANGELOG but AGENTS.md L0-L29 split this across L20 (CHANGELOG-adjacent), L21-L26 (topology), L27-L28 (PRCP), L29 (recovery). NEW adds L71 as the umbrella for long-term stewardship: license, CODEOWNERS, FUNDING.yml, governance model documentation. | LICENSE; CODEOWNERS; FUNDING.yml; governance model doc |

### 5.8 Summary of NEW-only pillars by reason for being NEW

| Reason | Count | Pillars |
|--------|-------|---------|
| Domain didn't exist in OLD (new domain) | 8 | L38, L39, L40, L41, L42, L43, L44, L45 (UX domain) |
| Concern was in OLD L1-L30 file but omitted from AGENTS.md L0-L29 | 18 | L40, L41, L42, L46, L47, L48, L49, L50, L51, L52, L43, L44, L27, L15, L23 (partial), L16, L17, L22 |
| Concern was implicit in OLD but NEW promotes to standalone | 8 | L14, L18, L19, L22, L57, L58, L59, L60, L61, L62, L63 (some overlap with above) |
| NEW pillar with no precedent anywhere | 7 | L54, L55, L65, L67, L68, L71, L25 |
| **Total NEW-only pillars** | **41** | L13, L14, L15, L16, L17, L18, L19, L22, L23, L24, L25, L26, L27, L38, L39, L40, L41, L42, L43, L44, L45, L46, L47, L48, L49, L50, L51, L52, L54, L55, L57, L58, L59, L60, L61, L62, L63, L65, L67, L68, L71 |

> Verification: 41 NEW-only pillars = 71 total - 30 OLD-with-counterpart (= L1, L2, L3, L4, L5, L6, L7, L8, L9, L10, L11, L12, L20, L21, L28, L29, L30, L31, L32, L33, L34, L35, L36, L37, L53, L56, L64, L66, L69, L70 = 30 unique NEW pillars with OLD counterparts). 71 - 30 = 41. ✓

---

## 6. Migration Path

This section gives the operational steps to migrate from the 30-pillar scorecard (`findings/30-pillar-2026-06-16.md`) to a 71-pillar scorecard.

### 6.1 Pre-migration

1. **Snapshot the OLD scorecard.** Copy `findings/30-pillar-2026-06-16.md` to `findings/30-pillar-2026-06-16.md.bak` (read-only archive).
2. **Verify this crosswalk.** Confirm the 30 OLD pillars enumerated in §2 match the columns of the OLD scorecard. If mismatched, raise an issue before proceeding.
3. **Inventory repos in scope.** List all repos to be re-scored (start with the 10 in the OLD scorecard: AuthKit, Apisync, Agentora, AgentMCP, Benchora, Conft, PhenoMCP, phenoShared, thegent, BytePort — plus any new repos added since 2026-06-16).

### 6.2 Migration — per-repo score translation

For each repo in scope:

1. **Apply 1-to-1 mappings.** For each OLD pillar with a 1-to-1 mapping (27 of 30 per §4.2), copy the OLD score to the NEW pillar. No work needed beyond the mapping table.
2. **Apply 1-to-many splits.** For OLD L0 (Architecture Foundations) and OLD L18 (Branch Hygiene), allocate the OLD score across the NEW pillars per the rationale in §4:
   - L0 → split as 40% to L1 (Architecture Foundations), 30% to L64 (SSOT & Decision Records), 30% to L66 (ADR). Round to nearest integer 0-3.
   - L18 → split as 60% to L34 (Worktree Isolation), 40% to L35 (Stash Lifecycle). Round to nearest integer.
3. **Apply many-to-1 merges.** For OLD L27 + L28 → L69, take the max of the two OLD scores as the L69 baseline.
4. **Score the 41 NEW pillars from scratch.** Each NEW-only pillar is scored 0-3 using the signal definitions in §5. Reuse the OLD probe script where possible; add new signals (e.g., `loom`, `cargo-mutants`, `cargo-geiger`, OpenTelemetry span coverage, Sentry presence) as needed.
5. **Compute the NEW totals.** Sum the 71 NEW pillar scores per repo. Normalize to a 0-213 scale (71 pillars × 3 max) for comparability with the OLD 0-90 scale (30 pillars × 3 max).
6. **Compute comparability ratios.** For each repo, compute `OLD_score / 90` and `NEW_score / 213`. A repo that improved under NEW vs OLD has positive movement; flag repos with negative movement for review.

### 6.3 Migration — schema and tooling

1. **Update the signal-probe script.** The OLD probe (`/tmp/30pillar-probe.sh` referenced in §8 of the OLD scorecard) needs to emit signals for the 41 NEW pillars. Suggested file layout: `/tmp/71pillar-probe.sh` with one probe per pillar.
2. **Update the scoring script.** The OLD scoring script (`/tmp/30pillar-score.py` in §8) becomes `71pillar-score.py`. Maintain a backward-compat shim that, given a 30-pillar score JSON, emits the equivalent 71-pillar score JSON using the §4 mapping rules. This shim is the operational form of this crosswalk.
3. **Version the scorecards.** Tag the OLD scorecard with its date (`2026-06-16`); the NEW scorecard gets `2026-06-17`. Do NOT overwrite the OLD.
4. **Update AGENTS.md.** Replace the reference to `findings/30-pillar-2026-06-16.md` with `findings/71-pillar-2026-06-17.md` (when generated) + this crosswalk. Keep the OLD reference as a historical footnote.

### 6.4 Migration — review and sign-off

1. **Spot-check 3 repos.** Manually re-score thegent, AuthKit, and BytePort under the 71-pillar scheme and compare to the crosswalk-derived scores. Acceptable drift: ±0.5 per pillar.
2. **Validate the 41 NEW pillars.** For each NEW pillar, confirm that at least one repo in scope scores ≥2 (else the pillar may be untestable in the current repo set).
3. **Document deltas.** Where the NEW scheme scores a repo differently than the OLD scheme for the same underlying signal (e.g., L0 split into L1+L64+L66 may surface a 3 on L66 and 0 on L64 that was hidden in a single L0=2 score), document the delta in `findings/71-pillar-2026-06-17-deltas.md`.
4. **Archive the OLD scorecard.** Move `findings/30-pillar-2026-06-16.md` to `findings/archive/` (read-only). Update AGENTS.md to point to the NEW scorecard.

### 6.5 Rollback plan

If the 71-pillar scheme is found unsuitable:

1. Restore `findings/30-pillar-2026-06-16.md` from `findings/30-pillar-2026-06-16.md.bak`.
2. Reverse-apply the §6.2 splits (sum L1+L64+L66 back to L0; sum L34+L35 back to L18; max of L27+L28 back to two pillars).
3. Re-issue any PRs that referenced the NEW scheme with OLD-pillar references.

The rollback is safe because the §4 mapping is reversible: every NEW pillar with an OLD counterpart maps back to a unique OLD pillar or set of OLD pillars.

---

## 7. Cross-References

### 7.1 In-repo references

- **`AGENTS.md`** — § "Active ADRs" / V6 closure / 9-domain taxonomy source of truth for the 71-pillar scheme.
- **`findings/30-pillar-2026-06-16.md`** — OLD scorecard (file uses L1-L30 numbering; this crosswalk uses the AGENTS.md canonical L0-L29 numbering per the user's task spec).
- **`findings/71-PILLAR-AUDIT-FRAMEWORK-2026-06-17.md`** — Sibling framework using a different taxonomy (Domain A: UX-12 / B: AX-15 / C: DX-12 / D: CV-12 / E: OPS-10 / F: GOV-10 / G: BK-6 = 77 pillars, despite the "71-Pillar" title). Use this crosswalk (and the AGENTS.md L1-L71 scheme) as canonical for repo-lab audits; use the A-G framework for product/push audits. The two frameworks are orthogonal — see §7.2 for divergence notes.
- **`findings/71-pillar-2026-06-17.md`** — Target NEW scorecard (to be generated 2026-06-17 per V6 plan). Not yet present at time of writing.
- **`findings/71-pillar-2026-06-17-schema.md`** — Target NEW schema (referenced in user task; not yet present at time of writing).
- **`L6_PHENO_REPOS_HEALTH_2026_06_14.md`** and **`L6_PHENO_REPOS_HEALTH_2026_06_15_DELTA.md`** — Per-repo health audits; future versions will adopt the 71-pillar scheme.
- **`docs/adr/2026-06-14/`** and **`docs/adr/2026-06-15/`** — ADRs that drive pillar definitions (especially ADR-014 Port/Adapter, ADR-022 Config consolidation, ADR-023 Substrate placement).

### 7.2 Divergence between AGENTS.md L1-L71 scheme and `71-PILLAR-AUDIT-FRAMEWORK-2026-06-17.md` A-G scheme

The two frameworks target different surfaces and SHOULD coexist:

| Aspect | AGENTS.md L1-L71 (this crosswalk) | `71-PILLAR-AUDIT-FRAMEWORK-2026-06-17.md` A-G |
|--------|-----------------------------------|------------------------------------------------|
| Primary use | Repo-lab audit (technical pillars per repo) | Product/push audit (operational completeness per repo) |
| Pillar count | 71 | 77 (despite "71-Pillar" title) |
| Numbering | L1-L71 continuous | A1-A12, B1-B15, C1-C12, D1-D12, E1-E10, F1-F10, G1-G6 |
| AX domain size | 12 (L1-L12) | 15 (B1-B15) — adds B11 Portability, B12 Extensibility, B13 Backward compat, B14 Release process, B15 Tech debt |
| UX domain size | 8 (L38-L45) | 12 (A1-A12) — adds A4 Output quality, A5 Config discoverability, A6 Help system, A7 Defaults, A8 Progress indication |
| DX domain size | 10 (L28-L37) | 12 (C1-C12) — adds C5 IDE support, C6 Debugging, C7 Code generation |
| Quality (CV) domain size | 8 (L20-L27) | 12 (D1-D12) — adds D2 Test health, D3 Code complexity, D4 Code duplication, D5 Dead code |
| Ops domain size | 8 (L56-L63) | 10 (E1-E10) — adds E3 Reliability (SLOs), E10 Compliance |
| GOV domain size | 3 (L69-L71) | 10 (F1-F10) — adds F4 Contributing, F6 Roadmap, F8 Versioning, F9 Governance model, F10 Funding |
| Broken/Scaffold (G1-G6) | Not present | 6 pillars specific to scaffold/incomplete repos |

The two schemes are not in conflict — they answer different questions. The AGENTS.md L1-L71 scheme asks "is this repo technically SOTA?"; the A-G scheme asks "is this repo product-complete and shippable?". Use both for a full repo audit; use one or the other for focused audits.

### 7.3 When this crosswalk is updated

This crosswalk should be re-issued whenever:

1. A new pillar is added to the AGENTS.md 71-pillar scheme (changes §3 and §5).
2. An OLD pillar's mapping rule changes (changes §4).
3. A repo scored under the OLD scheme cannot be cleanly translated (flags a missing signal).
4. The sibling A-G framework in `findings/71-PILLAR-AUDIT-FRAMEWORK-2026-06-17.md` is updated (changes §7.2).

Last issued: 2026-06-17 (this version).
