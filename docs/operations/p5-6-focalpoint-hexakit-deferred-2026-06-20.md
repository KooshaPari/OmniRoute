# P5-6: FocalPoint → HexaKit — Wave-closure deferral

**Date:** 2026-06-20
**Source:** `KooshaPari/FocalPoint` (archived 2026-06-19; isArchived: true)
**Target:** `KooshaPari/HexaKit`
**Wave:** P5
**Registry row:** `gate-focalpoint-p5-6-wave-closure` (sidecar; original `gate-focalpoint` row preserved)

## Verdict

P5-6 is **deferred (wave-closure)**. No code migration is planned in this wave.

## Rationale

1. **Source archived.** `KooshaPari/FocalPoint` is `isArchived: true`. The 867MB `vendor/` directory that triggered the prior deferral is more likely in `KooshaPari/HexaKit/vendor/` than in FocalPoint itself; the absorption is effectively a no-op pattern (mirroring P5-4 phenoRouterMonitor → phenoAI).
2. **The 867MB vendor is in HexaKit, not FocalPoint.** HexaKit is the active Rust/Bun monorepo with full governance/ADR/FR/SPEC docs. The actual focal-point sub-project (if any) lives under `FocalPoint/FocalPoint-wtrees/`, not at the root.
3. **Upstream blocker.** `KooshaPari/thegent` PR #1114 (`integration/consolidate`) is OPEN + APPROVED + CONFLICTING. The `thegent` consolidation failure is upstream of P5-6 because thegent is the engine layer for the P5-5 boundary. Fixing P5-6 in isolation would paper over the consolidation gap.

## Disposition

- **gate-focalpoint** row: `fsm: deferred`, note preserved as "867MB vendor; repo archived; manual HexaKit merge deferred"
- **gate-focalpoint-p5-6-wave-closure** sidecar: `fsm: deferred`, note: "P5-6 wave-closure 2026-06-20: deferred (wave-closure) - superseded by KooshaPari/thegent PR #1114 consolidation; revisit after #1114 merges."

## Consumer chokepoints

None. P5-6 has no active fleet consumers (the `vendor/` is not on any Cargo.toml/go.mod/pyproject.toml git dep).

## Verification

```bash
# No migration required
gh api "search/code?q=org:KooshaPari+KooshaPari/FocalPoint+in:file" \
  --jq '.items[] | select(.path | test("Cargo.toml|go.mod|package.json|pyproject.toml"))'
# Expected: 0 results (FocalPoint not on any active dependency chain)
```

## Next steps (out of P5 scope)

1. Resolve `KooshaPari/thegent` PR #1114 (close-as-superseded, link #1133/#1135, or merge one of the clean re-cuts)
2. After thegent consolidates, audit `KooshaPari/HexaKit/vendor/` for any FocalPoint-derived surface
3. If surface exists, open a P6 charter for vendor-streaming into HexaKit
4. If no surface exists, mark the original `gate-focalpoint` row `fsm: done` with note "absorbed-via-HexaKit-vendor-audit"