# Rubric Lineage: External Systems Feeding v38 Audit Rebuild

**Purpose:** This document catalogs seven foundational external audit/rubric systems and maps their unique dimensions into the v38 100+ pillar rebuild. Each system is researched from public sources and positioned as a *provenance lineage* — feeding specialized axes (agent-readiness, architecture quality, security posture, delivery health, accessibility, usability, operations) into a unified meta-rubric.

---

## 1. Factory.ai Agent-Readiness Framework

**Scope:** Evaluates codebases for autonomous-agent capability and task orchestration readiness.

**Pillars (9 Technical Axes):**
- Style & Validation (linters, type checkers, formatters)
- Build System (deterministic, documented, dependency clarity)
- Testing (unit, integration, local execution guardrails)
- Documentation (AGENTS.md, README, maintainable references)
- Development Environment (devcontainers, reproducible setup)
- Debugging & Observability (structured logs, tracing, metrics)
- Security (branch protection, secret scanning, code ownership)
- Task Discovery (issue templates, labeling for autonomous work)
- Product & Experimentation (analytics, experiment infrastructure)

**Scoring Scale:** 5 levels, gated (80% pass-through to next tier)
- L1 (Functional) → L2 (Documented) → L3 (Standardized) → L4 (Optimized) → L5 (Autonomous)

**Evidence Model:** Repository-wide + per-app (monorepos yield "3 / 4 apps passing" style results)

**Unique Coverage:** *Agent-readiness as a first-class axis.* Emphasizes task discovery, structured process clarity, and self-orchestration surfaces. Orthogonal to code quality — a repo can have perfect tests but poor task-finding surfaces.

