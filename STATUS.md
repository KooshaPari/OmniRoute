# STATUS.md — Phenotype monorepo

**Date:** 2026-06-18 (v8 launch; refresh from 2026-06-17 12:00 PDT baseline)
**Branch in use:** `archive/2026-06-15-30-pillar-fleet` (HEAD `5df6904e9e` "docs(audit): L5-104 e2e DAG final sign-off — T1.14 kill-switch EXECUTED")
**Origin remote:** `KooshaPari/phenotype-apps` (was `KooshaPari/FocalPoint` per stale AGENTS.md prior to 2026-06-18; corrected via T9.3)
**Working tree:** 204 dirty (submodule pointer drifts pre-existing; no user-authored content; see AGENTS.md § "Stale / warnings")

This file supersedes the 2026-06-17 12:00 PDT version. Refreshed for v8 launch.

---

## 2026-06-18: 4-repo absorption complete (L5-109..114, gfx wave)

**4 source repos absorbed into `KooshaPari/phenotype-gfx` per ADR-004 transition; all 4 archived + deleted on GitHub.**

| Metric | Value | Source |
|---|---|---|
| **Source repos** | 4 (phenotype-voxel, phenotype-terrain, phenotype-water, phenotype-postfx) | all archived + deleted 2026-06-18 |
| **Target repo** | `KooshaPari/phenotype-gfx` | ADR-004 transition |
| **PRs merged** | 4 (`phenotype-gfx#10` migration, `#11` audit sync; `phenotype-registry#200` pre-archive SUPERSEDE, `#203` post-archive fsm=archived) | `gh pr view` |
| **PRs closed (superseded)** | 2 (`phenotype-gfx#9` superseded by #10; `phenotype-registry#200` superseded by #203) | `gh pr close` 2026-06-18 |
| **Lines migrated** | 18,957 | sum of `phenotype-gfx#10` (+18,000) + `#11` (+957) per `gh pr view --json additions` |
| **Tests pass on main** | 311 | `phenotype-gfx` post-merge CI |
| **Registry fsm=archived** | 4/4 | `phenotype-registry` rows for voxel, terrain, water, postfx flipped 2026-06-19 00:22:05Z via #203 |
| **Decision log** | `findings/2026-06-18-L5-114-4-repo-retirement.md` | full migration matrix + policy notes |

**Migration matrix:**

| # | Source | Target path | PR | Status |
|---|---|---|---|---|
| 1 | `phenotype-voxel` (Rust core) | `phenotype-gfx/rust/voxel/` | `phenotype-gfx#10` | MERGED 2026-06-19 00:09:50Z |
| 2 | `phenotype-terrain` (C#) | `phenotype-gfx/unity/terrain/` | `phenotype-gfx#10` | MERGED (same PR) |
| 3 | `phenotype-water` (C#) | `phenotype-gfx/unity/water/` | `phenotype-gfx#10` | MERGED (same PR) |
| 4 | `phenotype-postfx` (C#) | `phenotype-gfx/unity/postfx/` | `phenotype-gfx#10` | MERGED (same PR) |
| 5 | registry SUPERSEDE intent | `phenotype-registry/registry/disposition-index.json` | `phenotype-registry#200` | CLOSED (superseded by #203) 2026-06-18 |
| 6 | registry fsm=archived | `phenotype-registry/registry/disposition-index.json` | `phenotype-registry#203` | MERGED 2026-06-19 00:22:05Z |
| 7 | audit sync | `phenotype-gfx/AUDIT.md` | `phenotype-gfx#11` | MERGED |

---

## Real-time state (2026-06-18, v8 launch)

| Metric | Value | Source |
|---|---|---|
| **Origin** | `KooshaPari/phenotype-apps` (writable) | `git remote -v` |
| **Branches on origin** | 20 | `git ls-remote --heads origin` (apps-extract{,-all,-final}, archive/*, 13 chore/*, main, temp-rebase, wip-2026-06-17-pre-push-snapshot) |
| **Branches on local** | 18 | 2 auto-cleaned (`apps-extract`, `apps-extract-all`) when their worktrees were auto-collected; data preserved on origin |
| **Branches LOCAL_ONLY (blocked from push)** | 1 | `chore/w5-adrs-sota-2026-06-15-v2` @ `002f380717` — GitHub secret scanner false positive on `phenotype-python-sdk@7499fd2:test_v020_parity.py:api_key:str="default-key"`; see `findings/2026-06-18-T9-2-secret-block-resolution.md` |
| **Stashes** | 0 | `git stash list` |
| **Worktrees** | 1 (primary) | `/private/tmp/apps-extract*` auto-cleaned |
| **Submodule pointer drifts** | 204 | Pre-existing; not committed |
| **Real divergence from `origin/main`** | (no common ancestor — local main replaced placeholder) | Pushed via `archive/2026-06-15-30-pillar-fleet` (ADR-027 Tier 2 strategy) |
| **Dmouse92 work** | 0 | L5-104 migration 100% complete; Dmouse92 token removed from keyring (22:30 PDT 2026-06-17) |
| **V7 DAG tracks complete** | 8/8 (T1-T8 incl. Dmouse92 migration) | `plans/2026-06-17-v7-dag-stable.md` |
| **V8 DAG tracks** | 18 (T0, T9-T23, T0.5, T16.5) | `plans/2026-06-18-v8-dag-stable.md` — ~210 tasks, ~200 PRs |
| **ADRs accepted (cumulative)** | 29 (ADR-001..029) | v7 closure; v8 adds ADR-030..043 (T14.x, T16.17, T21.10, T23.8) |
| **Pre-flight gate (T0)** | T0.1 PASS, T0.2 FAIL (forge CLI hangs — R1 confirmed; fallback to orchestrator-direct), T0.3 PASS, T0.4 DEFER (4.3GB .git), T0.5 PASS | v8 launch log |
| **T9.1 (secret identify)** | COMPLETE | `phenotype-python-sdk@7499fd2:test_v020_parity.py:api_key:str="default-key"` — false positive |
| **T9.2 (secret resolve)** | DEFERRED | Requires user decision: Option A (GitHub unblock URL ~2min) recommended |
| **T9.3 (AGENTS.md refresh)** | DONE | Prior session 2026-06-18 22:58 PDT |
| **T9.4 (upstream tracking)** | DONE 2026-06-18 | 21 branches now track `origin/<branch>` (workspace markers `apps-extract*` + 18 substantive) |
| **T9.5 (STATUS refresh)** | IN PROGRESS | This commit; v8 inventory + T9.4/T9.6 status |
| **T9.6 (wrap-up commit + push)** | IN PROGRESS | `chore(governance): refresh AGENTS.md + STATUS.md for v8 launch` queued |
| **Pre-flight T0.4 (apps-extract)** | DEFER | Local `.git` is 4.3GB (Xcode build artifacts); push blocked until slimmed |

**Origin URL correction (T9.3):** `git remote set-url origin git@github.com:KooshaPari/phenotype-apps.git` — was `KooshaPari/argis-extensions`. Verified writable. 21 branches fetched.

**Workspace markers (preserved):** `apps-extract`, `apps-extract-all`, `apps-extract-final` are workspace markers per v8 DAG §3 — kept as local branches with origin tracking; data lives on origin.

---

## Carry-over from 2026-06-17 12:00 PDT (preserved for history)

| Metric | Value | Source |
|---|---|---|
| **Real divergence from main** | +32 / −0 | `git rev-list --left-right --count main...HEAD` |
| **Working tree (line-level changes)** | 1 | `.github/workflows/ci.yml` (parallel subagent) |
| **Submodule pointer drifts** | 170+ | `git status --short` |
| **pheno-* crates (visible)** | 22 | `ls -d pheno-*/` |
| **pheno-* crates (added since 2026-06-14)** | 4 | +pheno-cli-base, +pheno-fastapi-base, +pheno-flags, +pheno-otel |
| **Buildable pheno-* crates** | 21 | (excludes pheno-wtrees container, pheno-zod-schemas TS) |
| **L6 test pass/fail** | 136 / 4 | `L6_PHENO_REPOS_HEALTH_2026_06_14.md` |
| **Last L6 full audit** | 2026-06-14 (2 days stale) | File mtime |
| **Last L6 delta** | 2026-06-15 01:25 | `L6_PHENO_REPOS_HEALTH_2026_06_15_DELTA.md` |
| **V6 DAG tracks complete** | 5/5 | `findings/V6_MASTER_STATUS-2026_06_15.md` |
| **ADRs accepted (cumulative)** | 21 | `docs/adr/2026-06-14/` (6) + `docs/adr/2026-06-15/` (15) |
| **V6 DAG closure (Track 5)** | ✅ | 5 new ADRs (017-021) + 4 worklogs (L5-097..100) + 4 findings + 3 doc updates shipped |
| **Config consolidation PR-1..4 done** | 4/11 | PR-1/2/3 = pheno submodule `bd5d807`; PR-4 = root `d516bee625` (Settly fork gitlink removal, 1,320 LoC) |
| **Config consolidation PR-6/7 done** | 6/11 | PR-6 = pheno-config v0.2.0 `b3d215c889` (TOML + merge + combine, 11 tests); PR-7 = pheno-config docs `90cbfa053b` (README + 12-factor guide) |
| **Pheno submodule pointer bumped** | ✅ | `bd5d807` (delete 3 deprecated config dirs) |
| **Pyron submodule pointer bumped** | ✅ | `eaebe896` (cargo check --workspace fix) |
| **NetScript archive (local commit)** | ✅ | `76f3f3f` in NetScript submodule |
| **NetScript archive (SSH push)** | ✅ | branch `chore/adr-001-archive-2026-06-15` pushed via `~/.ssh/push_key` (KooshaPari identity) per `findings/ADR-001-NETSCRIPT-ARCHIVE-LOCAL-STATE-2026_06_15.md:8-9` |
| **NetScript archive (PR + GitHub archive flag)** | ❌ | Dmouse92 gh not collaborator/admin on KooshaPari/NetScript |
| **helios-router DEPRECATED.md** | ✅ | submodule commit `6b44386` + parent pointer bump `c542b210d4` |
| **L6 evening delta** | ✅ | `L6_PHENO_REPOS_HEALTH_2026_06_15_DELTA_EVENING.md` (15:00 → 17:30 PDT) |
| **pheno-tracing dedup** | ✅ | top-level `pheno-tracing/` removed (270 LoC); `crates/pheno-tracing/` is the canonical (L4 hexagonal pattern); duplicate `Cargo.toml:52` workspace member removed |

---

## Sub-projects (current layout)

### Active focus repos (5)
`AgilePlus`, `PhenoCompose`, `PlayCua`, `BytePort`, `nanovms` — coordinated via `chore/l5-87-focus-repo-specs-2026-06-11` branch. Each now has a SPEC.md per L5-#87 worklog.

### Apps & shells
`apps/`, `phenotype-unity/`, `phenotype-voxel/`, `phenotype-landing/`, `phenotype-journeys/`

### Shared libraries (pheno-* family)
22 directories under `pheno-*/` (see `AGENTS.md` for the full breakdown). 21 buildable crates (Rust+Python+Go), 1 worktree container, 1 TypeScript out-of-scope.

### Shared libraries (phenotype-* and others)
`crates/`, `libs/`, `phenoShared/`, `phenoData/`, `phenoUtils/`, `phenoContracts/`, `phenoSchema/`, `phenoKits/`, `phenodocs/`, `phenotype-auth-ts/`, `phenotype-bus/`, `phenotype-dep-guard/`, `phenotype-e2e-base/`, `phenotype-errors/`, `phenotype-go-sdk/`, `phenotype-hub/`, `phenotype-infra/`, `phenotype-journeys/`, `phenotype-landing/`, `phenotype-omlx/`, `phenotype-otel/`, `phenotype-postfx/`, `phenotype-py-extras/`, `phenotype-py-utils/`, `phenotype-python-sdk/`, `phenotype-registry/`, `phenoRuntim` and more.

### Services
`services/`, `phenoMCP/`, `phenoAgents/`, `phenoVCS/`, `phenoObservability/`, `phenoEvents/`, `phenoRuntime/`, `phenoProc/`, `phenoDesign/`, `phenoCompose/`, `phenotype-bus/`, `phenotype-registry/`, `phenotype-otel/`

### Tooling
`tooling/`, `thegent/`, `dispatch-mcp/`, `cheap-llm-mcp/`, `phenotype-ops-mcp/`, `phenotype-tooling/`, `phenotype-infrakit/`, `phenotype-org-audits/`

### Active worktrees
`*-wtrees/` directories (per-feature branches) — 7+ feature branches checked out, 6 stash-backup branches also checked out

---

## Active ADRs (29 total, +ADR-030, +ADR-031 this turn)

**2026-06-14 wave (6 ADRs at `docs/adr/2026-06-14/`):**

| ADR | Repo | Disposition | Status |
|---|---|---|---|
| ADR-001 | NetScript | **DELETE** | Local commit `76f3f3f`; SSH push done, PR+archive blocked by gh auth |
| ADR-002 | KlipDot | KEEP-archived | — |
| ADR-003 | McpKit | MERGE into `PhenoMCP` | **TERMINAL (archived 2026-06-18)**: `KooshaPari/McpKit` source repo archived on GitHub; pushes return "This repository was archived so it is read-only". Plan in `findings/ADR-003-MCPKIT-MIGRATION-PLAN-2026_06_15.md`; source inventory: `findings/2026-06-18-McpKit-source-inventory.md` (1,094 lines). Registry disposition rows `id: 28` + `block-c-phenomcp` updated to `fsm: "archived"`. |
| ADR-004 | Metron | KEEP | — |
| ADR-005 | KodeVibe | KEEP | — |
| ADR-006 | cheap-llm-mcp | archive verified | — |

**2026-06-15 wave (11 ADRs at `docs/adr/2026-06-15/`):**

| ADR | Subject | Status |
|---|---|---|
| ADR-007 | cheap-llm-mcp deprecation | Accepted (DAG-V5 reconciliation) |
| ADR-008 | dispatch-mcp as sole MCP server | Accepted (consolidation decision) |
| ADR-009..011 | (DAG-V5 reconciliation) | Accepted |
| ADR-012 | `pheno-tracing` canonical across pheno-* repos | Accepted (V5 SOTA sweep) |
| ADR-013 | `pheno-mcp-router` substrate for pheno-mcp-* | Accepted (V5 SOTA sweep) |
| ADR-014 | Hexagonal L4 ports: `Port` trait + `Adapter` impl | Accepted (V5 SOTA sweep) |
| ADR-015 | V2 10-column WORKLOG.md schema (canonical) | Accepted (V5 SOTA sweep) — superseded by ADR-025 |
| ADR-016 | Fork-only-not-rewrite policy for SOTA libraries | Accepted (V5 SOTA sweep) |
| ADR-017 | `settly-*` archive — full deprecation | Accepted (V6 Track 5 closure) |
| ADR-018 | PRCP pattern (Polyglot Reuse via Canonical Ports) | Accepted (V6 Track 5 closure) |
| ADR-019 | `pheno-vessel-*` full deprecation | Accepted (V6 Track 5 closure) |
| ADR-020 | `pheno-types-*` full deprecation | Accepted (V6 Track 5 closure) |
| ADR-021 | `pheno-profiling` replaces `Profila` | Accepted (V6 Track 5 closure) |
| ADR-022 | Config consolidation — two-crate canonical split | Accepted (Subagent-B 11-PR plan) |
| **ADR-023** | **Agent-effort governance — device + dogfood + app substrate policy** | **Accepted 2026-06-15 18:42 PDT** — see [§ App-level repo triage (ADR-023)](#app-level-repo-triage-adr-023) below |

**2026-06-17 wave (this turn):**

| ADR | Subject | Status |
|---|---|---|
| **ADR-024** | **71-pillar industry-standard audit framework (L1-L71, 9 domains)** | **Accepted 2026-06-17** — see `findings/71-pillar-2026-06-17-schema.md` |
| **ADR-025** | **ADR-015 v2.1 worklog schema bump (11th column `device:`)** | **Accepted 2026-06-17** — deprecation 2026-06-22 (5 days) |
| **ADR-026** | **Factory AI Agent Readiness Model as cross-cutting external standard** | **Accepted 2026-06-17** — see <https://docs.factory.ai/web/agent-readiness/overview>; crosswalk in `audit-71-pillar-2026-06-17-wrapup.md` § 10 |
| **ADR-027** | **Git LFS 3-tier policy (always-track / on-demand / never-track)** | **Accepted 2026-06-17** — closes L66; see `.gitattributes.example` |
| **ADR-028** | **Monorepo architecture eval: hybrid-with-staging-repo** | **Accepted 2026-06-17** — closes L25; staging repo `phenotype-org-audits` |
| **ADR-029** | **Dmouse92 → KooshaPari migration — absorb all DM92 work to substrate, archive emptied repos** | **Accepted 2026-06-17** — see `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md`; 6 PRs opened, 18 Dmouse92 repos archived |
| **ADR-030** | **pheno-worklog-schema v2.1 — add 11th `device:` column** | **Accepted 2026-06-17** — see `pheno-worklog-schema/SPEC-v2.1.md`; PR `KooshaPari/pheno-worklog-schema#1` open; v2.0 deprecation **2026-06-22** |
| **ADR-031** | **Configra absorb — canonical name for Rust config; ADR-022 split preserved** | **Accepted 2026-06-17** — see `docs/adr/2026-06-17/ADR-031-configra-absorb.md`; 2 PRs planned; `phenotype-config` archive **2026-07-15** |
| **ADR-032** | **pheno-worklog-schema is a primitive lib, NOT a re-implementation of AgilePlus worklog** | **Accepted 2026-06-17** — see `docs/adr/2026-06-17/ADR-032-pheno-worklog-schema-decision.md`; different formats, different audiences, both coexist |
| **ADR-033** | **Delete `KooshaPari/phenotype-monorepo-state` — single-source-of-truth** | **Accepted 2026-06-17** — see `docs/adr/2026-06-17/ADR-033-phenotype-monorepo-state-deletion.md`; 11 commits consolidated to `phenotype-org-audits` + monorepo; deletion after 30-day grace |
| **ADR-034** | **`KooshaPari/phenotype-monorepo-state` deletion schedule — 2026-07-17** | **Accepted 2026-06-17** — see `docs/adr/2026-06-17/ADR-034-monorepo-state-deletion-schedule.md`; 30-day grace + 5-step pre-deletion checklist |

---

## Wave state

### Completed waves

- **V3 (2026-06-10):** 100+20 task DAG, 180/180 marked done per `FLEET_DAG_v3.md:1-30`.
- **V4 (2026-06-14):** Narrative only. Never executed. Superseded by v6.
- **W1 (2026-06-14):** 9/11 repos pushed via SSH `push_key`. Metron blocked (archived on GitHub). helios-router PR pending in web UI.
- **2026-06-14 RESUME (20 tracks):** 1/24 outputs confirmed on disk (filesystem-unstable). Subagent dispatch via `task` tool failed 40/40; **`task` tool re-verified working 2026-06-15 16:45 PDT** via 1/5/20 call sequence per `findings/WAVE_2026_06_14_RESUME3_DISPATCH_TEST.md`.
- **V6 (2026-06-15):** 5/5 tracks complete per `findings/V6_MASTER_STATUS-2026_06_15.md`. Verified:
  - Track 1 (pheno-scaffold-kit repair): 7/7 PRs done, 6/6 tests pass
  - Track 2 (5 proposed files): 4/5 applied, 1 N/A
  - Track 3 (AgilePlus Tier 1): 0 governance open PRs
  - Track 4 (cheap-llm-mcp lib refactor): done (Python, not Node.js; ADR-007/008 authorize)
  - Track 5 (dispatch gate): 1/5/20 call sequence all succeed

### In-flight / planned

- **Config consolidation PR-4..11:** ADR-012 plan, 8 of 11 PRs remaining. PR-4 (Settly fork gitlink removal) is currently in conflict with parallel subagent activity on `crates/phenotype-config` (`bb00d8b1a2 feat(pheno-config): config worktree (L3 #48) (#127)` is recent); deferred.
- **pheno-config v0.2.0 / phenoShared/config-core v0.3.0:** PR-6/7 of ADR-012 plan, additive features.
- **Profila → pheno-profiling migration:** 12-PR plan in v6 FINAL report §3; ~1,400 LoC including 300 tests.
- **AtomsBot decomposition:** 20 DAG tasks, 5-10 days effort. **Unblocked by ADR-001/003/005** (was waiting on NetScript/McpKit/KodeVibe decisions).

### v6 DAG closure (Track 5 — landed 2026-06-15)

- **ADR-017** Settly archive (fork-only-not-rewrite) — accepted
- **ADR-018** PRCP pattern (PR-Check-Publish) for cross-crate deprecation lifts — accepted
- **ADR-019** pheno-vessel deprecation complete (functionality folded into pheno-runtime) — accepted
- **ADR-020** pheno-types deprecation complete (functionality folded into pheno-pydantic-models + pheno-zod-schemas) — accepted
- **ADR-021** pheno-profiling replaces Profila (fork-based, not rewrite) — accepted
- 4 worklogs (`L5-097..100`), 4 findings (`findings/2026-06-15-L5-09{7,8,9}*.md`, `L5-100-*.md`) — all on disk
- SSOT.md, STATUS.md (this file), ARCHITECTURE.md — updated for v6 outcomes

### v7 DAG (in flight, 2026-06-17, supersedes v6)

See `plans/2026-06-17-v7-dag-stable.md`. **~7 tracks, 30+ PRs, orchestrator + parallel forge subagent dispatch.**

- **Track 1 — Triage (DONE this turn):** 4 empty `gate1-0..3` branches deleted; 2 stale stashes dropped; 5 pheno-* meta-bundles committed (`04c2c7b1af`); AGENTS.md/STATUS.md/SSOT.md refreshed
- **Track 2 — 5 PR reviews (parallel, this turn):** PRs #129-#133 from W5 batch (cheap-llm-mcp archive / config consolidation / ADR-012..016 SOTA / STATUS refresh / L05-L10-L25 closure)
- **Track 3 — 71-pillar audit (this turn):** ADR-024 schema + L1-L30→L1-L71 crosswalk + re-probe 10 repos + score + render
- **Track 4 — ADR-015 v2.1 schema bump (this turn):** **DONE 2026-06-17** — `KooshaPari/pheno-worklog-schema` repo created; PR #1 open (30/30 tests pass); 4 fleet WORKLOG.md files migrated to v2.1 (pheno-mcp-router, pheno-cost-card pushed; pheno-scaffold-kit, phenoForge local-only, no KooshaPari remote); v2.0 deprecation 2026-06-22
- **Track 5 — HwLedger reclassification (this turn):** ADR-023 Rule 3 P0 deliverable; inventory capabilities, map to substrates, author migration plan
- **Track 6 — Rebase + push cleaned branch (this turn):** resolve 39-commit divergence, push as KooshaPari
- **Track 7 — Work DAG maintenance (ongoing):** keep `findings/71-pillar-2026-06-17*.md` and `plans/2026-06-17-v7-dag-stable.md` updated weekly

### Track 8 — Dmouse92 → KooshaPari migration (DONE this turn, L5-104/ADR-029)

User directive 2026-06-17: *"focus solely on the dmouse92 aspects of work — merge all over to kooshapari → then reconcile/absorb to proper repos. e.g. dispatch-mcp should be deleted as it needs to have all remaining work fully absorbed to substrate (The ver on kooshapari had this done yesterday, repeat for any dmouse additions worthwhile to migrate)."*

**Result:** 6 PRs opened on KooshaPari, 18 Dmouse92 repos archived, 0 net content loss.

| PR | Repo | Title |
|---|---|---|
| [pheno-mcp-router#1](https://github.com/KooshaPari/pheno-mcp-router/pull/1) | pheno-mcp-router | feat(cost): port tiers/cost/budget/quota/audit/cost_middleware from dispatch-mcp W2-1 |
| [pheno-mcp-router#2](https://github.com/KooshaPari/pheno-mcp-router/pull/2) | pheno-mcp-router | feat(adapters): add LlamaAdapter (LlmPort) |
| [pheno-mcp-router#3](https://github.com/KooshaPari/pheno-mcp-router/pull/3) | pheno-mcp-router | feat(adapters): add OpenAICompatAdapter (LlmPort) |
| [phenotype-config#1](https://github.com/KooshaPari/phenotype-config/pull/1) | phenotype-config | feat(docs): port CANONICAL.md markers + SLSA doc from pheno ADR-012 |
| [phenotype-ops#2](https://github.com/KooshaPari/phenotype-ops/pull/2) | phenotype-ops | feat(devops): add llama-cpp docker setup |
| [dispatch-mcp#1](https://github.com/KooshaPari/dispatch-mcp/pull/1) | dispatch-mcp | docs: cherry-pick cheap-llm-mcp deprecation notice (W1.1) |

**Archived Dmouse92 repos** (2026-06-17 20:36 PDT, via Dmouse92 auth): `AgilePlus`, `dispatch-mcp`, `pheno`, `phenodocs`, `forgecode`, `PhenoCompose`, `PhenoPlugins`, `PhenoProc`, `HeliosCLI`, `Pyron`, `HexaKit`, `Tracera`, `Civis`, `OmniRoute`, `KWatch`, `phenotype-ops`, `phenotype-otel`, `Nanovms`, `PhenoContracts`, `phenotype-teamcomm`.

**Audit doc:** `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md` (364 lines) — full cross-reference matrix + decision matrix + execution log.

### Stalled / blocked

- **Push to remotes:** Dmouse92 gh cannot reach `KooshaPari/Phenotype` (4 of 7 remotes return 404). Documented in `findings/PUSH_AUTH_GAP-2026_06_15.md`. Workaround: re-auth as `KooshaPari` (DONE 2026-06-15 18:40 PDT, active now).
- **Submodule pointer drifts (181):** non-urgent; each has real content mods (not pointer drift). Per-submodule triage needed.
- **Melosviz is dirty (3 uncommitted files):** needs to be committed inside the submodule first.
- **Metron unarchive:** needs `admin:org` scope; Dmouse92 has no org admin. Web UI action needed (5 sec).
- **helios-router PR:** branch on remote, web UI PR needed (Dmouse92 `gh` can't see private repos).

---

## Recent commits (last 24 hours, descending)

```
90cbfa053b docs(pheno-config): README + twelve-factor guide (ADR-012 PR-7, 2026-06-15)
b3d215c889 feat(pheno-config): v0.2.0 — TOML loading, Config::merge, combine() (ADR-012 PR-6)
c39437cf3d docs(findings): ADR-012 config consolidation PR-4 done (2026-06-15)
a5c03c6054 docs(health): L6 pheno-* evening delta (15:00 -> 17:30 PDT, 2026-06-15)
c542b210d4 chore(root): bump helios-router to 6b44386 (DEPRECATED.md)
d516bee625 chore: delete crates/phenotype-config (ADR-012 PR-4)
52bae896c5 chore(root): delete duplicate top-level pheno-tracing/ (ADR-012 compliance, 2026-06-15)
8765ceaad1 docs(findings): Track 5 closure — L5-097..100 findings
77a88a2f9c docs(worklogs): Track 5 closure — L5-097..100 worklogs
b17cc57f88 docs(adr): Track 5 closure — ADR-017..021 + INDEX update
ccacce2e35 docs(adr): ADR-012..016 SOTA decisions for pheno-tracing, pheno-mcp-router, hexagonal ports, V2 worklog, fork-only policy
99786846aa chore(root): bump pheno to bd5d807 (delete 3 deprecated config dirs, ADR-012 PR-1/2/3)
215ebf777d docs(findings): ADR-012 config consolidation PR-1/2/3 executed (2026-06-15)
fc1a774de5 docs(findings): update ADR-001 archive state — push via SSH done, PR+archive blocked
5d26a11e82 docs(findings): push auth gap — Dmouse92 cannot reach monorepo remotes (2026-06-15)
d037999bcc docs(findings): v6 master status — 5/5 tracks verified complete (2026-06-15)
659781ee0f docs(findings): v6 Track 4 (cheap-llm-mcp lib refactor) verified done (2026-06-15)
2871a24fa5 docs(findings): v6 Track 3 (AgilePlus Tier 1 drain) verified complete (2026-06-15)
fb48173289 docs(findings): v6 Track 2 (5 proposed files) verified complete (2026-06-15)
4567ae42f8 docs(findings): v6 Track 1 (pheno-scaffold-kit repair) verified complete (2026-06-15)
c7c4d29c92 docs(findings): v6 Track 5 dispatch gate cleared (2026-06-15)
cbe1ca4d42 chore(root): bump Pyron to include build-fix commit
bd5d807   (pheno) refactor(pheno): delete 3 deprecated config dirs (ADR-012)
eaebe896  (Pyron) fix(pyron): unblock cargo check --workspace
76f3f3f   (NetScript) docs: deprecate NetScript per ADR-001
```

---

## Open threads (priority order, post-v7-launch)

1. **HwLedger reclassification (ADR-023 Rule 3)** (P0) — first concrete deliverable of ADR-023. Open a per-capability migration plan to move underlying parts from "random `phenoShared`" to one of `pheno-*-lib` / `phenotype-*-sdk` / `phenotype-*-framework` / federated service. See Track 5.
2. **ADR-015 v2.1 schema bump (ADR-025)** (P0) — file `ADR-015-v2.1-worklog-schema.md` (or amendment) with the 11th column (`device:`, enum `macbook | heavy-runner | dispatcher`) definition, deprecation timeline, and migration script. Owner: worklog-schema circle. 1-week deprecation, error after 2026-06-22. See Track 4.
3. **L6 health-audit delta — bucket-drift check** (P1) — add a new check: any active PR/branch in a PAUSED repo or `device: macbook` on a heavy task is a P1 finding. Runs at the next weekly L6 delta.
4. **CODEOWNERS review for PAUSED repos** (P1) — every PAUSED app-level repo needs a CODEOWNERS entry that blocks new branches without a bucket-change worklog row. This is the lock; the bucket table is the policy.
5. **AtomsBot* re-purposing** (P2) — the 20 DAG tasks in the AtomsBot decomposition plan are not closed; they are deferred to "seed HwLedger reclassification when a concrete capability is identified" or "use as a reference for the engine / non-frontend slice of Dino if it overlaps."
6. **Config consolidation PR-5..11 (5 PRs remaining, ~3-4h)** (P2) — PR-5 (Settly `#[deprecated]` in tree), PR-8 (Settly GitHub archive — blocked by gh auth), PR-9 (phenotype-python-sdk/phenotype-config parity), PR-10 (pheno-config v0.3.0 → crates.io), PR-11 (ADR-012 doc)
7. **Profila → pheno-profiling migration** (P3) — 12-PR plan; ~6-8h; defer to next session
8. **Submodule pointer drifts (181)** (P3) — non-urgent; per-submodule triage
9. **6 OPEN PRs (PRs #129-#134)** (P1, this turn) — Track 2 review cycle

---

## App-level repo triage (ADR-023)

Source of truth: `docs/adr/2026-06-15/ADR-023-agent-effort-governance.md`. Decision log: `findings/2026-06-15-L5-101-app-governance.md`.

| Repo         | Bucket         | Allowed work                                                                                            |
| :----------- | :------------- | :------------------------------------------------------------------------------------------------------ |
| `Civis`      | **ACTIVE**     | Any. Full SWE process.                                                                                  |
| `focalpoint` | **PAUSED**     | Read-only. The prior AGENTS.md template is shelved.                                                     |
| `Dino`       | **CONDITIONAL** | Engine / non-frontend only (heavy visual engine, asset pipeline, deterministic sim). No UI / HUD / UX work right now. |
| `WSM`        | **CONDITIONAL** | None right now. Re-evaluate when an active consumer appears.                                            |
| `QuadSGM`    | **PAUSED**     | Read-only.                                                                                              |
| `AtomsBot*`  | **PAUSED (capstone)** | Read-only as a *target* of new work. **May be legally mined** (code, concepts, schema, docs, tests) — capstone project's sponsor is not in good standing; the public repo is fair-game reference material. |
| `HwLedger` + every other app-level repo not in this list | **RECLASSIFY** (default PAUSED) | Underlying parts to be moved to one of `pheno-*-lib` / `phenotype-*-sdk` / `phenotype-*-framework` / federated service per ADR-023 Rule 3. |

A new repo defaults to **PAUSED** until it is added to this table with a bucket. A bucket change requires a one-line worklog entry (`bucket_change: from=... to=... reason=...`).

**PAUSED APPs (wholly out of scope, this turn, 2026-06-17 21:55):** All app-level repos below are **PAUSED** and tracked as **app substrate only**. No active SWE work permitted until every other (non-app) repo is done first. Local work pushed to remote branches as `wip/2026-06-17-pre-pause-snapshot` so the work is off-device but git-tracked. Re-evaluate after all non-app fleet work (config, tracing, MCP-router, observability, registry) reaches 71-pillar ✓ status.

| Repo         | Bucket   | Local state pushed? | Remote WIP branch                                                                              |
| :----------- | :------- | :------------------ | :--------------------------------------------------------------------------------------------- |
| `AtomsBot*`  | PAUSED   | Yes (7 unpushed → main) | `KooshaPari/AtomsBot:wip/2026-06-17-pre-pause-snapshot` @ `de10237` (main protected)        |
| `focalpoint` | PAUSED   | Yes (1 unpushed)    | `KooshaPari/FocalPoint:main` @ `3ae2f126`                                                       |
| `Dino`       | PAUSED (was CONDITIONAL) | Yes (clean) | (no unpushed)                                                                                  |
| `QuadSGM`    | PAUSED   | Yes (1 uncommitted) | `KooshaPari/QuadSGM:wip/2026-06-17-pre-pause-snapshot` @ `484dfa1`                             |
| `HwLedger`   | PAUSED (default per ADR-023) | Yes (1 unpushed) | `KooshaPari/HwLedger:wip/2026-06-17-cleanup-hwLedger` @ `f031f36` (committed `f031f36`) |
| `WSM`        | PAUSED (was CONDITIONAL) | n/a (not on disk) | (does not exist locally)                                                                       |
| `*fitness*`  | PAUSED (removed) | n/a | (ripped per user instruction)                                                                  |

**Device-fit gate (ADR-023 Rule 1):** The MacBook is **not** a heavy-work device. Heavy work (defined as `cargo test --workspace` against multi-100-crate workspace, iOS Simulator boot, Docker-in-Docker, Unity/Unreal editor, or any single build/test cycle > 10 min wall) runs on a self-hosted runner or a dispatched subagent (`device: heavy-runner`). The MacBook is reserved for planning, ADR-writing, small focused PRs, code review, and dogfooding (`device: macbook`). The `device:` field is in the worklog v2.1 schema (ADR-025 bump pending, due 2026-06-22).

---

## Scope decisions (this turn, 2026-06-17 21:55)

### Decision A — Configra is the canonical config repo name
- `KooshaPari/Configra` exists (created 2026-03-25, "Phenotype-org configuration framework"). It is the real repo to absorb.
- All config-like code currently scattered across `pheno-config`, `phenotype-config`, `phenotype-config-rs`, `Conft`, `settly-*` will **migrate INTO Configra**.
- **Track T19** in the DAG is the migration plan: 1 absorbing PR, 1 ADR (ADR-031), 8-12 migration PRs to move existing code.
- All `pheno-config*` / `phenotype-config*` repos get deprecated after migration lands.

### Decision B — pheno-worklog-schema is a primitive lib, NOT a duplicate of AgilePlus
- **Investigation finding (L5-107):** `pheno-worklog-schema` is a Python lib that parses + validates WORKLOG.md files (markdown table schema: `Date | Task ID | Layer | Action | Files | Notes`).
- **AgilePlus** has a completely different format: `worklog-L*-*-*.json` files (machine-readable JSONL with task_id, agent_id, files_changed, commit_sha, verification_result).
- These two are **complementary, not duplicating**:
  - `pheno-worklog-schema` = human-readable markdown validation
  - AgilePlus worklogs = machine-readable task audit trail
- **Track T20** in the DAG: decide whether to keep both, OR merge into one (decision deferred — needs separate design session).
- **No action this turn.** Both stay where they are.

### Decision C — phenotype-monorepo-state is OUT OF SCOPE going forward
- `KooshaPari/phenotype-monorepo-state` exists (created 2026-06-18 03:52 UTC) — currently holds 2026-06-17 cherry-picks of governance docs (AGENTS.md, STATUS.md, SSOT.md, ADRs, audit framework).
- **User direction: phenotype monorepo should NOT exist going forward.** It was created ad-hoc during the wrap-up session.
- **Track T21** in the DAG: delete the `phenotype-monorepo-state` repo (after merging its 4 governance-snapshot commits back into the actual home for those files, which is the local monorepo's `archive/2026-06-15-30-pillar-fleet` branch).
- **No immediate deletion** — requires migration plan first.

### Decision D — Spine repos (PhenoHandbook, PhenoSpecs, phenotype-registry, phenotype-infra, phenokits-commons) are LIGHTLY USED
- These federated spine repos are **light-use only** — referenced for patterns + cross-references, not actively maintained.
- **No new content authored in them.** They remain available as read-only references.
- The active spine going forward is the local monorepo's `findings/` + `docs/adr/` + `plans/` directories.

---

## 71-pillar audit (ADR-024, this turn)

See `findings/71-pillar-2026-06-17-schema.md` for the full schema doc (industry references, scoring rubric, pillar definitions). See `findings/71-pillar-2026-06-17.md` for the latest scorecard across 10 existing repos. See `findings/71-pillar-2026-06-17-mapping.md` for the L1-L30 → L1-L71 crosswalk (so the older 30-pillar audit at `findings/30-pillar-2026-06-16.md` is not orphaned).

**Domains (9 total, 71 pillars):** Architecture (AX) 12, Performance 7, Quality/Correctness 8, Developer Experience (DX) 10, User Experience (UX) 8, Security 10, Observability & Ops 8, Documentation & SSOT 5, Governance & Sustainability 3.

**Industry references:** AWS WAF, Azure WAF, Google Cloud Architecture Framework, ISO 25010, OWASP ASVS, NIST SSDF, Microsoft SDL, DORA 2023 capabilities, Google SRE Book, CNCF Cloud Native Definition, OpenSSF Best Practices, Divio documentation system.

**Scoring:** 0-3 per pillar per repo (0=absent, 1=minimal, 2=adequate, 3=strong/SOTA). N/A=3 for UI pillars (L40 i18n, L41 a11y) on headless backend/CLI libraries.

**Refresh cadence:** weekly (every Monday 09:00 PDT). Owner: worklog-schema circle.

---

## Factory AI Agent Readiness (external standard, ADR-026, this turn)

Cross-cutting external benchmark per <https://docs.factory.ai/web/agent-readiness/overview>. 5-level gated progression model (Functional → Documented → Standardized → Optimized → Autonomous) with 9 technical pillars. 80% threshold per level. Org score = `floor(average of all repo levels)`.

**Current per-repo readiness (manual estimate, 2026-06-17, pending `/readiness-report` verification):**

| Repo | Level | Pillar avg | Top gap | Next-level unlock |
|---|---|---|---|---|
| **AgilePlus** | 2 (Documented) | 1.78/3 (59%) | Security: no secret scanning in CI | Add secret scanning → L3 |
| **pheno** | 2 (Documented) | 1.89/3 (63%) | Observability: tracing exists but not wired to all sub-apps | Wire pheno-tracing to all sub-apps → L3 |
| **dispatch-mcp** | 1 (Functional) | 0.89/3 (30%) | Documentation: no AGENTS.md yet | Add AGENTS.md + pre-commit → L2 |
| **phenotype-ops** | 1 (Functional) | 1.11/3 (37%) | Dev Env: no devcontainer | Add AGENTS.md + devcontainer → L2 |

**Org-level score:** `floor((2+2+1+1)/4)` = **Level 1 (Functional)**. To reach org Level 2, all 4 repos must reach Level 2 (3 of 4 currently are; dispatch-mcp is the blocker).

**Refresh:** run `/readiness-report` from Droid CLI in each repo after major changes. Action items from each run feed into the next v7+ plan as P0 tasks. See `audit-71-pillar-2026-06-17-wrapup.md` § 10 for the full crosswalk and methodology, and `AGENTS.md` § "Factory AI Agent Readiness" for the framework overview.

---

## Infrastructure

- **GitHub auth:** `gh` is `KooshaPari` (active 2026-06-15 18:40 PDT). Dmouse92 still in keyring (read-only collaborator) — DO NOT push as Dmouse92. SSH `~/.ssh/push_key` is the working path for pushes; web UI is needed for admin actions (unarchive, PR creation in private repos).
- **Subagent dispatch:** `task` tool (re-verified working 2026-06-15 16:45 PDT). `forge -p "..."` CLI (verified working 2026-06-15 01:18 PDT with Tracera L5 integration). `OmniRoute` is UP at `http://localhost:20128/v1/models`. **This turn: `task` tool with `agent_id="forge"` used for 5 PR reviews + 3 content authoring tasks in parallel.**
- **Sparse-checkout:** cone mode active, pattern includes `/*` + `!/*/` + re-inclusions for `pheno-*`, `plans/`, `worklogs/`, `docs/adr/2026-06-14/*`, `docs/adr/2026-06-15/*`, plus 6 specific sub-paths. `findings/` and `crates/` are NOT in the cone by default.
- **Hooks:** `HOOKS_SKIP=1` env var bypasses `trufflehog` pre-commit hook (which times out after 60s on the monorepo).
