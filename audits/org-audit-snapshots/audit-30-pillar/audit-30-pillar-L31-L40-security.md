# L31..L40 — Security (the 10 security pillars)

**Tier:** 1 (continually extended)
**Owner:** Lane owner (Forge)
**Date:** 2026-06-23

## Scope

Security posture across the 13 lane repos. The pillars here are the
minimum SOTA 2026 set; missing any one of them is a regression.

## Pillars (one per bullet)

| # | Pillar | 0=missing | 1=seeded | 2=partial | 3=complete |
|---|--------|-----------|----------|-----------|------------|
| L31 | **Secrets in repo** (`gitleaks`/`trufflehog` CI run, `pre-commit` hook) | n/a | one-off scan | gitleaks in CI only | gitleaks+trufflehog in CI+pre-commit+PR bot |
| L32 | **SBOM emitted** (CycloneDX/SPDX) | absent | hand-curated list | per-release SPX | per-commit SPX+CDX+in-tarball |
| L33 | **Vuln scanning** (`cargo audit`/`pip-audit`/`govulncheck` in CI) | absent | weekly cron | per-PR scan | per-PR + scheduled full + SARIF upload |
| L34 | **Signed commits** (DCO, GPG/SSH, branch protection) | none | DCO signoff | GPG-signed | GPG+branch protection requires it |
| L35 | **Signed releases** (Sigstore/cosign/minisign) | none | tarball+SHA256 | minisign | cosign+SLSA provenance+rekor |
| L36 | **2FA on maintainer accounts** (org-level) | unknown | partial | full for 1+ owners | full for all + hardware key |
| L37 | **Dependabot/Renovate configured** (auto-PRs for outdated deps) | absent | weekly | weekly+automerge-patch | weekly+automerge+test-bot |
| L38 | **CVE feed subscribed** (RSS/email/webhook) | absent | mailing list | GitHub Security Advisories watch | GHSA+OSV+NVD |
| L39 | **Threat model documented** (`THREAT_MODEL.md`) | absent | one-pager | STRIDE table | STRIDE+attack-tree+yearly review |
| L40 | **Sandbox boundary** (container isolation, seccomp, no `privileged: true` in CI) | n/a | Docker only | Docker+no-net | Docker+no-net+seccomp+rootless |

## SOTA 2026 reference

- **GitHub Advanced Security** — code scanning, secret scanning, dep
  review, security overview.
- **SLSA v1.0** — build provenance, hermetic, parameterless, isolated.
- **Sigstore** — cosign keyless signing backed by Fulcio + Rekor.
- **OpenSSF Scorecard** — 18 checks including branch protection, pinned
  dependencies, dangerous workflow, token permissions, fuzzing.
- **Trivy** — single-binary scanner for SBOM+vulns+misconfigs+secrets.

## Per-repo state (2026-06-23 snapshot)

| Repo | L31 | L32 | L33 | L34 | L35 | L36 | L37 | L38 | L39 | L40 | avg |
|------|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| Benchora | 1 | 0 | 0 | 2 | 0 | 2 | 1 | 1 | 0 | 1 | 0.8 |
| portage | 1 | 0 | 0 | 2 | 0 | 2 | 1 | 1 | 0 | 1 | 0.8 |
| pheno-harness | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0.2 |
| phenodag | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0.2 |
| Tracera | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0.2 |
| heliosBench | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0.2 |
| nanovms | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0.3 |
| PhenoCompose | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0.3 |
| BytePort | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | 1 | 0.3 |
| AgilePlus | 0 | 0 | 0 | 2 | 0 | 2 | 0 | 0 | 0 | 0 | 0.4 |
| registry | 0 | 0 | 0 | 2 | 0 | 2 | 0 | 0 | 0 | 0 | 0.4 |
| audits | 1 | 0 | 0 | 2 | 0 | 2 | 0 | 0 | 0 | 0 | 0.5 |
| vibeproxy | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0.0 |

**Cross-repo finding:** the lane is at **~0.4/3 on security** (median
across 13 repos × 10 pillars). The single biggest wins (Tier-1
quick-fix):

1. Wire `gitleaks` into the CI of every repo with secrets scanning (L31)
   — 1 line in `.github/workflows/`.
2. Wire `cargo audit`/`pip-audit`/`govulncheck` into the CI of every
   repo (L33) — 5-line job.
3. Configure Dependabot/Renovate for every repo (L37) — a 30-line
   `dependabot.yml`.
4. Add a `THREAT_MODEL.md` (L39) — a single ADR.

## Cross-references

- Audit L0..L30 (the existing 25 architecture/quality pillars) —
  [`./audit-30-pillar-L0.md`](./audit-30-pillar-L0.md) (etc.).
- Pillar scorecard (numeric per repo) —
  [`../pillar-scores/2026-06-23.json`](../pillar-scores/2026-06-23.json).
- DAG v2 —
  [`../../../plans/2026-06-23-eval-bench-qa-dag-v2.md`](../../../plans/2026-06-23-eval-bench-qa-dag-v2.md) (DAG-T4).
