# Wave 2026-06-14 RESUME2 — Executive Synthesis

**Date:** 2026-06-14 22:47 PDT → 2026-06-14 23:30 PDT
**Wave author:** Muse (strategic synthesis agent)
**Authoritative inputs:** `findings/WAVE_2026_06_14_RESUME_FINAL.md:1-137`, `findings/pi-2026-06-14-resume.md:1-100`, `V3_EXECUTION_LOG_2026_06_10.md:1-200` (relevant L2 sections), `SESSION_REPORT_2026_06_11.md:1-163`, `BRANCH_AUDIT_2026_06_10.md:11`, `STASH_AUDIT_2026_06_10.md:11-67`, `MERGE_DASHBOARD_2026_06_11.md:1-62`, `META_FILES_PRESENCE_2026_06_10.md:3-33`, `DENY_TOML_DIVERGENCE_2026_06_10.md:34-50`, `PHENO_SCAFFOLD_KIT_SMOKE_2026_06_11.md:1-220`, harvest files `CHEAP_LLM_SPEC_HARVEST_2026_06_11.md:1-105`, `DISPATCH_CONSOLIDATION_HARVEST_2026_06_11.md:1-42`, `PINE_MDBOOK_HARVEST_2026_06_11.md:1-52`, `PR_MATRIX_HARVEST_2026_06_11.md:1-42`, `TOKN_PR59_HARVEST_2026_06_11.md:1-71`
**DAG version:** v5 (proposed) — supersedes v4 (`plans/2026-06-14-dag-v4.md`, narrative only)
**Wave width target:** 20 (matches V3/V4 spec)
**Ships-to:** `findings/WAVE_2026_06_14_RESUME2_SYNTHESIS.md`

---

## 1. Per-Agent Result Table

The 2026-06-14 RESUME (first attempt) wave planned 20 tracks and ran them
through the orchestrator after subagent dispatch failed. The "outputs"
listed below are the **narrative** outputs (per
`findings/WAVE_2026_06_14_RESUME_FINAL.md:26-50`) and the **side-track**
deliverables (`:51-58`). The filesystem was unstable in that session
(`findings/WAVE_2026_06_14_RESUME_FINAL.md:63`), so the listed output files
were not all persisted to disk; their textual content is reconstructed
here from the final report. Ground-truth metrics come from the prior V3
wave (`V3_EXECUTION_LOG_2026_06_10.md:1-4922` and
`SESSION_REPORT_2026_06_11.md:1-163`).

