# v19 T5 — Pen Test + Bug Bounty Execution Plan (L53)

**Authority:** ADR-080 (Pen Test + Bug Bounty Roadmap) — operationalization for 2026 H2 pilot
**Cycle:** 9 (v19) — T5 companion to ADR-080
**Owner:** security circle (sec-eng-1, security circle lead)
**Last updated:** 2026-06-21
**Score target:** L53 2.0 → 2.5 by 2026-12-31 (post-pilot); 2.5 → 3.0 by 2027-12-31 (post-maturation)

This is the **execution plan** that operationalizes ADR-080 for the 2026 H2 pilot. ADR-080 establishes the policy (annual cadence, vendor shortlist, budget, SLA). This document is the **calendar**, the **scoping checklist**, the **triage runbook reference**, and the **pilot success criteria** that the security circle executes against.

---

## 1. Pilot calendar (2026 H2)

| Date | Activity | Owner | Deliverable |
|------|----------|-------|-------------|
| **2026-07-01** | Pilot kickoff (sync) | security circle lead | Pilot charter doc (`docs/security/pilot-2026-h2-charter.md`) |
| **2026-07-15** | Pen-test RFP issued (Trail of Bits + Cure53) | security circle lead | RFP packet, SOW template, NDA |
| **2026-08-15** | Pen-test vendor selected; SOW signed | security circle lead | Signed SOW, invoice schedule |
| **2026-08-31** | Pen-test scope doc published (4 weeks pre-engagement) | sec-eng-1 | `docs/security/pen-test-2026-q3-scope.md` |
| **2026-09-01 → 2026-09-30** | **External pen test (Q3 2026)** | Trail of Bits (or Cure53) | Pen-test report; daily check-ins |
| **2026-10-01** | Pen-test triage of findings begins | sec-eng-1 | Triaged findings in HackerOne / GitHub Security Advisories draft |
| **2026-10-15** | Bug-bounty RFP issued (HackerOne) | security circle lead | Bounty program agreement |
| **2026-10-31** | Bounty program page live; program config in HackerOne | sec-eng-1 | Live `https://hackerone.com/kooshapari` page |
| **2026-11-01** | **Bug bounty launch** | security circle lead | Public launch post + Slack #fleet-security |
| **2026-11-15** | Mid-pilot retro (Slack async) | security circle lead | Retro doc (`docs/security/pilot-2026-h2-retro-mid.md`) |
| **2026-12-15** | Pilot closure; L53 71-pillar re-audit | orch-v19 | Updated scorecard |
| **2026-12-31** | Pilot success criteria validated; 2027 plan drafted | security circle lead | `docs/security/pilot-2026-h2-closure.md` |

---

## 2. Q3 2026 pen-test scoping checklist

The scope document is published 4 weeks pre-engagement. The checklist is owned by sec-eng-1 and reviewed by the security circle.

### 2.1 In scope (per ADR-080 § 3)

- [ ] **47 active repos** — pulled from `phenotype-registry/registry/disposition-index.json` `fsm: active` rows, dated the day the scope doc is published.
- [ ] **9 substrate crates** — `pheno-config`, `pheno-context`, `pheno-errors`, `pheno-flags`, `pheno-otel`, `pheno-port-adapter`, `pheno-tracing`, `pheno-mcp-router`, `pheno-capacity`.
- [ ] **All public REST APIs** exposed by `phenotype-router` (47 repos × ~3 endpoints each = ~140 endpoints).
- [ ] **All gRPC services** in `phenotype-hub` (3 services: trait-router, model-router, event-router).
- [ ] **Federation endpoints** — OIDC discovery, JWKS, mTLS handshake paths (per ADR-046 + ADR-079).
- [ ] **Vault paths** — every path created under `secret/data/phenotype/*` post-ADR-077 cutover (in 2026-Q3 this is the dev cluster, not prod).
- [ ] **CI/CD pipelines** — read-only on the runners, write on the workflows themselves.
- [ ] **Public container images** — all 26 production binaries on GHCR / Docker Hub.
- [ ] **Public documentation** — `phenotype.org`, `docs.phenotype.org`, the registry's public surface.

### 2.2 Out of scope (per ADR-080 § 3)

- [ ] **PAUSED apps** per ADR-023 — explicit no-go list: `AtomsBot*`, `focalpoint`, `Dino`, `QuadSGM`, `WSM`.
- [ ] **Archived repos** — `Dmouse92/*` fleet, `phenotype-monorepo-state`, etc.
- [ ] **Partner-only infrastructure** — vendor SaaS (Linear, Notion, Figma), customer single-tenant deployments.
- [ ] **Social engineering / phishing** — excluded from SOW.
- [ ] **Physical security** — cloud-only, no on-prem.

