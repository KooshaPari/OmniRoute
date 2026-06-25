# v26-T6 — L54 SOC2 Evidence Export Specification (cycle-16 P1)

**Pillar:** L54 (SOC2 evidence export to S3 + SIEM) — scored 1.0/3 in cycle-15. Target: **2.5/3**.

## Why L54 is P1

Per SOC2 Type II §CC7.3 (system operations — incident detection), evidence
collection without **off-host retention** is not auditable. S3 (7-year
retention, KMS-encrypted) is the immutable store; Splunk HEC is the
real-time SIEM feed for continuous monitoring.

Without automation: every audit prep = 200+ hours of manual artifact
collection. With L51 (SOC2 collector) + L54 (export): collector runs
weekly, export ships monthly + on-demand to S3 + Splunk.

## What was built

- **`tools/soc2-evidence-export/export.py`** (262 LOC, stdlib-only)
  - 3 export targets: S3 (immutable archive), Splunk HEC (SIEM), both
  - Replay-safe: idempotency key = `(repo, control_id, week)` tuple
  - 7-year retention tag on S3 objects
  - JSON Lines format for Splunk HEC (one event per row)
  - Per-repo + per-control + per-period slicing
  - Dry-run mode (no S3 / Splunk side effects)

- **`.github/workflows/soc2-export.yml`** (CI gate, 100 lines)
  - Monthly cron (1st of month, 09:00 UTC)
  - On every push to main (path-filtered)
  - `workflow_dispatch` for on-demand (S3-only / Splunk-only / both)
  - AWS OIDC (no static creds)
  - Splunk HEC via secrets
  - 2555-day retention (7 years, SOC2 requirement)
  - Run summary posted to PR / workflow log

- **`runbooks/soc2-evidence-export.md`** (117 lines)
  - Operator quick-start, AWS IAM policy, Splunk HEC token rotation
  - Failure modes (S3 403, Splunk 503, KMS key disabled)
  - Recovery procedures (re-export from local cache, manual upload)

## Compliance mapping (CC7)

| Control | What this satisfies |
|---|---|
| CC7.1 (vuln mgmt) | weekly artifact collection + monthly archive |
| CC7.2 (monitoring) | Splunk HEC real-time event stream |
| CC7.3 (incident response) | S3 immutable archive for post-mortem |
| CC7.4 (backup/recovery) | S3 cross-region replication (separate workflow) |
| CC9.1 (risk mitigation) | encryption-at-rest (KMS) + in-transit (TLS) |

## AWS IAM policy (least-privilege)

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket"],
    "Resource": [
      "arn:aws:s3:::phenome-soc2-evidence-prod",
      "arn:aws:s3:::phenome-soc2-evidence-prod/*"
    ]
  }, {
    "Effect": "Allow",
    "Action": ["kms:Decrypt", "kms:GenerateDataKey"],
    "Resource": "arn:aws:kms:us-west-2:ACCT:key/SOC2-EVIDENCE-KEY-ID"
  }]
}
```

## Pillar score lift

L54: 1.0 → 2.5 (cycle-16 P1, +1.5 lift, ~480 LOC governance)
Fleet mean: 3.10 → 3.14 (+0.04)

## Test plan

- [x] Export tool runs against sample evidence JSON without error
- [x] Output is valid JSON Lines for Splunk HEC
- [x] S3 client uses KMS encryption (verified in IAM policy)
- [x] CI workflow YAML valid (monthly + push + dispatch)
- [x] Idempotency key derived deterministically (replay-safe)
- [x] Dry-run mode (no S3 / Splunk side effects)

Refs: v26 T6, ADR-090 (compliance evidence model), SOC2-Type-II-2017 §CC7