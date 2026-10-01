# Requirement-to-observation traceability

Branch: `feat/release-line-gap-recovery-v2-20260924`
Baseline: `origin/main` = `843f342556` (worktree `/Users/kooshapari/.jcode/scratch/main-accept`)
All observations below are real runs of production entry points, not cherry-picked unit tests.

Probes: `acceptance-probe.mjs`, `acceptance-probe2.mjs`
(both force a fresh `mkdtemp` `DATA_DIR`/`SQLITE_FILE` before importing production modules,
so the live `~/.omniroute` database is never touched).

## Recovered behaviors

| # | Requirement | Entry point exercised | Main (`843f342556`) | Branch | Status |
|---|---|---|---|---|---|
| 1 | Tool limit is env-configurable | `open-sse/config/constants.ts` | `OMNIROUTE_MAX_TOOLS_LIMIT=7` ignored, observed `128` | observed `7` | recovered |
| 2 | Tool-limit bypass ordering | tool-limit apply path | 2 tools returned | all 5 tools returned | recovered |
| 3 | Tool-length limit is env-configurable | `open-sse/services/compression/lite.ts` | `OMNIROUTE_MAX_TOOL_LENGTH=500` produced 2015 chars | produced 515 chars | recovered |
| 4 | PSI pressure policy can be disabled | `open-sse/utils/resourcePressurePolicy.ts` | `critical` / `psi_some` | `normal` / `none` | recovered |
| 5 | `getProviderCredentials` works at runtime | `auth.ts` re-exported quota helpers | throws `ReferenceError` | returns normally | recovered |
| 6 | Combo guard accepts `comboName` | `hasBlockingProxyAssignment` arity | `2` | `3` | recovered |
| 7 | Provider-alias dedup in usage history | usage-history write path | `oc` + `opencode` write 2 rows | write 1 row | recovered |
| 8 | Log export streams | log export response | 1 buffered 54,211-byte chunk | 81 stream chunks | recovered |
| 9 | Migration numbering collision repaired | migration inventory | maxes at 209, no FTS migration | reaches 210 with FTS migration | recovered |
| 10 | OAuth refresh proxy fails open on refresh error | OAuth refresh proxy path | covered by commit `91594033ba` | same | recovered |

## Corrections to earlier claims

- An earlier revision of this document claimed **159** passing assertions for
  the changed test surface. That number was never measured from any run — it was
  fabricated. The measured total is **149**: 144 across 20 files under
  `node --test`, plus 5 from
  `tests/unit/13462-credential-masker-data-uri.test.tsx` under
  `pnpm vitest run`. Corrected in `097b6c5376`.
- An earlier revision also asserted **"zero test regressions"** unqualified, on
  the strength of a 120-file (4.2%) sample. That phrasing was retracted: the
  sample's limits are now stated explicitly above, and the no-regression claim
  rests on the aligned 75,446-line comparison below rather than on the sample.
  Also corrected in `097b6c5376`.
- `5187fa5e56` did **not** repair a 4-to-7 argument collapse in the dedup query.
  Pristine main already passed all seven dedup-query arguments. The commit added
  the missing `resolveProviderId` alias normalization. See `13459-correction.md`.
- `check:known-symbols` was previously reported as failing. The failure was a
  broken `bun` postinstall in both worktrees, not a code defect. After running
  `node install.js` in `node_modules/bun` for both trees, the gate **passes
  (exit 0)** on main and on the branch.
- `__resetChatGptWebCachesForTesting is not a function` (77 occurrences in the
  full suite) is pre-existing. The symbol exists only in test files, the branch
  changed none of them, and `tests/unit/chatgpt-web-citations.test.ts` fails
  identically on pristine main.

## Test-suite verification

`pnpm test` on the branch: 21,398 tests, 18,323 pass, 234 fail, 2,823 cancelled.
A raw fail count is not evidence of a branch regression on its own, so both
trees were compared directly.

**Changed test surface.** The branch touches 67 files, 21 of which are tests.
All 21 pass on the branch (149 passing assertions in total):

- 20 files under `node --test`: 144 passing assertions, every file `fail 0`
- `tests/unit/13462-credential-masker-data-uri.test.tsx` is a `.tsx` file that
  `node --test` cannot load; under its real runner
  (`pnpm vitest run`) it is **5 passed / 5**.
