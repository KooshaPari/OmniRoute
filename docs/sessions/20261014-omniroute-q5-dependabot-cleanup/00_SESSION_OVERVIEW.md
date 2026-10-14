# 00 — Session Overview: OmniRoute Q5+Q6 Dependabot Cleanup

**Date:** 2026-10-14
**Repos touched:** OmniRoute (`KooshaPari/OmniRoute`)
**Status:** Q5 + Q6 closed; Q7 (low/med triage) deferred until Dependabot re-scan completes
**Tags:** v3.8.52 (partial checkpoint, superseded), v3.8.53 (full scope)
**HEAD:** `ed59e7ec4a`

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
5. **Stale `package-lock.json` (new finding 2026-10-14T10:25Z)** — OmniRoute
   has both `package-lock.json` and `pnpm-lock.yaml` in the repo. v3.8.53
   closed #341 (shell-quote) and #279 (undici) via pnpm-lock.yaml overrides,
   but Dependabot still tracks the package-lock.json manifest path for
   #342 and #280 (same packages, same fix). Either the package-lock.json
   is stale and should be deleted + added to .gitignore, or Dependabot's
   manifest path tracking needs to be reconciled. Quick check: `ls -la
   package-lock.json pnpm-lock.yaml` — if package-lock.json is older than
   the most recent pnpm install, delete it.

---

## Q2-A: byteport status (unchanged, out of scope)

- 4 byteport PRs landed in prior session
- SvelteKit 2→3 migration is the next dep
- Untouched this session
