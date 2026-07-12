# Worklog — L5-123 Upstream Feature Sync (2026-06-21)

> **Session**: L5-123. **Date**: 2026-06-21. **Branch**: `chore/l5-123-upstream-feature-sync-2026-06-21`.
> **PR**: (this turn; opened via REST API). **Device**: macbook (planning + small focused PRs).
> **Outcome**: 3 medium-relevance upstream commits cherry-picked onto `KooshaPari/OmniRoute`.
> Pairs with PR #99 (L5-122, security half) to complete the upstream sync for 2026-06-21.

---

## 1. Context

User directive (2026-06-21): *"continue upstream security/feature sync to omniroute (3 medium-relevance cherry-picks)"*.

This is the **feature half** of the OmniRoute upstream sync. PR #99 (L5-122, opened earlier this session) was the **security half** (ReDoS no-op audit + undici/dompurify dep bump). PR #99 is OPEN + MERGEABLE on `KooshaPari/OmniRoute` and is NOT touched by this worklog.

This worklog cherry-picks 3 medium-relevance commits from `diegosouzapw/OmniRoute` (upstream `v3.8.25`..`v3.8.27`) onto the KooshaPari fork:

| SHA | Subject | KP relevance |
|---|---|---|
| `f42e8fa75` | feat(mimocode): per-account proxy round-robin (#3837) | MEDIUM — feature |
| `337cd1893` | fix(sse): clamp Gemini thinking budget to model cap (#3842/#3865) | MEDIUM — bug fix |
| `8842414d8` | fix(docker): webpack build for release image (#4052) | LOW — Docker fix |

The heuristic from PR #99 (see L5-122 worklog) was:

1. Check if the file exists in HEAD before applying
2. Deleted files → take "ours" + audit commit explaining why
3. Modified files in different paths → keep applicable, drop no-op
4. New test files importing deleted modules → drop test, keep audit
5. Always `cherry-pick -x` for traceability

---

## 2. Per-commit resolution

### 2.1 `f42e8fa75` — feat(mimocode): per-account proxy round-robin

**Resolution: CLEAN cherry-pick. 9 files, 935+/100-. Zero conflicts.**

All 9 upstream files applied without human intervention:

| File | Status |
|---|---|
| `open-sse/executors/mimocode.ts` | applied (127 lines changed — per-account proxy context + fingerprint keying) |
| `src/app/(dashboard)/dashboard/providers/[id]/components/ConnectionsHeaderToolbar.tsx` | applied (24 lines — DistributeProxiesButton integration) |
| `src/app/(dashboard)/dashboard/providers/[id]/components/ConnectionsListPanel.tsx` | applied (14 lines) |
| `src/app/(dashboard)/dashboard/providers/[id]/components/DistributeProxiesButton.test.tsx` | applied (NEW, 219 lines — vitest coverage) |
| `src/shared/components/DistributeProxiesButton.tsx` | applied (NEW, 74 lines — the button component) |
| `src/shared/components/NoAuthAccountCard.tsx` | applied (292 lines changed — multi-account card refactor) |
| `src/shared/components/index.tsx` | applied (1 line — barrel export) |
| `tests/integration/mimocode-proxy.integration.test.ts` | applied (NEW, 150 lines — integration coverage) |
| `tests/unit/mimocode-executor.test.ts` | applied (134 lines — vitest collected path; the orphan-test relocation the commit message mentions) |

**Why it was clean.** Despite the L5-122 prep notes (which expected partial resolution because of prior KP-side mimocode refactors), the KP fork at `origin/main` (`e4d751ed1`) had **all** of these files in their upstream paths and at upstream-compatible shapes. The cherry-pick applied with no conflict markers, no `git rm`, no audit-trail amendments.

**Local commit SHA**: `6646eda22`.

---

### 2.2 `337cd1893` — fix(sse): clamp Gemini thinking budget to model cap

**Resolution: PARTIAL cherry-pick. 3 of 5 files applied (24 insertions, 2 deletions). 2 files dropped via `git rm` (took "ours").**

Surviving files (all clean, zero conflict):

| File | Status |
|---|---|
| `CHANGELOG.md` | applied (1 line entry, auto-merged) |
| `src/shared/constants/modelSpecs.ts` | applied (3 lines — `gemini-2.5-flash.thinkingBudgetCap: 24576`) |
| `tests/unit/translator-openai-to-gemini.test.ts` | applied (20 lines — regression test for #3842) |

Dropped files (took "ours" — KP never adopted the claude-to-gemini translator):

| File | Why dropped |
|---|---|
| `open-sse/translator/request/claude-to-gemini.ts` | Does not exist on KP main. KP ships `openai-to-gemini` only (verified: `ls open-sse/translator/request/` shows only `claude-to-openai.ts`, `openai-responses.ts`, `openai-to-claude.ts`, `openai-to-gemini.ts`, `openai-to-kiro.ts`). The full `claude-to-gemini` translator path is a UPSTREAM-only feature. |
| `tests/unit/translator-claude-to-gemini.test.ts` | Companion test for the deleted translator — would have no module to import. Dropped per heuristic rule 2 ("deleted files → take ours"). |

**KP-side impact.** The surviving changes fix the bug on the path KP actually has. `gemini-2.5-flash` calls from any OpenAI/Claude client with `reasoning_effort=high` (or Claude-Code `output_config.effort=high`) now clamp to the real cap (24576) at the `capThinkingBudget()` chokepoint instead of passing through the hardcoded 32768 base → upstream HTTP 400.

**Audit trail.** Commit message amended to explain the partial application, dropped files, and KP-side impact.

**Local commit SHA**: `9a83d6266`.

---

### 2.3 `8842414d8` — fix(docker): build release image with webpack

**Resolution: CLEAN cherry-pick. 1 file, 7 insertions / 2 deletions. Zero conflicts.**

| File | Status |
|---|---|
| `Dockerfile` | applied (Turbopack → webpack switch + comment block documenting the upstream Turbopack panic + link to `docs/ops/QUALITY_GATE_PLAYBOOK.md` Parte 6) |

**Why it was clean.** KP's `Dockerfile` at `origin/main` retained the `ENV OMNIROUTE_USE_TURBOPACK=1` line that the upstream commit was removing. No structural drift.

**KP-side impact.** Future Docker-based releases (`docker build` for the release image, both `linux/amd64` and `linux/arm64`) will use the proven webpack engine and skip the upstream Turbopack tracer panic (`TurbopackInternalError "entered unreachable code"` in `ImportTracer::get_traces`). Re-enable Turbopack once upstream fixes the tracer bug (comment in Dockerfile documents this).

**Local commit SHA**: `47670805e`.

---

## 3. Final diff stat (3 commits vs `origin/main`)

```
 CHANGELOG.md                                       |   1 +
 Dockerfile                                         |   9 +-
 open-sse/executors/mimocode.ts                     | 127 ++++++---
 .../[id]/components/ConnectionsHeaderToolbar.tsx   |  24 +-
 .../[id]/components/ConnectionsListPanel.tsx       |  14 +-
 .../components/DistributeProxiesButton.test.tsx    | 219 ++++++++++++++++
 src/shared/components/DistributeProxiesButton.tsx  |  74 ++++++
 src/shared/components/NoAuthAccountCard.tsx        | 292 ++++++++++++++++++---
 src/shared/components/index.tsx                    |   1 +
 src/shared/constants/modelSpecs.ts                 |   3 +
 .../integration/mimocode-proxy.integration.test.ts | 150 +++++++++++
 tests/unit/mimocode-executor.test.ts               | 134 ++++++++++
 tests/unit/translator-openai-to-gemini.test.ts     |  20 ++
 13 files changed, 966 insertions(+), 102 deletions(-)
```

## 4. Commit graph (this branch)

```
47670805e  fix(docker): build release image with webpack (Turbopack internal panic) (#4052)   [8842414d8]
9a83d6266  fix(sse): clamp Gemini thinking budget to model cap (#3842) (#3865)               [337cd1893, partial]
6646eda22  feat(mimocode): per-account proxy support for multi-account round-robin (#3837)   [f42e8fa75]
e4d751ed1  chore(orch-v12-s4-020): dependency audit for OmniRoute (#96)                       <-- origin/main
```

All 3 cherry-picks use `cherry-pick -x` to preserve the upstream SHA in the commit message body. Each commit retains the upstream author + date metadata (per `cherry-pick` default).

## 5. Files NOT touched (and why)

The working tree had 3 pre-existing items NOT from this cherry-pick:

- `AGENTS.md` (M) — pre-existing live-counts refresh from prior session
- `PLAN.md` (M) — pre-existing plan-doc edit from prior session
- `open-sse/observability/` (untracked) — pre-existing untracked dir from prior session

These carried over from the prior `chore/l5-122-upstream-security-2026-06-21` branch's working tree state when I ran `git checkout -b chore/l5-123-upstream-feature-sync-2026-06-21 origin/main`. They are **out of scope** for this PR and will not be staged or committed. PR reviewers will see only the 3 cherry-pick commits in the diff.

## 6. Deviations from heuristic

**None.** The heuristic predicted "very likely conflicts" because the L5-122 prep notes flagged `mimocode.ts` as possibly deleted. Verification at cherry-pick time showed all 9 files for `f42e8fa75` were intact in KP main, so no heuristic was needed. The only conflict was `337cd1893`'s 2 deleted files, which were resolved cleanly via heuristic rule 2 (take "ours" + audit commit explaining why).

## 7. Risk assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Cherry-picks regress `mimocode` executor | LOW | Per-account proxy is additive; existing call paths still work; `tests/unit/mimocode-executor.test.ts` (14 vitest tests, per upstream message) covers regressions |
| Gemini cap change breaks existing callers | VERY LOW | The cap is the **upstream-declared max** for `gemini-2.5-flash` (24576); callers previously sending 32768 were already getting HTTP 400; clamping just prevents that |
| Docker webpack build regresses image size or build time | LOW | Webpack is the proven engine (build:release / VPS / CI Build are all webpack); Turbopack was opt-in |
| Cross-repo coupling to other KP forks | NONE | Single-repo change, no dep bumps, no API surface changes |

## 8. Refs

- Upstream commits: `f42e8fa75`, `337cd1893`, `8842414d8` (diegosouzapw/OmniRoute, 2026-06-14..2026-06-17)
- Base: `origin/main` @ `e4d751ed1` (KooshaPari/OmniRoute, chore/dependency audit for OmniRoute #96)
- Companion PR: #99 (L5-122, security half — OPEN + MERGEABLE, NOT touched)
- ADR-031: `docs/adr/0031-bifrost-tier1-router.md` (Bifrost Tier-1 router adoption)
- ADR-042: `docs/adr/0042-security-audit-cadence.md` (monthly upstream-security sweep)
- Heuristic source: `worklogs/2026-06-21-L5-122-upstream-security.md` (validated in PR #99)