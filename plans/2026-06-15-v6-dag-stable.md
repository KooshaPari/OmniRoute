# DAG v6 — Stable Spec (Phenotype Fleet Consolidation)

**Date authored:** 2026-06-15 01:05 PDT
**Status:** SPEC READY (not yet launched)
**Authoritative source:** `plans/2026-06-15-WAVE_2026_06_14_RESUME2_SYNTHESIS-v2.md:235-285` (Muse synthesis, 2026-06-14 22:47 PDT)
**Supersedes:** v4 (narrative only, never executed) and v3 (`FLEET_100TASK_DAG_V3.md`, deferred by V3 session credit ceiling)
**Ships-to:** This file (stable location; replaces the inline §5 of the synthesis)

---

## Why v6

The 2026-06-14 RESUME wave planned 20 tracks and ran them through the orchestrator after subagent dispatch failed (40/40 dispatches returned `JSON deserialization error`). The "outputs" listed in `findings/WAVE_2026_06_14_RESUME_FINAL.md:26-58` are **narrative-only** — only 1 of 24 outputs (`findings/pi-2026-06-14-resume.md`) was confirmed on disk. v6 is the **next wave** after the RESUME failure, designed to be **executable by the orchestrator alone** (no subagent dependency) so it cannot fail the same way.

---

## v6 Shape

**5 tracks**, ~7 hours sequentially, ~2 hours if Tracks 1-4 are dispatched in parallel (only possible if Track 5 gate passes). Width 4 main + 1 gate, depth 1.

```
        ┌─ Track 1: pheno-scaffold-kit repair (P0, ~3h, 7 PRs)
        ├─ Track 2: Apply 5 RESUME-wave proposed files (P1, ~2h, 5 PRs)
v6 DAG: ┼─ Track 3: Drain 8 AgilePlus Tier 1 branches (P1, ~30min, 8 PRs)
        ├─ Track 4: cheap-llm-mcp lib-side refactor (P1, ~1.5h, 1 PR)
        └─ Track 5: Re-test dispatch + filesystem stability (P0 gate, ~5min)
              │
              └─ if gate fails → Tracks 1-4 fall back to direct (sequential) execution
```

---

## Track 1 — `pheno-scaffold-kit` repair (P0)

**Scope:** Quick Win #1 (PR-1 + PR-2) + Quick Win #3 (PR-3..7) = **7 PRs across 5 repos**

**PR breakdown:**

| PR | Repo | Change |
|---|---|---|
| PR-1 | `pheno-agents-md` | Fix the `pheno-agents-md` dep declaration — currently a Rust crate wrongly declared as a pip dep in the umbrella's `pyproject.toml` |
| PR-2 | `pheno-scaffold-kit` | Add per-step `try/except` wrappers in `pheno_scaffold/runner.py` so a single sub-step failure doesn't abort the whole `init` |
| PR-3 | `pheno-llms-txt` | Add `init_xxx` entrypoint in `pheno_llms_txt/__init__.py` (currently only `render` exists) |
| PR-4 | `pheno-prompt-test` | Add `init_xxx` entrypoint (currently only `render`) |
| PR-5 | `pheno-vibecoding-guard` | Add `init_xxx` entrypoint (currently only `render`) |
| PR-6 | `pheno-worklog-schema` | Add `init_xxx` entrypoint (currently only `render`) |
| PR-7 | `pheno-scaffold-kit` | Add `--dry-run` flag to `pheno-scaffold init` to print the sub-step plan without executing |

**Owner:** orchestrator
**Verification gate:** `pip install pheno-scaffold-kit` exits 0; `pheno-scaffold init /tmp/x --dry-run` returns the sub-step plan; per-step sub-commands each return 0 (or `{"error": ...}` JSON for the 4 sub-libs that still need the new entrypoints)
**Time:** ~3 hours
**Risk:** `pheno-agents-md` CLI may not be on `$PATH` in the test env; needs `cargo install pheno-agents-md` first

---

## Track 2 — Apply 5 RESUME-wave proposed files (P1)

**Scope:** Quick Win #2 — apply the proposed files from the 2026-06-14 RESUME wave (narrative content only, not on disk)

| File | Source | Verification |
|---|---|---|
| `nanovms/.github/workflows/ci.yml.proposed` | Track resume-7 narrative (`:44-50`) | CI green |
| `PhenoCompose/justfile.proposed` | Track resume-8 narrative (`:44-50`) | `just --list` works |
| `PhenoCompose/dprint.json` | Track resume-13 narrative (`:44-50`) | `dprint check` runs cleanly on `PhenoCompose/` |
| root `.gitignore.proposed` | Track resume-17 narrative (`:44-50`) | per-pattern set-difference merge, V3 L2 #28 style (existing preserved, canonical appended under marker per `V3_EXECUTION_LOG_2026_06_10.md:1281`) |
| `Civis/.audit/action-pin-patches.md` | Track resume-10 narrative (`:44-50`) | 23 dirty Civis workflows all SHA-pinned per `Civis/.audit/action-pin-patches.md` |

