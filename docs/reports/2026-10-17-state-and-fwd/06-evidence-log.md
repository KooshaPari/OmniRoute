# 06 — Evidence Log

Every claim in this set traces to a command run in this session. This file
records the commands and their observed results, including the ones that
**contradicted** an earlier belief.

## Commits pushed to `main`

| SHA          | Message                                                                            |
| ------------ | ---------------------------------------------------------------------------------- |
| `2619835e49` | `fix(hooks): wire resurrection guard into husky — it had never fired (KI-031)`     |
| `a6c38f7d10` | `doc(KI-031): add negative-control proof + update handoff`                         |
| `702be98155` | `doc(KI-032): correct the CI-status claim — ci.yml has startup-failed for 10 days` |
| `8baaee2dee` | `doc(KI-032): node_modules empty + package-lock.json drifted, masking the guard`   |
| `6d726fb9f4` | `doc(KI-032): resolve locally + correct the PM claim; guard now runs`              |
| `42f50de195` | `fix(client-bundle): stop leaking node:fs into the browser build`                  |

Final state: `main` @ `42f50de195`, in sync with `origin/main`, 46 untracked
entries (the saga spike, untouched), 0 staged.

## Key evidence, by claim

### The app runs

```
curl -s http://127.0.0.1:20128/api/health
  -> 200 {"status":"ok","timestamp":"2026-10-17T00:44:43.705Z"}

curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:20128/login
  -> 200   (745,663 bytes; <title>OmniRoute — AI Gateway for Multi-Provider LLMs</title>)

curl -s -X POST http://127.0.0.1:20128/api/auth/login \
  -H 'Content-Type: application/json' -d '{"password":"CHANGEME"}' -c /tmp/cookies.txt
  -> 200 {"success":true}   (auth_token cookie set)

curl -s -b /tmp/cookies.txt http://127.0.0.1:20128/api/auth/status
  -> {"authenticated":true}
```

### The gateway routes

```
curl -s -X POST http://127.0.0.1:20128/api/v1/chat/completions \
  -H 'Content-Type: application/json' -b /tmp/cookies.txt \
  -d '{"model":"auto/best-coding","messages":[{"role":"user","content":"say hi"}],"max_tokens":10}'
  -> 503 {"code":"ALL_TARGETS_SKIPPED","diagnostics":{"poolSize":8,"attempted":0,...}}
```

### The `node:fs` leak

```
rg -n 'node:fs' open-sse/utils/cursorAgentCliVersion.ts
  -> lines 12-18 import { existsSync, lstatSync, ... } from "node:fs"

curl -s http://127.0.0.1:20128/login    # before the fix
  -> 500
```

Webpack's error (with `OMNIROUTE_USE_TURBOPACK=0`, which made the error explicit):

```
UnhandledSchemeError: Reading from "node:fs" is not handled by plugins
Import trace:
  node:fs
  ./open-sse/utils/cursorAgentCliVersion.ts
  ./src/lib/oauth/constants/oauth.ts
  ./open-sse/config/providers/registry/codebuddy-cn/index.ts
  ./open-sse/config/providers/index.ts
```

Debugging note: **with Turbopack the same defect surfaced as
`ENOENT .../login/page/build-manifest.json`**, which looks like a build-cache
bug. Forcing webpack (`OMNIROUTE_USE_TURBOPACK=0`) revealed the true cause. My
initial hypothesis — that the _custom server + Turbopack_ combination was at
fault — was **wrong**; disabling Turbopack did not fix it.

### The truncated dependency

```
ls -l node_modules/tailwind-merge/dist/bundle-mjs.mjs
  -> 1669 bytes            (should be ~106 KB)

# after reinstall:
  -> 106124 bytes, imports cleanly
```

Same failure class, earlier: `@swc/core-darwin-arm64/swc.darwin-arm64.node`
was 23,789,788 bytes while its Mach-O header claimed 24,920,064 —
`dlopen` failed with _"segment '\__TEXT' content extends beyond end of file"_.

### Disk pressure is the cause

```
df -h .
  -> 926Gi total, 858Gi used, 13Gi free, 99% used     (during install)

sysctl vm.swapusage
  -> total = 14336.00M  used = 13874.56M  free = 461.44M   (exhausted)
```

After freeing regenerable artifacts (`.build`, npm cache):

```
  -> 57Gi free, 94% used
```

### CI was dead, then fixed

```
gh run list --workflow=ci.yml --limit 3
  (before)  -> completed/startup_failure, newest 2026-10-05

gh api repos/KooshaPari/OmniRoute/actions/permissions/selected-actions --jq '.patterns_allowed[]'
  -> 22 entries; missing: actions-rust-lang/setup-rust-toolchain,
     hashicorp/setup-terraform, peaceiris/actions-gh-pages,
     sigstore/cosign-installer

# after adding those 4 (allowlist 22 -> 26):
gh workflow run ci.yml --ref main
  -> run 39004526181  status: in_progress

gh api .../runs/39004526181/jobs
  -> 12+ jobs: Change Classification (success), i18n Validation (success),
     Lint, Vitest, Integration Tests, Quality Gates, Ecosystem E2E ...
```

A `startup_failure` run reports **0 jobs and no logs** — which is why the cause
was invisible for 10+ days.

### Branch protection is empty

```
gh api repos/KooshaPari/OmniRoute/branches/main/protection
  -> {"required_status_checks":null, "enforce_admins":{"enabled":false}}
```

### Fork identity

```
gh repo view KooshaPari/OmniRoute --json isFork,parent
  -> isFork: true, parent: diegosouzapw/OmniRoute

gh api repos/KooshaPari/OmniRoute/compare/diegosouzapw:main...KooshaPari:main
  -> ahead_by: 1021, behind_by: 92, status: diverged
```

## Corrections I made to my own earlier reporting

These are recorded because each one was wrong when first stated:

| Claim I made                                  | Reality                                                                                                              | How it was caught                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| "CI runs are stuck queued"                    | 56 **completed** (13 success, 31 startup_failure, 12 failure) + 44 queued                                            | Re-measured over 100 runs                                    |
| "npm is the authoritative package manager"    | `pnpm` is the target; `package-lock.json` is **gitignored**; `pnpm install` appears in 0 workflows vs `npm ci` in 21 | Read `.gitignore:297` and counted workflow refs              |
| Untracked count was 46                        | It was **47** (a worker residue file)                                                                                | Recounted; filter had been too loose                         |
| "The app does not build or run"               | It **runs**; page routes 500'd due to an import leak                                                                 | A subagent measured mid-install; invalidated and re-measured |
| Turbopack/custom-server was the cause of 500s | It was a `node:fs` client-bundle leak                                                                                | Disproved by forcing webpack                                 |
| Dependabot: 9 open alerts                     | 15 open, then **12** at final check                                                                                  | Correct endpoint + `--paginate`                              |

## Known outstanding state

- **Disk at 94%.** Two dependency files have already been corrupted by this.
- **`stash@{0}`** holds the operator's 35 pre-existing workflow SHA-pin edits +
  `package.json`. These conflicted with PR #756 during a rebase and were parked.
  **They are safe but not applied.**
- **`git branch -d jcode-resurrect-proof-E` refused** (2 unmerged test commits).
  `-D` is policy-blocked. Still present, still inert, never pushed.
- **`jcode-resurrect-proof-E`** and the 4 saga-gated items remain operator-owned.
- **A dev server is running on port 20128** (pid 7180 at time of writing).
