# ADR Index - Chronological Cross-Reference

**Generated:** 2026-06-21 22:45 UTC  
**Source:** 37 ADR file(s) under `docs/adr/`  
**Generator:** `scripts/adr_index_gen.py` (v20 T1)  
**Pillar-grouped view:** `docs/adr/INDEX-by-pillar.md` (hand-curated)  
**Backlink validator:** `scripts/adr_backlink_check.py`  

## Master Table

| # | ADR | Date | Status | Title | Scope summary | Supersedes |
|---:|-----|------|--------|-------|---------------|------------|
| 006 | [006](docs/adr/ADR-006-Circuit-Breaker.md) |  | UNKNOWN | Circuit Breaker Pattern for Provider Resilience | Kogito acts as a gateway to multiple LLM providers (Claude, OpenAI, Gemini, etc.). These providers occasionally experience outages, rate limiting, or degraded performance. Without proper protection, a | - |
| 007 | [007](docs/adr/ADR-007-Semantic-Caching.md) |  | UNKNOWN | Redis-Driven Semantic Caching Architecture | LLM API calls are expensive, with costs ranging from $0.01 to $0.25 per 1K tokens depending on model and provider. Analysis of production traffic shows: | - |
| 008 | [008](docs/adr/ADR-008-Multi-Platform-Deployment.md) |  | UNKNOWN | Multi-Platform Deployment Strategy | Kogito must support diverse deployment scenarios: | - |
| 015 | [015](docs/adr/2026-06-20/ADR-015-v2.1-worklog-schema.md) |  | UNKNOWN | v2.1: Worklog Schema Bump (11th `device:` column) | ADR-015 v2.0 (10-column schema) lacks a `device:` field. Per the L5-104 | - |
| 023 | [023](docs/adr/2026-06-15/ADR-023-agent-effort-governance.md) |  | UNKNOWN | Agent-effort governance (device-fit + dogfood + substrate) | The Phenotype fleet is ~50+ sub-repos in a sparse-checkout monorepo. Three | - |
| 024 | [024](docs/adr/2026-06-17/ADR-024-71-pillar-audit-framework.md) |  | UNKNOWN | 71-pillar industry-standard audit framework (L1-L71, 9 domains) | Prior to 2026-06-17, the Phenotype fleet was scored using a 30-pillar audit (`findings/30-pillar-2026-06-16.md`). The 30-pillar audit had three limitations: | - |
| 025 | [025](docs/adr/2026-06-17/ADR-025-worklog-v2-1-device-column.md) |  | UNKNOWN | Worklog schema v2.1 — add `device:` column (11th column) | ADR-015 (2026-06-15) defined the v2 10-column WORKLOG.md schema. ADR-023 (also 2026-06-15) introduced the **device-fit gate** (Rule 1): worklogs must record `device: macbook` vs `device: heavy-runner` | - |
| 026 | [026](docs/adr/2026-06-17/ADR-026-factory-ai-agent-readiness.md) |  | UNKNOWN | Factory AI Agent Readiness Model as cross-cutting external standard | The 71-pillar (ADR-024) measures **breadth** across 9 domains (71 pillars). The Factory AI Agent Readiness Model is an industry-standard **5-level gated progression** (Functional → Documented → Standa | - |
| 027 | [027](docs/adr/2026-06-17/ADR-027-git-lfs-strategy.md) |  | UNKNOWN | Git LFS 3-tier strategy (iOS binary framework handling) | The monorepo (`repos/`) contains iOS Simulator binary frameworks that exceed GitHub's 100 MB file-size limit. These must be stored via Git LFS (Large File Storage) — but the local LFS cache is incompl | - |
| 028 | [028](docs/adr/2026-06-17/ADR-028-monorepo-architecture-eval.md) |  | UNKNOWN | Monorepo architecture evaluation — keep-monorepo + hybrid-staging-repo | The 2026-06-17 wrap-up (`audit-71-pillar-2026-06-17-wrapup.md` § 6.1) stranded **3 governance commits** in the monorepo at `repos/` because no `KooshaPari/repos` exists, the `argis` remote has diverge | - |
| 029 | [029](docs/adr/2026-06-17/ADR-029-dmouse92-to-kooshapari.md) |  | UNKNOWN | Dmouse92 → KooshaPari migration — absorb all DM92 work to substrate, archive emp | Two parallel git-account sources exist for the Phenotype fleet: | - |
| 030 | [030](docs/adr/2026-06-17/ADR-030-spine-repos-readonly.md) |  | UNKNOWN | Spine repos are read-only references (Decision D) | Five repos serve as "spine" (cross-cutting pattern sources) for the Phenotype fleet: | - |
| 031 | [031](docs/adr/2026-06-17/ADR-031-configra-absorb.md) |  | UNKNOWN | Configra as canonical config repo name (supersedes ADR-022 naming split) | Three repos have the word "config" in their name on KooshaPari: | - |
| 032 | [032](docs/adr/2026-06-17/ADR-032-pheno-worklog-schema-decision.md) |  | UNKNOWN | pheno-worklog-schema is NOT a re-implementation of AgilePlus worklog | User flagged: "pheno worklog also seems like you are reimplementing agileplus, unless this is a subcomponent/primitive lib?" | - |
| 033 | [033](docs/adr/2026-06-17/ADR-033-phenotype-monorepo-state-deletion.md) |  | UNKNOWN | Delete `KooshaPari/phenotype-monorepo-state` (it duplicates monorepo governance) | User flagged: "phenotype monorepo... should not exist. again we only lightly use the federated handbook, specs, registry and other spine repos." | - |
| 034 | [034](docs/adr/2026-06-17/ADR-034-monorepo-state-deletion-schedule.md) |  | UNKNOWN | Schedule `KooshaPari/phenotype-monorepo-state` deletion (after ADR-033) | ADR-033 decided to delete `KooshaPari/phenotype-monorepo-state`. This ADR | - |
| 035 | [035](docs/adr/2026-06-18/ADR-035-configra-migration-gates.md) |  | UNKNOWN | Configra migration gates | Per ADR-031, `KooshaPari/Configra` is the canonical Rust config substrate. 8 source repos must be absorbed into it: | - |
| 036 | [036](docs/adr/2026-06-18/ADR-036-pheno-tracing-substrate-canonical.md) |  | UNKNOWN | `pheno-tracing` is the canonical OTLP/tracing substrate | `KooshaPari/pheno-tracing` is a Rust crate providing OTLP-exporting tracing setup. Prior adoption was uneven: | - |
| 037 | [037](docs/adr/2026-06-18/ADR-037-pheno-mcp-router-substrate-canonical.md) |  | UNKNOWN | `pheno-mcp-router` is the canonical MCP substrate | `KooshaPari/pheno-mcp-router` is the canonical MCP substrate for the Phenotype fleet. Prior ADRs (013, 029) absorbed dispatch-mcp, LlamaAdapter, OpenAICompatAdapter from Dmouse92/dispatch-mcp (3 PRs m | - |
| 038 | [038](docs/adr/2026-06-18/ADR-038-hexagonal-port-adapter-l4-policy.md) |  | UNKNOWN | Hexagonal L4 Port/Adapter pattern is the canonical substrate interface | ADR-014 (v5 SOTA sweep) introduced the hexagonal L4 Port/Adapter pattern for substrate: each substrate crate exposes a `Port` trait (interface) and ships with concrete `Adapter` impls (in-tree) plus a | - |
| 039 | [039](docs/adr/2026-06-18/ADR-039-pheno-flake-refresh-template.md) |  | UNKNOWN | Pheno-flake refresh template for substrate repos | 22 pheno-* substrate repos + 13 phenotype-*-sdk repos = 35 substrate repos. Each has unique CI, test matrix, coverage gate, and meta-bundle (AGENTS.md + llms.txt + WORKLOG.md + CHANGELOG.md + LICENSE- | - |
| 040 | [040](docs/adr/2026-06-18/ADR-040-test-coverage-gates-per-tier.md) |  | UNKNOWN | Test coverage gates per substrate tier | ADR-023 Rule 3.1 sets coverage gates per substrate tier: | - |
| 041 | [041](docs/adr/2026-06-18/ADR-041-71-pillar-refresh-cadence.md) |  | UNKNOWN | 71-pillar refresh cadence (weekly, Monday 09:00 PDT) | The 71-pillar audit framework (ADR-024) needs to be refreshed regularly to remain useful: | - |
| 046 | [046](docs/adr/2026-06-18/ADR-046-federation-mtls-oidc.md) |  | UNKNOWN | Federation mTLS + OIDC | The Phenotype fleet is **federating**: at v19 cycle 9 closure, 9 federated services (`phenoMCP`, `phenoObservability`, `phenoEvents`, etc.) are deployed across at least 3 trust boundaries (the public  | - |
| 048 | [048](docs/adr/2026-06-18/ADR-048-substrate-graduation-path.md) |  | UNKNOWN | Substrate Graduation Path (4-tier gate table) | The fleet has 5 fleet-critical substrates (`pheno-config`, `pheno-tracing`, `pheno-mcp-router`, `pheno-errors`, `pheno-port-adapter`) and 6 supporting substrates (`pheno-context`, `pheno-flags`, `phen | - |
| 050 | [050](docs/adr/2026-06-19/ADR-050-t12-monorepo-state-deletion-complete.md) |  | UNKNOWN | T12 closure: `phenotype-monorepo-state` deletion COMPLETE | Per the v8 closure plan (`plans/2026-06-17-v7-dag-stable.md` Track 12 and | - |
| 050 | [050](docs/adr/2026-06-20/ADR-050-router-rebuild.md) |  | UNKNOWN | Router rebuild: Option B (Bifrost as transport library + Phenotype-owned decisio | The Phenotype fleet currently routes LLM traffic through `bifrost-extensions` | - |
| 051 | [051](docs/adr/2026-06-20/ADR-051-bifrost-as-library.md) |  | UNKNOWN | Bifrost as library, not wrapper | `bifrost-extensions` (`KooshaPari/bifrost-extensions`; local mirror | - |
| 052 | [052](docs/adr/2026-06-20/ADR-052-plugin-sdk-spec.md) |  | UNKNOWN | Router plugin SDK spec | The Phenotype router currently has 9 plugins (`intelligentrouter`, | - |
| 076 | [076](docs/adr/2026-06-20/ADR-076-v12-closure.md) |  | UNKNOWN | v12 Closure — 71-Pillar P0 Remediation Cycle 1 | The 71-pillar audit cycle 1 (2026-06-22) revealed 4 pillars (L31, L57, L65, L67) consistently below the 2.0 threshold across the 7 nested fleet repos (`pheno-flags`, `pheno-port-adapter`, `pheno-traci | - |
| 077 | [077](docs/adr/2026-06-20/ADR-077-slsa-l3-provenance.md) |  | UNKNOWN | SLSA L3 Provenance for Parent Monorepo | The 71-pillar cycle-3 audit (`findings/2026-06-20-71-pillar-cycle-3-probe.md`) | - |
| 077 | [077](docs/adr/2026-06-21/ADR-077-vault-migration-roadmap.md) | 2026-06-21 | PROPOSED | Vault Migration Roadmap (L50 Implementation Plan) |  | None (companion to `ADR-077-secrets-vault-migration-roadmap. |
| 078 | [078](docs/adr/2026-06-20/ADR-078-cosign-keyless-signing.md) |  | UNKNOWN | Cosign Keyless Signing for Release Artifacts (L25 P0 closure) | The 71-pillar audit cycle 3 (2026-06-20) scored **L25 (Supply-Chain | - |
| 078 | [078](docs/adr/2026-06-21/ADR-078-encryption-at-rest-mandate.md) | 2026-06-21 | PROPOSED | Encryption-at-Rest Mandate (L52) |  | None (first encryption-at-rest ADR) \| |
| 079 | [079](docs/adr/2026-06-21/ADR-079-oidc-federation-reference.md) |  | UNKNOWN | OIDC Federation Reference Implementation (L54) | The fleet has multiple substrate services (router, observability, mcp-router, registry) that need to authenticate calls from peer services and from external clients. ADR-046 (L5-111) committed to mTLS | - |
| 080 | [080](docs/adr/2026-06-21/ADR-080-pen-test-bug-bounty-roadmap.md) | 2026-06-21 | PROPOSED | Pen Test + Bug Bounty Roadmap (L53) |  | None (first pen-test + bounty ADR) \| |
| 080 | [080](docs/adr/2026-06-21/ADR-080-pen-test-bug-bounty.md) |  | UNKNOWN | Penetration Test + Bug Bounty Roadmap | The Phenotype fleet reached P0 saturation at 47/47 pillars in v18, with full FedRAMP/IL5/SOC2 readiness gap list documented. v19 T5 closes the operational side of incident response with a pen-test cad | - |

---

## Notes

- This file is **auto-generated** by `scripts/adr_index_gen.py`. Do not edit by hand; the `adr-lint` CI workflow fails if it drifts from the on-disk ADRs.
- The hand-curated **pillar-grouped** view lives at `docs/adr/INDEX-by-pillar.md` (per ADR-024 + ADR-041; cadence: weekly Mon 09:00 PDT).
- ADR numbers may collide across date directories (e.g. ADR-077 in `2026-06-20/` is SLSA, ADR-077 in `2026-06-21/` is Vault). Disambiguation is by file path.
- Cross-references in ADR bodies are validated by `scripts/adr_backlink_check.py` (run on every ADR-touching PR).

<!-- generated: 2026-06-21 22:45 UTC by scripts/adr_index_gen.py -->
