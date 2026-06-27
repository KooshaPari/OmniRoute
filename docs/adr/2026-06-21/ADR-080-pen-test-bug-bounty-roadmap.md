# ADR-080: Pen Test + Bug Bounty Roadmap (L53)

| Field | Value |
|---|---|
| **Status** | PROPOSED (v19 T5, 2026-06-21) |
| **Date** | 2026-06-21 |
| **Pillar** | L53 (Pen Testing / Bug Bounty — OWASP ASVS V1.14, NIST SSDF PW.7, ISO 27001 A.14.2.8, SOC2 CC4.1) |
| **Cycle** | 9 (v19) |
| **Author** | orch-v19 (forge) |
| **Sponsors** | security circle, infra circle |
| **Supersedes** | None (first pen-test + bounty ADR) |
| **Related** | ADR-042 (security audit cadence), ADR-046 (federation mTLS + OIDC), ADR-077 (Vault migration), ADR-078 (encryption-at-rest), ADR-079 (OIDC reference), ADR-081 (SLSA L3 — planned) |
| **Plan ref** | `plans/2026-06-21-v19-71-pillar-cycle-9-p0.md` § T5 |

## 1. Context

The 71-pillar cycle-8 probe (`findings/2026-06-21-v18-cycle-8-probe.md`) scored **L53 (Pen Testing) at 2.0 / 3**. Driving findings:

1. **No annual cadence.** Pen tests are ad-hoc — 2 historical pen tests in 18 months (one in 2024-Q4 by a now-defunct vendor, one in 2025-Q2 by a non-specialist firm). No defined recurrence, no contract, no SLA.
2. **No bug bounty program.** 0 triaged external reports, 0 public disclosure policy, 0 bounty pool. 2 independent security researchers have DM'd the maintainer about unpatched issues with no published intake path.
3. **Fleet expanded 4×** since the last pen test: 11 substrate crates, 9 SDKs, 6 federated services, 47 active repos, 26 production binaries. The 2025-Q2 pen test covered 4 repos; coverage of the current fleet is **< 10%**.
4. **3 regulatory drivers** converged in 2026: SOC2 CC4.1 requires an annual independent security assessment; ISO 27001 A.14.2.8 requires systematic penetration testing; the upcoming customer MSA (master service agreement) template references "an industry-standard pen-test cadence" as a contractual obligation.
5. **Companion ADRs in flight** raise the bar: ADR-077 (Vault), ADR-078 (encryption-at-rest), ADR-079 (OIDC) all need an external validation pass once they ship. Pen-test scope in 2026-Q3 explicitly covers the new attack surface from those 3 ADRs.

This ADR establishes the **annual cadence, scope, vendor shortlist, budget, and SLA** that lifts L53 from 2.0 to 2.5 (target: 3.0 by 2027-Q4 after 2 full annual cycles).

## 2. Annual Cadence

The fleet runs **2 external pen tests + 1 bug bounty per calendar year**, on a fixed quarterly schedule:

| Quarter | Activity | Window | Vendor | Effort |
|---|---|---|---|---|
| **Q1** | External pen test (full scope) | 2027-02-15 → 2027-03-15 (5 weeks) | Trail of Bits (primary) or Cure53 (secondary, alternating) | 4 engineer-weeks |
| **Q2** | Bug bounty launch + active window | Launch 2027-04-15; window 2027-04-15 → 2027-07-15 (13 weeks) | HackerOne (primary) or Bugcrowd (backup) | continuous |
| **Q3** | External pen test (focused scope on new attack surface) | 2027-08-15 → 2027-09-15 (5 weeks) | Trail of Bits / Cure53 (alternating) | 3 engineer-weeks |
| **Q4** | Internal-only red team + bounty triage | 2027-10-15 → 2027-12-15 | internal | 2 engineer-weeks |

