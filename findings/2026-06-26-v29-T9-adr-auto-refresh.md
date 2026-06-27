# v29-T9 — L38.1 ADR Auto-Refresh Adoption (P1→3.0)

## What
Run `tools/adr-index-check/regen.py` weekly to regenerate ADR INDEX.md.

## Action
Add `.github/workflows/adr-index-ci.yml` that calls `python3 tools/adr-index-check/regen.py --write --commit` on a weekly Monday 09:00 PDT cron. If INDEX.md changes, open a PR.

Ref: `tools/adr-index-check/regen.py` (exists from v28 T4)
