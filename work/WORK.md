# OmniRoute / Phenotype Work Ledger

[OmniRoute:!, RootRecovery:!, RouterEval:P, PhenoCI:!, AgilePlus:~, Substrate:ok, Tracaera:?, Vercel:~]

This is the canonical handoff file for the polyrepo work queue. Other Markdown handoff files in
`work/` are superseded once their durable content is merged here. Future agents should read and
update this file directly instead of creating parallel `codex_*`, `*_handoff`, `forward-dag`, or
`FULL_LOCAL_DAG` Markdown ledgers.

State symbols:

| symbol | meaning |
|---|---|
| `ok` | verified clean or complete in current evidence |
| `~` | active or partially complete |
| `!` | active blocker or failing gate |
| `P` | parked until prerequisite changes |
| `?` | needs fresh state refresh |

## Current Objective

Run the AgilePlus/Phenotype long-horizon repo DAG continuously: keep a cockpit tick with top repo
bracket, advance scoped lanes across dashboard cleanup, cockpit bridge automation, lifecycle and
review-loop regression coverage, targeted validation, dirty-tree containment, commit preparation,
and handoff/push when feasible. Use subagents when slots are available and fold results back into
this DAG.

## Canonical Rules

1. `work/WORK.md` is the single active Markdown ledger.
2. Do not create new scratch handoff Markdown files in `work/` unless the operator explicitly asks.
3. If another agent leaves a temporary handoff, semantically merge it here and remove the temporary
   Markdown file.
4. Treat current worktree, CI, PR, and command output as authoritative over this ledger.
5. Preserve shared dirty work. Do not revert files unless the operator explicitly asks.
6. Keep root-agent work in manager mode: delegate where useful, verify locally, then synthesize.
7. Keep cockpit output compact: top bracket, progress tree, DAG, agents table, next questions.

## Current Evidence Snapshot

### Root OmniRoute checkout

- Repo: `/Users/kooshapari/CodeProjects/Phenotype/repos`
- Branch: `fix/caddy-lb-policy-forwarded-headers`
- Branch relation: behind `origin/fix/caddy-lb-policy-forwarded-headers` by 144 commits at last
  refresh.
- Dirty files seen in the shared root checkout:
  - `open-sse/handlers/chatCore.ts`
  - `src/app/.well-known/agent.json/route.ts`
  - `src/lib/a2a/taskExecution.ts`
  - `src/lib/db/migrationRunner.ts`
  - deleted `src/lib/db/migrations/100_cli_access_tokens.sql`
  - deleted `src/lib/db/migrations/100_tenant_quotas.sql`
  - deleted `src/lib/db/migrations/101_api_key_usage_limits.sql`
  - deleted `src/lib/db/migrations/102_compression_engines_map.sql`
  - deleted `src/lib/db/migrations/103_strip_legacy_combo_config_keys.sql`
  - deleted `src/lib/db/migrations/104_normalize_database_cache_size.sql`
  - deleted `src/lib/db/migrations/105_usage_history_endpoint.sql`
- Treat the above as shared/possibly other-agent work until inspected. Do not revert.

### Root recovery evidence

- Root compile-level restore had previously made these checks green:
  - `typecheck:core`
  - `typecheck:noimplicit:core`
- Fresh subagent evidence found the first live blocker is now missing export
  `isForbiddenCustomHeaderName` from `src/shared/constants/upstreamHeaders.ts`.
- The failed import is triggered through:
  - `src/shared/validation/schemas/misc.ts`
  - `src/shared/validation/schemas/apiV1.ts`
  - `src/shared/validation/schemas/auth.ts`
  - `src/shared/validation/schemas/proxy.ts`
- Typecheck suggested the current replacement name is `isForbiddenUpstreamHeaderName`.
- Root DB lane still has a separate migration-numbering failure:
  - `node scripts/check/check-migration-numbering.mjs`
  - reports gaps `002-039` missing.
- Focused root test that passed:
  - `npm exec --yes tsx -- --test --test-concurrency=1 tests/integration/agent-skills-discovery.test.ts`
- Do not use the Node test runner for Vitest files. The attempted e2e command failed because
  `tests/e2e/protocol-clients.test.ts` and `tests/e2e/ecosystem.test.ts` import Vitest APIs.

### RouterEval / PR 6071 evidence

