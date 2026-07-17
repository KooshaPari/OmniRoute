# ops/heavy-runner-cron — fleet substrate tooling weekly cron bundle

**Location:** `KooshaPari/phenotype-org-audits` (staging repo per ADR-028)
**First scheduled run:** 2026-06-23 09:00 PDT
**Schedule:** every Monday 09:00 local time
**Device class:** `heavy-runner` (per `AGENTS.md` ADR-023 device-fit gate)
**Owner:** worklog-schema circle (Wave 1 Agent B of L5-110..L5-113)

## Purpose

Run the three weekly governance scanners that watch the fleet substrate for
violations, then file GitHub issues for the hits. One bundle, one cron entry,
one lock — so a slow run never overlaps the next run, and one place to look
when something breaks.

## The three tools

| # | Tool | What it scans | Output | ADR |
|---|---|---|---|---|
| 1 | `pheno-predict` | fleet-wide token-shingle Jaccard similarity | markdown report | ADR-041 (audit cadence) |
| 2 | `pheno-framework-lint` | tier-convention violations in `pheno-*-lib` / `phenotype-*-sdk` / `phenotype-*-framework` | JSON report | ADR-042 (security cadence) |
| 3 | `pheno-drift-detector` | PAUSED / CONDITIONAL / CAPSTONE app repos with 2+ extractable capabilities | markdown report | ADR-023 Rule 3 (app substrate placement) |

All three are stdlib-only Python; the cron bundle does not install Python
packages. Each tool is expected to be `chmod +x`'d and on `$PATH` as
`pheno-predict`, `pheno-framework-lint`, `pheno-drift-detector`. See
`INSTALL.md` for the per-tool install instructions.

## Schedule and execution

The cron entry lives at `cron.d/fleet-substrate-tools` and is installed by
`bin/install-cron.sh`. The entry fires `bin/run-with-flock.sh`, which:

1. acquires an advisory lock at `${HEAVY_RUNNER_LOCK_PATH:-/var/lock/fleet-substrate-tools.lock}`
   (falls back to `<bundle>/.fleet-substrate-tools.lock` if `/var/lock` is
   not writable);
2. invokes the three tools in sequence (predict → framework-lint → drift-detector);
3. tees each tool's output to `logs/<UTCdate>.<tool>.out`;
4. exits 0 if all three succeeded, 1 otherwise. A non-zero exit causes
   cron to email the user (or whoever `MAILTO` points to).

If a run is still in progress when the next tick fires, the second run
exits immediately with rc=1 ("another run is in progress") rather than
queueing — the next tick can retry.

## I/O contract

| Stream | Path | Format | Retention |
|---|---|---|---|
| Per-run summary | `logs/<UTCdate>.log` | text | 30 days (operator's responsibility; we do not auto-purge) |
| Per-tool stdout | `logs/<UTCdate>.<tool>.out` | tool-native (md or json) | same |
| Cron's own output | `logs/cron.log` | text (cron's stdout/stderr) | same |
| GitHub issues | filed in `KooshaPari/phenotype-org-audits` with label `drift-detector` (and siblings for the other 2 tools) | issue body | n/a (permanent) |

The cron bundle does **not** create GitHub issues. The auto-issue workflow
lives in `phenotype-org-audits/.github/workflows/auto-issue-from-cron.yml`
(a separate work item, out of scope for this PR).

## Who runs it

The heavy-runner — a self-hosted runner host, a dedicated VM, or a
dispatched subagent — runs the cron. The MacBook is **not** a heavy-runner
(per AGENTS.md ADR-023): anything that takes > 10 min wall time on the
MacBook belongs on the heavy runner. The three tools, run on the full
`~/code/phenotype-fleet`, take ~15 min on a beefy self-hosted runner and
~40+ min on a MacBook, so the cron is correctly classified as heavy.

## How to disable

```bash
# Suspend the cron (keep the bundle on disk, stop scheduling it):
bin/install-cron.sh --uninstall

# Re-enable:
bin/install-cron.sh

# Inspect what's currently installed (no changes):
bin/install-cron.sh --verify
```

The uninstall only removes the marker-delimited block from your crontab;
all other crontab entries are preserved. Re-running install is idempotent.

## Files in this bundle

| Path | Role |
|---|---|
| `bin/run-with-flock.sh` | Cron entry point. flock-protected, runs all 3 tools, writes to `logs/`. |
| `bin/install-cron.sh`   | One-shot crontab installer. Idempotent. Subcommands: `--install` (default), `--uninstall`, `--verify`, `--dry-run`. |
| `bin/dry-run.sh`        | Manual exercise of the 3 tools. No flock, no log redirect, prints to stdout. |
| `lib/common.sh`         | Shared logging + error handling, sourced by all 3 bin scripts. |
| `cron.d/fleet-substrate-tools` | The crontab fragment template (with `__BUNDLE_DIR__` placeholder). |
| `README.md`             | This file. |
| `INSTALL.md`            | Step-by-step deployment guide. |