### 2.3 Engagement-specific (Q3 2026)

- [ ] **OIDC verifier** (ADR-079) — focused review of the new attack surface from `pheno-context/src/oidc.rs`.
- [ ] **Vault dev cluster** (ADR-077 Phase 1) — focused review of the OIDC-bound token exchange paths.
- [ ] **Encryption-at-rest** (ADR-078) — spot-check the `#[derive(ZeroizeOnDrop)]` usage in `pheno-config/src/secrets.rs`.

### 2.4 Rules of engagement

- [ ] **Test window:** 2026-09-01 → 2026-09-30 (4 weeks; ADR-080 says 5 but Q3 is compressed).
- [ ] **Communication:** daily check-in via Slack `#fleet-pentest-2026q3`; emergency via PagerDuty SEV-2 path.
- [ ] **Out-of-bounds handling:** any access to a PAUSED-app repo or out-of-scope subdomain triggers an immediate stop; documented in the report.
- [ ] **Data handling:** no production data exfiltrated; all test data synthetic; report delivered over encrypted channel.

---

## 3. Bug bounty launch checklist (2026-11-01)

### 3.1 HackerOne program config

- [ ] **Program name:** `KooshaPari / phenotype` (public program; managed by HackerOne).
- [ ] **Scope:** 47 active repos (per the registry); explicit PAUSED-app no-go.
- [ ] **Bounty range:** Critical $25K–$100K, High $5K–$25K, Medium $500–$5K, Low $100–$500.
- [ ] **Pool:** $20K / year minimum, refillable on overspend (per ADR-080 § 5).
- [ ] **Response SLAs:** P0 24h ack / 72h verdict / 7d patch; P1 7d / 14d / 30d; P2 30d / 60d / 90d; P3 90d / 180d / best-effort.
- [ ] **Safe harbor:** explicit clause that researchers acting in good faith are protected from legal action (per ADR-080 § 4 procurement).

### 3.2 Public surface

- [ ] **GitHub Security Policy:** `KooshaPari/phenotype-apps/security/policy` (the canonical link target).
- [ ] **`.well-known/security.txt`:** at `phenotype.org/.well-known/security.txt` per RFC 9116, pointing to the HackerOne program page.
- [ ] **Launch post:** `phenotype.org/blog/bug-bounty-launch` published 2026-11-01; cross-linked from HackerOne, GitHub Security tab, and `#fleet-security` Slack.
- [ ] **Researcher onboarding doc:** `docs/security/bounty-researcher-guide.md` (HackerOne program description + scope + safe-harbor language).

### 3.3 Internal triage process

The triage runbook is at `docs/security/triage-runbook.md` (owned by sec-eng-1, drafted in parallel with the launch). Summary:

1. **Ack within SLA** — security circle lead paged via PagerDuty if P0 ack > 4h.
2. **Verify reproducibly** — sec-eng-1 reproduces on a clean dev environment; assigns CVSS v3.1.
3. **Triage verdict** — confirmed / not-reproducible / not-applicable / out-of-scope; technical justification documented.
4. **Patch** — fix in `main`; GHSA draft ready; coordinated disclosure per researcher's preference.
5. **Bounty payout** — HackerOne flow; floor $100, ceiling $100K; > $25K requires 2-of-2 sign-off (security circle lead + fleet tech lead).
6. **Public disclosure** — GHSA published; CVE assigned via GHSA-MITRE; researcher credited (opt-in).

---

## 4. Pilot success criteria (per ADR-080 § 7 P1)

| Criterion | Target | Measurement | Owner |
|-----------|--------|-------------|-------|
| Pen-test report ships with all findings < 30 days old triaged | 100% | Report + triage matrix | sec-eng-1 |
| Bug bounty launches on 2026-11-01 | Yes | HackerOne program page live | security circle lead |
| ≥ 5 valid reports in the first 90 days | ≥ 5 | HackerOne analytics | sec-eng-1 |
| ≥ 1 P1+ finding closed within SLA | ≥ 1 | Triage runbook log | sec-eng-1 |
| Researcher NPS (HackerOne post-program survey) | ≥ 8/10 | HackerOne report | security circle lead |
| Triage runbook documented | Yes | `docs/security/triage-runbook.md` exists | sec-eng-1 |
| L53 score moves 2.0 → 2.5 | Yes | 71-pillar re-audit 2026-12-15 | orch-v19 |

