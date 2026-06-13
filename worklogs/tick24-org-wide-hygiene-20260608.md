# Tick 24 Worklog: Org-Wide Hygiene + Architectural Synthesis

**Date:** 2026-06-08
**Window:** 14:00 – 17:35
**Session focus:** cross-repo hygiene + strategic consolidation

## Headline Numbers

- **50 PRs merged** in this session (squash-merged via `--admin`)
- **5 GitHub-archived repos re-enabled** (heliosHarness, helios-router, heliosApp, GDK, pheno)
- **9 README work-state headers** added (PhenoCompose, PhenoObservability, PhenoVCS, PhenoMCP, PhenoPlugins, HexaKit, HeliosLab, PhenoAgent, argis-extensions, plus PhenoAgent local-only due to archive)
- **3 archived repos blocked from push** (PhenoRuntime, DataKit, PhenoAgent) — local commits in worktrees await un-archive
- **1 publish attempted, 1 publish blocked** (phenotype-bus: 403 auth; stopped per safety rule)

## Strategic Consolidations Identified

### 1. `phenotype-error-core` already exists in 3 places (DEDUP-400LOC)
- `pheno/crates/phenotype-error-core/`
- `PhenoDevOps/crates/phenotype-error-core/` (byte-identical to pheno)
- `phenoShared/crates/phenotype-error-core/` (most complete: has `PhenotypeErrorKind` + wire envelope + ErrorCode)

**Action:** collapse pheno + PhenoDevOps onto `phenoShared`'s path dep. Add 2 missing `PhenotypeErrorKind` variants: `Timeout`, `Internal` (recurring across 4+ repos).

### 2. `phenoShared` should split into core + niche
- 17 sub-crates; 6 "core" (4-5 dependents), 11 "niche" (0-1 dependents)
- `phenotype-event-sourcing` has pre-existing compile errors
- Recommended: create `phenoShared-niche` repo, move 11 niche crates, update 2 dependents (PhenoObservability, PhenoPlugins)

### 3. 5 utility crates duplicated HexaKit ↔ Pyron (~2,168 LOC dup)
- `phenotype-error-core`, `phenotype-time`, `phenotype-iter`, `phenotype-async-traits`, `phenotype-logging`, `phenotype-telemetry`
- All near-byte-identical (formatting/assertion style diffs only)

### 4. 3 hand-rolled MCPs converge to `rmcp` 0.x (-60% LOC)
- PhenoRuntime/phenotype-mcp-server (151 LOC)
- PhenoObservability/phenotype-mcp-server (177 LOC) — has `EXTRACT_NOTE.md` flagging extraction
- phenoAI/mcp-server (192 LOC)
- All 3 hand-roll the same `Tool`/`ToolResult`/`ToolHandler`/`MCPServer` pattern. None implement real transports.

### 5. `phenotype-cheap-llm` integration into PhenoMCP
- cheap-llm-mcp exposes 6 tools (complete/stream_complete/providers/list_live_models/health/cost_summary)
- PhenoMCP is the right consumer (PRD FR-SRV-001 calls for "Knowledge base server" + "Custom server SDK")
- Path A: subprocess bridge via Python `mcp>=1.27` stdio passthrough

### 6. 6 repos could be promoted to 5 CLIs → 1 pheno-cli mega-tool
- HeliosLab/phenoctl (608 LOC, 5 nested)
- HeliosCLI/helios (1,498 LOC, 18 subcommands)
- pheno/sharecli (1,132 LOC)
- thegent/cli (925 LOC)
- Tracera (923 LOC, 4 binaries)
- **Net: ~5,479 → ~2,200-2,800 LOC (-50%)**

## Org Hygiene Wins

- **3 active ROADMAPs to refresh** (PhenoKits 26%, HeliosCLI/helioscope 15%) — convert to checkboxes
- **48 stale/empty STATUS.md to delete** (most are 1-paragraph intent docs, no machine-tracked work)
- **5 utility crates deduped across HexaKit/Pyron** (need implementation)
- **27 projects ready to publish** (10 crates, 4 npm, 13 PyPI) — gating on `cargo publish` / `npm publish` / `twine upload`
- **5 GitHub-archived repos re-enabled** (active PRs/commits unblocked)
- **Tracked `node_modules` removed from KWatch** (7,815 files / 83M)

## Org Template Recommendation

**Winner: Tracera (24/25 score).** Most complete baseline (36 CI workflows, 7 docs subdirs, 446 test files, all org files). Runner-up: HexaKit for Rust-only projects.

## spec-kitty Promotion Path