**Pilot year 2026 H2 (this ADR's effective start):** 1 pen test (Q3 2026-09) covers the post-ADR-077/078/079 surface; bug bounty launches 2026-Q4 (Nov 1) on HackerOne. Pilot evaluates the 2× cadence in 2027.

**Pen-test scope doc (per engagement):** `docs/security/pen-test-{YYYY-Qn}-scope.md` is published 4 weeks before engagement start, with the full asset list, threat model summary, rules of engagement, and out-of-scope items.

**Bounty program page:** `https://github.com/KooshaPari/phenotype-apps/security/policy` (GitHub Security Policy) cross-linked from `phenotype.org/.well-known/security.txt` per RFC 9116.

## 3. Scope

**In scope (every engagement, 2027+):**

- **47 active repos** under `github.com/KooshaPari/*` (per the registry's `fsm: active` rows in `phenotype-registry/registry/disposition-index.json`).
- **9 substrate crates** (`pheno-config`, `pheno-context`, `pheno-errors`, `pheno-flags`, `pheno-otel`, `pheno-port-adapter`, `pheno-tracing`, `pheno-mcp-router`, `pheno-capacity`) plus their dependents in the workspace.
- **All public APIs** — REST endpoints exposed by `phenotype-router`, gRPC services in `phenotype-hub`, and the 6 federated services (`phenoMCP`, `phenoObservability`, `phenoEvents`).
- **Federation endpoints** — OIDC discovery, JWKS, mTLS handshake paths (per ADR-046 + ADR-079).
- **Vault paths** — every secret path created under `secret/data/phenotype/*` post ADR-077 cutover.
- **CI/CD pipelines** — GitHub Actions workflows, Buildkite pipelines, Jenkins jobs (read-only on the runners, write on the workflows themselves).
- **Public container images** — all 26 production binaries on GHCR / Docker Hub.
- **Public documentation** — `phenotype.org`, `docs.phenotype.org`, the registry's public surface.

**Out of scope (every engagement):**

- **PAUSED apps** per ADR-023 (AtomsBot*, focalpoint, Dino, QuadSGM, WSM) — no active consumers, no value in testing dormant code.
- **Archived repos** (Dmouse92/* fleet, `phenotype-monorepo-state`, etc.) — read-only tombstones, no production traffic.
- **Partner-only infrastructure** — vendor SaaS (e.g. Linear, Notion, Figma) and customer-managed single-tenant deployments.
- **Social engineering / phishing** — explicitly excluded from the pen-test SOW; the bug bounty program's T&Cs also exclude it.
- **Physical security** — all infrastructure is cloud-only; no on-prem.

**Per-engagement scope document** (`docs/security/pen-test-{YYYY-Qn}-scope.md`) is published 4 weeks pre-engagement and signed off by the security circle. The scope doc adds engagement-specific targets (e.g. the new OIDC verifier in Q3 2026, the new Vault paths in Q1 2027).

## 4. Vendor Shortlist

Four vendors across two categories. Alternating primary/secondary per year so we don't anchor on a single firm's blind spots.

### Pen-test firms (2×/year)

| Vendor | Strengths | Weaknesses | Cost (typical) | Selection |
|---|---|---|---|---|
| **Trail of Bits** | SOTA Rust + Go expertise; published tooling (Echidna, Manticore, Slither); deep crypto review; published 4 of the 14 Rust CVE disclosures in 2025 | High cost; 6-week lead time; small firm (capacity risk) | $28K–$35K / engagement | Primary 2027, 2028 |
| **Cure53** | Excellent web + browser-side; Berlin-based (EU data residency option); strong API security track record; published 12+ CVE in 2025 | Less deep on Rust internals; smaller team for systems code | $18K–$25K / engagement | Secondary 2027, 2028 |

### Bug-bounty platforms (1×/year launch)

| Vendor | Strengths | Weaknesses | Cost | Selection |
|---|---|---|---|---|
| **HackerOne** | Largest researcher pool (1M+); mature triage tooling; integrated with GitHub Security Advisories; reputation system | 20% platform fee on top of bounty pool | $20K–$50K / year (pool + fees) | Primary 2026 H2, 2027, 2028 |
| **Bugcrowd** | Stronger enterprise procurement; flexible bounty structures (vouchers, swag); good VDP (vulnerability disclosure program) support | Smaller researcher pool; less Rust-specific community | $15K–$40K / year | Backup if HackerOne is unresponsive; 2029+ candidate |

**Procurement process:**

1. **RFP issued** 8 weeks before engagement start, sent to 2 firms (1 primary + 1 secondary) per category.
2. **Selection criteria** (weighted): technical depth (40%), lead time (15%), cost (20%), prior fleet knowledge / continuity (15%), references (10%).
3. **Contract template**: SOW + NDA + safe-harbor clause (researchers + pen testers protected in good-faith work) + 30-day remediation window + optional 12-month retainer for triage.

## 5. Budget

Annual budget for the L53 program:

| Line item | Cost | Notes |
|---|---|---|
| **External pen test #1 (Q1, full scope)** | $25K | Trail of Bits, 4 engineer-weeks, full fleet |
| **External pen test #2 (Q3, focused)** | $20K | Cure53, 3 engineer-weeks, new attack surface from ADR-077/078/079/081 |
| **Bug bounty program (Q2 launch, 13 weeks)** | $20K / year minimum pool | HackerOne; pool is **refilled** at year-end if spent |
| **Bug bounty max single payout** | $100K | Reserved for "full production RCE + persistent access" or "complete signing-key compromise" |
| **Bounty platform fees (HackerOne 20%)** | included in $20K pool | Net to researchers; fee separate line on invoice |
| **Triage coordination (internal)** | 0.25 FTE × 12 months | Security circle lead; not a new hire |
| **TOTAL annual budget** | **$65K** | $45K pen test + $20K bounty pool minimum |

**Bounty payout table** (per HackerOne program config, public on the program page):

| Severity | CVSS | Example finding | Payout |
|---|---|---|---|
| **Critical** | 9.0–10.0 | Pre-auth RCE on production; signing-key extraction; full DB exfil | $25K–$100K |
| **High** | 7.0–8.9 | Authenticated RCE; privilege escalation to admin; persistent XSS on admin paths | $5K–$25K |
| **Medium** | 4.0–6.9 | Stored XSS; SSRF with internal access; sensitive info disclosure | $500–$5K |
| **Low** | 0.1–3.9 | Reflected XSS; rate-limit bypass; missing security headers | $100–$500 |
| **Informational** | N/A | Best-practice violations; no exploitable impact | $0 (hall of fame) |

**Payout ceiling ($100K):** requires 2-of-2 sign-off from the security circle lead + the fleet tech lead; documented in `docs/security/bounty-payout-decisions.md` within 24h of the payout.

**Payout floor ($20K/year):** if the pool is underspent at year-end, the residual rolls into the next year's pool. If the pool is overspent (e.g. a single critical), the security circle may request an emergency budget supplement from the fleet budget (up to +$50K) at the next monthly review.

## 6. SLAs

**Triage SLA (vendor → fleet, from report submission):**

| Severity | Triage ack | Triage verdict | Patch SLA | Public disclosure |
|---|---|---|---|---|
| **P0 — Critical** | 24h | 72h | 7 days | 90 days (or coordinated sooner) |
| **P1 — High** | 7 days | 14 days | 30 days | 90 days |
| **P2 — Medium** | 30 days | 60 days | 90 days | next release |
| **P3 — Low** | 90 days | 180 days | best-effort | next release |

**Definitions:**

- **Triage ack** — first human response to the reporter; can be "received, escalating" with no technical content.
- **Triage verdict** — confirmed / not reproducible / not applicable / out of scope, with technical justification.
- **Patch SLA** — fix shipped to `main` and a GHSA (GitHub Security Advisory) drafted, ready for coordinated disclosure.
- **Public disclosure** — GHSA published; CVE assigned via GHSA-MITRE; researcher credited (opt-in).

**Severity mapping:** bug-bounty severity is **the same scale** as the triage SLA; HackerOne's CVSS 9.0+ = P0, 7.0–8.9 = P1, 4.0–6.9 = P2, 0.1–3.9 = P3.

**SLA clocks pause** when:
- The reporter is unreachable for > 7 days.
- A vendor is in the middle of a coordinated disclosure with a downstream consumer.
- The fix requires a breaking change gated on a release window (max 30-day pause).

**SLA escalation:** if P0 triage ack is missed by > 4h, the security circle lead is paged via the on-call rotation. If P0 patch SLA is missed by > 24h, the fleet tech lead is paged.

## 7. Phasing

| Phase | Window | Goal | Owner |
|---|---|---|---|
| **P1: Pilot (2026 H2)** | 2026-07-01 → 2026-12-31 | 1 pen test (Q3, 2026-09) + 1 bug bounty launch (Q4, 2026-11-01) | security circle |
| **P2: Annual cadence established (2027)** | 2027-01-01 → 2027-12-31 | 2 pen tests + 1 bounty, full program running; L53 → 2.5 / 3 | security circle |
| **P3: Maturation (2028)** | 2028-01-01 → 2028-12-31 | Add internal red team (Q4); L53 → 3.0 / 3 | security circle + red team |

**Pilot success criteria (P1):**

- Pen test ships a written report with < 30-day-old findings all triaged within 7 days.
- Bug bounty program launches; ≥ 5 valid reports in the first 90 days; ≥ 1 P1+ finding closed within SLA.
- Researcher NPS (HackerOne post-program survey) ≥ 8/10.
- Internal triage process is documented in `docs/security/triage-runbook.md`.

## 8. Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | Vendor capacity crunch (Trail of Bits 6-week lead time) | Medium | Medium | Lock engagement 12 weeks ahead; pre-pay retainer; secondary vendor on standby | security circle lead |
| R2 | Low-quality bounty reports (flood of P3 / Informational) | High | Low | Triage automation via HackerOne `auto-clone`; researcher reputation filter; 30-day quiet period after launch | platform-eng-1 |
| R3 | Researcher finds a 0-day in a 3rd-party dep (not fleet code) | Medium | High | Coordinated disclosure runbook; maintain a 14-day cache of dependabot updates | sec-eng-1 |
| R4 | Public disclosure conflict (researcher goes early) | Low | High | Pre-signed coordinated-disclosure agreement; pre-published GHSA drafts; legal escalation path | security circle lead + legal |
| R5 | Bounty pool overspent (single critical finding) | Low | Medium | Emergency budget supplement up to +$50K from fleet budget; documented in monthly review | fleet tech lead |
| R6 | Pen-test report leaked before fixes ship | Low | High | NDA + encrypted delivery; redaction of exploit details until patched; embargo on socials | security circle lead |
| R7 | Researcher mines PAUSED apps (e.g. capstone repos) for issues | Medium | Low | PAUSED apps explicitly out of bounty scope; legal carve-out in T&Cs | security circle lead |

## 9. Cross-References

- **ADR-042** (Security audit cadence) — base monthly `cargo audit` / `pip-audit` / `govulncheck` sweep feeds the pen-test scoping doc.
- **ADR-046** (Federation mTLS + OIDC) — Q3 2026 pen test explicitly covers the OIDC verifier attack surface.
- **ADR-077** (Vault migration) — Q1 2027 pen test covers the Vault path attack surface.
- **ADR-078** (Encryption-at-rest) — covered in every engagement; tests both `zeroize` usage and EBS / S3 encryption.
- **ADR-079** (OIDC reference) — pen-test harness reuses the OIDC client for test-account provisioning.
- **ADR-081** (SLSA L3 — planned, v20) — pen-test findings feed the SLSA threat model.
- **`phenotype-registry`** — registry's `fsm: active` rows are the canonical 47-repo list; updated weekly.
- **`docs/security/`** — per-engagement scope docs, payout decisions, triage runbook all land here.

## 10. Open Questions (deferred)

1. **Self-hosted vs managed HackerOne** — HackerOne's managed offering costs more but provides triage staff. Decision deferred to 2026-09-01 (post pilot RFP).
2. **Customer-facing security portal** — should `phenotype.org/security` show real-time triage status? Decision deferred to 2027-Q1 customer-feedback review.
3. **Researcher exclusivity contracts** — should we offer retainer-style agreements to top researchers? Decision deferred; legal review pending.
4. **Bug-bounty in EU data residency** — does the fleet need a separate EU-scope program post-GDPR review? Decision deferred to 2027-Q2.

## 11. Decision

**Adopt** the L53 program as specified: 2× external pen tests (Q1 + Q3) + 1× bug bounty (Q2), 47-repo + 9-substrate-crate scope, 4-vendor shortlist, $65K annual budget, and the P0/P1/P2/P3 SLA table. **Pilot in 2026 H2** with 1 pen test (Q3) + 1 bounty launch (Q4); full cadence in 2027.

**Score target:** L53 2.0 → **2.5** by end of 2026-12-31 (post-pilot); L53 2.5 → **3.0** by end of 2027-12-31 (post-maturation). Refresh cadence: weekly 71-pillar audit (per ADR-041).
