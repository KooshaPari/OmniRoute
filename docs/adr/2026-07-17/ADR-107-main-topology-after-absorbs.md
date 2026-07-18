# ADR-107: Main topology after Argis and omniroute-rs absorbs

**Status**: Accepted
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

Adopt **Option C: staged convergence**. Restore the v4 BFF/web feature surface
as a compatibility baseline, while retaining `omniroute-rs` as the target
architecture. Migrate bounded capabilities behind contract and parity gates;
delete a v4 capability only after its Rust replacement satisfies the same
functional, operational, and rollback criteria.

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

### Option C — Staged convergence (selected)

- Restore v4 BFF/web in a provenance-preserving recovery PR.
- Keep the Rust workspace and Argis absorb on `main`.
- Freeze new cross-cutting architecture in v4, but allow correctness,
  security, observability, and migration-enabling work.
- Define API contracts and parity tests before each Rust replacement.
- Route one bounded capability at a time to Rust using a reversible flag.
- Remove v4 code only after two release cycles with parity, SLO, and rollback
  evidence.

## 3. Rationale

Option C maximizes long-term capability and polish without pretending the
scaffold-heavy Rust workspace already replaces the mature v4 feature surface.
It avoids both permanent dual-stack drift and abrupt feature loss.

## 4. Consequences

### Option A

- Positive: one forward architecture; avoids resurrecting an orphaned stack.
- Negative: requires migration specifications for BFF capabilities.
- Risk: scaffold-heavy Rust crates do not yet replace the removed API.

### Option B

- Positive: preserves existing BFF work and issue contracts.
- Negative: restores a larger monorepo and creates overlap with Rust absorbs.
- Risk: recovery provenance and merge conflict volume are substantial.

### Option C

- Positive: preserves maximum feature coverage while establishing a clear
  Rust-first destination.
- Positive: supports incremental polish, measurement, and rollback.
- Negative: temporarily carries two implementations and requires contract
  governance.
- Risk: migration can stall into permanent dual-stack operation. Mitigate with
  per-capability owners, deadlines, and deletion criteria.

## 5. Release criteria

This ADR is resolved when:

1. The v4 recovery commit range and provenance are documented.
2. BFF/web restoration passes existing contracts without reverting the Rust or
   Argis absorbs.
3. #339, #340, and PR #375 are rebased or superseded explicitly.
4. A feature-parity matrix maps every v4 capability to a Rust state and owner.
5. The first capability migrates through a reversible routing flag.
