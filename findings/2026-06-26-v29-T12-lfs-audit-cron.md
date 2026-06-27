# v29-T12 — L60.1 Weekly LFS Audit Cron Adoption (P1→3.0)

## What
Run `tools/lfs-audit/lfs_audit.py` weekly and report non-compliant repos.

## Action
Add `.github/workflows/lfs-audit-ci.yml` that calls `python3 tools/lfs-audit/lfs_audit.py --all --output evidence/lfs-audit.json` on a weekly Monday 09:00 PDT cron. On CRITICAL finding (large binary not in LFS), file an issue.

Ref: `tools/lfs-audit/lfs_audit.py` (exists from v27 T5)
