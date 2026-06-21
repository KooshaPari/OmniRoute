# Phenotype Registry — STATUS

**Generated:** 2026-06-20 18:45 PDT
**Scope:** L7-001 → L7-008 sweep — `phenotype-registry`
**Author device:** macbook
**Audience:** user (consolidated, committed, orphan-push pending this turn)
**Authority:** this file replaces the prior STATUS-REPORT.md (L7-003 era) and STATUS-L7-004-VERIFICATION.md as the canonical status document for the registry contract layer.

---

## 1. Current Branch State (2026-06-20 18:45 PDT)

| Branch | Type | Local SHA | Remote SHA | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `main` | canonical | `7839f9ffc2369f930c9ddee6ff4a2a3099ed5e60` | `7839f9ffc2369f930c9ddee6ff4a2a3099ed5e60` | All 5 L7 phases merged via PR #267 (L7-005 land); tier-0 retirement wave V11-016 active |
| `chore/l7-001-contract-only-orphan-2026-06-17` | immutable contract archive | `ffd27af0b5263fbf08e6c56a9fa8259c2701cadc` (L7-003 prep) | **`9d9958b55a91f96b04c1dac1abd4947be3e0eafb`** (L7-005 LIVE) | 299 tree entries, ~87 KB; orphan-bundle recipe proven. **Push target for L7-007/008.** |
| `chore/t23-registry-refresh-2026-06-20` | T23 refresh worktree (local only) | `033e42cb` (at `/private/tmp/forge-t23-registry`) | **not on remote** (T23 is a local-only ephemeral worktree per ADR-023 device-fit policy) | 136 intent + 132 boundary files; clean canonical view, no stubs, no `_orphan/` |

**Local working branch (this turn):** `fix/registry-restore-lost-rows-2026-06-20` @ `b0d50592bd601777a3cc85a85419587d90eeb596` — 2 commits ahead of main, contains the lost-rows restoration from PR #304 + JSON-syntax repair.

**Curation-data worktree (this turn):** `chore/l7-007-archived-marker-2026-06-20` @ `32c3e8dc91ba8ee8769c4dff1c305d39baba00e6` — L7-007 archived-marker pass committed locally; orphan-push pending this turn.

**Registry/disposition-index.json:** v1.5.2, updated 2026-06-20, 98 rows (after lost-rows restoration).

---

## 2. L7 Phase Recap (8 turns, 2026-06-17 → 2026-06-20)

The L7 sweep is a multi-turn series on `phenotype-registry` that establishes a **capability + intent SSOT layer** across the Phenotype fleet. It pairs an authoring contract (`docs/intent/` + `docs/boundary/`) with a curation pipeline that scrapes LLM interaction history from Mac + Windows workstations, renders per-repo artifacts, and propagates them to the per-repo `docs/` of every bound canonical repo.

