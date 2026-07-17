# Heavy-runner cron — Monitoring guide

The fleet-substrate cron runs 3 weekly jobs (pheno-predict, pheno-drift-detector,
pheno-framework-lint) on the heavy-runner, with a GitHub Actions backup that
fires when the heavy-runner is unavailable. This document is how to verify
the cron is healthy and what to do when it is not.

---

## What the cron produces (per run)

Each tool writes 2 things per weekly run:

| Tool                  | Wrapper log (per run)                              | Output file (per run)                              |
| :-------------------- | :------------------------------------------------- | :------------------------------------------------- |
| pheno-predict         | `~/.fleet-cron/pheno-predict-<YYYY-MM-DD>.log`     | `findings/predict-candidates-<YYYY-MM-DD>.md`      |
| pheno-drift-detector  | `~/.fleet-cron/pheno-drift-detector-<YYYY-MM-DD>.log` | `findings/drift-hits-<YYYY-MM-DD>.md`           |
| pheno-framework-lint  | `~/.fleet-cron/pheno-framework-lint-<YYYY-MM-DD>.log` | `findings/framework-lint-aggregate-<YYYY-MM-DD>.md` |

The `~/.fleet-cron/` directory is local to the heavy-runner; the
`findings/*.md` files are committed to the monorepo's `main` branch (via the
crontab's `git add` + `git commit` + `git push` step inside each wrapper).

---

## Daily health checks (1-line each)

```bash
# 1. Did all 3 wrappers run in the last 7 days?
find ~/.fleet-cron -name '*.log' -mtime -7 | wc -l   # expect: 3+ (1 per tool per week, sometimes more)

# 2. Is the heavy-runner crontab still installed?
crontab -l | grep -c fleet-substrate-tools            # expect: 3

# 3. Are there any error markers in the last 14 days of logs?
grep -lE 'EXIT=1|Traceback|ERROR' ~/.fleet-cron/*.log 2>/dev/null | head -5

# 4. Did the most recent output get committed?
git -C ~/CodeProjects/Phenotype/repos log --since='7 days ago' --oneline -- findings/predict-candidates-*.md findings/drift-hits-*.md findings/framework-lint-aggregate-*.md | wc -l
# expect: 3+
```

If any of (1), (2), or (4) returns 0, the cron is broken. See "Alerts" below.

---

## Weekly audit (5 min, Mon morning)

```bash
# (a) Output freshness — when was the last file written per tool?
for tool in pheno-predict pheno-drift-detector pheno-framework-lint; do
  echo "=== $tool ==="
  find findings/ -name "${tool##pheno-}*.md" -mtime -8 | sort | tail -1
done

# (b) GitHub Actions backup health (last 5 runs)
gh actions runs list \
  --repo KooshaPari/phenotype-tooling \
  --workflow=fleet-substrate-tools-backup.yml \
  --limit 5 \
  --json status,conclusion,createdAt,headBranch \
  | jq -r '.[] | "\(.createdAt)  \(.conclusion // .status)  \(.headBranch)"'

# (c) Auto-filed GitHub issues from the drift detector (last 4 weeks)
gh issue list \
  --repo KooshaPari/phenotype-org-audits \
  --label drift-detector \
  --state all \
  --limit 20 \
  --json number,title,createdAt,state \
  | jq -r '.[] | "\(.createdAt)  \(.state)  #\(.number)  \(.title)"'
```

---

## What the output looks like (per-tool)

### pheno-predict (`findings/predict-candidates-*.md`)

A markdown table. **Empty header + "No candidates above threshold"** is a
*clean run* (success). Non-empty rows are predictive-DRY candidates the
orchestrator triages in the weekly Wave Plan sweep.

### pheno-drift-detector (`findings/drift-hits-*.md`)

A markdown list. Each hit is a PAUSED/CONDITIONAL app repo with 2+
non-trivial capabilities matching the substrate pattern (per ADR-023
Rule 3). A hit means "consider extracting to a `pheno-*-lib` /
`phenotype-*-sdk` / `phenotype-*-framework` / federated service".

The wrapper also auto-files a `drift-detector` GitHub issue on the
`phenotype-org-audits` repo (one issue per run, with all hits in the body).

### pheno-framework-lint (`findings/framework-lint-aggregate-*.md`)

A markdown table of tier-convention violations. Each row says
`(repo, tier, violation)`. Violations are heuristics — the orchestrator
reviews them in the weekly audit; false positives are expected and
acceptable, false negatives are not.

---

## Alerts

| Symptom                                                | Alert threshold              | Action                                                                          |
| :----------------------------------------------------- | :--------------------------- | :------------------------------------------------------------------------------ |
| No `~/.fleet-cron/*.log` for 7+ days                   | **Critical** (cron is dead)  | Check `crontab -l`; check host is up; check `flock` installed                   |
| No `findings/*-<date>.md` for 7+ days                  | **Critical** (output missing) | Check wrapper logs for `EXIT=1`; check `$REPOS_ROOT`; check `git push` creds    |
| No `phenotype-tooling` Actions runs for 7+ days      | **Warning** (backup is dead) | Check workflow file present; check `KooshaPari/phenotype-tooling` not archived  |
| Drift detector hasn't filed any issues in 4+ weeks     | **Warning** (threshold drift) | Threshold may be too high; review `pheno-drift-detector` `--score-min` default  |
| Output file is empty / only header                    | **Info** (clean run)          | This is success — no candidates / hits / violations above the threshold        |
| Wrapper exits 2 (candidates / hits / violations found) | **Info** (expected)           | Triage the output; auto-filed issue (drift) or weekly review (predict / lint)  |

---

## Log retention

- `~/.fleet-cron/*.log` — keep 90 days (rotate via `logrotate` if needed).
- `findings/predict-candidates-*.md` etc. — keep 12 months in the monorepo
  (older files are archived to `findings/archive/2026-Q<n>/` per the
  registry refresh cadence, ADR-043).

---

## On-call runbook (≤ 5 min)

1. **Cron is dead (no logs for 7+ days):** SSH to heavy-runner; `crontab -l`
   (should show 3 lines); `bash ops/heavy-runner-cron/dry-run.sh` (should
   succeed); `crontab < ops/heavy-runner-cron/cron.d/fleet-substrate-tools`
   to re-install if lines are missing.
2. **Wrapper is failing (logs show `EXIT=1`):** Read the log; fix per the
   INSTALL.md troubleshooting table; re-run the wrapper manually; verify
   the next scheduled run succeeds.
3. **GitHub Actions backup is dead:** Check the workflow file is present
   at `phenotype-tooling/.github/workflows/reusable/python-ci.yml` and sibling reusable workflows;
   check the workflow file is in the default branch; check the schedule
   is not commented out; trigger a manual `workflow_dispatch` to verify
   the secret / permissions / output artifact blocks all work.
4. **Drift detector threshold feels wrong (no issues for 4+ weeks):** Read
   `pheno-drift-detector/pheno_drift_detector.py` for the default
   `--score-min`; lower it by 0.1; file a PR with the new default;
   note in the audit log.