- PR: `https://github.com/diegosouzapw/OmniRoute/pull/6071`
- State at last refresh: closed, not merged.
- Base: `release/v3.8.44`.
- Head branch: `fix/router-eval-retained-optimization-gate-clean`.
- Head OID: `fb14b9fd2f5eba470c045c99ae393a21c68baf2a`.
- Merge state: `DIRTY` / `CONFLICTING`.
- Expected temp worktree `/tmp/omniroute-router-eval-clean.y0Yvkq` is missing.
- Available `/Users/kooshapari/CodeProjects/Phenotype/repos/OmniRoute` is on unrelated branch
  `fix/quality-dead-code-baseline-4436` with untracked `native-clients/`; not a safe PR6071 worktree.
- Failed old checks:
  - `Fast Quality Gates`: complexity/file-size ratchet.
  - `Unit Tests fast-path (1/2)`: opencode target mismatch and context-window filtering failures.
  - `dast-smoke`: `/api/keys/{id}/devices` 401 schema mismatch and TRACE 500 vs expected 405.
- Lane is parked until a clean PR6071 worktree is recreated and the PR policy is clarified.

### Pheno / AgilePlus evidence

- Repo: `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno`
- Branch: `chore/agileplus-preserve-cockpit-tracaera-2026-07-03`
- Head at last refresh: `db81078 fix: finish git2 0.21 migration`
- Remote matched origin and tree was clean at last refresh.
- PR #258 matrix was broadly red.
- Branch-caused CI blockers:
  - `cargo-deny` checkout regression: workflow used `submodules: recursive`; checkout aborts on
    private/missing submodule `Cmdra`.
  - `otlp-smoke` fails because root workspace references
    `agileplus/crates/agileplus-dashboard` but checkout does not provide `agileplus`.
  - `.github/workflows/ci.yml` uses unresolved pinned action SHAs for
    `arduino/setup-protoc` and `dtolnay/rust-toolchain`.
- Baseline/broader debt:
  - `verify`: `cargo fmt` failed, clippy failed, and `ruff` was not found.
  - Full recursive checkout is not viable without private submodule credentials or an allowlist.
- Immediate fix direction:
  - Remove full `submodules: recursive` from broad workflow checkouts.
  - Initialize only the `agileplus` submodule in jobs that truly need root workspace cargo metadata.
  - Replace unresolved action SHAs with valid tags or valid SHAs.

## Forward DAG

```text
WORK-LEDGER
|- CANONICAL-WORK-MD [done]
|  |- merge durable handoff content [done]
|  |- remove colliding markdown handoffs [done]
|  `- verify no scratch markdown remains [done]
|
ROOT-RECOVERY
|- DIRTY-TREE-CONTAINMENT [active]
|- HEADER-EXPORT-BLOCKER [done]
|  |- inspect upstreamHeaders naming
|  |- current state already exports isForbiddenCustomHeaderName
|  `- typecheck:core green
|- PROXY-ASSIGNMENTS-SCHEMA [done]
|  |- add proxy_assignments bootstrap to 040_oneproxy_proxy_fields.sql
|  `- rerun focused proxy-management route test
|- DB-MIGRATION-NUMBERING [next]
|  |- inspect deleted 100-105 migrations
|  |- reconcile check-migration-numbering gaps
|  `- rerun migration numbering check
|- A2A-CONTRACT-RECHECK [queued]
|- KIRO-BEHAVIOR-REPAIR [queued]
|- CHAT-HELPER-REPAIR [queued]
`- ROOT-WIDER-GATE [blocked-on-focused-fixes]

PHENO-CI
|- CHECKOUT-STRATEGY-REPAIR [active]
|  |- remove broad recursive submodules
|  |- add targeted agileplus submodule init where required
|  `- validate workflow diffs
|- ACTION-PIN-REPAIR [active]
|- PR258-CHECK-POLL [blocked-on-push]
`- BASELINE-DEBT-CLASSIFICATION [queued]

ROUTER-EVAL-PR6071
|- PR-CLOSED-CONFLICTING [parked]
|- CLEAN-WORKTREE-RECREATE [needed-before-work]
`- CI-LOG-REVALIDATION [blocked-on-worktree]

AGILEPLUS-RUNTIME
|- COCKPIT-BRIDGE-AUTOMATION [queued]
|- LIFECYCLE-REVIEW-LOOP-REGRESSION [queued]
`- DASHBOARD-CLEANUP [queued]

POLYREPO-STATE
|- OWNER/DEP-TREE [queued]
|- REPO-GRADE-RUBRIC [queued]
|- CI-HEALTH-ROLLUP [queued]
`- DEPLOY/PUBLISH/INSTALL-ROLLUP [queued]
```

## Task Ledger

### A. Ledger canonicalization

