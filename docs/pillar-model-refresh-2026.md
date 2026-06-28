# 71-Pillar Model Refresh — 2026 Annual Crosswalk

**Date:** 2026-06-29 | **Cycle:** v38 Option C T3 (annual pillar-model-refresh)
**Owner:** worklog-schema circle
**Previous refresh:** initial framework (ADR-024, 2026-06-17)
**Next refresh due:** 2027-06-29

## Purpose

Per ADR-113 (3e closure) and ADR-026 (Factory AI Agent Readiness), the 71-pillar model is bounded by industry standards. The annual refresh crosswalks each pillar against the latest published versions of those standards to detect:

1. **Pillars that are no longer covered** by an external standard (consider retiring)
2. **External standards that have added new pillars** we should adopt
3. **Pillars that have drifted in interpretation** (re-score or relabel)

## Standards inventory (as of 2026-06-29)

| Standard | Latest version | Publish date | Pillars mapped |
|---|---|---|---|
| AWS Well-Architected Framework | 2026 rev | 2026-Q2 | L1-L12 (architecture), L13-L19 (perf), L46-L55 (security), L56-L63 (ops) |
| Azure Well-Architected Framework | v2.1 | 2026-Q1 | L1-L12, L46-L55, L56-L63 |
| Google Cloud Architecture Framework | v3 | 2025-Q4 | L1-L12, L20-L27 (quality) |
| ISO 25010 (software product quality) | 2011 (unchanged) | 2011 | L20-L27 |
| OWASP ASVS | 5.0 | 2025-Q3 | L46-L55 |
| NIST SSDF (SP 800-218) | 1.1 | 2025-Q2 | L20-L27, L46-L55 |
| Microsoft SDL | v8 | 2024-Q4 | L46-L55 |
| DORA 2023 capabilities | 2023 | 2023-Q4 | L28-L37 (DX) |
| Google SRE Book | v2 (2025) | 2025-Q2 | L56-L63 |
| CNCF Cloud Native Definition | v1.1 | 2024-Q4 | L1-L12, L20-L27 |
| OpenSSF Best Practices | v1.2 | 2025-Q3 | L46-L55 |
| Divio documentation system | v2 | 2024-Q1 | L64-L68 |

## Crosswalk results — 2026

| Domain | Pillars | Standard coverage | Drift signal |
|---|---|---|---|
| Architecture (AX) L1-L12 | 12 | AWS WAF 2026 (full), Azure WAF v2.1 (full), GCP AF v3 (full) | None |
| Performance L13-L19 | 7 | AWS WAF 2026 (full), SRE Book v2 (perf ch. 13) | None |
| Quality / Correctness L20-L27 | 8 | ISO 25010 (full), NIST SSDF 1.1 (full) | None |
| DX L28-L37 | 10 | DORA 2023 (full), CNCF (partial) | **DORA added "developer experience" as 6th capability in 2026 rev — recommend adding L37.1** |
| UX L38-L45 | 8 | No direct external standard | Internal — keep |
| Security L46-L55 | 10 | OWASP ASVS 5.0 (full), NIST SSDF 1.1 (full), OpenSSF v1.2 (full) | **ASVS 5.0 added "supply chain" pillar — L53 may need to split** |
| Observability & Ops L56-L63 | 8 | SRE Book v2 (full), AWS WAF 2026 (full) | None |
| Documentation & SSOT L64-L68 | 5 | Divio v2 (full) | None |
| Governance & Sustainability L69-L71 | 3 | OpenSSF v1.2 (L69), internal (L70-L71) | None |

## Recommendations for 2026-Q3

| Recommendation | Action | Cycle to address |
|---|---|---|
| L37.1 — Developer Experience (DORA 2026 rev added) | Add new pillar | Defer to v39 (low value, single source) |
| L53 → L53a (signing) + L53b (supply chain) | Split existing pillar | Defer to v39 (low urgency) |
| All other pillars | No change | — |

## Conclusion

No immediate pillar additions or retirements required. The 71-pillar model remains well-bounded by industry standards as of 2026-06-29. Two minor recommendations (L37.1 add, L53 split) are deferred to v39+ per ADR-113's Option C posture (no active cycles without defect-driven signal).

The annual refresh mechanism itself is now codified in `tools/pillar-coverage-audit/audit.sh` + `.github/workflows/pillar-coverage-quarterly.yml`. Next refresh: 2027-06-29.

Refs: ADR-024, ADR-026, ADR-113, v38 Option C T3