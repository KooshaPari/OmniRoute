# Queue Refresh: Wave 2 — 2026-07-17

This queue refreshes the 10-deep absorption pipeline after the previous
wave (v1.5.5 → v1.6.6) successfully absorbed 14 repos:

**Previous wave (DONE):**
1. `phenotype-router-spec` → `phenotype-registry` (docs/specs/)
2. `pheno-context` → `pheno` (crates/pheno-context)
3. `phenoResearchEngine` → `phenoAI` (airlock daemon)
4. `PolicyStack` → `phenotype-python-sdk` (airlock daemon)
5. `phenotype-pm-core` → `phenotype-tooling` (airlock daemon)
6. `KodeVibe` → `phenotype-tooling` (airlock daemon bonus)
7. `grapheon-bindings` → `phenotype-go-sdk/packages/graphclient`
8. `pheno-cdylib-bridge` → `pheno` (crates/pheno-cdylib-bridge)
9. `phench` → `phenotype-tooling/crates/phench` (redirected from phenodocs)
10. `template-commons` → `phenokits-commons/templates` (12 templates + kitty-specs)
11. `Logify` → `PhenoObservability/crates/logkit` (overlay on prior scaffold)
12. `phenoEvents` → `pheno/crates/phenotype-event-bus` (airlock daemon parallel)
13. `phenoDesign` → `phenodocs/packages/design`
14. `Quillr` (with Httpora reconciliation) → `pheno/crates/httpora-core` + `phenodocs/packages/quillts`

## Wave 2 picks — 10 NEW candidates

| # | Repo | Size | Lang | Target | Rationale |
|---|------|------|------|--------|-----------|
| 1 | `Tokn` | 2.4MB | Rust | `pheno` monorepo `crates/tokn` | Rust JWT/token primitives; small, hexagonal |
| 2 | `Stashly` | 222KB | Rust | `pheno` monorepo `crates/stashly` | Rust caching framework, hexagonal; pure library |
| 3 | `Sidekick` | 549KB | Rust | `pheno` monorepo `crates/sidekick` | Phenotype agent-facing utilities (presence/LLM routing) — multi-language workspace |
| 4 | `phenoUtils` | 222KB | Rust | `pheno` monorepo `crates/pheno-utils` | Five Rust primitive crates (crypto/fs/net/shell/testing); SUPPERSEDED history → re-affirm into pheno |
| 5 | `PhenoPlugins` | 584KB | Rust | `pheno` monorepo `crates/phenotype-plugins` | Phenotype plugin system ports; hexagonal |
| 6 | `phenoData` | 474KB | Rust | `pheno` monorepo `crates/pheno-data` | Phenotype data primitives |
| 7 | `audit-tool` | 5KB | Python | `phenotype-registry/scripts/` | Repo-quality audit scorecard tool; governance artifact |
| 8 | `scripts` | 6KB | Shell | `phenotype-tooling/bin/` (or phenotype-registry/scripts/) | AI-DD pipeline/eval/judge shell scripts; tooling |
| 9 | `curated-traces` | 6.6MB | Python | `PhenoObservability/curated-traces/` | Replay + curated dataset; observability replay tooling |
| 10 | `phenotype-org-audits` | 11.8MB | Shell | `phenotype-registry/audits/org-audit-snapshots/` | Org-wide audit snapshots; historical governance |

## Queue maintenance invariant

The registry invariant: **always keep at least 10 candidates queued**
(`fsm=active` in `disposition-index.json`). When a candidate is absorbed
(`fsm=absorbed`), a new candidate must be picked from the next-least-active
list within the same wave commit.

## Notes on filtering

The candidate list deliberately **excludes**:

- Repos already KEEP/AFFIRM in prior waves (PhenoRuntime, focalpoint-orphan-snapshot, etc.)
- Recovery snapshots (`-archive-2026-07-14`, `Tracera-recovery-*`)
- Empty repos (diskUsage = 0KB)
- Snapshot/dirty repos (`-uncommitted-*`, `-final2-*`, `-wt-*`)
- Repos >50MB (need their own audit phase): `FocalPoint`, `bifrost`, `Grapheon`, `BytePort`, `cliproxyapi-plusplus`, `AgilePlus`
- Repos already in registry as `fsm=absorbed`: the 14 above + 86 from prior waves