1. Done: replaced the stale mixed `WORK.md` content with this canonical merged ledger.
2. Done: removed superseded Markdown handoff files from `work/`.
3. Done: kept `work/agileplus-work.db` untouched.
4. Done: verified `find work -maxdepth 1 -type f -name '*.md'` returns only `work/WORK.md`.
5. Done: `git status --short work` did not report tracked changes, which means the removed handoff
   Markdown files and replacement ledger are not tracked in the root git index.

### B. RootRecovery lane

6. Done: inspected `src/shared/constants/upstreamHeaders.ts`; current state already exports both
   `isForbiddenUpstreamHeaderName` and `isForbiddenCustomHeaderName`.
7. Done: confirmed validation schemas import the current exports.
8. Done: no alias patch needed; semantics differ intentionally (`custom` also blocks auth headers).
9. Done: focused route test exposed the real next blocker, missing `proxy_assignments` in fresh
   isolated DB bootstrap.
10. Done: added `proxy_assignments` table and indexes to `040_oneproxy_proxy_fields.sql`.
11. Done: reran the focused proxy-management route test:
    `npm exec --yes tsx -- --import ./open-sse/utils/setupPolyfill.ts --import ./tests/_setup/isolateDataDir.ts --test --test-force-exit tests/unit/proxy-management-v1-route.test.ts`
    and it returned `ok`.
12. Done: reran `npm run typecheck:core`; it returned `ok`.
13. Inspect deleted migration files `100-105` before touching migration numbering.
14. Run `node scripts/check/check-migration-numbering.mjs`.
15. Reconcile missing migration-number gaps without reverting shared user edits.
16. Rerun the migration numbering check.
17. Reproduce `chat-helpers` assertions after import and migration blockers clear.
18. Reproduce Kiro translator failures after import and migration blockers clear.
19. Recheck `.well-known/agent.json` and A2A skill surface after root fixes.
20. Run `oxlint` or the repo's preferred lint on touched TS files.
21. Keep root branch commit preparation separate from Pheno CI edits.

### C. Pheno CI lane

21. Inspect current workflow files in `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno`.
22. Remove broad `submodules: recursive` from workflow checkouts that do not need every submodule.
23. Add targeted `agileplus` submodule init only to jobs that run root workspace cargo commands:
    `git submodule sync -- agileplus`
    `git submodule update --init --depth 1 -- agileplus`
24. Patch `.github/workflows/cargo-deny.yml`.
25. Patch `.github/workflows/cargo-semver-checks.yml`.
26. Patch the Rust lint / cargo workspace portions of `.github/workflows/sast-quick.yml`.
27. Patch `.github/workflows/ci.yml` cargo workspace jobs only.
28. Replace unresolved `arduino/setup-protoc` pin with a valid tag or verified SHA.
29. Replace unresolved `dtolnay/rust-toolchain` pins with valid tags or verified SHAs.
30. Run `git diff --check` in `pheno`.
31. Run a lightweight workflow grep to confirm no broad recursive checkout remains in broad jobs.
32. Commit Pheno workflow repair if the diff is scoped and validation passes.
33. Push Pheno branch if network and branch policy allow.
34. Poll PR #258 checks after push.
35. Classify remaining failures as branch-caused or baseline debt.

### D. RouterEval lane

36. Do not continue in `/Users/kooshapari/CodeProjects/Phenotype/repos/OmniRoute` unless it is first
    converted to a safe PR6071 worktree.
37. Recreate a clean worktree for `fix/router-eval-retained-optimization-gate-clean` if this lane is
    explicitly resumed.
38. Refresh PR #6071 state before any edits.
39. If the PR remains closed, confirm whether to reopen or preserve work as branch-only evidence.
40. Pull current logs only after a fresh run exists.
41. Resolve conflicts against `release/v3.8.44` only in a clean worktree.
42. Rerun complexity and focused unit gates after conflict repair.

### E. AgilePlus runtime lane

43. Re-run cockpit bridge tests after Pheno workflow repair.
44. Keep async cockpit emission and blocking waiter emission separated.
45. Add regression coverage for the review-loop final status poll.
46. Promote the manual dogfood lifecycle into an automated integration test if feasible.
47. Keep dashboard warnings as non-blocking unless they hide runtime failures.
48. Verify `/api/dashboard/cockpit` and `/api/dashboard/snapshot` contract with a fresh run.
49. Preserve the working dogfood path: specify -> research -> plan -> implement -> approved/done.

### F. Polyrepo cockpit lane

50. Build a repo ownership index across OmniRoute, pheno, AgilePlus, Substrate, Tracaera, and
    phenotype-registry.
