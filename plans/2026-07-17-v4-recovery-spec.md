# SPEC: v4 compatibility baseline recovery

**ADR:** ADR-107 staged convergence  
**WBS:** P1-L4 → P1-L5 → P1-L6  
**Status:** Recovery source verified; implementation pending

## Source of truth

Restore v4 application paths from:

```text
06886ea531c8a5427420f89772a70cc12b6438a6
ci: align Bun runtime and types parity (#370)
2026-07-17 02:36:53 -0700
```

Why this commit:

- It is the latest verified old-main v4 baseline before draft PR #375.
- It contains strict-type-gate commit `c3131328a` in its ancestry.
- Draft PR #375 commit `1ee5df63c` descends from it, so #375 can be rebased or
  replayed after restoration rather than being folded into the baseline.
- Its application tree contains 31 BFF files and 129 web files.
- GitHub recorded Local-First CI and exact-tree evidence as successful.
  SonarCloud was not green, so restoration does not claim a fully green
  baseline.

The common ancestor with current post-absorb `main` is:

```text
92825af9fc112a1cc7abc5fd98fb808da4867207
```

## Recovery boundary

Restore only the compatibility surface and its directly required workspace
metadata:

1. `apps/bff/**`
2. `apps/web/**`
3. Required v4 workspace manifests, lockfiles, and path-scoped scripts
4. Required path-scoped CI definitions

Do not restore:

- old `apps/desktop/**` over current desktop
- old root files wholesale
- removed generated artifacts, caches, or local evidence
- any change that deletes or rewrites `crates/omniroute-rs/**`
- any change that deletes or rewrites `extensions/argis/**`

## Recovery procedure

1. Create a branch from current `main`.
2. Restore `apps/bff` and `apps/web` from `06886ea531c8a5427420f89772a70cc12b6438a6`.
3. Inventory required root/workspace files using import and script references;
   restore them individually, never by whole-tree checkout.
4. Reconcile package-manager metadata using the repository's Bun policy.
5. Run BFF tests/typecheck and web tests/typecheck/build.
6. Run the new omniroute-rs Linux/locked workspace check.
7. Confirm Argis tracked-file count and smoke entrypoint remain unchanged.
8. Open a recovery PR with source commit, restored path list, omitted path
   list, and rollback commit.
9. Rebase or replay PR #375 only after the recovery PR merges.

## Acceptance criteria

- [ ] BFF and web compile from a clean checkout.
- [ ] Existing v4 tests pass or every inherited failure has a linked baseline.
- [ ] Current desktop, Rust, and Argis trees are not regressed.
- [ ] Root and v4 lockfiles are internally consistent.
- [ ] DAST advances past dependency installation.
- [ ] PR #375 has a conflict-free replay plan.
- [ ] #339 and #340 point to canonical restored paths.
- [ ] Recovery can be reverted with one PR without affecting later Rust work.

## Rollback

Revert the recovery commit(s) only. Since the recovery must not modify Rust,
Argis, or current desktop paths, rollback must return to the post-#376 topology
without reverting `6315f9075`.
