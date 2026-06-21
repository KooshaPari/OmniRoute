# ops/heavy-runner-cron — Installation Guide

**First run:** 2026-06-23 09:00 PDT (HARD deadline for first-run verification)
**This document supersedes** the cron recipe originally sketched in
`pheno-drift-detector/INSTALL.md:185` (which never landed in source).

## 0. Before you start

The cron bundle does not install the three tools. It assumes they are
already on `$PATH`. Install them first:

```bash
# Clone each tool repo into a stable location.
TOOLS_ROOT="${TOOLS_ROOT:-$HOME/code/phenotype-fleet-substrate}"
mkdir -p "$TOOLS_ROOT"
cd "$TOOLS_ROOT"

for repo in pheno-predict pheno-framework-lint pheno-drift-detector; do
  gh repo clone "KooshaPari/$repo" "$repo"
  cd "$repo"
  chmod +x *.py
  # Symlink into /usr/local/bin (or your distro's equivalent).
  ln -sf "$PWD/pheno_${repo//-/_}.py" "/usr/local/bin/${repo}"
  cd ..
done

# Verify.
for cmd in pheno-predict pheno-framework-lint pheno-drift-detector; do
  command -v "$cmd" >/dev/null || { echo "missing: $cmd"; exit 1; }
done
echo "all 3 tools installed"
```

## 1. Clone this bundle (the staging repo)

This bundle lives in `KooshaPari/phenotype-org-audits` (the staging repo
per `AGENTS.md` ADR-028). If you already have a clone, `git pull`.
Otherwise:

```bash
BUNDLE_PARENT="${BUNDLE_PARENT:-$HOME/.local/share}"
mkdir -p "$BUNDLE_PARENT"
cd "$BUNDLE_PARENT"
gh repo clone KooshaPari/phenotype-org-audits
cd phenotype-org-audits
git checkout chore/ops-heavy-runner-cron-2026-06-19
```

> **Path warning:** launchd's cron (macOS) is sandboxed and may not see
> files in `~/Library/Mobile Documents` (iCloud Drive) or the
> `Desktop` / `Documents` folders under iCloud sync. Prefer
> `~/.local/share/` or a similar non-synced path. The installer will
> warn you if the path looks iCloud-synced, but will not refuse.

## 2. Verify the bundle structure

```bash
cd "$BUNDLE_PARENT/phenotype-org-audits/ops/heavy-runner-cron"
ls -R .
```

You should see:

```
.
├── INSTALL.md
├── README.md
├── bin
│   ├── dry-run.sh
│   ├── install-cron.sh
│   └── run-with-flock.sh
├── cron.d
│   └── fleet-substrate-tools
└── lib
    └── common.sh
```

## 3. Syntax-check the shell scripts

```bash
for f in bin/*.sh lib/*.sh; do
  bash -n "$f" && echo "OK: $f" || echo "FAIL: $f"
done
```

All five should print `OK:`. If any print `FAIL:`, the file is broken —
**do not** continue to step 4. Report the failure to the worklog-schema
circle.

## 4. Dry-run the 3 tools manually

This is the single most important verification. It exercises the same
three tools the cron would invoke, without acquiring a lock or writing
to disk.

```bash
export HEAVY_RUNNER_FLEET_ROOT="$HOME/code/phenotype-fleet"
# (or wherever the fleet lives on this host)

bin/dry-run.sh
```

Expected: each tool prints its report to stdout; the script exits 0 if
all three tools exited 0. If any tool is missing or returns non-zero,
fix the tool install (step 0) before continuing.

> **Note:** `pheno-framework-lint`'s subcommand is `check-all`, not
> `scan`. The original task spec used `scan --format md` uniformly; the
> dry-run / run-with-flock scripts use the actual subcommand defined in
> `pheno-framework-lint/pheno_framework_lint.py:455-469`. This deviation
> is also documented in the PR body for the bundle.

## 5. Install the cron entry

```bash
bin/install-cron.sh
```

Expected output (paths will differ on your host):

