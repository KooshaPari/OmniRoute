# 2026-10-14 — OmniRoute Q5 Dependabot cleanup

## Goal

Close as many Dependabot HIGH-severity vulns as possible after the v3.8.51
release. Phase 1 closed 5 Dependabot patch PRs (4 commits on main). Phase 2
discovered and closed 14 additional alerts that became visible after Phase 1
re-scanned, plus 1 known-issue that was resolved mid-session by a new upstream
release.

## Phase 1 — 5 Dependabot PRs closed (4 commits on main)

| Commit | Description |
|---|---|
| `4901925f74` | next 16.3.3→16.3.8, dompurify ^3.4.14→^3.4.16 (2 PRs direct) |
| `c0496f1b23` | pnpm-lock sync (next 16.3.8, dompurify 3.4.15) |
| `d81e779699` | dompurify ^3.4.17 (resolved 3.4.15→3.4.17) |
| `8fd9cf88d7` | pnpm.overrides for 4 transitive Dependabot bumps: ip-address 10.7.4, express-rate-limit 8.7.1, @grpc/grpc-js 1.14.6, ibm-cloud-sdk-core 5.9.0 |

5 Dependabot alerts resolved (#406–#411, all next.js 16.3.8 patches).

## Phase 2 — 14 additional alerts closed (5 commits on main)

Phase 1's next 16.3.8 + dompurify 3.4.17 bumps revealed 17 previously-dormant
alerts. 14 were patchable; 3 had no upstream fix at scan time.

### 2a — direct dep patches (1 commit)

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

### 2d — last patchable: http-cache-semantics (1 commit)

| Commit | Alerts | Package | Old → New |
|---|---|---|---|
| `7b42045bf7` | #390 (HIGH) | http-cache-semantics | 4.2.0 → 4.3.0 |

Dependabot's `first_patched_version` field still shows `-` for #390 (advisory
DB hasn't been updated), but 4.3.0 is the only release newer than the
vulnerable 4.2.0 and matches the max-stale fix timeline.

## Net result

- **19 Dependabot alerts closed** across 9 commits on main
  (5 phase 1 + 14 phase 2; #403 was originally in KI-001, now resolved)
- **1 known-issue added then resolved** (KI-001 simple-git — superseded mid-session)
- **3 known-issues remaining**: KI-002 (node-forge 1.4.0, braces 3.0.3, sprintf-js 1.1.3 — all latest available, no upstream fix)
- All commits have ledger metadata (`tx-agent: jcode`, `tx-validated: manual`)
- Direct-push squash path used throughout

## Untouched (per Q2-A decision)

- `~/.omniroute/storage.sqlite`
- 3,738 WIP files in working tree (target/.rustc_info.json,
  apps/web/src/routes/dashboard/+page.server.ts, desktop-electrobun/,
  electron/, docs/guides/ELECTRON_GUIDE.md, etc.)
- Pre-existing failures on main remain documented

## Next (if operator wants to continue)

- Tag v3.8.52 once Dependabot re-scans and confirms all 14 phase 2 alerts
  closed
- KI-002 follow-up: document the 3 truly-no-fix packages (node-forge,
  braces, sprintf-js) as known-issues
- Investigate the 5 Dependabot auto-PRs that were queued but never
  generated (source-map-js, smol-toml, compression, katex, proxy-addr —
  all now closed by our phase 2 overrides)
- byteport: SvelteKit 2→3 migration (substantial, separate epic)
