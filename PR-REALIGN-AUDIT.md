# OmniRoute fork PR realign report

> Generated: 2026-06-27 from `E:\w26-OmniRoute` (`origin = KooshaPari/OmniRoute`)
> Purpose: read-only inventory to support realignment plan. **No branches rebased. No PRs edited. No force-pushes.**

## Repo context

- Fork: `KooshaPari/OmniRoute` (your fork)
- Upstream: `diegosouzapw/OmniRoute` (not configured as a remote on this checkout)
- Default branch: `main`
- Local checkout branch: `integration/consolidate`
- `package.json` version: `3.8.5`
- Release branches present in fork (confirmed via `git ls-remote`):
  - `release/v3.8.8` (local only, no open PR base)
  - `release/v3.8.37` (has PR #130 already aligned)

## Open PR inventory (40 open)

| # | Base | Head | Title |
| - | ---- | ---- | ----- |
| 140 | main | `pr-010-target-exhaustion-tests` | test(combo): add 14 unit tests for targetExhaustion.ts |
| 139 | main | `fix/ci-lint-cur` | fix(ci): restore merge-deleted files to unblock Lint job |
| 138 | main | `chore/v39-gap-fill-20260629` | chore(v39): gap-fill — pillar-drift template + cyclonedx-weekly cron |
| 137 | main | `feat/v37-gitleaks-fleet-20260629` | feat(v37-T1): gitleaks-fleet CI |
| 136 | main | `docs/integrated-setup-guide` | docs: integrated setup guide (CLOSED) |
| 135 | main | `pr-009-compression-studio-analytics` | Compression Studio + Per-Engine Analytics |
| 134 | main | `feat/v36-T2-perf-sbom-mtls-chaos-20260628` | v36 T2 perf + T3 sbom + T4 mtls + T7 chaos |
| 133 | main | `pr-008-chatcore-last-leaf` | (refa) PR-008 chatcore last leaf |
| 132 | main | `sec-ratelimit` | (feat) |
| 131 | main | `feat/v36-T1-fuzz-weekly-20260628` | |
| **130** | **release/v3.8.37** | **koosha/feat/perf-http** | **feat — already aligned, no action** |
| 129 | main | `feat/v36-evolve-20260627` | |
| 128 | main | `feat/v30-T6-mtls-20260627` | |
| 127 | main | `feat/v30-T4-perf-agg-20260627` | |
| 126 | main | `feat/v30-T2-fuzz-chaos-20260627` | |
| 125 | main | `feat/v30-T5-slo-burnrate-20260627` | |
| 124 | main | `feat/v30-T3-adr-quality-lint-20260627` | |
| 123 | main | `feat/v30-T1-fleet-inventory-20260627` | |
| 122 | main | `feat/v30-T5-gitleaks-vault-lfs-20260627` | |
| 121 | main | `feat/v30-T1-docs-contract-sbom-20260627` | |
| 120 | main | `feat/v29-T12-k6-load-test-20260625` | |
| 119 | main | `pr-007-chatcore-request-shape` | |
| 118 | main | `feat/v29-T7-terraform-hooks-20260625` | |
| 117 | main | `pr-006-chatcore-credential-rotation-helpers` | |
| 116 | main | `feat/v29-T1-latency-endpoints-20260626` | |
| 115 | main | `pr-005-chatcore-usage-log-helpers` | |
| 114 | main | `feat/v28-T3-capacity-headroom-20260625` | |
| 113 | main | `feat/v28-T2-redfish-telemetry` | |
| 112 | main | `pr-004-chatcore-token-time-helpers` | |
| 111 | main | `pr-003-chatcore-wrap-readable-stream-finalize` | |
| 110 | main | `pr-002-chatcore-resolve-executor-proxy` | |
| 109 | main | `pr-001-compression-telemetry-wiring` | |
| 108 | main | `koosha/feat/observability-wireup` | merged (OTel/Prom into applyCompression) |
| 107 | main | `audit/100-pr-plan` | |
| 104 | main | `fix/l5-501-svc-supervisor-max-listeners-cap` | |
| 103 | main | `chore/l5-124-upstream-sync-final-2026-06-21` | cherry-pick upstream electron+compression+docker |
| 102 | main | `feat/l5-123-b10-otel-bridge-2026-06-21` | B10 OTel bridge (Bifrost T1 → OmniRoute T2) |
| 101 | main | `docs/l5-124-flesh-out-spec-plan-agents` | flesh out SPEC/PLAN/AGENTS/STATUS |
| 100 | main | `chore/l5-123-upstream-feature-sync-2026-06-21` | cherry-pick 3 medium upstream commits |
| 99  | main | `chore/l5-122-upstream-security-2026-06-21` | upstream ReDoS + dep bump cherry-pick |
| 98  | main | `chore/l5-121-bifrost-kill-switch-wiring-2026-06-20` | B9 kill switch into executor |

## Realign plan (proposed only — execution NOT performed)

### Target base: `release/v3.8.37`
- Why: immutable release branch. Aligning all 39 PRs here lets upstream tag a clean v3.8.37 without triage. PR #130 is already on this base.
- Alternative considered: keep all on `main` (rejected — `main` is moving and would need new triage after each upstream merge).

### Order of operation (proposed)
1. **Docs-only PRs first** (lowest conflict risk) — `#107 audit/100-pr-plan`, `#101 docs/l5-124-flesh-out-spec-plan-agents`
2. **Chore-only PRs next** — `#103/#100/#99/#98/#138`
3. **Fix PRs** — `#139`, `#104`
4. **Feat PRs (desc by PR#)** — remaining 25

### Push policy (proposed)
- `git push --force-with-lease` only. Never `--force`.

### Conflict handling
- Per-branch worktree.
- On conflict, halt and report.

### Caveats
- `release/v3.8.37` SHA captured at fetch time.
- `diegosouzapw/OmniRoute` was not added as a remote in this checkout. Recommended addition: `git remote add upstream https://github.com/diegosouzapw/OmniRoute.git && git fetch upstream`.

## Status

🛑 **No actions taken** against this plan. This markdown is informational only.
