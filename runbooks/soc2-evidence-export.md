# SOC2 Evidence Export Runbook

**Audience:** compliance officers, SOC2 auditors, retention officers
**Pillar:** L54 (SOC2 evidence export pipeline)
**Cadence:** weekly Monday 10:00 PDT (after evidence collection cron at 09:00)

## Quick start

```bash
# 1. Collect raw evidence
python3 scripts/soc2-evidence-collector.py --all \
  --output evidence/$(date +%F)-fleet.json

# 2. Build export bundle
python3 tools/soc2-evidence-export/export.py \
  --input evidence/$(date +%F)-fleet.json \
  --output-dir exports/$(date +%F)

# 3. Inspect the bundle
ls -la exports/$(date +%F)/
cat exports/$(date +%F)/manifest.json | python3 -m json.tool
```

## Bundle contents

Each export directory contains:

| File | Purpose |
|---|---|
| `manifest.json` | Summary of bundle (counts, sizes, sha256) |
| `evidence.json` | Full evidence dump (input JSON, normalized) |
| `controls.csv` | Per-control coverage matrix (CSV, Excel-friendly) |
| `controls.json` | Per-control satisfaction matrix (JSON) |
| `compliance-report.md` | Human-readable compliance summary |
| `repos/<repo>.json` | Per-repo evidence bundle (one per fleet repo) |
| `repos/<repo>.txt` | Per-repo summary (artifacts only, no JSON) |
| `gaps.json` | List of (repo, control) pairs with `satisfied: false` |

## Compliance report sections

```markdown
# SOC2 Evidence Bundle — 2026-06-22

Framework: SOC2-Type-II-2017  
Generated at: 2026-06-22T17:00:00+00:00  
Source evidence: evidence/2026-06-22-fleet.json  
Bundle sha256: a1b2c3d4e5f6...

## Bundle contents

| File | Size | sha256_12 |
|---|---|---|
| evidence.json | 256 KB | a1b2c3d4e5f6 |
| controls.csv | 8 KB | b2c3d4e5f6a7 |
| ... | ... | ... |

## Coverage summary

- Repos: 119
- Controls: 18
- Total checks: 2142
- Satisfied: 1867 (87.1%)
- Unsatisfied: 275 (12.9%)

## Coverage matrix (per repo x control)

| Repo | CC1.1 | CC1.4 | CC2.1 | ... |
|---|---|---|---|---|
| HeliosLab | Y | Y | Y | ... |
| PhenoCompose | Y | Y | Y | ... |
| AgilePlus | Y | Y | . | ... |
| ... | ... | ... | ... | ... |

## Gaps

- (repo, control) pairs that are unsatisfied.
- Sorted by repo name for stable diffs across weeks.
```

## Retention policy

The bundle is **retained for 7 years** (2555 days) via the GitHub Actions
artifact retention setting, per SOC2-Type-II evidence retention requirements.

For long-term retention beyond 2555 days:

```bash
# Push to S3 with Object Lock (COMPLIANCE mode)
aws s3 cp exports/2026-06-22/ \
  s3://phenotype-soc2-evidence/2026/2026-06-22/ \
  --recursive \
  --object-lock-mode COMPLIANCE \
  --object-lock-retain-until-date 2033-06-22T00:00:00Z

# Or push to Vanta
curl -X POST https://api.vanta.com/v1/controls/evidence \
  -H "Authorization: Bearer $VANTA_TOKEN" \
  -F "file=@exports/2026-06-22/manifest.json"
```

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `evidence.json not found` | weekly cron didn't run; collector hasn't shipped evidence | trigger workflow_dispatch on soc2-evidence workflow |
| sha256 mismatch in manifest | bundle post-processed outside the export tool | always run through `export.py`, never edit bundle by hand |
| `controls.csv` missing | pre-1.0 evidence format | re-run `evidence-collector.py` against current fleet |
| `gaps.json` empty | 100% coverage (rare) | expected; means a clean week |

## Operator escalation

| Severity | Path |
|---|---|
| Bundle coverage < 80% | page on-call; check repo onboarding drift |
| Manifest sha256 mismatch from earlier week | archive integrity compromised; investigate git diff vs prior week |
| Workflow job red >2 consecutive weeks | page on-call; archive last green run to S3 |

Refs: v26 T6, ADR-090 (compliance evidence model), L54 SOC2 evidence export