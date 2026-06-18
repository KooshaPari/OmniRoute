# Session 11 — Gateway fork cluster audit — 2026-06-17

**Authority:** phenotype-registry wave 15  
**Method:** `gh api` branch inventory + org consumer scan  
**Plan:** Gateway Fork Cluster — Full Rationalization (do not edit plan file)

## Executive summary

Multi-branch fork cluster distinct from HexaKit P3 eviction. Prior registry docs wrongly listed **agentapi-plusplus**, **cliproxyapi-plusplus**, and **phenotype-omlx** for archive as "no local changes." `substrate` already integrates `crates/engine-agentapi` against **agentapi-plusplus** (~456 org refs). Superset merge required before any archive consideration.

## Remote git inventory

| Repo | Archived | Branches | Fork parent | Last activity | Consumer risk |
|------|----------|----------|-------------|---------------|---------------|
| agentapi | Yes | 2 | — | 2026-05-07 | Low — tombstone |
| agentapi-plusplus | No | 35 | coder/agentapi | 2026-06-13 | **High** |
| cliproxyapi-plusplus | No | 16 | router-for-me/CLIProxyAPI | 2026-06-15 | Medium |
| bifrost | No | 339 | maximhq/bifrost | 2026-06-02 | Medium |
| OmniRoute | No | 26 | diegosouzapw/OmniRoute | 2026-06-17 | Canonical |
| substrate | No | 24 | — | 2026-06-17 | Hub |
| phenotype-omlx | Yes | 27 | jundot/omlx | 2026-05-29 | Medium |
| BytePort | Yes | 30 | — | 2026-06-17 | Done → phenotype-tooling |
| phenotype-hub | Yes | 17 | — | 2026-05-28 | Governance stub |
| agileplus-spec-harmonizer | No | 1 | — | 2026-06-12 | Affirm |
| Paginary | Yes (private) | 11 | — | 2026-06-12 | Triage |

## agentapi-plusplus — branch classification (35 branches)

| Class | Count | Branches |
|-------|-------|----------|
| **main** | 1 | `main` |
| **upstream-sync** | 2 | `sync/upstream-v0.12.2`, `complete-sync` |
| **hygiene (chore)** | 21 | `chore/*` (CI, lint, pin-actions, worklog, SAST, etc.) |
| **backup** | 2 | `backup/20260426-*` — **delete after merge** |
| **dependabot** | 5 | `dependabot/npm_and_yarn/*` — close after merge |
| **docs** | 2 | `docs/agentapi-plusplus-sladge-*` |
| **ci** | 1 | `ci/add-golangci-lint` |
| **fix** | 1 | `fix/pull-request-target` |

**Merge order (G15):** `sync/upstream-v0.12.2` → squashed `chore/*` → `main`. Drop `backup/*`, stale dependabot.

## cliproxyapi-plusplus — branch classification (16 branches)

| Class | Count | Branches |
|-------|-------|----------|
| **main** | 1 | `main` |
| **hygiene (chore)** | 8 | `chore/*` |
| **cursor/WIP** | 4 | `cursor/*` — triage before merge |
| **convoy** | 1 | `convoy/agileplus-kilo-specs-cliproxyapi/*` |
| **dependabot** | 1 | `dependabot/go_modules/golang.org/x/text-0.37.0` |
| **docs** | 1 | `docs/sladge-badge` |

## bifrost — branch noise (339 branches)

| Pattern | Approx count | Action (G17) |
|---------|--------------|--------------|
| `graphite-base/*` | 102 | Bulk delete (confirm no open PRs) |
| `snyk-*` | 21 | Bulk delete |
| Remaining | ~216 | Track on `phenotype/vendor-2026-06` |

## agentapi vs agentapi-plusplus

No shared git history. Archived `agentapi` has 6–7 docs-only commits (CODEOWNERS, SECURITY, FUNDING, supersession redirect). Safe to leave archived; cherry-pick governance files into plusplus if missing.

## Known consumers

| Consumer | Reference |
|----------|-----------|
| substrate | `crates/engine-agentapi` |
| sharecli | agentapi integration |
| phenotype-landing | `repos.json` |
| phenoRouterMonitor | project JSON |
| AgilePlus | ARCHITECTURE.md |
| argis-extensions | `wrappers/cliproxy/client.go` |
| phenotype-go-sdk | `third_party/cliproxyapi-plusplus` |

## Doctrine (three layers)

| Layer | Examples | Action |
|-------|----------|--------|
| **Governance** | phenotype-registry, phenotype-infra | Ledgers + stub absorption |
| **Platform** | agentapi++, cliproxy++, OmniRoute, substrate, omlx client | Superset merge |
| **Engine** | bifrost, jundot/omlx, nanovms | Vendor pin + prune |

## Rulings

- **OmniRoute** = CANONICAL LLM router (TS) — never archive
- **Tokn** `tokenledger::routing` = CANONICAL Rust routing — not bifrost
- **bifrost** = vendor AI gateway — engine only
- **agentapi++** = agent terminal control plane — platform via substrate

## Verification commands

```bash
gh api repos/KooshaPari/{repo}/branches --paginate --jq 'length'
gh search code "agentapi-plusplus org:KooshaPari" --limit 50
gh search code "cliproxyapi org:KooshaPari" --limit 50
```
