# CI Cache Hit-Rate Dashboard

**Pillar:** L31 (CI cache statistics & observability)
**Authority:** ADR-040 + v19 71-pillar cycle 9 P0 plan §2 Track T1
**Source workflow:** `.github/workflows/cache-stats.yml`
**Source script:** `scripts/cache_stats_wrapper.sh`

## What this measures

The **CI cache hit-rate** is the fraction of `actions/cache` step executions in a workflow run that report `Cache hit` rather than `Cache miss`. It is computed per workflow run from the run's job logs:

```
hit_rate = (count of "Cache hit" lines) / (count of "Cache hit" + "Cache miss" lines)
```

A run with a hit-rate of `1.0` means every `actions/cache` step restored from cache; a run with `0.0` means every step had to re-download its dependency tree. Hit-rate is the most direct proxy for CI speedup attributable to caching and the most actionable signal when diagnosing a slow CI run.

## Why it matters

GitHub Actions cache usage is reported per-run, but the GitHub UI surfaces only individual runs. There is no fleet-wide view, no trend, no per-repo comparison, and no anomaly detection. Without an aggregated dashboard:

- A cache key rotation (e.g. changing the `Cargo.lock` hash input) silently invalidates caches across the fleet and only manifests as a sudden wave of slow CI runs days later.
- New `actions/cache` keys added to one workflow but not mirrored to its sibling workflows create asymmetric hit-rates that are invisible until someone notices a discrepancy.
- Cache size growth that approaches the 10 GB repo cap (GitHub's hard limit) is invisible until pushes start failing.

The dashboard surfaces all three.

## Dashboard URL pattern

Once deployed by `cache-stats-pages.yml` and GitHub Pages is enabled on the repo (Settings → Pages → Source: GitHub Actions), the dashboard is served at:

```
https://<owner>.github.io/<repo>/cache-stats/
```

For this repo that resolves to:

```
https://kooshapari.github.io/repos/cache-stats/
```

The page renders four artifacts produced by `cache-stats.yml`:

| File | Format | Contents |
|---|---|---|
| `index.html` | static HTML + inline SVG | Interactive trend chart + per-repo table |
| `latest.json` | JSON | Aggregate of the most recent CI run only |
| `fleet.json` | JSON | 7-day rolling fleet rollup + per-repo + per-day breakdown |
| `history.jsonl` | JSONL | Append-only time-series, one record per CI run |

## Data flow

```
[CI workflow run completes]
        |
        v
[.github/workflows/cache-stats.yml]
   workflow_run trigger
        |
        v
[scripts/cache_stats_wrapper.sh]   <-- parses run logs for "Cache hit"/"Cache miss"
        |
        v
[docs/cache-stats/history.jsonl]   <-- append (capped at 5000 records)
   docs/cache-stats/latest.json    <-- overwrite
   docs/cache-stats/fleet.json     <-- overwrite (7-day rollup)
        |
        v
[git push to main]
        |
        v
[.github/workflows/cache-stats-pages.yml]
   workflow_run trigger
        |
        v
[GitHub Pages deployment]
        |
        v
https://kooshapari.github.io/repos/cache-stats/
```

## How to read the chart

- **Top panel** — fleet-wide hit-rate over the last 7 days, with one data point per day. Hover for the per-day run count + hit count + miss count.
- **Middle panel** — per-repo hit-rate for the most recent 7 days, sorted by descending runs. Repos below 0.5 hit-rate are flagged orange (caching regression).
- **Bottom panel** — raw time-series of every individual run, color-coded by hit-rate. Use this to spot the run that triggered a regression.

## Manual refresh

The workflow also runs on `workflow_dispatch`. From the GitHub UI:

1. Actions → cache-stats → Run workflow
2. (Optional) leave inputs blank
3. The next deploy to Pages will refresh the dashboard within ~60 seconds

## Schema

Each row in `history.jsonl` is one JSON object with this shape:

```json
{
  "repo": "kooshapari/repos",
  "run_id": "9876543210",
  "branch": "main",
  "timestamp": "2026-06-21T13:35:42Z",
  "source": "workflow_run",
  "hit_count": 42,
  "miss_count": 7,
  "hit_rate": 0.8571
}
```

Fields:

- `repo` — repository slug (`owner/name`).
- `run_id` — GitHub workflow run ID (use for linking to the run in the UI).
- `branch` — branch that triggered the run.
- `timestamp` — ISO 8601 UTC of when this record was generated.
- `source` — `workflow_run` (post-CI), `schedule` (6-hourly rollup), or `workflow_dispatch` (manual).
- `hit_count` — number of `Cache hit` lines in the run logs.
- `miss_count` — number of `Cache miss` lines.
- `hit_rate` — `hit_count / (hit_count + miss_count)`, 4 decimal places; `0.0000` when no cache steps ran.

## Operational thresholds

The fleet-wide target is **≥ 0.70** sustained hit-rate. Per-repo targets:

- **Substrate repos** (`pheno-*`, `phenotype-*`): target ≥ 0.80 (high cache affinity, rarely invalidated).
- **App-level repos** (`Dino`, `Civis`, etc.): target ≥ 0.60 (cache keys rotate more often due to binary assets).
- **Federated services** (`phenoMCP`, `phenoObservability`): target ≥ 0.50 (mixed-language workspaces invalidate cross-language cache keys).

A drop below the threshold for more than 24 h triggers the cache regression runbook (see `SECURITY.md` § 6 — Incident response, scenario "Cache regression").