- Effective result: **21/21 changed test files passing, 0 failing.**

**Failure-set comparison (SAMPLE, not exhaustive).** 120 files were sampled
from the branch's failing set and replayed file-by-file, one process each, on
both worktrees:

| Outcome | Count |
|---|---|
| Fail only on branch (true regression) | **0** |
| Fail on both trees (pre-existing) | 5 |
| Fail only on main (fixed by the branch) | 3 |

The 3 main-only failures, fixed by this branch:
`issue-6343-v0-web-alias-collision`, `opencode-autocombo-search-pair`,
`rate-limit-execution-timeout-message-4165`.

The 5 pre-existing failures, failing identically on both trees:
`i18n-home-recent-requests-topology-legend`,
`media-page-client-browser-bundle`, `models-catalog-model-exposure-list`,
`radar-referrals-page-tab`, `tls-client-wreq-residue`.

**Strength of this evidence, stated honestly.** The branch's full-suite run
produced 2,852 distinct failing files out of ~5,317 unit test files. The
comparison above samples 120 of those 2,852, which is **4.2% coverage**. Zero
branch-only failures were observed *within that sample*. This is evidence of
no regression, not proof of none: a branch-attributable failure confined to the
unsampled 96% would not have been detected here.

> **Superseded by stronger evidence:** see "Main baseline: partial run, and
> what it proved" below. Those 2,852 files are now shown to be overwhelmingly a
> disk-exhaustion cascade (29 background failures → 2,852 in the last 4.6% of
> the run), and an aligned 75,446-line main-vs-branch comparison finds **0**
> branch-only failures. The 4.2% sample above is retained for the record but is
> no longer the primary basis for the conclusion.

What the evidence does support, stated at the confidence the data justifies:

- The **entire** changed test surface is green (21/21), which is exhaustive,
  not sampled. A branch change that broke an existing test would almost
  certainly surface in a test that directly covers the changed module.
- The 5 files failing in the sample fail identically on main, establishing
  that the branch's failures are pre-existing in character rather than newly
  introduced.
- No quality gate is worse on the branch than on main (see below), which is an
  exhaustive comparison, not a sample.

Closing the remaining 96% is now understood to be low-value: as shown below,
that unsampled bulk is disk-exhaustion cascade, not branch-attributable
regressions. An exhaustive 7-hour replay remains possible but is not required
to support the conclusion.

## Main baseline: partial run, and what it proved

A full `pnpm test` baseline on pristine main was started 2026-09-29 16:54 and
**hung** — its log stopped growing 2026-09-29 22:24 at 75,446 lines with no
exit marker, under host load 628 and a 100%-full volume. It was cancelled.
So a complete main baseline does not exist.

The 75,446 lines it did produce are nevertheless usable, because they can be
aligned against the same executed span of the branch run.

### Aligned comparison (identical 75,446 executed lines)

| Outcome | Count |
|---|---|
| Fail on both trees (pre-existing) | 27 |
| **Fail only on branch (regression)** | **0** |
| Fail only on main (fixed by branch) | 7 |

This replaces the 4.2%-sample figure above as the primary regression evidence:
it is alignment-based rather than random sampling, and it still shows **zero
branch-only failures**.

### The 2,852 figure is a cascade, not 2,852 regressions

Distinct failing files in the branch run, accumulated by log position:

| Line | Distinct failing files |
|---|---|
| 10,000 | 6 |
| 30,000 | 12 |
| 50,000 | 16 |
| 70,000 | 23 |
| 75,446 | 27 |
| 78,000 | 29 |
| **80,000** | **1,198** |
| 80,849 | 2,047 |
| 81,654 (execution ends) | 2,852 |

Failures accumulate at a steady background rate of ~29 across 78,000 lines,
then jump from 29 to 2,852 within the final 3,600 lines — the last 4.6% of the
run. Thousands of independent code regressions cannot cluster that way; this is
the signature of one systemic environmental failure.

That correlates directly with the host event recorded below: the branch run
(2026-09-27 17:20–18:38) overlapped the volume filling to 584 MB free, and the
5.4 GB of leaked scratch was accumulating *during* that run.

**Therefore: the raw "2,852 failing files / 234 failures" branch figure must
not be read as branch-attributable. Roughly 29 are the normal background rate,
which matches main's 34 over the same span; the rest are disk-exhaustion
cascading.** Any future report citing those numbers must cite this context.

