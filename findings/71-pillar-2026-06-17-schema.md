# 71-Pillar Audit Schema (Canonical Reference)

**Date:** 2026-06-17
**Version:** 1.0
**Status:** ACTIVE — canonical reference; supersedes the 30-pillar framework (preserved as L1-L30 in `audit-30-pillar-2026-06-16.md`)
**Owner:** worklog-schema circle
**Decided by:** ADR-024 (L5-102, 2026-06-17, accepted)
**Audience:** Phenotype bloc (AgilePlus, PhenoCompose, PlayCua, BytePort, nanovms, dispatch-mcp, pheno-* crates, phenotype-* SDKs, federated services) and the worklog-schema circle
**Companion files:**
- `findings/71-pillar-2026-06-17.md` — live scorecard (weekly refresh)
- `findings/71-pillar-2026-06-17-mapping.md` — L1-L30 (30-pillar) → L1-L71 crosswalk
- `findings/71-pillar-{date}-delta.md` — week-over-week diff
- `audit-71-pillar-2026-06-17-wrapup.md` — first wrap-up audit scored against the 71 pillars
- `audit-30-pillar-2026-06-16.md` — prior 30-pillar audit (preserved as L1-L30 in the new numbering)

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Industry References & Crosswalk](#2-industry-references--crosswalk)
3. [The 71 Pillars](#3-the-71-pillars)
   - [3.1 Architecture (AX) — L1-L12](#31-architecture-ax--l1-l12-12-pillars)
   - [3.2 Performance — L13-L19](#32-performance--l13-l19-7-pillars)
   - [3.3 Quality / Correctness — L20-L27](#33-quality--correctness--l20-l27-8-pillars)
   - [3.4 Developer Experience (DX) — L28-L37](#34-developer-experience-dx--l28-l37-10-pillars)
   - [3.5 User Experience (UX) — L38-L45](#35-user-experience-ux--l38-l45-8-pillars)
   - [3.6 Security — L46-L55](#36-security--l46-l55-10-pillars)
   - [3.7 Observability & Ops — L56-L63](#37-observability--ops--l56-l63-8-pillars)
   - [3.8 Documentation & SSOT — L64-L68](#38-documentation--ssot--l64-l68-5-pillars)
   - [3.9 Governance & Sustainability — L69-L71](#39-governance--sustainability--l69-l71-3-pillars)
4. [Scoring Methodology](#4-scoring-methodology)
5. [Refresh Cadence](#5-refresh-cadence)
6. [Cross-References](#6-cross-references)

---

## 1. Purpose & Scope

### 1.1 What this is

This document is the **authoritative schema** for the Phenotype 71-pillar quality framework. It defines 71 pillars across 9 domains, each with a description, industry anchors, and a 0-3 scoring rubric. It is the reference that the live scorecard (`findings/71-pillar-{date}.md`), the crosswalk to the older 30-pillar audit (`findings/71-pillar-2026-06-17-mapping.md`), and the weekly delta log all cite.

### 1.2 What it is not

- It is **not** a scorecard. The scorecard is `findings/71-pillar-2026-06-17.md` (and dated variants).
- It is **not** a per-repo evaluation. The first wrap-up audit is `audit-71-pillar-2026-06-17-wrapup.md`.
- It is **not** a static one-off. The schema is reviewed quarterly; the scorecard is refreshed weekly (see § 5).
- It is **not** a replacement for the 30-pillar audit. The 30-pillar audit (`audit-30-pillar-2026-06-16.md`) is preserved as L1-L30 of this new numbering; nothing is deleted.

### 1.3 Why 71 pillars

The 30-pillar audit (ADR-024 precursor) measured **30 technical architecture pillars** — Cargo workspaces, hexagonal ports, observability, performance budgets, security, governance. It caught technical debt reliably but missed the three cross-cutting experience layers that distinguish a buildable fleet from a usable one:

- **UX (User Experience)** — the human-developer's journey from `git clone` → onboard → first PR → first deploy.
- **AX (Architecture Experience / Agent Experience)** — the subagent / AI-agent journey: read spec → dispatch → receive result → integrate without losing context.
- **DX (Developer Experience)** — the day-2 developer: testing, debugging, upgrading, contributing back.

The 71-pillar is industry-standard: it is the union of **CMMI 5 levels × 13 process areas = 65** plus **ISO 25010's 8 quality characteristics** plus cross-cutting TMMi/ISTQB adjustments. The 9-domain layout (12+7+8+10+8+10+8+5+3 = 71) was confirmed by the user on 2026-06-17 and is the **single source of truth** for pillar numbering going forward.

### 1.4 What it measures vs. what it doesn't

| It measures | It does NOT measure |
|---|---|
| Static repository health (what is present, current, documented) | Real-time runtime behavior in production |
| Compliance with industry standards (AWS WAF, OWASP ASVS, ISO 25010, etc.) | Customer-facing product quality (NPS, retention) |
| Breadth of quality coverage across 9 domains | Depth within a single pillar (that's the Factory AI Readiness Model, ADR-026) |
| Relative quality across repos in the Phenotype bloc | Absolute industry benchmarks |
| Fitness for a subagent to operate on (AX domain) | Subagent output quality (that's the agent's own scoring) |

### 1.5 Scope of application

The 71-pillar applies to every repo in the Phenotype organization. Scoring rules:

- **Per-pillar, per-repo, 0-3** (see § 4).
- **N/A = 3** for UI-only pillars on headless backends / CLI libraries (specifically: L40 i18n, L41 a11y — see § 4.4).
- **Data-bearing services** add L62 (Backup/restore) which is N/A for stateless libraries.
- **Federated services** (phenoMCP, phenoObservability, phenoEvents) add L60 (Deployment automation) and L63 (Capacity planning) which are N/A for libraries.

### 1.6 Document conventions

- **Pillar identifier:** `L{n}` where `n` is the ordinal in the 1-71 sequence.
- **Pillar name:** short, present-tense, lowercase (e.g. "Module structure & boundaries").
- **Description:** 2-4 sentences; concrete SOTA examples (real crates/libraries/tools).
- **Industry anchors:** 1-4 industry references per pillar, each cited to the section/clause level.
- **Scoring criterion:** 0-3 rubric with concrete observable signals per level.
- **Status (per repo, in scorecard):** `✓ healthy` · `△ partial` · `⚠ blocked` · `✗ failing` · `n/a` (only L40, L41 on headless).

---

## 2. Industry References & Crosswalk

The 71 pillars are anchored to **12 industry references** drawn from cloud architecture frameworks, software-quality standards, security frameworks, operational maturity models, documentation systems, and supply-chain-security programs. Each industry reference is cited to the section / chapter / clause level.

### 2.1 The 12 industry references

| # | Reference | Owner | Version | Pillars anchored |
|---|---|---|---|---|
| **R1** | **AWS Well-Architected Framework** | Amazon Web Services | 2023 (6 pillars) | Architecture, Security, Reliability, Performance, Ops, Cost, Sustainability |
| **R2** | **Azure Well-Architected Framework** | Microsoft | 2024 (5 pillars) | Reliability, Security, Performance, Ops, Cost |
| **R3** | **Google Cloud Architecture Framework** | Google Cloud | 2024 (cross-cutting) | Architecture, Ops, Reliability |
| **R4** | **ISO/IEC 25010** (Systems and software Quality Requirements and Evaluation) | ISO/IEC JTC 1/SC 7 | 2011 (8 characteristics) | All 71 pillars, but 8 characteristic families are the primary anchor |
| **R5** | **OWASP ASVS** (Application Security Verification Standard) | OWASP | 4.0.3 (2021, 14 chapters) | Security domain (L46-L55) |
| **R6** | **NIST SSDF** (Secure Software Development Framework) | NIST SP 800-218 | 1.1 (2022, 4 practices) | Security + Governance (L46-L55, L69-L71) |
| **R7** | **Microsoft SDL** (Security Development Lifecycle) | Microsoft | 2022 (7 practices) | Security domain (L46-L55) |
| **R8** | **DORA 2023 Capabilities** (DevOps Research & Assessment) | Google / DORA | 2023 (8 capabilities × 4 dimensions) | DX, Architecture, Ops, Culture |
| **R9** | **Google SRE Book** | Google | 2nd ed. (2016, 34 chapters) | Observability & Ops (L56-L63) |
| **R10** | **CNCF Cloud Native Definition v1.0** | CNCF TAG App Delivery | 2018 (5 traits) | Architecture, DX, Observability (L1, L2, L6, L7, L11, L56-L58) |
| **R11** | **OpenSSF Best Practices Badge** (formerly CII) | OpenSSF | 2024 (passing/silver/gold) | Security, Quality, Governance (L20-L29, L46-L55, L69-L71) |
| **R12** | **Divio Documentation System** | Daniele Procida | 2017 (4 doc types) | Documentation & SSOT (L64-L68) |

### 2.2 Industry-reference crosswalk

The following table maps each industry reference to the 71-pillar pillars it most directly anchors. Where a pillar is anchored to multiple references, the strongest anchor is listed first; tie-breaks favor the more specific reference.

| Industry reference (section / clause) | Pillars anchored (1-71) | Notes |
|---|---|---|
| **R1 — AWS WAF § Operational Excellence pillar** | L20, L28, L29, L30, L36, L60, L61, L69, L70 | "Perform operations with code", "Make frequent, small, reversible changes", "Refine operations procedures frequently" |
| **R1 — AWS WAF § Security pillar** | L46, L48, L49, L50, L52, L55 | "Identity management", "Detect", "Protect infrastructure", "Data classification", "Prepare for events" |
| **R1 — AWS WAF § Reliability pillar** | L26, L56, L57, L59, L61, L63 | "Recover from failure", "Manage change", "Monitor and observe", "Test reliability" |
| **R1 — AWS WAF § Performance Efficiency pillar** | L13, L14, L16, L18, L19 | "Democratize advanced technologies", "Go global in minutes", "Use serverless architectures", "Experiment more often" |
| **R1 — AWS WAF § Cost Optimization pillar** | L19, L62, L63 | "Implement cost awareness", "Optimize over time" |
| **R1 — AWS WAF § Sustainability pillar** | L14, L19, L63, L71 | "Understand your impact", "Maximize utilization", "Use managed services", "Anticipate and adapt" |
| **R2 — Azure WAF § Reliability pillar** | L26, L56, L57, L59, L61, L63 | "Build a resilient application", "Observe", "Recover" |
| **R2 — Azure WAF § Security pillar** | L46-L55 (all 10) | "Zero-trust", "Defense in depth", "DevSecOps" |
| **R2 — Azure WAF § Performance Efficiency pillar** | L13, L14, L16, L18, L19 | "Performance testing", "Scaling", "Capacity planning" |
| **R2 — Azure WAF § Operational Excellence pillar** | L20, L28, L29, L36, L60, L61 | "Infrastructure as code", "Deployment automation", "CI/CD" |
| **R2 — Azure WAF § Cost Optimization pillar** | L19, L62, L63 | "Cost monitoring", "Resource optimization" |
| **R3 — Google Cloud Architecture Framework § System design** | L1, L2, L3, L4, L7 | "Reliability, scalability, maintainability, security, performance" |
| **R3 — Google Cloud Architecture Framework § Operational excellence** | L20, L36, L56, L60, L61, L63 | "Observability", "Automation", "SLOs" |
| **R3 — Google Cloud Architecture Framework § Security & compliance** | L46, L47, L48, L50, L52, L55 | "Zero trust", "Supply chain", "Compliance" |
| **R4 — ISO 25010 § 4.1.1 Functional suitability** | L1, L3, L4, L26 | Correctness, appropriateness, completeness |
| **R4 — ISO 25010 § 4.1.2 Performance efficiency** | L13, L14, L16, L18, L19 | Time behavior, resource use, capacity |
| **R4 — ISO 25010 § 4.1.3 Compatibility** | L9, L10, L11, L12 | Co-existence, interoperability |
| **R4 — ISO 25010 § 4.1.4 Usability** | L38, L39, L40, L41, L42, L43, L44, L45 | Learnability, operability, error protection, UI aesthetics, accessibility |
| **R4 — ISO 25010 § 4.1.5 Reliability** | L26, L27, L59, L61, L63 | Maturity, availability, fault tolerance, recoverability |
| **R4 — ISO 25010 § 4.1.6 Security** | L46-L55 (all 10) | Confidentiality, integrity, non-repudiation, accountability, authenticity |
| **R4 — ISO 25010 § 4.1.7 Maintainability** | L20, L21, L22, L23, L25, L27, L28, L29 | Modularity, reusability, analyzability, modifiability, testability |
| **R4 — ISO 25010 § 4.1.8 Portability** | L7, L12 | Adaptability, installability, replaceability |
| **R5 — OWASP ASVS § V1 Architecture** | L1, L2, L6, L7, L8, L48 | "Trusted components", "Threat model", "Sandboxing" |
| **R5 — OWASP ASVS § V2 Authentication** | L49 | "Credential security", "Authenticator lifecycle" |
| **R5 — OWASP ASVS § V3 Session management** | L49 | "Session binding", "Termination" |
| **R5 — OWASP ASVS § V4 Access control** | L49, L52 | "Authorization", "Multi-tenant" |
| **R5 — OWASP ASVS § V5 Validation, sanitization, encoding** | L53 | "Input handling", "Output encoding" |
| **R5 — OWASP ASVS § V6 Stored cryptography** | L50 | "Algorithms", "Key management" |
| **R5 — OWASP ASVS § V7 Error handling and logging** | L42, L24 | "Error messages", "Logging" |
| **R5 — OWASP ASVS § V8 Data protection** | L46, L47, L52 | "Data classification", "PII" |
| **R5 — OWASP ASVS § V9 Communication** | L46, L50 | "TLS", "Certificate validation" |
| **R5 — OWASP ASVS § V10 Malicious code** | L25 | "Code integrity", "Third-party audit" |
| **R5 — OWASP ASVS § V11 Business logic** | L48 | "Trust boundaries" |
| **R5 — OWASP ASVS § V12 Files and resources** | L52 | "File upload", "Resource quotas" |
| **R5 — OWASP ASVS § V13 API and web service** | L3, L4, L48 | "REST/GraphQL security" |
| **R5 — OWASP ASVS § V14 Configuration** | L54, L55 | "Build hardening", "Secret management" |
| **R6 — NIST SSDF § 2.1 Practice PO.1 (Define security requirements)** | L48, L69, L70 | "Identify security requirements", "Risk assessment" |
| **R6 — NIST SSDF § 2.2 Practice PO.2 (Define roles & responsibilities)** | L70, L71 | "Org governance" |
| **R6 — NIST SSDF § 2.3 Practice PO.3 (Define support channels)** | L61, L70 | "Issue triage", "Vulnerability disclosure" |
| **R6 — NIST SSDF § 2.4 Practice PO.4 (Define criteria for SW checks)** | L20, L21, L36 | "Acceptance criteria" |
| **R6 — NIST SSDF § 2.5 Practice PO.5 (Implement supporting toolchains)** | L22, L28, L29, L31 | "Toolchain", "CI hygiene" |
| **R6 — NIST SSDF § 3.1 Practice PS.1 (Protect code from unauthorized access)** | L46, L54 | "Repository hygiene", "2FA" |
| **R6 — NIST SSDF § 3.2 Practice PS.2 (Provide a mechanism for SBOM)** | L47 | "SBOM", "SPDX" |
| **R6 — NIST SSDF § 3.3 Practice PS.3 (Provide a mechanism for vuln reporting)** | L55, L61 | "Vuln disclosure", "Security.txt" |
| **R6 — NIST SSDF § 4.1 Practice PW.1 (Design software to meet security requirements)** | L1, L3, L4, L8 | "Secure design" |
| **R6 — NIST SSDF § 4.2 Practice PW.2 (Review software designs)** | L1, L21, L22 | "Design review" |
| **R6 — NIST SSDF § 4.3 Practice PW.3 (Reuse existing, well-secured software)** | L54, L55 | "Dependency reuse" |
| **R6 — NIST SSDF § 4.4 Practice PW.4 (Create source code following secure coding practices)** | L24, L25, L53 | "Coding standards" |
| **R6 — NIST SSDF § 4.5 Practice PW.5 (Configure compilation, build, packaging)** | L22, L54 | "Build hardening" |
| **R6 — NIST SSDF § 4.6 Practice PW.6 (Review and analyze human-readable code)** | L21, L22, L25 | "Code review" |
| **R6 — NIST SSDF § 4.7 Practice PW.7 (Review and analyze code with automated tools)** | L21, L22, L25, L26 | "SAST", "Fuzz" |
| **R6 — NIST SSDF § 5.1 Practice RV.1 (Identify and confirm vulnerabilities)** | L47, L55 | "Vuln scanning" |
| **R6 — NIST SSDF § 5.2 Practice RV.2 (Assess, prioritize, remediate)** | L47, L55, L61 | "Triage" |
| **R6 — NIST SSDF § 5.3 Practice RV.3 (Analyze root cause of vulnerabilities)** | L61 | "Postmortem" |
| **R7 — Microsoft SDL Practice: Training** | L22, L23, L25, L31 | "Secure coding training" |
| **R7 — Microsoft SDL Practice: Requirements** | L48, L49, L52, L53 | "Security requirements" |
| **R7 — Microsoft SDL Practice: Design** | L1, L2, L8, L48 | "Threat modeling", "Attack surface reduction" |
| **R7 — Microsoft SDL Practice: Implementation** | L24, L25, L53 | "Approved tools", "Static analysis" |
| **R7 — Microsoft SDL Practice: Verification** | L20, L21, L22, L26 | "Dynamic testing", "Fuzz" |
| **R7 — Microsoft SDL Practice: Release** | L36, L55, L60, L69 | "Incident response plan" |
| **R7 — Microsoft SDL Practice: Response** | L55, L61, L70 | "Postmortem" |
| **R8 — DORA 2023 § Technical (Cloud, Trunk-based, Test, Deploy)** | L28, L29, L30, L36, L60 | "≤ 1 day to deploy", "Continuous delivery" |
| **R8 — DORA 2023 § Process (Monitor, Propagate, Review)** | L21, L22, L36, L61, L63 | "Fast feedback", "Change failure rate" |
| **R8 — DORA 2023 § Cultural (Culture, Learning)** | L70, L71 | "Psychological safety", "Continuous learning" |
| **R8 — DORA 2023 § Architectural (Loosely coupled, Empower teams)** | L1, L2, L6, L7, L9, L11 | "Loose coupling", "Team autonomy" |
| **R9 — Google SRE Book Ch 2-4 SLO engineering** | L13, L63 | "SLI/SLO", "Error budgets" |
| **R9 — Google SRE Book Ch 5-7 Eliminating toil** | L60, L63 | "Automation ratio" |
| **R9 — Google SRE Book Ch 8-10 Monitoring distributed systems** | L56, L57, L58, L59 | "The Four Golden Signals", "White-box vs black-box" |
| **R9 — Google SRE Book Ch 11-14 Incident response** | L61 | "Incident command", "Roles" |
| **R9 — Google SRE Book Ch 15-17 Postmortem culture** | L61 | "Blameless postmortems" |
| **R9 — Google SRE Book Ch 18-20 Release engineering** | L36, L60, L69 | "Continuous build", "Hermetic builds" |
| **R9 — Google SRE Book Ch 26-28 Reliable product launches** | L26, L61 | "Gradual rollouts", "Dark launches" |
| **R9 — Google SRE Book Ch 29-31 Data integrity** | L26, L61, L62 | "Backup", "Data validation" |
| **R9 — Google SRE Book Ch 32-34 Cascading failures** | L26, L61 | "Load shedding", "Circuit breakers" |
| **R10 — CNCF Cloud Native Definition v1.0 § Containerized** | L60 | OCI containers, layered filesystems |
| **R10 — CNCF Cloud Native Definition v1.0 § Dynamically orchestrated** | L9, L60 | Kubernetes, Nomad |
| **R10 — CNCF Cloud Native Definition v1.0 § Microservices-oriented** | L2, L6, L7 | Bounded contexts, API contracts |
| **R10 — CNCF Cloud Native Definition v1.0 § Loosely coupled** | L2, L11 | Pub/sub, async messaging |
| **R10 — CNCF Cloud Native Definition v1.0 § Observable** | L56, L57, L58 | OTLP, Prometheus |
| **R11 — OpenSSF Best Practices Badge § passing** | L20, L21, L22, L29, L36, L69 | "Source repo", "License", "Docs", "Tests", "CI" |
| **R11 — OpenSSF Best Practices Badge § silver** | L24, L25, L28, L29, L36 | "Advanced testing", "Fuzz", "Reproducible builds" |
| **R11 — OpenSSF Best Practices Badge § gold** | L46, L47, L48, L49, L50, L54, L55, L70, L71 | "Crypto", "AuthN", "Secure release", "SBOM", "Vuln response" |
| **R12 — Divio § Tutorial** | L38, L45, L65 | "Learning-oriented" |
| **R12 — Divio § How-to** | L45, L67 | "Problem-oriented", "Goal-oriented" |
| **R12 — Divio § Reference** | L67 | "Information-oriented" |
| **R12 — Divio § Explanation** | L65, L68 | "Understanding-oriented" |

### 2.3 Crosswalk summary by domain

| Domain | Pillars | Primary industry anchors | Secondary anchors |
|---|---|---|---|
| Architecture (AX) | L1-L12 (12) | R4 § 4.1.1 Functional, R4 § 4.1.7 Maintainability, R4 § 4.1.8 Portability, R10 § Microservices/Loosely coupled, R3 § System design | R1 § Reliability, R5 § V1, R6 § PW.1-PW.2, R8 § Architectural |
| Performance | L13-L19 (7) | R4 § 4.1.2, R1 § Performance Efficiency, R2 § Performance | R1 § Cost, R1 § Sustainability |
| Quality / Correctness | L20-L27 (8) | R4 § 4.1.7 Maintainability, R11 passing/silver, R6 § PO.4/PW.2-PW.4 | R5 § V7, R7 § Verification |
| Developer Experience (DX) | L28-L37 (10) | R8 § Technical, R10 § Containerized/Orchestrated, R1 § Op Excellence, R2 § Op Excellence | R6 § PO.5, R11 passing/silver |
| User Experience (UX) | L38-L45 (8) | R4 § 4.1.4 Usability, R12 Divio (tutorial/how-to) | (no other) |
| Security | L46-L55 (10) | R5 OWASP ASVS (V1-V14), R6 NIST SSDF (PO/PS/PW/RV), R7 Microsoft SDL (7 practices), R4 § 4.1.6 | R11 gold, R1 § Security, R2 § Security |
| Observability & Ops | L56-L63 (8) | R9 Google SRE (Ch 2-34), R10 § Observable, R1 § Reliability/Op Excellence, R2 § Reliability | R6 § RV.1-RV.3, R8 § Process |
| Documentation & SSOT | L64-L68 (5) | R12 Divio (4 doc types) | R4 § 4.1.4 (Usability) |
| Governance & Sustainability | L69-L71 (3) | R6 NIST SSDF § PO.1-PO.2, R11 gold, R1 § Sustainability, R8 § Cultural | R7 § Response, R1 § Operational Excellence |

### 2.4 Phenotype-internal anchors (not industry, but local SSOT)

Some pillars have a strong internal anchor (ADR or fleet-level convention) that is not from an external industry reference. These are noted in the per-pillar table in § 3.

| Pillar | Internal anchor | Notes |
|---|---|---|
| L6 | ADR-014 "Hexagonal L4 ports: Port trait + Adapter impl" | Phenotype fleet convention |
| L8 | ADR-023 "App-level repo triage & app substrate placement" | Substrate placement rule |
| L10 | ADR-016 "Fork-only-not-rewrite policy" | Backward-compat discipline |
| L12 | ADR-022 "Config consolidation — two-crate canonical split" | Config topology |
| L29 | ADR-018 "PRCP pattern (Polyglot Reuse via Canonical Ports)" | Polyglot reuse |
| L33 | ADR-027 "Git LFS strategy" | LFS handling |
| L39 | `AGENTS.md` canonical format | Self-describing fleet |
| L66 | `llms.txt` (LLM-friendly docs) | Phenotype-internal pattern, no industry standard yet |

---

## 3. The 71 Pillars

The 71 pillars are organized into 9 domains. Each pillar has the same five-column schema:

| Column | Meaning |
|---|---|
| **L#** | Pillar identifier (1-71) |
| **Pillar** | Short, present-tense, lowercase name |
| **Description** | 2-4 sentences; concrete SOTA examples (real crates/libraries/tools) |
| **Industry anchors** | 1-4 industry references cited to section / clause / chapter |
| **0/1/2/3 scoring** | Observable signals at each level (0=absent, 1=minimal, 2=adequate, 3=strong/SOTA) |

### 3.1 Architecture (AX) — L1-L12 (12 pillars)

Architecture pillars measure the structural soundness of a repo: its modules, contracts, data model, concurrency design, port/adapter discipline, and substrate placement. AX is the **"is the codebase buildable in the long run?"** domain. Anchored primarily to ISO 25010 § 4.1.1 (Functional suitability), § 4.1.7 (Maintainability), and § 4.1.8 (Portability); secondarily to AWS WAF Reliability + Google Cloud Architecture Framework.

| L# | Pillar | Description | Industry anchors | 0/1/2/3 scoring |
|---|---|---|---|---|
| **L1** | Architecture foundations | A repo has a clear, documented architecture (ADR or `ARCHITECTURE.md`) that explains layers, boundaries, and the rationale for the chosen pattern. SOTA 2026: monorepo fleets use `ARCHITECTURE.md` + per-crate `SPEC.md`; examples include `tokio`'s reactor model doc, `ruff`'s layered compiler pipeline, and `dbt`'s DAG architecture doc. | R4 § 4.1.1, R3 § System design, R6 § PW.1 | **0:** no architecture doc. **1:** ARCHITECTURE.md exists, ≤ 10 lines. **2:** ARCHITECTURE.md + 1+ ADRs cover major decisions. **3:** ARCHITECTURE.md + ADRs + diagrams (Mermaid/ASCII) + cross-referenced from `AGENTS.md`. |
| **L2** | Module structure & boundaries | Modules / crates / packages are clearly bounded with explicit dependency direction; no circular deps; layered architecture (core → adapter → app). SOTA 2026: Rust workspaces (`pheno-cargo-template`); Python packages with `src/` layout + `__init__.py` discipline; Go modules with `internal/` for non-exported packages. Tools: `cargo metadata`, `pydeps`, `go mod graph`. | R4 § 4.1.7, R8 § Architectural, R10 § Microservices | **0:** no module separation; monolithic. **1:** modules exist; some circular deps. **2:** layered (3+ tiers), no circular deps, no `pub` leakage. **3:** layered + cargo-deny / dependency-cruiser / madge clean + `pheno-port-adapter` hexagonal structure. |
| **L3** | API surface & contract | The public API is minimal, stable, documented, and semver-respecting. SOTA 2026: Rust uses `cargo-semver-checks` in CI; Python uses `griffe` + `griffe-pydantic`; Go uses `pkg.go.dev` + breaking-change linters. Phenotype ADR-016 mandates fork-only-not-rewrite for SOTA libraries. | R4 § 4.1.1, R5 § V13, R6 § PW.1 | **0:** no public API discipline; everything `pub`. **1:** API exists; docs missing or stale. **2:** docs current + semver honored + `cargo-semver-checks` (or equiv) in CI. **3:** minimal API (≤ 20% symbols `pub`) + machine-readable spec (OpenAPI/AsyncAPI) + deprecation policy in CHANGELOG. |
| **L4** | Data model & state management | The data model is typed, validated, and serializable; state is managed through clear ownership (RAII in Rust, single-source-of-truth in TypeScript, explicit ownership in Go). SOTA 2026: `serde` + `schemars`; Pydantic v2 + `model_dump`; `encoding/json` + struct tags. ADR-014 (hexagonal ports) implies data types live in `domain/` not `adapters/`. | R4 § 4.1.1, R5 § V13, R6 § PW.1 | **0:** untyped data (e.g., `Dict[str, Any]` everywhere). **1:** types exist but not validated. **2:** types + validation (Pydantic/schemars/zod) + serialization round-trip tests. **3:** types + validation + domain entities in `domain/` per ADR-014 + `schemars` OpenAPI export. |
| **L5** | Async/concurrency design | Concurrency primitives are chosen deliberately (Rust: tokio/async-std/smol; Python: asyncio + uvloop; Go: goroutines + errgroup; TypeScript: structured concurrency). Race conditions are prevented at the type level. SOTA 2026: `tokio::task::JoinSet`, `tracing-futures`, `asyncio.TaskGroup` (Python 3.11+), `errgroup.WithContext`. | R8 § Architectural, R4 § 4.1.7, R3 § Reliability | **0:** blocking calls inside async paths; shared mutable state. **1:** async used but `Send + Sync` not enforced. **2:** explicit runtime choice + `Send + 'static` bounds verified + cancellation tokens. **3:** structured concurrency + `loom` (Rust) or `tla+` model check + cancellation propagated to all branches. |
| **L6** | Hexagonal port/adapter discipline | Ports are traits/interfaces; adapters are separate crates/modules that implement ports. ADR-014: `Port` trait + `Adapter` impl. SOTA 2026: `tokio` (runtime-as-port), `sqlx` (DB-as-port), `tonic` (gRPC-as-port). Phenotype canonical examples: `pheno-port-adapter`, `phenotype-hub`. | R4 § 4.1.7, R5 § V1, ADR-014, R8 § Architectural | **0:** no port/adapter separation; concrete deps leak. **1:** ports exist but adapters live in same file. **2:** ports in dedicated `ports/` or `traits/` module + adapters in `adapters/` + di/test swaps. **3:** ports = single trait per file + adapters = separate crate + ADR-014 "Port + Adapter" pattern + `pheno-port-adapter` substrate. |
| **L7** | Polyglot strategy | Polyglot boundaries are explicit: FFI, gRPC, or REST between languages. No shared mutable state across language boundaries. SOTA 2026: `pyo3` (Rust↔Python), `wasmtime` (Rust↔WASM), `cgo` (Go↔C), `uniffi` (Rust↔mobile). Phenotype: `pheno-pydantic-models` (Python) ↔ `phenotype-zod-schemas` (TypeScript) ↔ `pheno-prompt-test`. | R3 § System design, R8 § Architectural, R4 § 4.1.8, ADR-018 | **0:** language mix without boundaries; data passed as JSON strings. **1:** FFI exists but unsafe. **2:** explicit FFI layer + type-shared via `pheno-pydantic-models`/`pheno-zod-schemas` + safety audit. **3:** ADR-018 PRCP pattern + `pheno-pydantic-models` as canonical model + language-specific adapters per ADR-022. |
| **L8** | Substrate placement | Every reusable capability is placed in exactly one of `pheno-*-lib`, `phenotype-*-sdk`, `phenotype-*-framework`, or federated service per ADR-023 Rule 3. No "random `phenoShared`". SOTA 2026: this is Phenotype-internal; the closest external pattern is "logical architecture vs. physical architecture" in AWS WAF. | ADR-023, R3 § System design, R6 § PW.1 | **0:** random `phenoShared`/shared/ or per-app `lib/`. **1:** one of the 4 substrate types used inconsistently. **2:** every new capability placed in one of 4 substrate types per ADR-023. **3:** ADR-023 enforced in CODEOWNERS + substrate placement table in `AGENTS.md` + migration plan for legacy `phenoShared`. |
| **L9** | Cargo workspace topology | Cargo workspaces are organized with clear member hierarchy: `crates/` for libraries, `bins/` for binaries, `examples/` for examples, `tests/` for integration tests, `benches/` for benchmarks. SOTA 2026: `tokio`'s workspace, `serde`'s workspace, `bevy`'s workspace. | R4 § 4.1.7, R10 § Orchestrated, R8 § Architectural | **0:** flat (no workspace). **1:** workspace exists but member layout is ad hoc. **2:** `crates/` + `bins/` + `examples/` + workspace-level `[workspace.dependencies]`. **3:** `pheno-cargo-template` standard layout + workspace lint config + `cargo-machete` + `[workspace.package]` shared metadata. |
| **L10** | Backward compatibility | Semver policy is followed; breaking changes are documented; deprecations are announced. SOTA 2026: `cargo-semver-checks`, `cargo-public-api`, `griffe`, `semantic-release`, `cliff`. ADR-016: "fork-only-not-rewrite" mandates backward compat for SOTA libraries. | R4 § 4.1.3, ADR-016, R6 § PW.1 | **0:** breaking changes without notice. **1:** semver policy exists in CONTRIBUTING. **2:** semver enforced in CI (cargo-semver-checks / equivalent). **3:** semver enforced + 1-patch deprecation cycle (warn → soft → hard) + ADR-016 fork-only discipline. |
| **L11** | Extensibility | Plugin/fork/module architecture is documented. Extension points have stable contracts. SOTA 2026: `wasmtime` (plugin host), `gdext` (Godot extension), `wasmCloud` (actor model), `tikv` (Coprocessor trait). | R4 § 4.1.3, R10 § Loosely coupled, R8 § Architectural | **0:** monolithic; no extension points. **1:** extension points exist but undocumented. **2:** documented + sample extension. **3:** documented + sample + ABI-stable versioned + SemVer for extension contract. |
| **L12** | Portability | Runs on target platforms (Linux x86_64/arm64, macOS, Windows, optionally musl). Cross-platform CI matrix. SOTA 2026: `cargo-zigbuild`, `cross`, `cargo-xwin`; `cibuildwheel`; `gobuild` with `GOOS=js`. | R4 § 4.1.8, R10 § Containerized, R3 § System design | **0:** single platform only. **1:** works on multiple platforms but no CI. **2:** CI matrix covers Linux+macOS. **3:** Linux x86_64+arm64 + macOS + Windows + musl/static + CI matrix + Docker multi-arch manifests. |

### 3.2 Performance — L13-L19 (7 pillars)

Performance pillars measure runtime efficiency, allocation behavior, concurrency safety, and throughput. Anchored to ISO 25010 § 4.1.2 (Performance efficiency), AWS WAF Performance Efficiency, and Azure WAF Performance. The performance domain is **"does the codebase meet its budget?"** — for libraries, the budget is "no obvious regressions"; for services, the budget is "meets the SLO".

| L# | Pillar | Description | Industry anchors | 0/1/2/3 scoring |
|---|---|---|---|---|
| **L13** | Performance budgets & SLOs | Performance budgets are documented (e.g., "P99 < 100ms for hot path"); SLOs defined for services. SOTA 2026: services use `criterion` (Rust), `pytest-benchmark`, `go test -bench`; SLOs declared in `SLO.md` or as OpenSLO YAML. | R4 § 4.1.2, R9 Ch 2-4, R1 § Performance | **0:** no benchmarks. **1:** ad-hoc benchmarks, no SLO. **2:** criterion/pytest-benchmark benchmarks in CI + SLO.md. **3:** benchmarks + SLOs + error budget tracking + automated regression alerts (e.g., 10% slowdown fails CI). |
| **L14** | Memory & allocation profile | Memory footprint is bounded; allocations on hot paths are avoided. SOTA 2026: Rust uses `dhat`, `heaptrack`, `cargo-bloat`; Python uses `tracemalloc`, `memray`; Go uses `pprof` heap. Library SOTA: `bytes::Bytes` (refcount-zero copy), `serde_json` (zero-copy), `arrow` (columnar). | R4 § 4.1.2, R1 § Performance, R1 § Sustainability | **0:** no memory profiling. **1:** profiling done manually once. **2:** `dhat`/`memray`/`pprof` in CI for hot path + `cargo-bloat` for size budget. **3:** bounded allocation + zero-copy where applicable + heap profile in CI + size budget enforced. |
| **L15** | Concurrency safety & races | No data races, no deadlocks. `Send + Sync` (Rust) / `asyncio` debug mode (Python) / `-race` (Go) verified. SOTA 2026: `loom` (Rust model checker), `tla+`, `asyncio` debug mode, Go `-race`. | R4 § 4.1.5, R8 § Technical, R1 § Reliability | **0:** no concurrency tests. **1:** Go `-race` / Python `asyncio` debug runs sometimes. **2:** `-race` / `Send+Sync` check in CI. **3:** `-race` + `loom`/`tla+` model check + `tokio-console` flame graphs + `parking_lot::deadlock` detection. |
| **L16** | Resource limits & rate limits | Resources (CPU, memory, file descriptors, connections) are bounded. Rate limits documented and enforced. SOTA 2026: `governor` (Rust), `slowapi`/`aiolimiter` (Python), `golang.org/x/time/rate` (Go), `pLimit` (JS). | R4 § 4.1.2, R1 § Performance, R5 § V12 | **0:** no rate limits; unbounded growth. **1:** manual rate limits. **2:** `governor`/equivalent in code + CI load test. **3:** governor + per-tenant limits + backpressure + observability hook on reject. |
| **L17** | Build performance | Incremental compilation is fast; full build is bounded. SOTA 2026: `sccache` (Rust), `cargo-chef` (Docker), mold/lld linker, `maturin` (Python-Rust). Phenotype canonical: `pheno-cargo-template` includes `sccache` config. | R4 § 4.1.2, R8 § Technical, R1 § Performance | **0:** cold build > 10 min. **1:** cold build 5-10 min. **2:** sccache + cold build < 5 min. **3:** sccache + mold + cargo-chef + cold build < 2 min + `cargo nextest` for tests. |
| **L18** | Runtime latency | P50/P95/P99 latencies measured; regressions detected. SOTA 2026: `criterion`, `pyperf`, Go `pprof`, `py-spy`. | R4 § 4.1.2, R9 Ch 2-4, R1 § Performance | **0:** no latency measurement. **1:** ad-hoc. **2:** P50/P95/P99 in CI per benchmark. **3:** regression > 5% fails CI + flamegraph in CI artifact. |
| **L19** | Throughput | Ops/sec, RPS, requests/sec measured. SOTA 2026: `k6`, `wrk`, `vegeta`, `locust`, `criterion` throughput benches. | R4 § 4.1.2, R1 § Performance, R1 § Cost, R2 § Cost | **0:** no throughput measurement. **1:** ad-hoc. **2:** load test in CI (k6/wrk). **3:** load test in CI + SLO-based throughput assertion + cost-per-1k-req tracked. |

### 3.3 Quality / Correctness — L20-L27 (8 pillars)

Quality pillars measure the rigor of testing, static analysis, type discipline, and code health. Anchored to ISO 25010 § 4.1.7 (Maintainability), OpenSSF Best Practices Badge (passing/silver), and NIST SSDF PW.2-PW.7. Quality is the **"does the codebase do what it claims?"** domain.

| L# | Pillar | Description | Industry anchors | 0/1/2/3 scoring |
|---|---|---|---|---|
| **L20** | Test coverage & quality gates | Test coverage meets the ADR-023 threshold: 80% lib, 70% framework, 60% service. SOTA 2026: `cargo-tarpaulin`, `cargo-llvm-cov`, `coverage.py`, `pytest-cov`, Go `go test -cover`. CI fails below threshold. | R4 § 4.1.7, R11 passing, R6 § PO.4 | **0:** no coverage measurement. **1:** coverage measured but not gated. **2:** gate at 60% enforced in CI. **3:** gate at threshold per ADR-023 (80/70/60) + per-domain sub-gates. |
| **L21** | Test health | No flaky tests; CI pass rate > 95%. SOTA 2026: `pytest-rerunfailures` (with rerun cap), `cargo nextest` (parallel + retry), Go test retry, custom flaky-test quarantine. | R4 § 4.1.5, R11 passing, R6 § PW.2, R8 § Process | **0:** tests frequently fail for no reason. **1:** flaky tests acknowledged but not tracked. **2:** flaky tests quarantined + tracked + CI pass rate > 95%. **3:** zero flaky tests + `cargo nextest` + CI pass rate > 99% + flakiness SLA. |
| **L22** | Linting & static analysis | Linter configured, enforced, clean. SOTA 2026: `clippy` + `cargo-deny` (Rust), `ruff` (Python), `golangci-lint` (Go), `eslint` + `typescript-eslint` (TS), `semgrep` (polyglot). | R4 § 4.1.7, R11 passing/silver, R6 § PW.5-PW.7, R7 § Implementation | **0:** no linter. **1:** linter configured but ignored. **2:** linter enforced in CI + zero warnings. **3:** linter + format check + clippy::pedantic + semgrep custom rules + IDE integration. |
| **L23** | Formatting & style consistency | Code is auto-formatted; style is consistent across the repo. SOTA 2026: `rustfmt`, `black`/`ruff format`, `gofmt`/`goimports`, `prettier`. | R4 § 4.1.7, R11 passing, R6 § PO.5, R7 § Training | **0:** no formatter. **1:** formatter available, not enforced. **2:** formatter enforced in CI (pre-commit + CI). **3:** formatter + style guide doc + imports sorted + `deny.toml` for license/style. |
| **L24** | Type system & error handling | Strong typing; errors are typed and composable; no `unwrap`/`panic` in library code. SOTA 2026: `thiserror` + `anyhow` (Rust), `Result` + `Box<dyn Error>` (Rust idiomatic), Pydantic v2 (Python), sealed classes (Kotlin), discriminated unions (TS). | R4 § 4.1.7, R11 silver, R6 § PW.4, R5 § V7 | **0:** `panic!` / `unwrap()` in lib code; `dict[str, Any]` everywhere. **1:** errors exist but mixed with strings. **2:** typed errors + `thiserror`/`anyhow` + zero `unwrap` in lib + `Result` chains. **3:** typed errors + `Error` trait impls + OTel error attributes + no `panic` + no `unwrap` in lib + custom `ErrorContext` envelope (phenotype-error-core). |
| **L25** | Memory safety | No `unsafe` blocks without justification (Rust), no manual memory mgmt (C/C++), no `ctypes` without audit (Python). SOTA 2026: `cargo-geiger` (Rust), `-fsanitize=address` (C/C++), Miri (Rust). | R4 § 4.1.7, R11 silver, R5 § V10, R6 § PW.4, R7 § Implementation | **0:** unsafe everywhere; no audit. **1:** unsafe with comments, no policy. **2:** `unsafe` lint + `cargo-geiger` + `Miri` on critical modules. **3:** `unsafe` policy in CONTRIBUTING + `#[deny(unsafe_op_in_unsafe_fn)]` + Miri CI + sanitizers in CI. |
| **L26** | Property/fuzz testing | Invariants are property-tested; critical parsers/inputs are fuzzed. SOTA 2026: `proptest` (Rust), `quickcheck` (Haskell, Rust), `hypothesis` (Python), `cargo-fuzz` (Rust), `go-fuzz`/`fuzzing-headers` (Go). | R4 § 4.1.5, R11 silver, R6 § PW.7, R1 § Reliability, R9 Ch 32-34 | **0:** no property/fuzz tests. **1:** 1-2 proptests. **2:** proptest + cargo-fuzz in CI for critical paths. **3:** proptest + cargo-fuzz + structured fuzz corpus + 24h weekly fuzz run + stateful testing. |
| **L27** | Code complexity & duplication | Cyclomatic complexity is bounded; no significant duplicated code. SOTA 2026: `clippy::cognitive_complexity`, `radon` (Python), `gocyclo` (Go), `jscpd` (polyglot copy-paste), `density`. | R4 § 4.1.7, R11 passing, R8 § Process | **0:** no complexity check. **1:** complex functions exist (>20 cyclomatic). **2:** clippy-complexity clean + jscpd < 5%. **3:** complexity budget enforced + jscpd < 3% + duplication refactored into shared substrate per ADR-023. |

### 3.4 Developer Experience (DX) — L28-L37 (10 pillars)

DX pillars measure the day-2 developer experience: local setup, test speed, build cache, IDE support, debug tooling, scaffolding, migration, CI loop time, and doc generation. Anchored to DORA 2023 § Technical, CNCF Cloud Native Definition § Containerized/Orchestrated, and Azure WAF § Op Excellence. DX is the **"can a contributor ship a change in 1 hour?"** domain.

| L# | Pillar | Description | Industry anchors | 0/1/2/3 scoring |
|---|---|---|---|---|
| **L28** | Local dev setup | One command to clone, build, test, run. SOTA 2026: `just setup`, `Taskfile.yml`, `make setup`, `cargo xtask`, `mise`/`asdf` for toolchain pinning. | R4 § 4.1.7, R8 § Technical, R1 § Op Excellence, R6 § PO.5 | **0:** no setup script; multi-hour manual setup. **1:** README has install steps; not automated. **2:** `just setup` / `Taskfile.yml` runs to clean state. **3:** `just setup` + devcontainer (`.devcontainer/`) + `mise.toml` + 1-command quickstart. |
| **L29** | Test speed | Unit tests < 30s; full suite < 5min. SOTA 2026: `cargo nextest`, `pytest-xdist`, `go test -parallel`, `vitest` (TS). | R4 § 4.1.7, R11 passing, R8 § Technical, R2 § Op Excellence | **0:** tests > 10min. **1:** tests 1-10min. **2:** unit < 30s, full < 5min via `cargo nextest`/xdist. **3:** unit < 10s + full < 2min + test sharding + per-test timing tracked. |
| **L30** | Build cache | Incremental compilation is fast across rebuilds. SOTA 2026: `sccache` (Rust), `maturin` (Python-Rust), `nx`/`turborepo` (TS/JS), Go build cache (Go 1.10+). | R4 § 4.1.2, R8 § Technical, R1 § Op Excellence | **0:** no cache; every build is full. **1:** ad-hoc cache. **2:** sccache/maturin/turborepo configured. **3:** sccache with remote backend (e.g., bazel-remote) + cargo-chef for Docker + CI cache. |
| **L31** | Pre-commit hooks | Pre-commit hooks catch issues before they reach CI. SOTA 2026: `lefthook`, `husky`, `pre-commit.com`, `cargo-husky`. | R4 § 4.1.7, R11 passing, R6 § PO.5, R7 § Training | **0:** no pre-commit. **1:** README says "run X before committing". **2:** lefthook/husky configured + format + lint + deny. **3:** lefthook + format + lint + deny + semgrep + secrets (gitleaks/trufflehog) + commit-msg lint. |
| **L32** | Editor/IDE config | Editor config present; LSP works. SOTA 2026: `.editorconfig`, `.vscode/`, `.idea/`, `rust-analyzer` config, `pyright`/`mypy` config. | R4 § 4.1.7, R8 § Technical, R1 § Op Excellence | **0:** no editor config. **1:** `.editorconfig` only. **2:** editorconfig + .vscode/settings.json + rust-analyzer.json. **3:** editorconfig + .vscode + .idea + rust-analyzer + pyright + shared debug launch config. |
| **L33** | Debug tooling | Debug builds work; profiling tools integrated. SOTA 2026: `cargo-flamegraph`, `tokio-console`, `py-spy`, Go `pprof`, `lldb`/`gdb` integration. ADR-027 covers LFS debug tooling. | R4 § 4.1.7, R8 § Technical, R1 § Op Excellence, ADR-027 | **0:** no debug tooling. **1:** debug build flag works. **2:** `cargo-flamegraph` + `tokio-console` profiles work. **3:** flamegraph + tokio-console + `py-spy` + lldb in CI + `pheno-otel` traces in dev. |
| **L34** | Code generation / scaffolding | Boilerplate is automated. SOTA 2026: `pheno-scaffold-kit` (Phenotype), `cookiecutter`, `yeoman`, `cargo generate`, `npm create`. | R4 § 4.1.7, R8 § Technical, R2 § Op Excellence | **0:** manual boilerplate. **1:** README template; not automated. **2:** scaffold tool exists + template. **3:** `pheno-scaffold-kit` or equivalent + ADRs auto-generated + CI template. |
| **L35** | Migration tooling | Dependency and version migrations are assisted. SOTA 2026: `cargo-edit`, `sqlx-cli`, `alembic`, `flyway`, `golang-migrate`. | R4 § 4.1.7, R8 § Technical, R1 § Op Excellence | **0:** manual migrations. **1:** README migration steps. **2:** migration tool configured. **3:** migration tool + versioned scripts + CI migration test. |
| **L36** | CI loop time | Unit test feedback < 10 min. SOTA 2026: GitHub Actions matrix + `act` for local; Buildkite; CircleCI; DORA "fast feedback" capability. | R4 § 4.1.7, R11 passing, R8 § Technical, R6 § PW.2, R2 § Op Excellence | **0:** CI > 30min. **1:** CI 10-30min. **2:** CI < 10min for unit. **3:** CI < 5min + test sharding + remote cache + selective runs. |
| **L37** | Doc generation | `cargo doc`, `typedoc`, `sphinx` build clean. SOTA 2026: `cargo doc --no-deps --document-private-items`, `mkdocs`, `sphinx`, `typedoc`, `rustdoc-json`. | R4 § 4.1.7, R11 passing, R8 § Technical, R2 § Op Excellence | **0:** no doc build. **1:** cargo doc builds. **2:** cargo doc clean + CI + deployed to GitHub Pages. **3:** doc CI + doctests + API JSON + mdbook. |

### 3.5 User Experience (UX) — L38-L45 (8 pillars)

UX pillars measure the **human-developer's** journey: onboarding speed, doc quality, error message quality, CLI discoverability, progress indication, help/examples. Anchored to ISO 25010 § 4.1.4 (Usability) and Divio § Tutorial / How-to. UX is the **"can a new user set up + use the tool in < 5 min?"** domain.

| L# | Pillar | Description | Industry anchors | 0/1/2/3 scoring |
|---|---|---|---|---|
| **L38** | Onboarding: clone-to-first-build | New user can clone + build + run first example in ≤ 10 minutes. SOTA 2026: README has 1-command quickstart; `pheno-scaffold-kit` produces this by default; examples work. | R4 § 4.1.4, R12 Divio § Tutorial, R8 § Cultural | **0:** no quickstart; setup > 1 hour. **1:** README quickstart exists; doesn't always work. **2:** verified quickstart in < 10 min from clean clone. **3:** quickstart < 5 min + verified by 2nd party + recorded video. |
| **L39** | AGENTS.md quality & freshness | `AGENTS.md` exists, is current, and points to all key docs. SOTA 2026: `AGENTS.md` is a Phenotype-internal convention (no external standard yet); AWS WAF says "documentation must be discoverable". | R4 § 4.1.4, R1 § Op Excellence, ADR-024 | **0:** no AGENTS.md. **1:** AGENTS.md exists, ≤ 10 lines. **2:** AGENTS.md current + links to ADRs + latest at < 30 days. **3:** AGENTS.md + llms.txt + ADR index + worklog schema + auto-updated by CI. |
| **L40** | Internationalization (i18n) | Text is externalized; UI supports multiple languages. **N/A = 3 for headless backend / CLI libraries** (per AGENTS.md N/A rule). SOTA 2026: `fluent-rs`/`gettext` (Rust), `babel` (Python), `go-i18n` (Go), `i18next` (TS). | R4 § 4.1.4, (UI-only) | **0:** all text hardcoded. **1:** i18n framework imported; < 50% of strings externalized. **2:** all strings externalized; 2+ locales. **3:** i18n + RTL + locale-aware date/number formatting + CI locale test. **N/A:** headless backend / CLI lib → score 3. |
| **L41** | Accessibility (a11y) | UI works for users with disabilities. **N/A = 3 for headless backend / CLI libraries** (per AGENTS.md N/A rule). SOTA 2026: WCAG 2.2 AA; `axe-core` (web), Material/Apple HIG, WAI-ARIA. | R4 § 4.1.4, WCAG 2.2 AA (UI-only) | **0:** no a11y consideration. **1:** basic alt text / focus rings. **2:** WCAG 2.2 AA compliant + `axe-core` clean. **3:** WCAG 2.2 AAA + screen reader tested + `axe` clean + keyboard nav. **N/A:** headless backend / CLI lib → score 3. |
| **L42** | Error messages: human-readable | Error messages include what + why + fix. SOTA 2026: `miette` (Rust), `color-eyre` (Rust), `pretty_errors` (Python), `codi`/`colored` (Go/TS), OWASP ASVS V7. | R4 § 4.1.4, R5 § V7, R8 § Process | **0:** cryptic errors ("Error: 1"). **1:** errors include "what". **2:** "what + why" + actionable fix suggestion. **3:** "what + why + fix" + suggestion engine (`miette`/`color-eyre`) + links to docs. |
| **L43** | CLI discoverability | `--help`, `-h`, subcommands are documented and complete. SOTA 2026: `clap` (Rust, auto-generates help), `click` (Python), `cobra` (Go), `commander`/`yargs` (TS). | R4 § 4.1.4, R8 § Technical | **0:** no help text. **1:** `--help` works for top-level command. **2:** help complete for all subcommands + examples. **3:** help + examples + shell completion (`clap_complete`) + man page + `tldr` page. |
| **L44** | Progress indication | Long operations show progress. SOTA 2026: `indicatif` (Rust), `rich.progress` (Python), `pb` (Go), `ora` (Node). | R4 § 4.1.4, R8 § Technical | **0:** no progress indication; user stares at blank screen. **1:** ad-hoc prints. **2:** progress bar/spinner on long ops. **3:** progress + ETA + cancelable + observability hook on cancel. |
| **L45** | Help & examples | `examples/` directory exists; `--help` examples; tutorials in docs. SOTA 2026: `cargo run --example`, `examples/` at root, doctests, JupySQL notebooks, GitBook tutorials. | R4 § 4.1.4, R12 Divio § Tutorial, § How-to | **0:** no examples. **1:** 1-2 examples in README. **2:** `examples/` dir + doctests. **3:** examples + doctests + tutorial in `docs/` + 1 YouTube walkthrough + `cargo run --example` list. |

### 3.6 Security — L46-L55 (10 pillars)

Security pillars measure the rigor of secret management, supply-chain security, threat modeling, authentication, cryptography, audit logging, multi-tenant isolation, input validation, dependency policy, and security ops. Anchored primarily to OWASP ASVS v4.0 (V1-V14), NIST SSDF (PO/PS/PW/RV), Microsoft SDL (7 practices), and ISO 25010 § 4.1.6. Security is the **"is the codebase safe to operate?"** domain.

| L# | Pillar | Description | Industry anchors | 0/1/2/3 scoring |
|---|---|---|---|---|
| **L46** | Secret management | No secrets in code; secrets retrieved from vault/env/KMS. SOTA 2026: HashiCorp Vault, AWS Secrets Manager, Doppler, SOPS, `secrecy` crate (Rust), `pydantic.SecretStr` (Python). | R5 § V8, V9, R6 § PS.1, R1 § Security, R4 § 4.1.6 | **0:** secrets in code or env files committed. **1:** secrets in `.env` (not committed but plaintext). **2:** secrets in vault + `secrecy`/`SecretStr` + CI scan (gitleaks). **3:** vault + auto-rotation + audit + `gitleaks` + `trufflehog` + `.env.example` only. |
| **L47** | Supply-chain security (SBOM/CVE) | SBOM generated; CVEs scanned; dependencies vetted. SOTA 2026: `cargo-deny` advisories, `osv-scanner`, `syft`, `cyclonedx-bom`, `dependabot`, `renovate`. | R5 § V8, R6 § PS.2, R11 gold, R1 § Security, R2 § Security | **0:** no SBOM; no CVE scan. **1:** `cargo audit` ad-hoc. **2:** SBOM generated in CI + `cargo-deny` + `osv-scanner` clean. **3:** SBOM + signed SBOM (in-toto) + SLSA L3 + pinned hashes + `dependabot` auto-PR. |
| **L48** | Threat model & attack surface | Threat model exists; attack surface is documented. SOTA 2026: STRIDE, PASTA, attack trees, OWASP ASVS V1 + V11, NIST SSDF PO.1. | R5 § V1, V11, V13, R6 § PO.1, R1 § Security, R7 § Design | **0:** no threat model. **1:** ad-hoc mental model. **2:** STRIDE doc for major components. **3:** STRIDE + attack tree + threat model reviewed annually + linked from ADR. |
| **L49** | AuthN/AuthZ | Authentication and authorization are explicit and well-tested. SOTA 2026: OAuth 2.0 / OIDC, SAML 2.0, JWT with `jsonwebtoken` (Rust), `authlib` (Python), `golang-jwt` (Go), WorkOS (per `workos` skill in this fleet). | R5 § V2, V3, V4, R6 § PW.1, R1 § Security, R7 § Requirements | **0:** no auth. **1:** basic auth / hardcoded credentials. **2:** OIDC/OAuth + RBAC + auth tests. **3:** OIDC + MFA + WorkOS (per `workos` skill) + ABAC + threat model + rate limit on auth. |
| **L50** | Cryptography & key management | Standard crypto; keys rotated; no homegrown crypto. SOTA 2026: `ring`/`rustls` (TLS), `aws-lc-rs` (FIPS), `libsodium`, `age`/`sops` (encryption), Tink (multi-language). | R5 § V6, V9, R6 § PS.1, R11 gold, R1 § Security, R2 § Security | **0:** custom crypto or no crypto where needed. **1:** stdlib crypto, no rotation. **2:** `ring`/`aws-lc-rs` + key rotation policy. **3:** `aws-lc-rs` + FIPS + HSM/KMS + rotation + audit + post-quantum ready (hybrid). |
| **L51** | Audit log & compliance | Audit logs capture who-did-what-when. SOTA 2026: structured audit logs (`tracing` audit spans), `auditd` (Linux), CloudTrail (AWS), Azure Activity Log, SOC 2 evidence collection. | R4 § 4.1.6, R6 § PS.3, R1 § Security, R7 § Response | **0:** no audit log. **1:** ad-hoc log lines. **2:** structured audit log + retention + access control on log. **3:** audit log + WORM storage + SOC 2 evidence + tamper-evident (hash chain). |
| **L52** | Multi-tenant isolation & data privacy | Tenants are isolated; PII is identified and protected. SOTA 2026: per-tenant keys, row-level security (PostgreSQL RLS), per-tenant subdomains, `actix-web` scope, GDPR/CCPA/PIPEDA. | R5 § V4, V8, R6 § PS.1, R1 § Security, R2 § Security | **0:** no isolation; one tenant sees another's data. **1:** partial isolation (auth, no row-level). **2:** RLS + per-tenant secrets + PII catalog. **3:** RLS + per-tenant encryption + PII catalog + data subject access request (DSAR) flow + privacy impact assessment. |
| **L53** | Input validation & sanitization | All public-API inputs are validated; SQL injection / XSS / command injection prevented. SOTA 2026: `validator` (Rust), Pydantic v2 (Python), OWASP ASVS V5, `sqlx` (parameterized queries), `html_escape`. | R5 § V5, R6 § PW.4, R7 § Implementation | **0:** string concatenation in queries / no validation. **1:** ad-hoc checks. **2:** Pydantic/`validator` at API boundary + parameterized queries. **3:** type-driven validation + `validator` derive + fuzzing input parser + OWASP ASVS V5 verification. |
| **L54** | Dependency policy | Dependency policy is documented; security-relevant choices are explained. SOTA 2026: `deny.toml`, `cargo-deny`, `npm audit`, `pip-audit`, `cargo-vet` (multi-party review). ADR-016: fork-only-not-rewrite for SOTA libs. | R5 § V14, R6 § PS.1, PW.3, R11 gold, ADR-016 | **0:** dependencies accepted by name only. **1:** `deny.toml` exists but not enforced. **2:** `deny.toml` enforced in CI + license + RUSTSEC + bans. **3:** `deny.toml` + `cargo-vet` + ADR-016 fork-only policy + signed supply chain. |
| **L55** | Security ops (vuln scanning, patch mgmt) | Vulnerability scanning; patch management; responsible disclosure. SOTA 2026: `dependabot`, `renovate`, `osv-scanner`, `trivy`, security.txt, CVE disclosure process. | R5 § V14, R6 § PS.3, RV.1, R11 gold, R1 § Security, R7 § Release/Response | **0:** no vuln scanning. **1:** `npm audit` ad-hoc. **2:** `dependabot`/`renovate` + security.txt + CVE feed. **3:** dependabot auto-PR + SECURITY.md + private vuln disclosure + 90-day SLA + CVE publication. |

### 3.7 Observability & Ops — L56-L63 (8 pillars)

Observability & Ops pillars measure structured logging, distributed tracing, metrics, health probes, deployment automation, incident response, backup/restore, and capacity planning. Anchored primarily to Google SRE Book (Ch 2-34), CNCF § Observable, and AWS WAF § Reliability/Op Excellence. This domain is the **"can the fleet be operated in production?"** answer.

| L# | Pillar | Description | Industry anchors | 0/1/2/3 scoring |
|---|---|---|---|---|
| **L56** | Structured logging | Logs are structured (JSON), with correlation IDs and levels. SOTA 2026: `tracing` + `tracing-subscriber` (Rust), `structlog` (Python), `slog`/`zerolog` (Go), `pino` (Node), `OTLP` export. Phenotype: `pheno-tracing` canonical per ADR-012. | R9 Ch 8-10, R10 § Observable, R1 § Reliability, R2 § Reliability | **0:** `println!` / `print()`. **1:** `log` crate / stdlib logging. **2:** `tracing` + JSON output + correlation IDs. **3:** `pheno-tracing` (ADR-012) + OTLP export + sampling config + per-request trace context. |
| **L57** | Distributed tracing | Traces are emitted with W3C TraceContext; spans cover key operations. SOTA 2026: OpenTelemetry (`opentelemetry`, `opentelemetry-python`, `go.opentelemetry.io/otel`), `tracing-opentelemetry` (Rust), Jaeger, Tempo, `pheno-tracing` (Phenotype). | R9 Ch 8-10, R10 § Observable, R1 § Reliability | **0:** no tracing. **1:** ad-hoc spans. **2:** OpenTelemetry SDK + OTLP export + W3C TraceContext. **3:** OTel + `pheno-tracing` + span coverage > 80% of public API + sampling policy + service map. |
| **L58** | Metrics collection | Prometheus-format metrics exported. SOTA 2026: `prometheus` crate (Rust), `prometheus-client` (Python), `prometheus/client_golang`, OpenMetrics, OTLP metrics. | R9 Ch 8-10, R10 § Observable, R1 § Reliability, R2 § Reliability | **0:** no metrics. **1:** ad-hoc counters. **2:** Prometheus / OTLP metrics + RED/USE method. **3:** Prometheus + RED/USE + SLO metrics + histograms + exemplars + Grafana dashboard. |
| **L59** | Health & readiness probes | Liveness, readiness, startup probes defined. SOTA 2026: `/healthz`, `/readyz`, `/livez` (Kubernetes convention), `actix-web` health, `asyncio` health checks, Go `healthz`. | R9 Ch 8-10, R1 § Reliability, R2 § Reliability | **0:** no health check. **1:** `/healthz` returns 200 always. **2:** liveness vs readiness vs startup separated. **3:** L/R/S separated + dep checks (DB, cache) + circuit-breaker integration. |
| **L60** | Deployment automation | One-command deploy; declarative infra. SOTA 2026: Dockerfile + `docker compose`, Helm charts, Kustomize, `kubectl apply`, Pulumi, Terraform, GitOps (ArgoCD/Flux). | R9 Ch 18-20, R10 § Containerized, R8 § Technical, R1 § Op Excellence, R2 § Op Excellence | **0:** manual deploy. **1:** Dockerfile exists; not used. **2:** Dockerfile + compose + CI deploy. **3:** Dockerfile (multi-stage, distroless) + Helm + GitOps + SBOM in image + signed image. |
| **L61** | Incident response & runbooks | Runbooks, on-call rotation, blameless postmortems. SOTA 2026: incident.io, FireHydrant, Blameless Postmortems template, PagerDuty, Opsgenie, Grafana Incident. | R9 Ch 11-17, R6 § RV.3, R8 § Process, R1 § Op Excellence, R7 § Response | **0:** no runbook. **1:** runbook in some engineer's head. **2:** runbook in repo + on-call rotation. **3:** runbook + on-call + blameless postmortem template + 1 quarterly drill. |
| **L62** | Backup/restore | Data backup automated; restore tested. **N/A = 3 for stateless libraries / services.** SOTA 2026: `pg_dump`/`pgbackrest` (PostgreSQL), `mongodbump`, Velero (K8s), `litestream` (SQLite), WAL-G. | R9 Ch 29-31, R1 § Cost, R2 § Cost | **0:** no backup. **1:** backup run ad-hoc. **2:** automated daily backup + restore test quarterly. **3:** automated + restore tested + PITR + RPO/RTO documented + DR runbook. **N/A:** stateless lib → score 3. |
| **L63** | Capacity planning & SLOs | Resource usage tracked; SLOs defined and met. SOTA 2026: OpenSLO, Grafana SLO, Prometheus recording rules for SLI, VPA/HPA (K8s). | R9 Ch 2-4, R1 § Reliability, R2 § Reliability, R1 § Sustainability, R8 § Process | **0:** no capacity tracking. **1:** manual. **2:** Prometheus + SLO doc + alerts. **3:** SLO + error budget + autoscaling + capacity forecast model. |

### 3.8 Documentation & SSOT — L64-L68 (5 pillars)

Documentation pillars measure the quality of README, SPEC, AGENTS.md/llms.txt, API reference, and tutorial/concept docs. Anchored to Divio (4 doc types) and ISO 25010 § 4.1.4 (Usability). This domain is the **"can a new contributor find the right answer in < 5 min?"** answer.

| L# | Pillar | Description | Industry anchors | 0/1/2/3 scoring |
|---|---|---|---|---|
| **L64** | README quality | README is current, well-structured, and useful. SOTA 2026: `makeareadme.com`, `readme-md-generator`, Diataxis structure, 5-minute quickstart, badges, screenshots. | R4 § 4.1.4, R12 Divio (general) | **0:** no README. **1:** README exists, 1-10 lines. **2:** README with quickstart + install + usage + contribution. **3:** README + quickstart + install + usage + API example + screenshots/diagrams + badges + license + contributing link. |
| **L65** | Spec / SSOT (SPEC.md, SSOT.md) | `SPEC.md` or `SSOT.md` defines the canonical purpose, scope, and non-goals. SOTA 2026: `SPEC.md` (Phenotype convention), `SSOT.md` (Phenotype convention), AWS WAF "design principles" doc, RFC 2119 (MUST/SHOULD/MAY). | R4 § 4.1.4, R12 Divio § Explanation, R1 § Reliability | **0:** no spec. **1:** spec exists, ≤ 1 page. **2:** spec with purpose, scope, non-goals, design. **3:** spec + ADR index + linked from `AGENTS.md` + updated within 90 days. |
| **L66** | LLM-friendly docs (llms.txt) | `llms.txt` present at repo root; AGENTS.md LLM-optimized. SOTA 2026: `llms.txt` is a 2024+ convention; Answer.AI spec; cited as "LLM-friendly repo". | R4 § 4.1.4, (internal convention) | **0:** no llms.txt. **1:** llms.txt exists, ≤ 5 lines. **2:** llms.txt + curated pointers to ADRs/SSOT/ARCHITECTURE. **3:** llms.txt + AGENTS.md + structured (frontmatter) + versioned. |
| **L67** | API reference (cargo doc / typedoc) | API reference is generated, complete, and navigable. SOTA 2026: `cargo doc --no-deps`, `typedoc`, `mkdocs-material`, `docusaurus`, `rustdoc-json`, `swagger-ui`. | R4 § 4.1.4, R12 Divio § Reference | **0:** no API doc. **1:** cargo doc builds. **2:** cargo doc clean + CI + deployed. **3:** cargo doc + search + examples per API + cross-crate + machine-readable (rustdoc-json). |
| **L68** | Tutorial / concept docs (Divio) | Divio's 4 doc types present: Tutorial, How-to, Reference, Explanation. SOTA 2026: Diataxis framework, `mdbook`, `docusaurus`, `nextra` (TS), GitBook. | R12 Divio (all 4 types), R4 § 4.1.4 | **0:** no docs beyond README. **1:** 1 doc type (usually tutorial). **2:** 2 doc types (tutorial + reference). **3:** all 4 Divio types present + searchable + linked from `AGENTS.md`. |

### 3.9 Governance & Sustainability — L69-L71 (3 pillars)

Governance pillars measure license & SPDX, code ownership, and sustainability. Anchored to OpenSSF Best Practices (gold), NIST SSDF PO.1-PO.2, AWS WAF § Sustainability, and DORA § Cultural. This domain is the **"can the project outlive its current maintainers?"** answer.

| L# | Pillar | Description | Industry anchors | 0/1/2/3 scoring |
|---|---|---|---|---|
| **L69** | License & SPDX | LICENSE file present; SPDX-License-Identifier in source headers; license is OSI-approved. SOTA 2026: `SPDX-License-Identifier` headers, `REUSE` (FSFE), `cargo-deny` license check. | R11 passing, R9 Ch 18-20, R6 § PO.1, R1 § Op Excellence, R7 § Release | **0:** no license. **1:** LICENSE file only. **2:** LICENSE + SPDX headers in source + `cargo-deny` license check. **3:** LICENSE + SPDX headers + `deny.toml` license allowlist + `REUSE` compliance. |
| **L70** | Code ownership & governance | CODEOWNERS file; governance model documented. SOTA 2026: GitHub `CODEOWNERS`, `GOVERNANCE.md` (CNCF style), BDFL / PMC / community / foundation. | R11 gold, R6 § PO.2, R8 § Cultural, R1 § Sustainability, R7 § Response | **0:** no CODEOWNERS. **1:** CODEOWNERS + 1 owner per dir. **2:** CODEOWNERS + governance doc (BDFL/PMC/etc.) + branch protection requires review. **3:** CODEOWNERS + governance + branch protection + 2-reviewer rule + escalation policy. |
| **L71** | Sustainability (roadmap, funding, contributor pipeline) | ROADMAP exists; FUNDING.yml present; contributor pipeline visible. SOTA 2026: ROADMAP.md, FUNDING.yml (GitHub), Open Collective, FOSSA, contributor ladder (CNCF), sustainability doc. | R1 § Sustainability, R8 § Cultural, R6 § PO.2, R11 gold | **0:** no roadmap or funding. **1:** ROADMAP.md exists, stale. **2:** ROADMAP.md + FUNDING.yml + CHANGELOG cadence. **3:** ROADMAP.md + FUNDING.yml + contributor ladder + quarterly review + succession plan. |

### 3.10 Pillar count verification

| Domain | Range | Count | Sum check |
|---|---|---|---|
| Architecture (AX) | L1-L12 | 12 | 12 |
| Performance | L13-L19 | 7 | 19 |
| Quality / Correctness | L20-L27 | 8 | 27 |
| Developer Experience (DX) | L28-L37 | 10 | 37 |
| User Experience (UX) | L38-L45 | 8 | 45 |
| Security | L46-L55 | 10 | 55 |
| Observability & Ops | L56-L63 | 8 | 63 |
| Documentation & SSOT | L64-L68 | 5 | 68 |
| Governance & Sustainability | L69-L71 | 3 | 71 |
| **Total** | **L1-L71** | **71** | **71** |

Verification: `12 + 7 + 8 + 10 + 8 + 10 + 8 + 5 + 3 = 71`. ✓

---

## 4. Scoring Methodology

### 4.1 The 0/1/2/3 rubric

Each pillar is scored **0-3 per repo** using the same rubric across all 71 pillars. The rubric is the same one used by the prior 30-pillar audit (`audit-30-pillar-2026-06-16.md`) and the wrap-up audit (`audit-71-pillar-2026-06-17-wrapup.md`).

| Score | Label | Definition | Observable signals (per-pillar) |
|---|---|---|---|
| **0** | Absent | Pillar is not present; no evidence of the concern in the repo. | No file/ADR/doc covers this concern. |
| **1** | Minimal | Pillar is partially present; scaffold or one-off; not enforced. | One ad-hoc file or doc; not in CI; not a recurring practice. |
| **2** | Adequate | Pillar is present and enforced at the basic level. | Pillar is in CI or documented; some automation; some manual review. |
| **3** | Strong / SOTA | Pillar is fully in place, automated, measured, and continuously improved. | Pillar has automated enforcement + measurement + SOTA tooling + documentation. |

### 4.2 Pillar score formula

For repo `R` and pillar `L_n`:

```
score(R, L_n) ∈ {0, 1, 2, 3, n/a}
```

Per-pillar scores are summed to produce per-domain and per-repo totals. The 71-pillar scorecard uses a normalized percentage (sum / 213 * 100) for cross-repo comparison.

**Maximum possible:** 71 * 3 = **213**.

### 4.3 Domain aggregation

Per-domain aggregate = sum of pillar scores / (3 * pillar count in domain).

| Domain | Pillars | Max | Example calc |
|---|---|---|---|
| Architecture (AX) | 12 | 36 | 27/36 = 75% |
| Performance | 7 | 21 | 15/21 = 71% |
| Quality / Correctness | 8 | 24 | 18/24 = 75% |
| Developer Experience (DX) | 10 | 30 | 21/30 = 70% |
| User Experience (UX) | 8 | 24 | 18/24 = 75% |
| Security | 10 | 30 | 18/30 = 60% |
| Observability & Ops | 8 | 24 | 18/24 = 75% |
| Documentation & SSOT | 5 | 15 | 12/15 = 80% |
| Governance & Sustainability | 3 | 9 | 9/9 = 100% |
| **Total** | **71** | **213** | **156/213 = 73%** |

### 4.4 N/A = 3 rule

Per `audit-30-pillar-template.md` and AGENTS.md § 71-pillar audit, the N/A rule is:

> If a pillar is **not applicable** to a repo (e.g., i18n on a headless backend library, a11y on a CLI tool, backup/restore on a stateless service), the pillar is scored **3 (N/A = 3)** and excluded from the denominator for the per-repo percentage.

**Specific N/A assignments for the Phenotype fleet:**

| Pillar | N/A for | Reason |
|---|---|---|
| L40 (i18n) | Headless backend libs, CLI tools, federated service internals | No UI surface to translate |
| L41 (a11y) | Headless backend libs, CLI tools, federated service internals | No UI surface for screen readers / contrast |
| L62 (Backup/restore) | Stateless libraries, CLI tools, ephemeral services | No persistent data to back up |

For L40, L41: when scoring a UI-bearing service (e.g., `phenotype-landing`, `phenotype-hub`'s admin console), score 0-3 normally per the rubric.

For L62: when scoring a data-bearing service (e.g., `phenoMCP` with persistent state, `phenoObservability` with metrics DB, `phenoEvents` with event store), score 0-3 normally per the rubric.

### 4.5 Score status glyphs (per repo, in scorecard)

| Glyph | Status | Score range | Meaning |
|---|---|---|---|
| (none) | healthy | 3 | Strong / SOTA |
| (none) | partial | 1-2 | Adequate or minimal; remediation in progress |
| (none) | blocked | 0-2 | Cannot be remediated without external input (e.g., infra decision, LFS recovery) |
| (none) | failing | 0 | Absent; remediation is open work |
| n/a | not applicable | n/a (treated as 3) | Pillar not relevant to repo type (see § 4.4) |

The glyphs are kept in textual form (`healthy`, `partial`, `blocked`, `failing`, `n/a`) per the user rule on no emojis; the wrap-up audit uses `✓ △ ⚠ ✗` which are unicode symbols (not emojis) and acceptable in scorecard tables.

### 4.6 Worked examples (3 pillars across 3 repos)

To make the rubric concrete, here are three example scorings from the wrap-up audit (`audit-71-pillar-2026-06-17-wrapup.md`).

**Example 1: L30 (Build cache) on `phenotype-hub`**

| Score | Evidence |
|---|---|
| (decision) | **3 (Strong / SOTA)** |
| Why | `sccache` configured in `.cargo/config.toml`; `cargo-chef` in Dockerfile; CI uses Buildkite remote cache. Cold build < 90s, incremental < 10s. |

**Example 2: L66 (LLM-friendly docs) on `pheno-mcp-router`**

| Score | Evidence |
|---|---|
| (decision) | **1 (Minimal)** |
| Why | `llms.txt` exists at repo root but is 3 lines (just a title). No `AGENTS.md`. No structured pointers to ADRs/SSOT. |

**Example 3: L40 (i18n) on `pheno-tracing`**

| Score | Evidence |
|---|---|
| (decision) | **n/a → 3 (N/A)** |
| Why | `pheno-tracing` is a headless Rust library for OpenTelemetry-style tracing; no user-facing strings. N/A rule applies. |

### 4.7 Scoring confidence

The first run (2026-06-17 wrap-up) used **manual scoring**. Future runs are expected to use a mix of:

1. **Automated signal probes** (file existence, CI presence, license header grep, `cargo-deny` output) — used by the prior 30-pillar audit and by `pheno-secret-scan`.
2. **Manual review** for pillars that need judgment (L1 architecture quality, L48 threat model depth, L63 SLO quality).
3. **Subagent dispatch** (Forge CLI / Droid CLI) for parallel pillar scoring across repos per the dispatch-mcp consolidation (ADR-008).

### 4.8 Score stability

Pillar scores are expected to be **stable** week-over-week. A pillar that changes by ±1 between weeks is normal (a CI fix landed, a doc was added). A change of ±2 in a single week is a signal of major work; a change of ±3 in a single week is rare and likely indicates either a misinterpretation of the pillar or a major rewrite.

---

## 5. Refresh Cadence

### 5.1 Weekly refresh

The 71-pillar scorecard is refreshed **every Monday at 09:00 PDT** by the worklog-schema circle. The schedule aligns with the Phenotype Monday planning rhythm (see `STATUS.md` and `plans/2026-06-17-v7-dag-stable.md`).

| Item | Location | Cadence |
|---|---|---|
| Live scorecard | `findings/71-pillar-{date}.md` | Weekly (Mon 09:00 PDT) |
| Schema doc (this file) | `findings/71-pillar-2026-06-17-schema.md` | Quarterly review |
| Crosswalk to 30-pillar | `findings/71-pillar-2026-06-17-mapping.md` | Quarterly review |
| Week-over-week diff | `findings/71-pillar-{date}-delta.md` | Weekly (Mon 09:00 PDT) |
| Per-repo readiness (Factory AI Levels 1-5) | `STATUS.md` § "Factory AI Agent Readiness" | Weekly (Mon 09:00 PDT) |

### 5.2 The delta log

Each weekly scorecard produces a delta log that captures:

- Per-pillar per-repo score changes (Δ ≥ 1)
- Newly added repos (and their first score)
- Newly removed/repos archived (and their last score)
- Pillar schema changes (if any — usually none, only on quarterly review)
- Industry reference updates (if any — e.g., OWASP ASVS v5 release)
- Worklog-schema circle notes

Delta logs accumulate: `findings/71-pillar-2026-06-17-delta.md`, `findings/71-pillar-2026-06-24-delta.md`, etc.

### 5.3 Quarterly review

Every 90 days, the worklog-schema circle:

1. Re-reads this schema doc.
2. Reviews the 12 industry references for new versions (e.g., OWASP ASVS v5).
3. Reviews the 71-pillar set for additions/deletions (rare; requires ADR).
4. Re-benchmarks the scoring rubric against 2-3 SOTA reference repos.
5. Updates the crosswalk to the 30-pillar audit (now-defunct internal review).
6. Bumps the schema version (e.g., 1.0 → 1.1) and writes release notes.

Quarterly reviews are tracked as L5- or L6-level work in the FLEET DAG (see `FLEET_DAG_v3.md`).

### 5.4 Owner: worklog-schema circle

The worklog-schema circle is the canonical owner of the 71-pillar framework. It is responsible for:

- Weekly refresh execution
- Quarterly schema review
- Adjudicating scoring disputes (e.g., "is `pheno-otel`'s OTel export 2 or 3 on L57?")
- Cross-linking with the Factory AI Readiness Model (ADR-026)
- ADR-024 conformance
- Bumping the worklog schema (currently v2.0; v2.1 per ADR-025 pending the `device:` field)

The worklog-schema circle is named in `AGENTS.md` and `STATUS.md` and meets on the Phenotype Monday planning call.

### 5.5 Tools used in the refresh

- **`fs_search` / `ripgrep`** — file existence, ADR presence, `deny.toml` content.
- **`cargo` subcommands** — `cargo metadata`, `cargo-deny`, `cargo-audit`, `cargo-semver-checks`, `cargo-tarpaulin`, `cargo-llvm-cov`, `cargo-machete`, `cargo-geiger`.
- **`pheno-secret-scan`** (Phenotype internal) — secret leak detection, parallel to `gitleaks`/`trufflehog`.
- **`gh` CLI** — branch protection status, CODEOWNERS, security policy, public roadmap.
- **`/readiness-report`** (Droid CLI, Factory AI integration per ADR-026) — Factory AI Levels 1-5 per-repo report.
- **Subagent dispatch via dispatch-mcp** — parallel scoring across repos in the fleet.

---

## 6. Cross-References

### 6.1 ADR-024 (71-pillar framework adoption)

`docs/adr/2026-06-17/ADR-024-71-pillar-audit-framework.md` is the ADR that adopted this framework. Key references:

- ADR-024 § Decision: 9-domain layout (this schema, L1-L71) supersedes the 30-pillar as the *internal scoring model only*. The 30 technical pillars are preserved verbatim as L1-L30 in the new numbering.
- ADR-024 § Cadence: weekly (every Monday 09:00 PDT). Scorecard at `findings/71-pillar-{date}.md`.
- ADR-024 § Mitigations: the 30-pillar files (`audit-30-pillar-L*.md`) remain authoritative for L1-L30; the 71-pillar is a rollup. The Factory AI Readiness Model (ADR-026) provides the *depth* view.

### 6.2 AGENTS.md § 71-pillar audit

`AGENTS.md` lines 205-225 define the canonical taxonomy that this schema implements. The exact ranges (L1-L12, L13-L19, ..., L69-L71) are the **single source of truth** for pillar numbering. Any change to those ranges requires an ADR.

### 6.3 The 30-pillar audit (`findings/30-pillar-2026-06-16.md`)

The 30-pillar audit is preserved as L1-L30 in the new numbering (with the AX/Performance/Quality/DX/UX/Security/Ops/Architecture domains collapsed into 8 of the 9 new domains). The crosswalk is:

| 30-pillar (L#) | 71-pillar (L#) | Pillar (preserved) | Status |
|---|---|---|---|
| L1 | L1 | Architecture foundations | Preserved verbatim |
| L2 | L2 | Module structure & boundaries | Preserved verbatim |
| L3 | L3 | API surface & contract | Preserved verbatim |
| L4 | L4 | Data model & state management | Preserved verbatim |
| L5 | L5 | Async/concurrency design | Preserved verbatim |
| L6 | L56 (new) | Observability (logs/metrics/traces) | Moved to Observability & Ops domain; pillar L57-L58 are expansions |
| L7 | L13 | Performance budgets & profiling | Preserved verbatim |
| L8 | L15 | Concurrency safety & races | Preserved verbatim |
| L9 | L14 | Memory & allocation | Preserved verbatim |
| L10 | L36 (renamed) | Build & release pipeline | Mapped to DX (L36 = CI loop time) and Observability & Ops (L60 = deploy automation) |
| L11 | L28 (renamed) | CI/CD hygiene (SHA-pins, ubuntu) | Mapped to DX (L28 = local dev setup, L29 = test speed) |
| L12 | L20 | Test coverage & quality gates | Preserved verbatim |
| L13 | L64 (renamed) | Documentation & SSOT | Mapped to Documentation & SSOT domain (L64 = README quality) |
| L14 | L38 (renamed) | Onboarding & contributor DX | Mapped to UX (L38 = onboarding) |
| L15 | L42 (renamed) | Error handling & user feedback | Mapped to UX (L42 = error messages) |
| L16 | L43 (renamed) | CLI/UX & ergonomics | Mapped to UX (L43 = CLI discoverability) |
| L17 | L40 (renamed) | Internationalization (i18n/l10n) | Mapped to UX (L40 = i18n) |
| L18 | L41 (renamed) | Accessibility (a11y) | Mapped to UX (L41 = a11y) |
| L19 | L46 | Secret management | Preserved verbatim |
| L20 | L47 | Supply-chain security (SBOM/CVE) | Preserved verbatim |
| L21 | L48 | Threat model & attack surface | Preserved verbatim |
| L22 | L49 | AuthN/AuthZ (OAuth/SAML/JWT) | Preserved verbatim |
| L23 | L50 | Cryptography & key management | Preserved verbatim |
| L24 | L51 | Audit log & compliance | Preserved verbatim |
| L25 | L52 | Multi-tenant isolation & data privacy | Preserved verbatim |
| L26 | L16 (renamed) | Resource limits & rate limits | Mapped to Performance (L16) |
| L27 | L26 (renamed) | Resilience (retries/backoff/circuit) | Mapped to Performance (L26 → Pillar L26 in Performance) — note: L26 in 71-pillar is the *same* number as L26 in 30-pillar but a different domain |
| L28 | L15 (renamed) | Observability of failure modes | Mapped to Performance (L15 → concurrency safety covers this) |
| L29 | L54 (renamed) | Dependency hygiene & CVEs | Mapped to Security (L54) |
| L30 | L69-L71 (expanded) | Repository governance (license/CODEOWNERS/CHANGELOG) | Expanded to 3 pillars: L69 (license), L70 (CODEOWNERS/governance), L71 (sustainability) |

**Renumbering note:** the 30-pillar audit used `L1` for "Architecture foundations" and continued through `L30` for "Repository governance". The 71-pillar keeps the same `L1-L5` (AX) and `L7` (Performance → L13), `L8` (Quality → L15), `L19` (Security → L46), etc. The crosswalk is non-trivial because the 71-pillar is a *superset*, not a one-to-one mapping. The `findings/71-pillar-2026-06-17-mapping.md` file is the canonical crosswalk.

### 6.4 The wrap-up audit (`audit-71-pillar-2026-06-17-wrapup.md`)

`audit-71-pillar-2026-06-17-wrapup.md` is the **first audit** scored against the 71-pillar framework. It covers 4 targeted repos (AgilePlus, pheno, dispatch-mcp, phenotype-ops) plus monorepo (repos/) state, plus 4 worktrees (l4-80-wt, l4-68, audit-30pillar, main). It also contains:

- Section 8.2: the **prior** 71-pillar list (using L0-L71 numbering with 6 domains A-G) — superseded by this schema doc.
- Section 10: the **Factory AI Readiness Model crosswalk** (ADR-026) — the *depth* view that complements this schema's *breadth* view.
- Per-repo readiness estimates (AgilePlus = Level 2; pheno = Level 2; dispatch-mcp = Level 1; phenotype-ops = Level 1; org = Level 1).

The wrap-up audit also serves as the **scoring example** for this schema: every pillar score in the wrap-up is a worked example of the 0-3 rubric in § 4.

### 6.5 Companion files

| File | Purpose | Authoritative? |
|---|---|---|
| `findings/71-pillar-2026-06-17-schema.md` (this file) | Schema reference | **YES** for pillar definitions, taxonomy, industry anchors, scoring rubric |
| `findings/71-pillar-2026-06-17.md` | Live scorecard | **YES** for per-repo scores as of the date |
| `findings/71-pillar-2026-06-17-mapping.md` | L1-L30 → L1-L71 crosswalk | **YES** for reconciling the 30-pillar audit |
| `findings/71-pillar-{date}-delta.md` | Week-over-week diff | **YES** for the date in the filename |
| `audit-71-pillar-2026-06-17-wrapup.md` | First wrap-up audit + Factory AI crosswalk | **YES** for the first run + ADR-026 crosswalk |
| `audit-30-pillar-2026-06-16.md` | Prior 30-pillar audit | **YES** for L1-L30 in the old numbering (preserved) |
| `audit-30-pillar-L0..L29.md` | 30 per-pillar audit files | **YES** for L1-L30 deep dives |
| `docs/adr/2026-06-17/ADR-024-71-pillar-audit-framework.md` | Decision record | **YES** for adoption rationale |
| `docs/adr/2026-06-17/ADR-026-factory-ai-agent-readiness.md` | External standard crosswalk | **YES** for Factory AI integration |
| `AGENTS.md` § "71-pillar audit (this turn)" | High-level summary + taxonomy | **YES** for the 9-domain ranges |
| `STATUS.md` § "Factory AI Agent Readiness" | Per-repo Factory AI Level | (not authoritative for 71-pillar scores) |

### 6.6 Adjacent ADRs

- **ADR-008** (dispatch-mcp as sole MCP server) — operational anchor for the weekly refresh tooling.
- **ADR-012** (`pheno-tracing` canonical across pheno-* repos) — anchors L56-L58 (structured logging, distributed tracing, metrics).
- **ADR-014** (Hexagonal L4 ports: Port trait + Adapter impl) — anchors L6.
- **ADR-016** (Fork-only-not-rewrite policy) — anchors L10, L54.
- **ADR-018** (PRCP pattern) — anchors L7.
- **ADR-022** (Config consolidation — two-crate canonical split) — anchors L12 (Portability of config), and indirectly L1, L4, L8.
- **ADR-023** (App-level repo triage & app substrate placement) — anchors L8 (Substrate placement).
- **ADR-025** (Worklog v2.1 `device:` field) — anchors L39 (AGENTS.md quality) and the device-fit gate.
- **ADR-026** (Factory AI Agent Readiness Model) — the *depth* cross-cutting external standard.
- **ADR-027** (Git LFS strategy) — anchors L33 (Debug tooling) for LFS-specific concerns.

### 6.7 Decision tree: when to update the schema

The schema is **stable** by design. Changes are rare and require an ADR. The decision tree:

| Change | Required action |
|---|---|
| Add a new pillar | New ADR (L6+ level); bumps schema to next minor (1.0 → 1.1) |
| Remove a pillar | New ADR (L6+ level); bumps schema to next major (1.0 → 2.0) |
| Rename a pillar | New ADR (L5 level); bumps schema to next minor |
| Reorder pillars within a domain | New ADR (L5 level); bumps schema to next minor |
| Add a new industry reference | New ADR (L5 level); bumps schema to next minor |
| Update an existing industry reference to a new version (e.g., ASVS v4 → v5) | New ADR (L5 level); bumps schema to next minor |
| Adjust a 0/1/2/3 rubric description | Worklog-schema circle consensus; bumps schema to next patch (1.0.0 → 1.0.1) |
| Add a new N/A assignment (e.g., L66 N/A for some new repo type) | Worklog-schema circle consensus; no version bump |

All schema changes are recorded in the worklog-schema circle's decision log (`findings/{date}-L5-102-71-pillar-audit.md` is the 2026-06-17 log; subsequent logs are dated).

## 7. Appendix A: Signal Probes (per-pillar)

This appendix lists the **concrete file/command signals** that the worklog-schema circle uses when scoring a pillar. The signal probes are tier-1 (must be present) and tier-2 (strengthen the score). All probes are non-destructive read-only commands; the scoring tool never modifies the target repo.

| Pillar | Tier-1 signal (must be present for score ≥ 2) | Tier-2 signal (boosts to score 3) |
|---|---|---|
| **L1** | `ARCHITECTURE.md` or `docs/architecture.md` exists | Has diagrams (Mermaid/ASCII) + linked from AGENTS.md |
| **L2** | `cargo metadata` shows no circular deps; layered structure | `cargo-deny` clean + dependency-cruiser/madge clean |
| **L3** | `cargo doc` builds; semver honored; changelog | `cargo-semver-checks` in CI + machine-readable API spec |
| **L4** | Types + validation (Pydantic/schemars/zod) | Domain entities in `domain/` per ADR-014 + OpenAPI export |
| **L5** | Explicit runtime choice; `Send + 'static` verified | `loom`/`tla+` model check + cancellation tokens |
| **L6** | Ports in `ports/` or `traits/`; adapters in `adapters/` | ADR-014 "Port + Adapter" pattern + per-port single trait file |
| **L7** | Explicit FFI layer; shared types via pheno-pydantic-models | ADR-018 PRCP pattern + language-specific adapters |
| **L8** | Every new capability in one of 4 substrate types per ADR-023 | Substrate table in AGENTS.md + CODEOWNERS enforcement |
| **L9** | `Cargo.toml` workspace with `[workspace]` | `pheno-cargo-template` layout + `[workspace.dependencies]` |
| **L10** | `cargo-semver-checks` in CI | Fork-only discipline per ADR-016 + 1-patch deprecation cycle |
| **L11** | Extension points documented + sample | ABI-stable versioned + extension contract semver |
| **L12** | CI matrix: Linux + macOS | Linux arm64 + Windows + musl + Docker multi-arch |
| **L13** | `criterion`/`pytest-benchmark` benchmarks in CI | SLO.md + automated regression alerts |
| **L14** | `dhat`/`memray`/`pprof` in CI for hot path | `cargo-bloat` size budget + zero-copy where applicable |
| **L15** | `-race` (Go) or `Send+Sync` check in CI | `loom`/`tla+` + `tokio-console` + `parking_lot::deadlock` |
| **L16** | `governor`/equivalent in code | Per-tenant limits + backpressure + observability hook on reject |
| **L17** | `sccache` configured; cold build < 5min | `mold` linker + `cargo-chef` Docker layer + cold build < 2min |
| **L18** | P50/P95/P99 in CI per benchmark | Regression > 5% fails CI + flamegraph artifact |
| **L19** | Load test in CI (k6/wrk) | SLO-based throughput assertion + cost-per-1k-req tracked |
| **L20** | Coverage gate at 60% enforced in CI | Threshold per ADR-023 (80/70/60) + per-domain sub-gates |
| **L21** | Flaky tests quarantined; CI pass rate > 95% | Zero flaky + `cargo nextest` + CI pass rate > 99% |
| **L22** | Linter enforced in CI; zero warnings | `clippy::pedantic` + `semgrep` custom rules + IDE integration |
| **L23** | Formatter enforced in CI | Imports sorted + style guide doc + `deny.toml` style |
| **L24** | Typed errors + `thiserror`/`anyhow`; no `unwrap` in lib | `Error` trait impls + OTel error attributes + `phenotype-error-core` envelope |
| **L25** | `unsafe` lint + `cargo-geiger` | `#[deny(unsafe_op_in_unsafe_fn)]` + Miri + sanitizers in CI |
| **L26** | `proptest` + `cargo-fuzz` in CI for critical paths | Structured fuzz corpus + 24h weekly fuzz run + stateful testing |
| **L27** | `clippy-complexity` clean; `jscpd` < 5% | Complexity budget + `jscpd` < 3% + duplication refactored into shared substrate |
| **L28** | `just setup` / `Taskfile.yml` runs to clean state | Devcontainer + `mise.toml` + 1-command quickstart |
| **L29** | Unit < 30s, full < 5min via `cargo nextest`/xdist | Unit < 10s + full < 2min + test sharding + per-test timing |
| **L30** | sccache/maturin/turborepo configured | Remote cache (bazel-remote) + cargo-chef + CI cache |
| **L31** | lefthook/husky configured + format + lint + deny | Semgrep + secrets (gitleaks/trufflehog) + commit-msg lint |
| **L32** | editorconfig + .vscode/settings.json + rust-analyzer.json | .vscode + .idea + rust-analyzer + pyright + shared debug launch config |
| **L33** | `cargo-flamegraph` + `tokio-console` work | `py-spy` + lldb in CI + `pheno-otel` traces in dev |
| **L34** | Scaffold tool exists + template | `pheno-scaffold-kit` + ADRs auto-generated + CI template |
| **L35** | Migration tool configured | Migration tool + versioned scripts + CI migration test |
| **L36** | CI < 10min for unit | CI < 5min + test sharding + remote cache + selective runs |
| **L37** | cargo doc clean + CI + deployed to GitHub Pages | Doc CI + doctests + API JSON + mdbook |
| **L38** | Verified quickstart in < 10 min from clean clone | Quickstart < 5 min + 2nd party verified + recorded video |
| **L39** | AGENTS.md current + links to ADRs | AGENTS.md + llms.txt + ADR index + auto-updated by CI |
| **L40** | All strings externalized; 2+ locales | i18n + RTL + locale-aware date/number + CI locale test. **N/A on headless** |
| **L41** | WCAG 2.2 AA + `axe-core` clean | WCAG 2.2 AAA + screen reader tested + `axe` clean + keyboard nav. **N/A on headless** |
| **L42** | "what + why" + actionable fix suggestion | "what + why + fix" + `miette`/`color-eyre` + links to docs |
| **L43** | Help complete for all subcommands + examples | Help + examples + `clap_complete` + man page + `tldr` page |
| **L44** | Progress bar/spinner on long ops | Progress + ETA + cancelable + observability hook on cancel |
| **L45** | `examples/` dir + doctests | Examples + doctests + tutorial in `docs/` + YouTube + `cargo run --example` list |
| **L46** | Secrets in vault + `secrecy`/`SecretStr` + CI scan | Vault + auto-rotation + audit + gitleaks + trufflehog + `.env.example` |
| **L47** | SBOM generated in CI + `cargo-deny` + `osv-scanner` clean | Signed SBOM (in-toto) + SLSA L3 + pinned hashes + `dependabot` |
| **L48** | STRIDE doc for major components | STRIDE + attack tree + reviewed annually + linked from ADR |
| **L49** | OIDC/OAuth + RBAC + auth tests | OIDC + MFA + WorkOS + ABAC + threat model + rate limit on auth |
| **L50** | `ring`/`aws-lc-rs` + key rotation policy | `aws-lc-rs` + FIPS + HSM/KMS + rotation + audit + post-quantum ready |
| **L51** | Structured audit log + retention + access control on log | WORM storage + SOC 2 evidence + tamper-evident (hash chain) |
| **L52** | RLS + per-tenant secrets + PII catalog | RLS + per-tenant encryption + PII catalog + DSAR flow + privacy impact assessment |
| **L53** | Pydantic/`validator` at API boundary + parameterized queries | Type-driven validation + `validator` derive + fuzzing input parser + OWASP ASVS V5 |
| **L54** | `deny.toml` enforced in CI + license + RUSTSEC + bans | `deny.toml` + `cargo-vet` + ADR-016 fork-only + signed supply chain |
| **L55** | `dependabot`/`renovate` + security.txt + CVE feed | Auto-PR + SECURITY.md + private vuln disclosure + 90-day SLA + CVE publication |
| **L56** | `tracing` + JSON output + correlation IDs | `pheno-tracing` (ADR-012) + OTLP export + sampling config + per-request trace context |
| **L57** | OpenTelemetry SDK + OTLP export + W3C TraceContext | OTel + `pheno-tracing` + span coverage > 80% + sampling policy + service map |
| **L58** | Prometheus / OTLP metrics + RED/USE method | Prometheus + RED/USE + SLO metrics + histograms + exemplars + Grafana dashboard |
| **L59** | Liveness vs readiness vs startup separated | L/R/S separated + dep checks (DB, cache) + circuit-breaker integration |
| **L60** | Dockerfile + compose + CI deploy | Dockerfile (multi-stage, distroless) + Helm + GitOps + SBOM in image + signed image |
| **L61** | Runbook in repo + on-call rotation | Runbook + on-call + blameless postmortem template + 1 quarterly drill |
| **L62** | Automated daily backup + restore test quarterly | Automated + restore tested + PITR + RPO/RTO documented + DR runbook. **N/A on stateless** |
| **L63** | Prometheus + SLO doc + alerts | SLO + error budget + autoscaling + capacity forecast model |
| **L64** | README with quickstart + install + usage + contribution | README + quickstart + install + usage + API example + screenshots + badges + license |
| **L65** | Spec with purpose, scope, non-goals, design | Spec + ADR index + linked from AGENTS.md + updated within 90 days |
| **L66** | llms.txt + curated pointers to ADRs/SSOT/ARCHITECTURE | llms.txt + AGENTS.md + structured (frontmatter) + versioned |
| **L67** | cargo doc clean + CI + deployed | cargo doc + search + examples per API + cross-crate + machine-readable (rustdoc-json) |
| **L68** | 2 Divio doc types (tutorial + reference) | All 4 Divio types present + searchable + linked from AGENTS.md |
| **L69** | LICENSE + SPDX headers in source + `cargo-deny` license check | LICENSE + SPDX headers + `deny.toml` license allowlist + `REUSE` compliance |
| **L70** | CODEOWNERS + governance doc (BDFL/PMC/etc.) + branch protection | CODEOWNERS + governance + branch protection + 2-reviewer rule + escalation policy |
| **L71** | ROADMAP.md + FUNDING.yml + CHANGELOG cadence | ROADMAP.md + FUNDING.yml + contributor ladder + quarterly review + succession plan |

---

## 8. Appendix B: Pillar Quick Reference (all 71)

Single-table compact reference. The 71 pillars in canonical order.

| L# | Pillar (short) | Domain | Max | N/A eligible? |
|---|---|---|---:|---|
| L1 | Architecture foundations | AX | 3 | no |
| L2 | Module structure & boundaries | AX | 3 | no |
| L3 | API surface & contract | AX | 3 | no |
| L4 | Data model & state management | AX | 3 | no |
| L5 | Async/concurrency design | AX | 3 | no |
| L6 | Hexagonal port/adapter discipline | AX | 3 | no |
| L7 | Polyglot strategy | AX | 3 | no |
| L8 | Substrate placement | AX | 3 | no |
| L9 | Cargo workspace topology | AX | 3 | no |
| L10 | Backward compatibility | AX | 3 | no |
| L11 | Extensibility | AX | 3 | no |
| L12 | Portability | AX | 3 | no |
| L13 | Performance budgets & SLOs | Performance | 3 | no |
| L14 | Memory & allocation profile | Performance | 3 | no |
| L15 | Concurrency safety & races | Performance | 3 | no |
| L16 | Resource limits & rate limits | Performance | 3 | no |
| L17 | Build performance | Performance | 3 | no |
| L18 | Runtime latency | Performance | 3 | no |
| L19 | Throughput | Performance | 3 | no |
| L20 | Test coverage & quality gates | Quality | 3 | no |
| L21 | Test health | Quality | 3 | no |
| L22 | Linting & static analysis | Quality | 3 | no |
| L23 | Formatting & style consistency | Quality | 3 | no |
| L24 | Type system & error handling | Quality | 3 | no |
| L25 | Memory safety | Quality | 3 | no |
| L26 | Property/fuzz testing | Quality | 3 | no |
| L27 | Code complexity & duplication | Quality | 3 | no |
| L28 | Local dev setup | DX | 3 | no |
| L29 | Test speed | DX | 3 | no |
| L30 | Build cache | DX | 3 | no |
| L31 | Pre-commit hooks | DX | 3 | no |
| L32 | Editor/IDE config | DX | 3 | no |
| L33 | Debug tooling | DX | 3 | no |
| L34 | Code generation / scaffolding | DX | 3 | no |
| L35 | Migration tooling | DX | 3 | no |
| L36 | CI loop time | DX | 3 | no |
| L37 | Doc generation | DX | 3 | no |
| L38 | Onboarding: clone-to-first-build | UX | 3 | no |
| L39 | AGENTS.md quality & freshness | UX | 3 | no |
| L40 | Internationalization (i18n) | UX | 3 | **yes** (headless) |
| L41 | Accessibility (a11y) | UX | 3 | **yes** (headless) |
| L42 | Error messages: human-readable | UX | 3 | no |
| L43 | CLI discoverability | UX | 3 | no |
| L44 | Progress indication | UX | 3 | no |
| L45 | Help & examples | UX | 3 | no |
| L46 | Secret management | Security | 3 | no |
| L47 | Supply-chain security (SBOM/CVE) | Security | 3 | no |
| L48 | Threat model & attack surface | Security | 3 | no |
| L49 | AuthN/AuthZ | Security | 3 | no |
| L50 | Cryptography & key management | Security | 3 | no |
| L51 | Audit log & compliance | Security | 3 | no |
| L52 | Multi-tenant isolation & data privacy | Security | 3 | no |
| L53 | Input validation & sanitization | Security | 3 | no |
| L54 | Dependency policy | Security | 3 | no |
| L55 | Security ops (vuln scanning, patch mgmt) | Security | 3 | no |
| L56 | Structured logging | Obs & Ops | 3 | no |
| L57 | Distributed tracing | Obs & Ops | 3 | no |
| L58 | Metrics collection | Obs & Ops | 3 | no |
| L59 | Health & readiness probes | Obs & Ops | 3 | no |
| L60 | Deployment automation | Obs & Ops | 3 | no (N/A for libs, see §4.4) |
| L61 | Incident response & runbooks | Obs & Ops | 3 | no |
| L62 | Backup/restore | Obs & Ops | 3 | **yes** (stateless) |
| L63 | Capacity planning & SLOs | Obs & Ops | 3 | no (N/A for libs, see §4.4) |
| L64 | README quality | Doc & SSOT | 3 | no |
| L65 | Spec / SSOT | Doc & SSOT | 3 | no |
| L66 | LLM-friendly docs (llms.txt) | Doc & SSOT | 3 | no |
| L67 | API reference (cargo doc / typedoc) | Doc & SSOT | 3 | no |
| L68 | Tutorial / concept docs (Divio) | Doc & SSOT | 3 | no |
| L69 | License & SPDX | Gov & Sust | 3 | no |
| L70 | Code ownership & governance | Gov & Sust | 3 | no |
| L71 | Sustainability (roadmap, funding, contributor pipeline) | Gov & Sust | 3 | no |
| **Total** |  | **9 domains** | **213** | 3 N/A-eligible |

---

## 9. Appendix C: Worked Example — Hypothetical `pheno-otel` Repository

This worked example shows how the 71 pillars are scored for a single repository. `pheno-otel` is a hypothetical Rust library that wraps OpenTelemetry for the Phenotype fleet (analogous to the real `pheno-otel` planned in L4 #80, partially stranded per `audit-71-pillar-2026-06-17-wrapup.md`).

**Repository characteristics:**

- Headless Rust library (no UI → L40, L41 → N/A = 3)
- Stateless (no persistent data → L62 → N/A = 3)
- Library, not service (L60, L63 → N/A = 3)
- 2,400 LOC, 89 tests, 78% coverage
- Has `AGENTS.md`, `llms.txt`, `CHANGELOG.md`, `LICENSE` (MIT), `deny.toml`, `SPEC.md`, `ARCHITECTURE.md`
- 6 ADRs in `docs/adr/`
- Uses `tracing` + `tracing-subscriber` + `opentelemetry` + `opentelemetry-otlp`

**Sample scoring (selected pillars — not all 71; see live scorecard for the full table):**

| L# | Pillar | Score | Evidence (file:line where possible) |
|---|---|---:|---|
| L1 | Architecture foundations | 3 | `ARCHITECTURE.md` (54 lines) + 6 ADRs + linked from `AGENTS.md:39` |
| L2 | Module structure & boundaries | 3 | `src/{ports,adapters,domain}.rs`; `cargo metadata` shows 0 circular deps |
| L3 | API surface & contract | 2 | `pub` audit: 23 of 412 symbols public (5.6%); `cargo-semver-checks` in CI but not yet enforced on PRs |
| L4 | Data model & state management | 2 | `serde` + `schemars` derives on all public types; round-trip tests in `tests/serde_roundtrip.rs` |
| L5 | Async/concurrency design | 3 | `tokio` runtime explicit; `Send + 'static` bounds verified by `compile_test`; cancellation tokens propagated |
| L6 | Hexagonal port/adapter discipline | 3 | `src/ports/exporter.rs` (trait) + `src/adapters/otlp.rs` + `src/adapters/stdout.rs`; ADR-014 conformance |
| L7 | Polyglot strategy | 2 | `pyo3` FFI to `pheno-pydantic-models`; types shared via `pheno-pydantic-models` per ADR-018 |
| L8 | Substrate placement | 3 | `pheno-otel` is a `pheno-*-lib` per ADR-023 Rule 3; substrate table in `AGENTS.md:170` |
| L9 | Cargo workspace topology | 3 | `pheno-cargo-template` standard layout; `[workspace.dependencies]` + `[workspace.package]` |
| L10 | Backward compatibility | 2 | Semver honored + `cargo-semver-checks` in CI; ADR-016 fork-only policy applied |
| L20 | Test coverage & quality gates | 2 | 78% coverage; 60% gate enforced in CI; below ADR-023 80% lib threshold (gap) |
| L24 | Type system & error handling | 3 | `thiserror` for library errors; `anyhow` for binary; no `unwrap` in lib; OTel error attributes on spans |
| L25 | Memory safety | 3 | `#[deny(unsafe_op_in_unsafe_fn)]`; `cargo-geiger` clean; Miri in CI |
| L26 | Property/fuzz testing | 2 | `proptest` for attribute parsing; `cargo-fuzz` in CI for OTLP payload encoder |
| L28 | Local dev setup | 3 | `just setup` + devcontainer + `mise.toml`; 1-command quickstart in README |
| L30 | Build cache | 3 | `sccache` configured; `cargo-chef` in Dockerfile; CI uses Buildkite remote cache |
| L40 | Internationalization (i18n) | 3 | n/a (headless library) |
| L41 | Accessibility (a11y) | 3 | n/a (headless library) |
| L46 | Secret management | 3 | `secrecy` crate; `gitleaks` + `trufflehog` in CI; `.env.example` only |
| L47 | Supply-chain security | 2 | SBOM generated in CI; `cargo-deny` clean; SLSA L2 (not yet L3) |
| L56 | Structured logging | 3 | `tracing` + JSON output + correlation IDs; `pheno-tracing` (ADR-012); OTLP export |
| L57 | Distributed tracing | 3 | OTel SDK + OTLP export + W3C TraceContext; `pheno-tracing`; span coverage > 80% |
| L60 | Deployment automation | 3 | n/a (library, not service) |
| L62 | Backup/restore | 3 | n/a (stateless library) |
| L63 | Capacity planning & SLOs | 3 | n/a (library, not service) |
| L64 | README quality | 3 | README has quickstart + install + usage + API example + screenshots + badges + license |
| L65 | Spec / SSOT | 3 | `SPEC.md` (4 pages) + `SSOT.md` (2 pages) + ADR index + updated within 30 days |
| L66 | LLM-friendly docs | 2 | `llms.txt` (8 lines) + `AGENTS.md` + structured frontmatter |
| L67 | API reference | 3 | `cargo doc` clean + CI + deployed to GitHub Pages + `rustdoc-json` exported |
| L68 | Tutorial / concept docs | 2 | Tutorial + How-to present; Reference + Explanation partial |
| L69 | License & SPDX | 3 | `LICENSE-MIT` + SPDX headers in 100% of source files + `deny.toml` license allowlist + `REUSE` |
| L70 | Code ownership & governance | 2 | `CODEOWNERS` present; branch protection requires 1 reviewer; no escalation policy yet |
| L71 | Sustainability | 1 | `ROADMAP.md` exists but stale (180 days); no `FUNDING.yml`; no contributor ladder |

**Per-domain aggregates (illustrative, not the full 71):**

| Domain | Pillar count | Sum (illustrative) | % of max |
|---|---:|---:|---:|
| AX (L1-L12) | 12 | 32 (avg 2.67) | 88.9% |
| Performance (L13-L19) | 7 | 17 (avg 2.43) | 81.0% |
| Quality (L20-L27) | 8 | 21 (avg 2.63) | 87.5% |
| DX (L28-L37) | 10 | 27 (avg 2.70) | 90.0% |
| UX (L38-L45) | 8 | 24 (avg 3.00, all N/A) | 100.0% |
| Security (L46-L55) | 10 | 27 (avg 2.70) | 90.0% |
| Obs & Ops (L56-L63) | 8 | 24 (avg 3.00, 3 N/A) | 100.0% |
| Doc & SSOT (L64-L68) | 5 | 13 (avg 2.60) | 86.7% |
| Gov & Sust (L69-L71) | 3 | 6 (avg 2.00) | 66.7% |
| **Total (illustrative)** | **71** | **191** | **89.7%** |

**Interpretation:** A `pheno-otel` of this hypothetical quality would be a "phenotype gold" library (≈90% of max). The live scorecard (`findings/71-pillar-{date}.md`) records the actual per-pillar scores for the real repos in the fleet.

---

## 10. Appendix D: Sample Weekly Run Trace

This is what a real Monday-09:00-PDT weekly refresh looks like. The trace is illustrative; the live run is in `findings/71-pillar-{date}.md` and the delta in `findings/71-pillar-{date}-delta.md`.

```text
# 2026-06-23 09:00:00 PDT — worklog-schema circle
# Tool: dispatch-mcp via forge CLI, model: gpt-5-class

$ just refresh-71-pillar
[1/7] Discovering repos... 32 repos in scope (10 lib, 18 service, 4 federated)
[2/7] Running signal probes (parallel via dispatch-mcp)...
  - L1-L12 (AX)         ████████████████████ 100% (32/32)
  - L13-L19 (Perf)      ████████████████████ 100%
  - L20-L27 (Quality)   ████████████████████ 100%
  - L28-L37 (DX)        ████████████████████ 100%
  - L38-L45 (UX)        ████████████████████ 100%
  - L46-L55 (Security)  ████████████████████ 100%
  - L56-L63 (Obs&Ops)   ████████████████████ 100%
  - L64-L68 (Doc&SSOT)  ████████████████████ 100%
  - L69-L71 (Gov&Sust)  ████████████████████ 100%
[3/7] Manual review queue (L1, L48, L63, L66, L70)... 14 subagent dispatches queued
[4/7] Subagent scoring (parallel, 4 concurrent)...
  - 14 reports received in 18m 32s
  - Conflict resolution: 2 pillars required adjudicator (L48 on pheno-otel, L66 on dispatch-mcp)
[5/7] Aggregating scores... 71 * 32 = 2272 cell scorecard
[6/7] Generating delta... 14 Δ≥1 changes vs 2026-06-17 baseline
[7/7] Writing outputs...
  - findings/71-pillar-2026-06-23.md (live scorecard)
  - findings/71-pillar-2026-06-23-delta.md (14 changes)
  - STATUS.md § "Factory AI Agent Readiness" (per-repo Level updates)
[done] 2026-06-23 09:38:42 PDT — 38m 42s total
```

**Sample delta entries (from a real delta file):**

| Repo | Pillar | Δ | Note |
|---|---|---|---|
| pheno-otel | L20 | 2 → 3 | Coverage raised from 78% to 82% via new tests; above 80% lib threshold |
| dispatch-mcp | L39 | 1 → 2 | AGENTS.md added (102 lines) with current date |
| dispatch-mcp | L66 | 0 → 1 | llms.txt added (6 lines) |
| phenotype-hub | L70 | 2 → 3 | Branch protection upgraded to 2-reviewer rule + escalation policy |
| AgilePlus | L69 | 2 → 3 | WIP SPDX header PR landed (542 files) |
| pheno-mcp-router | L48 | 0 → 1 | STRIDE doc drafted (informal, not yet reviewed) |

---

**END OF SCHEMA DOCUMENT**

Total pillars: 71 (L1-L71, 9 domains). Refresh: weekly (Mon 09:00 PDT). Owner: worklog-schema circle. Decision record: ADR-024.
