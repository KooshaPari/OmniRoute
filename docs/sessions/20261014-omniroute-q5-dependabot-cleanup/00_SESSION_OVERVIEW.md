# 2026-10-14 — OmniRoute Q5 Dependabot cleanup

## Goal

Close as many Dependabot HIGH-severity vulns as possible after the v3.8.51
release. Phase 1 closed 5 Dependabot patch PRs (4 commits on main). Phase 2
addresses 3 remaining HIGH-severity vulns that were not in any open Dependabot
PR but became visible after the initial batch landed.

## Phase 1 — 5 Dependabot PRs closed (4 commits on main)

| Commit | PR | Description |
|---|---|---|
| `4901925f74` | Q1 batch | next 16.3.3→16.3.8, dompurify ^3.4.14→^3.4.16 (2 PRs direct) |
| `c0496f1b23` | sync | pnpm-lock sync (next 16.3.8, dompurify 3.4.15) |
| `d81e779699` | Q1 batch | dompurify ^3.4.17 (resolved 3.4.15→3.4.17) |
| `8fd9cf88d7` | pnpm.overrides | 4 transitive Dependabot bumps: ip-address 10.7.4, express-rate-limit 8.7.1, @grpc/grpc-js 1.14.6, ibm-cloud-sdk-core 5.9.0 |

5 Dependabot alerts resolved by this phase.

## Phase 2 — newly visible HIGH-severity vulns

| # | Vuln | Status |
|---|---|---|
| #404 | sharp 0.35.4 → 0.35.5 (librsvg RCE, CVSS 8.9) | ✓ Fixed in `f4c6a51cb0` |
| #405 | @modelcontextprotocol/sdk 1.30.0 → 1.32.1 (OAuth creds leak, CVSS 7.5) | ✓ Fixed in `7646844fce` |
| #403 | simple-git 3.36.0 (config RCE, no fix released) | ⚠ Documented as known-issue (see 05_KNOWN_ISSUES.md) |

## Net result

- 7 Dependabot alerts closed across 2 phases
- 1 known-issue added (transitive, devDep-only, no production exposure)
- v3.8.51 → v3.8.52 (next tag not yet created)

## Untouched (per Q2-A decision)

- `~/.omniroute/storage.sqlite`
- 3,738 WIP files in working tree (target/.rustc_info.json, apps/web/src/routes/dashboard/+page.server.ts, desktop-electrobun/, electron/, docs/guides/ELECTRON_GUIDE.md, etc.)
- Pre-existing failures on main remain documented

## Next (if operator wants to continue)

- Tag v3.8.52 once Dependabot re-scans and confirms #404, #405 closed
- Address #403 when simple-git ships a fix (no ETA — main branch lacks one)
- Investigate the 5 Dependabot auto-PRs that were queued but never opened (source-map-js, smol-toml, compression, katex, proxy-addr)
