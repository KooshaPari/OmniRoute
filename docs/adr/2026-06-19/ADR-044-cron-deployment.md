# ADR-044: 3-tool heavy-runner cron deployment (pheno-predict + pheno-framework-lint + pheno-drift-detector)

**Date:** 2026-06-19
**Status:** PROPOSED
**Authors:** orchestrator + forge subagent (L5-110/111/112/113 audit wave)
**Refs:**
- `ops/heavy-runner-cron/INSTALL.md:5, 7, 47-49, 100-104, 178, 185` (the operational deployment doc this ADR formalizes)
- `ops/heavy-runner-cron/FIRST_RUN_MOCKUP.md` (planned first-run output for 2026-06-23 09:00 PDT)
- `ops/heavy-runner-cron/MONITORING.md:14-19, 50-54, 64-71, 84-92, 110` (cron monitoring)
- ADR-041 (Predictive discipline — L72; `pheno-predict`)
- ADR-042 (Graduation discipline — L73; `pheno-framework-lint`)
- ADR-043 (Drift-detection discipline — L74; `pheno-drift-detector`)
- ADR-023 (substrate placement policy — MacBook-guarded `device:macbook` rule)
- ADR-027 (Git LFS 3-tier policy — LFS Tier 1 for any drift output > 100 MB; not expected for v1.1)
- `findings/2026-06-18-L5-110-pheno-framework-lint-absorption-audit.md` §6, §8, §9
- `findings/2026-06-18-L5-111-pheno-drift-detector-absorption-audit.md` §6, §8, §9
- `findings/2026-06-18-L5-112-pheno-predict-absorption-audit.md` §6, §8, §9
- `phenotype-org-audits` (target GitHub repo for the cron output)

> **Note:** No v1.0 ADR-044 exists; this is the **first** ADR at the 044 number in the v1.1 wave. The v1.0 ADRs stop at 046 (federation-mtls-oidc); 044 was skipped. This ADR claims the 044 number for the v1.1 cron deployment, mirroring the v1.0/v1.1 number-collision pattern for ADR-041/042/043.

---

## Context

ADR-041, ADR-042, and ADR-043 each define one of the three v1.1 PAX pillars (L72, L73, L74 respectively). All three pillars share a **common operational substrate**: a weekly Monday 09:00 PDT cron that runs each tool against the fleet, files issues to `KooshaPari/phenotype-org-audits`, and posts a Slack notification to `#phenotype-fleet`. The operational details (install steps, MacBook-guarded install, flock-protected wrappers, Slack webhook, dry-run script) are documented in `ops/heavy-runner-cron/INSTALL.md` (185 lines) but **have no formal ADR** — `INSTALL.md:185` explicitly references the missing `ADR-044 § "Migration sequence"`.

The 3-tool cron bundle is scheduled for **first run on Monday 2026-06-23 09:00 PDT** (5 days from this ADR), per `ops/heavy-runner-cron/FIRST_RUN_MOCKUP.md:165`. The cron scripts (`bin/run-with-flock.sh`, `install-cron.sh`, `dry-run.sh`, `cron.d/fleet-substrate-tools`) are documented but not yet on disk; L5-111 §8.1 P0 gap #2 flags this as blocking the 2026-06-23 first run. The 5 patches (P1-P5) in each of L5-110/111/112 §9 are the parallel prerequisite for the 3 tool repos to reach ADR-023 Rule 3.1 substrate quality.

**Why the 3 tools are bundled into a single cron.** Each tool is a separate Python stdlib-only script, but they share (a) the same input contract (a `--root` directory containing the monorepo), (b) the same output destination (`KooshaPari/phenotype-org-audits` issues labelled per tool), (c) the same MacBook-guarded `device:heavy-runner` install policy per ADR-023, and (d) the same 5-minute `flock` window (to prevent overlapping runs). Bundling them into 1 cron entry with 3 sequential commands (vs 3 separate cron entries) keeps the install/uninstall/dry-run/monitoring story simple and aligns with the 3-tool trio in L5-110 §6 G6.

**Why Monday 09:00 PDT.** Aligns with the 71-pillar weekly refresh (per `findings/71-pillar-2026-06-19.md:7`); the cron output is the v1.1 scorecard's L72/L73/L74 input. Avoids weekend windows (when fleet contributors are less likely to triage issues). 09:00 PDT = 16:00 UTC (cron entry uses UTC). Owner: orchestrator + 1 forge subagent in support (per L5-111 §10.1 budget).

## Decision

**The 3-tool heavy-runner cron runs weekly Monday 09:00 PDT (16:00 UTC) on `KooshaPari/phenotype-org-audits` GitHub Actions via `self-hosted` runner with `macos` and `tailscale` labels. The cron entry invokes `ops/heavy-runner-cron/cron.d/fleet-substrate-tools` (3 lines: 1 per tool) and posts a Slack notification to `#phenotype-fleet` via webhook. The 3 GitHub issue labels (`predictive-dry`, `framework-lint`, `drift-detector`) must exist in `phenotype-org-audits` before the first run.**

