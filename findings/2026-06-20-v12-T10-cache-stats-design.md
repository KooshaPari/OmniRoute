# v12 T10 — L31 CI Cache Stats Design

**Date:** 2026-06-20
**Pillar:** L31 (Build System — CI cache effectiveness)
**Wave:** v12 71-pillar P0 remediation

## Metric

`hit_rate = cache_hits / (cache_hits + cache_misses)`

Computed from `Cache hit` / `Cache miss` lines in GitHub Actions logs for the
`actions/cache` step across all workflows. Aggregated per-workflow, per-repo,
and fleet-wide over a rolling 7-day window.

## Target

**`hit_rate >= 0.70`**

Below target triggers a remediation PR (key normalization, scope widening,
or cache-key version bump).

## Schema (output JSON)

```json
{
  "repo": "phenotype-apps",
  "workflow": "ci.yml",
  "hit_count": 47,
  "miss_count": 12,
  "hit_rate": 0.797,
  "last_7d_avg_hit_rate": 0.74,
  "sample_window": "2026-06-13..2026-06-20"
}
```

## Action when below target

1. Inspect `actions/cache` step `key` — is it versioned (`v1-${{ hashFiles(...) }}`)?
2. If yes: widen `path` to include more derived artifacts (target/, dist/, .next/).
3. If no: add a version segment to the key to bust on lockfile changes only.
4. Re-run; if hit_rate < 0.70 for 3 consecutive days, open an ADR proposing a
   fleet-wide `pheno-ci-templates` cache helper.

## Sample dashboard (text)

```
phenotype-apps  ci.yml    0.797  (47/59)   PASS
phenotype-apps  deny.yml  0.625  (15/24)   WARN
pheno-errors    ci.yml    0.812  (39/48)   PASS
pheno-flags     ci.yml    0.943  (33/35)   PASS
pheno-tracing   ci.yml    0.500  (10/20)   FAIL  <-- action
─────────────────────────────────────────
FLEET                              0.735   PASS
```

## Files

- `scripts/cache_stats_wrapper.sh` — bash script, jq-only, no heavy deps
- `.github/workflows/cache-stats.yml` — workflow_run trigger, posts summary
- `.github/cache-stats/<run-id>.json` — per-run artifact
- `just cache-stats` — runs the wrapper on the last CI run

## Migration cost

Zero. jq + bash are pre-installed on all `ubuntu-latest` runners. No new
secrets. No new service deps.
