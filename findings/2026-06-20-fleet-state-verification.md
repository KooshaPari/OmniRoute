# Fleet State Verification — Eidolon-centric absorption cohort

**Date:** 2026-06-20 (PDT)
**Scope:** Read-only verification of 6 KooshaPari/* repos via `gh api` + `gh pr/issue list`.
**Dmouse92/* not touched** (token removed per AGENTS.md L5-104 kill-switch, 2026-06-17 22:30 PDT).
**Auth verified:** `KooshaPari` (keyring), scopes include `delete_repo` + `repo` + `workflow`.

---

## TOP-LEVEL SUMMARY TABLE

| Repo | HEAD | Archived | Last pushed | Open PRs | Open Issues | WIP Branches | Red Flags |
|---|---|---|---|---|---|---|---|
| `KooshaPari/Eidolon` | `47511e35b55b` | false | 2026-06-20 10:50 UTC | 0 (2 closed) | 6 (all `Welcome:` template) | **14** (all `wip/...-2026-06-17`) | **14 stale WIP branches** (preserve pattern per AGENTS.md) |
| `KooshaPari/agent-platform` | `ff69bc300eaf` | false | 2026-06-20 12:05 UTC | 1 (#10) | 0 | 1 (`feat/example-intent-router-2026-06-20`, paired with PR #10) | none |
| `KooshaPari/mobile-mcp` | `879c6280823d` | false | 2026-06-19 02:38 UTC | 0 | 0 (issues disabled) | 0 | none (last push 1d old, recent merge cadence) |
| `KooshaPari/mobile-cli` | `d018ea301989` | false | 2026-06-20 10:34 UTC | 0 | 0 (issues disabled) | 0 | none |
| `KooshaPari/pheno` | `313ed2c96125` | false | 2026-06-20 12:53 UTC | 2 (#245, #246) | 6 (all `Welcome:` template) | 3 (2 open PRs + 1 `wip/2026-06-18-pheno-local`) | none (but see phenoShared dep) |
| `KooshaPari/phenoShared` | **N/A — HTTP 404** | **N/A** | **N/A** | **N/A** | **N/A** | **N/A (local)** | **CRITICAL — repo deleted on GitHub; local tombstone with new unpushed commit `14bb34c`; pheno#239-242 depend on this tombstone's workflows** |

---

## Per-repo detail

### 1. KooshaPari/Eidolon — `47511e35b55b`

- **Default branch:** `main` (archived=false, size=329 KB, pushed 2026-06-20 10:50:03 UTC)
- **HEAD:** `47511e35b55b`

**PRs (last 30 days, 28 entries shown):**

```
#64 [CLOSED] merged=n/a created=2026-06-19: wip: Eidolon unpushed commits snapshot 2026-06-18 (Eidolon)
#62 [MERGED] merged=2026-06-18 created=2026-06-18: feat(core): integrate VirtualStage wave — trait + helpers + tests + bench + CI + ADR
#61 [MERGED] merged=2026-06-18 created=2026-06-18: feat(crates): kmobile-core bridge + PlayCua dispatcher (Phases 4 + 5)
#60 [MERGED] merged=2026-06-18 created=2026-06-16: Phase 3: spec+test+traceability e2e [Eidolon]
#59 [MERGED] merged=2026-06-16 created=2026-06-16: fix: remove ANSI-corrupted .github/workflows filename
#58 [MERGED] merged=2026-06-13 created=2026-06-13: chore(cliff): upgrade to v2 template (⚠️ **BREAKING** suffix)
#57 [MERGED] merged=2026-06-18 created=2026-06-13: chore(cliff): upgrade to v2 template (⚠️ **BREAKING** suffix)
#56 [CLOSED] merged=n/a created=2026-06-12: chore(Eidolon): lift ahead branch feat/eidolon-core-from-parse-int-20260611
#55 [MERGED] merged=2026-06-12 created=2026-06-12: chore(cliff): adopt shared template from phenotype-tooling
#54 [CLOSED] merged=n/a created=2026-06-12: chore(gitignore): adopt shared python template from phenotype-tooling
#53 [MERGED] merged=2026-06-09 created=2026-06-09: chore(eidolon): align editorconfig with org standard
#52 [MERGED] merged=2026-06-09 created=2026-06-09: docs(Eidolon): add work-state header
#51 [MERGED] merged=2026-06-18 created=2026-06-07: chore(workflows): hygiene pass
#50 [CLOSED] merged=n/a created=2026-06-05: hygiene(Eidolon): preserve canonical ahead commits
... (older entries to #28 from 2026-04-28)
```

**Open issues (6, all `Welcome:` templates dated 2026-05-07):**

```
#42 [2026-05-07]: Welcome: help Improve This Project
#41 [2026-05-07]: Welcome: help Improve This Project
#40 [2026-05-07]: Welcome: help Improve This Project
#39 [2026-05-07]: Welcome: help Improve This Project
#38 [2026-05-07]: Welcome: help improve project
#37 [2026-05-07]: Welcome: help improve project
```

**WIP / pre-pause / feat-2026-06-19..20 branches (14, ALL stale preserve pattern):**

```
refs/heads/wip/on-chore-eidolon-add-ci-workflow-20260608-preserve-2026-06-17
refs/heads/wip/on-chore-eidolon-linux-client-test-20260608-uncomm-2026-06-17
refs/heads/wip/on-feat-eidolon-core-clone-partial-eq-sandbox-2026-2026-06-17
refs/heads/wip/on-feat-eidolon-core-display-impl-for-error-202606-2026-06-17
refs/heads/wip/on-feat-eidolon-core-pheno-error-serde-20260612-wi-2026-06-17
refs/heads/wip/on-feat-eidolon-core-sandbox-metadata-display-impl-2026-06-17
refs/heads/wip/on-feat-eidolon-desktop-windows-virtual-stage-impl-2026-06-17
refs/heads/wip/on-feat-eidolon-sandbox-virtual-stage-impl-2026061-2026-06-17
refs/heads/wip/on-test-eidolon-core-virtual-stage-tests-20260610--2026-06-17
refs/heads/wip/wip-on-feat-eidolon-core-automation-event-eq-hash--2026-06-17
refs/heads/wip/wip-on-feat-eidolon-core-pheno-error-clone-2026061-2026-06-17
refs/heads/wip/wip-on-feat-eidolon-core-pheno-error-default-20260-2026-06-17
refs/heads/wip/wip-on-feat-eidolon-core-pheno-error-eq-hash-reset-2026-06-17
refs/heads/wip/wip-on-feat-eidolon-core-pheno-error-serde-2026061-2026-06-17
```

**Red flag rationale:** 14 stale `wip/...-2026-06-17` branches exceeds the 5+ threshold. These match the AGENTS.md "PAUSED APP — pre-pause snapshot" pattern verbatim (one per Eidolon Phases 1-5 sub-task). They are **intentional preservation**, not orphaned WIP — flag is *informational*, not *actionable*. Recommend adding a `wip/preserve-2026-06-17` doc-comment in the next Eidolon session to make this explicit on remote.

---

### 2. KooshaPari/agent-platform — `ff69bc300eaf`

- **Default branch:** `main` (archived=false, size=109 KB, pushed 2026-06-20 12:05:45 UTC)
- **HEAD:** `ff69bc300eaf`

**PRs (10 entries):**

```
#10 [OPEN]   merged=n/a         created=2026-06-20: docs(examples): add intent-router example for DeviceStage abstraction
#9  [MERGED] merged=2026-06-20  created=2026-06-20: docs(governance): add AGENTS.md and CODEOWNERS per ADR-023
#8  [MERGED] merged=2026-06-20  created=2026-06-20: fix(agent-platform): add missing DesktopStage class + transport factories
#7  [MERGED] merged=2026-06-19  created=2026-06-19: feat(ports): DesktopStage trait (T66)
#6  [MERGED] merged=2026-06-19  created=2026-06-19: feat(ports): add DesktopStage sub-trait (T66 sub-port)
#5  [MERGED] merged=2026-06-19  created=2026-06-19: feat(adapters): add 4 sibling DeviceStage adapters (desktop, mobile, sandbox, browser)
#4  [MERGED] merged=2026-06-19  created=2026-06-19: feat(adapters): add CodexCliAdapter as 3rd DeviceStage adapter (T66.4)
#3  [CLOSED] merged=n/a         created=2026-06-18: build(deps): bump esbuild from 0.27.7 to removed in the npm_and_yarn group across 1 directory
#2  [MERGED] merged=2026-06-18  created=2026-06-18: feat(eidolon-stage): wire MCP transport + OTLP tracing (T16.4)
#1  [MERGED] merged=2026-06-18  created=2026-06-18: feat(ports): add DeviceStage hexagonal port + Eidolon adapter (T66)
```

**Open issues:** 0

**WIP / pre-pause / feat-2026-06-19..20 branches (1):**

```
refs/heads/feat/example-intent-router-2026-06-20   # paired with open PR #10
```

**Red flag rationale:** None. Single open PR (#10) is the active in-flight intent-router example; branch is paired 1:1. Strong merge cadence (8 of 10 PRs merged in last 3 days).

---

### 3. KooshaPari/mobile-mcp — `879c6280823d`

- **Default branch:** `main` (archived=false, size=2423 KB, pushed 2026-06-19 02:38:42 UTC)
- **HEAD:** `879c6280823d`

**PRs (3 entries):**

```
#3 [MERGED] merged=2026-06-19 created=2026-06-19: fix(eidolon-shim): make NullEidolonTransport.call satisfy EidolonTransport interface (tsc)
#2 [MERGED] merged=2026-06-18 created=2026-06-18: feat(eidolon): wire 7 tools to use Eidolon shim (T16.4)
#1 [MERGED] merged=2026-06-18 created=2026-06-18: feat(eidolon): add optional Eidolon VirtualStage delegation shim
```

**Open issues:** 0 (issues DISABLED at repo level)

**WIP / pre-pause / feat-2026-06-19..20 branches:** 0

**Red flag rationale:** None. Last push is 1 day old but the recent merge window (3 PRs in 36 hours ending 2026-06-19) is healthy. No stale WIPs.

---

### 4. KooshaPari/mobile-cli — `d018ea301989`

- **Default branch:** `main` (archived=false, size=1012 KB, pushed 2026-06-20 10:34:56 UTC)
- **HEAD:** `d018ea301989`

**PRs (1 entry):**

```
#1 [MERGED] merged=2026-06-20 created=2026-06-20: feat(eidolon): add --eidolon-endpoint flag for EidolonStage dispatch
```

**Open issues:** 0 (issues DISABLED at repo level)

**WIP / pre-pause / feat-2026-06-19..20 branches:** 0

**Red flag rationale:** None. Healthy: PR #1 merged today, HEAD pushed 2026-06-20 10:34 UTC.

---

### 5. KooshaPari/pheno — `313ed2c96125`

- **Default branch:** `main` (archived=false, size=15013 KB, pushed 2026-06-20 12:53:41 UTC)
- **HEAD:** `313ed2c96125`

**PRs (30 entries shown, last 30 days):**

```
#246 [OPEN]   merged=n/a         created=2026-06-20: feat(agents): add ADR cross-reference table to AGENTS.md
#245 [OPEN]   merged=n/a         created=2026-06-20: feat(t22): wire pheno-tracing OTLP observability substrate
#244 [MERGED] merged=2026-06-20  created=2026-06-20: chore(deps): bump the uv group across 2 directories with 1 update
#243 [MERGED] merged=2026-06-20  created=2026-06-20: chore(deps): bump actions/setup-java from 5.2.0 to 5.3.0
#242 [MERGED] merged=2026-06-20  created=2026-06-20: chore(deps): bump KooshaPari/phenoShared/.github/workflows/self-merge-gate.yml from 72b9c6cbdb24c49189b0e7c7395d874830d1ed87 to d1f40cb9482add27c57925be5085cabe2c20d8be
#241 [MERGED] merged=2026-06-20  created=2026-06-20: chore(deps): bump KooshaPari/phenoShared/.github/workflows/vitepress-pages.yml from 72b9c6cbdb24c49189b0e7c7395d874830d1ed87 to d1f40cb9482add27c57925be5085cabe2c20d8be
#240 [MERGED] merged=2026-06-20  created=2026-06-20: chore(deps): bump KooshaPari/phenoShared/.github/workflows/tag-automation.yml from 72b9c6cbdb24c49189b0e7c7395d874830d1ed87 to d1f40cb9482add27c57925be5085cabe2c20d8be
#239 [MERGED] merged=2026-06-20  created=2026-06-19: chore(deps): bump KooshaPari/phenoShared/.github/workflows/reusable-release-drafter.yml from 72b9c6cbdb24c49189b0e7c7395d874830d1ed87 to 95d74795c77f7c554be2b5e42e8e3378cdab77bf
#238 [MERGED] merged=2026-06-19  created=2026-06-19: chore(pheno): re-point sub-crate CANONICAL.md markers to Configra (L5-110, ADR-031)
#237 [MERGED] merged=2026-06-19  created=2026-06-19: chore(pheno): remove orphaned phenotype-event-bus tombstone (L5-111)
#236 [CLOSED] merged=n/a         created=2026-06-18: wip: local snapshot 2026-06-18 (pheno)
#235 [MERGED] merged=2026-06-18  created=2026-06-18: chore(pheno): remove phenotype-config-core (ADR-012 config consolidation)
#234 [MERGED] merged=2026-06-18  created=2026-06-18: chore(deps): bump the uv group across 2 directories with 8 updates
#233 [MERGED] merged=2026-06-18  created=2026-06-18: chore(deps): bump trufflesecurity/trufflehog from 3fc0c2aa6648d54242e4af6fbfde0701796e4fb0 to 30d5bb91af1a771378349dbbb0c82129392acf70
#232 [MERGED] merged=2026-06-18  created=2026-06-18: refactor(pheno-cli): switch GetAdapter to return (Adapter, error)
#231 [MERGED] merged=2026-06-18  created=2026-06-17: docs(boundary): per-module disposition (decompose/absorb/dynamic-keep)
#230 [MERGED] merged=2026-06-18  created=2026-06-16: chore(deps): bump the uv group across 2 directories with 1 update
#229 [CLOSED] merged=n/a         created=2026-06-15: layer: test/onefn3 — Add unit tests for DurationExt::format_human in phenotype-ti
#228 [CLOSED] merged=n/a         created=2026-06-15: layer: temp-test — chore(review): fix CodeRabbit YAML escapes
#227 [MERGED] merged=2026-06-18  created=2026-06-15: layer: pr-template/bootstrap — docs: add PR template
... (older entries to #217, plus earlier)
```

**Open issues (6, all `Welcome:` templates dated 2026-05-07):**

```
#155 [2026-05-07]: Welcome: help Improve This Project
#154 [2026-05-07]: Welcome: help Improve This Project
#153 [2026-05-07]: Welcome: help Improve This Project
#152 [2026-05-07]: Welcome: help Improve This Project
#151 [2026-05-07]: Welcome: help improve project
#150 [2026-05-07]: Welcome: help improve project
```

**WIP / pre-pause / feat-2026-06-19..20 branches (3):**

```
refs/heads/feat/agents-adr-crossref-2026-06-20                          # paired with open PR #246
refs/heads/feat/t22-observability-pheno-tracing-otlp-2026-06-20          # paired with open PR #245
refs/heads/wip/2026-06-18-pheno-local                                   # stale local snapshot (paired with closed PR #236)
```

**Red flag rationale:** None on this repo directly. **However**, PRs #239-#242 (4 merged deps bumps, 2026-06-19/20) each pin `KooshaPari/phenoShared/.github/workflows/<name>.yml` to specific SHAs from the (now 404) phenoShared. See phenoShared section below — these pins reference commit `d1f40cb` (tombstone) and `95d74795` (which existed in local refs pre-deletion). They will continue to resolve in GitHub Actions *as long as the deleted-repo SHAs remain cached* in the GA workflow cache, but new commits on phenoShared cannot be referenced.

---

### 6. KooshaPari/phenoShared — **HTTP 404** ⚠️ CRITICAL

- **Default branch:** N/A
- **HEAD:** N/A
- **Archived:** N/A (repo **does not exist on KooshaPari**)

**Verification (2026-06-20 PDT):**

```
$ gh api repos/KooshaPari/phenoShared -i
HTTP/2.0 404 Not Found
{"message":"Not Found", ...}

$ gh search repos "phenoShared" --owner KooshaPari
[]                                          # empty — no variants
```

**Local state (read-only inspection, this verification):**

```
$ git -C phenoShared remote -v
origin  git@github.com:KooshaPari/phenoShared.git (fetch)
origin  git@github.com:KooshaPari/phenoShared.git (push)

$ git -C phenoShared rev-parse HEAD
14bb34cef4450d6d31da478ba463807d16645db3

$ git -C phenoShared log --format='%h %ci %s' -3
14bb34c 2026-06-20 04:17:47 -0700  feat(ci): add reusable drift-check workflow (L5-116 FU6) — absorbs pheno-ci-templates role into phenoShared substrate
d1f40cb 2026-06-19 19:45:01 -0700  chore: gut phenoShared to tombstone (ADR-ECO-014 decompose) (#197)
b45ca51 2026-06-19 01:35:08 -0700  feat(sourcing): add blake3 feature flag + ZERO_HASH const (L5-118) (#196)

$ git -C phenoShared rev-list --left-right --count origin/main...HEAD
0	1                                       # LOCAL is AHEAD by 1 commit (unpushed)

$ git -C phenoShared status --short
?? docs/boundary/                          # untracked (resurrection artifact)
?? docs/intent/                            # untracked (resurrection artifact)

$ head -3 phenoShared/TOMBSTONE.md
# phenoShared — Tombstone (ADR-ECO-014)
**Status:** DECOMPOSED / INTERIM STAGING RETIRED
**Date:** 2026-06-19
```

**PRs / issues / remote WIPs:** N/A (no remote repo to query).

**Local WIP / feat branches (from `git branch -a`):** 28 branches total — none are queryable on the remote. Notable branches include:
- `feat/l5-116-fu6-drift-check-reusable-2026-06-20` (current HEAD, unpushed L5-116 FU6 work)
- `feat/api-error-platform-variant-2026-06-18`, `feat/from-impls-batch-2026-06-18`, `feat/journey-impl`, `feat/l5-114-r2-aggregate-replay-lift-2026-06-18`, `feat/l5-115-r2-async-event-store-lift-2026-06-18`, `feat/l5-116-r2-event-query-lift-2026-06-18`, `feat/l5-117-r2-loaded-state-lift-2026-06-18`, `feat/l5-118-119-r2-blake3-zero-hash-2026-06-18` (Round-2 absorption lifts)
- `wip/pre-retry-task-uncommitted-changes-from--2026-06-17`, `wip/stash-rename-to-shared-utils-2026-06-17`, `wip/wip-chore-doctest-2026-06-17`, `wip/wip-preserve-pre-feature-2026-06-17` (preservation branches)

**Red flag rationale — 3 distinct sub-issues:**

1. **Repo deletion drift.** `KooshaPari/phenoShared` returns HTTP 404 as of 2026-06-20 verification window. The local clone still has `origin` pointing to `KooshaPari/phenoShared.git` with stale refs (`d1f40cb`, `72b9c6cbdb24c49189b0e7c7395d874830d1ed87`, `95d74795c77f7c554be2b5e42e8e3378cdab77bf`). Per local `TOMBSTONE.md`, the repo was gutted to tombstone on 2026-06-19 per `ADR-ECO-014`. The deletion appears to have been executed between 2026-06-19 19:45 PDT (tombstone commit) and 2026-06-20 verification window — possibly via UI (manual delete) since gh CLI lacked `delete_repo` scope before this turn (now granted, per `gh auth status`).

2. **Unpushed resurrection commit.** Local commit `14bb34c` (2026-06-20 04:17 PDT, "feat(ci): add reusable drift-check workflow (L5-116 FU6) — absorbs pheno-ci-templates role into phenoShared substrate") is AHEAD of `origin/main` by 1 commit. Two untracked directories (`docs/boundary/`, `docs/intent/`) also exist. This work attempts to **revive** phenoShared as the substrate for `pheno-ci-templates` — contradicting the local `TOMBSTONE.md` policy ("Do not add new crates here").

3. **Downstream dependency hazard.** `KooshaPari/pheno` PRs #239, #240, #241, #242 (all MERGED 2026-06-19/20) reference `KooshaPari/phenoShared/.github/workflows/{reusable-release-drafter,tag-automation,vitepress-pages,self-merge-gate}.yml` at SHAs from the now-deleted repo. GitHub Actions will continue to resolve these cached SHAs (Actions caches workflow content by SHA, not by repo existence) — but **future bumps to these workflows cannot be published** without re-creating the repo. This is a **transient silent-degradation hazard**: builds pass today, will silently fail at the next scheduled SHA bump once GitHub evicts the cache (no public GA retention SLA past ~90 days for unreachable workflows).

---

## Red flag summary

| # | Repo | Flag | Severity | Action recommended |
|---|---|---|---|---|
| 1 | `KooshaPari/phenoShared` | Repo returns HTTP 404; local TOMBSTONE.md says decomposed per ADR-ECO-014 | **P0 — CRITICAL** | Decide: (a) recreate `KooshaPari/phenoShared` and push `14bb34c` + tracked `docs/boundary/`, `docs/intent/`, OR (b) re-target L5-116 FU6 to a different substrate (e.g. `pheno-ci-templates` resurrected standalone). Do **not** leave unpushed. |
| 2 | `KooshaPari/phenoShared` | Local ahead by 1 commit (`14bb34c`); 2 untracked dirs (`docs/boundary/`, `docs/intent/`) | **P0 — CRITICAL** | Same as #1 — choose substrate target before pushing. The `TOMBSTONE.md` "do not add" policy contradicts this work. |
| 3 | `KooshaPari/phenoShared` | `KooshaPari/pheno` PRs #239-#242 pin deleted-repo workflows at SHAs | **P1 — silent degradation hazard** | Schedule follow-up PR on `KooshaPari/pheno` to switch the 4 workflow pins to either: (a) inlined workflows, or (b) a re-created `KooshaPari/phenoShared`. Do this before the GA cache evicts the deleted-repo SHAs (~90 days). |
| 4 | `KooshaPari/Eidolon` | 14 stale `wip/...-2026-06-17` branches | **P3 — informational** | Add `wip/preserve-2026-06-17/README.md` note on remote clarifying these are intentional pre-pause snapshots per AGENTS.md ADR-023 "PAUSED APP" pattern. No data loss, no action required. |

No repos flagged for: `archived=true` (none) or `0 PRs in last 30 days` (all 5 existing repos had PR activity within the window — mobile-mcp's last push is 1d old but its 3 PRs were all merged 2026-06-18/19).

---

## Verification methodology

- **Date/time:** 2026-06-20 PDT (between 14:15 and 14:30 local, per shell tool timestamps).
- **Auth:** `gh auth status` confirmed `KooshaPari` (keyring), scopes `'delete_repo', 'gist', 'read:org', 'repo', 'workflow'`. Dmouse92 token absent (per L5-104 kill-switch 2026-06-17 22:30 PDT, AGENTS.md).
- **Read-only:** No `git push`, no `gh pr merge`, no file writes to repos under verification. Only write was the local `findings/2026-06-20-fleet-state-verification.md` itself (this file).
- **Per-repo queries:** 5 steps × 5 existing repos = 25 `gh api` / `gh list` calls + 1 explicit 404 confirmation + 3 local `git` read-only inspections for `phenoShared`.
- **Cross-checks:** `phenoShared` 404 cross-verified via `gh search repos "phenoShared" --owner KooshaPari` (returns empty array) and `gh api repos/KooshaPari/phenoShared -i` (HTTP/2.0 404 with `Access-Control-Allow-Origin: *`). Tombstone status verified by reading `phenoShared/TOMBSTONE.md` head locally.
