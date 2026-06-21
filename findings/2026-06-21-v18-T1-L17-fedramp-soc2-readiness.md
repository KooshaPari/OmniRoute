# v18 T1 L17 FedRAMP/IL5/SOC2 Readiness Assessment

**Date:** 2026-06-21
**Branch:** `chore/v18-71-pillar-cycle-8-p0-2026-06-21`
**Cycle:** 8 P0 (final)
**Pillar:** L17 (Substrate Health Audit — FedRAMP/IL5/SOC2 readiness axis)
**Status:** v18 Wave A track 1 of 3

## Scope

L17 measures whether the Phenotype fleet can credibly claim conformance with enterprise compliance regimes. The three regimes in scope:

1. **FedRAMP Moderate** — baseline for US federal SaaS
2. **DoD Impact Level 5 (IL5)** — Controlled Unclassified Information (CUI)
3. **SOC 2 Type II** — common customer requirement for B2B SaaS

This is a readiness assessment, not a certification engagement. The artifact is the **gap list** + **evidence collection** needed before engaging a 3PAO (Third Party Assessment Organization).

## Per-regime readiness matrix

| Control family | FedRAMP Mod | DoD IL5 | SOC 2 II | Phenotype fleet | Gap |
|---|---|---|---|---|---|
| Access control (AC) | AC-1..AC-23 | AC-1..AC-23 | CC6.1..6.3 | pheno-context + pheno-port-adapter (auth interceptors) | MINOR (audit log retention) |
| Audit & accountability (AU) | AU-1..AU-12 | AU-1..AU-12 | CC7.1..7.5 | pheno-tracing OTLP + audit log | MINOR (1-year retention vs 3-year FedRAMP) |
| Configuration mgmt (CM) | CM-1..CM-7 | CM-1..CM-7 | CC8.1 | Justfile + `validate-ssot.sh` + `cargo-deny` | NONE |
| Contingency (CP) | CP-1..CP-13 | CP-1..CP-13 | A1.2..A1.3 | backups: not formalized | MEDIUM (BCP/DR plan needed) |
| Identification & auth (IA) | IA-1..IA-5 | IA-1..IA-5 | CC6.1..6.6 | JWT + OIDC via pheno-port-adapter | MINOR (MFA not enforced) |
| Incident response (IR) | IR-1..IR-8 | IR-1..IR-8 | CC7.4 | SECURITY.md runbook + PagerDuty | NONE |
| Risk assessment (RA) | RA-1..RA-5 | RA-1..RA-5 | CC3.1..3.4 | 71-pillar framework + ADR docs | NONE |
| System & comms prot (SC) | SC-1..SC-39 | SC-1..SC-39 | CC6.6..6.7 | TLS 1.3 enforced; mTLS in ADR-046 | MEDIUM (SC-8/SC-13 evidence collection) |
| System & info integrity (SI) | SI-1..SI-12 | SI-1..SI-12 | CC7.1 | cargo-fuzz + proptest + SBOM | MINOR (FIPS crypto not enforced) |

## Top 5 evidence-collection gaps (3PAO-blocking)

1. **Audit log retention policy (AU-11)** — current: 30 days; required: 365 days (FedRAMP) / 730 days (IL5). Needs a retention-config + cold-storage pipeline.
2. **BCP/DR plan (CP-2)** — no documented plan exists. Required: RTO 4h / RPO 1h, documented failover procedure, annual test.
3. **MFA enforcement (IA-2)** — JWT/OIDC is in place but no MFA check. Required: WebAuthn or TOTP for all human access.
4. **mTLS service-to-service (SC-8)** — ADR-046 codifies intent but not yet enforced. Required: mutual TLS between federated services.
5. **FIPS 140-3 crypto (SI-7)** — libsodium used (not FIPS-validated). Required: FIPS-validated crypto module or compensating controls.

## Phased remediation plan

| Phase | Scope | Effort | Target |
|-------|-------|-------:|--------|
| **Phase 1 (Q3 2026)** | SOC 2 Type II ready | ~6 weeks | Top 3 gaps closed; ready for 3PAO engagement |
| **Phase 2 (Q4 2026)** | FedRAMP Moderate | ~12 weeks | All Medium gaps closed; 3PAO engagement |
| **Phase 3 (Q1 2027)** | DoD IL5 | ~16 weeks | All High gaps closed; CUI handling |

## Evidence automation

Per **T3 (L51)** in this wave, all evidence collection is automated via `findings/2026-06-21-v18-T3-L51-soc2-evidence-automation.md` — see that file for the 5 automated collectors (audit-log retention check, MFA enforcement check, mTLS handshake check, FIPS crypto check, BCP test check).

## References

- FedRAMP Moderate baseline: <https://www.fedramp.gov/baselines/moderate/>
- DoD Cloud Computing SRG: <https://public.cyber.mil/dccs/>
- SOC 2 Trust Services Criteria: <https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2>
- ADR-046 (federation mTLS + OIDC): `docs/adr/2026-06-18/ADR-046-federation-mtls-oidc.md`
- T3 evidence automation: `findings/2026-06-21-v18-T3-L51-soc2-evidence-automation.md`
