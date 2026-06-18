# Track 8 PR Reviews (L5-104 Migration)

**Reviewer:** Forge (orchestrator-level review)
**Date:** 2026-06-18
**Scope:** 6 PRs opened by KooshaPari on 2026-06-17 as part of the Dmouse92 → KooshaPari migration (Track 8 of v7 DAG)
**Source audit:** `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md`

---

## ⚠️ CRITICAL PROCESS FINDING (read first)

**All 6 PRs were ALREADY MERGED before this review started.**

| PR | Merged at | Merged by | Cursor bot verdict |
|---|---|---|---|
| #1 pheno-mcp-router#1 | 2026-06-18T04:45:52Z | KooshaPari | **"Risk: high. Not approving"** |
| #2 pheno-mcp-router#2 | 2026-06-18T04:45:??Z | KooshaPari | (inherited) |
| #3 pheno-mcp-router#3 | 2026-06-18T04:45:??Z | KooshaPari | (inherited) |
| #4 phenotype-config#1 | 2026-06-18T04:45:56Z | KooshaPari | APPROVED (low-risk doc) |
| #5 phenotype-ops#2 | 2026-06-18T04:45:??Z | KooshaPari | (low-risk bot) |
| #6 dispatch-mcp#1 | 2026-06-18T04:46:02Z | KooshaPari | APPROVED (low-risk doc) |

The merge commit message on `phenotype-ops` (commit `dcd82c7`) literally states:
> "Merge as part of 2026-06-17 wrap-up review pass (L5-104.4). **All 6 Track-8 PRs approved.**"

That claim is **false**. The cursor bot explicitly voted "Not approving" on PR #1 (the largest, most substrate-critical PR) at 2026-06-18T04:05:13Z — 40 minutes before the merge. No human reviewer approved the batch. This is a **self-approval / batch-merge violation** of the project's HITL policy. The veridcts below reflect what the review would have been **had it occurred before merge**.

---

## PR #1: KooshaPari/pheno-mcp-router#1
- **Verdict:** REQUEST_CHANGES (had it been reviewed before merge)
- **Files changed:** 13 (6 source + 6 tests + 1 doc); +4545/-0 LOC
- **CI status:** **FAIL** — all 8 test matrix entries (macos+ubuntu × py 3.10–3.13), Kilo Code Review, SonarCloud Code Analysis; cursor bot "Not approving"
- **Migration guarantee:** ✅ 6 of 6 substrate-worthy core modules from Dmouse92 commit `6aad7fa` absorbed (audit.py, budget.py, cost.py, cost_middleware.py, quota.py, tiers.py) — verified by per-file diff against DM92 `chore/w2-1-dispatch-mcp-2026-06-15`
- **Substrate quality:** Excellent — module docstrings reference ADR-013/023, imports rewritten from `dispatch_mcp.core.X` to `pheno_mcp_router.X`, hexagonal LlmPort contract preserved
- **Test claim vs reality:** PR claims "187 tests"; actual count of new tests is **143** (tiers 20 + cost 24 + budget 27 + quota 28 + audit 26 + cost_middleware 18). All 143 new tests **pass** when run locally.
- **Root cause of CI failure:** **Pre-existing base-branch bug**, NOT a regression. `tests/test_ports.py` on base branch `chore/l3-57-pheno-plugin-registry-2026-06-11` imports `pheno_prompt_test` (a different substrate) which is not installed. The new PR doesn't touch this file.
- **Rationale:** Substrate code itself is high quality and migration is complete. The cursor bot correctly flagged high risk for "billing/budget/quota/audit" code, but the actual code passes its own tests; the CI failure is from a broken test on the base branch.
- **Concerns:**
  - CI matrix fails because of pre-existing `test_ports.py` bug on base branch — **must be fixed in a separate base-branch PR before this PR can be considered green**
  - Cursor bot's "Risk: high" verdict was bypassed by self-merge — process violation
  - Test count claim (187) in PR title is incorrect — actual is 143

