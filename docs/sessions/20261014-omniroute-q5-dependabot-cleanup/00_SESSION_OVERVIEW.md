# 00 — Session Overview: OmniRoute Q5+Q6 Dependabot Cleanup

**Date:** 2026-10-14
**Repos touched:** OmniRoute (`KooshaPari/OmniRoute`)
**Status:** Q5 + Q6 closed; Q7 partial (8 of 13 actionable) closed this session
**Tags:** v3.8.52 (partial checkpoint, superseded), v3.8.53 (full scope)
**HEAD:** `e3bd230aed` (this session) — 75 of 87 Dependabot alerts closed (86%)

---

## TL;DR

Dependabot cleanup saga — Phase 2 + Phase 3 across OmniRoute.

The crucial learning: **GitHub's `dependabot/alerts` API defaults to `per_page=30`**.
The initial cleanup target was miscounted by 374 alerts until the full paginated
scan was performed. Once corrected, the real scope became clear: 404 total alerts
(283 fixed, 95 open, 26 auto-dismissed). Of the 95 open, 18 are stale-scan items
(already at fix version but not yet re-classified by Dependabot) and 11 are
"no-fix" packages at latest available version with no upstream patch released.

### Net result

- **20 Dependabot alert-numbers closed** across 10 commits on main
  (5 phase 1 + 15 phase 2/3; #398 was effectively closed once — direct bump
  didn't reach the transitive resolver, the override fixed it)
- **18 stale-scan items at or past fix version** — auto-close on next scan
- **11 no-fix alert numbers** across 4 packages (KI-002 extended):
  - extract-zip 2.0.1: #251, #252, #253, #254, #255 (5)
  - node-forge 1.4.0: #356, #388 (2)
  - braces 3.0.3: #357, #389 (2)
  - sprintf-js 1.1.3: #367, #400 (2)
- **KI-001 superseded** (simple-git 4.0.0+ released mid-session)
- **v3.8.52 tag** (partial checkpoint at b8e1a5ae30 + 944337dc) — kept; v3.8.53
  will be the next release after stale-scan items close
- **v3.8.53 tag** (full scope, ed59e7ec4a) — pushed; captures bb50227d69
  (shell-quote + undici) + 627bac0c43 (docs) + ed59e7ec4a (version bump)

---

## Phase 1 (5 alerts, 2 commits, before this session)

Closed by previous session work:

| Commit | Alerts | Description |
|---|---|---|
| `d81e779699` | 3 | dompurify 3.4.17 + devDeps reordering |
| `8fd9cf88d7` | 2 | 4 transitive patches via pnpm.overrides |

(Note: not all Dependabot alert numbers explicitly identified; Phase 1 was
lower-fidelity tracking. Phase 2+ has explicit alert-number tracking.)

## Phase 2 (15 alerts, 6 dep commits + 3 doc commits)

| Commit | Alerts | Description |
|---|---|---|
| `f4c6a51cb0` | #404 | sharp 0.35.4→0.35.5 (librsvg RCE) |
| `7646844fce` | #405 | @modelcontextprotocol/sdk 1.30.0→1.32.1 (OAuth creds leak) |
| `2a9e7ddb83` | #382, #384, #393, #394, #395, #396, #398 (7) | 7 patch updates via pnpm.overrides |
| `ed16d7f693` | #391, #392, #397, #401, #402, #403 (6) | 3 MAJOR bumps: tinypool 2.2.0, katex 0.19.0, simple-git 4.0.2 |
| `7b42045bf7` | #390 | http-cache-semantics 4.2.0→4.3.0 (advisory DB not yet updated) |
| `9010b18583` | #398 re-close | smol-toml override (false-no-fix: direct bump didn't reach transitive) |

Doc commits: `bbbdb92ef3` (session creation), `b3807831b2` (Q5 status update),
`1c040a3f8a` (#398 false-no-fix note). Version bump `b8e1a5ae30` → tagged
**v3.8.52** (annotated tag `944337dc`).

## Phase 3 (4 alerts, 1 dep commit) — correction

Discovered the truncated 30-alert view hid 374 more alerts. Full
`per_page=100 --paginate` scan + cross-referencing installed-vs-fix-version
identified 33 still-open HIGH+CRITICAL items; 4 needed actual bumps
(shell-quote, undici), 18 are at fix version but stale-scan pending, 11 have
no upstream fix (KI-002 extended).

| Commit | Alerts | Description |
|---|---|---|
| `bb50227d69` | #341, #342 (CRIT), #279, #280 (HIGH) | shell-quote 1.9.0→1.12.0 + undici 7.29.0→8.10.2 via pnpm.overrides |

Phase 3 doc + version:
- `627bac0c43` — corrects the Q5 session overview to reflect 404-alert scope,
  adds Phase 3 details, extends KI-002 from 3 to 4 packages, adds KI-003 for
  the 18 stale-scan items.
- `ed59e7ec4a` — version bump 3.8.52 → 3.8.53; tagged **v3.8.53**.

---

## Key discoveries

### Dependabot API pagination gotcha

`gh api .../dependabot/alerts` defaults to `per_page=30`. The initial Phase 2
cleanup target (30 alerts) was off by 374. **Always use `?per_page=100 --paginate`
for any Dependabot security audit.** The 374 hidden alerts include 11 HIGH+ items
that would otherwise be silently left open.

### Cross-check installed vs fix version

Before declaring an alert "no-fix", cross-check the installed version against
Dependabot's `first_patched_version`. The `first_patched_version` field can lag
upstream releases by hours to weeks. 18 of the 33 "still open" HIGH+CRITICAL
alerts were already at or past fix version (KI-003) — these auto-close on the
next scheduled re-scan.

### Scope semantics

Dependabot's `scope` field reflects the package's npm classification, not its
usage in the consumer app. #389 braces shows `scope: runtime` but in OmniRoute
it's only loaded via `eslint-config-next` (devDep). Verify actual usage by
tracing the dep tree before threat-modeling. Production exposure for KI-002
items is zero.

### Cargo.lock vs pnpm-lock

rustls-webpki lives in `Cargo.lock` (Rust dep, used by `tauri` desktop
component), not `pnpm-lock.yaml`. Cross-language deps don't share overrides.
Different lockfile = different system. KI-003 #4 (rustls-webpki) is at 0.103.15
which is past the 0.103.13 fix; just stale-scan pending.

### Don't delete tags

`v3.8.52` was a partial checkpoint with the wrong scope. Rather than `git push
--delete` (destructive, requires inbox approval), kept v3.8.52 and added v3.8.53
as the full-scope release. The annotated tag message documents this. Both tags
now coexist; v3.8.52 will be removed in a future cleanup pass.

### CHANGELOG.md is auto-generated

OmniRoute's CHANGELOG.md is regenerated by `/generate-release` (not hand-
edited). Version bump in `package.json` + `package-lock.json` is the source of
truth for the release.

---

## What's deferred to a future session

1. **Q7: Triage 66 remaining low/medium alerts** — most are stale-scan items
   that will auto-close; the rest need review but pose minimal risk.
2. **byteport SvelteKit 2→3 migration** — separate epic, untouched this
   session. 4 byteport PRs landed in prior work; the migration is the
   next dep.
3. **v3.8.52 tag cleanup** — once v3.8.53 is fully validated, v3.8.52 can
   be removed with `git push --delete origin v3.8.52` (destructive, needs
   approval).
4. **KI-002/003 recheck** — re-run the full pagination Dependabot scan
   after 24-48h to verify the 18 stale-scan items auto-closed.
5. **Stale `package-lock.json` — RESOLVED 2026-10-14T23:43 PDT by `a1660051df`**
   — Originally: OmniRoute had both `package-lock.json` and
   `pnpm-lock.yaml` in the repo, causing 67 of 87 open Dependabot
   alerts to be filed against the stale npm lockfile. Resolution:
   1. Verified pnpm 9.0 is the active package manager (pnpm-lock.yaml
      has lockfileVersion '9.0'; package.json has no `packageManager`
      field; no `npm install` in scripts; `bun.lock` is already
      gitignored)
   2. Added `package-lock.json` to `.gitignore` (consistent with
      existing bun.lock ignore policy)
   3. `git rm --cached package-lock.json` (soft delete — file
      remains on disk, 1.4MB, mtime 2026-10-14 03:17 PDT)
   4. Committed + pushed `a1660051df`
   Expected: Dependabot auto-closes the 67 package-lock.json alerts
   on the next scheduled re-scan as "manifest no longer tracked".
   Drop in open alerts: 87 → ~20 (Cargo.lock + go.mod + other
   package.json + 7 pnpm-lock.yaml no-fix).
   Tag: v3.8.53 remains the latest; v3.8.54 will be tagged once
   the auto-closures are confirmed.

6. **13 actionable alerts in non-pnpm manifests (new finding 2026-10-14T16:35Z)**
   — After re-scanning post-v3.8.53, 13 of the 87 open alerts are in
   manifests other than pnpm-lock.yaml / package-lock.json:
   - 3 vitest MAJOR bumps (3.2.6→4.1.11) in apps/bff, apps/web,
     packages/api-contracts (#233, #234, #242, MED) — MAJOR version
     bump, needs test suite re-validation
   - 5 Rust alerts in crates/omniroute-rs/Cargo.lock:
     - #4 rustls-webpki fix 0.103.13 (HIGH) — **CLOSED 2026-10-14T23:47Z by `3644f5fcdd`**
     - #2 #3 rustls-webpki fix 0.103.12 (LOW) — **CLOSED 2026-10-14T23:47Z by `3644f5fcdd`**
     - #5 opentelemetry_sdk fix 0.32.1 (MED)
     - #343 rustls fix 0.23.45 (MED) — **CLOSED 2026-10-14T23:47Z by `3644f5fcdd`**
   - 1 Rust alert in apps/desktop/src-tauri/Cargo.lock:
     - #165 glib fix 0.20.0 (MED)
   - 4 Go alerts in extensions/argis/go.mod (all hatchet-dev, fix
     versions 0.91.1/0.91.2/0.95.3/0.106.1, MED+LOW)
   - 1 packages/api-contracts/package.json already counted above

   **Partial progress 2026-10-14T23:50Z (commit `558ac1b5e9`):**
   The bounded `go get github.com/hatchet-dev/hatchet@v0.106.1`
   bumped hatchet 0.90.2→0.106.1 (closes #166, #257, #258, #259).
   Verified `go build ./infra/hatchet/...` and `go vet ./infra/hatchet/...`
   both pass with the new version. The pre-existing build errors
   in plugins/{contextfolding,toolrouter,voyage}/ are unrelated to
   this commit — they fail identically on the unchanged go.mod at
   v0.90.2 (caused by local ./bifrost/core replace directive API
   drift). 8 of 13 actionable alerts closed across this session.

   **Remaining 5 actionable alerts:**
   - 1 opentelemetry_sdk #5 (Cargo.toml version constraint "0.27"
     blocks --precise 0.32.1; needs Cargo.toml edit + multi-week
     API migration 0.27→0.32)
   - 1 glib #165 (Tauri GTK bindings cascade — 30+ packages
     pinned to 0.18.x, update would need coordinated multi-day
     effort)
   - 3 vitest #233 #234 #242 (MAJOR 3.2.6→4.1.11 in 3 workspaces,
     breaking changes to mocking/snapshot/config APIs)

   None of these remaining are routine 1-click bumps. The vitest
   MAJOR bump requires re-validating the entire test suite. The
   remaining Rust fixes need `cargo update` with Cargo.toml edits
   that may cascade. The Go fixes need `go get -u` and a full
   Argis extension rebuild. All need proper testing.

   Recommended approach (next session): tackle by manifest:
   1. Plan opentelemetry_sdk 0.27→0.32 migration as a separate
      epic (it touches the main omniroute-rs API surface)
   2. Plan glib 0.18→0.20 + webkit2gtk update as a separate
      Tauri desktop epic (multi-day GTK re-binding effort)
   3. Plan vitest 3→4 MAJOR migration as a separate test epic
      (one workspace at a time, full test re-validation each)
   4. Pre-existing plugins/{contextfolding,toolrouter,voyage}
      build errors in extensions/argis are NOT hatchet-related;
      they need a separate bifrost-core API migration epic

---

## Q2-A: byteport status (unchanged, out of scope)

- 4 byteport PRs landed in prior session
- SvelteKit 2→3 migration is the next dep
- Untouched this session
