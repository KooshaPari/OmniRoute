# ADR-080: Penetration Test + Bug Bounty Roadmap

**Date:** 2026-06-21
**Status:** ACCEPTED
**Cycle:** 9 P0 (v19)
**Pillar:** L49 (Incident response deepening), L26 (pen-test cadence)

## Context

The Phenotype fleet reached P0 saturation at 47/47 pillars in v18, with full FedRAMP/IL5/SOC2 readiness gap list documented. v19 T5 closes the operational side of incident response with a pen-test cadence and a public bug-bounty program.

## Decision

Adopt a **dual-track security validation** model:

### Track 1: Annual third-party penetration test

- **Vendor**: pre-vetted 3PAO with FedRAMP Moderate accreditation (e.g., Schellman, Coalfire, Bishop Fox)
- **Scope**: full fleet (phenotype-router, pheno-mcp-router, pheno-events, pheno-observability, phenotype-gateway, all substrate crates)
- **Window**: 2-week engagement, Q3 each year (aligns with FedRAMP annual assessment)
- **Deliverables**:
  1. Executive report (PDF, ≤30 pages) — risk-prioritized findings
  2. Technical report (markdown, ~200 findings) — reproducible steps + CVSS scores
  3. Remediation tracker (Jira export) — owner, target date, status
- **Funding**: $80k/year from fleet security budget (ADR-049)
- **Acceptance**: 0 P0 findings; ≤3 P1 findings with mitigation timeline

### Track 2: Continuous bug bounty (HackerOne-style)

- **Platform**: Bugcrowd (preferred for SOC 2 compliant vendor handling) — alternative: Intigriti
- **Scope**: all public-facing endpoints + SDK packages (phenotype-python-sdk, phenotype-go-sdk, pheno-mcp-router, phenotype-router)
- **Rewards** (4 tiers, USD):

| Tier | Severity (CVSS) | Reward | Examples |
|------|-----------------|-------:|----------|
| P0 Critical | 9.0-10.0 | $15,000 | RCE, auth bypass, data exfil |
| P1 High | 7.0-8.9 | $5,000 | SQLi, stored XSS, privilege escalation |
| P2 Medium | 4.0-6.9 | $1,500 | Reflected XSS, CSRF on state-changing ops |
| P3 Low | 0.1-3.9 | $300 | Info disclosure, clickjacking |

- **Annual budget**: $100k (covers ~6-7 P0/P1 reports at avg)
- **Response SLA**: 24h acknowledge, 7d triage, 90d remediation for P0
- **Disclosure policy**: 90-day coordinated disclosure (matches industry norm)

## Implementation phases

| Phase | Timeline | Action |
|-------|---------:|--------|
| **Phase 1 (Q3 2026)** | 6 weeks | Engage 3PAO for first annual pen-test; stand up Bugcrowd program |
| **Phase 2 (Q4 2026)** | 4 weeks | First pen-test report; integrate findings into ADR-048 graduation path |
| **Phase 3 (Q1 2027)** | continuous | Bug bounty live; first external reports triaged |

## Governance

- **Pen-test findings** → 14d triage → 90d remediation for P0/P1, 180d for P2
- **Bug bounty triage**: 3-person rotation (security circle + 2 substrate owners)
- **Disputes**: third-party arbiter (Bugcrowd mediation team)
- **Public scorecard**: quarterly published at `phenotype.security/posture` (HackerOne trust center)

## Acceptance criteria

- [x] 3PAO engagement letter (template) — `docs/security/pen-test-engagement-letter.md`
- [x] Bug bounty program rules — `docs/security/bug-bounty-rules.md` (this wave)
- [x] Vulnerability disclosure policy (VDP) — `docs/security/vdp.md` (this wave)
- [x] Annual pen-test cadence documented in fleet calendar
- [x] Bugcrowd platform evaluation complete (decision: yes, Q3 launch)

## References

- Bugcrowd platform: <https://www.bugcrowd.com/>
- NIST SP 800-115 (Technical Guide to Information Security Testing)
- OWASP Testing Guide v4
- FedRAMP Penetration Test Guidance: <https://www.fedramp.gov/assets/resources/documents/CSP_Penetration_Test_Guidance.pdf>
- ADR-049 (drift detector) — feeds continuous pen-test signal
- T1 v19 FedRAMP gap list (`findings/2026-06-21-v18-T1-L17-fedramp-soc2-readiness.md`)
- v18 T3 evidence automation (`findings/2026-06-21-v18-T3-L51-soc2-evidence-automation.md`)
