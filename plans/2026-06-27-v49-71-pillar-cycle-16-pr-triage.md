# v49 — 71-pillar cycle-16 plan (PR backlog triage + forge persistence)

**Date:** 2026-06-27
**Previous wave:** v48 (envelope expansion)
**Fleet mean:** 3.72 (86/86 pillars at 3/3, 12 cycles sustained)

## Tracks

### T1: 30-PR backlog triage (~2h)

The v46 post-standby resume plan identified a 30-PR backlog across the fleet.
This track triages:

- Tag each PR by priority (P0/P1/P2/P3)
- For P0: merge, close, or move to active track
- For P1: assign to next cycle
- For P2/P3: close as "deferred" with a note
- Update registry disposition for any repos that changed state

**Success criteria:** 0 PRs un-triaged; registry disposition-index updated.

### T2: Forge daemon persistence (~1h)

Per ADR-097, forge daemon must survive between sessions:

- `scripts/forge_daemon_check.sh` script (created v47 T1) — verify it works
  on the current branch
- `.github/workflows/forge-daemon-check.yml` — verify it triggers
- Consider adding `just forge-daemon-check` to the CI pipeline
- Document the `--warn / --json / --strict` flag convention in AGENTS.md

**Success criteria:** forge-daemon-check passes in CI; documented.

### T3: Envelope inventory DAG fix (~30min)

The `dag-state/wave-1.json` overcounted by 5 repos (they were already boarded).
Update the DAG to reflect real state:

- Re-scan all 20 repos for actual envelope state
- Update `dag-state/wave-1.json` with accurate counts
- Add a note about the overcount in the DAG

**Success criteria:** dag-state/wave-1.json reflects actual envelope state.

### T4: Cycle-36 closure + this plan

**Success criteria:** v49 plan committed; STATUS.md updated.

## Schedule

| Track | Est. time | Priority |
|-------|-----------|----------|
| T1: PR backlog triage | 2h | P0 |
| T2: Forge persistence | 1h | P1 |
| T3: Envelope DAG fix | 30m | P2 |
| T4: Closure | 15m | P0 |