51. Add cross-project dependency edges to the cockpit tree.
52. Define repo grades using evidence:
    - CI health
    - dirty tree state
    - PR/branch state
    - validation freshness
    - deploy/publish readiness
53. Keep top bracket as the first line of every cockpit tick.
54. Use compact non-emoji symbols or ASCII where possible.
55. Include `agent | task | state | summary` in substantive status outputs.

## Superseded Markdown Handoffs

The following files were used as source material or stale evidence and should not remain active
Markdown ledgers after this merge:

- `work/codex_long_horizon_handoff.md`
- `work/root.md`
- `work/forward-dag.md`
- `work/root-codex-handoff-2026-07-04.md`
- `work/2026-07-04-root-agent-omniroute-pr287-ci-handoff.md`
- `work/2026-07-04-tracera-agileplus-native-oci-handoff.md`
- `work/2026-07-03-root-agent-omniroute-router-eval-handoff.md`
- `work/FULL_LOCAL_DAG.md`
- `work/2026-07-04-root-agent-long-horizon-ownership-dag.md`

## Agent Notes

| agent | task | state | summary |
|---|---|---|---|
| root | canonical ledger merge | working | replacing colliding handoffs with single `WORK.md` |
| pheno_ci_state | PR258 CI refresh | done | found recursive-submodule and unresolved-action-pin blockers |
| router_eval_state | PR6071 refresh | done | found PR closed/conflicting and missing temp worktree |
| root_recovery_state | root blocker refresh | done | found missing `isForbiddenCustomHeaderName` export as first blocker |

## Next Owner Prompt

```text
Resume from `/Users/kooshapari/CodeProjects/Phenotype/repos/work/WORK.md`. First verify that it is
the only Markdown ledger in `work/`. Then continue the Pheno CI workflow repair or RootRecovery
header-export blocker, whichever is least likely to collide with active dirty work. Keep cockpit
ticks with the top repo bracket and fold any subagent findings back into `WORK.md`.
```

## 2026-07-04 Root OmniRoute Recovery Checkpoint

### State Bracket

`[pheno:✓, AgilePlus:◐, Substrate:✓, Tracaera:◐, phenotype-registry:◐]`

### Verified Green Gates

- Migration prefix uniqueness: no duplicate numeric prefixes under `src/lib/db/migrations`.
- Proxy family migration gate:
  `npm exec --yes tsx -- --test --test-concurrency=1 tests/unit/proxy-family-migration.test.ts`
  returned `ok`.
- A2A/Kiro target gate:
  `npm exec --yes tsx -- --test --test-concurrency=1 tests/unit/agent-card-route.test.ts tests/unit/listCapabilities-a2a.test.ts tests/unit/mitm-targets-resolve.test.ts tests/unit/mitm-handler-kiro.test.ts`
  returned `ok`.
- Kiro translator/chat helper gate:
  `npm exec --yes tsx -- --test --test-concurrency=1 tests/unit/translator-openai-to-kiro.test.ts tests/unit/chat-helpers.test.ts`
  returned `ok`.
- Core type gate: `npm run typecheck:core` returned `ok`.

### Changes In This Checkpoint

- Moved the legacy migration collision set out of occupied `100-105` prefixes and into
  `115-121`, with `cli_access_tokens` at `120` to avoid local historical slots `108-114`.
- Added missing historical base migrations:
  `015_create_memories.sql`, `017_version_manager_upstream_proxy.sql`,
  and `032_apikey_lifecycle.sql`.
- Added `KIRO_TARGET` while preserving the legacy `KIRO_MITM_PROFILE` shape for the
  settings MITM API.
- Restored the optional required-scope override argument on `evaluateToolScopes`, matching
  existing tests and server usage.
- Added `allowedConnectionIds?: string[] | null` to `ComboModelStep` so combo normalization,
  provider wildcard expansion, and quota strategy code agree.

### Remaining DAG

```text
ROOT-OMNIROUTE-RECOVERY
|- MIGRATION-RENUMBER     [ok]   unique prefixes, proxy migration test green
|- HISTORICAL-BOOTSTRAP   [ok]   missing 015/017/032 base migrations staged
|- A2A-LIST-CAPABILITIES  [ok]   agent card/list-capabilities tests green
|- KIRO-MITM-TARGET       [ok]   KIRO_TARGET export + handler tests green
|- CHAT-COST-PATH         [ok]   chat helpers + translator tests green
|- TYPECHECK-CORE         [ok]   npm run typecheck:core green
|- LOCAL-COMMIT           [next] rerun staged validation, then commit if green
`- REMOTE-PUSH            [risk] branch is behind origin by 144; push may require rebase
```