**Owner:** orchestrator
**Verification gate:** each PR's CI green; dprint runs cleanly on `PhenoCompose/`; Civis workflows all SHA-pinned
**Time:** ~2 hours
**Risk:** `.gitignore.proposed` at root may conflict with per-repo `.gitignore`s; merge strategy is **per-pattern set-difference** (existing preserved, canonical appended under marker — same pattern as V3 L2 #28)

---

## Track 3 — Drain 8 AgilePlus Tier 1 branches (P1)

**Scope:** 8 `chore/l*` branches from V3 L2 chain (`V3_EXECUTION_LOG_2026_06_10.md:1663-1666`); follow L5 #89-92 cleanup pattern

**Owner:** orchestrator
**Verification gate:** `gh pr list --label governance --state open` returns 0 for AgilePlus; `git log --oneline main` shows all 8 commits
**Time:** ~30 min
**Risk:** dependabot cascade conflicts; fallback is sequential `--admin --squash --delete-branch` per `MERGE_DASHBOARD_2026_06_11.md:15`

---

## Track 4 — Consolidate `cheap-llm-mcp` lib-side per A6 spec (P1)

**Scope:** open the PR with the title `refactor: modularize codebase and expose public API surface` per `CHEAP_LLM_SPEC_HARVEST_2026_06_11.md:35`; execute the 5-step implementation checklist (`:71-75`)

**Owner:** orchestrator (or worker-tier backend if dispatch recovers)
**Verification gate:** `npm run clean && npm run build && npm test` all pass; `node -e 'require("./build/index.js").CheapLLMServer'` exits 0
**Time:** ~1.5 hours
**Risk:** Diff is plausible but unverified per `CHEAP_LLM_SPEC_HARVEST_2026_06_11.md:104-105`; the orchestrator must re-validate line counts before applying

---

## Track 5 — Re-test dispatch + filesystem stability (P0, gate)

**Scope:** Re-test `task` tool (1 call, then 5 calls, then 20 calls); verify `gh` API call to `https://api.github.com/zen` returns 200; verify `OmniRoute` UP via `curl -sf http://localhost:20128/v1/models`; verify a 1-MB file written in one turn persists to the next

**Owner:** orchestrator
**Verification gate:** All 4 checks return positive; result documented at `findings/WAVE_2026_06_14_RESUME3_DISPATCH_TEST.md`
**Time:** ~5 min
**Risk:** If any check fails, Tracks 1-4 fall back to direct execution; v6 is reduced to 4 tracks and the next wave after that (RESUME3) is re-planned with the failure mode as a constraint

**2026-06-15 01:02 gate check status** (this turn):
- ✅ `gh` CLI: 2.91.0, authenticated as `Dmouse92`, scopes `gist, read:org, repo, workflow`
- ✅ OmniRoute: `curl http://localhost:20128/v1/models` returns 4+ models (Main, qw/qwen3-coder-plus, …)
- ✅ Filesystem: `/tmp/dispatch-gate.txt` written and re-read in same turn
- ⏸ `task` tool: not yet re-tested in this turn (synthesis §3 documented 40/40 failures in last wave)

**To complete Track 5:** run 1 → 5 → 20 sequential `task` tool calls; if any returns `JSON deserialization error`, log and fall back to orchestrator-direct execution for the rest of v6.

---

## v6 Totals

| Metric | Value |
|---|---|
| Tracks | 5 (4 main + 1 gate) |
| PRs (planned) | 7 + 5 + 8 + 1 = 21 |
| Wall time (sequential) | ~7 hours |
| Wall time (parallel, gate-pass) | ~2 hours |
| Subagent dependency | NONE (gate only re-tests) |
| Files on disk at this point | `findings/WAVE_2026_06_14_RESUME2_SYNTHESIS.md` (the only confirmed artifact from RESUME wave), `findings/pi-2026-06-14-resume.md` |

---

## Open Questions (deferred to next session per synthesis §6.3)

1. Will subagent dispatch recover for RESUME3? (Track 5 gate, above)
2. Is `pheno-agents-md` available on `$PATH` in the test env, or does Track 1 require a `cargo install` first?
3. Is `phenoShared` ready to absorb `phenotype-error-core` as a re-export? (V3 L2 #46 tripwire test pins the 5-variant invariant at `V3_EXECUTION_LOG_2026_06_10.md:184-188`; L5 unification lane is a follow-up.)
4. Are the 8 AgilePlus Tier 1 branches the same set as V3 L2 #21-#40, or a new wave's worth? (Recommend checking `git branch -a | grep chore/l` against V3 branch names.)
5. Is `helios-cli` ready to absorb `helioscope`? (Open question from `findings/WAVE_2026_06_14_RESUME_FINAL.md:133`; out of scope for v6.)

---

## Why this v6 supersedes v4 and v3

| Plan | Source | Status | Why v6 wins |
|---|---|---|---|
| **v3** | `FLEET_100TASK_DAG_V3.md:1-725` (100+20 tasks) | L3/L4/L5 lanes deferred at `:152` by V3 session credit ceiling | v3 was 100+ tasks; too large for one session; no v6-style gate |
| **v4** | `plans/2026-06-14-dag-v4.md` | Narrative only; never executed | v4 was 20×5 = 100 tasks; relied on subagent dispatch which was broken |
| **v5** | `plans/2026-06-15-CONSOLIDATED-DAG-V5.md` (20×6 = 120 tasks) | Authored but not launched | v5 is larger than v4; same subagent dependency problem |
| **v6 (this)** | `plans/2026-06-15-WAVE_2026_06_14_RESUME2_SYNTHESIS-v2.md:235-285` | SPEC READY (this turn) | 5 tracks, orchestrator-only, no subagent dependency, includes gate |