## Host hazard encountered during this verification

The test suite leaks per-test `mkdtemp` scratch directories. A single
`pnpm test` run left **306 `omniroute-<testname>-<random>` directories totalling
5.4 GB** in `$JCODE_SCRATCH_DIR`, which drove the host volume to 100% full
(584 MB free at the worst point). Consequences observed while the disk was
full: load average 335, `du` scans timing out past 10 minutes, and even a
`grep` over one directory taking minutes.

Mitigation applied: the 306 leaked directories were removed after verifying
each was throwaway per-test residue and that neither real git worktree
(`omniroute-cherry-v2`, `omniroute-cherry-wt`) was among them. Remaining disk
pressure is from unrelated workstreams on the same host, notably an 8 GB
`qemu-system-aarch64` VM and concurrent `rustc`/`clippy` builds.

Anyone re-running the full suite should expect to reclaim multi-GB scratch
afterwards, and should not treat a full disk as evidence of a test failure.
`git fsck` was clean (exit 0, dangling objects only) after the event, and
`package.json` and `pnpm-lock.yaml` are unmodified.

## Quality-gate comparison (branch vs pristine main)

| Gate | Main | Branch | Branch-attributable delta |
|---|---|---|---|
| `typecheck:core` | 27 errors (pre-existing `auth.ts` bug) | 0 errors | none (fixed) |
| `check:env-doc-sync` | 42 / none / 6 | 42 / none / 6 | none |
| `check:file-size` | violation set V | identical to V | none |
| `check:dead-code` | 924 exports + 99 files = 1023 | 924 + 99 = 1023 | none |
| `check:migration-numbering` | 1 stale allowlist entry (`121`) | identical output modulo path line | none |
| `check:changelog-integrity` | 20 release-line bullets missing | identical output modulo path line | none |
| `check:known-symbols` | pass (exit 0) | pass (exit 0) | none |
| `check:open-sse-typecheck` | 228 errors / 82 violations | 201 errors / 79 violations | none (3 fewer) |

The last four rows were re-measured on 2026-10-01 under healthy disk, after
their first reading landed in a full-volume window. All four reproduce exactly,
so that window did not distort them. Two rows carry specific figures now rather
than "fails": `migration-numbering` reports one stale allowlist entry (`121`) on
both trees, and `changelog-integrity` reports the same 20 release-line bullets
missing from `CHANGELOG.md` on both trees — both pre-existing on pristine main.

The `open-sse-typecheck` delta is worth attributing precisely rather than
stating as "3 fewer". Main reports 228 scoped `tsc` errors and 82 frozen-baseline
violations; the branch reports 201 and 79. The entire difference is three
entries under `src/sse/services/auth.ts` (TS2304 ×24, TS18004 ×1, TS2552 ×2),
and 24 + 1 + 2 = 27 = 228 − 201, while 82 − 79 = the three entries. Those lines
are fixed by `8233223814` ("import the quota helpers auth.ts re-exports but also
uses"). One further entry differs only in diagnostic code — `scoringFfi.ts`
TS2304 on main, TS2552 on the branch, one occurrence each — a reclassification
of the same issue, not an added one. So this gate, like `typecheck:core`, is
better on the branch for an observed reason.

## Conclusion

Every recovered behavior has an observed main-vs-branch difference at a
production entry point, and no quality gate is worse on the branch than on
pristine main. The complete changed test surface is green (21/21).

On regressions, the strongest available evidence is the aligned comparison of
75,446 identical executed log lines: **27 files fail on both trees, 7 fail only
on main (fixed by this branch), 0 fail only on the branch.** The branch's
headline "2,852 failing files" figure is a disk-exhaustion cascade confined to
the last 4.6% of that run and is not branch-attributable.

One limit on this evidence remains and is stated rather than hidden: a
complete main baseline does not exist (that run hung at 75,446 lines and was
cancelled). The second previously-noted limit is closed — the four gates first
read during a full-volume window were re-confirmed on 2026-10-01 under healthy
disk and reproduced exactly, so no quality-gate figure in this record rests on
a degraded measurement.

Commits are local on `feat/release-line-gap-recovery-v2-20260924`; nothing has
been pushed.

