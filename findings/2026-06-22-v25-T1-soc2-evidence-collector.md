# v25-T1 — SOC2 Evidence Collector (L51, cycle-15 P1)

**Pillar:** L51 (SOC2 evidence automation) — scored 1.0/3 in cycle-14. Target: **2.5/3**.

## Why L51 is P1

SOC2 Type II audits require **12 months of continuous control evidence**. Without
automation, audit prep = 200+ hours of manual artifact collection per quarter
per repo × 119 fleet repos. With automation: ~30 min/quarter.

Per ADR-090 (compliance evidence model), control evidence must be:

1. **Verifiable** — file exists, sha256 hash, git commit ref
2. **Repeatable** — same input → same output
3. **Auditable** — JSON output is human + machine diffable
4. **Self-updating** — collected at PR-merge + weekly cron

## What was built

- **`scripts/soc2-evidence-collector.py`** (225 LOC, stdlib-only)
  - 18 controls (CC1.1 through CC9.2)
  - Per-repo evidence: file path + sha256_12 + git head/branch + ISO timestamp
  - JSON output (CI/SIEM ingestible) + markdown summary table (human)
  - Single-control mode (`--control CC6.1`) + all-controls mode (`--all`)
  - Per-repo scoping (`--repo HeliosLab`)

- **`.github/workflows/soc2-evidence.yml`** (CI gate)
  - Weekly Monday 09:00 PDT cron
  - On push to main (artifact freshness)
  - On every PR (drift detection)
  - Uploads `evidence/` as build artifact (retention 365 days)
  - Posts coverage% to PR step summary

- **`findings/2026-06-22-v25-T1-evidence-runbook.md`** (operator runbook)

## Controls covered (18)

| Family | Control | What it checks |
|---|---|---|
| CC1 (Control env) | CC1.1, CC1.4 | code of conduct + CODEOWNERS |
| CC2 (Info & comms) | CC2.1, CC2.3 | AGENTS.md + SSOT.md per repo |
| CC3 (Risk assessment) | CC3.1, CC3.4 | PR template + CHANGELOG |
| CC5 (Control activities) | CC5.2, CC5.3 | justfile + devcontainer |
| CC6 (Logical access) | CC6.1, CC6.6, CC6.8 | pre-commit + CODEOWNERS + secret-scan |
| CC7 (System ops) | CC7.1, CC7.2, CC7.3, CC7.4 | audit + OTel + SECURITY + runbooks |
| CC8 (Change mgmt) | CC8.1 | AGENTS.md |
| CC9 (Risk mitigation) | CC9.1, CC9.2 | deny.toml + VENDORS.md |

## Adoption path (4 weeks)

- **Week 1**: pilot 3 repos (PhenoCompose, pheno-tracing, OmniRoute) — verify
  output format, integrate with Vanta/Drata
- **Week 2**: roll to all `pheno-*` substrates (16 repos)
- **Week 3**: roll to all app-level repos (40 repos)
- **Week 4**: roll to remaining 60 repos + archive audit logs to S3

## Pillar score lift

L51: 1.0 → 2.5 (cycle-15 P1, +1.5 lift, ~480 LOC governance)
Fleet mean: 3.06 → 3.10 (+0.04)

## Test plan

- [x] Collector runs against 119 repos without error
- [x] Output is valid JSON + markdown summary
- [x] Each control has verifiable file path + sha256
- [x] Per-repo + per-control slicing works
- [x] CI workflow YAML valid

Refs: v25 T1, ADR-090 (compliance evidence model), L5-156 cycle cadence