**Pilot failure mode:** if < 3 of 7 criteria met, the security circle lead re-evaluates the vendor (or bounty platform) selection before committing to 2027 cadence. The fallback is to keep the 2026 pilot running through 2027-Q1 and re-evaluate at that point.

---

## 5. Risk register (T5-specific, supplementing ADR-080 § 8)

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|------|------------|--------|------------|-------|
| **R1** | Trail of Bits 6-week lead time pushes Q3 engagement past 2026-09-30 | Medium | Medium | RFP issued 2026-07-15 (7 weeks lead); Cure53 on standby as backup | security circle lead |
| **R2** | Bounty launch slips past 2026-11-01 due to HackerOne procurement | Medium | Low | Contract pre-negotiated in 2026-Q3; if blocked, launch on Bugcrowd instead (ADR-080 § 4 backup) | security circle lead |
| **R3** | Pilot reveals 0-day in PAUSED app (e.g. AtomsBot) — researcher mines capstone repos | High | Low | Explicit no-go in bounty T&Cs; legal carve-out per ADR-080 R7; triaged as Informational | sec-eng-1 |
| **R4** | Pen-test report leaked pre-fix | Low | High | NDA + encrypted delivery; embargo on socials; pre-drafted GHSA embargo template | security circle lead |
| **R5** | Single critical finding exhausts bounty pool before year-end | Low | Medium | Emergency budget supplement +$50K per ADR-080 § 5 | fleet tech lead |
| **R6** | Researcher finds 0-day in 3rd-party dep (not fleet code) | Medium | High | Coordinated disclosure runbook; 14-day dependabot cache; ADR-080 R3 mitigation | sec-eng-1 |

---

## 6. Files to be created in this track

Per ADR-080 § 11 and this execution plan:

- [ ] `docs/security/pen-test-2026-q3-scope.md` (published 2026-08-31)
- [ ] `docs/security/pilot-2026-h2-charter.md` (published 2026-07-01)
- [ ] `docs/security/triage-runbook.md` (published 2026-10-15)
- [ ] `docs/security/bounty-researcher-guide.md` (published 2026-10-31)
- [ ] `docs/security/pilot-2026-h2-retro-mid.md` (published 2026-11-15)
- [ ] `docs/security/pilot-2026-h2-closure.md` (published 2026-12-31)
- [ ] `phenotype.org/.well-known/security.txt` (live 2026-11-01)
- [ ] `phenotype.org/blog/bug-bounty-launch` (published 2026-11-01)
- [ ] `KooshaPari/phenotype-apps/security/policy` (live 2026-10-31)

All 9 files are **MacBook-OK per ADR-023 Rule 1** (markdown / config, no cargo / network / sim). Total estimated ~600 LoC of new docs.

---

## 7. Cross-references

- **ADR-080** — Pen Test + Bug Bounty Roadmap (the parent policy)
- **ADR-042** — Security audit cadence (the monthly `cargo audit` / `pip-audit` / `govulncheck` sweep that feeds the scope doc)
- **ADR-046** — Federation mTLS + OIDC (Q3 pen-test explicitly covers this attack surface)
- **ADR-077** — Vault migration (Q1 2027 pen-test covers the Vault path attack surface)
- **ADR-078** — Encryption-at-rest (covered in every engagement)
- **ADR-079** — OIDC reference (pen-test harness reuses the OIDC client)
- **ADR-081** — SLSA L3 (planned, v20) — pen-test findings feed the SLSA threat model
- **`phenotype-registry`** — canonical 47-repo list (the `fsm: active` rows)
- **`docs/security/`** — the directory all T5 deliverables land in
- **`plans/2026-06-21-v19-71-pillar-cycle-9-p0.md`** — the v19 plan, § T5

---

## 8. Acceptance

This execution plan is **PROPOSED** for v19 cycle 9 T5 implementation. All 8 sections, the 9-deliverable file list, the 6-risk register, and the 7-criterion pilot success metrics are owned by the security circle with weekly checkpoints per ADR-041.

**Sign-off requires:** security circle lead + fleet tech lead. **Approval SLA:** 48 hours from PROPOSED. If no objection by 2026-06-23 17:00 PDT, this plan auto-promotes to ACCEPTED alongside ADR-080 and the 2026 H2 pilot calendar is locked.
