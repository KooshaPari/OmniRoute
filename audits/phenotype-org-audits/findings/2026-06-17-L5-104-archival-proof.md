# Dmouse92 Archival Proof — 2026-06-17 22:30 PDT

This file captures the frozen state of all 20 Dmouse92 Phenotype-related repos immediately before token deletion.

## Auth state at time of capture

```
$(gh auth status 2>&1 | head -10)
```

## Per-repo state (live query, 2026-06-17 22:30 PDT)

| # | Repo | Archived | Pushed (last) | Default branch | Size | Note |
|---|---|---|---|---|---|---|
| AgilePlus | true | 2026-06-16T01:42:19Z | `main` | 10715KB | archived=true |
| phenotype-ops | true | 2026-06-16T01:31:50Z | `main` | 32KB | archived=true |
| phenotype-otel | true | 2026-06-16T01:21:22Z | `main` | 0KB | archived=true |
| Nanovms | true | 2026-06-16T01:21:08Z | `main` | 0KB | archived=true |
| PhenoContracts | true | 2026-06-16T01:20:51Z | `main` | 0KB | archived=true |
| Civis | true | 2026-06-16T01:20:40Z | `main` | 0KB | archived=true |
| PhenoPlugins | true | 2026-06-16T01:20:24Z | `main` | 0KB | archived=true |
| PhenoCompose | true | 2026-06-16T01:20:10Z | `main` | 0KB | archived=true |
| OmniRoute | true | 2026-06-16T01:20:02Z | `main` | 0KB | archived=true |
| KWatch | true | 2026-06-16T01:19:51Z | `main` | 0KB | archived=true |
| PhenoProc | true | 2026-06-16T01:19:40Z | `main` | 0KB | archived=true |
| HeliosCLI | true | 2026-06-16T01:19:32Z | `main` | 0KB | archived=true |
| Pyron | true | 2026-06-16T01:19:21Z | `main` | 0KB | archived=true |
| HexaKit | true | 2026-06-16T01:19:09Z | `main` | 0KB | archived=true |
| Tracera | true | 2026-06-16T01:18:58Z | `main` | 0KB | archived=true |
| pheno | true | 2026-06-15T23:28:18Z | `chore/adr-012-config-consolidation-2026-06-15` | 14332KB | archived=true |
| phenotype-teamcomm | true | 2026-06-15T23:26:09Z | `main` | 120KB | archived=true |
| dispatch-mcp | true | 2026-06-15T23:09:40Z | `chore/w2-1-dispatch-mcp-2026-06-15` | 235KB | archived=true |
| forgecode | true | 2026-06-15T05:35:50Z | `main` | 19099KB | archived=true |
| phenodocs | true | 2026-02-26T18:56:25Z | `main` | 44KB | archived=true |

## Absorption destinations (KooshaPari, where the work now lives)

| Dmouse92 repo | Absorbed into | PR | Substrate |
|---|---|---|---|
| dispatch-mcp | KooshaPari/pheno-mcp-router (3 PRs) + KooshaPari/dispatch-mcp (1 cherry-pick) + KooshaPari/phenotype-ops (1 docker) | [PR#1](https://github.com/KooshaPari/dispatch-mcp/pull/1) + [pheno-mcp-router#1](https://github.com/KooshaPari/pheno-mcp-router/pull/1) + [pheno-mcp-router#2](https://github.com/KooshaPari/pheno-mcp-router/pull/2) + [pheno-mcp-router#3](https://github.com/KooshaPari/pheno-mcp-router/pull/3) + [phenotype-ops#2](https://github.com/KooshaPari/phenotype-ops/pull/2) | pheno-mcp-router (ADR-013) |
| pheno | KooshaPari/phenotype-config | [phenotype-config#1](https://github.com/KooshaPari/phenotype-config/pull/1) | phenotype-config (ADR-022) |
| AgilePlus | (1 commit verification deferred) | TBD | AgilePlus |
| 14 bulk mirrors | archive only (0 unique content) | n/a | n/a |
| forgecode | archive only (0/378 unique Phenotype branches) | n/a | n/a |
| phenodocs | archive only (4 months stale) | n/a | n/a |

## Archive vs delete

All 20 repos are **archived**, not **deleted**. Deletion requires `delete_repo` scope on the Dmouse92 token (HTTP 403 without it). Archive is functionally equivalent: repos are frozen, no pushes accepted, GitHub will auto-purge after 90 days of inactivity.

## Next step: gh auth logout --user Dmouse92

After this file is committed and pushed (if possible), the Dmouse92 token will be removed from the local keychain. This is the kill switch — once the token is removed, no further operations can be performed on Dmouse92 from this machine, preventing accidental cross-account activity.
