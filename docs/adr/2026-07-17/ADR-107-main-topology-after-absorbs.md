# ADR-107: Main topology after Argis and omniroute-rs absorbs

**Status**: Draft
**Date:** 2026-07-17
**Decision owner:** Repository owner
**Related:** #339, #340, #322, PR #375, PR #376

---

## 1. Context

Current `main` contains `apps/desktop`, the absorbed
`crates/omniroute-rs` workspace, and `extensions/argis`. The prior v4
`apps/bff` and `apps/web` trees are absent. Open BFF issues and draft PR #375
still target that removed tree.

Without an explicit decision, contributors cannot tell whether to restore v4,
retarget work to Rust, or close the BFF backlog. This also makes architecture,
release criteria, and generated documentation unreliable.

## 2. Decision

Choose exactly one option before merging or closing BFF work.

### Option A — Accept current Rust-first topology (recommended if intentional)

- Treat `apps/desktop`, `crates/omniroute-rs`, and `extensions/argis` as the
  supported mainline.
- Retarget #339/#340 to the Rust API where equivalent requirements remain.
- Close or supersede PR #375 while preserving its tests/specification as
  migration evidence.
- Require path-scoped Rust CI before implementing API, router, and CLI leaves.

### Option B — Restore the v4 BFF/web topology

- Restore the v4 subtrees in a dedicated recovery PR with provenance.
- Rebase PR #375 only after restoration.
- Resume #339 and #340 against the restored canonical paths.
- Define coexistence boundaries between v4 services and omniroute-rs.

## 3. Recommendation

Accept Option A only if the subtree removal was deliberate. Otherwise choose
Option B; silently treating an accidental force-push/restructure as an
architecture decision would lose supported behavior and traceability.

## 4. Consequences

### Option A

- Positive: one forward architecture; avoids resurrecting an orphaned stack.
- Negative: requires migration specifications for BFF capabilities.
- Risk: scaffold-heavy Rust crates do not yet replace the removed API.

### Option B

- Positive: preserves existing BFF work and issue contracts.
- Negative: restores a larger monorepo and creates overlap with Rust absorbs.
- Risk: recovery provenance and merge conflict volume are substantial.

## 5. Release criteria

This ADR is resolved when:

1. The owner selects A or B.
2. The selected topology is reflected in `main`.
3. #339, #340, and PR #375 are updated.
4. `plans/2026-07-17-proc2-wbs-pert-dag.md` is advanced past P1-L1.
