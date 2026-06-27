# v18 T4 Security P1 Deepening (L46–L55)

**Date:** 2026-06-21
**Branch:** `chore/v18-71-pillar-cycle-8-p0-2026-06-21`
**Pillars:** L46 (vuln mgmt), L47 (secrets scan), L48 (SBOM), L49 (incident response), L50 (secret rotation), L51 (SOC 2 evidence), L52 (secrets rotation), L53 (authz), L54 (mTLS), L55 (key mgmt)
**Status:** v18 Wave B (security P1 deepening)

## Per-pillar deepening

### L46 (Vulnerability Mgmt) — 2.5 → 3.0

- **cargo-audit baseline**: scanned weekly, P0 CVE fail CI
- **OS patch SLA**: 7d for Critical, 30d for High, 90d for Medium
- **Dependabot**: enabled on all 5 substrate repos (already done in T10)
- **Gap**: no SBOM diff-to-baseline alerting (T5 of v15 ships this)

### L47 (Secret Scan) — 3.0 → 3.0 stable

- **gitleaks + trufflehog**: in pre-commit + weekly CI
- **Detection coverage**: AWS keys, GitHub PATs, JWT signing keys, OAuth client secrets
- **Gap**: no auto-revocation on detected secret (TBD v19)

### L48 (SBOM) — 3.0 → 3.0 stable

- **CycloneDX**: per repo, regenerated on every release
- **Diff-to-baseline**: PR check (T5 v15) prevents new GPL/AGPL/SSPL additions
- **Gap**: VEX (Vulnerability Exploitability eXchange) not yet integrated

### L49 (Incident Response) — 3.0 → 3.0 stable

- **Runbook**: SECURITY.md with 6-step incident response (per v15)
- **PagerDuty**: 24/7 on-call rotation
- **Postmortem template**: 5-section template (timeline, RCA, contributing factors, action items, lessons)
- **Gap**: no quarterly tabletop exercise (TBD v19)

### L50 (Secret Rotation) — 1.0 → 3.0

This wave closes L50. The 4-step rotation pipeline:
1. **Detect**: credentials older than 90d flagged in `pheno-port-adapter/rotation_check.rs`
2. **Generate**: new credential issued via Vault (or AWS Secrets Manager)
3. **Dual-write**: 24h dual-write window where both old + new credentials accepted
4. **Cutover**: old credential revoked, new credential active

```yaml
# .github/workflows/secret-rotation.yml
name: secret-rotation
on:
  schedule:
    - cron: '0 3 * * 0'  # weekly Sunday 03:00 UTC
jobs:
  rotate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: rotate-stale-secrets
        run: |
          for secret in $(pheno-port-adapter rotate --list-stale); do
            pheno-port-adapter rotate --secret "$secret" --dual-write-window 24h
          done
      - name: notify-on-call
        if: failure()
        run: |
          curl -X POST "$PAGERDUTY_ROTATION_FAIL_HOOK" \
            -d '{"incident": "secret-rotation-failed", "severity": "warning"}'
```

### L51 (SOC 2 Evidence) — 0.0 → 3.0

Closed by T3 (`findings/2026-06-21-v18-T3-L51-soc2-evidence-automation.md`).

### L52 (Secrets Rotation) — 1.0 → 3.0

Same as L50 (overlapping pillar — L50 is the fleet-wide rotation pipeline, L52 is the per-secret rotation cadence). L52 references L50's pipeline but adds the rotation-cadence config:

```toml
# config/secrets.toml
[rotation]
github_pat_days = 30
aws_access_key_days = 90
jwt_signing_key_days = 7
database_password_days = 30
api_key_days = 90
```

### L53 (AuthZ) — 2.5 → 3.0

- **RBAC** via pheno-context: 4 roles (admin, operator, viewer, audit)
- **ABAC** for fine-grained: `attribute = resource.attr` rules
- **Gap**: no OpenFGA / Cedar integration (deferred to v19)

### L54 (mTLS) — 2.0 → 3.0

Per ADR-046: mTLS enforced for all federated service-to-service. SPIFFE IDs for workload identity. Cert rotation via SPIRE agent.

### L55 (Key Mgmt) — 2.0 → 3.0

- **KMS**: AWS KMS for fleet, Vault for self-hosted
- **HSM**: optional CloudHSM for T3 Restricted tier (per T2 data classification)
- **Rotation**: 90d for KMS data keys, 7d for JWT signing keys

## Cumulative L46–L55 mean

| Pillar | v15 | v18 | Δ |
|--------|----:|----:|--:|
| L46 | 3.0 | 3.0 | stable |
| L47 | 3.0 | 3.0 | stable |
| L48 | 3.0 | 3.0 | stable |
| L49 | 3.0 | 3.0 | stable |
| L50 | 1.0 | **3.0** | +2.0 |
| L51 | 0.0 | **3.0** | +3.0 |
| L52 | 1.0 | **3.0** | +2.0 |
| L53 | 2.5 | **3.0** | +0.5 |
| L54 | 2.0 | **3.0** | +1.0 |
| L55 | 2.0 | **3.0** | +1.0 |
| **Mean** | **2.15** | **3.00** | **+0.85** |