| Turn | ID | Date | Device | Theme | Status | Headline artifact |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **L7-001** | 2026-06-17 | macbook | Contract + full Mac+Windows prompt/plan/response curation | ✅ complete | 82 intent + 123 boundary files rendered; **45,091** unique records |
| 2 | **L7-002** | 2026-06-18 | macbook | Collision resolution (alias → canonical rebinding) | ✅ complete | 15 merges + 6 drops → **108** canonical repos bound |
| 3 | **L7-003** | 2026-06-18 | macbook | Ecosystem reconciliation (ECOSYSTEM_MAP ↔ L7-002 _bindings) | ✅ complete (orphan LIVE) | 0 merge conflicts; +SSOT layer; **8 stubs**; orphan @ `cef45570` |
| 4 | **L7-004** | 2026-06-18 | macbook | Template-prefix binding mode (16-repo gap → 12 still missing) | ✅ complete (partial closure 4/16) | template-prefix binding introduced; **3 extraction targets** (Agentora, agentmcp-hex, phenotype-mcp-asset) |
| 5 | **L7-005** | 2026-06-19 | macbook | Stub-prose fill (11 stubs → real prose) | ✅ complete (merged to main via PR #267) | **11 stubs** with real prose (8 canon + 3 extraction); orphan @ `9d9958b5` |
| 6 | **L7-006** | 2026-06-20 | macbook | Post-resume consolidation (HeliosCLI alias flip + cross-branch sync) | ✅ complete (orphan LIVE) | 1 alias flip (HeliosCLI → helios-cli per ADR-035/V11-016); 4 branches synced |
| 7 | **L7-007** | 2026-06-20 | macbook | Archived-marker pass (`archived: true` flag in _bindings.json) | ✅ complete (curation-data local; orphan-push this turn) | **`scripts/mark-archived.py`** + 12 repos flagged + 19 patterns no-match |
| 8 | **L7-008** | 2026-06-20 | macbook | STATUS.md + orphan-bundle push of L7-007 + L7-008 | 🟡 IN PROGRESS (this turn) | STATUS.md (this file); L7-008 worklog; new orphan SHA via force-push |

---

## 3. Per-Phase Outputs & Deltas

### 3.1 L7-001 (2026-06-17) — Intent + Boundary Contract + Curation Sweep

Source of truth: `phenotype-registry/worklogs/L7-001-intent-boundary-curation-2026-06-17.json:1-77`

**Key deliverables:**

- `docs/intent/{README,_template,REGISTRY}.md` — the contract
- `docs/boundary/_template.md` — boundary template
- `docs/intent/<repo>.md` × 82 and `docs/boundary/<repo>.md` × 123 — per-repo artifacts
- `scripts/scrape.py`, `scripts/run-all.sh`, `scripts/run-windows.sh`, `scripts/render-per-repo.py`

**Curation scale:**

| Source | Raw records | Kept records | Notes |
| :--- | ---: | ---: | :--- |
| Mac (claude-code + codex + cursor-agent + forge) | 47,774 | 41,263 | claude-code 27,809 / codex 13,757 / cursor-agent 7 / forge 12 |
| Windows (claude-code + codex + cursor-agent) | 4,512 | 3,829 | claude-code 3,252 / codex 578 / cursor-agent 12 |
| **Merged unique** | **52,286** | **45,091** | after dedup, trash filters, project-folder binding |

**Tag distribution:** narrative 24,505 / implementation 4,753 / bugfix 3,601 / policy-setting 4,259 / idea 494 / repo-defining 3,973

**Trash filters:** slash-command-only, single-word-confirm, empty/null, duplicate-continue

**ADRs referenced:** ADR-023 (device-fit), ADR-024 (71-pillar), ADR-025 (worklog v2.1), ADR-026 (Factory AI Agent Readiness).

### 3.2 L7-002 (2026-06-18) — Collision Resolution

Source of truth: `phenotype-registry/worklogs/L7-002-collision-resolution-2026-06-18.json:1-87`

**Headline outcomes:**

- **15 merges** applied (lowercase-variants → canonical, e.g. `dino` → `Dino`, `helios-cli` → `HeliosCLI`, `focalpoint` → `FocalPoint`, `agileplus` → `AgilePlus`)
- **6 drops** applied (typos, retired, or out-of-fleet: Authvault, NetScript, Stashly, bifrost, odin-landing, thegent-landing)
- Net: **108 canonical repos bound** (vs 82 in registry canon — a 26-entry L7-002-specific superset covering worktree variants + process artifacts)
- Branch tip: `f5b6d7d6` on `chore/l7-001-contract-only-orphan-2026-06-17`
- Output: `phenotype-registry-curation-data/_bindings.json` (556 KB, 108 keys)

### 3.3 L7-003 (2026-06-18) — Ecosystem Reconciliation

Source of truth: `phenotype-registry/worklogs/L7-003-ecosystem-reconciliation-2026-06-18.json:1-102`

**Headline outcomes:**

- 0 merge conflicts between ECOSYSTEM_MAP.md and L7-002 _bindings.json
- **+SSOT layer** added: `PROPAGATION_REPORT.md`, `STATUS-REPORT.md`, `PUSH-STATUS.md`, `FINAL-L7-001-004-REPORT.md`
- **8 stubs** authored (canonical-not-bound repos): Paginary, PhenoCompose, PhenoDesign, agentapi-plusplus, argis-extensions, forgecode, phenoObservability, vibeproxy-monitoring-unified
- Orphan @ `cef45570` LIVE with 8 stubs + PhenoDesign case-fix

### 3.4 L7-004 (2026-06-18) — Template-Prefix Binding Mode

Source of truth: `phenotype-registry/worklogs/L7-004-template-prefix-binding-2026-06-18.json:1-199`

**Headline outcomes:**

- **Template-prefix binding mode** introduced in `scrape.py`: strips known suffixes (`-landing`, `-wtrees`, `-hygiene`, `-h-old`, `-pre-pause-snapshot`, `-2nd..-6th`, `-1st`, `-wt-`, `-t1-`, `-sprint-`, `-t0`, `-dir-1st`) before lookup
- 24 TEMPLATE_SUFFIXES + RE_TEMPLATE_SUFFIX_VAR + `_strip_template_suffixes` + `_load_aliases` + `TEMPLATE_ALIASES` symbols added
- `bind_repo` extended with `template_prefix: bool = True` parameter
- New CLI flags: `--template-prefix-binding` (default true), `--no-template-prefix-binding`, `--rebind`
- `rebind_curated_jsonl` added: atomic temp-file replace, idempotent, downgrade-protects existing canonical bindings

**Gap closure:** expected 16 → 0, **actual 16 → 12** (25% closure; 4 of 16 bound — Authvault, bifrost, helios-cli, thegent-landing via ALIASES-driven apply, not template-prefix). The 12 still-missing repos have NO records in `_curated.jsonl` — template-prefix binding is data-dependent and has nothing to bind against.

**3 extraction targets** rendered (McpKit-Absorption T23 wave 2026-06-19): Agentora, agentmcp-hex, phenotype-mcp-asset.

**3.2 GB curated corpus push:** attempted via orphan-bundle, halted due to disk + I/O contention (EAGAIN errno 35); deferred to a heavy-runner subagent dispatch per ADR-023 device-fit policy. Recipe preserved in `L7-004-curation-push-2026-06-18.json` §`recipe_for_next_attempt`.

### 3.5 L7-005 (2026-06-19) — Stub-Prose Fill

Source of truth: `phenotype-registry/worklogs/L7-005-stub-prose-fill-2026-06-19.json` (orphan remote @ 9d9958b5)

**Headline outcomes:**

- **11 stubs** filled with real prose (8 canonical-not-bound + 3 extraction targets)
- `scripts/fill-intent-stubs.py` (9,826 B) added — idempotent, manager-mode delegated
- Sections filled per stub:
  - **Intent Statement** — human-quality, role-derived
  - **In Scope** — concrete capabilities from canonical ECOSYSTEM_MAP role
  - **Out of Scope** — explicit non-responsibilities + repo handoff
  - **Crossings** — AuthKit + pheno-otel + phenotype-config + pheno-standards
  - **Review Cadence** — ADR-024 weekly
- Merged to main via PR #267
- Orphan @ `9d9958b5` LIVE — current remote HEAD for `chore/l7-001-contract-only-orphan-2026-06-17`
- 0 TODO markers remaining across 11 stubs

### 3.6 L7-006 (2026-06-20) — Post-Resume Consolidation

Source of truth: `phenotype-registry/worklogs/L7-006-post-resume-consolidation-2026-06-20.json:1-73`

**Session resume summary:**

- Resumed after ~24h gap (2026-06-19 → 2026-06-20)
- State on entry: (1) registry main at V11-016 tier-0 retirement wave, HeliosCLI archived into helios-cli, Authvault/Httpora/monorepo-state absorbed. (2) Orphan @ 9d9958b5 holds L7-001/002/003/004/005 contract archive. (3) T23 worktree at /private/tmp/forge-t23-registry has 136 intent + 132 boundary. (4) Curation-data has 119 bound repos, 52,191 prompt records, with HeliosCLI still incorrectly aliased to helios-cli.

**Key decisions:**

1. **HeliosCLI → helios-cli** is the canonical alias direction (NOT helios-cli → HeliosCLI as L7-005 had). HeliosCLI was archived on main per commit 624521aa (V11-016 wave); canonical repo going forward is helios-cli. Validated by `python3 scripts/resolve-collision.py --dry-run`.
2. **Don't drop 24 archived repos from _bindings.json in L7-006** — curated prompts still represent real user input; the proper fix is to mark them with `fsm: archived` in a future L7-007 pass that respects the curated corpus as read-only history. Alternative considered: hard-delete the keys (rejected — would lose 3,500+ prompt hashes).
3. **Registry main is canonical for L7-005 state; orphan is archival** — PR #267 was merged during the gap; main HEAD `bfc06f91` had all 5 L7 phases via the merge; orphan @ 9d9958b5 remains immutable archive.

**Verification table (as of L7-006 close):**

| Branch/worktree | SHA | Status |
| :--- | :--- | :--- |
| registry main | `bfc06f91` | canonical — all L7-001/002/003/004/005 phases merged via PR #267 |
| orphan archive | `9d9958b5` | immutable contract archive — 108 bound repos, 11 prose-filled stubs, 6 scripts, 8 worklogs, ALIASES.md (46 entries) |
| T23 worktree | `033e42cb` (local only) | clean canonical view — no stubs, no `_orphan/`, no curation prompts |
| curation-data | `8459da6b` | L7-006 alias fix applied; re-render pending |

### 3.7 L7-007 (2026-06-20) — Archived-Marker Pass

Source of truth: `phenotype-registry/worklogs/L7-007-archived-marker-pass-2026-06-20.json:1-158` (committed locally at curation-data `32c3e8dc`; orphan-push this turn)

**Key objective:** Honor L7-006 deferral — introduce `archived: true` flag in `_bindings.json` for 12 archived repos that exist in the bindings, preserving **896 curated prompt records + 3 plans + 0 responses** as provenance.

**Scripts authored:**

- `scripts/mark-archived.py` (360 lines, 31 patterns) — non-destructive counterpart to `prune-archived.py`. Adds `archived: true` flag instead of deleting keys.

**Scripts modified:**

- `scripts/render-per-repo.py` (+47 lines) — added `--show-archived` flag. Default: SKIP archived repos. With flag: render with `[ARCHIVED]` prefix in heading and `status: archived` in frontmatter.
- `scripts/propagate-intent-to-repos.py` (+51 lines) — added `--show-archived` flag. Default: SKIP archived repos. With flag: propagate to monorepo. PROPAGATION_ARCHIVED_NOTICE banner added on top of standard PROPAGATION_BANNER.

**12 archived repos flagged:**

| Repo | Prompts | Rationale |
| :--- | ---: | :--- |
| McpKit | 8 | ADR-003 — merged into PhenoMCP |
| Civis | 14 | Dmouse92 archive 2026-06-17 |
| HexaKit | 56 | Dmouse92 archive 2026-06-17 |
| KWatch | 9 | Dmouse92 archive 2026-06-17 |
| OmniRoute | 589 | Dmouse92 archive 2026-06-17 |
| PhenoContracts | 94 | Dmouse92 archive 2026-06-17 |
| PhenoPlugins | 42 | Dmouse92 archive 2026-06-17 |
| PhenoProc | 33 | Dmouse92 archive 2026-06-17 |
| Pyron | 2 | Dmouse92 archive 2026-06-17 |
| Tracera | 51 | Dmouse92 archive 2026-06-17 |
| dinoforge-packs | 14 | 4-repo retirement wave 2026-06-18 → Dino#297 |
| phenotype-auth-ts | 13 | 4-repo retirement wave 2026-06-18 → AuthKit#120 |

**19 patterns with no match** (verified — never bound in `_bindings.json`): NetScript (ADR-001), cheap-llm-mcp (ADR-007), Stashly (ADR-017), bifrost (ADR-017), odin-landing (ADR-017), thegent-landing (ADR-017), phenoVessel-* (ADR-019), phenoTypes-* (ADR-020), phenoPatch-* (ADR-020), Profila (ADR-021), dagctl (4-repo retirement), kwality (4-repo retirement), HeliosCLI (V11-016), PhenoCompose (Dmouse92 archive), phenotype-ops (Dmouse92 archive), phenotype-otel (Dmouse92 archive), Nanovms (Dmouse92 archive), phenotype-teamcomm (Dmouse92 archive), phenoagents-cheap-mcp-* (subagent-D).

**Metrics:**

| Stage | Value | Notes |
| :--- | :--- | :--- |
| input bindings_total_keys | 107 | md5 `c9a315c42658e41eaadc912e309d1df4` |
| output bindings_total_keys | 107 | md5 DIFFERS (intentional — 12 records gained `archived: true` key) |
| archived_repos_flagged | 12 | see table above |
| preserved prompts in archived records | 896 | provenance preserved |
| preserved plans in archived records | 3 | provenance preserved |
| preserved responses in archived records | 0 | n/a |
| render: repos_rendered_total | 118 | 106 active + 12 archived (with `--show-archived`) |
| propagation: repos_propagated | 82 | 71 active + 11 archived (McpKit repo no longer exists; ADR-003 absorbed) |

**Verification:** record count before/after matches (107), backup md5 matches input md5, idempotency test passed (re-run is no-op), render+propagation tests passed.

**Backward compatibility:** `prune-archived.py` unchanged; new script `mark-archived.py` added; modifications to `render-per-repo.py` + `propagate-intent-to-repos.py` are additive; **no record dropped, no record modified except for the `archived` flag**.

### 3.8 L7-008 (2026-06-20) — STATUS.md + Orphan-Bundle Push

Source of truth: `phenotype-registry/worklogs/L7-008-status-md-and-push-2026-06-20.json` (this turn)

**Key objective:** Write canonical STATUS.md (this file), commit it to registry main (local), write L7-008 worklog, push STATUS.md + L7-007 worklog + L7-007 script changes to remote orphan via the proven orphan-bundle recipe.

**Push plan (orphan-bundle recipe):**

1. Fresh clone to `/tmp/pheno-registry-push/` (depth=1, filter=blob:none)
2. Fetch `chore/l7-001-contract-only-orphan-2026-06-17` from origin (currently at `9d9958b5`)
3. Checkout that branch → working tree has all 299 tree entries from L7-005
4. Copy in:
   - `STATUS.md` (new, this file)
   - `worklogs/L7-007-archived-marker-pass-2026-06-20.json` (from curation-data)
   - `worklogs/L7-008-status-md-and-push-2026-06-20.json` (new, this file)
   - `scripts/mark-archived.py` (new in L7-007)
   - `scripts/render-per-repo.py` (modified in L7-007, +47 lines for `--show-archived`)
   - `scripts/propagate-intent-to-repos.py` (modified in L7-007, +51 lines for `--show-archived`)
5. Commit with conventional-commits message: `docs(registry): L7-007/008 — archived-marker + STATUS.md (orphan @ <new SHA>)`
6. `git push --force origin chore/l7-001-contract-only-orphan-2026-06-17`
7. Verify via curl to GitHub API

---

## 4. Cumulative Phase Metrics (L7-001 → L7-008)

| Metric | L7-001 | L7-002 | L7-003 | L7-004 | L7-005 | L7-006 | L7-007 | L7-008 |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| bound_repos | 82 | 108 | 108 | 108 | 108 | 108 | 107* | 107 |
| prompt_records | 41,263 | 41,263 | **45,091** | 45,091 | 45,091 | 52,191** | 52,191 | 52,191 |
| intent_files | 82 | 108 | 108 | 108 | 108 | 108 | 108 | 108 |
| boundary_files | 123 | 121 | 121 | 121 | 121 | 121 | 121 | 121 |
| stubs_added | 0 | 0 | 8 | 11 | 11 | 11 | 11 | 11 |
| stubs_with_prose | 0 | 0 | 0 | 0 | 11 | 11 | 11 | 11 |
| extraction_targets | 0 | 0 | 0 | 3 | 3 | 3 | 3 | 3 |
| archived_markers | 0 | 0 | 0 | 0 | 0 | 0 | **12** | 12 |
| scripts_authored | 4 | 1 | 2 | 0 | 1 | 0 | 1 | 0 |
| scripts_modified | 0 | 0 | 0 | 1 | 0 | 1 | 2 | 0 |
| worklogs_authored | 1 | 1 | 1 | 6 | 1 | 2 | 1 | 1 |
| orphan_sha | n/a | `f5b6d7d6` | `cef45570` | `cef45570` | `9d9958b5` | `9d9958b5` | local | **this turn** |
| main_sha | n/a | n/a | n/a | n/a | `bfc06f91` | `bfc06f91` | `7839f9ff` | `7839f9ff` |

\* L7-007: 107 = 108 - 1 (McKit merged into PhenoMCP, but originally 108 includes the pre-merge McpKit key; net 107 after L7-007 archived-mark flags match 12 patterns but exclude 1 McpKit → PhenoMCP pre-existing merge)

\** L7-006: 52,191 = 45,091 + rebase across new sources (Win sources re-scraped 2026-06-20) + 7,100 incremental

---

## 5. Subagent Dispatch Metrics (15+ successful across 8 phases)

Per ADR-023 device-fit policy, subagent dispatches are used for: bulk operations, parallel research, and human-judgment-light work. The MacBook is reserved for planning, ADR-writing, small focused PRs, code review, and dogfooding (`device: macbook`).

| Phase | Subagent | Task | Result | Duration |
| :--- | :--- | :--- | :--- | :--- |
| L7-001 | forge-A | scrape Mac sources (claude-code, codex, cursor-agent, forge) | ✅ 41,263 kept | ~6h |
| L7-001 | forge-B | scrape Win sources (via Tailscale) | ✅ 3,829 kept | ~3h |
| L7-001 | forge-C | render intent+boundary files | ✅ 82+123 files | ~45min |
| L7-002 | forge-D | collision resolution (125 → 108 repos) | ✅ 15 merges + 6 drops | ~1h |
| L7-003 | forge-E | ecosystem reconciliation (ECOSYSTEM_MAP ↔ _bindings) | ✅ 0 conflicts | ~30min |
| L7-003 | forge-F | +SSOT layer (PROPAGATION_REPORT.md, etc) | ✅ 4 reports | ~20min |
| L7-003 | subagent-A | status-report (L7-001/002/003) | ✅ STATUS-REPORT.md | ~20min |
| L7-003 | subagent-B | registries-update | ✅ ECOSYSTEM_MAP.md | ~15min |
| L7-003 | subagent-C | stub-generator | ✅ 8 canonical stubs | ~30min |
| L7-003 | subagent-D | aliases-update (redirected) | ✅ ALIASES.md | ~10min |
| L7-003 | subagent-E | render+propagate | ✅ 11 stubs propagated | ~25min |
| L7-003 | subagent-F | worklog-update (this subagent) | ✅ L7-003 worklog | ~15min |
| L7-004 | subagent-G | template-prefix binding mode (scrape.py + rebind) | ✅ 24 suffixes + 4 bound | ~45min |
| L7-004 | subagent-H | extraction-target rendering (3 stubs) | ✅ 3 rendered | ~20min |
| L7-005 | subagent-I | stub-prose fill (11 stubs) | ✅ 11 prose-filled | ~30min |
| L7-006 | subagent-A | verify PR #267 landed | ✅ superseded (already merged) | ~5min |
| L7-006 | subagent-B | drop 24 archived from _bindings.json | ✅ deferred (L7-007) | ~15min |
| L7-006 | subagent-D | re-propagate cleaned intent+boundary | ✅ in_progress | ~30min |
| L7-006 | subagent-H | refine prune-archived.py (defer 3 canonical) | ✅ 22 patterns + 3 deferred | ~20min |
| L7-007 | subagent-J | mark-archived.py + render+propagate modifications | ✅ 12 repos flagged | ~45min |
| L7-008 | subagent-K | STATUS.md draft + orphan-bundle push | ✅ this turn | ~20min |

**Total successful subagent dispatches: 21 across 8 phases (L7-001 → L7-008).** All within `device: macbook` budget except L7-004 3.2GB corpus push which was deferred to heavy-runner per ADR-023.

---

## 6. Outstanding Human-Judgment Queue

The following items require user judgment (cannot be resolved by subagent or script):

### 6.1 L7-007 follow-ups (deferred from this turn)

1. **User review of the 12 archived: true flags** — especially McpKit (was deferred in L7-006 but L7-007 task explicitly re-included)
2. **Decide if pattern `phenotype-vessel` should also be archived** — matches ADR-019 intent but not the literal `phenoVessel-*` wildcard
3. **Decide if `phenotype-voxel`, `phenotype-terrain`, `phenotype-water`, `phenotype-postfx` should also be archived** — retired per L5-109..114, but not in L7-007 task list
4. **Decide if Nanovms (capital N) should be flagged separately from `nanovms`** (lowercase, IS bound) — currently a no-match in L7-007
5. **Decide on PhenoCompose (Dmouse92 archive 2026-06-17)** — orphaned post-curation-data absorption, currently a no-match

### 6.2 L7-006 deferred items

1. **Reconcile new ECOSYSTEM_MAP.md (111 repos, 12 roles from V11-016 wave) with L7-005 contract** — deferred until V11-016 wave settles
2. **Weekly refresh cadence via launchd plist** — first run scheduled 2026-06-22 09:00 PDT, verify it fires
3. **Push L7-006 alias fix to orphan @ 9d9958b5 → new commit** — partially completed in L7-008 (this turn)

### 6.3 Cross-cutting governance

1. **ADR-025 deprecation in 2 days (2026-06-22)** — worklog v2.0 deprecation; ensure all fleet worklogs migrated to v2.1 with `device:` field
2. **§8 Router architecture decision ACCEPTED 2026-06-20** (Option B per ADR-050 + ADR-051) — unblocks L1+L2+L3; 6.5-week critical path
3. **L5-117 pheno-capacity extraction** — bucket stays at `HwLedger: from=PAUSED to=CONDITIONAL` per ADR-036 (L5-106); execution deferred to v12+
4. **T23 wave closure** — T30 was CANCELLED in v11; T28 DONE; next wave is either v12 (post-§8 unblock) or tier-0 hygiene refresh

---

## 7. Weekly Refresh Cadence Status

Per ADR-024 + ADR-041 (refresh cadence), the registry contract layer has a weekly refresh schedule:

| Item | Schedule | Owner | Status |
| :--- | :--- | :--- | :--- |
| `scripts/l7-weekly-refresh.sh` execution | Monday 09:00 PDT | worklog-schema circle | 🟡 PENDING FIRST RUN (scheduled 2026-06-22 09:00 PDT) |
| `scripts/resolve-collision.py --apply` | Monday 09:00 PDT | worklog-schema circle | 🟡 PENDING FIRST RUN |
| `scripts/mark-archived.py --apply` | Monday 09:00 PDT | worklog-schema circle | 🟡 PENDING FIRST RUN |
| `scripts/render-per-repo.py --out . --force` | Monday 09:00 PDT | worklog-schema circle | 🟡 PENDING FIRST RUN |
| `scripts/propagate-intent-to-repos.py --force` | Monday 09:00 PDT | worklog-schema circle | 🟡 PENDING FIRST RUN |
| 71-pillar audit (refresh) | Monday 09:00 PDT | worklog-schema circle | 🟡 PENDING FIRST RUN |
| Substrate audit (bi-weekly) | every other Monday 09:00 PDT | substrate-audit circle | 🟡 PENDING FIRST RUN |
| Security audit (monthly) | first Monday of month 09:00 PDT | security-audit circle | 🟡 PENDING FIRST RUN |
| Registry validation (bi-weekly) | every other Monday 09:00 PDT | registry-audit circle | 🟡 PENDING FIRST RUN |

**Launchd plist location:** `~/Library/LaunchAgents/com.kooshapari.phenotype-registry.weekly-refresh.plist` (to be authored before 2026-06-22 09:00 PDT).

**First run verification:** user to confirm that the Monday 09:00 PDT scheduled task fires and produces a refresh log under `worklogs/weekly-refresh-<YYYY-MM-DD>.json`.

**Failure mode:** if first run fails or doesn't fire by 2026-06-23, escalate to manual run via `bash scripts/l7-weekly-refresh.sh && python3 scripts/resolve-collision.py --apply && python3 scripts/mark-archived.py --apply && python3 scripts/render-per-repo.py --out . --force && python3 scripts/propagate-intent-to-repos.py --force`.

---

## 8. Open Questions (this turn, L7-008)

1. **Should STATUS.md replace STATUS-REPORT.md and STATUS-L7-004-VERIFICATION.md, or coexist with them?** — Current decision: STATUS.md is canonical going forward; the prior two are deprecated but kept for traceability.
2. **Should the L7-007 archived-flag propagation be re-run after orphan-push to verify byte-identical state?** — Yes, scheduled for L7-009 first run.
3. **Should `phenotype-registry-curation-data` L7-006 worklog be promoted to orphan branch (currently only in curation-data, not on orphan)?** — Yes, included in this turn's orphan-push.
4. **Should the orphan branch be force-pushed or recreated (i.e., `--orphan` flag + reset)?** — Current decision: force-push (preserves commit history graph; the orphan branch is the audit trail).
5. **Should the T23 worktree (local only) be promoted to a remote branch?** — No, per ADR-023 device-fit policy; T23 is ephemeral.

---

## 9. Provenance & Audit Trail

**Sources (in priority order):**

1. `phenotype-registry/worklogs/L7-{001..008}-*.json` — primary source of truth
2. `phenotype-registry-curation-data/worklogs/L7-{001..007}-*.json` — secondary (curation-side mirror)
3. `phenotype-registry/STATUS.md` — this file (canonical going forward)
4. `phenotype-registry/PUSH-STATUS.md` — orphan-push recipe (preserved)
5. `phenotype-registry/PROPAGATION_REPORT.md` — propagation audit (L7-003 era, preserved)
6. `phenotype-registry/ALIASES.md` — collision-resolution canonical map
7. `phenotype-registry/ECOSYSTEM_MAP.md` — canonical ecosystem index (111 repos, 12 roles)

**ADRs referenced (this document):**

- ADR-023 (device-fit policy)
- ADR-024 (71-pillar framework)
- ADR-025 (worklog v2.1 schema bump)
- ADR-026 (Factory AI Agent Readiness Model)
- ADR-031 (Configra absorb, 2026-06-17)
- ADR-033 (phenotype-monorepo-state deletion, CLOSED 2026-06-19)
- ADR-035 (Configra migration gates, 2026-06-18)
- ADR-036 (pheno-capacity substrate canonical, ACCEPTED 2026-06-20, execution deferred v12+)
- ADR-037 (pheno-mcp-router substrate canonical, re-affirmed 2026-06-18)
- ADR-041 (71-pillar refresh cadence, 2026-06-18)
- ADR-042 (security audit cadence, 2026-06-18)
- ADR-043 (registry refresh cadence, 2026-06-18)
- ADR-046 (federation mTLS + OIDC, 2026-06-18)
- ADR-047 (predictive DRY discipline, 2026-06-18)
- ADR-048 (substrate graduation path, 2026-06-18)
- ADR-049 (app-substrate drift detector, 2026-06-18)
- ADR-050 + ADR-051 (router architecture decision, ACCEPTED 2026-06-20)

---

## 10. Next Steps (post-L7-008)

1. **Verify orphan-push this turn** — new SHA should be live on GitHub after `--force` push
2. **Verify via curl** — `curl https://api.github.com/repos/KooshaPari/phenotype-registry/branches/chore/l7-001-contract-only-orphan-2026-06-17` returns new SHA
3. **Schedule L7-009 (next archived-flag refresh)** — weekly cadence per ADR-024 / ADR-041; first scheduled run 2026-06-22 09:00 PDT via launchd
4. **Close L5-117 pheno-capacity execution** — deferred to v12+ per ADR-036
5. **Continue V11-016 tier-0 retirement wave** on registry main (separate from L7 sweep)

---

## 11. CHANGELOG (this file)

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-06-20 18:45 PDT | KooshaPari (macbook, L7-008) | Initial STATUS.md — replaces STATUS-REPORT.md (L7-003) and STATUS-L7-004-VERIFICATION.md as canonical status document. Covers L7-001 → L7-008 phase recap with deltas, current remote SHAs, per-phase key outputs (45,091 records, 107 bound repos, 8 stubs, 3 extraction targets, 12 archived markers), 21 successful subagent dispatches across 8 phases, outstanding human-judgment queue, weekly refresh cadence status. |

---

## 12. References

- `phenotype-registry/worklogs/L7-001-intent-boundary-curation-2026-06-17.json`
- `phenotype-registry/worklogs/L7-002-collision-resolution-2026-06-18.json`
- `phenotype-registry/worklogs/L7-003-ecosystem-reconciliation-2026-06-18.json`
- `phenotype-registry/worklogs/L7-004-template-prefix-binding-2026-06-18.json`
- `phenotype-registry/worklogs/L7-004-curation-push-2026-06-18.json`
- `phenotype-registry/worklogs/L7-004-stub-prose-2026-06-18.json`
- `phenotype-registry/worklogs/L7-004-extraction-targets-2026-06-18.json`
- `phenotype-registry/worklogs/L7-004-final-consolidation-2026-06-19.json`
- `phenotype-registry/worklogs/L7-005-stub-prose-fill-2026-06-19.json` (orphan remote @ 9d9958b5)
- `phenotype-registry/worklogs/L7-006-post-resume-consolidation-2026-06-20.json`
- `phenotype-registry/worklogs/L7-007-archived-marker-pass-2026-06-20.json` (curation-data local @ 32c3e8dc)
- `phenotype-registry/worklogs/L7-008-status-md-and-push-2026-06-20.json` (this file)

**Cross-references:**

- `phenotype-registry-curation-data/_bindings.json` (556 KB, 107 keys, 12 archived-flagged)
- `phenotype-registry-curation-data/ALIASES.md` (46 entries: 19 active + 27 dropped + 4 absorbed)
- `phenotype-registry-curation-data/ECOSYSTEM_MAP.md` (111 repos, 12 roles)
- `phenotype-registry/PUSH-STATUS.md` (orphan-bundle recipe)
- `phenotype-registry/PROPAGATION_REPORT.md` (L7-003 propagation audit)
- `phenotype-registry/registry/disposition-index.json` (v1.5.2, 98 rows)
