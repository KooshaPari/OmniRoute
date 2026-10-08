# Requirement-to-observation traceability

Branch: `feat/release-line-gap-recovery-v2-20260924`
Baseline: `origin/main` = `843f342556` (worktree `/Users/kooshapari/.jcode/scratch/main-accept`)
All observations below are real runs of production entry points, not cherry-picked unit tests.

Probes: `acceptance-probe.mjs`, `acceptance-probe2.mjs`
(both force a fresh `mkdtemp` `DATA_DIR`/`SQLITE_FILE` before importing production modules).

> **Correction (2026-10-02):** the following sentence originally ended "so the
> live `~/.omniroute` database is never touched". That is no longer accurate. A
> one-off throwaway probe of `prepareUpstreamBody` (not the numbered acceptance
> probes) was launched **without** a `DATA_DIR` override and therefore opened the
> live `~/.omniroute/storage.sqlite`. Verified afterwards: `PRAGMA integrity_check`
> = `ok`, no migration row has `applied_at >= 2026-10-01`, the newest applied
> migration is still `210` dated `2026-09-24`, and the main DB file mtime was
> unchanged — only the `-wal`/`-shm` sidecars moved, which SQLite does on open.
> The migration-collision message it printed is the #9 *detector* firing, not a
> write. A preserved copy of `storage.sqlite` + sidecars is at
> `~/.jcode/scratch/db-preserve-20261002/`. All subsequent probes set `DATA_DIR`
> explicitly.

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

## Requirement → project-test check

The table above records probe observations at production entry points. This
table records the **project's own test suite** as the check for each
requirement, with an A/B run of the *same test file* on both trees.

Five test files added in the latest round are new on this branch
(`9bb90c0eb7`, `571771db99`, `466633fa2f`, `539a304fbc`, `ef584cd3f1`);
those five are a subset of the branch's 22 branch-new test files. Four of them
close requirements that had zero project-test coverage; the fifth
(`combo-scoped-proxy-guard-13469.test.ts`) was added because the pre-existing
coverage for #6 passed on both trees and proved nothing — see the note below.

| # | Requirement | Project test (check) | Main `843f342556` | Branch | Discriminates |
|---|---|---|---|---|---|
| 1 | Tool limit env-configurable | `tests/unit/operator-env-overrides.test.ts` → "MAX_TOOLS_LIMIT overrides the default" | **fail** — `actual 128, expected 7` (file 3/6, exit 1) | 6/6 pass, exit 0 | yes |
| 2 | Tool-limit bypass ordering | `tests/unit/tool-limit-bypass-ordering-13190.test.ts` → "bypass beats a provider's known tool limit" | **fail** — `actual 200, expected 250` (4 tests 3/1, exit 1) | 4/4 pass, exit 0 | yes |
| 3 | Tool-length limit env-configurable | `operator-env-overrides.test.ts` → "MAX_TOOL_LENGTH caps a single tool result" | **fail** — length exceeds `500+15` | 6/6 pass, exit 0 | yes |
| 4 | PSI pressure policy disable switch | `operator-env-overrides.test.ts` → "PRESSURE_PSI_DISABLED=true neutralises PSI" | **fail** — `actual 'critical', expected 'normal'` | 6/6 pass, exit 0 | yes |
| 5 | `getProviderCredentials` quota helpers | `tests/unit/13483-noauth-model-lockout-enforcement.test.ts` (branch-only file) | **1/4 fail**, exit 1 | 4/4 pass | yes |
| 6 | Combo guard accepts `comboName` | `tests/unit/combo-scoped-proxy-guard-13469.test.ts` | **fail** — `actual false, expected true` (2 tests 1/1, exit 1) | 2/2 pass, exit 0 | yes |
| 7 | Provider-alias dedup in usage history | `tests/unit/usage-alias-canonical-dedup-13459.test.ts` | **fail** — `actual 2, expected 1` (2 tests 1/1, exit 1) | 2/2 pass, exit 0 | yes |
| 8 | Log export streams | `tests/unit/logs-export-streaming-13123.test.ts` (branch-only file) | **2/6 fail**, exit 1 | 6/6 pass | yes |
| 9 | Migration numbering collision repaired | `tests/unit/13326-memory-fts-access-count-no-reindex.test.ts` (branch-only file) | **2/5 fail**, exit 1 | 5/5 pass | yes |
| 10 | OAuth refresh proxy fail-open | `tests/unit/oauth-refresh-proxy-fail-open-13470.test.ts` | **fail** — no guard exists (2 tests 1/1, exit 1) | 2/2 pass, exit 0 | yes |

**Aggregate on the changed test surface** (branch): 25 changed `.ts` files →
**160 tests / 160 pass / 0 fail, exit 0** under the project's `node --test`
runner; 1 changed `.tsx` file → **5/5 pass, exit 0** under the project's
`vitest`. **160 + 5 = 165 tests passing across the two runners the project
configures** (the two-runner split, the single-invocation runner mismatch, and
the flake history are recorded under "Test-suite verification" below).

