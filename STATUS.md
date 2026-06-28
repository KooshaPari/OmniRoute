# Monorepo — Current State

> **Last refreshed**: 2026-06-28 (v50 closure, cycle-37)
> **Schema**: lives at monorepo root (`STATUS.md`); per-repo `STATUS.md` mirrors the current local state.
> **Ref**: `AGENTS.md`, `SSOT.md`, `findings/71-pillar-*-probe.md`

---

## Snapshot

| Item | Value |
|---|---|
| Organization | `KooshaPari` (monorepo of sub-repos) |
| Current branch | `chore/v48-dag-wave-6-2026-06-27` |
| Cyc les sustained | 15 (v32–v50) |
| Fleet mean | 3.72 (86/86 pillars at 3/3) |
| Envelope coverage | 100% of 20 wave-1 DAG repos (7/7 files each) |
| CI gates | 6 (inventory + drift + scorecard + alert-on-regression + forge-daemon-check + trend-report) |
| Open PRs (fleet-wide) | 1 (`pheno-context#1` — oidc module) |
| Open issues | 0 |
| Working tree | Clean |

## Wave history

| Wave | Date | Tracks | Outcome |
|------|------|--------|---------|
| v44 | 2026-06-27 | 5 tracks (L23/L27/L36/L38/L44) | 71-pillar hardening closure |
| v45 | 2026-06-27 | Standby | Standby plan for 71-pillar program |
| v46 | 2026-06-27 | T2-T6: automation (daemon, alert, scorecard push) | PR #163 shipped |
| v47 | 2026-06-27 | T1-T4: forge-daemon-check, push-scorecard, alert CI gate, v48 plan | 4 commits, 6 CI gates |
| v48 | 2026-06-27 | 8 tracks: envelope expansion across 20 repos | 12 new files, 7 commits across 5 nested repos |
| v49 | 2026-06-27 | T1-T4: PR triage, forge daemon verify, DAG fix, closure | 0 PRs found, all gates working, DAG corrected |
| v50 | 2026-06-28 | ADR-095 T0: pheno-runtime-config, pheno-context oidc | 2 repos created/updated, cycle-37 probe |

## Active work

| Item | Owner | Priority | Status |
|---|---|---|---|
| `pheno-context#1` merge | @kooshapari | P0 | PR open — oidc module |
| Registry update (pheno-runtime-config + pheno-context) | @kooshapari | P2 | Deferred |
| ADR-095 T9 — full `Reloadable<T>` integration tests | @kooshapari | P1 | v51 candidate |
| Meta-bundle push to 15 pheno-* repos | @kooshapari | P2 | v51 candidate |
| §8 Router architecture (ADR-050/051/052) | @kooshapari | P1 | v51 candidate |

## CI gate inventory

| Gate | Workflow / Script | Triggers |
|------|-------------------|----------|
| Inventory | `tools/pillar-fleet/inventory.sh` | Daily cron + PR |
| Drift | `tools/pillar-fleet/drift.sh` | Daily cron + PR |
| Scorecard | `tools/pillar-fleet/scorecard.sh` + `push-scorecard.sh` | Daily cron + PR |
| Alert-on-regression | `tools/pillar-fleet/alert.sh` — threshold 0.5 | After scorecard step |
| Forge daemon check | `.github/workflows/forge-daemon-check.yml` | Daily cron (0 6 * * *) |
| Trend report | `tools/pillar-fleet/trend.sh` | Weekly (Monday 09:00) |

## Repo envelope coverage (20 wave-1 DAG repos)

All 20 repos verified boarded with 7/7 envelope files:
AGENTS.md, justfile, SSOT.md, llms.txt, deny.toml, .pre-commit-config.yaml, .github/workflows/ci.yml

## Related

- `AGENTS.md` — full project governance, ADR index, 71-pillar framework
- `SSOT.md` — single source of truth conventions
- `findings/71-pillar-2026-06-17-schema.md` — 71-pillar schema
- `findings/2026-06-28-71-pillar-cycle-37-probe.md` — cycle-37 probe
- `plans/2026-06-28-v50-adr095-t0-execution.md` — v50 plan
- `dag-state/wave-1.json` — envelope expansion DAG
