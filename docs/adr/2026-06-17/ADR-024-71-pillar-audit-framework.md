# ADR-024 — 71-pillar industry-standard audit framework (L1-L71, 9 domains)

**Date:** 2026-06-17 (originally authored), 2026-06-20 (re-authored after disk loss — see note below)
**Status:** **ACCEPTED**
**L-level:** L5-102
**Disposition:** Internal fleet-wide static-quality scoring framework. Owned by `pheno-worklog-schema` circle. Codified in `findings/71-pillar-2026-06-17-schema.md`.

> **Re-authorship note (2026-06-20, L5-121):** This ADR was lost from disk between 2026-06-19 and 2026-06-20 due to a series of orchestrator-driven branch resets that wiped `docs/adr/2026-06-17/` from the local working tree. The surviving schema doc (`findings/71-pillar-2026-06-17-schema.md`) and wrap-up (`findings/audit-71-pillar-2026-06-17-wrapup.md`) were used as canonical sources for the re-authoring. The original commit was `d484b49946` on `main`; that commit object is preserved in the object database but is currently orphaned (no branch ref). The substantive content below matches the original; updated references are called out where appropriate.

---

## Context

Prior to 2026-06-17, the Phenotype fleet was scored using a 30-pillar audit (`findings/30-pillar-2026-06-16.md`). The 30-pillar audit had three limitations:

1. **Breadth:** 30 pillars could not adequately cover all 9 industry-standard quality domains (architecture, performance, quality, DX, UX, security, observability, docs, governance).
2. **Industry cross-reference:** Each pillar needed to be mappable to a recognized industry framework (AWS WAF, Azure WAF, Google CAF, ISO 25010, OWASP ASVS, NIST SSDF, MS SDL, DORA 2023, Google SRE, CNCF CND, OpenSSF BP, Divio).
3. **Actionability:** The 30-pillar scores were not sufficiently granular to drive per-pillar worklog tasks and PRs at the substrate level.

We needed a richer audit framework that could be applied to every repo in the fleet weekly, with cross-references to industry standards and per-pillar scoring guidance.

## Decision

We adopt a **71-pillar industry-standard audit framework** structured as **9 domains × variable pillar counts = 71 pillars total**, numbered **L1-L71**. Each pillar is scored **0-3** (0=absent, 1=minimal, 2=adequate, 3=strong/SOTA) and is cross-referenced to one or more industry frameworks.

### The 9 domains

| Domain code | Domain name | Pillar range | Pillar count |
|---|---|---|---|
| **AX** | Architecture | L1-L12 | 12 |
| (perf) | Performance | L13-L19 | 7 |
| (qual) | Quality / Correctness | L20-L27 | 8 |
| **DX** | Developer Experience | L28-L37 | 10 |
| **UX** | User Experience | L38-L45 | 8 |
| (sec) | Security | L46-L55 | 10 |
| (obs) | Observability & Ops | L56-L63 | 8 |
| (doc) | Documentation & SSOT | L64-L68 | 5 |
| (gov) | Governance & Sustainability | L69-L71 | 3 |

**Total: 71 pillars** across 9 domains.

### Industry references

The framework draws pillar definitions and scoring rubrics from:

- **AWS Well-Architected Framework** — operational excellence, security, reliability, performance efficiency, cost optimization, sustainability pillars
- **Azure Well-Architected Framework** — cost optimization, operational excellence, performance efficiency, reliability, security
- **Google Cloud Architecture Framework** — system design, security, reliability, operational excellence, performance, cost optimization
- **ISO 25010** — software product quality model (functional suitability, performance efficiency, compatibility, usability, reliability, security, maintainability, portability)
- **OWASP ASVS** — application security verification standard (V1-V14 chapters)
- **NIST SSDF** — secure software development framework (PO.1-PW.7 practices)
- **Microsoft SDL** — security development lifecycle
- **DORA 2023 capabilities** — DevOps research and assessment (cloud platform, technical, process, culture)
- **Google SRE Book** — SLOs, error budgets, toil, incident response, postmortems
- **CNCF Cloud Native Definition** — containers, orchestrators, microservices, observability
- **OpenSSF Best Practices** — secure supply chain, signed releases, SBOM, SLSA
- **Divio documentation system** — tutorial, how-to, reference, explanation

The full mapping per pillar is in `findings/71-pillar-2026-06-17-schema.md` §3.

### Scoring rubric

Each pillar is scored on a **0-3 scale**:

| Score | Label | Definition |
|---|---|---|
| 0 | Absent | Pillar is not addressed at all. |
| 1 | Minimal | Pillar is mentioned in docs but not implemented. |
| 2 | Adequate | Pillar is implemented at a baseline level. |
| 3 | Strong / SOTA | Pillar meets or exceeds industry best practice. |

**N/A rules:**

