# PhenoLang branch index — gw-phenolang triage (2026-06-18)

**Source:** `KooshaPari/PhenoLang` remote heads (28 branches).  
**Target:** `phenoUtils` extraction index per Wave H charter H8.  
**Disposition row:** `gw-phenolang` — ABSORB → phenoUtils, `fsm: done` (2026-06-18).

**Canonical index:** [phenoUtils/docs/phenolang-monorepo-index.md](https://github.com/KooshaPari/phenoUtils/blob/main/docs/phenolang-monorepo-index.md) (phenoUtils#63, phenoUtils#66).

## Summary

| Verdict | Count | Action |
|---------|-------|--------|
| **keep** | 1 | `main` only — archived read-only reference |
| **close** | 27 | Stale docs-site sprawl, absorbed hygiene, or landed fixes — no cherry-pick |

Remote branch sweep **complete 2026-06-19:** temporarily unarchived → deleted all 27 CLOSE remotes (20 `*/feat/docs-site` + 7 chore/fix) → re-archived; `main` retained as read-only reference.

## Branch ledger

| # | Branch | SHA (short) | Verdict | Rationale |
|---|--------|-------------|---------|-----------|
| 1 | `main` | `8ae426ff` | **keep** | Canonical trunk; archived read-only reference |
| 2 | `agileplus-agents/feat/docs-site` | `c23bbb38` | **close** | Stale docs-site staging; no unique DSL/runtime delta |
| 3 | `apps/feat/docs-site` | `2a76a763` | **close** | Stale docs-site staging |
| 4 | `artifacts/feat/docs-site` | `7ab72639` | **close** | Stale docs-site staging |
| 5 | `bifrost/feat/docs-site` | `5c5687af` | **close** | Stale docs-site staging |
| 6 | `chore/add-cargo-deny-workflow` | `8aadc22f` | **close** | Cargo-deny absorbed in phenoUtils `.github/workflows/` |
| 7 | `chore/codeowners-0428` | `cb694b97` | **close** | Superseded by fleet CODEOWNERS on canonical repos |
| 8 | `chore/pre-commit-bootstrap` | `7c0ecf27` | **close** | Pre-commit absorbed in phenoUtils governance kit |
| 9 | `chore/scorecard-bootstrap` | `7c0ecf27` | **close** | OpenSSF scorecard absorbed in phenoUtils |
| 10 | `clikit/feat/docs-site` | `28285771` | **close** | Stale docs-site staging |
| 11 | `crates/feat/docs-site` | `ee3fd396` | **close** | Stale docs-site staging |
| 12 | `cve-residual-fix` | `b84a5699` | **close** | Fix landed in HexaKit / phenoUtils |
| 13 | `fix/gitignore-v2` | `b2dce775` | **close** | One-off gitignore fix; absorbed or obsolete on main |
| 14 | `fix/phenotype-test-infra` | `6c5ca927` | **close** | Test-infra fix landed in phenoUtils / TestingKit |
| 15 | `koosha-portfolio/feat/docs-site` | `d38f9b69` | **close** | Stale docs-site staging |
| 16 | `packages/feat/docs-site` | `c14bbf6e` | **close** | Stale docs-site staging |
| 17 | `phench/feat/docs-site` | `c14bbf6e` | **close** | Stale docs-site staging (shared tip with packages) |
| 18 | `pheno-cli/feat/docs-site` | `54045c59` | **close** | Stale docs-site staging |
| 19 | `phenotype-infrakit/feat/docs-site` | `8a73caa7` | **close** | Stale docs-site staging |
| 20 | `phenotype-router-monitor/feat/docs-site` | `15fb3458` | **close** | Stale docs-site staging |
| 21 | `plans/feat/docs-site` | `2bc6b94f` | **close** | Stale docs-site staging |
| 22 | `platforms/feat/docs-site` | `2bc6b94f` | **close** | Stale docs-site staging (shared tip with plans) |
| 23 | `prompts/feat/docs-site` | `6f958762` | **close** | Stale docs-site staging |
| 24 | `proto/feat/docs-site` | `6f958762` | **close** | Stale docs-site staging (shared tip with prompts) |
| 25 | `python/feat/docs-site` | `b2b2f156` | **close** | Stale docs-site staging |
| 26 | `repos/feat/docs-site` | `9ea21275` | **close** | Stale docs-site staging |
| 27 | `rust/feat/docs-site` | `ca0cf1ec` | **close** | Stale docs-site staging |
| 28 | `scripts/feat/docs-site` | `a7470c19` | **close** | Stale docs-site staging |

## Closeout (2026-06-18)

1. phenoUtils extraction index + 28-branch triage table merged (phenoUtils#63, phenoUtils#66).
2. Registry branch ledger complete (phenotype-registry#174); disposition row `gw-phenolang` → `fsm: done` with phenoUtils pin in `components.lock` (phenotype-registry#189).
3. Remote branch sweep **done 2026-06-19:** temporarily unarchived → deleted all 27 CLOSE remotes → re-archived; `main` retained (phenotype-registry#207, #208).

## References

- [wave-h-gateway-charter-2026-06-17.md](../operations/wave-h-gateway-charter-2026-06-17.md) — H8 PhenoLang
- [wave14-gateway-ssot-2026-06-17.md](../operations/wave14-gateway-ssot-2026-06-17.md) — backlog item 9
