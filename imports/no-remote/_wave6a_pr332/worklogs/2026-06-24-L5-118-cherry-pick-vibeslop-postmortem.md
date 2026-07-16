# Cherry-pick vibeslop post-mortem (2026-06-24)

## Summary

On 2026-06-24, 4 PRs were opened to `diegosouzapw/OmniRoute` (PRs #105, #106, #108, #4996) that each carried **1700–2300 files** of diff, despite the intent being a handful cherry-picks. The diff sizes should have been the first red flag (a 1-commit cherry-pick should not touch >1700 files).

**Total contamination**: ~8,000 files, ~600K LOC of phantom diffs across 4 PRs.

## Root cause

The cherry-pick branches were not based correctly. When you `git cherry-pick -x <commit>` on a branch that's already ahead of the base by hundreds of commits, the diff might "re-manifest" changes that are actually from the history, not from the cherry-pick. The subagent tool also contributed by bundling unrelated upstream changes into what was supposed to be focused PRs.

Specific failure mode for #4996:
- Branch was created from `origin/main` (KP main, ~e4d751ed)
- Cherry-pick `c9b5b1a89` (which is in `upstream/main` but NOT in `origin/main`)
- The cherry-pick applied cleanly but the *diff* between `origin/main` and the branch tip was computed against `origin/main` — which also contains changes from other cherry-picks already in the tree

The fix: **manual file extraction** instead of `git cherry-pick -x` when cherry-picking across forks.

## Detection

The PRs were detected as contaminated because:
1. PR #4996 showed `changed_files: 2327` in the GitHub API — impossible for a 1-commit cherry-pick
2. Comparing the diff stat (+83027/−876469) against the expected (< +1000) was off by 3 orders of magnitude
3. Cross-check: `git diff --stat origin/main..HEAD` on the actual branch showed the contamination immediately

## Resolution

1. **PR #4996**: Closed as superseded (via `state: closed, state_reason: superseded`)
2. **Re-do**: Manual file extraction via `git checkout <commit> -- <files>` then `git add -A + git commit`, no `cherry-pick -x`
3. **PR #4999**: Clean re-do (8 files, +676/−2, verified clean diff)
4. **PRs #105, #106, #108**: Already closed earlier in the session

## Lessons learned

1. **Always verify `git diff --stat origin/main..HEAD` before pushing a cherry-pick branch.** If the file count is more than 5× the expected, abort and investigate.
2. **Prefer manual file extraction** (`git checkout <commit> -- <files>`) over `git cherry-pick -x` when cherry-picking across forks with significant divergence (>100 commits). This prevents the "re-manifest" pattern.
3. **The `changed_files` field in the GitHub API is the best vibeslop detector** — any PR with >50 files that isn't explicitly a bulk refactor is suspect.
4. **Close contaminated PRs immediately** before they get automated CI attention (every CI run against a contaminated branch is a wasted cycle).
5. **GitHub REST API is more reliable for PR operations than `gh` CLI** when rate limits are high.

## Current PR status as of 2026-06-25

| PR | Status | Files | +/- | Notes |
|---|---|---|---|---|
| #4996 | ⨯ CLOSED | 2327 | +83027/−876469 | Contaminated cherry-pick. Replaced by #4999 |
| #4999 | 🟡 OPEN | 8 | +676/−2 | Clean re-do of Indonesian caveman pack |

All other cross-fork PRs are clean.
