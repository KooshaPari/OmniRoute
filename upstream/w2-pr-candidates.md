# W2 — Fork-Portable Upstream PR Candidates

**Generated:** 2026-09-02 · **Source:** `node bin/divergence-manifest.mjs` over the 26 fork-only commits, filtered to `portable=true AND prTarget=*`

This is the actionable upstream-PR queue for Wave 2 (Core Audit / Bugfix). The first 5 entries are the highest-value candidates — pre-tested, low-conflict, small diffs, high-merge-odds.

## Top 5 Ready-to-Cherry-Pick Upstream PRs

| # | Commit | Subject | Bucket | Files | Why high-value |
|---|---|---|---|---|---|
| **W2.1** | `bf65512098f3` | `fix: complete retry and quota recovery follow-ups (#699)` | B4 acked bug | `src/core/retry/*.ts`, `src/core/quota/*.ts` | 4 separate validation fixes; upstream `acknowledged` label candidates |
| **W2.2** | `6da8329cbc7b` | `fix: restore provider and validation APIs (#700)` | B4 acked bug | `src/translator/`, `src/validation/`, `src/cache/` | 5 separate API restorations; tests pass; minimum diff |
| **W2.3** | `a0ebfabe4608` | `fix(open-sse): remove duplicate function definitions in perplexity-web.ts (#707)` | B4 acked bug | `open-sse/src/perplexity-web.ts` | Pure deletion (37 tsc errors → 0); high signal/noise |
| **W2.4** | `321a89412892` | `fix(scripts): close missing braces/parens in mjs files (#706)` | B3 trivial fix | `bin/cli/commands/setup-qwen.mjs`, `scripts/dev/responses-ws-proxy.mjs` | 1 char + 1 char; the kind of PR that gets merged in 30 min |
| **W2.5** | `79d5bf2fd6ec` | `chore(deps-dev): bump browserslist from 4.28.2 to 4.28.7 (#705)` | B2 deps bump | `package.json` | 1 line; automatable; Dependabot could've done it but didn't yet |

## Cherry-Pick Procedure

```bash
# In a clean upstream branch:
git fetch kooshapari          # or whatever your fork is named upstream
git fetch diegosouzapw        # upstream of record
git checkout -b fix/w2.1-retry-quota diegosouzapw/main
git cherry-pick bf65512098f3
# Resolve any conflicts (the 5 candidates here have 0 conflicts against
# current main as of 2026-09-02).
npm test                      # ensure green
git push kooshapari fix/w2.1-retry-quota
# Then open the PR against diegosouzapw/OmniRoute
```

## Conflict-Risk Map (from manifest's pr-risk field)

All 5 candidates have `pr-risk <= 0.15` (low). The portable commits that touch the same files as recent upstream merges are auto-flagged higher in `upstream/divergence-summary.md`.

## Acceptance / Verify

- [ ] All 5 PRs opened with `W-class: P` trailer visible in commit body
- [ ] All 5 PRs have `Closes #XXX` reference where the upstream issue exists
- [ ] All 5 PRs include a 1-line PR body that mentions the test command + expected behavior
- [ ] At least 1 PR merged within 30 days → first B4 merge → enables the W10 reputation campaign
- [ ] If 0 PRs merged in 30 days → re-evaluate (the issue might not be the diff, might be the framing)

## Pipeline

- [W2.1] → open within 24h of this doc
- [W2.2] → 1 week after W2.1 merges (parallel if confident)
- [W2.3] → 1 week after W2.2
- [W2.4] → immediately, can run in parallel with any of the above
- [W2.5] → immediately, can run in parallel with any of the above

## What Comes After

Once the first 5 are merged (or attempted), the manifest regenerates with new `portable` commits added by future work. Run:

```bash
node bin/divergence-manifest.mjs   # refresh
node bin/pr-candidates.mjs --status # re-rank
```

…and the queue keeps filling. The 10 portable commits that are *not* in the top 5 (commit messages reference #702, #711, #705 etc.) form the next round of PRs.

## See Also

- `upstream/divergence-manifest.json` — full machine-readable list
- `upstream/divergence-summary.md` — human-readable grouping
- `bin/divergence-manifest.mjs` — re-runs the audit
- `bin/classify-commit.mjs` — tags any new commit with W-class
- `bin/pr-candidates.mjs` — the upstream-issue side of the same campaign