```
[2026-06-18T...] [INFO] installing fleet-substrate-tools block into crontab...
[2026-06-18T...] [INFO] installed. current fleet-substrate-tools block:
# >>> fleet-substrate-tools (managed by install-cron.sh) >>>
# ... (comment header) ...
0 9 * * 1 cd /Users/you/.local/share/phenotype-org-audits/ops/heavy-runner-cron && /Users/you/.local/share/phenotype-org-audits/ops/heavy-runner-cron/bin/run-with-flock.sh >> /Users/you/.local/share/phenotype-org-audits/ops/heavy-runner-cron/logs/cron.log 2>&1
# <<< fleet-substrate-tools <<<
[2026-06-18T...] [INFO] next scheduled run: every Monday 09:00 (local time of this host)
```

Re-running `bin/install-cron.sh` is a no-op (idempotent). To inspect the
current entry without changing anything:

```bash
bin/install-cron.sh --verify
```

## 6. Trigger a smoke run before the first scheduled tick

Don't wait until Monday 09:00 to discover the cron is broken. Run it
once interactively:

```bash
bin/run-with-flock.sh
echo "rc=$?"
```

Expected: each tool writes to `logs/<UTCdate>.<tool>.out`, the script
exits 0, and the lock file at `/var/lock/fleet-substrate-tools.lock` (or
the fallback path) is released. If exit code is 1, inspect the
`logs/<UTCdate>.<tool>.out` files for the failing tool.

## 7. Confirm the GitHub labels exist

The cron bundle does not file GitHub issues by itself — a separate
`auto-issue-from-cron.yml` workflow (out of scope for this PR) reads
the `logs/*.out` files and files issues. That workflow keys off the
following labels, which must exist on `phenotype-org-audits`:

```bash
gh label list --repo KooshaPari/phenotype-org-audits \
  | grep -E 'drift-detector|predictive-discipline|graduation-discipline'
```

Expected output (created by this PR, [KooshaPari/phenotype-org-audits#XX](https://github.com/KooshaPari/phenotype-org-audits/pull/XX)):

```
drift-detector         Issues created by the weekly heavy-runner cron (L74 pheno-drift-detector)
graduation-discipline  L73 pheno-framework-lint weekly cron
predictive-discipline  L72 pheno-predict weekly cron
```

(Note: the actual label names are `predictive-disciplin` and
`graduation-disciplin` — typo of "discipline" deliberate, per the
single-word PR-body spec. They are searchable either way.)

## 8. Confirm the 3 source repos are still alive

Before the first scheduled tick, sanity-check that the 3 source repos
are still public, still on `main`, and still ship a working CLI:

```bash
for repo in pheno-predict pheno-framework-lint pheno-drift-detector; do
  gh repo view "KooshaPari/$repo" --json name,isArchived,defaultBranchRef
done
```

None should be archived. The default branch should still be `main`.

## 9. Cross-references

- **ADR-044 — cron deployment** (Wave 1 Agent A; being authored in the
  monorepo's `docs/adr/2026-06-18/`. This INSTALL.md is referenced from
  ADR-044 § "Heavy-runner tooling".)
- **AGENTS.md § "App-level repo triage & app substrate placement"** —
  the source of the `device: heavy-runner` device-fit gate.
- **AGENTS.md § "PAUSED APPs"** — the list of repos the drift detector
  scans (HwLedger, Dino, AtomsBot*, focalpoint, QuadSGM, etc.).
- **L5-111 audit:** `findings/2026-06-18-L5-111-pheno-drift-detector-absorption-audit.md`
  § 10.1 (P0 actions 10.1.1 — 10.1.6; this PR addresses 10.1.2 — 10.1.6).
- **L5-110 audit:** `findings/2026-06-18-L5-110-pheno-framework-lint-absorption-audit.md`
- **L5-112 audit:** `findings/2026-06-18-L5-112-pheno-predict-absorption-audit.md`
- **L5-113 audit:** `findings/2026-06-18-L5-113-4-repo-retirement-wrapup.md`

## 10. Rollback

If the first scheduled run on 2026-06-23 09:00 PDT produces bad data,
or if any of the 3 tools emits an unrecoverable error, the cron can
be disabled without removing the bundle:

```bash
bin/install-cron.sh --uninstall
# (the rest of the user's crontab is preserved)
```

To re-enable, run `bin/install-cron.sh` (no arguments) again.