### Gaps this section closed

Before this round, six requirements had **no** project-test coverage at all.
Measured greps over `tests/` on *both* trees returned:

- `OMNIROUTE_MAX_TOOLS_LIMIT`, `OMNIROUTE_MAX_TOOL_LENGTH`,
  `OMNIROUTE_PRESSURE_PSI_DISABLED` → **0** tests each (requirements 1, 3, 4)
- `bypassDefaultToolLimit` → **0** tests (requirement 2)
- `proxyFailOpen` / `PROXY_FAIL_OPEN` → **0** tests (requirement 10)
- canonical-provider alias dedup → **0** tests (requirement 7)

Their only check was the untracked acceptance probe, which is a custom
harness rather than a production interface. They now run as project tests.

### Known weak check (disclosed, not fixed)

`tests/unit/search-provider-body-13245.test.ts` is a branch-new file that
defines its own local `buildBody()` helper and asserts against that helper.
It never imports `open-sse/handlers/chatCore/upstreamBody.ts` or
`WebSearchExampleCard.tsx`, so it does not exercise any changed source. It is
therefore *not* counted as a check for any requirement above.

> **Round-3 confirmation (2026-10-04):** `search-provider-body-13245.test.ts`
> is confirmed synthetic — it reimplements `buildBody` and never imports the
> component, so it cannot fail on a revert. It is retained as a methodology
> finding, not as coverage. The real covering check is the round-3
> `websearch-example-card-provider-body-13245.test.tsx` in the table above.

### Pre-existing limitation (both trees, not branch-attributable)

The project's own acceptance selector (`test:scoped` /
`select-impacted-tests.mjs`, the local companion to CI's TIA gate) cannot
select tests: `build-test-impact-map.mjs` fails on the undeclared dependency
`tinyglobby`, so the impact map is missing and the selector falls back to
`__RUN_ALL__`. Verified identical on pristine main. Neither tree declares
`tinyglobby`, and this branch changed none of `package.json`, the builder, or
the selector.

### Round-3 regression: chatcore attempt-logging (found and fixed)

