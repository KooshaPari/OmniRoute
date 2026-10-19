# 04 — Gates & CI

## Headline: CI was dead for 10+ days, and the cause was four missing allowlist entries

This was **fixed during this audit** and **verified by a real run**.

### Before

- `ci.yml` had produced **zero** non-`startup_failure` runs since **2026-10-05**.
- Of the last ~200 runs: **57 `startup_failure`**, 31 success, 44 failure, 4 cancelled.
- A `startup_failure` run has **0 jobs** — it dies before ever reaching a runner,
  so **no logs exist** for it. That is why this went undiagnosed: there was
  nothing to read.

### Root cause (evidenced)

The repo policy is `allowed_actions: "selected"` with an explicit
`patterns_allowed` list. Four actions used by the workflows were **not** in that
list:

```
actions-rust-lang/setup-rust-toolchain@*
hashicorp/setup-terraform@*
peaceiris/actions-gh-pages@*
sigstore/cosign-installer@*      <-- the evidenced startup_failure trigger
```

GitHub rejects a workflow at _dispatch_ time when it references a
non-allowlisted action, which produces exactly the observed signature: immediate
failure, zero jobs, no logs. `gh auth status` shows scopes
`gist, read:org, repo, workflow`.

### Fix applied

Added all four to `patterns_allowed` (allowlist went 22 → 26 entries).
Verified by reading back the list.

### Result — verified by execution, not inspection

Dispatched `ci.yml` via `workflow_dispatch`. Run **`39004526181`**:

```
status: in_progress      event: workflow_dispatch        conclusion: null
```

Jobs (a `startup_failure` would show none):

| Job                             | Status      |
| ------------------------------- | ----------- |
| Change Classification           | success     |
| i18n Validation (all languages) | success     |
| PR Test Policy                  | skipped     |
| Lint                            | in_progress |
| Vitest (MCP / autoCombo / UI)   | in_progress |
| Integration Tests (2/2)         | in_progress |
| Quality Gates (Extended)        | in_progress |
| i18n UI Coverage                | in_progress |
| i18n Glossary (zh-CN, ko)       | in_progress |
| Docs Lint (prose — advisory)    | in_progress |
| Bun SQLite Compatibility        | in_progress |
| Ecosystem E2E (live server)     | in_progress |

**CI is running real jobs for the first time in this repo's recent history.**

## Branch protection (CORRECTED — it was not empty)

An earlier draft called protection "empty". That was imprecise and understated
what already existed. Measured 2026-10-17:

| Setting                   | Value          | Effect                              |
| ------------------------- | -------------- | ----------------------------------- |
| `allow_force_pushes`      | `false`        | **Force pushes already blocked**    |
| `allow_deletions`         | `false`        | **Branch deletion already blocked** |
| `required_linear_history` | `true`         | Merge commits rejected              |
| `enforce_admins`          | `false`        | Operator retains an override        |
| `required_status_checks`  | **was `null`** | **CI enforced NOTHING**             |

So the gap was narrower than "no protection": destructive operations were
already blocked, but **`required_status_checks` was unset**, so CI was advisory
even when green.

### Fixed in this session

Required status checks added, using gates that currently **pass** and are
meaningful:

```
Security Tests
i18n Validation (all languages)
Quality Gates (Extended)
```

`strict: false` (branches need not be up to date); `enforce_admins: false` (the
operator keeps an override).

**Why only three:** the rest are red or were cancelled, and requiring a failing
check would lock the operator out of their own `main`. Promote `Lint`, `Vitest`,
`Unit Tests`, `Integration Tests`, `Docs Sync (Strict)`, `i18n Glossary`, and
`Bun SQLite Compatibility` **as they go green** (05 Phase 1.2).

## Current gate inventory

| Gate                                    | State                                                                                                                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Actions CI                       | **Now runs** (was `startup_failure` for 10+ days)                                                                                                                       |
| Branch protection — required checks     | **NOW SET** — Security Tests, i18n Validation, Quality Gates (Extended)                                                                                                 |
| Branch protection — force-push / delete | **Already blocked** (`allow_force_pushes: false`, `allow_deletions: false`, linear history required)                                                                    |
| Local husky pre-commit                  | **Works** — git-identity, lint-staged, docs-sync, any-T11-budget, tracked-artifacts, resurrection-patterns                                                              |
| `lefthook.yml`                          | **Dead config.** `core.hooksPath=.husky/_`, so lefthook's pre-commit never executes. Its `resurrection-patterns` block was removed (KI-031); other blocks remain inert. |
| Coverage floor                          | 60% via `.qgate.toml` — **informational, does not block**                                                                                                               |
| Codecov patch target                    | 70% — **informational**                                                                                                                                                 |

## Test infrastructure

The infrastructure is substantial: **~6,065 test files** across the repo,
`vitest` + `c8` coverage configured, plus Playwright for E2E. `tests/` alone
contains roughly 48,061 test cases. The problem was never test _supply_ — it was
that nothing _ran_ them automatically.

## Warning about the recent pnpm migration

PR **#756** (`669cd46ca1`, "ci: standardize CI installs on pnpm (tracked
pnpm-lock.yaml)") changed **32 workflow files** yesterday and moved CI installs
from `npm ci` to pnpm. Given CI could not run at all while that landed, **the
migration was merged without CI validation.** The currently-running jobs are the
first real exercise of it. Expect fallout; watch the `Lint`, `Vitest`, and
`Integration Tests` jobs specifically.

This also resolves the package-manager contradiction found earlier:
`.gitignore:297` claimed "pnpm is the package manager" while 21 workflows ran
`npm ci` and `package-lock.json` was untracked. That inconsistency is now closed
in favour of pnpm.

## Three steps to make gates real

1. ~~Add the missing actions to the allowlist~~ — **DONE**, CI now runs.
2. ~~Enable required status checks~~ — **DONE** (three green gates; expand as
   more go green).
3. **Get CI to green.** Current result on `42f50de195`: 6 pass, 6 fail, rest
   cancelled by concurrency. Treat the first fully-green run as the milestone,
   then promote newly-green jobs into required checks.