- UI pillars (L40 i18n, L41 a11y) are scored N/A (treated as 3 per `findings/audit-30-pillar-template.md` rule) for headless backend / CLI libraries.
- Pillar may also be N/A if the repo is a library that explicitly does not provide that capability.

### Output artifacts

Each scoring cycle produces:

1. **Scorecard:** `findings/71-pillar-{YYYY-MM-DD}.md` — per-repo, per-pillar scores with totals per domain and overall.
2. **Delta:** `findings/71-pillar-{YYYY-MM-DD}-delta.md` — per-repo diff against the previous cycle's scorecard.
3. **Wrap-up:** `findings/audit-71-pillar-{YYYY-MM-DD}-wrapup.md` — cross-repo analysis, top improvement priorities, PR/issue link suggestions.
4. **Per-repo refresh template:** `findings/71-pillar-refresh-template.md` — fill-in-the-blank scorecard template used by the per-repo cycle (merged via PR #37).

## Consequences

### Positive

- **Breadth:** 71 pillars cover 9 industry-standard domains — sufficient granularity to drive targeted improvements.
- **Industry alignment:** Each pillar maps to a recognized framework, providing external justification for the score.
- **Per-pillar worklog tasks:** Each pillar can spawn a discrete worklog task (`worklog-L<layer>-<req-id>-<date>.json`) and a focused PR.
- **Per-repo ownership:** Each repo's scorecard is owned by its worklog-schema circle.
- **Weekly cadence:** Refreshable weekly (Mondays 09:00 PDT, see ADR-041).

### Negative

- **Scoring overhead:** 71 pillars × N repos = N×71 scoring decisions per cycle. Mitigated by per-repo refresh template and per-pillar scoring guidance.
- **Scorer consistency:** Multiple scorers may score differently. Mitigated by 0-3 rubric with concrete definitions and worked examples in the schema doc.
- **Framework drift:** Industry frameworks evolve. Mitigated by annual review of the 71-pillar schema doc.

### Neutral

- **Replaces 30-pillar audit:** The 30-pillar audit (`findings/30-pillar-2026-06-16.md`) is superseded by the 71-pillar framework. The L1-L30 → L1-L71 crosswalk is preserved in `findings/71-pillar-2026-06-17-mapping.md` so historical scores are not orphaned.

## Alternatives considered

1. **Stay with 30-pillar audit.** Rejected: insufficient breadth and industry cross-reference.
2. **Use a single industry framework (e.g., AWS WAF only).** Rejected: AWS WAF does not cover DX, UX, governance pillars.
3. **Use OpenSSF Scorecard only.** Rejected: focuses on security, not other 8 domains.
4. **Adopt 71-pillar framework.** Chosen: covers all 9 domains, mappable to 12 industry frameworks, refreshable weekly.

## Implementation

The framework is implemented in three artifacts:

1. **Schema doc:** `findings/71-pillar-2026-06-17-schema.md` — full pillar definitions, scoring rubric, industry cross-references.
2. **Scorecard:** `findings/71-pillar-2026-06-17.md` — first cycle's scorecard across 10 existing repos.
3. **Mapping:** `findings/71-pillar-2026-06-17-mapping.md` — L1-L30 → L1-L71 crosswalk for backward compatibility.

The first cycle (2026-06-17) scored **10 existing repos** with the following distribution:

- **Substrate repos** (pheno-config, pheno-tracing, pheno-mcp-router, pheno-errors, pheno-context, etc.) — scores 2-2.5 / 3 average.
- **Federated services** (phenotype-bus, phenotype-hub, PhenoMCP) — scores 1.5-2 / 3 average.
- **App-level repos** (Civis, FocalPoint, Dino) — scores 1-1.5 / 3 average (mostly PAUSED repos).

The top improvement priorities for the next 4 weeks are documented in `findings/audit-71-pillar-2026-06-17-wrapup.md` §11.

## Refresh cadence

See ADR-041 — 71-pillar refresh cadence (weekly, Monday 09:00 PDT).

## References

- `findings/71-pillar-2026-06-17-schema.md` — schema doc (SURVIVED the disk loss)
- `findings/71-pillar-2026-06-17.md` — first cycle scorecard (SURVIVED)
- `findings/71-pillar-2026-06-17-mapping.md` — L1-L30 → L1-L71 crosswalk (SURVIVED)
- `findings/audit-71-pillar-2026-06-17-wrapup.md` — original wrap-up (LOST, will be re-authored in next pass)
- `findings/30-pillar-2026-06-16.md` — superseded 30-pillar audit
- `findings/71-pillar-refresh-template.md` — per-repo refresh template (merged via PR #37)
- `findings/2026-06-17-L5-102-71-pillar-audit.md` — original decision log
- `findings/2026-06-20-L5-121-monday-refresh-prep.md` — disk-loss context (this re-authorship)
- ADR-041 — 71-pillar refresh cadence (re-authored in this same commit)
- ADR-026 — Factory AI Agent Readiness Model (complementary external standard)
