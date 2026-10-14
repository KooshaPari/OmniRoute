# Known issues — 2026-10-14

## KI-001: simple-git 3.36.0 — `trailer.<token>.cmd` config RCE bypass

**STATUS: SUPERSEDED 2026-10-14T09:36Z by simple-git 4.0.0+ release.**

**Dependabot alerts:** #401, #402, #403 (all closed by `ed16d7f693`)
**GHSA:** [GHSA-x6jw-m9v5-85vh](https://github.com/advisories/GHSA-x6jw-m9v5-85vh)
**CVE:** [CVE-2026-102828](https://www.cve.org/CVERecord?id=CVE-2026-102828)
**Originally affected:** `simple-git@3.15.0` through `3.36.0`
**Patched by:** `simple-git@4.0.0` (we installed 4.0.2)

### Original vulnerability (now resolved)

simple-git's default `blockUnsafeOperationsPlugin` did not recognize
`trailer.<token>.cmd`, which `git interpret-trailers` runs as a shell command.
A value reaching `SimpleGitOptions.config` or any `-c <key>=<value>` argument
got through the unsafe-operation guard and was invoked as a shell command with
the Node.js process's filesystem, network, and service permissions.

### Resolution

simple-git 4.0.0 shipped on 2026-10-13 (one day after KI-001 was written) with
the `trailer.<token>.cmd` matcher added to `preventUnsafeConfig`. Installed via
pnpm.overrides in `ed16d7f693`. OmniRoute now uses simple-git 4.0.2.

### References

- https://github.com/advisories/GHSA-x6jw-m9v5-85vh
- https://github.com/lovell/simple-git/security/advisories/GHSA-x6jw-m9v5-85vh
- https://www.cve.org/CVERecord?id=CVE-2026-102828

---

## KI-002: Four "no-fix" packages at latest available version

**STATUS: OPEN — no upstream fix available at scan time (2026-10-14T10:00Z).**

| Alert | Sev | Package | Installed | Latest | Parent dep chain |
|---|---|---|---|---|---|
| #251, #252, #253, #254, #255 (5) | HIGH | extract-zip | 2.0.1 | **2.0.1** | @openai/codex-security (devDep) |
| #356, #388 (2) | HIGH | node-forge | 1.4.0 | **1.4.0** | jks-js → promptfoo (devDep) |
| #357, #389 (2) | HIGH | braces | 3.0.3 | **3.0.3** | micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next (devDep) |
| #367, #400 (2) | MED | sprintf-js | 1.1.3 | **1.1.3** | roarr → global-agent → onnxruntime-node (optionalDep, via @huggingface/transformers) |

**Total: 11 Dependabot alert numbers across 4 packages.**

**Common pattern:** All four are at the latest available version on npm
(verified 2026-10-14T10:00Z). The upstream maintainers have not yet released
a fix for the vulnerabilities Dependabot flagged.

### Exposure in OmniRoute

All four are **transitive via devDependencies or optionalDependencies**:
- **extract-zip** → @openai/codex-security (devDep)
- **node-forge** → jks-js → promptfoo (devDep only)
- **braces** → micromatch → fast-glob → @next/eslint-plugin-next → eslint-config-next (devDep only)
- **sprintf-js** → roarr → global-agent → onnxruntime-node (optionalDep only)

**Production exposure: zero.** None of these packages are loaded at runtime in
any production bundle. The vulnerabilities are present only in:
- Lint/format tooling (braces via eslint-config-next)
- Eval/test harness (node-forge via promptfoo, extract-zip via @openai/codex-security)
- Optional Hugging Face transformers (sprintf-js via onnxruntime-node)

### Mitigation until upstream fix

- **extract-zip** (#251–#255): Wait for upstream 2.0.2+. Symlink path traversal
  in zip extraction; not exploitable in OmniRoute's @openai/codex-security
  usage (no untrusted zip extraction).
- **braces** (#357, #389): Wait for upstream 4.x or newer. Stack-exhaustion
  DoS only triggers with deeply nested untrusted glob patterns; OmniRoute's
  glob usage is bounded by ESLint config and test fixtures.
- **node-forge** (#356, #388): Wait for upstream 1.5.x. RSA PKCS#1 v1.5
  signature verification bypass; not exploitable in OmniRoute's promptfoo
  eval usage (no RSA verification of attacker-controlled inputs).
- **sprintf-js** (#367, #400): Wait for upstream 2.x. Unbounded regex DoS via
  attacker-controlled format strings; not exposed in OmniRoute's transformers
  usage (no external format strings reach sprintf-js).

### Tracking

Watch for upstream releases:
- [maxogden/extract-zip](https://github.com/maxogden/extract-zip) — 2.0.1 from 2023-03
- [digitalbazaar/node-forge](https://github.com/digitalbazaar/node-forge) — 1.4.0 from 2026-03
- [micromatch/braces](https://github.com/micromatch/braces) — 3.0.3 from 2024-05
- [adaltas/node-sprintf](https://github.com/adaltas/node-sprintf) — 1.1.3 from 2023-09

When any of these ship a fix, bump the parent dep or add to pnpm.overrides.

### Re-scan note

The Phase 3 full-pagination Dependabot scan (`per_page=100 --paginate`)
revealed 2 additional no-fix alert numbers per package (extract-zip 5
alerts vs the 0 initially visible; node-forge / braces / sprintf-js had
been logged once in the truncated 30-alert view but had a second alert
each at a different Dependabot advisory). All are documented here.

---

## KI-003: Stale Dependabot scan — 18 items at or past fix version

**STATUS: OPEN — no action required; will auto-close on next Dependabot re-scan.**

After Phase 3 re-scan, 18 of the 33 still-open HIGH+CRITICAL alerts are at or
past the Dependabot `first_patched_version` but Dependabot hasn't re-classified
them as "fixed" yet:

| # | Sev | Package | Installed | Dependabot fix | Status |
|---|---|---|---|---|---|
| #302 | CRIT | next | 16.3.8 | 16.3.6 | past fix |
| #340 | CRIT | @simple-git/argv-parser | 2.0.1 | 2.0.1 | at fix |
| #362 | CRIT | proxy-addr | 2.0.8 | 2.0.8 | at fix |
| #370 | CRIT | simple-git | 4.0.2 | 4.0.1 | past fix |
| #4 | HIGH | rustls-webpki (Cargo) | 0.103.15 | 0.103.13 | past fix |
| #268, #271, #277 | HIGH | undici | 8.10.2 | 8.10.2 | at fix |
| #307 | HIGH | @grpc/grpc-js | 1.14.6 | 1.14.5 | past fix |
| #309, #315, #317, #327 | HIGH | axios | 1.20.0 | 1.20.0 | at fix |
| #360 | HIGH | compression | 1.8.2 | 1.8.2 | at fix |
| #363 | HIGH | source-map-js | 1.2.2 | 1.2.2 | at fix |
| #368, #369 | HIGH | simple-git | 4.0.2 | 4.0.0 | past fix |
| #371 | HIGH | sharp | 0.35.5 | 0.35.5 | at fix |
| #372 | HIGH | @modelcontextprotocol/sdk | 1.32.1 | 1.31.0 | past fix |
| #373 | HIGH | next | 16.3.8 | 16.3.8 | at fix |

These should auto-close within 24-48 hours of the next Dependabot scheduled
re-scan. The 62 medium/low open alerts are a similar mix (mostly stale-scan
plus a few medium-severity no-fix items) and will be triaged in a future
session if the re-scan doesn't close them.

### Update 2026-10-14T23:50Z

**67 stale-manifest items closed by package-lock.json cleanup (commit `a1660051df`):**
After v3.8.53 release, a 13h-post recheck revealed that 67 of the original
87 open Dependabot alerts were filed against `package-lock.json` — a
stale npm lockfile that OmniRoute was tracking in addition to the active
`pnpm-lock.yaml`. Resolution:
1. Added `package-lock.json` to `.gitignore` (consistent with existing
   `bun.lock` ignore policy)
2. `git rm --cached package-lock.json` (soft delete — file remains on disk
   at 1.4MB, mtime 2026-10-14 03:17 PDT)
3. Committed + pushed `a1660051df`
Expected outcome: all 67 alerts auto-close on next re-scan as 'manifest
no longer tracked'. Combined with the 4 alerts closed by `3644f5fcdd`
(rustls + rustls-webpki) and 4 by `558ac1b5e9` (hatchet), this brings
the total from 87 → 12 expected open alerts.

---

## KI-004: 5 remaining actionable alerts (post-Q7 partial completion)

**STATUS: OPEN — 8 of 13 actionable closed in this session (commits
`3644f5fcdd`, `558ac1b5e9`); 5 remaining are all multi-step epics.**

After the v3.8.53 + follow-up cleanup, 5 actionable alerts remain. Each
requires deliberate engineering effort (API migration, multi-workspace
test re-validation, or coordinated multi-package dep cascades).

| Alert | Sev | Package | Current | Fix | Epic scope |
|---|---|---|---|---|---|
| #5 | MED | opentelemetry_sdk (omniroute-rs) | 0.27.1 | 0.32.1 | opentelemetry 0.27→0.32 is a 5-minor-version API migration; Cargo.toml constraints `opentelemetry = "0.27"`, `opentelemetry-otlp = "0.27"`, `tracing-opentelemetry = "0.28"` all block the version; requires coordinated multi-package bump + API rewrite. Estimated: 1-2 days. |
| #165 | MED | glib (Tauri) | 0.18.5 | 0.20.0 | Tauri GTK bindings cascade: 30+ packages pinned to 0.18.x (atk, cairo, gdk, gtk, pango, webkit2gtk, soup3, javascriptcore-rs, libappindicator, gdkx11, gdkwayland). Coordinated multi-day GTK re-binding effort. |
| #233 | MED | vitest (apps/bff) | 3.2.6 | 4.1.11 | MAJOR bump 3→4 with breaking changes to mocking, snapshot, and config APIs. Per-workspace test re-validation. ~4h per workspace. |
| #234 | MED | vitest (apps/web) | 3.2.6 | 4.1.11 | Same as above, apps/web. |
| #242 | MED | vitest (packages/api-contracts) | 3.2.6 | 4.1.11 | Same as above, packages/api-contracts. |

### Recommended order (next session)

1. **opentelemetry_sdk epic**: Bump opentelemetry + opentelemetry_sdk +
   opentelemetry-otlp to 0.32, tracing-opentelemetry to 0.33. Test the
   trace/metrics exporters. ~1-2 days. Closes #5.
2. **glib/webkit2gtk epic**: Update all 30+ GTK bindings to 0.20.x track,
   rebuild Tauri. ~2-3 days. Closes #165.
3. **vitest MAJOR migration**: One workspace at a time. Start with
   packages/api-contracts (smallest, most isolated). Bump to 4.1.11,
   re-run tests, fix snapshot/mock breakages. Then apps/bff, then apps/web.
   ~4h per workspace. Closes #233, #234, #242.
4. **Pre-existing build errors** (NOT a Dependabot issue but worth noting):
   `extensions/argis/plugins/{contextfolding,toolrouter,voyage}/` fail
   to build because the local `./bifrost/core` replace directive has
   a newer ChatMessage/ChatMessageContent API than the plugins expect.
   These errors are unrelated to the hatchet bump in `558ac1b5e9` —
   they fail identically on the unchanged go.mod. Separate epic.

### Tracking

- Dependabot alerts API: `gh api repos/KooshaPari/OmniRoute/dependabot/alerts?state=open&per_page=100 --paginate | jq`
- This KI was written on 2026-10-14T23:50Z; re-check on next session start.

---