### Cron schedule

```cron
# /etc/cron.d/fleet-substrate-tools (or user crontab via install-cron.sh)
# pheno-predict (L72) — Predictive discipline (ADR-041)
0 16 * * 1 cd /Users/kooshapari/CodeProjects/Phenotype/repos && bash ops/heavy-runner-cron/bin/run-with-flock.sh pheno-predict python3 pheno-predict/pheno_predict.py scan --target . --baseline ./.git --threshold 0.55 --format md --out /tmp/predict-$(date +\%Y\%m\%d).md >> /var/log/fleet-substrate-tools.log 2>&1

# pheno-framework-lint (L73) — Graduation discipline (ADR-042)
5 16 * * 1 cd /Users/kooshapari/CodeProjects/Phenotype/repos && bash ops/heavy-runner-cron/bin/run-with-flock.sh pheno-framework-lint python3 pheno-framework-lint/pheno_framework_lint.py check-all --root . --format md --out /tmp/lint-$(date +\%Y\%m\%d).md >> /var/log/fleet-substrate-tools.log 2>&1

# pheno-drift-detector (L74) — Drift-detection discipline (ADR-043)
10 16 * * 1 cd /Users/kooshapari/CodeProjects/Phenotype/repos && bash ops/heavy-runner-cron/bin/run-with-flock.sh pheno-drift-detector python3 pheno-drift-detector/pheno_drift_detector.py scan --root . --format gh-issues --out /tmp/drift-$(date +\%Y\%m\%d).md >> /var/log/fleet-substrate-tools.log 2>&1
```

**Note:** The 5-minute stagger (0/5/10 minutes past 16:00 UTC) prevents the 3 tools from contending for the same `flock` lock. Each tool gets its own `flock` key (`/var/lock/fleet-substrate-tools-<tool>.lock`) per `ops/heavy-runner-cron/bin/run-with-flock.sh`.

### Input / output contract

| Tool | Pillar | ADR | Input | Output | Cron output filename | GitHub label |
|---|---|---|---|---|---|---|
| `pheno-predict` | L72 | ADR-041 | `--target . --baseline ./.git --threshold 0.55` | `--format md` | `/tmp/predict-<YYYYMMDD>.md` | `predictive-dry` |
| `pheno-framework-lint` | L73 | ADR-042 | `--root .` | `--format md` | `/tmp/lint-<YYYYMMDD>.md` | `framework-lint` |
| `pheno-drift-detector` | L74 | ADR-043 | `--root .` | `--format gh-issues` | `/tmp/drift-<YYYYMMDD>.md` | `drift-detector` |

