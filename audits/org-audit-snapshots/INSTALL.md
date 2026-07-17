# Heavy-runner cron — Install guide

**Target host:** Phenotype heavy-runner (a Linux box; **not** the MacBook).
**Target user:** `kooshapari` (sudo not required for the install itself).
**Reference:** ADR-044 § "Migration sequence" — T27.1 (heavy-runner install) + T27.2 (GitHub Actions backup) + T27.3 (AGENTS.md Wave Plan v9 update).

This is the one-time install. Total wall-clock: ~15 min. The cron itself runs 3 weekly jobs (pheno-predict, pheno-drift-detector, pheno-framework-lint); the GitHub Actions backup fires when the heavy-runner is down.

---

## 0. Pre-flight

Verify the host meets the 4 requirements before doing anything else:

```bash
# (a) Linux (not macOS, not WSL — full VM / bare-metal preferred)
uname -s   # expect: Linux

# (b) flock available (Debian/Ubuntu: util-linux; RHEL/Fedora: util-linux)
command -v flock && flock --version | head -1
#   if missing:
#     Debian/Ubuntu: sudo apt-get update && sudo apt-get install -y util-linux
#     RHEL/Fedora:   sudo dnf install -y util-linux
#     Alpine:        sudo apk add util-linux

# (c) Python 3.8 or newer
python3 --version   # expect: Python 3.8+ (3.10+ recommended)

# (d) gh authenticated as KooshaPari
gh auth status
#   expect: "Logged in to github.com account KooshaPari (...)"
#   if not: gh auth login
```

If any check fails, stop and remediate. The cron relies on all 4.

---

## 1. Clone the monorepo

```bash
mkdir -p ~/CodeProjects/Phenotype
cd ~/CodeProjects/Phenotype
git clone git@github.com:KooshaPari/phenotype-org-audits.git repos
cd repos
# Verify the 3 CLI tools are present (this is the canonical monorepo path):
test -x pheno-predict/pheno_predict.py       && echo "OK pheno-predict"
test -x pheno-drift-detector/pheno_drift_detector.py && echo "OK pheno-drift-detector"
test -x pheno-framework-lint/pheno_framework_lint.py && echo "OK pheno-framework-lint"
```

If the path differs from `~/CodeProjects/Phenotype/repos`, export it before continuing — the cron wrappers use the repo-relative path:

```bash
export REPOS_ROOT="$(pwd)"
echo "REPOS_ROOT=$REPOS_ROOT"   # remember this; Step 4 uses it
```

---

## 2. Configure environment variables

The cron uses one secret: the Slack fleet webhook. **Never commit the value to git.**

```bash
# Generate / look up the webhook in Slack admin:
#   Slack → Apps → Incoming Webhooks → Add to #phenotype-fleet
# Copy the URL (starts with https://hooks.slack.com/services/...)

# Persist in a root-readable file (mode 0600):
sudo tee /etc/phenotype-fleet.env > /dev/null <<'EOF'
SLACK_FLEET_WEBHOOK=https://hooks.slack.com/services/T000/B000/XXX
EOF
sudo chmod 0600 /etc/phenotype-fleet.env

# Add a sourcing hook to the user shell rc so `crontab` (which has a minimal env)
# picks it up via the wrapper:
echo 'source /etc/phenotype-fleet.env 2>/dev/null || true' >> ~/.bashrc
echo 'source /etc/phenotype-fleet.env 2>/dev/null || true' >> ~/.zshrc 2>/dev/null || true
```

Rotation policy: see `secret-rotation.md` in this directory (quarterly, with audit log).

---

## 3. Smoke-test the wrappers

Before installing the crontab, prove the wrappers work end-to-end. Each wrapper must be runnable from any cwd; the wrappers `cd` into `$REPOS_ROOT` internally.

```bash
cd ~/CodeProjects/Phenotype/repos

# (a) pheno-predict — scan monorepo against itself (should yield 0 or very few candidates)
bash ops/heavy-runner-cron/bin/run-with-flock.sh pheno-predict \
  python3 pheno-predict/pheno_predict.py scan \
  --target . --baseline . --threshold 0.55 \
  --format md --out /tmp/predict-test.md
cat /tmp/predict-test.md   # expect: header + maybe some rows

# (b) pheno-drift-detector — scan for app-substrate drift
bash ops/heavy-runner-cron/bin/run-with-flock.sh pheno-drift-detector \
  python3 pheno-drift-detector/pheno_drift_detector.py scan \
  --root . --format md --out /tmp/drift-test.md
cat /tmp/drift-test.md     # expect: header + maybe some hits

# (c) pheno-framework-lint — lint fleet for tier violations
bash ops/heavy-runner-cron/bin/run-with-flock.sh pheno-framework-lint \
  python3 pheno-framework-lint/pheno_framework_lint.py check-all \
  --root . --format md --out /tmp/lint-test.md
cat /tmp/lint-test.md      # expect: header + maybe some violations
```