**Sources:**
- [Factory.ai Agent Readiness | Agent-Readiness Overview](https://docs.factory.ai/web/agent-readiness/overview)
- [Agent Readiness | Codebase Evaluation for AI | Factory](https://factory.ai/product/agent-readiness)

---

## 2. ATAM / Architecture Tradeoff Analysis Method (SEI/CMU)

**Scope:** Evaluates architectural decisions and their quality-attribute interactions.

**Key Dimensions (Quality Attributes):**
- Modifiability (how easily can components be changed?)
- Performance (latency, throughput, scalability)
- Security (attack surface, trust boundaries)
- Availability (fault tolerance, recovery time)
- Usability (user-facing design quality)
- Reliability (correctness, failure modes)
- Testability (decomposability, component isolation)

**Scoring Scale:** Qualitative sensitivity/tradeoff point identification; risk mitigation staging (no numeric 0–10, but prioritized risk registry)

**Evidence Model:** Scenario-driven (quality-attribute scenarios e.g. "support 10k concurrent users with sub-100ms latency"). Stakeholder interviews. Sensitivity analysis (which design choices affect which attributes most).

**Unique Coverage:** *Architecture as a deliberate tradeoff surface.* Reveals hidden dependencies between pillars (e.g. "adding observability harms performance"; "isolation harmed reusability"). Emphasizes risk cataloging and explicit assumptions.

**Sources:**
- [The Architecture Tradeoff Analysis Method | CMU SEI](https://www.sei.cmu.edu/library/the-architecture-tradeoff-analysis-method/)
- [Kazman, Klein, Barbacci — ATAM Paper (1998)](https://www.sei.cmu.edu/documents/1186/1998_005_001_16646.pdf)

---

## 3. SWE-bench Verified / Agentic Coding Benchmarks

**Scope:** Measures autonomous-agent capability on real-world code tasks (GitHub issue resolution).

**Dataset:** 500 real Python issues with human-verified fixes; tasks require full repo navigation, test-driven patches.

**Scoring Scale:** Resolution rate (0–100% of issues closed) + patch validity (tests pass on modified code).

**Evidence Model:** 
- Pass: issue closed, test suite passes on patch
- Fail: unresolved, incomplete patch, test regression
- *Contamination caveat:* newer high-scoring systems may have test-set overlap; interpret with caution.

**Unique Coverage:** *Agent capability as measured by real-world task resolution.* Orthogonal to code quality — a poorly-structured repo can be fixable; a clean repo can have edge-cases that confound agents. Captures *composability* under time pressure.

**Top Performers (Jul 2026):**
- Claude Mythos 5: 95.5%
- Claude Fable 5: 95.0%
- Claude Opus 4.8: 88.6%

**Sources:**
- [SWE-bench Verified Leaderboard 2026 | Steel.dev](https://leaderboard.steel.dev/leaderboards/swe-bench-verified/)
- [Beyond SWE-Bench: Evaluating AI Coding Agents in 2026 | Medium](https://medium.com/@allahverdiyev.tural/beyond-swe-bench-how-to-actually-evaluate-ai-coding-agents-in-2026-8233940530f1)

---

## 4. OpenSSF Scorecard

**Scope:** Security posture and supply-chain risk for open-source projects.

**18 Checks Across 3 Themes:**
1. Holistic security practices (branch protection, code review, signed releases)
2. Source code risk (pinned dependencies, vulnerability scanning)
3. Build process risk (SLSA provenance, artifact signing, CI pipeline isolation)

**Scoring Scale:** Per-check 0–10; risk-weighted aggregate (4 risk tiers: Critical 10, High 7.5, Medium 5, Low 2.5)

**Evidence Model:** Automated probes (GitHub API, repo structure, CI logs); binary pass/fail + numeric severity.

**Unique Coverage:** *Supply-chain and provenance security as a distinct axis.* Addresses "compromised dependency" and "silent binary injection" scenarios. Orthogonal to code-quality audits; a well-tested project can have zero SLSA provenance.

**Sources:**
- [OpenSSF Scorecard](https://scorecard.dev/)
- [OpenSSF Scorecard Documentation | GitHub](https://github.com/ossf/scorecard)
- [OpenSSF Scorecard for .NET and NuGet | .NET Blog](https://devblogs.microsoft.com/dotnet/openssf-scorecard-for-net-nuget/)

---

## 5. DORA Metrics (Deployment Frequency, Lead Time, MTTR, Change Fail Rate)

**Scope:** Quantifies software delivery and DevOps health.

**4 Core Metrics:**
1. **Deployment Frequency** — pushes-to-prod per unit time (daily, weekly, monthly, yearly)
2. **Lead Time for Changes** — from commit to production deployment (hours/days)
3. **Mean Time to Recover (MTTR)** — time to fix a production failure
4. **Change Failure Rate** — % of deployments requiring immediate intervention

**Scoring Scale:** Absolute metrics (e.g. "deploys 50× per day", "lead time 4 hours"); industry benchmarks (elite/high/medium/low tiers)

**Evidence Model:** CI/CD logs, production telemetry, incident tracking (PagerDuty, incident timeline data)

**Unique Coverage:** *Delivery velocity and operational stability as measured outcomes.* Reveals gaps between "we write tests" and "we deploy confidently". A high change-fail rate signals inadequate integration discipline, regardless of code coverage.

**Sources:**
- [DORA Metrics: The Complete Guide (2026) | DX Metrics](https://getdx.com/blog/dora-metrics/)
- [DORA | Metrics History](https://dora.dev/insights/dora-metrics-history/)
- [DORA Metrics Guide | LaunchDarkly](https://launchdarkly.com/blog/dora-metrics/)

---

## 6. AWS Well-Architected Framework (6 Pillars)

**Scope:** Cloud-native and distributed-system architectural quality.

**6 Pillars:**
1. **Operational Excellence** — runbooks, automation, observability, incident response
2. **Security** — identity, encryption, compliance, audit logging
3. **Reliability** — fault tolerance, multi-AZ, failover, chaos testing
4. **Performance Efficiency** — scaling, caching, resource optimization
5. **Cost Optimization** — right-sizing, reserved capacity, waste elimination
6. **Sustainability** — energy efficiency, carbon footprint, resource efficiency

**Scoring Scale:** Risk-level classification (High Risk Issues, Medium Risk Issues); baseline 20–40 HRIs for new workload. Prioritize Security/Reliability HRIs first.

**Evidence Model:** AWS Well-Architected Tool questionnaire; workshop findings; risk registry prioritization.

**Unique Coverage:** *Cloud deployment and operational readiness.* Captures "works on laptop, fails in production" anti-patterns. Emphasizes observability, cost discipline, and graceful degradation under failure — orthogonal to code-only audits.

**Sources:**
- [AWS Well-Architected Framework | AWS Docs](https://docs.aws.amazon.com/wellarchitected/latest/framework/the-pillars-of-the-framework.html)
- [6 Pillars of AWS Well-Architected Framework | APN Blog](https://aws.amazon.com/blogs/apn/the-6-pillars-of-the-aws-well-architected-framework/)

---

## 7. WCAG 2.2 / Web Accessibility Guidelines

**Scope:** Accessibility compliance for user-facing applications.

**Conformance Levels:** A, AA, AAA (increasing rigor)
- **A:** Minimum compliance (baseline usability)
- **AA:** Recommended standard (GDPR/ADA compliance baseline in most jurisdictions)
- **AAA:** Enhanced accessibility (often aspirational)

**Scoring Scale:** Success criterion count (pass/fail per criterion). Automation catches ~25–40% of violations; manual audit required for >60% coverage.

**Evidence Model:** Automated scanning (axe, WAVE) + manual testing (keyboard nav, screen reader, color contrast, focus management)

**Unique Coverage:** *Inclusive design as a quality pillar.* Not "nice-to-have"; regulatory requirement in many jurisdictions. Catches failures orthogonal to code review (e.g. color-only affordances, missing ARIA labels, poor focus indicators).

**Baseline Challenge (2026):** 95.9% of top 1M websites have detectable WCAG A/AA failures (WebAIM Million 2026).

**Sources:**
- [WCAG 2.2 Overview | W3C](https://www.w3.org/WAI/standards-guidelines/wcag/)
- [WCAG 3.0 Guide 2026 | TheWCAG](https://www.thewcag.com/wcag-3-0)
- [Accessibility Testing 2026: WCAG 3.0 Standards | Vervali](https://www.vervali.com/blog/wcag-3-0-accessibility-testing-compliance-2026-standards-timeline-tools-and-how-to-prepare-your-stack/)

---

## 8. Nielsen 10 Usability Heuristics

**Scope:** UX interaction quality and human factors.

**10 Heuristics:**
1. System status visibility
2. Real-world language match (mental models)
3. User control & emergency exits
4. Consistency & standards
5. Error prevention
6. Recognition vs recall
7. Flexibility & shortcuts
8. Aesthetic & minimalist design
9. Error recovery (clear language, suggestions)
10. Help & documentation

**Scoring Scale:** Severity per heuristic (0–4) + violation classification (cosmetic, minor, major, catastrophic). 3–5 independent evaluators catch ~75% of issues.

**Evidence Model:** Heuristic evaluation (expert walk-through), not user testing. Consensus scoring via debriefing.

**Unique Coverage:** *Interaction design as distinct from architecture.* A system can be architecturally sound but fail usability (e.g. cryptic UI, poor error messages, hidden affordances). Emphasizes human factors over code metrics.

**Sources:**
- [Nielsen 10 Usability Heuristics | Nielsen Norman Group](https://blog-ux.com/en/jakob-nielsen-s-10-usability-heuristics/)
- [Nielsen's Heuristics: UX Principles | Midrocket](https://midrocket.com/en/guides/nielsen-heuristics-usability/)

---

## 9. 12-Factor App Methodology

**Scope:** Cloud-native application portability and operational hygiene.

**12 Factors:**
1. Codebase (one Git repo, multiple deployments)
2. Dependencies (explicit, vendored or lockfile)
3. Config (env vars, not code)
4. Backing Services (databases/APIs as plugins)
5. Build/Release/Run (strict separation)
6. Processes (stateless, share-nothing)
7. Port Binding (self-contained, standalone)
8. Concurrency (horizontal scaling via process replication)
9. Disposability (fast startup, graceful shutdown)
10. Dev/Prod Parity (same tools, config, versions)
11. Logs (unbuffered, to stdout; aggregated externally)
12. Admin Processes (one-off tasks via same codebase)

**Scoring Scale:** Checklist (per-factor compliance); phased adoption encouraged (start with highest-pain factors).

**Evidence Model:** Configuration inspection, deployment logs, process lifecycle tracing, environment consistency audit.

**Unique Coverage:** *Portability and operational repeatability.* Orthogonal to code quality; a microservice can be well-tested but tightly coupled to its deployment environment. Emphasizes "containerization-ready" and "stateless" postures.

**Sources:**
- [The 12-Factor App Methodology](https://12factor.net/)
- [12-Factor App Checklist | GitHub Gist](https://gist.github.com/JJediny/601caca1c24a3ee0f7ce)
- [12-Factor App Principles Explained | Medium](https://medium.com/the-developers-journal/12-factor-app-principles-explained-ff619d7b7275)

---

## Comparison Table: Rubric Systems at a Glance

| System | Scoring Scale | Evidence Model | Unique Coverage | Domain |
|--------|---------------|-----------------|-----------------|--------|
| **Factory Agent-Readiness** | 5 levels, gated 80% | repo-wide + per-app | Agent task-discovery surfaces, orchestration clarity | Agent-Readiness |
| **ATAM** | Qualitative risk registry, sensitivity points | Stakeholder interviews, scenario analysis | Architecture tradeoffs, quality-attribute interactions, hidden risks | Architecture |
| **SWE-bench Verified** | Resolution %, patch validity (0–100) | Real GitHub issues, test-suite pass/fail | Agent capability on real-world code tasks, composability under time | Agentic Coding |
| **OpenSSF Scorecard** | Per-check 0–10, risk-weighted aggregate | Automated + manual probes (GH API, CI logs) | Supply-chain security, SLSA provenance, binary integrity | Security (Supply-Chain) |
| **DORA Metrics** | Absolute (frequency, lead time, MTTR, %), industry benchmarks | CI/CD logs, production telemetry, incident tracking | Deployment velocity, operational stability, change-confidence gap | Delivery / DevOps |
| **AWS Well-Architected** | Risk tiers (HRI/MRI), risk registry | Questionnaire, workshop findings, risk prioritization | Cloud ops, fault tolerance, cost discipline, graceful degradation | Cloud Ops |
| **WCAG 2.2** | A / AA / AAA levels, success criterion pass/fail | Automated scanning + manual (keyboard, screen-reader, color contrast) | Inclusive design, regulatory compliance, interaction equity | Accessibility (AX) |
| **Nielsen Heuristics** | Severity 0–4, violation classification | Expert walk-through, debriefing consensus | Interaction design, human factors, error messaging, affordances | UX / Usability |
| **12-Factor App** | Checklist per factor, phased adoption | Configuration inspection, deployment logs, process tracing | Portability, statelessness, environment parity, container-readiness | Operations / Portability |

---

## Lineage-Mapping Table: External Systems → v38 Pillar Categories

**v38 Pillar Categories (expansion on v37 scaffold):**
- **L0–L29:** Architecture (design patterns, modularity, DDD, SOLID, hexagonal, clean code, dependency graphs)
- **L30 (NEW):** Agent-Readiness (task discovery, orchestration surfaces, autonomous-work clarity)
- **L31–L40:** Security (secrets, RBAC, audit logging, supply-chain integrity, threat modeling)
- **L41–L50:** Observability (logging, tracing, metrics, SLOs, incident response)
- **L51–L60:** Supply-Chain & Delivery (CI/CD, DORA metrics, build provenance, artifact integrity, release discipline)
- **L61–L70:** DX / QEng / Portability (test coverage, 12-factor, reproducible builds, dev-prod parity, containerization)
- **L71–L80:** Eval Coverage (spec traceability, FR/NFR tests, journey verification, mutation testing)
- **L81–L90 (NEW):** Accessibility & Usability (WCAG compliance, Nielsen heuristics, interaction design, inclusive language)
- **L91–L100 (NEW):** Visual Identity & Product (design system, branding, animation, packaging, installer QOL)

**Mapping (External → Categories):**

| External System | Feeds Into | Pillar Range | Specific Axes |
|-----------------|------------|--------------|---------------|
| **Factory Agent-Readiness** | L30, L61–L70 | Agent-Readiness; DX/QEng | Issue templates, task labeling, AGENTS.md, linter/formatter automation, test guardrails, dev environment reproducibility |
| **ATAM** | L0–L29, L31, L41, L51 | Architecture; Security; Observability; Supply-Chain | Tradeoff sensitivity, risk mitigation, quality-attribute interactions, stakeholder consensus |
| **SWE-bench Verified** | L71–L80, L30 | Eval Coverage; Agent-Readiness | Autonomous-agent capability on real tasks, composability scoring, code-mutation resilience |
| **OpenSSF Scorecard** | L31–L40, L51–L60 | Security; Supply-Chain & Delivery | Branch protection, SLSA provenance, signed releases, dependency pinning, CI integrity, vulnerability scanning |
| **DORA Metrics** | L51–L60 | Supply-Chain & Delivery | Deployment frequency, lead time, MTTR, change-fail rate, release discipline, confidence metrics |
| **AWS Well-Architected** | L0–L29, L41–L50, L51–L60, L61–L70 | Architecture; Observability; Supply-Chain; DX | Operational excellence, fault tolerance, scalability testing, cost discipline, graceful degradation, observability as-code |
| **WCAG 2.2** | L81–L90 (NEW) | Accessibility & Usability | Conformance level (A/AA/AAA), color contrast, keyboard nav, screen-reader compatibility, focus management, ARIA labels |
| **Nielsen Heuristics** | L81–L90 (NEW) | Accessibility & Usability | Error recovery, system feedback, user control, consistency, affordances, help documentation quality |
| **12-Factor App** | L61–L70, L51–L60 | DX / Portability; Supply-Chain | Codebase unity, dependency clarity, config externalization, statelessness, process disposability, dev-prod parity, log aggregation |

---

## Gaps Revealed by External Systems in v37

1. **Agent-Readiness as first-class pillar (L30).** v37 audit had no dedicated axis for "can agents work in this repo?" Task discovery, issue labeling, and autonomy surfaces were absent.

2. **Architecture as deliberate tradeoff surface.** v37 was code-quality focused; lacks ATAM-style sensitivity analysis and risk-mitigation staging. No explicit "security vs. performance," "latency vs. observability" scoring.

3. **Supply-chain provenance & SLSA scoring.** OpenSSF Scorecard reveals v37 was light on artifact signing, build isolation, and transitive dependency risk. Now L31–L40 and L51–L60.

4. **Delivery velocity & operational confidence (DORA).** v37 had test coverage but not "how often do we ship?" or "how fast do we recover?" Missing L51–L60 operational metrics.

5. **Accessibility & Usability as quality pillars (L81–L90).** v37 audit was nearly silent on WCAG/Nielsen; product-facing work defaulted to no accessibility bar. New category captures AX compliance, interaction design, inclusive language.

6. **Visual identity & packaging as acceptance criteria (L91–L100).** v37 scored code, not "does the user see a polished installer?" or "is there a design system?" New category requires animations, splash screens, icon sets, branded TUIs.

7. **SWE-bench agent capability as verifiable axis.** v37 code metrics don't predict "can an agent fix this repo's issues?" SWE-bench Verified scoring bridges the gap (L71–L80 + L30).

8. **Interaction & UX rigor beyond accessibility.** WCAG/Nielsen reveal that a "bug-free, fast" system can fail users if error messages are cryptic, affordances are hidden, or workflows are non-intuitive. L81–L90 now covers this.

9. **Operational repeatability (12-factor, dev-prod parity).** v37 was light on "does this work in Docker?" and "are environment secrets properly externalized?" L61–L70 now mandates 12-factor audit.

10. **Cost discipline & resource efficiency.** AWS Well-Architected's cost-optimization pillar was missing; v37 had no "is this workload right-sized?" scoring. Now folded into L51–L60 (Delivery & Cloud-Ops).

---

## Next Steps: Pillar Assembly & Scoring Calibration

1. **Template per external system:** Generate 1–2 page scoring template for each of the 9 systems (Factory, ATAM, SWE-bench, OpenSSF, DORA, AWS WAF, WCAG, Nielsen, 12-factor).

2. **Evidence catalog per category:** For each v38 pillar category (L0–L100), populate a list of canonical evidence paths (file:line, test case, metric query, design artifact).

3. **Gating & compliance tiers:** Define "Level 1 (Basic), Level 2 (Solid), Level 3 (Production-Ready), Level 4 (Exemplary)" for each category, with mandatory evidence at each tier.

4. **Pilot audit on 3–5 repos:** Run the extended template on a sample (e.g. SessionLedger, substrate, MelosViz) to calibrate scoring, discover missing evidence pathways, and validate category granularity.

5. **Feedback loop:** Refine rubric based on pilot data; consolidate duplicate axes; add repo-specific profile variations (CLI tool, library, service, web app, CLI+daemon).

---

## References & Citation Policy

All sourcing cited inline. External systems are live projects / standards:
- Factory.ai: active product, documentation updated Q2 2026
- ATAM: SEI canonical method, white papers peer-reviewed, widely adopted in enterprise architecture
- SWE-bench Verified: live leaderboard, updated monthly; top scores subject to contamination caveats
- OpenSSF Scorecard: CNCF incubation (graduated 2026), automated, 18-check stable suite
- DORA Metrics: research-backed (Accelerate, 2018+), industry standard, tooling mature
- AWS Well-Architected: AWS canonical framework, questionnaire live, HRI/MRI scoring stable
- WCAG 2.2: W3C Recommendation Oct 2023, legally referenced in EU/US/UK
- Nielsen Heuristics: foundational UX methodology (1994), evidence-based, widely taught
- 12-Factor App: Heroku manifesto (2012), cloud-native de facto standard, open guidance

---

**Document Generated:** 2026-07-03  
**Revision:** v1 (Research Phase)  
**Next Phase:** Pillar Assembly & Scoring Calibration (audit-rebuild-v38/worker-contract)