The cron post-processor (a wrapper script, not yet on disk; L5-111 §8.1 P0 gap #2) reads the 3 markdown files and uses `gh issue create --label <label> --body-file <file>` to file one issue per tool per week in `KooshaPari/phenotype-org-audits`. The post-processor is idempotent (a date-stamped marker file prevents duplicate issues for the same week).

### GitHub label mechanism (L5-111 §8.1 P0 gap #3)

Before the first run, the 3 labels must exist in `KooshaPari/phenotype-org-audits`:

```bash
gh label create predictive-dry --color FBCA04 --description "Pheno-predict L72 candidate pairs (ADR-041); weekly Monday 09:00 PDT cron" --repo KooshaPari/phenotype-org-audits
gh label create framework-lint --color D93F0B --description "Pheno-framework-lint L73 tier violations (ADR-042); weekly Monday 09:00 PDT cron" --repo KooshaPari/phenotype-org-audits
gh label create drift-detector --color 5319E7 --description "Pheno-drift-detector L74 PAUSED/CONDITIONAL/CAPSTONE capability-extraction hits (ADR-043); weekly Monday 09:00 PDT cron" --repo KooshaPari/phenotype-org-audits
```

### Monitoring + alerts

Per `ops/heavy-runner-cron/MONITORING.md`, the cron emits 3 log streams:

1. **Per-tool cron log** — `/var/log/fleet-substrate-tools.log` (single file, all 3 tools append; one section per tool per day).
2. **Per-tool dry-run output** — `/tmp/dry-run-{predict,drift,lint}-<date>.md` (preview; MacBook-guarded).
3. **Per-tool GitHub issues** — `KooshaPari/phenotype-org-audits` issues with the 3 labels (one issue per tool per week; idempotent via date-stamped marker file).

**Alerts:**
- **Cron fails to trigger** — `ops/heavy-runner-cron/MONITORING.md:50-54` checks for `fleet-substrate-tools` in `crontab -l` and Slack-notifies if missing. Mitigation: `workflow_dispatch` is the manual fallback.
- **Tool not installed** — flock key release + Slack notification; orchestrator triages within 1 business day.
- **Cron output > 100 MB** — LFS Tier 1 per ADR-027; `git config lfs.allowincompletepush=true` is the Tier 2 strategy for sub-100 MB LFS objects. Expected: not a v1.1 concern (the 3 tools produce < 1 MB markdown output per run).
- **GitHub API rate limit** — `pheno-drift-detector.py:323-375` implements retry-with-backoff; cron will not duplicate-issue.

### Rollout plan

| Phase | Date | Action |
|:---|:---|:---|
| Phase 0 | 2026-06-19 | ADR-044 PROPOSED (this file); ADRs 041/042/043 PROPOSED (sister files) |
| Phase 1 | 2026-06-20 | L5-110/111/112 P1-P5 patches land on the 3 tool repos (15 files × ~30 min each); 3 GitHub labels created in `phenotype-org-audits`; 4 cron scripts written (`bin/run-with-flock.sh`, `install-cron.sh`, `dry-run.sh`, `cron.d/fleet-substrate-tools`) |
| Phase 2 | 2026-06-22 (Sun) | `install-cron.sh --dry-run` on heavy-runner; verify all 3 entries appear in `crontab -l` (no actual install on MacBook-guarded) |
| Phase 3 | **2026-06-23 (Mon 09:00 PDT)** | First scheduled cron run; expect 0-3 predictive-dry issues, 5-15 framework-lint issues, 3-5 drift-detector issues; Slack notification to `#phenotype-fleet` |
| Phase 4 | 2026-06-30 (Mon) | Second run; reconcile with v1.1 scorecard L72/L73/L74 scores; file remediation PRs as needed |
| Phase 5 | 2026-07-21 (5 weeks) | Re-evaluate ADR-044; if v1.1 framework is not cut over, switch to PROPOSED → DEPRECATED |

## Consequences

**Positive:**
- The 3 PAX pillars (L72/L73/L74) now have a **canonical operational substrate**. The weekly Monday cron re-scores all 20 repos and re-emits the v1.1 scorecard inputs.
- Bundling the 3 tools into a single cron entry simplifies the install/uninstall/dry-run/monitoring story (1 set of 4 scripts vs 12 scripts).
- MacBook-guarded install (`device:heavy-runner` per ADR-023) prevents the cron from accidentally installing on a MacBook (the install script refuses if `hostname` contains `mac`).
- The 5-minute stagger + per-tool `flock` keys prevent overlapping runs and idempotent issue filing.
- The cron output is the v1.1 scorecard's L72/L73/L74 input; the scorecard is reproducible across weeks.

**Negative:**
- 4 cron scripts must be authored before Phase 2 (L5-111 §8.1 P0 gap #2). ~75 min wall-clock.
- 3 GitHub labels must exist before Phase 3 (L5-111 §8.1 P0 gap #3). ~5 min wall-clock via `gh label create`.
- 5 L5-110/111/112 patches × 3 tool repos must land before Phase 1 (L5-111 §8.1 P0 gap #1). ~5-7 hours wall-clock with 3 forge subagents in parallel.
- The 3 `findings/2026-06-18-L8-010..012-*.md` decision logs (claimed in each tool's commit message) must be authored in parallel (L5-111 §8.1 P0 gap #4). ~30 min wall-clock.
- The cron is **single-region** (heavy-runner only); fleet-wide orchestration requires a future ADR for multi-runner coverage.
- `device:heavy-runner` policy means the MacBook is excluded from running the cron; contributors dogfooding the 3 tools must run them manually via `dry-run.sh`.

## Cross-references

- ADR-041 (Predictive discipline — L72; the pheno-predict tool that this cron runs)
- ADR-042 (Graduation discipline — L73; the pheno-framework-lint tool that this cron runs)
- ADR-043 (Drift-detection discipline — L74; the pheno-drift-detector tool that this cron runs)
- ADR-023 (substrate placement policy — `device:macbook` / `device:heavy-runner` rule)
- ADR-024 (71-pillar v1.0 framework; the v1.1 scorecard this cron feeds)
- ADR-027 (Git LFS 3-tier policy; LFS Tier 1 for drift output > 100 MB; not expected for v1.1)
- `ops/heavy-runner-cron/INSTALL.md:5, 7, 47-49, 100-104, 178, 185` (the operational doc this ADR formalizes; references this ADR at line 185)
- `ops/heavy-runner-cron/FIRST_RUN_MOCKUP.md` (planned first-run output for 2026-06-23 09:00 PDT)
- `ops/heavy-runner-cron/MONITORING.md:14-19, 50-54, 64-71, 84-92, 110` (cron monitoring)
- `findings/2026-06-18-L5-110-pheno-framework-lint-absorption-audit.md` §6 G6 (no umbrella for the L72/L73/L74 trio; this cron is the umbrella)
- `findings/2026-06-18-L5-111-pheno-drift-detector-absorption-audit.md` §6.4 (phenotype-org-audits as DOCUMENTED-DEPENDENT consumer), §8.1 (P0 gaps blocking 2026-06-23 first run), §10.1 (P0 action plan)
- `findings/2026-06-18-L5-112-pheno-predict-absorption-audit.md` §6, §9
- `KooshaPari/phenotype-org-audits` (target GitHub repo for cron output)