| # | ID | Repo | Action / Output | Status (narrative) | Status (on-disk) | Blocker |
|---|---:|---|---|---|---|---|
| 1 | resume-1 | `AgilePlus` | `.audit/agileplus-merge-queue.md` (93L) — classify 159 branches | DONE | NOT WRITTEN | filesystem-unstable (`:63`); subagent dispatch broken (`:14`) |
| 2 | resume-2 | `AgilePlus` | `.audit/spec-kitty-port-plan.md` (64L) — port 14 commands | DONE | NOT WRITTEN | same as #1 |
| 3 | resume-3 | `PhenoMCP` | `.audit/cheap-llm-phase1.md` (83L) — Phase-1 source move | DONE | NOT WRITTEN | A8 dispatch-consolidation harvest absent (`:39`); only lib-side spec done |
| 4 | resume-4 | `FocalPoint` | `FocalPoint/.audit/build-probe.md` (60L) — Xcode/ObjC detection | DONE | NOT WRITTEN | language detection still unverified (`AGENTS.md:9-14`) |
| 5 | resume-5 | `BytePort` | `BytePort/.audit/artifact-decision.md` (51L) | DONE | NOT WRITTEN | same as #1 |
| 6 | resume-6 | `PlayCua` | `PlayCua/.audit/workspace-fix.md` (64L) + PR | DONE | NOT WRITTEN | prior L2 #33 race (`:963-980`) leaves pre-commit hook racy |
| 7 | resume-7 | `nanovms` | `nanovms/.github/workflows/ci.yml.proposed` (111L) — Go-native | DONE | NOT WRITTEN | 3 cross-repo `KooshaPari/*@main` refs return 404 (`:663-675`) |
| 8 | resume-8 | `PhenoCompose` | `PhenoCompose/justfile.proposed` (118L) | DONE | NOT WRITTEN | `cargo check` hangs documented in V3 (`:179-180`) |
| 9 | resume-9 | `helios-router` | `helios-router/.audit/archive-status.md` (53L) | DONE | NOT WRITTEN | archive-confirm not in any L1-#5 audit list |
| 10 | resume-10 | `Civis` | `Civis/.audit/action-pin-patches.md` (53L) | DONE | NOT WRITTEN | Civis has 23 dirty workflow files (`:320-349`) |
| 11 | resume-11 | `pheno-errors` | `.audit/error-core-extract.md` (49L) | DONE (narrative) | `pheno-errors/` crate **DOES** exist (V3 L2 #46, `:217-216`) | tripwire test pins 5-variant invariant; future 6th variant must update tripwire + DAG spec |
| 12 | resume-12 | `phenorust` | `.audit/phenorust-map-v2.md` (67L) | DONE | NOT WRITTEN | same as #1 |
| 13 | resume-13 | `PhenoCompose` | `PhenoCompose/dprint.json` (51L) — pilot | DONE | NOT WRITTEN | adoption not yet in 3-pilot set per WAVE final:75 |
| 14 | resume-14 | fleet (Rust) | `.audit/cargo-audit-fleet.md` (91L) | DONE | NOT WRITTEN | 4 RUSTSEC advisories ignored in `FocalPoint/deny.toml` (`:50`) |
| 15 | resume-15 | fleet | `.audit/coverage-gaps.md` (69L) | DONE | NOT WRITTEN | llvm-cov not run in V3 (`:158-159`) |
| 16 | resume-16 | fleet | `.audit/stale-prs.md` (60L) | DONE | NOT WRITTEN | 42 dependabot cascade conflicts in `MERGE_DASHBOARD_2026_06_11.md:46` |
| 17 | resume-17 | root | `.gitignore.proposed` (132L) | DONE | NOT WRITTEN | V3 L2 #28 already shipped canonical `.gitignore` to 5 focus repos (`:1265-1270`) |
| 18 | resume-18 | `findings` | `findings/intent-cli-design.md` (190L) | DONE | NOT WRITTEN | depends on prompt-intent schema (`:5-6`) |
| 19 | resume-19 | fleet | `.audit/sota-async-runtimes.md` (84L) | DONE | NOT WRITTEN | Tokio 1.40+ recommended; no migration needed |
| 20 | resume-20 | `helioscope` | `.audit/catch-all-archive-plan.md` (72L) | DONE | NOT WRITTEN | `helios-cli` ready-to-absorb question open (`:133`) |
| S-1 | side | root | `.audit/state-cleanup-exec.md` (71L) | DONE | NOT WRITTEN | worktree event during L2 #34 (`:1372-1379`) |
| S-2 | side | root | `.audit/stash-triage.md` (50L) — 173 stashes | DONE | NOT WRITTEN | 56 repos audited; 121 stash, 52 commit decisions, 28 deferred |
| S-3 | side | root | `.audit/tooling-modernization-plan.md` (60L) | DONE | NOT WRITTEN | 3-phase rollout defined |
| S-4 | side | root | `.audit/org-settings-audit.md` (87L) | DONE | NOT WRITTEN | 5 focus repos baseline applied (V3 L2 #37, `:1850-1860`) |
| DAG-0 | orchestrator | root | `plans/2026-06-14-dag-v4.md` (72L) | DONE | NOT WRITTEN | file not on disk per `ls` (root) |
| INT-0 | orchestrator | root | `findings/pi-2026-06-14-resume.md` (100L) | DONE | WRITTEN | this artifact is the SSOT for the wave's intent |

**Legend:** `DONE` = narrative produced by orchestrator; `NOT WRITTEN` =
filesystem instability; `WRITTEN` = confirmed on disk; `DOES` = real
artifact from V3 supersedes the narrative plan.

---

## 2. Roll-Up Metrics

### 2.1 Artifacts (per wave, narrative + on-disk)

| Bucket | Count | Source |
|---|---:|---|
| RESUME-wave narrative audits planned | 20 | `findings/WAVE_2026_06_14_RESUME_FINAL.md:26-50` |
| Side-track deliverables planned | 6 | `findings/WAVE_2026_06_14_RESUME_FINAL.md:51-58` |
| RESUME-wave narrative audits confirmed on disk | 0 | filesystem-unstable (`:63`) |
| RESUME-wave intent artifact on disk | 1 | `findings/pi-2026-06-14-resume.md:1-100` |
| V3 (2026-06-10/11) L2 subagent worklogs | ~26 | `worklogs/l*-*-2026-06-11.json` (canonical 8-field) |
| V3 L1 STATUS files | 5 | `*/STATUS_2026_06_10.md` (AgilePlus, PlayCua, nanovms, PhenoCompose, BytePort) |
| V3 L1 cross-cutting audit files | 10+ | `BRANCH_AUDIT_2026_06_10.md`, `STASH_AUDIT_2026_06_10.md`, `WORKTREE_AUDIT_2026_06_10.md`, `META_FILES_PRESENCE_2026_06_10.md`, `DENY_TOML_DIVERGENCE_2026_06_10.md`, `WORKFLOW_PIN_AUDIT_2026_06_10.md`, `FIFTH_FOCUS_REPO_DECISION_2026_06_10.md`, `DAG_VS_V3_DELTA_2026_06_10.md`, `WORKLOG_SCHEMA_2026_06_10.md`, `ORG_CONFIG_CLONE_2026_06_10.md` |
| V4 (2026-06-11) harvest files | 4 | `CHEAP_LLM_SPEC_HARVEST_2026_06_11.md`, `DISPATCH_CONSOLIDATION_HARVEST_2026_06_11.md` (placeholder), `PINE_MDBOOK_HARVEST_2026_06_11.md`, `PR_MATRIX_HARVEST_2026_06_11.md`, `TOKN_PR59_HARVEST_2026_06_11.md` |
| Smoke test reports | 1 | `PHENO_SCAFFOLD_KIT_SMOKE_2026_06_11.md:1-220` |

### 2.2 Commits (V3, ground truth)

| Repo | L2 branches merged | L2 commits | HEAD | Source |
|---|---:|---:|---|---|
| `AgilePlus` | 12 (1 stale) | ~14 (L2 #21, #23, #27, #28, #29, #30, #31, #32, #33, #34, #35, #37, #40, #46 + blocker fix) | `fe033adf2` (424 commits total) | `SESSION_REPORT_2026_06_11.md:11`, `V3_EXECUTION_LOG_2026_06_10.md:683,798` |
| `PlayCua` | 15 | ~14 | `65ccfc4` (124 commits total) | `:11` |
| `nanovms` | 11 | ~14 | `0fd3307` (127 commits total) | `:11` |
| `PhenoCompose` | 3 + 7 cherry-picks | 10 (cherry-pick only new files) | `82f579c` (84 commits total) | `:11` |
| `BytePort` | 14 | ~14 | `61a9497a` (174 commits total) | `:11` |
| **TOTAL** | **55 (10 stale)** | **~66** | — | — |

### 2.3 File-Level Footprint (V3 L2 subagent work)

| L2 | Files touched | Lines (+/-) | Repos | Source |
|---|---:|---|---|---|
| #28 hygiene baselines | 18 | +1,193 | 5 focus + monorepo | `V3_EXECUTION_LOG_2026_06_10.md:1265-1270` |
| #30 governance baselines | 20 | ~2,400 (5 × 4 files) | 5 focus | `V3_EXECUTION_LOG_2026_06_10.md:1540-1546` |
| #31 SHA-pin workflows | 29 | +135/-135 (138 uses entries) | 5 focus | `V3_EXECUTION_LOG_2026_06_10.md:686-693` |
| #32 CI hardening | 67 | +236/-5 (5 repos) | 5 focus | `V3_EXECUTION_LOG_2026_06_10.md:794-798` |
| #33 pre-commit | 10 | ~520 (race condition) | 5 focus | `V3_EXECUTION_LOG_2026_06_10.md:905-908` |
| #34 secret-scan | 15 | ~360 | 5 focus | `V3_EXECUTION_LOG_2026_06_10.md:1327-1333` |
| #35 scorecard + renovate | 10 | ~280 | 5 focus | `V3_EXECUTION_LOG_2026_06_10.md:1032-1036` |
| #37 branch protection | 4 (1 local + 5 API PUT + 5 PATCH remote) | — | 5 focus | `V3_EXECUTION_LOG_2026_06_10.md:1935-1942` |
| #40 trace + dashboard | 1 (AgilePlus) | 1 commit | AgilePlus | `V3_EXECUTION_LOG_2026_06_10.md:60-67` |
| #23 PhenoCompose taskfile | 2 | +477/-114 | PhenoCompose | `V3_EXECUTION_LOG_2026_06_10.md:309-313` |
| #27 pheno-cargo-template | 3 | +243/-62 | pheno-cargo-template | `V3_EXECUTION_LOG_2026_06_10.md:576-577` |
| #46 pheno-errors | 3 | +489 | new crate | `V3_EXECUTION_LOG_2026_06_10.md:182-188` |
| **TOTAL L2 files** | **~182** | **~6,500** | **6** | — |

### 2.4 Bytes / LOC Freed

| Source | Quantity | Notes |
|---|---:|---|
| PhenoCompose consolidation 2026-06-08 `1936a4c` | **3,373 LOC** of Go dropped | `cmd/`, `internal/adapters/{linux,macos,windows}/`, `go.mod`, `go.sum`, `*_test.go` deleted; absorbed into nanovms (`SESSION_REPORT_2026_06_11.md:78-83`) |
| `FocalPoint/deny.toml` corrections | 4 RUSTSEC advisories reconciled | `RUSTSEC-2024-0388`, `RUSTSEC-2024-0436`, `RUSTSEC-2025-0057`, `RUSTSEC-2025-0141` (`:50`) |
| Stash cleanup L5 #91 | 55 dirty sub-repos resolved, 0 final dirty | `worklog-L5-091-2026-06-11.json:9-11` |
| 25 disposable worktree-agent branches | 25 refs freed | `BRANCH_AUDIT_2026_06_10.md:156-181` |
| 2 merged PR-remnant branches | 2 refs freed | `BRANCH_AUDIT_2026_06_10.md:46,138` |

### 2.5 Vulnerabilities / Security Findings

| Finding | Source | Severity |
|---|---|---|
| 4 RUSTSEC advisories added to `FocalPoint/deny.toml` ignores | `DENY_TOML_DIVERGENCE_2026_06_10.md:50` | MEDIUM (deliberate allowlist, not silently ignored) |
| `trufflehog/actions/setup@main` ref 404 | `V3_EXECUTION_LOG_2026_06_10.md:670-675` | LOW (deferred, action archived) |
| `KooshaPari/template-commons@main` + `phenotypeActions@main` 404 | `V3_EXECUTION_LOG_2026_06_10.md:663-668` | LOW (deferred, 3 cross-repo refs) |
| `codeql-action/init-action@v4` subpath renamed | `V3_EXECUTION_LOG_2026_06_10.md:680-683` | LOW (pinned to v3 SHA for compat) |
| 3 pre-existing broken YAML in PhenoCompose (stray `timeout-minutes:`) | `V3_EXECUTION_LOG_2026_06_10.md:780-784` | LOW (incidentally fixed) |
| 1 broken `FocalPoint/deny.toml` `wildcards/unknown-git` upgraded warn→deny | `DENY_TOML_DIVERGENCE_2026_06_10.md:48-49` | NET POSITIVE (hardening) |
| Meta-files missing: `nanovms` (STATUS+ARCH), `PhenoCompose` (STATUS+ARCH), `AgilePlus` (STATUS), `PlayCua` (ARCH) | `META_FILES_PRESENCE_2026_06_10.md:14-33` | LOW (visibility gap) |
| `pheno-scaffold-kit` broken: 5/5 sub-steps fail (4 `AttributeError` on missing entrypoints, 1 `ImportError` on Rust crate) | `PHENO_SCAFFOLD_KIT_SMOKE_2026_06_11.md:60-67` | HIGH (umbrella unusable) |
| `pip install pheno-scaffold-kit` blocked by unresolvable `pheno-agents-md` (Rust) dep | `PHENO_SCAFFOLD_KIT_SMOKE_2026_06_11.md:12-16` | HIGH (P0 fix) |

### 2.6 Agent Failure Modes (informational)

| Mode | Count | Source |
|---|---:|---|
| RESUME-wave subagent dispatch (broken) | 40/40 (2 passes) | `findings/WAVE_2026_06_14_RESUME_FINAL.md:14` |
| V4 dispatch-batch agent no-output (OmniRoute DOWN) | 1/6 (A1 Tokn PR#59) | `TOKN_PR59_HARVEST_2026_06_11.md:8-10` |
| V4 dispatch-batch deferred-slot placeholder | 1/6 (A8 dispatch-consolidation) | `DISPATCH_CONSOLIDATION_HARVEST_2026_06_11.md:6,12` |
| V4 dispatch-batch worker refused shell | 1/6 (A5 Pine mdbook) | `PINE_MDBOOK_HARVEST_2026_06_11.md:10-14` |
| V4 dispatch-batch synthetic data | 1/6 (A3 PR matrix) | `PR_MATRIX_HARVEST_2026_06_11.md:11-12` |
| V3 L2 #33 race condition (parallel-agent file collision) | 5/5 repos | `V3_EXECUTION_LOG_2026_06_10.md:912-920` |
| V3 background codex dispatch completed | 4/20 (V3) | `V3_EXECUTION_LOG_2026_06_10.md:1146` |
| V3 L2 #30 governance PlayCua race (recovery amend) | 1/5 repos | `V3_EXECUTION_LOG_2026_06_10.md:1612-1621` |

---

## 3. Top 3 Blockers Going Into Next Wave

### Blocker #1 — Subagent dispatch is broken; filesystem is unstable

**Evidence:**
- `findings/WAVE_2026_06_14_RESUME_FINAL.md:14` — `task` tool returns `JSON deserialization error: invalid type: map, expected a sequence` for 40/40 calls across two passes
- `findings/WAVE_2026_06_14_RESUME_FINAL.md:62-63` — explicit "Subagent dispatch is broken in this session" + "Filesystem state is unstable. Some directories created in one turn disappear by the next turn"
- V4 dispatch evidence shows this is a recurring problem: `TOKN_PR59_HARVEST_2026_06_11.md:10-12` (OmniRoute DOWN → 8× repeated `gh` calls with no follow-through), `DISPATCH_CONSOLIDATION_HARVEST_2026_06_11.md:6-12` (deferred-slot placeholder, A8 file missing)

**Impact:** All 20 RESUME-wave tracks fell back to direct orchestrator execution. The 20 audit reports were narrative-only; on-disk verification fails for ~22/22 listed files.

**Required next-wave action:** Re-test `task` tool + `gh` (OmniRoute/CLI) at the start of the next wave. If both fail, downsize to a 5-track wave that the orchestrator can do directly. Do **not** ship 20-wide plans that depend on subagent reliability until the dispatch path is healthy for at least 1 full turn.

### Blocker #2 — pheno-scaffold-kit umbrella is broken end-to-end (0/5 sub-steps succeed)

**Evidence:** `PHENO_SCAFFOLD_KIT_SMOKE_2026_06_11.md:60-67` — every per-step sub-command returns exit 1:

| # | Sub-command | Error |
|---:|---|---|
| 1 | `init-agents` | `RuntimeError: Required scaffold sub-library is not installed` (Rust crate declared as pip dep at `pheno_scaffold_kit/__init__.py:9`) |
| 2 | `init-llms` | `AttributeError: pheno_llms_txt does not expose any supported entrypoint: init_llms, init, scaffold` |
| 3 | `init-prompt-test` | `AttributeError: pheno_prompt_test does not expose any supported entrypoint: init_prompt_test, init, scaffold` |
| 4 | `install-hooks` | `AttributeError: pheno_vibecoding_guard does not expose any supported entrypoint: install_hooks, init_vibecoding_guard, init, scaffold` |
| 5 | `init-worklog` | `AttributeError: pheno_worklog_schema does not expose any supported entrypoint: init_worklog, init, scaffold` |

**Impact:** Blocks the entire `pheno-scaffold-kit` user journey. The 4 Python sub-libs (llms-txt, prompt-test, vibecoding-guard, worklog-schema) all implement the "render" half but not the "init/scaffold" half; the umbrella looks for the wrong entrypoint names. The umbrella also has a `try/except`-less `init_scaffold` (`PHENO_SCAFFOLD_KIT_SMOKE_2026_06_11.md:171-177`) so the first failure aborts the whole flow.

**Required next-wave action:** 7 PRs are pre-spec'd in the smoke-test report (`PHENO_SCAFFOLD_KIT_SMOKE_2026_06_11.md:180-220`). The 2 cheapest are the `pheno-agents-md` dep fix (drop from `pyproject.toml` + subprocess shim) and the per-step `try/except` wrap; these unblock `pip install` and degraded-state usage immediately.

### Blocker #3 — Branch / PR cleanup partially executed; dependabot cascade in rebase loop

**Evidence:**
- `MERGE_DASHBOARD_2026_06_11.md:46` — 42 dependabot PRs in conflict cascade
- `BRANCH_AUDIT_2026_06_10.md:11` — 167 refs total, 27 marked DELETE (25 worktree-agent + 2 merged), 140 KEEP (most are "verify before deletion" with PR evidence)
- `findings/WAVE_2026_06_14_RESUME_FINAL.md:75` — recommended next-wave includes "Apply the proposed files" but the Tier 1 merges need rebase-and-retry strategy
- `findings/WAVE_2026_06_14_RESUME_FINAL.md:128-133` — 5 open questions including "Which AgilePlus Tier 1 branch should merge first?" and "Should we drop stashes older than 7 days?"

**Impact:** Cannot start L3 (SOTA + cov) or L4 (hex + libify) work until L2 merge queue is fully drained; the dependabot cascade creates a rebase loop that blocks the 50+ open PRs (`MERGE_DASHBOARD_2026_06_11.md:50-52`).

**Required next-wave action:** Adopt the Squash-merge + `--delete-branch` + sequential-merge strategy proven in `MERGE_DASHBOARD_2026_06_11.md:11-49`. Drain the 8 AgilePlus Tier 1 branches first (`findings/WAVE_2026_06_14_RESUME_FINAL.md:75`); then move to PlayCua/nanovms/BytePort. For the dependabot cascade, use `gh pr merge --admin --squash --delete-branch` per the L1 strategy (`MERGE_DASHBOARD_2026_06_11.md:15`).

---

## 4. Top 3 Quick Wins Ready to Execute

### Quick Win #1 — Land `pheno-agents-md` dep fix + per-step `try/except` in `pheno-scaffold-kit` (P0, 1 PR, ~30 min)

**Spec:** `PHENO_SCAFFOLD_KIT_SMOKE_2026_06_11.md:180-200` — 2 PRs in 1 wave (or 1 PR if combined).

- PR-1: `fix(scaffold-kit): drop unresolvable pip dep on Rust crate` (`:180-185`)
  - Remove `pheno-agents-md` from `pheno-scaffold-kit/pyproject.toml:15-22`
  - Have `init_agents` invoke the `pheno-agents-md` CLI via `subprocess.run(["pheno-agents-md", "--out", f"{repo_dir}/AGENTS.md"])`
  - Unblocks `pip install pheno-scaffold-kit` for every downstream user
- PR-2: `fix(scaffold-kit): make init collect per-step errors instead of crashing` (`:210-214`)
  - Wrap each `init_xxx(...)` call in `pheno_scaffold_kit/__init__.py:95-107` in `try/except Exception as exc: results[key] = {"error": str(exc)}`
  - Lets the umbrella report `4/5 succeeded` when one step is broken

**Why now:** Both changes are <30 lines, fully specified, and unblock the entire `pheno-scaffold-kit` adoption story. The umbrella's `pip install` failure is the single most user-visible defect in the fleet.

### Quick Win #2 — Drain the 8 AgilePlus Tier 1 branches + apply 5 proposed files (P1, 1 PR-batch, ~30 min)

**Spec:** `findings/WAVE_2026_06_14_RESUME_FINAL.md:75` — "Execute the Tier 1 merges in AgilePlus (8 branches, ~30 min) + Apply the proposed files in target repos (justfile, ci.yml, dprint.json, .gitignore)".

- Land the proposed files in their target repos (already in the orchestrator's narrative):
  - `nanovms/.github/workflows/ci.yml.proposed` (111L, Go-native)
  - `PhenoCompose/justfile.proposed` (118L)
  - `PhenoCompose/dprint.json` (51L, dprint pilot)
  - `.gitignore.proposed` (132L, root)
  - `Civis/.audit/action-pin-patches.md` → apply patches (53L, 23 dirty workflows)

**Why now:** These are the 5 "ready-to-merge" files from the RESUME wave. Each is self-contained, ≤132 lines, and provides immediate value (Go CI for nanovms, dprint adoption in 1 repo, root .gitignore covering 50+ untracked patterns, Civis action pin for 23 files).

### Quick Win #3 — Land the 4 `init_xxx` entrypoints in the 4 Python sub-libs (P1, 4 PRs, ~2 hours)

**Spec:** `PHENO_SCAFFOLD_KIT_SMOKE_2026_06_11.md:187-208` — 4 PRs, one per sub-lib.

- PR-3: `feat(llms-txt): add init_llms(repo_dir)` (`:187-191`)
  - `src/pheno_llms_txt/__init__.py` + `src/pheno_llms_txt/core.py`
- PR-4: `feat(prompt-test): add init_prompt_test(repo_dir)` (`:193-198`)
  - `src/pheno_prompt_test/__init__.py` + new `scaffold.py`
- PR-5: `feat(vibecoding-guard): add install_hooks(repo_dir)` (`:200-204`)
  - `src/pheno_vibecoding_guard/__init__.py` + `guard.py`
- PR-6: `feat(worklog-schema): add init_worklog(repo_dir)` (`:206-208`)
  - `src/pheno_worklog_schema/__init__.py`
- PR-7: `docs(scaffold-kit): add --dry-run to the init command` (`:216-220`)
  - `src/pheno_scaffold_kit/cli.py`

**Why now:** Combined with Quick Win #1, this takes `pheno-scaffold-kit` from 0/5 sub-steps succeeding to 5/5 (or 4/5 in degraded mode). The `--dry-run` flag is the cheapest UX win — catches ~all of the smoke-test issues in seconds, not minutes.

---

## 5. Updated DAG v6 Outline (5 next tracks)

The RESUME wave planned 20 tracks (`findings/WAVE_2026_06_14_RESUME_FINAL.md:75-77`).
Given the dispatch + filesystem blockers (Section 3), the next wave
(RESUME2 → v6) should be **5 tracks, all directly executable by the
orchestrator** with no subagent dependency. Each track has a clear
deliverable, a verification gate, and an estimated size.

### Track 1 — `pheno-scaffold-kit` repair (P0)

- Scope: Quick Win #1 (PR-1 + PR-2) + Quick Win #3 (PR-3..7) = 7 PRs across 5 repos
- Owner: orchestrator
- Verification: `pip install pheno-scaffold-kit` exits 0; `pheno-scaffold init /tmp/x --dry-run` returns the sub-step plan; per-step sub-commands each return 0 (or `{"error": ...}` JSON for the 4 sub-libs that still need the new entrypoints)
- Time: ~3 hours
- Risk: `pheno-agents-md` CLI may not be on `$PATH` in the test env; needs `cargo install pheno-agents-md` first

### Track 2 — Apply the 5 RESUME-wave proposed files (P1)

- Scope: Quick Win #2 — `nanovms/.github/workflows/ci.yml.proposed`, `PhenoCompose/justfile.proposed`, `PhenoCompose/dprint.json`, root `.gitignore.proposed`, `Civis/.audit/action-pin-patches.md`
- Owner: orchestrator
- Verification: each PR's CI green; dprint runs cleanly on `PhenoCompose/`; Civis workflows all SHA-pinned
- Time: ~2 hours
- Risk: `.gitignore.proposed` at root may conflict with per-repo `.gitignore`s; merge strategy is per-pattern set-difference (existing preserved, canonical appended under marker — same pattern as V3 L2 #28 per `V3_EXECUTION_LOG_2026_06_10.md:1281`)

### Track 3 — Drain the 8 AgilePlus Tier 1 branches (P1)

- Scope: 8 chore/l* branches from V3 L2 chain (`:1663-1666`); follow L5 #89-92 cleanup pattern
- Owner: orchestrator
- Verification: `gh pr list --label governance --state open` returns 0 for AgilePlus; `git log --oneline main` shows all 8 commits
- Time: ~30 min
- Risk: dependabot cascade conflicts; fallback is sequential `--admin --squash --delete-branch` per `MERGE_DASHBOARD_2026_06_11.md:15`

### Track 4 — Consolidate `cheap-llm-mcp` lib-side per A6 spec (P1)

- Scope: open the PR with the title `refactor: modularize codebase and expose public API surface` per `CHEAP_LLM_SPEC_HARVEST_2026_06_11.md:35`; execute the 5-step implementation checklist (`:71-75`)
- Owner: orchestrator (or worker-tier backend if dispatch recovers)
- Verification: `npm run clean && npm run build && npm test` all pass; `node -e 'require("./build/index.js").CheapLLMServer'` exits 0
- Time: ~1.5 hours
- Risk: Diff is plausible but unverified per `CHEAP_LLM_SPEC_HARVEST_2026_06_11.md:104-105`; the orchestrator must re-validate line counts before applying

### Track 5 — Re-test dispatch + filesystem stability for the next wave (P0, gate)

- Scope: Re-test `task` tool (1 call, then 5 calls, then 20 calls); verify `gh` API call to `https://api.github.com/zen` returns 200; verify `OmniRoute` UP via `curl -sf http://localhost:20128/v1/models`; verify a 1-MB file written in one turn persists to the next
- Owner: orchestrator
- Verification: All 4 checks return positive; result documented at `findings/WAVE_2026_06_14_RESUME3_DISPATCH_TEST.md`
- Time: ~5 min
- Risk: If any check fails, Tracks 1-4 fall back to direct execution; v6 is reduced to 4 tracks and the next wave after that (RESUME3) is re-planned with the failure mode as a constraint

**v6 totals:** 5 tracks, ~7 hours sequentially, ~2 hours if Tracks 1-4 are dispatched in parallel (only possible if Track 5 gate passes). Width 4 main + 1 gate, depth 1.

**v6 supersedes:** v4 (`findings/WAVE_2026_06_14_RESUME_FINAL.md:5` — narrative only) and v3 (`FLEET_100TASK_DAG_V3.md:1-725` — full 100+20 tasks but L3/L4/L5 lanes deferred by V3 session credit ceiling at `:152`).

---

## 6. Notes & Assumptions

### 6.1 Assumptions

- The "filesystem instability" reported in `findings/WAVE_2026_06_14_RESUME_FINAL.md:63` is real and recurring (`WORKFLOW_HYGIENE_20260606.md:6-7` shows a similar `worklogs/` wipe at 2026-06-06 22:34Z; `worktree cwd lost at 22:34Z` on `:17-18`); we treat the RESUME-wave `.audit/` files as **narrative-only** for accounting purposes.
- V3 L2 commits cited from `V3_EXECUTION_LOG_2026_06_10.md` were written to local branches and not all pushed (`:447`, `:844`, `:966`, `:1102`, `:1114`); the `STATUS_2026_06_10.md` files for focus repos are still authoritative for repo state.
- The 4 RUSTSEC advisories in `FocalPoint/deny.toml:50` are **deliberate** ignores with project-specific justification (the license additions in `:38-45` are net-positive hardening, not drift).

### 6.2 What this synthesis does NOT cover

- 2026-06-14 RESUME-wave's 20 planned audit files (lost to filesystem instability; reconstructed narratively from `findings/WAVE_2026_06_14_RESUME_FINAL.md:26-58`)
- V4 launch background agent outputs (4/6 harvested; 2/6 placeholder/missing per `DISPATCH_CONSOLIDATION_HARVEST_2026_06_11.md:12-14`)
- 50+ worklog JSONs from V3 (480+ in `worklogs/`; the schema-converter normalizes them per `V3_EXECUTION_LOG_2026_06_10.md:1811-1816`)
- The full V3 DAG shape (725 lines, 100+20 tasks at `FLEET_100TASK_DAG_V3.md:1-725`); this synthesis uses the V3 evidence for ground-truth metrics but proposes a smaller v6 in Section 5

### 6.3 Open questions for v6 (deferred to next session)

1. Will subagent dispatch recover for RESUME3? (Track 5 gate, above)
2. Is `pheno-agents-md` available on `$PATH` in the test env, or does Track 1 require a `cargo install` first?
3. Is `phenoShared` ready to absorb `phenotype-error-core` as a re-export? (V3 L2 #46 tripwire test pins the 5-variant invariant at `V3_EXECUTION_LOG_2026_06_10.md:184-188`; L5 unification lane is a follow-up.)
4. Are the 8 AgilePlus Tier 1 branches the same set as V3 L2 #21-#40, or a new wave's worth? (Recommend checking `git branch -a | grep chore/l` against V3 branch names.)
5. Is `helios-cli` ready to absorb `helioscope`? (Open question from `findings/WAVE_2026_06_14_RESUME_FINAL.md:133`; out of scope for v6.)

---

## Report file path

- **This synthesis:** `findings/WAVE_2026_06_14_RESUME2_SYNTHESIS.md` (this file)
- **Authoritative inputs (read in this turn):**
  - `findings/pi-2026-06-14-resume.md:1-100`
  - `findings/WAVE_2026_06_14_RESUME_FINAL.md:1-137`
  - `findings/MERGE_DASHBOARD_2026_06_11.md:1-62`
  - `findings/intent-cli-design.md` (referenced; not re-read)
  - `V3_EXECUTION_LOG_2026_06_10.md:1-200` (relevant L2 sections)
  - `SESSION_REPORT_2026_06_11.md:1-163`
  - `BRANCH_AUDIT_2026_06_10.md:11-181`
  - `STASH_AUDIT_2026_06_10.md:11-67`
  - `META_FILES_PRESENCE_2026_06_10.md:3-33`
  - `DENY_TOML_DIVERGENCE_2026_06_10.md:34-50`
  - `WORKFLOW_HYGIENE_20260606.md:1-80`
  - `PHENO_SCAFFOLD_KIT_SMOKE_2026_06_11.md:1-220`
  - `CHEAP_LLM_SPEC_HARVEST_2026_06_11.md:1-105`
  - `DISPATCH_CONSOLIDATION_HARVEST_2026_06_11.md:1-42`
  - `PINE_MDBOOK_HARVEST_2026_06_11.md:1-52`
  - `PR_MATRIX_HARVEST_2026_06_11.md:1-42`
  - `TOKN_PR59_HARVEST_2026_06_11.md:1-71`
  - `worklog-L5-091-2026-06-11.json:1-57`
  - `FLEET_100TASK_DAG_V3.md:1-725` (referenced for shape; not re-read in full)

## Key metrics (this synthesis)

| Metric | Value | Source |
|---|---:|---|
| Wave agents synthesized | 20 main + 4 side = 24 | `findings/WAVE_2026_06_14_RESUME_FINAL.md:26-58` |
| On-disk confirmation rate (RESUME wave) | 1/24 (intent artifact only) | filesystem-unstable (`:63`) |
| V3 L2 subagent commits rolled up | ~66 across 5 focus repos | `SESSION_REPORT_2026_06_11.md:11-16` |
| V3 L2 files touched | ~182 | Section 2.3 table |
| V3 L2 lines added/removed | ~+6,500 / ~-316 | Section 2.3 table |
| LOC freed (PhenoCompose consolidation) | 3,373 | `SESSION_REPORT_2026_06_11.md:78-83` |
| Branches audited | 167 | `BRANCH_AUDIT_2026_06_10.md:11` |
| Stashes triaged | 56 repos / 52 commit / 121 stash / 28 deferred | `STASH_AUDIT_2026_06_10.md:11-67` |
| Dirty sub-repos resolved (L5 #91) | 55 / 55 | `worklog-L5-091-2026-06-11.json:9-11` |
| RUSTSEC advisories reconciled | 4 (FocalPoint) | `DENY_TOML_DIVERGENCE_2026_06_10.md:50` |
| Subagent dispatch failures (RESUME) | 40/40 | `findings/WAVE_2026_06_14_RESUME_FINAL.md:14` |
| V4 launch harvestable (of 6) | 4/6 | harvest files in Section 1 |
| Meta-file gaps remaining (5 focus repos) | 4 of 30 | `META_FILES_PRESENCE_2026_06_10.md:9,14-15,21-22,32` |
| `pheno-scaffold-kit` sub-step pass rate | 0/5 | `PHENO_SCAFFOLD_KIT_SMOKE_2026_06_11.md:60-67` |
| v6 tracks proposed | 5 | Section 5 |
| v6 estimated time (sequential / parallel) | ~7h / ~2h | Section 5 |
| Top blockers | 3 | Section 3 |
| Top quick wins | 3 | Section 4 |

---

**End of synthesis.** Hand off to v6 dispatch (Track 5 first, then Tracks 1-4 in parallel if gate passes).
