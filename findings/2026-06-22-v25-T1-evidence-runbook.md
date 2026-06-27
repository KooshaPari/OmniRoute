# v25-T1 Evidence Collection Runbook

**Audience:** compliance officers, SRE on-call, fleet auditors
**Pillar:** L51 (SOC2 evidence automation)
**Cadence:** weekly Monday 09:00 PDT cron + on every main merge

## Quick start

```bash
# Run the collector against the whole fleet
python3 scripts/soc2-evidence-collector.py --all \
  --output evidence/$(date +%F)-fleet.json

# Get a human-readable summary table
python3 scripts/soc2-evidence-collector.py --all --summary \
  > evidence/$(date +%F)-summary.md

# Single repo deep-dive
python3 scripts/soc2-evidence-collector.py --all \
  --repo HeliosLab --output evidence/HeliosLab.json

# Single control audit (e.g. for a compliance query)
python3 scripts/soc2-evidence-collector.py --control CC6.1 \
  --output evidence/CC6.1-audit.json
```

## Output schema

```json
{
  "schema_version": "1.0",
  "framework": "SOC2-Type-II-2017",
  "generated_at": "2026-06-22T04:35:17+00:00",
  "controls": [{"id": "CC6.1", "name": "Pre-commit hooks"}, ...],
  "fleet": [
    {
      "repo": "HeliosLab",
      "controls": [
        {
          "control_id": "CC6.1",
          "satisfied": true,
          "artifact": ".pre-commit-config.yaml",
          "artifact_sha256_12": "a1b2c3d4e5f6",
          "git_head": "abc1234 docs: add audit hook",
          "git_branch": "main",
          "collected_at": "2026-06-22T04:35:17+00:00"
        }
      ]
    }
  ]
}
```

## Adding a new control

1. Add an entry to the `CONTROLS` dict in `scripts/soc2-evidence-collector.py`:

   ```python
   "CC2.4": {
       "name": "Background check policy",
       "check": lambda r: (r / "docs" / "hr" / "background-checks.md").exists(),
   },
   ```

2. Re-run collector; verify new control appears in output.

3. Update `findings/2026-06-22-v25-T1-soc2-evidence-collector.md` control list.

## Vanta / Drata integration

The JSON output is the **canonical audit feed**:

1. **Vanta**: Settings → Integrations → Custom → point at
   `evidence/$(date +%F)-fleet.json` (or webhook from CI artifact)
2. **Drata**: Connectors → Custom → upload JSON via API:
   ```bash
   curl -X POST https://api.drata.com/v1/controls/evidence \
     -H "Authorization: Bearer $DRATA_TOKEN" \
     -d @evidence/$(date +%F)-fleet.json
   ```
3. **Vanta alternative**: push to S3, point Vanta at the S3 prefix

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `no-git` on most rows | repo root not a git submodule | expected for non-tracked dirs; ignore |
| 0% coverage on a repo | missing AGENTS.md + justfile | onboard via ADR-023 substrate governance |
| sha256 mismatch across days | expected (artifact evolves); not a fault | ignore unless control was unsatisfied |
| Workflow fails on cron | usually OOM from full fleet scan | add `--repo-limit 30` slicing |

## Operator escalation

| Severity | Path |
|---|---|
| Repo missing >3 controls | file issue with repo, ping owner via CODEOWNERS |
| sha256 drift on a CRITICAL control (CC6.x, CC7.x) | file change detected, review git log |
| Workflow job red >2 consecutive runs | page on-call, archive last green run |

Refs: v25 T1, ADR-090, L51 SOC2 evidence automation