If any wrapper fails with `flock: command not found` → go back to Pre-flight (b).
If any fails with `SLACK_FLEET_WEBHOOK is not set` → go back to Step 2.
If any fails with `ModuleNotFoundError` or `No such file or directory` for the .py file → re-check REPOS_ROOT in Step 1.

---

## 4. Install the crontab

The install script refuses to run on a MacBook (per ADR-023 `device:macbook` rule). It is idempotent — running it twice does not duplicate entries.

```bash
cd ~/CodeProjects/Phenotype/repos
bash ops/heavy-runner-cron/install-cron.sh
# expect: "installed 3 crontab lines" + log path

# A dry-run variant is available for pre-flight:
bash ops/heavy-runner-cron/install-cron.sh --dry-run
# expect: would-install listing, NO actual crontab change
```

A refusal on a MacBook is **expected and correct**:

```
$ bash ops/heavy-runner-cron/install-cron.sh --dry-run
refusing to install cron on hostname='MacBookPro' (MacBook is device:macbook, ADR-023)
```

The log is at `~/.cron-install.log` (last 200 lines rotated).

---

## 5. Verify the cron is in place

```bash
crontab -l | grep -A0 fleet-substrate-tools
# expect: 3 lines, each ending in `run-with-flock.sh <tool> python3 ...`
```

Reference: `ops/heavy-runner-cron/cron.d/fleet-substrate-tools` (the source-of-truth file shipped in the monorepo; the install script copies these 3 lines into your user crontab with `$REPOS_ROOT` expanded).

---

## 6. First-run dry-run mockup

A dry-run script writes mock outputs to `/tmp/dry-run-*.md` so you can preview the cron output without waiting a week. It is also MacBook-guarded (it will refuse if `hostname` contains `mac`).

```bash
cd ~/CodeProjects/Phenotype/repos
bash ops/heavy-runner-cron/dry-run.sh
# expect: 3 files at /tmp/dry-run-{predict,drift,lint}-<date>.md

# Also see ops/heavy-runner-cron/FIRST_RUN_MOCKUP.md for the expected
# shape of the first real run on Mon 2026-06-23 09:00 PDT.
```

---

## 7. Troubleshooting

| Symptom                                              | Cause                                              | Fix                                                                              |
| :--------------------------------------------------- | :------------------------------------------------- | :------------------------------------------------------------------------------- |
| `flock: command not found`                          | `util-linux` not installed                         | `apt install util-linux` / `dnf install util-linux`                             |
| Cron line in `crontab -l` but no log files appear    | `SLACK_FLEET_WEBHOOK` missing → wrapper exits 1 → silent failure | `sudo cat /etc/phenotype-fleet.env`; re-source from `~/.bashrc`               |
| `cron: can't open display: ...` or auth errors       | `gh` not authenticated                            | `gh auth login` (re-auth as KooshaPari)                                          |
| `python3: can't open file 'pheno-predict/...'`       | `$REPOS_ROOT` wrong / not in cron env              | Hard-code the absolute path in `crontab` (the install script already does this)  |
| Cron runs but exits 2 every week                     | Tool found candidates/hits (this is normal)        | Read `~/.fleet-cron/<tool>-<date>.log`; auto-filed GitHub issue should be in `phenotype-org-audits` |
| `install-cron.sh` exits 2 (refuses)                  | Hostname is MacBook or contains `mac`              | **This is correct** — cron is for `device:heavy-runner` only (ADR-023)          |
| Output file is empty / only header                   | No candidates/hits above threshold — clean run     | Expected; this is success                                                       |
| Cron runs but `findings/*.md` never shows up         | Wrong `$REPOS_ROOT` / wrong `--out` path           | Check `~/.fleet-cron/<tool>-<date>.log`; the path is `$REPOS_ROOT/findings/`    |

For monitoring cron output over time, see `MONITORING.md` in this directory.
For Slack webhook rotation, see `secret-rotation.md` in this directory.
For ADR / decision log, see `docs/adr/2026-06-18/ADR-044-cron-deployment.md`.