---

## PR #2: KooshaPari/pheno-mcp-router#2
- **Verdict:** REQUEST_CHANGES (inherits PR #1 blockers; review-before-merge)
- **Files changed:** 15 (PR #1's 13 files + `llama_adapter.py` + `test_llama_adapter.py`); +5362/-0 LOC
- **CI status:** **FAIL** — same 8 test matrix failures (inherited); Kilo failed; SonarCloud failed; cursor "COMMITTEDED" (inherited PR risk class)
- **Test claim vs reality:** PR claims "11 tests"; actual count is **24** (locally verified: 24 passed in 0.99s)
- **Code quality:** Excellent — proper server-mode + direct-mode split, lazy `llama_cpp.Llama` import (won't crash if SDK not installed), env-var precedence documented, `ChatML` prompt building with assistant-message exclusion
- **Migration guarantee:** ✅ `LlamaAdapter` correctly reduces dispatch-mcp `LlamaCppProvider`'s wide surface (`complete`/`stream`/`health`/`aclose`) to the substrate's narrow `LlmPort.chat(messages, model) -> str` contract — matches ADR-013 substrate intent
- **Rationale:** The adapter implementation is clean, tests pass, and substrate reduction is faithful to the plan in `findings/2026-06-17-L5-104-dispatch-mcp-migration-plan.md`.
- **Concerns:**
  - Inherits PR #1 base-branch CI failure
  - Test count claim (11) in PR description is wrong — actual is 24
  - Commit `a190642` (PROVIDER_GUIDE.md) is also in PR #1's set — overlap is harmless because PR #2 builds on PR #1's branch

---

## PR #3: KooshaPari/pheno-mcp-router#3
- **Verdict:** REQUEST_CHANGES (inherits PR #1 blockers)
- **Files changed:** 15 (PR #2's 15 files + `openai_compat_adapter.py` + `test_openai_compat_adapter.py`); +5208/-0 LOC
- **CI status:** **FAIL** — same 8 test matrix failures (inherited); Kilo failed; SonarCloud failed; CodeRabbit **FAILED** ("Insufficient usage credits" — tool-side issue, not code); cursor APPROVED
- **Test claim vs reality:** PR claims "17 tests" + "87% coverage"; actual count is **20** (locally verified: 20 passed in 0.80s). Coverage claim not independently verified.
- **Code quality:** Excellent — exponential backoff retry on 408/409/425/429/5xx, lazy httpx.AsyncClient, `_extract_text` returns empty string on malformed payloads (doesn't poison audit trail), environment-variable configuration matrix with defaults
- **Migration guarantee:** ✅ KP-authored `OpenAICompatAdapter` is correctly placed in substrate alongside `LlamaAdapter` per ADR-013. The PR description correctly notes this is KP-authored (from `feat/openai-compat-2026-06-15` @ `977cd43`), not Dmouse92-unique.
- **Rationale:** Adapter is the cleanest of the three PRs and reuses the KP-authored `OpenAICompatProvider` from dispatch-mcp, with the protocol surface narrowed to `LlmPort`.
- **Concerns:**
  - Inherits PR #1 base-branch CI failure
  - Test count claim (17) is wrong — actual is 20
  - Coverage claim (87%) not independently verified
  - CodeRabbit "Insufficient usage credits" is a tool-side failure, not a code issue

---

## PR #4: KooshaPari/phenotype-config#1
- **Verdict:** APPROVE (with 1 minor cosmetic fix recommended)
- **Files changed:** 3 (CANONICAL.md × 2, docs/slsa.md); +224/-0 LOC
- **CI status:** PASS (no tests on docs); cursor APPROVED (low-risk doc); CodeAnt-AI PASS; Kilo failed (tool)
- **Commits (3):** `eab64bd` (CANONICAL markers), `2e94458` (phenotype-config-core deletion), `d9bb720` (SLSA doc) — matches plan §2.2 cherry-pick scope
- **Migration guarantee:** ✅ Matches plan — 2 of 7 Dmouse92 ADR-012 commits cherry-picked (the substrate-worthy ones), 5 of 7 explicitly discarded (workflow/agileplus commits already obsolete on KP/main per plan §2.2)
- **Content quality:** Strong — CANONICAL.md markers properly reference ADR-012 + ADR-022 RFC 002, name the canonical substrate (`phenotype-config/crates/settly`), explain migration guidance for `phenotype-config-loader` and `phenotype-shared-config` path-based consumers
- **Concerns:**
  - **Minor:** `docs/slsa.md` references `crates/settly/.github/workflows/release-attestation.yml` but phenotype-config's workflows live at `.github/workflows/` at the repo root (the path is a stale reference from the Dmouse92 pheno original; should be `../../.github/workflows/release-attestation.yml`). Easy follow-up fix.
  - **Minor:** File `crates/settly/CANONICAL.md` ends with `\ No newline at end of file` — not blocking, but inconsistent with the prettier rest of the file

---

## PR #5: KooshaPari/phenotype-ops#2
- **Verdict:** REQUEST_CHANGES (process issues — wip commit + scope creep)
- **Files changed:** 7 (3 docker files + `.gitignore` + 3 workflow SHA-pinning modifications); +256/-22 LOC
- **CI status:** PASS (no tests on docker/CI); cursor COMMITTEDED; CodeAnt-AI PASS; Kilo failed (tool)
- **Substrate quality (docker):** Good — healthchecks on both services, GPU/CPU conditional via `nvidia` device reservation, optional `omniroute` sidecar documented, env-var precedence clearly explained
- **Process concerns (BLOCKING for future PRs):**
  1. **Commit `c9b968f` is "wip: save dirty state [auto]"** — an editor auto-save artifact that landed in production git history. The commit message is **null** (literal JSON null in the GitHub API response). It adds a single line `audit_scorecard.json` to `.gitignore` — completely unrelated to docker setup. **This must be cleaned up** in a follow-up commit (e.g., a reset or a squash merge going forward).
  2. **Commit `8dd8631` SHA-pins 3 GitHub workflow files** (deploy-review-surface.yml, full-ci.yml, manifest-gate.yml). This is **out of scope** for a PR titled "feat(devops): add llama-cpp docker setup". Per the project's PR conventions, this should have been a separate `chore(workflows): SHA-pin GitHub Actions` PR. The two concerns are unrelated and should not be coupled.
- **Migration guarantee:** ✅ Docker files correctly placed in `agent-devops-setups/llama-cpp/` per ADR-023 substrate placement rule ("federated service / deployment concern").
- **Rationale:** The llama-cpp docker stack itself is solid and well-documented. The two process issues (wip commit + scope creep) don't break the code but violate hygiene standards and make audit trail harder to follow.
- **Concerns:**
  - **wip auto-save commit in main history** (commit `c9b968f`) — should be reverted/cleaned
  - **Scope creep** — SHA-pinning 3 workflow files in same PR as docker setup violates single-concern PR principle
  - **Minor:** Commit `8dd8631` is dated 2026-06-17T09:39:24Z (day before docker PR was opened) — looks like it was force-pushed into this branch retroactively

---

## PR #6: KooshaPari/dispatch-mcp#1
- **Verdict:** APPROVE (with 1 minor cosmetic fix recommended)
- **Files changed:** 1 (`docs/CHEAP_LLM_MCP_DEPRECATION.md`); +22/-0 LOC
- **CI status:** Cursor APPROVED (low-risk doc); CodeAnt-AI PASS; Kilo failed (tool); **gitleaks FAILED** — but the failure is a pre-existing **CI config issue**, not a real secret leak. Root cause: `.gitleaks.toml` referenced by `GITLEAKS_CONFIG` env var does not exist in the dispatch-mcp repo. The gitleaks action fails at the config-load step (FTL `unable to load gitleaks config, err: open .gitleaks.toml: no such file or directory`), not because secrets were found.
- **Migration guarantee:** ✅ Clean cherry-pick of Dmouse92 commit `dc4f1a3` — verified identical content (single commit, SHA matches DM92).
- **Content quality:** Good — references ADR-008, has clear timeline (2026-06-15 notice, 2026-07-15 archive move, 2026-09-15 repo archive), names `dispatch-mcp` and `cheap-llm-mcp` repos with correct paths
- **Concerns:**
  - **Minor:** "Pointers" section contains hardcoded local filesystem paths (`/Users/kooshapari/CodeProjects/Phenotype/repos/dispatch-mcp`, `/Users/kooshapari/CodeProjects/Phenotype/repos/cheap-llm-mcp`, `/Users/kooshapari/CodeProjects/Phenotype/repos/plans/2026-06-15-CONSOLIDATED-DAG-V5.md`) — these should be repo URLs (`https://github.com/KooshaPari/dispatch-mcp`) or removed. They're a dev-environment leak from the original cherry-pick.
  - **Pre-existing (not in PR scope):** gitleaks workflow references missing `.gitleaks.toml` — needs separate CI fix PR

---

## Summary

- **Approve:** **2 / 6** — PR #4 (phenotype-config#1), PR #6 (dispatch-mcp#1)
- **Request changes:** **4 / 6** — PR #1, #2, #3 (pheno-mcp-router — all inherit base-branch CI failure), PR #5 (phenotype-ops — wip commit + scope creep)
- **Comment (low-risk doc with cosmetic nits):** 0 / 6
- **Blockers (overall):**
  1. **Base-branch CI broken on `pheno-mcp-router`** — `tests/test_ports.py` imports `pheno_prompt_test` which is not installed; causes all 8 test matrix entries to fail. Fix needed on `chore/l3-57-pheno-plugin-registry-2026-06-11` before any of PRs #1/#2/#3 can be re-verified.
  2. **Process violation — self-merge against cursor bot's "Not approving" verdict.** Merge commit on `phenotype-ops` claims "All 6 Track-8 PRs approved" but the cursor bot explicitly voted NOT to approve PR #1 (the most substrate-critical PR). This bypassed HITL policy and should be flagged in the post-mortem.
  3. **wip auto-save commit in production history** (phenotype-ops `c9b968f`) — needs cleanup commit.
  4. **Test count inaccuracies in PR descriptions** — 3 of 6 PRs inflate test counts (PR #1: 187→143, PR #2: 11→24, PR #3: 17→20). Real counts are higher than claimed in some cases (PRs #2/#3) and lower in PR #1. PR descriptions should be accurate.
- **Ready-to-merge list (would-have-been):**
  - PR #4 (phenotype-config#1) — APPROVE (with minor SLSA path fix)
  - PR #6 (dispatch-mcp#1) — APPROVE (with minor local-path leak fix)
  - PR #5 (phenotype-ops#2) — REQUEST_CHANGES (wip + scope); after cleanup + splitting SHA-pinning into separate PR, would be APPROVE
  - PR #1, #2, #3 (pheno-mcp-router) — REQUEST_CHANGES until base-branch CI is fixed; substrate code itself is high-quality and tests pass locally

---

## Notes for post-mortem

The review confirms the **migration guarantee from the parent audit doc holds**: 6 of 6 Dmouse92 dispatch-mcp W2-1 substrate-worthy core modules absorbed to `pheno-mcp-router`; 2 of 7 Dmouse92 pheno ADR-012 commits cherry-picked to `phenotype-config` (the substrate-worthy ones, per plan); 1 of 1 dispatch-mcp doc cherry-picked. **0 net content loss** verified.

The PRs were merged 6 hours before this review was requested. Either the reviewer should have been dispatched earlier (Track 8 of the v7 DAG should have included a review checkpoint before merge), or the merge decision should have waited for the review. The current ordering — merge first, review after — inverts the project's stated HITL process.