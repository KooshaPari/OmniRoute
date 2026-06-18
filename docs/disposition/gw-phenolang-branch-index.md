# PhenoLang branch index — gw-phenolang triage (2026-06-18)

**Source:** `KooshaPari/PhenoLang` remote heads (28 branches).  
**Target:** `phenoUtils` extraction index per Wave H charter H8.  
**Disposition row:** `gw-phenolang` — ABSORB → phenoUtils, `fsm: in_progress`.

## Summary

| Verdict | Count | Action |
|---------|-------|--------|
| **keep** | 2 | Retain on PhenoLang until main absorbs or phenoUtils pin lands |
| **extract** | 5 | Cherry-pick governance + test-infra deltas into phenoUtils |
| **archive** | 21 | Delete remote after extract pass; `*/feat/docs-site` staging obsolete |

## Branch ledger

| # | Branch | SHA (short) | Verdict | Rationale |
|---|--------|-------------|---------|-----------|
| 1 | `main` | `8ae426ff` | **keep** | Canonical trunk; phenoUtils absorption baseline |
| 2 | `agileplus-agents/feat/docs-site` | `c23bbb38` | **archive** | Stale docs-site staging; no unique DSL/runtime delta |
| 3 | `apps/feat/docs-site` | `2a76a763` | **archive** | Stale docs-site staging |
| 4 | `artifacts/feat/docs-site` | `7ab72639` | **archive** | Stale docs-site staging |
| 5 | `bifrost/feat/docs-site` | `5c5687af` | **archive** | Stale docs-site staging |
| 6 | `chore/add-cargo-deny-workflow` | `8aadc22f` | **extract** | Cargo-deny workflow → phenoUtils `.github/workflows/` |
| 7 | `chore/codeowners-0428` | `cb694b97` | **archive** | Superseded by fleet CODEOWNERS on canonical repos |
| 8 | `chore/pre-commit-bootstrap` | `7c0ecf27` | **extract** | Pre-commit bootstrap → phenoUtils governance kit |
| 9 | `chore/scorecard-bootstrap` | `7c0ecf27` | **extract** | OpenSSF scorecard bootstrap → phenoUtils |
| 10 | `clikit/feat/docs-site` | `28285771` | **archive** | Stale docs-site staging |
| 11 | `crates/feat/docs-site` | `ee3fd396` | **archive** | Stale docs-site staging |
| 12 | `cve-residual-fix` | `b84a5699` | **keep** | Active CVE residual patch; merge or extract before archive sweep |
| 13 | `fix/gitignore-v2` | `b2dce775` | **archive** | One-off gitignore fix; absorbed or obsolete on main |
| 14 | `fix/phenotype-test-infra` | `6c5ca927` | **extract** | Test-infra fix → phenoUtils / TestingKit cross-pin |
| 15 | `koosha-portfolio/feat/docs-site` | `d38f9b69` | **archive** | Stale docs-site staging |
| 16 | `packages/feat/docs-site` | `c14bbf6e` | **archive** | Stale docs-site staging |
| 17 | `phench/feat/docs-site` | `c14bbf6e` | **archive** | Stale docs-site staging (shared tip with packages) |
| 18 | `pheno-cli/feat/docs-site` | `54045c59` | **archive** | Stale docs-site staging |
| 19 | `phenotype-infrakit/feat/docs-site` | `8a73caa7` | **archive** | Stale docs-site staging |
| 20 | `phenotype-router-monitor/feat/docs-site` | `15fb3458` | **archive** | Stale docs-site staging |
| 21 | `plans/feat/docs-site` | `2bc6b94f` | **archive** | Stale docs-site staging |
| 22 | `platforms/feat/docs-site` | `2bc6b94f` | **archive** | Stale docs-site staging (shared tip with plans) |
| 23 | `prompts/feat/docs-site` | `6f958762` | **archive** | Stale docs-site staging |
| 24 | `proto/feat/docs-site` | `6f958762` | **archive** | Stale docs-site staging (shared tip with prompts) |
| 25 | `python/feat/docs-site` | `b2b2f156` | **archive** | Stale docs-site staging |
| 26 | `repos/feat/docs-site` | `9ea21275` | **archive** | Stale docs-site staging |
| 27 | `rust/feat/docs-site` | `ca0cf1ec` | **archive** | Stale docs-site staging |
| 28 | `scripts/feat/docs-site` | `a7470c19` | **archive** | Stale docs-site staging |

## Next steps

1. Open phenoUtils PR for five **extract** branches (governance + test-infra).
2. After extract merges, delete 21 **archive** remotes via `git push origin --delete '<branch>'` (requires repo admin; `gh api` DELETE returned 404 with current token — 2026-06-18).
3. Close `gw-phenolang` disposition row (`fsm: done`) when phenoUtils index is canonical.

## References

- [wave-h-gateway-charter-2026-06-17.md](../operations/wave-h-gateway-charter-2026-06-17.md) — H8 PhenoLang
- [wave14-gateway-ssot-2026-06-17.md](../operations/wave14-gateway-ssot-2026-06-17.md) — backlog item 9