Round 3 found one genuine branch regression, in a test rather than in
production. Branch-only commit `de2971ab2b` (2026-09-20, #13481) changed the
call-log primary key from `pendingRequestId` to `traceId`
(`open-sse/handlers/chatCore/attemptLogging.ts`: origin/main:462
`id: pendingRequestId` → HEAD:467 `id: traceId`). The test was byte-identical
to main, supplied no `traceId`, and polled `getCallLogById(pendingRequestId)`.

- **Before fix (branch):** deterministic 2 pass / 4 fail ×3 runs (load
  280–307). Failures at :86 "call log row should be persisted" (actual `null`)
  and :108 / :124 / :135 `assert.ok(row)`.
- **Pristine main:** 6 pass / 0 fail, exit 0, ×2 runs, using the exact
  `package.json` flags.
- **Root cause:** `src/lib/usage/callLogs.ts:513` falls back to
  `generateLogId()` when no `traceId` is supplied. The row **was** persisted
  (probe: CASE A no traceId → lookup `NULL` but a row exists as
  `"1791108392907-1"`; CASE B traceId set → `FOUND`). Production behaviour was
  fine; the test keyed on the old semantics.
- **No upstream fix exists:** the `origin/release/v3.8.51` diff for this file is
  empty vs HEAD and vs `origin/main`.
- **Fix applied (test-only):** supply a per-request `traceId` and poll
  `getCallLogById(traceId)`. 4 tests touched; assertions :86 / :108 / :124 /
  :135 are byte-identical before and after; no counts changed; production
  source untouched. After fix: branch **6 pass / 0 fail**, exit 0, ×2 runs.

#### Round-3 second finding: at-HEAD poll-budget exhaustion (found and fixed)

After the first fix (`2aee1c8a55`, `tries = 120`), a re-run of the same file at
final HEAD still failed — one red against three greens:

- **Failing test:** `tests/unit/chatcore-attempt-logging.test.ts:143:10` —
  `assert.ok(row)`, `actual: null`, observed at **2634.6145 ms**. Raw log:
  `~/.jcode/scratch/athead-test-raw/chatcore-attempt-logging.test.ts.log`
  (summary: 6 tests / 5 pass / 1 fail, `duration_ms` 16022.88).
- **Root cause: poll-budget exhaustion, not a keying defect.** `pollForCallLog`
  budgeted `120 tries × 20 ms = 2400 ms`. `saveCallLog` is async and
  fire-and-forget, so the row lands a tick after `persistAttemptLogs` returns;
  under cold `tsx` spawn plus full-suite SQLite load the write had not committed
  by 2634 ms — the null read is the **expired budget**, not a missing row.
- **Corroborating evidence:** in the *same* raw log the three already-converted
  subtests **passed** while taking **1229.4 / 2138.4 / 2414.7 ms** — all sitting
  at the 2.4 s budget edge. Structural keying failures are deterministic (the
  original bug reproduced 2/4 across 3 runs — see above), so one red against
  three greens at load 276–448 (`athead-test-load.log`: 276.18 → 407.87;
  `athead-gate-load.log` peak 448.91) indicates load sensitivity, not keying.
- **Fix (`86ed0f96b4`, test-only):** widened `pollForCallLog` `tries` 120 → 500
  (2.4 s → 10 s), mirroring the repo-canonical headroom in
  `call-log-save-drain.test.ts` `waitForCallLogSaves(10_000)`, whose own comment
  documents the same ~2.4 s cold-spawn flake. **No assertion changed:** all 4
  `assert.ok(row)` are byte-identical before and after; no test skipped or
  re-counted; production untouched.
- **After fix:** `chatcore-attempt-logging` **6 pass / 0 fail ×2**; plus
  `call-log-save-drain` **2/0** and `model-test-runner` **26/0**.

### Round-3 covering checks for changed public outputs

Round 3 enumerated **43 changed outputs outside `tests/` and `docs/`** (at
final HEAD: `git diff origin/main...HEAD --name-only -- . ':(exclude)tests'
':(exclude)docs'` = 43). Two previously-conflated lists are separated here:

- **UNMAPPED** (rhino) = no covering check exists.
- **UNOBSERVED** (palmtree) = a check exists but was never executed.

**Authoritative Matrix-2 arithmetic (corrected):** **38 OBSERVED-PASS + 3
OBSERVED-FAIL + 0 UNOBSERVED + 2 NO-CHECK-EXISTS = 43.** So **41 of the 43
outputs have an OBSERVED result** and **2 have no covering check at all**. Full
matrix: `~/.jcode/scratch/MATRIX-athead.md`.

- **The 3 OBSERVED-FAILs:** `.env.example` (`check:env-doc-sync` — pre-existing
  on *both* trees); the `changelog.d` fragment (`check:changelog-integrity`, sha
  `2ec60c77` — pre-existing on *both* trees); and `chatcore-attempt-logging`
  (observed fail at HEAD, fixed in `86ed0f96b4` — see the second finding above).
- **The 2 NO-CHECK-EXISTS:**
  - `@omniroute/opencode-plugin/src/index.ts` — `config-shim.test.ts:1285`
    asserts a substring present in *both* the old and new messages, so it cannot
    pin the change.
  - `src/lib/evals/runtime.ts` — see the dedicated note below.

Round 3 executed the remaining checks: `db/proxies/guards.ts` 2/2,
`db/proxyLogs.ts` 6/6, `usage/migrations.ts` 6/6 all pass; the `changelog.d`
fragment is covered by `check:changelog-integrity` (fails pre-existing, above).

**`src/lib/db/proxyLogs.ts` — OBSERVED-PASS, now raw-log backed.**
`tests/unit/logs-export-streaming-13123.test.ts` = **6 pass / 0 fail / exit 0**
(raw log `~/.jcode/scratch/backing-logs-export-streaming-13123.log`). It imports
the **real** route `src/app/api/logs/export/route.ts`, which calls
`countProxyLogsSince` (route:65) and `iterateProxyLogsSince` (route:66),
asserting `totalAvailable = 3` and ordered `px-3`/`px-2` with `limit=2`. Genuine
coverage.

**`src/lib/evals/runtime.ts` — NO-CHECK-EXISTS (tautological test).**
`tests/unit/eval-opt-out-13139.test.ts` does define 3 tests and they pass (**3/0,
exit 0** — raw log `~/.jcode/scratch/backing-eval-opt-out-13139.log`), **but it
never imports `src/lib/evals/runtime.ts`**. It constructs a local
`new Headers({...})` carrying the same literals and asserts on that local object,
so it cannot fail if `runtime.ts` is reverted. It is **tautological** and
therefore provides **no coverage** of the changed lines (`runtime.ts` adds
`x-omniroute-compression: off` and `x-omniroute-no-memory: true` at HEAD lines
198–202). Disclosed as a known gap, with a recommended remedy: replace it with a
test that imports `executeEvalCase`, or extract the header construction into an
exported pure function.

**Correction of an audit premise.** An intermediate audit claimed the two
candidate covering files "define 9 + 4 and 8 tests, not 6 and 3". That is
**wrong** — `grep` and the runner both confirm the files genuinely define
**exactly 6 and 3** tests (`logs-export-streaming-13123.test.ts` → 6;
`eval-opt-out-13139.test.ts` → 3). The real defect was never the count; it was
that `eval-opt-out-13139` is tautological.

**Prior figures withdrawn.** `39/3/0/1` and `37/3/2/1` were **both wrong**;
`38/3/0/2` is authoritative. `39/3/0/1` counted `evals/runtime.ts` as
OBSERVED-PASS on a tautological check (it is NO-CHECK-EXISTS) and treated
`proxyLogs.ts` as merely doc-asserted. `37/3/2/1` moved `proxyLogs.ts` and
`evals/runtime.ts` both to UNOBSERVED — but `proxyLogs.ts` **does** have a raw
per-file log (`logs-export-streaming-13123`, 6/0), so it is OBSERVED-PASS, and
`runtime.ts` is NO-CHECK-EXISTS rather than UNOBSERVED.

Three of rhino's previously-UNMAPPED outputs now have new checks, each verified
**both ways** (branch pass / pristine-main fail for the right reason):

| New test | Output covered | Branch | Pristine main |
|---|---|---|---|
| `tests/unit/memory-anthropic-system-merge-13425.test.ts` | memory injected into a top-level `system` field, not a prepended `role:"system"` message | 4 pass / 0 fail | exit 1, 1 pass / 3 fail — `"system must start with memory context, got: You are a helpful assistant."`; `assert.ok(out.system.startsWith("Memory context: dark mode"))` falsy |
| `tests/unit/db-backup-autoprune-13308.test.ts` | `getDbInstance` prunes `db_backups` after a health-check repair backup | 1 pass / 0 fail | exit 1, 0 pass / 1 fail — `"expected db_backups pruned to 3, saw 7"` (main discards the `runDbHealthCheck` result; zero `cleanupDbBackups` refs; 6 seeded + 1 repair = 7). Spawns a child process because `isAutomatedTestProcess()` blocks in-process `createHealthCheckBackup` |
| `tests/unit/ui/websearch-example-card-provider-body-13245.test.tsx` | websearch example card sends `body.provider === providerId` to `/api/v1/search` | (vitest) 1 pass / 0 fail | exit 1 — `"expected undefined to be 'brave-search'"` (main `buildBody = ({query, max_results})` sends no provider) |

`main-accept` was cleaned up after these A/B runs: porcelain empty, HEAD still
`843f342556`.

## Corrections to earlier claims

- An earlier revision of this document claimed **159** passing assertions for
  the changed test surface. That number was never measured from any run — it was
  fabricated. The total measured at that revision was **149**: 144 across 20
  files under `node --test`, plus 5 from
  `tests/unit/13462-credential-masker-data-uri.test.tsx` under
  `pnpm vitest run`. Corrected in `097b6c5376`. The surface has since grown to
  26 files; the current measured total is **160 + 5 = 165** across the two
  runners the project configures (see "Test-suite verification" below).
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
- **Requirement #6's coverage did not discriminate.** The recovered-behavior
  table records #6 as "arity 2 → 3", an arity observation. The only test
  asserting `PROXY_ASSIGNED_UNAVAILABLE`, `proxy-assigned-unavailable-6246`,
  passes **6/6 on pristine main** — it calls
  `hasBlockingProxyAssignment(connId)` with one argument and never asserts the
  `#13469` combo scoping. It therefore proved nothing about #6.
  `combo-scoped-proxy-guard-13469.test.ts` was added and fails on main with
  `actual false, expected true`.
- **A first draft of the #2 bypass test passed on both trees and proved
  nothing.** It used provider `openai`, which has no entry in
  `PROVIDER_TOOL_LIMITS`, so `getKnownToolLimit` returns `null` and the
  ordering difference never manifests. It was rewritten against `grok-cli`
  (limit `200`) *before* being committed; the commit message for
  `571771db99` records the false start. Had it been committed as-is it would
  have been counted as a check it cannot perform.
- **A throwaway probe opened the live `~/.omniroute` database** because it was
  launched without a `DATA_DIR` override. See the correction block at the top
  of this document for the verification that nothing was written.
- Stale counts in "Test-suite verification" (67 files / 21 tests / 149
  assertions) predated the five newly added test files; file counts corrected
  to 72 / 46 / 26 (22 branch-new); assertion totals have since been re-measured
  — 160 + 5 = 165 across the two runners (see below).
- **"The first chatcore fix was incomplete" is WITHDRAWN (2026-10-07).** An
  orchestrator intermediate message stated the first chatcore fix
  (`2aee1c8a55`) was "incomplete" because assertion `:143` was not converted.
  That is not correct: `2aee1c8a55` had **already** converted the fallback
  subtest, and every row-read site (`:86`, `:110`, `:130`, `:142` at that
  revision) already polls the supplied `traceId`. The `:143` failure was
  **poll-budget exhaustion** (see the second chatcore finding above), not a
  missed conversion. The flake diagnosis was correct; the "incomplete fix"
  assertion was not.
- See **Pre-existing pnpm lockfile inconsistency** (Host hazard section) for the
  lockfile regeneration, postinstall failure, and operator-authorized resolution.

## Test-suite verification

### At-head verification (final HEAD)

Re-run of the complete changed test surface at final HEAD, one process per file
with the project's real runners. The runs were captured at HEAD `e759cdd8ff`;
the only later commit, `86ed0f96b4`, is the **test-only** poll-budget widening of
the second chatcore finding (it touches no source and no gate), so the figures
below hold for final HEAD `86ed0f96b4` too.

- **All 30 changed test files run at final HEAD** (`git diff origin/main...HEAD
  --name-only` filtered to `^tests/` = 30, **exactly matching** the TSV below):
  **29 exit 0, 1 exit 1** (chatcore-attempt-logging), **0 timed out**. Total
  **176 tests passed / 1 failed** = 177 tests: 170 pass + 1 fail under
  `node --test` (28 `.ts` files) and 5 + 1 pass under `vitest` (2 `.tsx` files).
  Source: `~/.jcode/scratch/athead-test-results.tsv` (30 rows),
  `~/.jcode/scratch/athead-test-raw/*.log`. The final-HEAD surface is 30 test
  files (28 `.ts` + 2 `.tsx`), 25 branch-new; earlier rounds in this document
  record 26, the pre-coverage-fix surface.
- **All 8 quality gates at final HEAD, ZERO deviation from the recorded
  baseline:** `typecheck:core` rc=0 / 0 errors; `check:known-symbols` rc=0;
  `check:open-sse-typecheck` rc=1 / 201 errors / 79 entries; `check:env-doc-sync`
  rc=1 / 42+6; `check:file-size` rc=1 / 15+22 = 37; `check:dead-code` rc=1 /
  `DEAD_TOTAL=1023`; `check:migration-numbering` rc=1 / 1 obsolete (`121`);
  `check:changelog-integrity` rc=1 / removed 20 + added 20.
  Source: `~/.jcode/scratch/athead-gate-results.txt`.
- **Packaging guard at HEAD:** `git diff origin/main...HEAD -- package.json
  pnpm-lock.yaml .github` = **EMPTY** (0 lines).

`pnpm test` on the branch: 21,398 tests, 18,323 pass, 234 fail, 2,823
cancelled. This is a **pre-existing figure whose provenance is not recorded
in this document**, and it is labelled **unverified**: the listed components
sum to 18,323 + 234 + 2,823 = 21,380, i.e. 18 short of the stated 21,398
total. The 18-test gap is unexplained, and no run log for that figure is
preserved in this repository, so it is not corrected here — there is no
evidence for any replacement value, and no reader should treat it as
measured. A raw fail count is not evidence of a branch regression on its
own, so both trees were compared directly.

**Changed test surface.** The branch touches 72 files vs `origin/main`: 46
non-test files and 26 test files (25 `.ts`, 1 `.tsx`), 22 of them branch-new
(absent on main). The five test files added in the latest round are
`tests/unit/operator-env-overrides.test.ts`,
`tests/unit/tool-limit-bypass-ordering-13190.test.ts`,
`tests/unit/usage-alias-canonical-dedup-13459.test.ts`,
`tests/unit/oauth-refresh-proxy-fail-open-13470.test.ts` and
`tests/unit/combo-scoped-proxy-guard-13469.test.ts`. The changed-test file set,
derived by `git diff main...HEAD --name-only` filtered to test files, is exactly
**26 files = 25 `.ts` + 1 `.tsx`**. Measured totals for that surface:

- The 25 `.ts` files run together under the project's real runner — the
  `package.json` `"test"` script, `cross-env DISABLE_SQLITE_AUTO_BACKUP=true
  node --max-old-space-size=8192 --import tsx/esm --import
  ./open-sse/utils/setupPolyfill.ts --import ./tests/_setup/isolateDataDir.ts
  --test --test-force-exit --test-concurrency=4` — give **160 tests, 10 suites,
  160 pass, 0 fail, 0 skip, exit 0** (two independent runs: one 89523.2ms, one
  part of a 52592.5ms run).
- `tests/unit/13462-credential-masker-data-uri.test.tsx` is a `.tsx` file that
  `node --test` cannot run; under its configured runner (`vitest.config.ts`) it
  is **5 passed / 5, exit 0**.
- Effective result: **72 changed files / 46 non-test / 26 test files (22
  branch-new); 160 + 5 = 165 tests passing, across two runners, because the
  project configures them that way.**

**One `node --test` invocation over all 26 files is not green, and the reason
matters.** That single invocation gives **161 tests / 160 pass / 1 fail**, where
the single failure is that `.tsx` file throwing `TypeError: Cannot read
properties of undefined (reading 'config') at initSuite in
@vitest/runner/dist/chunk-artifact.js` — a vitest-managed file being executed by
`node --test`. It reproduces in isolation under `node --test` (1 test, 1 fail)
and passes 5/5 under vitest. It is a **runner mismatch, not an assertion
failure**, which is why the honest combined figure is the two-runner split
above rather than a single number.

**Flakiness history (recorded, not suppressed).** An earlier aggregate run under
host load ~500 saw `tests/unit/combo-scoped-proxy-guard-13469.test.ts` fail
both cases with a 157s first case. A captured re-run (`full-suite-run.log`)
instead showed **159/160** with the sole failure
`tests/unit/responses-error-reframe-13431.test.ts` line 103 ("should contain a
data: line with type:error"), max per-test duration 6867ms, total `duration_ms`
226905.9, and both #13469 cases passing (1120.6ms / 1088.7ms). Isolated
re-runs: #13431 alone **5 pass / 0 fail** (11.98ms); #13469 alone **2 pass /
0 fail**. A 25-file aggregate re-run then gave **160/160, exit 0**. The final
run executed at load 512.45/366.60/245.41 before and 282.60/335.16/271.27
after and still gave **160/160** on the `.ts` set. Classification:
**load/ordering-dependent flake, not a branch-attributable defect.**

**Round-3 explanation of the load-driven flake (inferred, not reproduced under
controlled load).** Wall-clock balloons under host load: the combo-scoped test
went 1.1s → 958s, and the tool-limit test took 93s at load ~400–800; the
round-3 gate runs saw load 210 → 360. This independently explains the
historical flake reports (the 157s runs, and the 159-of-160 reading). The
mechanism is stated as an inference from correlated load and duration
observations, not as a controlled reproduction.

**Round-3 failure-mode evidence.** Determinism: **15/15** (5 files × 3 runs).
Live-DB isolation: **PASS** — the live `storage.sqlite` was unchanged
(`2605056` bytes / Oct 1 19:58:06). Packaging: **PASS** — across the 50
commits, zero hits in `package.json`, `pnpm-lock.yaml`, or `.github`.

**Route ledger (round 3, recorded honestly, not editorialised).**
`mimo-v2.6-flash` failed **5 of 5** spawned workers (hippo, piglet, mushroom,
clover, cactus — stream errors / send failures). The operator fallback ladder
then advanced **one rung** to `opencode-go:deepseek-v4.1-flash`, which served
every successful round-3 deliverable. There was no silent advancement.

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

- The **entire** changed test surface is green (160 + 5 = 165 across the two
  runners the project configures), which is exhaustive, not sampled. A branch
  change that broke an existing test would almost certainly surface in a test
  that directly covers the changed module.
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

### Worktree loss and recovery (2026-10-08)

On 2026-10-08 ~01:07 both working directories
(`~/.jcode/scratch/omniroute-cherry-v2` and `~/.jcode/scratch/main-accept`) were
found **MISSING** — `cd` failed with "No such file or directory". The cause was
not determined (this session performed no deletion; a prior cleanup process is
suspected).

- **No commits were lost.** Git worktrees share the parent repo's object store,
  and the branch ref lives in the parent repo
  `/Users/kooshapari/CodeProjects/Phenotype/repos/OmniRoute`. Verified: branch
  tip `86ed0f96b4`, 54 commits ahead of `origin/main`; `main` and `origin/main`
  both still `843f342556`.
- **The branch worktree was recreated at the same path** (`git worktree add`
  after `git worktree prune`): HEAD `86ed0f96b4`, 54 commits, this doc 553
  lines, `git status --porcelain` empty — matching the pre-loss state exactly.
- **Re-created worktrees and `node_modules`:** Both worktrees were re-created
  after the 2026-10-08 disappearance. Operator-authorized
  `pnpm install --no-frozen-lockfile` restored `node_modules` (3.7 G, 138
  top-level entries) and the test runners (`.bin/tsx`, `.bin/vitest` present in
  both worktrees). `pnpm-lock.yaml` is locally modified in both; `package.json`
  untouched. `pnpm` exits `1` due to upstream FFI postinstall failures (see
  "Pre-existing pnpm lockfile inconsistency" below).
- **CAUTION:** the parent repo's own checkout is **dirty** with many unrelated
  modified files (`.cbmignore`, `.coderabbit.yaml`, `.dockerignore`,
  `.env.example`, `.github/*`, …). Those are **not ours**; this session never
  worked in the parent repo. Do not touch or clean them.
- **Subsequent event, 2026-10-08 ~07:09:** the pristine-main comparison
  worktree (`/Users/kooshapari/.jcode/scratch/main-accept`) ALSO disappeared, in
  addition to the branch worktree already re-created at 01:13. Two worktrees
  lost in ~6 hours points to a recurring cleanup or pruning process, not a
  one-off. In both cases the ref and objects survived in the parent repo; only
  the working directories vanished.
- The pristine-main worktree was re-created via
  `git worktree add /Users/kooshapari/.jcode/scratch/main-accept origin/main`
  after `git worktree prune`. Verified: HEAD `843f342556` (detached), porcelain
  empty, standard OmniRoute layout, `node_modules` absent (consistent with the
  freshly-re-created branch worktree state).
- The worktree list at that moment held **3** pre-existing entries (parent +
  `omniroute-cherry-v2` [our branch, still tracked] + `use-pheno-otel`), not 2;
  `omniroute-cherry-v2` was correctly registered and was not double-added.
- After both worktrees were re-established, both were missing `node_modules`
  (lost in the disappearance). Operator authorized
  `pnpm install --no-frozen-lockfile` in BOTH worktrees to restore the dev
  environment. The verbatim install figures appear in the re-created-worktree
  disclosure above and in "Pre-existing pnpm lockfile inconsistency" below.

### Pre-existing pnpm lockfile inconsistency

At the start of the 2026-10-08 restoration, `pnpm install --frozen-lockfile`
failed with `ERR_PNPM_OUTDATED_LOCKFILE` because `package.json` declared
`oxlint@^1.61.0` (a devDependency at line 438, with `lint:oxlint` scripts at
lines 280-281) but `pnpm-lock.yaml` had **0** oxlint references.

This inconsistency is **pre-existing on `origin/main` (`843f342556`)** itself: a
fresh `git show origin/main:package.json | grep -n oxlint` returns 3 hits (lines
280, 281, 438) and `git show origin/main:pnpm-lock.yaml | grep -c oxlint`
returns 0. A fresh clone of main would therefore also fail `--frozen-lockfile`.
The cherry-pick `e16215e01c` (`chore(lint): add oxlint config and oxlint-disable
comments`) is a net no-op versus main: main already carried the same
`package.json` state at `843f342556`; merely `pnpm-lock.yaml` was never
regenerated to match.

- **Resolution:** operator authorized `pnpm install --no-frozen-lockfile` in both
  worktrees. Branch worktree: `pnpm-lock.yaml` +229 lines, +62 oxlint
  references, `package.json` UNTOUCHED (per `git status --porcelain`).
  `main-accept`: same numbers, same single-file diff. Both installs took ~120-160
  s wall time and the test runners (`.bin/tsx` and `.bin/vitest`) materialized
  correctly.
- **CAVEAT:** the install exit code is `1` in both worktrees due to postinstall
  scripts of 5 upstream FFI packages (`omniroute-ffi-darwin-arm64`,
  `-darwin-x64`, `-linux-arm64-gnu`, `-linux-x64-gnu`, `-win32-x64`) failing
  under Node 26. Each has a `scripts/postinstall.mjs` that uses CJS
  `require("node:fs")` inside an ESM `.mjs` file, producing `ReferenceError:
  require is not defined in ES module scope`. This is an upstream package bug,
  not caused by our work, and only affects the FFI packages' build phase — the
  unit-test runners are functional. The root-project postinstall (playwright-core
  Android patch, sql.js/node-machine-id copies, LLMLingua co-location) SUCCEEDED
  in both worktrees. A `pnpm install --ignore-scripts` would exit 0 if a clean
  postinstall status is needed.
- **Session-local artifact:** this lockfile regeneration is a session-local
  artifact; `pnpm-lock.yaml` is currently modified in the worktree but is NOT
  part of this commit. Whether to commit it is an operator decision — committing
  would propagate the regeneration to `origin/main` (which is itself in the same
  broken state, so a no-op in practice) and remove the dirty-status warning; not
  committing leaves the session-local fix.

### Round-3 product defect: `call_logs` writes into the LIVE data dir

A second, more serious live-directory exposure was found in round 3. Two test
JSON files were written into the **live** `~/.omniroute/call_logs/2026-10-02`
(919 B + 797 B, account `"model-test-timeout-regression"`, `schemaVersion` 5,
`gpt-4o`, a 200 warm-up plus a 504 at `timeoutMs:1000`). The content is proven
to come from `tests/unit/model-test-runner.test.ts:236-237`.

- **Writer:** `src/lib/usage/callLogArtifacts.ts:275`; the directory resolves
  via `callLogArtifacts.ts:10-12` → `dataPaths.ts:64 getDefaultDataDir()` →
  legacy `~/.omniroute`.
- **Root cause:** the #10428 test-context guard exists **only** in
  `resolveWritableDataDir` (`dataPaths.ts:130-168`, used by the DB at
  `db/core.ts:122`) — `call_logs` are **not** protected. Leak vectors: the
  `test:coverage:legacy` npm script (`c8 … node --import tsx/esm --test
  tests/unit/*.test.ts`) never injects `isolateDataDir.ts`, plus bare
  `node --test`.
- **Attribution limit:** session attribution **cannot prove** which session
  wrote them.
- **Recommendation:** apply the same guard to `callLogArtifacts`.
- **Status:** the two stray JSON files are **left in place pending operator
  approval** (deletion is destructive and was not performed).

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

### Round-3 gate stability (32 runs, 2026-10-04)

The table above rests on a single reading per gate. Round 3 re-ran **8 gates ×
2 trees × 2 repeats = 32 runs**: **0 timeouts, 0 skips, 0 instability, Phase 3
never triggered, longest run 181s.** Every reading reproduced, so the deltas
below are **stable deltas**, not one-off noise.

| Gate | Main | Branch | Round-3 class |
|---|---|---|---|
| `typecheck:core` | **rc=2, 27 errors** in `src/sse/services/auth.ts` (TS2304 ×24, TS18004 ×1, TS2552 ×2) | **rc=0, 0 errors** | stable-delta, favours branch |
| `check:open-sse-typecheck` | 228 errors / 82 entries | 201 errors / 79 entries | stable-delta, favours branch |
| `check:env-doc-sync` | 636 code / 795 env / 818 docs, rc=1, violations 42+6 | 638 / 798 / 821, rc=1, violations 42+6 | stable-delta on raw counts only |
| `check:file-size` | rc=1, 15 src + 22 test = 37 | identical | no delta |
| `check:dead-code` | rc=1, `DEAD_TOTAL=1023` | identical | no delta |
| `check:migration-numbering` | rc=1, 1 obsolete allowlist entry (`121`) | identical | no delta |
| `check:changelog-integrity` | rc=1, 20 removed / 20 added, sha256 `2ec60c77` | identical | no delta (pre-existing, see below) |
| `check:known-symbols` | rc=0 (135 exec / 21 strat / 17 pairs / 96 tools / 6 a2a / 4 cloud) | identical | no delta |

**Overall: no gate that pristine main passes fails on the branch.**

The `typecheck:core` and `check:open-sse-typecheck` deltas share one cause,
now pinned: `export { x } from "./authQuota.ts"` creates **no local binding**,
so `auth.ts` (which also *uses* the helpers) does not typecheck on main. The
branch's commit `8233223814` (auth.ts +23/−4) adds a real
`import { ... }`, removing exactly 27 errors (24 + 1 + 2 = 228 − 201) and 3
frozen-baseline entries (82 − 79). `8233223814` is confirmed an ancestor of
branch HEAD and **not** of main HEAD.

### `check:changelog-integrity` is pre-existing and out of scope (round 3)

`check:changelog-integrity` fails **identically on pristine main** (rc=1, same
20 removed / 20 added, sha256 `2ec60c77`). Proven independently: `CHANGELOG.md`
does not appear in `git diff origin/main...HEAD`, no branch commit touches it,
`config/release/changelog-reconciliations.json` is unchanged, and the check's
other input is the shared ref `origin/release/v3.8.51`. This "changelog-eat" is
a pre-existing repo condition, not branch-attributable.

### `check:known-symbols` read hazard (round 3)

Clarified: the `DATA_DIR` redirect **is** honoured for the database, but this
gate resolves a plugin-scan directory from `HOME` and **reads**
`~/.omniroute/plugins`. The exposure is read-only, not a write. Every gate run
logged a scratch `storage.sqlite`; the live DB mtime (`1790877486`) and size
(`2605056`) were unchanged before and after, and no file under `~/.omniroute`
was newer than session start.

## Conclusion

Every recovered behavior has an observed main-vs-branch difference at a
production entry point, and no quality gate is worse on the branch than on
pristine main. The complete changed test surface is green (160 + 5 = 165 across the two runners the project configures).

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

Round 3 (2026-10-04) strengthens and extends this record:

- **Gate stability proven.** 32 runs (8 gates × 2 trees × 2 repeats) with 0
  timeouts / 0 skips / 0 instability; every delta reproduced as a stable delta.
  No gate that pristine main passes fails on the branch.
- **`changelog-eat` classified pre-existing and out of scope** — it fails
  identically on pristine main for a shared-ref reason, and no branch commit
  touches `CHANGELOG.md`.
- **One branch regression found and fixed** (test-only): chatcore
  attempt-logging keyed on `pendingRequestId`, which `de2971ab2b` renamed to
  `traceId`; now 6/0.
- **Coverage of changed public outputs, corrected: 38 OBSERVED-PASS + 3
  OBSERVED-FAIL + 0 UNOBSERVED + 2 NO-CHECK-EXISTS = 43** (41 observed). The 3
  FAILs are `.env.example` and the `changelog.d` fragment (both pre-existing on
  both trees) and `chatcore-attempt-logging` (observed fail at HEAD, fixed in
  `86ed0f96b4`). The 2 NO-CHECK-EXISTS are `opencode-plugin/src/index.ts` and
  `src/lib/evals/runtime.ts` (the latter's `eval-opt-out-13139` test is
  tautological). Prior figures `39/3/0/1` and `37/3/2/1` are withdrawn.
- **At-head verification:** 30 changed test files / 29 exit 0 / 1 exit 1 (that
  one now fixed); 8 quality gates with zero deviation from baseline; packaging
  guard empty. See "Test-suite verification".
- **One live-directory product defect disclosed, not fixed:**
  `call_logs` writes into `~/.omniroute` because the #10428 guard covers only
  the DB path. Two stray test JSONs are left in place pending operator
  approval.

Commits are local on `feat/release-line-gap-recovery-v2-20260924`; nothing has
been pushed.
