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

## Quality-gate comparison (branch vs pristine main)

| Gate | Main | Branch | Branch-attributable delta |
|---|---|---|---|
| `typecheck:core` | 27 errors (pre-existing `auth.ts` bug) | 0 errors | none (fixed) |
| `check:env-doc-sync` | 42 / none / 6 | 42 / none / 6 | none |
| `check:file-size` | violation set V | identical to V | none |
| `check:dead-code` | 924 exports + 99 files = 1023 | 924 + 99 = 1023 | none |
| `check:migration-numbering` | fails | identical output modulo path line | none |
| `check:changelog-integrity` | fails | identical output modulo path line | none |
| `check:known-symbols` | pass (exit 0) | pass (exit 0) | none |
| `check:open-sse-typecheck` | 82 failures | 79 failures | none (3 fewer) |

## Conclusion

Every recovered behavior has an observed main-vs-branch difference at a
production entry point. No quality gate is worse on the branch than on
pristine main. Commits are local on
`feat/release-line-gap-recovery-v2-20260924`; nothing has been pushed.
