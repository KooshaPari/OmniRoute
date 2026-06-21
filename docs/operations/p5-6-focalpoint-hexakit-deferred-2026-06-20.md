# P5-6 (FocalPoint → HexaKit) — deferred (wave-closure) — 2026-06-20

**Source:** `KooshaPari/FocalPoint` (archived 2026-06-20)
**Target:** `KooshaPari/HexaKit` (active)
**Registry row:** `gate-focalpoint` — disposition `ABSORB` → `target: HexaKit`, `wave: P5`

## Verdict

P5-6 is **deferred (wave-closure)**, not absorbed. The 867MB vendor question that originally deferred this row is superseded by upstream consolidation work in `KooshaPari/thegent` PR #1114.

## Evidence

1. **Source repo is archived**: `KooshaPari/FocalPoint` is `isArchived: true` as of 2026-06-20. The repo is a 459-entry monorepo aggregator with mostly 0-byte placeholders + a `FocalPoint-wtrees/` worktree subdir. No active maintenance.
2. **Target repo is active**: `KooshaPari/HexaKit` is a full Rust/Bun monorepo with `crates/`, `apps/`, `vendor/`, governance/ADR/FR/SPEC docs, and its own `registry.yaml`.
3. **867MB vendor location is in HexaKit, not FocalPoint**: prior ledger notes said the 867MB blocker was in FocalPoint. Re-survey on 2026-06-20 found HexaKit has a `vendor/` directory at the relevant size; FocalPoint's content is mostly empty placeholders. The "867MB blocker" is more likely a HexaKit sub-component already present.
4. **Upstream blocker: thegent PR #1114**: `KooshaPari/thegent` PR #1114 (`integration/consolidate` → main) is `OPEN`, reviewDecision `APPROVED`, but state `CONFLICTING`. `thegent` is the engine layer for the P5-5 (thegent/Agentora boundary) AFFIRM split. Until PR #1114 merges, the consolidation surface is unstable, which means any P5-6 absorption is fragile.

## Recommended unblock

1. Resolve `KooshaPari/thegent` PR #1114 conflicts first (likely from PR #309's 7-entry disposition fix).
2. After PR #1114 merges, re-audit whether HexaKit already contains the FocalPoint surface (P5-4-style finding: if the work is canonical in HexaKit, flip `gate-focalpoint` to `done` with provenance).
3. Only if a real delta exists, open a P5-6 absorption PR with the 867MB vendor streamed in via git-lfs or split into a separate sub-module PR.

## Status

- `gate-focalpoint` row: `fsm: deferred` (preserved, anti-wipe honored)
- `gate-focalpoint-p5-6-wave-closure` sidecar: `fsm: deferred`, wave-closure context
- Wave: P5 effectively closed (P5-1..P5-5 done; P5-6 documented-deferred)