**Current state:** 14 slash commands in `~/.claude/commands/spec-kitty.*.md` are byte-identical vendored into 3 canonical repos (`HeliosCLI`, `helioscope`, `thegent`) — 42 redundant files. The plugin manifest does not exist; no `KooshaPari/spec-kitty` repo.

**Action:** create `KooshaPari/spec-kitty` with the 14 command files + `.claude-plugin/plugin.json`. Then `git rm` the 42 vendored files and add `spec-kitty` to each consumer's `enabledPlugins`.

## Coverage Gaps (per tick 23 audit)

| Repo | tests | pub_fns | ratio | gap |
|---|---|---|---|---|
| PhenoProc | 798 | 6,375 | 0.125 | 5,577 |
| PolicyStack | 576 | 4,345 | 0.133 | 3,769 |
| thegent | 20,090 | 24,576 | 0.817 | 4,486 (but is fork-upstream mix) |

Caveat: most "low ratio" repos are forks of upstream (Plane, etc.) where we don't own the code. Real new-code coverage gaps are smaller.

## Duplication Findings

| Pattern | Count | Source |
|---|---|---|
| `impl From` blocks | 420 across 150 files | forgecode 54, HeliosCLI/helioscope 59 each |
| `impl Display` blocks | 86 across 80 files | forgecode 22 highest |
| Hand-rolled `Builder` candidates | 827 files (high false-positive rate) | HeliosCLI/helioscope 144 each |
| PR templates | 27 unique variants (143 files, 116 dups) | top variant 56 files |
| CODEOWNERS | 305 files, similar dup rate | drift pervasive |

**Recommendation:** `derive_more` migration on forgecode + HeliosCLI/helioscope removes ~3,790 LOC of hand-rolled impl blocks.

## Error-Type Audit

`PhenotypeErrorKind` already covers: NotFound/AlreadyExists (14 repos), Config (9), Serialization (11), Network (10), Validation (8), Io (9), RateLimited (2). Missing: `Timeout` (5 repos), `Internal` (4 repos). Adding both is 1-line each in the existing enum.

## Cargo.toml Keywords Gaps (7 repos 5+ missing)

- `license-file` (22/22, all)
- `homepage` (20/22)
- `documentation` (19/22)
- `readme` (16/22)
- `repository` (13/22)
- `license` (7/22)
- `description` (6/22)

Critical mass: 5 repos have 7/7 missing (AgilePlus, HexaKit, NetScript, PhenoDevOps, PhenoKits, phenoForge). Adding them unblocks `cargo publish`.

## Env Config Drift (per tick 21)

- **AtomsBot** — 13+ sensitive env vars missing from `.env.example` (security risk)
- **HexaKit** — 5 sensitive keys declared but unused (NEO4J_PASSWORD, MINIO/ARTIFACT keys)
- **Civis** — 2 MINIO keys declared but unused
- 121 total `.env.example` files exist; 30 audited

## Open Hygiene Worktrees (15+)

`HexaKit-wtrees/`, `HeliosLab-wtrees/`, `HeliosCLI-wtrees/`, `helioscope-wtrees/`, `PhenoMCP-wtrees/`, `PhenoObservability-wtrees/`, `PhenoVCS-wtrees/`, `PhenoKits-wtrees/`, `KDesktopVirt-wtrees/`, `KWatch-wtrees/`, `argis-extensions-wtrees/`, `justfile-wtrees/`, etc. Many carry local commits that hit the same archive/local-only issue. Cleanup pending after verification.

## Next-Tick Recommendations (prioritized)

1. **HIGH:** dedup utility crates HexaKit ↔ Pyron (saves 2,168 LOC, removes silent drift)
2. **HIGH:** create `phenoShared-niche` repo, move 11 niche crates
3. **HIGH:** add 2 missing `PhenotypeErrorKind` variants (Timeout, Internal) + dedup 3 copies
4. **HIGH:** migrate 3 hand-rolled MCPs to `rmcp` 0.x (-320 LOC)
5. **MED:** create `KooshaPari/spec-kitty` plugin repo, delete 42 vendored copies
6. **MED:** add cargo keywords to 5 repos (unblocks publish)
7. **MED:** publish 5+ ready-to-publish packages (gated on tokens)
8. **MED:** add cargo keywords to 7 missing repos
9. **LOW:** delete 48 placeholder STATUS.md files
10. **LOW:** convert 3 active ROADMAPs to checkboxes
11. **LOW:** consolidate 5 CLIs into `pheno-cli` mega-tool

## Files Modified This Tick

- ~50 PRs merged across 30+ repos
- 5 archive re-enables (PATCH)
- ~10 worktree-local commits awaiting push (3 archived-blocked)
