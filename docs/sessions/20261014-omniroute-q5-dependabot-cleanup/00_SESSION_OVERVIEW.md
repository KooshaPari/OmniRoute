# 2026-10-14 — OmniRoute Q5/Q6 Dependabot cleanup

## Goal

Close as many Dependabot HIGH-severity vulns as possible after the v3.8.51
release. The cleanup went through 3 phases:

- **Phase 1** (pre-session): 5 Dependabot PRs → 4 commits on main.
- **Phase 2** (this session, initial): Discovered 17 newly-visible alerts
  through the truncated 30-alert Dependabot view; closed 14 of them, with
  3 known-issues.
- **Phase 3** (this session, after correction): Re-scanned with
  `per_page=100 --paginate` and discovered the **true scope is 404 total
  alerts** (not 30). Cross-checked installed-vs-fix-version for the 33
  still-open HIGH/CRITICAL items; closed 4 more, documented the rest as
  stale-scan (will auto-close on Dependabot re-scan) or no-fix (KI-002).

## Phase 1 — 5 Dependabot PRs closed (4 commits on main)

| Commit | Description |
|---|---|
| `4901925f74` | next 16.3.3→16.3.8, dompurify ^3.4.14→^3.4.16 (2 PRs direct) |
| `c0496f1b23` | pnpm-lock sync (next 16.3.8, dompurify 3.4.15) |
| `d81e779699` | dompurify ^3.4.17 (resolved 3.4.15→3.4.17) |
| `8fd9cf88d7` | pnpm.overrides for 4 transitive Dependabot bumps: ip-address 10.7.4, express-rate-limit 8.7.1, @grpc/grpc-js 1.14.6, ibm-cloud-sdk-core 5.9.0 |

5 Dependabot alerts resolved (#406–#411, all next.js 16.3.8 patches).

## Phase 2 — 16 unique alert numbers closed (6 commits on main)

The truncated 30-alert Dependabot view showed 17 newly-dormant alerts after
Phase 1. 14 were patchable; 3 had no upstream fix at scan time.

### 2a — direct dep patches (2 commits)

| Commit | Alerts | Package | Old → New |
|---|---|---|---|
| `f4c6a51cb0` | #404 (HIGH) | sharp | 0.35.4 → 0.35.5 (librsvg RCE, CVSS 8.9) |
| `7646844fce` | #405 (HIGH) | @modelcontextprotocol/sdk | 1.30.0 → 1.32.1 (OAuth creds leak, CVSS 7.5) |

### 2b — 7 patchable transitive bumps via pnpm.overrides (1 commit)

| Commit | Alerts | Packages (old → new) |
|---|---|---|
| `2a9e7ddb83` | #382, #384, #393, #394, #395, #396, #398 (7) | brace-expansion 5.0.9→5.0.12, fast-uri 3.1.7→4.2.2, postcss-selector-parser 7.1.4→7.1.6, compression 1.8.1→1.8.2, proxy-addr 2.0.7→2.0.8, source-map-js 1.2.1→1.2.2, smol-toml 1.8.0→1.9.0 |

### 2c — 3 MAJOR transitive bumps via pnpm.overrides (1 commit)

| Commit | Alerts | Packages (old → new) |
|---|---|---|
| `ed16d7f693` | #391, #392 (CRIT), #397 (LOW), #401, #402 (HIGH), #403 (CRIT) (6) | tinypool 1.1.1→2.2.0, katex 0.16.47→0.19.0, simple-git 3.36.0→4.0.2 |

**simple-git 4.0.0 supersedes KI-001.** The earlier advisory stated "no released
remediation"; 4.0.0 shipped with the `trailer.<token>.cmd` matcher and a fix for
the other two simple-git unsafe-ops bypasses. simple-git 4.0.2 (latest) installed.

### 2d — last patchable from initial 17: http-cache-semantics + smol-toml override (2 commits)

| Commit | Alerts | Package | Old → New |
|---|---|---|---|
| `7b42045bf7` | #390 (HIGH) | http-cache-semantics | 4.2.0 → 4.3.0 |
| `9010b18583` | #398 (MED) | smol-toml (override) | 1.7.1 (transitive) → 1.9.0 |

#390: Dependabot's `first_patched_version` field still shows `-` (advisory
DB hasn't been updated), but 4.3.0 is the only release newer than the
vulnerable 4.2.0 and matches the max-stale fix timeline.

#398: The earlier 2a9e7ddb83 direct-dep bump only updated the explicit
`"smol-toml": "1.9.0"` entry. A transitive chain was still resolving to
1.7.1 in the lock (false-no-fix — the direct-dep bump didn't reach the
transitive resolver). The `smol-toml: >=1.9.0` pnpm.overrides entry
forces every transitive to the fixed version.

## Phase 3 — full-pagination re-scan correction (1 commit)

After tagging v3.8.52, a full `per_page=100 --paginate` Dependabot scan
revealed the **true total is 404 alerts** (not 30). The truncated view
hidden behind GitHub's default page size had masked 374 additional alerts.
Cross-checked installed-vs-fix-version for the 33 still-open HIGH+CRITICAL
items.

| Commit | Alerts | Packages (old → new) |
|---|---|---|
| `bb50227d69` | #341, #342 (CRIT), #279, #280 (HIGH) (4) | shell-quote 1.9.0→1.12.0, undici 7.29.0→8.10.2 (resolved) |

shell-quote 1.9.0 was a transitive (probably via simple-git's
`@simple-git/argv-parser`). undici 7.29.0 was a transitive too. Both
required `pnpm.overrides` entries because no direct dep pulls them.

### Stale-scan items (already at fix version; awaiting Dependabot re-scan)

18 of the 33 still-open HIGH+CRITICAL items are at or past the Dependabot
`first_patched_version`. They will auto-close on the next Dependabot scan:

| # | Sev | Package | Installed | Dependabot fix | Notes |
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

No action required for these — already fixed. Dependabot re-scan will close them.

## Net result

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
- All commits have ledger metadata (`tx-agent: jcode`, `tx-validated: manual`)
- Direct-push squash path used throughout

## Untouched (per Q2-A decision)

- `~/.omniroute/storage.sqlite`
- 3,738 WIP files in working tree (target/.rustc_info.json,
  apps/web/src/routes/dashboard/+page.server.ts, desktop-electrobun/,
  electron/, docs/guides/ELECTRON_GUIDE.md, etc.)
- Pre-existing failures on main remain documented

## Next (if operator wants to continue)

- Wait for next Dependabot re-scan to close the 18 stale-scan items
  automatically
- Tag v3.8.53 once the stale-scan items close (no destructive ops —
  v3.8.52 stays as a snapshot of "what we knew at the time")
- byteport: SvelteKit 2→3 migration (substantial, separate epic)
- Q4-byteport SvelteKit migration tracking
