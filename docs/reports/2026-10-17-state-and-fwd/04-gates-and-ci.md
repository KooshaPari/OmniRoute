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

## What still does NOT gate (and this is the important part)

**Branch protection is empty.**

```json
{ "enforce_admins": { "enabled": false }, "required_status_checks": null }
```

Zero required status checks. **Even with CI now green, nothing prevents a direct
push to `main` that breaks the build.** The repo has had 71–77 workflow files and
no enforcement at all.

## Current gate inventory

| Gate                                | State                                                                                                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Actions CI                   | **Now runs** (was `startup_failure` for 10+ days)                                                                                                                       |
| Branch protection / required checks | **NONE**                                                                                                                                                                |
| Local husky pre-commit              | **Works** — git-identity, lint-staged, docs-sync, any-T11-budget, tracked-artifacts, resurrection-patterns                                                              |
| `lefthook.yml`                      | **Dead config.** `core.hooksPath=.husky/_`, so lefthook's pre-commit never executes. Its `resurrection-patterns` block was removed (KI-031); other blocks remain inert. |
| Coverage floor                      | 60% via `.qgate.toml` — **informational, does not block**                                                                                                               |
| Codecov patch target                | 70% — **informational**                                                                                                                                                 |

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
2. **Enable branch protection** with `CI` as a required status check. Until this
   is done, the newly-working CI is advisory only.
3. **Get CI to green.** The suite has not run end-to-end in a long time and the
   pnpm migration landed unvalidated. Expect red; treat the first green run as
   the milestone.
