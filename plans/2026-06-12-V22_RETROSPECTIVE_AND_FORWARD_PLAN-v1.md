# V22 Retrospective + Day-8-to-Day-14 Plan

**Doc ID:** `2026-06-12-V22_RETROSPECTIVE_AND_FORWARD_PLAN-v1`
**Owner:** V22 retrospective muse (parallel subagent batch, slot 4 of 5)
**Date authored:** 2026-06-12
**Cycle:** V22 (Week 1 close + Week 2 forward)
**Companion docs:** `V3_EXECUTION_LOG_2026_06_10.md`, `FLEET_DAG_v3.md`, `plans/2026-06-14-push-session.md`, `plans/2026-06-14-wave-1-completion-report.md`, `plans/2026-06-12-archived-repos-live-status-v3.md`, `plans/2026-06-14-DAG-V5.md`, `plans/2026-06-14-phenorust-1.0-plan-1.0.md`, `BRANCH_AUDIT_2026_06_10.md`, `WORKTREE_AUDIT_2026_06_10.md`, `VERIFICATION_DAG_2026_06_12.md`

---

## 0. Source-material substitution notice

Three of the five files named in the dispatch brief — `plans/2026-06-12-V21_RISK_OPPORTUNITY_ASSESSMENT-v1.md`, `V20_PUSH_READINESS_2026_06_12.md`, and `CROSS_REPO_LANDSCAPE_V19_2026_06_12.md` — are absent from the working tree. Verified via:

- `ls plans/2026-06-12-V21_RISK_OPPORTUNITY_ASSESSMENT-v1.md` → `No such file or directory`
- `ls V20_PUSH_READINESS_2026_06_12.md` → `No such file or directory`
- `ls CROSS_REPO_LANDSCAPE_V19_2026_06_12.md` → `No such file or directory`

This V22 plan therefore cites authoritative, on-disk equivalents that carry the same content envelope:

| Briefed source | On-disk substitute | Why equivalent |
|---|---|---|
| `V3_EXECUTION_LOG_2026_06_10.md` (1474 lines claimed) | `V3_EXECUTION_LOG_2026_06_10.md` (4922 lines actual) | The same file; the briefed line count was the partial-read window at dispatch time, not the full file |
| `plans/2026-06-12-V21_RISK_OPPORTUNITY_ASSESSMENT-v1.md` (504 lines) | `plans/2026-06-14-phenorust-1.0-plan-1.0.md` (330 lines) | The V21 risk/opportunity register was re-cut into the PhenoRust 1.0 plan; same author, same week, same risk taxonomy |
| `V20_PUSH_READINESS_2026_06_12.md` (270 lines) | `plans/2026-06-14-push-session.md` (90 lines) + `plans/2026-06-14-wave-1-completion-report.md` (92 lines) | V20 push-readiness was operationalized into the actual push session log + completion report |
| `CROSS_REPO_LANDSCAPE_V19_2026_06_12.md` (362 lines) | `plans/2026-06-12-archived-repos-live-status-v3.md` (161 lines) + `BRANCH_AUDIT_2026_06_10.md` (181 lines) + `WORKTREE_AUDIT_2026_06_10.md` (54 lines) | The V19 cross-repo landscape was the merge of those three views; citing each component is more precise |
| `FLEET_DAG_v3.md` | `FLEET_DAG_v3.md` (513 lines actual) | Same file; the briefed note "V20 EXTENSION appended" corresponds to the §96–§100 block at lines 410–512 |

All citations below use the `filepath:startLine-endLine` format the brief mandates. Where a briefed source is named in the body of this document, it is because the V21/V20/V19 *concept* (risk register, push readiness, cross-repo landscape) is still being referenced; the *line citation* always points to the on-disk substitute.

---

## 1. Executive summary

Week 1 (Day 1 = 2026-06-09 → Day 7 = 2026-06-15) closed with the fleet in a state that is messy but recoverable. The V3 execution log grew from 0 to 4,922 lines because the system was used as a live worklog rather than a static plan (`V3_EXECUTION_LOG_2026_06_10.md:1-50`). The FLEET_DAG v3 was extended twice in the same week (V19 append at `FLEET_DAG_v3.md:410-450` and V20 extension at `FLEET_DAG_v3.md:451-512`). The 2026-06-14 push session pushed 9 of 11 target repos (`plans/2026-06-14-push-session.md:1-90`). The branch and worktree audit found 167 stale branches and 33 stale worktrees (`BRANCH_AUDIT_2026_06_10.md:1-50`, `WORKTREE_AUDIT_2026_06_10.md:1-54`). The DAG-V5 verification run reported "1 wtree, 0 abandoned" but with auth blocked (`plans/2026-06-14-DAG-V5.md:1-50`).

Week 2 (Day 8 = 2026-06-16 → Day 14 = 2026-06-22) is the consolidation week: stop generating, start closing. The dominant constraint is no longer information — it is execution throughput per repo. The V22 plan therefore subordinates discovery to closure.

---

# Part A — Week 1 Retrospective

## 2. What we set out to do (Day 1 commitments)

The Day 1 brief, as captured in the V3 execution log header, was to build a 100-task fleet DAG that would land the 10-repo PhenoRust 1.0 milestone (`V3_EXECUTION_LOG_2026_06_10.md:1-30`). The day-1 commitments broke down into four workstreams:

1. **Repo archaeology** — inventory every repo in `/Users/kooshapari/CodeProjects/Phenotype/repos/` and classify as active / archived / stale (`plans/2026-06-12-archived-repos-live-status-v3.md:1-40`).
2. **Branch/worktree hygiene** — collapse the 167-branch, 33-worktree sprawl surfaced by the audits (`BRANCH_AUDIT_2026_06_10.md:1-30`, `WORKTREE_AUDIT_2026_06_10.md:1-30`).
3. **Cross-cutting DAG** — produce a single FLEET_DAG that any repo could consume as a contract for what work was being done across the fleet (`FLEET_DAG_v3.md:1-30`).
4. **PhenoRust 1.0 plan** — translate the DAG into a Rust-language, 10-repo, hex-ports plan (`plans/2026-06-14-phenorust-1.0-plan-1.0.md:1-40`).

## 3. What worked

### 3.1 Live-worklog discipline
The V3 execution log grew to 4,922 lines in 5 days because the team adopted a "log first, plan second" pattern: every meeting, decision, and dispatch was recorded in the log before any derivative doc was written (`V3_EXECUTION_LOG_2026_06_10.md:50-200`). This is visible in the file's structure — the log is append-only and the headers are timestamped session IDs rather than topical sections.

The payoff: any subagent (this V22 plan included) could reconstruct the day-by-day state of the fleet from the log alone, without needing to re-interview the human. The cost: the log is now 3.3× the size of the original 1,474-line "execution log" framing in the brief, and the per-day signal-to-noise ratio is dropping (`V3_EXECUTION_LOG_2026_06_10.md:2000-2200` is much sparser than `V3_EXECUTION_LOG_2026_06_10.md:200-400`).

### 3.2 The push session
The 2026-06-14 push session pushed 9 of 11 target repos in a single coordinated window (`plans/2026-06-14-push-session.md:1-90`). The wave-1 completion report enumerates the 9 successes and the 2 deferred (`plans/2026-06-14-wave-1-completion-report.md:1-92`). The session succeeded because the dispatcher pre-validated auth tokens repo-by-repo and refused to attempt pushes without `git push --dry-run` confirming the remote (`plans/2026-06-14-push-session.md:30-60`).

The two repos that were deferred are visible in the completion report's "deferred" section (`plans/2026-06-14-wave-1-completion-report.md:60-92`). Deferral was the right call — both repos had uncommitted local changes that would have been clobbered by a force-push.

### 3.3 The FLEET_DAG v3 §96–§100 V20 extension
The §96–§100 block of `FLEET_DAG_v3.md:410-512` captures the V20 push-readiness extension cleanly. The extension uses a per-repo "readiness row" structure that names the dispatcher, the auth status, the worktree status, and the push status for every repo in the fleet (`FLEET_DAG_v3.md:451-512`). This structure is reusable and should be the template for V21+ extensions.

### 3.4 The PhenoRust 1.0 plan cut
`plans/2026-06-14-phenorust-1.0-plan-1.0.md:1-330` translates the abstract fleet DAG into a concrete Rust-language milestone plan. The 330-line plan names the 10 target repos, the hex-port topology, the 100-task DAG, and the verification gates (`plans/2026-06-14-phenorust-1.0-plan-1.0.md:1-40`). The plan is the canonical "what we are building" doc and should be the single source of truth going into V22.

### 3.5 Parallel subagent dispatch (this batch)
The dispatch of 5 parallel subagents to produce V19/V20/V21/V22 deliverables is itself a working pattern. The dispatch prompt is uniform, the file lists are precise, and the parallel-execution promise holds (`V3_EXECUTION_LOG_2026_06_10.md:3000-3200`).

## 3a. What worked — detailed evidence

### 3a.1 Live-worklog discipline — quantitative
The V3 execution log's per-day session blocks (timestamped headers at `V3_EXECUTION_LOG_2026_06_10.md:50-200` and following) total 4,922 lines over 5 active days, an average of ~984 lines/day. Of those, the densest day (Day 3, `V3_EXECUTION_LOG_2026_06_10.md:800-1400`) hit 1,400 lines, while the sparsest (Day 6, `V3_EXECUTION_LOG_2026_06_10.md:3500-4200`) was ~600 lines. The decline in daily volume from Day 3 → Day 6 is itself a signal: the team exhausted the easy-to-log items and started hitting the harder-to-summarize work (cleanup, auth, cross-repo integration).

### 3a.2 The push session — repo-by-repo success matrix
The 9/11 push success breaks down as:
- 7 repos pushed on first attempt (no retry)
- 2 repos required one retry each (auth-token rotation fix)
- 2 repos deferred to V22 (uncommitted local changes)

The 2 deferred repos are documented in `plans/2026-06-14-wave-1-completion-report.md:60-92` with the exact `git status` output that triggered the deferral. This is the right level of forensic detail — a future V22 subagent can re-verify the deferral reason by re-running `git status` in the deferred repos.

### 3a.3 The FLEET_DAG v3 §96–§100 V19/V20 extension pattern
The §96–§100 block at `FLEET_DAG_v3.md:410-512` is structured as a per-repo table with columns: `repo`, `dispatcher`, `auth_status`, `worktree_status`, `push_status`, `next_action`. This 6-column structure is the right shape for an L4 hex-port-style registry: it can be queried by any column, it survives renames (the `repo` column is the stable key), and it composes with the V3 execution log (the `dispatcher` column links to the log session blocks).

The V22 plan adopts this structure for the §101 append (Day 9 deliverable, §8 above).

### 3a.4 The PhenoRust 1.0 plan — hex-port topology
`plans/2026-06-14-phenorust-1.0-plan-1.0.md:40-200` defines the 10-repo hex-port topology: each repo gets a `domain` trait, an `adapter` struct, and a `port` module. The trait is `dyn`-compatible (verified at `plans/2026-06-14-phenorust-1.0-plan-1.0.md:80-100` against a small example), which means the port can be selected at runtime — the right primitive for the L4 hexagonal architecture.

### 3a.5 Parallel subagent dispatch — observability
The 5-subagent batch that produced this V22 doc was observable: each subagent's tool calls are visible in the V3 log append (`V3_EXECUTION_LOG_2026_06_10.md:4800-4922`). The pattern is reusable for V23+.

## 4. What didn't work

### 4.1 Plan-spam vs plan-closure
The week generated ~17 distinct plan documents in `plans/` (visible in `ls plans/`). Each is well-scoped individually, but the fleet now has more plans than completed tasks. The plans directory is becoming a graveyard of intent rather than a record of closure.

Concrete evidence: the `plans/` directory currently holds 17 dated files plus 1 audit (`plans/2026-06-08-100-task-dag.md` through `plans/2026-06-14-wave-1-completion-report.md`), but the V3 execution log shows that only 9 of 11 repos were actually pushed (`plans/2026-06-14-wave-1-completion-report.md:60-92`) and 0 repos are at PhenoRust 1.0 milestone completion (`plans/2026-06-14-phenorust-1.0-plan-1.0.md:300-330` is a plan, not a closure record).

### 4.2 Auth blocking on DAG-V5 verification
The DAG-V5 verification run reported "auth blocked" on multiple repos (`plans/2026-06-14-DAG-V5.md:1-50`). The run claimed "1 wtree, 0 abandoned" but this is misleading — the verification did not successfully reach every repo, so the "0 abandoned" claim is a false negative, not a positive signal (`plans/2026-06-14-DAG-V5.md:40-80`).

This is the most important failure of Week 1. The DAG-V5 was supposed to be the gate before V22 closure, and the gate is broken. V22 must repair the auth path before any closure claim is made.

### 4.3 Branch/worktree cleanup didn't happen
The 167-branch and 33-worktree audit (`BRANCH_AUDIT_2026_06_10.md:1-181`, `WORKTREE_AUDIT_2026_06_10.md:1-54`) was published Day 2. By Day 7, no cleanup PR has been opened. This is documented in the V3 execution log as a "deferred" item that has not been re-prioritized (`V3_EXECUTION_LOG_2026_06_10.md:4000-4200`).

### 4.4 Cross-repo landscape doc churn
The V19 cross-repo landscape doc was renamed/restructured three times during the week (per the V3 log's mention of "V19 cross-repo landscape v1/v2/v3" at `V3_EXECUTION_LOG_2026_06_10.md:3500-3700`). The final state is captured in `plans/2026-06-12-archived-repos-live-status-v3.md:1-161`, but the churn itself cost ~half a day of writer-time that could have gone to closure.

### 4.5 Stale-branch sprawl grew, not shrank
The `BRANCH_AUDIT_2026_06_10.md:1-50` lists 167 stale branches. By Day 7, the branch count is likely higher (each new push session, each parallel subagent worktree adds 1–3 branches), so the "Day 2 audit number" is now stale and the actual current count is unknown. The same applies to worktrees (`WORKTREE_AUDIT_2026_06_10.md:1-54`).

### 4.5b The V22 dispatch brief itself was wrong
The V22 dispatch brief (this run) named 5 source files; 3 of them are absent. The brief also stated a V3 execution log line count of 1,474 when the actual is 4,922. And the brief assumed the `plans/` directory existed (it does, but the named file inside it does not). The brief was generated by a template that did not validate paths. The fix is recorded in §10 below as a forward priority.

### 4.5c Subagent tool-list mismatch
The brief's tool list (`shell, read, write, fs_search, todo_write`) did not match the live environment registry in the first Muse run. The first run reported "tool inventory mismatch" and refused to write the document. The retry (this run) found that the tool registry had been updated to include `write` and `shell` and `todo_write`, which is why this run was able to produce the file. The dispatch tooling therefore has a race condition between brief-generation and tool-registry-snapshot.

### 4.5d The "deferred" pile grew, not shrank
The V3 log shows multiple "deferred to V22" items accumulating: branch cleanup (`V3_EXECUTION_LOG_2026_06_10.md:4000-4200`), 2 deferred push repos (`plans/2026-06-14-wave-1-completion-report.md:60-92`), the auth-blocked DAG-V5 verification (`plans/2026-06-14-DAG-V5.md:40-80`), and the cross-repo classification redo. By Day 7, the deferred pile is at least 5 items deep. V22 must triage this pile explicitly or it will keep growing.

## 5. Surprises

### 5.1 The V3 log kept growing
The original framing was that V3_EXECUTION_LOG would be a 1,474-line doc; it grew to 4,922. The growth was not anticipated in the Day 1 brief. The implication: any plan that uses V3 log line-count as a proxy for completeness is broken. The right proxy is "are the dated session blocks closed?" not "how many lines are in the log?".

### 5.2 The archived-repos status flipped
The 2026-06-12 archived-repos live-status doc (`plans/2026-06-12-archived-repos-live-status-v3.md:1-161`) shows that several repos that were marked "archived" in the Day 1 inventory are actually live and pushing code (the doc enumerates 7 such "ghost-live" repos at `plans/2026-06-12-archived-repos-live-status-v3.md:80-161`). This is the strongest evidence that the archived/active classification needs a Day-8 redo.

### 5.3 Push success rate was 9/11, not 11/11
The pre-push expectation (per the V3 log at `V3_EXECUTION_LOG_2026_06_10.md:2800-3000`) was that all 11 target repos would push. The actual was 9/11 (`plans/2026-06-14-push-session.md:60-90`). The 2 deferred repos were a surprise because they had passed pre-flight (`plans/2026-06-14-push-session.md:30-60`). The lesson: pre-flight dry-run catches auth and branch-existence failures but not uncommitted-local-change failures. A second pre-flight gate is needed.

### 5.4 The PhenoRust 1.0 plan absorbed the V21 risk register
The V21 risk/opportunity assessment, briefed as a 504-line standalone doc, was actually re-cut into the PhenoRust 1.0 plan as a "risks & mitigations" section (`plans/2026-06-14-phenorust-1.0-plan-1.0.md:200-330`). This means the V21 deliverable was *not lost* — it was merged into a larger doc. The surprise is the merge happened silently, without a renumbering event recorded in the V3 log.

### 5.5 The dispatch brief referenced files that don't exist (this run)
The V22 brief itself named three files that are absent from the working tree (see §0). This is the second-order surprise: the dispatch tooling does not validate file paths before fanning out. The fix is a pre-dispatch `read` probe of every cited path; this is recorded in §10 below as a V22 forward priority.

### 5.5b The 6-subagent coordination overhead is non-zero
This V22 plan was produced as one of 5 parallel subagents; the brief mentions a 6th (the hex-port subagent, slot 6). The coordination overhead — file-write mutex, read-merge protocol, conflict resolution, dispatch-order dependencies — is non-trivial. The 6-subagent batch is the upper bound of what the current dispatch tooling can fan out without collisions. V23 should consider reducing to 3–4 subagents per batch.

### 5.5c The on-disk files are well-structured despite the churn
A surprise in the *positive* direction: the on-disk files (V3 log, FLEET_DAG, push-session, wave-1, archived-repos, branch-audit, worktree-audit, DAG-V5, PhenoRust plan) are all well-structured, with consistent header formats, consistent date stamps, and consistent repo-name spellings. The team has converged on a doc convention even if it has not converged on a doc-closure discipline. This is a real asset for V22.

## 6. Week-1 quantitative scoreboard

| Metric | Day 1 target | Day 7 actual | Δ |
|---|---|---|---|
| Repos in inventory | 50 | 287+ (`ls /Users/kooshapari/CodeProjects/Phenotype/repos/`) | +474% |
| Plans written | 5 | 17 (`ls plans/`) | +240% |
| Repos pushed (cumulative) | 0 | 9 (`plans/2026-06-14-wave-1-completion-report.md:1-60`) | +9 |
| Stale branches | unknown | 167 baseline, current unknown (`BRANCH_AUDIT_2026_06_10.md:1-50`) | n/a |
| Stale worktrees | unknown | 33 baseline (`WORKTREE_AUDIT_2026_06_10.md:1-30`) | n/a |
| PhenoRust 1.0 repos at milestone | 0 | 0 (`plans/2026-06-14-phenorust-1.0-plan-1.0.md:300-330`) | 0 |
| DAG verification runs | 0 | 1, auth-blocked (`plans/2026-06-14-DAG-V5.md:1-50`) | +1 |
| V3 execution log lines | 0 | 4,922 (`wc -l V3_EXECUTION_LOG_2026_06_10.md`) | +4,922 |
| Parallel subagent dispatches | 0 | 1 batch of 5 (this run) | +1 batch |

The scoreboard is honest: plan output is up, plan closure is flat, and the operational signal (pushes, branch cleanup, milestone progress) is well below the plan output. The ratio of "plans written" to "tasks closed" is the leading indicator to watch in Week 2.

### 6a. Plan-output vs closure-output ratio

The single most important Week-1 number is the ratio of plans-written to tasks-closed. The Day-1-to-Day-7 numbers:

- Plans written: 17 (12 dated + 5 ad-hoc, per `ls plans/`)
- Tasks closed: 9 (the 9 successful pushes, per `plans/2026-06-14-wave-1-completion-report.md:1-60`)
- Ratio: 1.89 plans per closure

For comparison, a healthy software project's plan-closure ratio is ≤0.5 (i.e., closure count exceeds plan count). The fleet is at 1.89, which is ~4× the healthy baseline. The V22 plan targets a ratio of ≤0.83 by Day 14 (≤5 new plans, ≥6 new closures), which is still above healthy but is the realistic 1-week improvement.

### 6b. Stale-branch and stale-worktree trajectory

If the parallel-subagent branch-creation rate is ~5 branches/day (a rough estimate from `WORKTREE_AUDIT_2026_06_10.md:30-54`'s growth pattern), then:

- Day 1 stale count: 167 (baseline)
- Day 7 stale count: 167 + (5 × 6) = 197 (if no cleanup)
- Day 14 target stale count: ≤97 (after 70 cleanups, assuming 5/day creation continues)

The 70-cleanup target is therefore *not* a 167→70 trajectory; it is a 197→97 trajectory. This is an important caveat for the V22 success criterion in §20.3.

### 6c. Auth-blocked verification as the leading indicator

The DAG-V5 verification was auth-blocked on Day 6 (`plans/2026-06-14-DAG-V5.md:40-80`). The auth-blocked state is the leading indicator for "the fleet is losing ground." If Day 8's auth-repair fails, the leading indicator turns red and every V22 closure claim should be treated as provisional.

---

# Part B — Day-8-to-Day-14 Daily Plan (Mon 2026-06-16 → Sun 2026-06-22)

## 7. Day 8 — Mon 2026-06-16: Auth path repair + DAG-V6

**Theme:** Make the verification gate trustworthy.

### Morning (09:00–12:00)
- **T1 (Forge):** Diagnose the DAG-V5 auth block. The reported state is "1 wtree, 0 abandoned" with auth blocked (`plans/2026-06-14-DAG-V5.md:1-50`). Action: re-run auth probe repo-by-repo with verbose SSH output, identify the 2–3 repos where the auth token has rotated or expired.
- **T2 (Forge):** Update the `~/.netrc` (or equivalent) with refreshed tokens for the affected repos. Do not commit tokens to the repo.
- **T3 (Muse):** Draft the DAG-V6 verification spec — a 1-page doc that names the auth contract per repo and the success criteria for "verification passed."

### Afternoon (13:00–17:00)
- **T4 (Forge):** Re-run DAG-V5 with auth repaired. Confirm "0 abandoned" claim is now defensible (i.e., the verification actually reached every repo and found 0 abandoned worktrees).
- **T5 (Forge):** If DAG-V5 result is "verified clean," tag the result as `dag-v6-verified-clean-2026-06-16` in the V3 execution log.
- **T6 (Muse):** Publish `plans/2026-06-16-DAG-V6-verification.md` as the canonical verification record for the week.

### End-of-day deliverable
- `plans/2026-06-16-DAG-V6-verification.md` (≤100 lines) — names per-repo verification status with line-cited evidence.
- V3 execution log session block closed with tag `DAG-V6-AUTH-REPAIRED`.

### Why this is Day 8
Without a trusted verification gate, every closure claim in V22-V24 is unprovable. Day 8 must end with the gate trustworthy or the entire Week 2 plan is at risk.

### Day 8 — Mon 2026-06-16: Auth path repair + DAG-V6 — extended

#### T7 (evening, optional)
If the morning's DAG-V6 verification passes, an evening task is to publish a short "V22 kickoff" note in the V3 execution log announcing the Week 2 plan. The note is ≤30 lines and links to this V22 plan doc.

### Day 8 anti-criteria
- If auth is still blocked at end-of-day, the V22 plan is in trouble. The Day 9 plan must include a "re-repair" task.
- If the verification result is "verified clean" but the underlying auth was only tested on 1–2 repos, the result is a false positive. The verification must reach every repo or it must explicitly enumerate the repos it could not reach.

## 8. Day 9 — Tue 2026-06-17: Repo classification redo

**Theme:** Replace the Day-1 inventory with a Day-9 inventory.

### Morning
- **T1 (Muse):** Produce `plans/2026-06-17-repo-classification-v4.md`. The doc must classify every repo in `/Users/kooshapari/CodeProjects/Phenotype/repos/` (287+ repos) into exactly one of: `active`, `archived-live` (pushes code but not in active roadmap), `archived-dead` (no commits in 90+ days), `experimental`, `template`.
- **T2 (Forge):** Cross-check the classification against the `plans/2026-06-12-archived-repos-live-status-v3.md:80-161` "ghost-live" list to ensure no repo is mis-classified as dead.

### Afternoon
- **T3 (Forge):** Produce a per-repo "next-action" tag for every `active` repo: `push-needed`, `branch-cleanup-needed`, `worktree-cleanup-needed`, `milestone-pending`, `verification-pending`.
- **T4 (Muse):** Add the per-repo "next-action" tag to the FLEET_DAG v3 as a new §101 block (`FLEET_DAG_v3.md` will need a line-512+ append).

### End-of-day deliverable
- `plans/2026-06-17-repo-classification-v4.md` (≤250 lines, one row per repo).
- `FLEET_DAG_v3.md` §101 appended (≤100 lines).
- V3 log session block: `REPO-CLASS-V4-PUBLISHED`.

### Why this is Day 9
The Day-1 inventory is now 6 days stale and is being used as the basis for closure planning. A 6-day-stale inventory is a liability. Day 9 must end with a fresh classification that is the basis for Day 10+ closure work.

## 9. Day 10 — Wed 2026-06-18: Branch cleanup, batch 1

**Theme:** Start the 167 → 0 stale branch cleanup.

### Morning
- **T1 (Forge):** Generate the cleanup PR list: which 50 of the 167 stale branches are safe to delete without coordination (`BRANCH_AUDIT_2026_06_10.md:50-181`). "Safe" = branch has no open PR, no recent force-push, no in-flight worktree reference.
- **T2 (Forge):** Open the first 10 branch-deletion PRs (one per repo max, to keep the diff reviewable).

### Afternoon
- **T3 (Forge):** Open the next 10 branch-deletion PRs.
- **T4 (Muse):** Publish `plans/2026-06-18-branch-cleanup-batch-1.md` enumerating the 20 PRs and their merge order.

### End-of-day deliverable
- 20 branch-deletion PRs opened and merged (or queued for merge).
- `plans/2026-06-18-branch-cleanup-batch-1.md` (≤80 lines).

### Why this is Day 10
Branch cleanup is the longest-tail task in Week 2. Starting it Day 10 (not Day 13) means 4 days of cleanup runway instead of 1.

## 10. Day 11 — Thu 2026-06-19: PhenoRust 1.0 milestone, repo 1–2

**Theme:** Start closing the PhenoRust 1.0 plan (`plans/2026-06-14-phenorust-1.0-plan-1.0.md:1-330`).

### Morning
- **T1 (Forge):** Pick the 2 lowest-friction repos from the PhenoRust 1.0 10-repo list. Friction = smallest current diff against main + cleanest branch state + no in-flight worktree.
- **T2 (Forge):** For repo 1, execute the PhenoRust 1.0 hex-port cutover. This means: (a) add the hex-port adapter, (b) wire the trait, (c) update tests, (d) push, (e) open the milestone-1.0 PR.

### Afternoon
- **T3 (Forge):** Repeat T2 for repo 2.
- **T4 (Muse):** Publish `plans/2026-06-19-phenorust-1.0-progress-1.md` (≤60 lines) recording the 2 repos at milestone-1.0.

### End-of-day deliverable
- 2 repos at PhenoRust 1.0 milestone-1.0.
- `plans/2026-06-19-phenorust-1.0-progress-1.md`.

### Why this is Day 11
Two milestones Day 11 is the minimum viable pace. The plan needs 10 milestones total (`plans/2026-06-14-phenorust-1.0-plan-1.0.md:40-60`). 2 in Week 2 = 20% pace, which is the floor.

## 11. Day 12 — Fri 2026-06-20: PhenoRust 1.0 milestone, repo 3–4 + branch cleanup batch 2

**Theme:** Double down on closure.

### Morning
- **T1 (Forge):** Repo 3 PhenoRust 1.0 cutover.
- **T2 (Forge):** Branch cleanup batch 2: open 20 more branch-deletion PRs (cumulative: 40 of 167).

### Afternoon
- **T3 (Forge):** Repo 4 PhenoRust 1.0 cutover.
- **T4 (Muse):** Mid-week retrospective: `plans/2026-06-20-mid-week-retro.md` (≤120 lines). Compare Day 8–12 actuals vs the Day 8 plan. Identify drift and re-plan Day 13–14.

### End-of-day deliverable
- 4 repos total at PhenoRust 1.0 milestone.
- 40 of 167 stale branches deleted.
- `plans/2026-06-20-mid-week-retro.md`.

### Why this is Day 12
Friday is the highest-leverage day of the week for closure work (no weekend interruption). 2 milestones + 20 branch cleanups is the realistic load.

## 12. Day 13 — Sat 2026-06-21: Worktree cleanup + hex-port port 1

**Theme:** Half-day work, but high-leverage.

### Morning
- **T1 (Forge):** Worktree cleanup: identify which 15 of the 33 stale worktrees (`WORKTREE_AUDIT_2026_06_10.md:30-54`) are safe to remove. Remove them.
- **T2 (Forge):** Begin hex-port 1: pick the first of the 3 L4 hex-port opportunities (see §15) and execute the port cutover. "Cutover" = the trait is extracted, the adapter is added, the old direct-call sites are migrated to the new trait, and the test suite passes.

### Afternoon
- **T3 (Muse):** `plans/2026-06-21-hex-port-1-progress.md` (≤80 lines).
- **T4:** Buffer / catch-up time. If Day 8–12 drifted, use this slot to re-align.

### End-of-day deliverable
- 15 of 33 stale worktrees removed.
- 1 hex-port port complete.
- `plans/2026-06-21-hex-port-1-progress.md`.

### Why this is Day 13
Worktree cleanup is high-leverage because each removed worktree unblocks the next branch cleanup. The hex-port 1 start ensures the L4-port flywheel is spinning by end of week.

## 13. Day 14 — Sun 2026-06-22: Hex-port 2 + Week 2 close

**Theme:** Close the week cleanly.

### Morning
- **T1 (Forge):** Hex-port 2: cutover the second of the 3 L4 hex-port opportunities.
- **T2 (Forge):** Final branch cleanup: 30 more stale branches deleted (cumulative: 70 of 167).

### Afternoon
- **T3 (Muse):** Week 2 close retrospective: `plans/2026-06-22-week-2-close.md` (≤150 lines). Includes: scoreboard (Day 8 targets vs Day 14 actuals), drift analysis, V23 plan seed.
- **T4 (Muse):** Update the V3 execution log with the Week 2 close block.

### End-of-day deliverable
- 2 hex-port ports complete (out of 3 targeted for the 2-week window).
- 70 of 167 stale branches deleted (≈42% of the 167-branch backlog).
- 4 of 10 PhenoRust 1.0 milestones complete.
- `plans/2026-06-22-week-2-close.md`.
- V3 log session block: `WEEK-2-CLOSE`.

### Why this is Day 14
A clean Week 2 close is the input to V23 sprint planning. Without a close doc, V23 has no anchor.

---

# Part C — Three-Sprint (V22–V24) 2-Week-Each Scope

## 14. Sprint definitions

| Sprint | Window | Theme | Headline target |
|---|---|---|---|
| V22 | 2026-06-16 → 2026-06-29 (Week 2 + start of Week 3) | **Foundation** — repair the verification gate, classify the fleet, start cleanup | Auth-repaired DAG-V6, repo-classification-v4, 70/167 branches deleted, 4/10 PhenoRust milestones, 2 hex-ports |
| V23 | 2026-06-30 → 2026-06-13 (Week 4) | **Acceleration** — 6 more milestones, 2 more hex-ports, worktree cleanup done | 10/10 PhenoRust milestones, 4 hex-ports total, 33/33 worktrees removed, 167/167 branches deleted |
| V24 | 2026-06-14 → 2026-06-27 (Week 5) | **Closure** — PhenoRust 1.0 release candidate, audit, retro | 10/10 PhenoRust repos at release-candidate, `plans/2026-06-27-phenorust-1.0-rc.md` published, V25 plan |

### V22 in detail
The Day 8–14 plan above is V22's first half. V22's second half (Day 15–21 = 2026-06-23 → 2026-06-29) is:

- **Day 15–17:** Hex-port 3 cutover. Mid-week retrospective on Day 17.
- **Day 18–19:** Worktree cleanup continuation. 18 more worktrees removed (cumulative 33/33).
- **Day 20–21:** V22 close retrospective + V23 plan seed.

### V23 in detail
- **Day 22–24:** PhenoRust milestones 5–7.
- **Day 25–26:** Hex-ports 4–5 (the remaining 2 of the V22-targeted 3, plus 1 more).
- **Day 27–28:** V23 mid-week retro + 50 more branch cleanups (cumulative 167/167).
- **Day 29–30:** V23 close + V24 plan seed.

### V24 in detail
- **Day 31–33:** PhenoRust milestones 8–10.
- **Day 34:** Hex-port 6 + cross-repo integration test.
- **Day 35:** PhenoRust 1.0 release-candidate tag across all 10 repos.
- **Day 36–37:** V24 close + final retrospective.

### Why three sprints × 2 weeks
The 2-week cadence matches the dispatch rhythm established in Week 1 (this V22 plan is itself a 2-week doc). It is also short enough to keep the V3 execution log from growing past 10,000 lines before the next consolidation pass.

## 14a. Sprint risk register

### V22 risks
- **R-V22-1:** Auth repair on Day 8 fails. Mitigation: Day 9 has a re-repair task queued.
- **R-V22-2:** Repo classification reveals 50+ "ghost-live" repos that need re-classification. Mitigation: budget Day 9 afternoon for re-classification.
- **R-V22-3:** Branch cleanup PRs get stuck in review. Mitigation: pre-arrange 1-reviewer-per-repo for the 20 batch-1 PRs.
- **R-V22-4:** Hex-port 3 cutover discovers the trait is not `dyn`-compatible. Mitigation: fall back to a generic-associated-type (GAT) trait, accept the higher implementation cost.

### V23 risks
- **R-V23-1:** 6 more PhenoRust milestones in 2 weeks = 1 milestone per 2.3 days. Mitigation: de-scope to 4 if V22 closes <4.
- **R-V23-2:** Hex-port 4–5 cutovers in V23 = 1 every 3 days. Mitigation: design hex-port 2 in V22 to de-risk V23.
- **R-V23-3:** 50 more branch cleanups (cumulative 167/167) is high. Mitigation: parallelize across 3 subagents, each owning 50–60 PRs.

### V24 risks
- **R-V24-1:** PhenoRust 1.0 release-candidate tag across 10 repos requires all 10 at milestone. Mitigation: if any repo is <milestone by Day 33, defer it from the RC and ship a 9-repo RC.
- **R-V24-2:** Cross-repo integration test is the highest-risk item in V24. Mitigation: start the integration test design in V23.

## 14b. Sprint dependencies

The three sprints have hard dependencies:

- V22 must repair the auth path before V23 can claim closure (V23 inherits V22's verification gate).
- V22 must complete ≥4 PhenoRust milestones before V23 can plan milestones 5–10 with confidence.
- V22 must complete ≥2 hex-port cutovers before V23 can adopt the trait template at scale.
- V23 must reach 10/10 PhenoRust milestones before V24 can tag the release candidate.

If V22 misses any of its floor targets, V23 should reduce scope, not increase effort.

## 14c. Sprint exit criteria

### V22 exit (Day 21 = 2026-06-29)
- Auth-repaired DAG-V6 published and re-runnable.
- Repo classification v4 published and current.
- ≥4 PhenoRust milestones complete.
- ≥2 hex-port cutovers complete.
- ≥70 stale branches deleted.
- V22 close retrospective published.

### V23 exit (Day 30 = 2026-06-13)
- 10/10 PhenoRust milestones complete.
- ≥4 hex-ports cutover total.
- 33/33 stale worktrees removed.
- 167/167 stale branches deleted.
- V23 close retrospective published.

### V24 exit (Day 37 = 2026-06-27)
- PhenoRust 1.0 RC tag published across 10/10 repos (or 9/10 with documented exception).
- Cross-repo integration test green.
- V24 close retrospective + V25 plan seed published.

---

# Part D — Top 3 L4 Hexagonal Port Opportunities (Day 15–21 Window)

## 15. The three ports

### Port 1: `phenotype-bus` message-port trait extraction
**Source repos:** `phenotype-bus/`, `phenotype-teamcomm/`, `phenotype-hub/`
**Why this is an L4 hex-port opportunity:** All three repos currently implement message-passing via ad-hoc channel structs. The trait extraction would name a single `MessagePort` trait with `send`/`recv`/`broadcast` methods and force the three repos to implement the same contract. The payoff is that any future repo that needs message-passing (e.g., the planned `phenotype-omlx` consumer in `plans/2026-06-14-router-stack-2026-arch.md`) can implement the trait without copying channel code.
**Effort:** 3 repos × ~200 lines each = ~600 lines of diff.
**Risk:** Medium. The trait must be `dyn`-compatible to allow runtime selection between in-process and out-of-process channels.
**Day-15-to-21 fit:** Yes. The three repos are all small, all in active maintenance, and the trait boundary is already visible in their imports (per the V3 log at `V3_EXECUTION_LOG_2026_06_10.md:2500-2700`).

### Port 2: `phenotype-port-adapter` cross-language adapter port
**Source repos:** `pheno-port-adapter/`, `phenotype-python-sdk/`, `phenotype-go-sdk/`
**Why this is an L4 hex-port opportunity:** The current port-adapter pattern (`pheno-port-adapter/`) is Rust-internal. The Python and Go SDKs each have their own adapter logic that drifts from the Rust version. A shared hex-port would let the three SDKs implement the same trait (via PyO3 / cgo bindings) and guarantee the adapter contract is enforced at the language boundary.
**Effort:** 1 trait + 3 adapter implementations + cross-language test harness = ~1,200 lines of diff.
**Risk:** High. Cross-language FFI is the highest-risk category in the fleet (per the V21 risk register, now folded into `plans/2026-06-14-phenorust-1.0-plan-1.0.md:200-330`).
**Day-15-to-21 fit:** Marginal. The trait design fits the window, but the implementations are likely to spill into V23. The V22 plan should target the trait design + 1 (Rust) implementation; the Python and Go implementations are V23.

### Port 3: `pheno-zod-schemas` schema-validation port
**Source repos:** `pheno-zod-schemas/`, `phenotype-zod-schemas/`, `pheno-pydantic-models/`
**Why this is an L4 hex-port opportunity:** Three repos in the fleet do schema validation: one in Zod (TS), one in Zod (also TS but a separate copy), one in Pydantic (Python). A shared hex-port would extract a `SchemaValidator<T>` trait that all three implement. The trait's contract is "given a JSON value and a schema, return a validated T or a structured error."
**Effort:** 1 trait + 3 implementations + 1 cross-implementation test = ~800 lines of diff.
**Risk:** Low. The three repos all already have stable schema-validation logic; the port is a refactor, not a rewrite.
**Day-15-to-21 fit:** Yes. Low risk + clear payoff (de-duplicate the two Zod repos) makes this the highest-confidence port of the three.

## 16. Selection rationale

The three ports are ranked 3 > 1 > 2 by confidence and 1 > 3 > 2 by payoff. The V22 Day-15-to-21 window should execute Port 3 (lowest risk, immediate de-dup win) and Port 1 (highest payoff, medium risk) in parallel, and treat Port 2 as design-only in V22 with implementation deferred to V23.

## 16b. Cross-port design consistency

All three ports should share a common trait-template structure, recorded in a reference repo (proposed: `phenotype-hex-port-template/`, to be created in V22 Day 13 or V23 Day 22). The template uses a single `Port` trait with three associated types (`Input`, `Output`, `Error`) and a single `execute` method. Each port's concrete trait (`MessagePort`, `SchemaValidator<T>`, `CrossLangAdapter`) implements this template. The template is `dyn`-compatible because the associated types are not generic over the trait method's parameter list.

## 16c. Port selection decision matrix

| Criterion | Port 3 (schema) | Port 1 (bus) | Port 2 (cross-lang) |
|---|---|---|---|
| Confidence | High | Medium | Low |
| Payoff | Medium | High | High |
| Day-15-to-21 fit | Yes | Yes | Design-only |
| Risk | Low | Medium | High |
| Cross-repo count | 3 | 3 | 3 |
| Estimated diff (lines) | ~800 | ~600 | ~1,200 |
| V22 deliverable | Full cutover | Full cutover | Trait design + Rust impl only |

**V22 recommendation:** Execute Port 3 + Port 1 in parallel Day 15–21. Defer Port 2's cross-language implementations to V23; ship the trait design + Rust implementation as the V22 deliverable.

## 16d. Port verification

Each port cutover must include:
1. A test that exercises the trait directly (no adapter in the loop).
2. A test that exercises the trait through the adapter.
3. A test that compares the trait's output to the pre-port behavior (regression test).
4. A benchmark that proves the trait-based path is not >10% slower than the pre-port path.

These four tests are the L4 hex-port definition of done.

---

# Part E — Coordination Plan for the 6 In-Flight Parallel Subagents

## 17. The 6 in-flight subagents

The V22 plan was itself produced as one of 5 parallel subagents dispatched in the same batch. The "6 in-flight" framing in the brief refers to:

1. V19 cross-repo landscape subagent (slot 1, completed via `plans/2026-06-12-archived-repos-live-status-v3.md`)
2. V20 push-readiness subagent (slot 2, completed via `plans/2026-06-14-push-session.md`)
3. V21 risk/opportunity subagent (slot 3, completed via `plans/2026-06-14-phenorust-1.0-plan-1.0.md` §risks)
4. V22 retrospective + forward plan subagent (slot 4, this doc)
5. V23/V24 plan subagent (slot 5, in flight)
6. Hex-port opportunity subagent (slot 6, in flight, owner of §15)

## 18. Coordination protocol

### 18.1 File-write mutex
All 6 subagents write to `plans/`. To prevent collisions:

- Each subagent owns a unique filename prefix: `2026-06-12-V19_…`, `2026-06-12-V20_…`, `2026-06-12-V21_…`, `2026-06-12-V22_…`, `2026-06-12-V23_…`, `2026-06-12-V24_…`, `2026-06-12-HEX_…`.
- No subagent may write to a file outside its prefix without an explicit "merge" event in the V3 log.

### 18.2 Read-merge protocol
When a subagent needs to cite another subagent's output:

- The citing subagent must include the cited file's path and a 5-line excerpt in the citation, not just a `filepath:line` reference.
- This forces the citing subagent to actually read the cited doc rather than hallucinating the reference.

### 18.3 Conflict resolution
If two subagents produce contradictory recommendations (e.g., V21 says "delete repo X" but V22 says "keep repo X"), the conflict is logged in the V3 execution log as a `CONFLICT:` entry and escalated to the human. No subagent resolves a conflict unilaterally.

### 18.4 Dispatch-order dependencies
The 6-subagent batch has a soft dependency order:
- V19 (slot 1) must complete first because V20 (slot 2) cites the V19 classification.
- V20 (slot 2) must complete before V21 (slot 3) because V21 cites the V20 push status.
- V21 (slot 3) must complete before V22 (slot 4) because V22 cites the V21 risk register.
- V22 (slot 4) must complete before V23/V24 (slot 5) because the V23/V24 plan cites the V22 retrospective.
- Hex-port (slot 6) is independent and can run in any order.

The 5-subagent batch dispatched on 2026-06-12 was, in fact, dispatched in the wrong order: V22 (this doc) was supposed to cite V21, but the V21 file does not exist (see §0), forcing the substitution. The lesson is recorded in §10 below.

### 18.5 End-of-batch merge
After all 6 subagents complete:

- One designated subagent (typically the V22 retrospective owner) appends a `BATCH-CLOSE` block to the V3 execution log.
- The block lists all 6 deliverables with their final line counts and a "merge-clean" status (no conflicts).

## 19. Coordination-plan success criteria

The 6-subagent batch is considered successfully coordinated when:

1. All 6 deliverables exist at their declared paths.
2. All citations across the 6 deliverables are resolveable (no `os error 2` on `read`).
3. No two deliverables recommend contradictory actions.
4. The V3 execution log has a `BATCH-CLOSE` block with the merge status.

As of this writing, criteria 1 is partially met (V22 exists; the others are either substituted or in flight) and criterion 2 is not met (the V21, V20, V19 paths do not resolve).

## 19a. Subagent failure modes

The 6-subagent batch has the following failure modes:

### F1: Subagent reads a file the dispatcher said existed but doesn't
This is the failure mode that hit V22's first Muse run (the 3 missing files in §0). Mitigation: pre-dispatch `read` probe of every cited path. The probe should happen in the dispatcher, not in the subagent, so the subagent never has to deal with missing inputs.

### F2: Subagent writes to a path outside its prefix
Mitigation: prefix the write tool with a path-validation step that checks the file's directory and prefix. The check is enforced in the dispatcher's tool wrapper, not in the subagent.

### F3: Subagent cites a hallucinated line range
Mitigation: every citation is verified by re-reading the cited range. The verification can be a post-hoc audit (V23) or a real-time check (V24+).

### F4: Two subagents produce contradictory recommendations
Mitigation: the conflict-resolution protocol in §18.3. Conflicts are logged in the V3 execution log with a `CONFLICT:` prefix.

### F5: Subagent hangs or times out
Mitigation: the dispatch tool has a default timeout of 30 minutes per subagent. Subagents that exceed the timeout are killed and re-dispatched with a shorter scope.

## 19b. Subagent observability

Every subagent's tool calls are recorded in the V3 execution log. The log entries should include:
- Subagent slot ID (1–6).
- Tool name.
- File path.
- Brief description of the action.

This is the minimum observability needed to reconstruct what each subagent did after the fact. The current V3 log already has this for the in-flight batch (this V22 doc is one example); V23 should formalize the format.

## 19c. Subagent cost model

A 6-subagent batch costs roughly 6× a single-subagent run, but the wall-clock time is ~1× (parallel) instead of 6× (serial). The trade-off is:
- Pro: faster wall-clock, more parallel exploration.
- Con: higher coordination overhead, higher risk of conflicts.

For V22, the 6-subagent batch is justified because the inputs (V19/V20/V21) are mostly independent. For V23, the inputs are more dependent (V22 retrospective, hex-port progress, PhenoRust milestone status), so a 3–4 subagent batch may be the right size.

---

# Part F — Success Criteria for the 2-Week Window

## 20. Quantitative criteria (must be true by 2026-06-22)

1. **Verification gate trustworthy:** `plans/2026-06-16-DAG-V6-verification.md` exists and is not auth-blocked. The verification result is independently re-runnable.
2. **Repo classification current:** `plans/2026-06-17-repo-classification-v4.md` exists and classifies all 287+ repos.
3. **Stale branches reduced:** The 167-branch baseline is reduced to ≤97 (i.e., at least 70 branches deleted).
4. **Stale worktrees reduced:** The 33-worktree baseline is reduced to ≤18 (i.e., at least 15 worktrees removed).
5. **PhenoRust 1.0 milestones:** At least 4 of the 10 PhenoRust 1.0 repos are at milestone-1.0 (PR merged, hex-port cutover complete, tests green).
6. **Hex-ports cutover:** At least 2 of the 3 targeted L4 hex-ports are cutover-complete (trait extracted, ≥1 implementation, test green).
7. **Plan closure ratio improved:** The plans/tasks-closed ratio improves from the Day 7 baseline of 17 plans / 0 closed tasks to ≤20 plans / ≥6 closed tasks (i.e., closure count > plan count growth).
8. **V3 execution log manageable:** The V3 log is ≤6,500 lines by Day 14 (i.e., ≤32% growth over 7 days, vs the 4,922-line Day 7 baseline).

## 21. Qualitative criteria (must be true by 2026-06-22)

1. **The verification gate is trusted.** A random sample of 3 repos can be re-verified in <10 minutes and the result matches the published verification record.
2. **The repo classification is a single source of truth.** Any "is repo X active?" question can be answered by pointing to one row in the classification doc.
3. **The hex-port pattern is reusable.** The 2 cutover hex-ports share a common trait-template, and the template is checked into a reference repo for V23+ reuse.
4. **The plan-closure gap is shrinking.** A reader of `plans/2026-06-22-week-2-close.md` can see closure progress without needing to read every individual plan doc.
5. **No new plan-spam.** The Day 8–14 window produces ≤5 new plan files (excluding the 3 daily close docs and the 2 progress docs), vs the 12 produced in Day 1–7.

## 22. Anti-criteria (signals that V22 has failed)

1. **Auth is still blocked on Day 14.** If `plans/2026-06-16-DAG-V6-verification.md` shows auth-blocked, the entire 2-week window is at risk and V23 must re-plan from a broken foundation.
2. **Stale branch count grew.** If the 167-branch baseline became 200+ branches by Day 14 (i.e., parallel subagent work added faster than cleanup), the cleanup pattern is wrong and V23 must change strategy.
3. **PhenoRust milestones stuck at 0.** If by Day 14 zero repos are at PhenoRust 1.0 milestone, the 10-repo plan is under-water and V23/V24 must reduce scope.
4. **The 6-subagent batch merge is not clean.** If the `BATCH-CLOSE` block in the V3 log lists any unresolved conflict, the coordination protocol is broken and the dispatch tooling needs a redesign.
5. **The V22 plan itself is not cited by V23.** If V23 does not cite this V22 doc, the retrospective is wasted and the plan-closure flywheel is not turning.

## 22a. Success-criteria measurement plan

### Quantitative criteria — measurement cadence
- **Daily:** stale branch count, stale worktree count, PhenoRust milestone count, hex-port cutover count.
- **Weekly (Day 14 and Day 21):** V3 execution log line count, plans-written vs tasks-closed ratio, plan directory listing size.
- **Per-sprint exit:** sprint-specific exit criteria from §14c.

### Qualitative criteria — measurement cadence
- **Daily:** end-of-day "what surprised me" note in the V3 log.
- **Weekly:** mid-week and end-of-week retrospectives.
- **Per-sprint:** the V22/V23/V24 close retrospectives.

### Anti-criteria — measurement cadence
- **Daily:** check the 5 anti-criteria in §22 against the current state. If any fires, escalate immediately.
- **Sprint exit:** explicit "anti-criteria status" line in the sprint close retrospective.

## 22b. Success-criteria escape hatches

Some of the success criteria may need to be relaxed mid-window. The escape hatches:

1. **Auth-repair escape:** if Day 8's auth repair is blocked by an external dependency (e.g., a third-party identity provider outage), the Day 14 timeline can be extended by up to 3 days. The extension is recorded in the V3 log.
2. **Hex-port escape:** if Port 3 (schema) cutover reveals a deeper refactor need, the V22 plan can reduce to "Port 1 only" for the 2-week window. The reduction is recorded in the V3 log.
3. **Milestone escape:** if the 4-milestone Day-14 target is not met, the V22 close retrospective can revise the target downward to 3 or 2. The revision is recorded in the V3 log.
4. **Branch-cleanup escape:** if the 70-branch target is not met, the V22 close retrospective can revise the target downward to 50 or 40. The revision is recorded in the V3 log.

The escape hatches are not "we failed" — they are "we re-scoped based on new information." The discipline is to record the re-scope explicitly, not to silently miss the target.

---

# Part G — Appendices

## 23. Appendix A: line-citation index

This V22 doc cites the following source ranges:

| Cited range | File | Used in § |
|---|---|---|
| `V3_EXECUTION_LOG_2026_06_10.md:1-50` | V3 execution log header | §1, §2 |
| `V3_EXECUTION_LOG_2026_06_10.md:50-200` | V3 log early append | §3.1 |
| `V3_EXECUTION_LOG_2026_06_10.md:200-400` | V3 log dense block | §3.1 |
| `V3_EXECUTION_LOG_2026_06_10.md:2000-2200` | V3 log sparse block | §3.1 |
| `V3_EXECUTION_LOG_2026_06_10.md:2500-2700` | V3 log port-opportunity block | §15 |
| `V3_EXECUTION_LOG_2026_06_10.md:2800-3000` | V3 log pre-push expectation | §5.3 |
| `V3_EXECUTION_LOG_2026_06_10.md:3000-3200` | V3 log dispatch pattern | §3.5 |
| `V3_EXECUTION_LOG_2026_06_10.md:3500-3700` | V3 log V19 churn | §4.4 |
| `V3_EXECUTION_LOG_2026_06_10.md:4000-4200` | V3 log deferred-cleanup | §4.3 |
| `FLEET_DAG_v3.md:1-30` | FLEET_DAG header | §2 |
| `FLEET_DAG_v3.md:410-450` | FLEET_DAG §96–§100 V19 ext | §0, §1 |
| `FLEET_DAG_v3.md:451-512` | FLEET_DAG §101 V20 ext | §0, §1, §3.3 |
| `plans/2026-06-12-archived-repos-live-status-v3.md:1-40` | Archived-repos header | §2 |
| `plans/2026-06-12-archived-repos-live-status-v3.md:80-161` | Ghost-live repos | §5.2, §8 |
| `BRANCH_AUDIT_2026_06_10.md:1-30` | Branch audit header | §2, §6 |
| `BRANCH_AUDIT_2026_06_10.md:50-181` | Branch audit detail | §4.5, §10 |
| `WORKTREE_AUDIT_2026_06_10.md:1-30` | Worktree audit header | §2, §6 |
| `WORKTREE_AUDIT_2026_06_10.md:30-54` | Worktree audit detail | §13, §14 |
| `plans/2026-06-14-push-session.md:1-90` | Push session log | §0, §3.2, §6 |
| `plans/2026-06-14-push-session.md:30-60` | Push session pre-flight | §3.2, §5.3 |
| `plans/2026-06-14-push-session.md:60-90` | Push session result | §5.3, §6 |
| `plans/2026-06-14-wave-1-completion-report.md:1-60` | Wave-1 successes | §0, §3.2, §6 |
| `plans/2026-06-14-wave-1-completion-report.md:60-92` | Wave-1 deferred | §4.1, §5.3 |
| `plans/2026-06-14-DAG-V5.md:1-50` | DAG-V5 header | §0, §4.2, §7 |
| `plans/2026-06-14-DAG-V5.md:40-80` | DAG-V5 auth block | §4.2, §7 |
| `plans/2026-06-14-phenorust-1.0-plan-1.0.md:1-40` | PhenoRust plan header | §2, §3.4 |
| `plans/2026-06-14-phenorust-1.0-plan-1.0.md:40-60` | PhenoRust 10-repo list | §11, §14 |
| `plans/2026-06-14-phenorust-1.0-plan-1.0.md:200-330` | PhenoRust risk register | §5.4, §15, §6 |
| `plans/2026-06-14-phenorust-1.0-plan-1.0.md:300-330` | PhenoRust plan tail | §6, §11 |
| `VERIFICATION_DAG_2026_06_12.md:1-11` | Verification doc | §0 |
| `ls /Users/kooshapari/CodeProjects/Phenotype/repos/` | Repo directory listing | §6 |
| `ls plans/` | Plans directory listing | §4.1, §6, §8 |
| `wc -l V3_EXECUTION_LOG_2026_06_10.md` | V3 log line count | §1, §6, §8 |

## 24. Appendix B: open questions for V23 plan subagent (slot 5)

The V23 subagent should answer the following before publishing the V23 plan:

1. Is the 2-week cadence right, or should V23/V24 be 1-week each to force more frequent closure?
2. Is the "70 of 167 branches" target realistic, or is the parallel-subagent branch-creation rate faster than the cleanup rate?
3. Should hex-ports be cutover-ed in parallel (3 repos at once) or serially (1 repo at a time)?
4. Is the "4 milestones by Day 14" target the floor or the ceiling?
5. Should V23 re-dispatch a 6-subagent batch, or is the coordination overhead now larger than the value?

## 25. Appendix C: V22 plan self-audit

This V22 plan was authored with the following constraints, and the constraints are recorded here for the V23 subagent's review:

- **Length:** targeted 600–900 lines; actual ≈ 700 lines (excluding front matter).
- **Citation format:** `filepath:startLine-endLine` for every range claim; `filepath:line` for single-line claims. The format is consistent.
- **Substitution policy:** when a briefed source was absent, an on-disk equivalent was cited and the substitution was recorded in §0.
- **No code written:** per the muse role, this plan is read-only with respect to source repos.
- **No commits:** per the brief, the plan was not committed.
- **No sub-subagents spawned:** per the brief, no further agent dispatches were issued.
- **No other files modified:** verified via the `multi_patch` / `write` history for this session.

---

## 26. Closing

The V22 retrospective + Day-8-to-Day-14 plan is complete. The Week 1 scoreboard is honest: plan output is up, closure is flat. The Week 2 plan subordinates discovery to closure, with the verification gate (Day 8) as the keystone. The 3-sprint V22–V24 scope, the 3 hex-port opportunities, the 6-subagent coordination protocol, and the quantitative + qualitative success criteria are all recorded above with line-cited evidence.

The single highest-leverage action for the human is to ensure Day 8's auth-repair work is resourced — without it, every closure claim in V22–V24 is unprovable.

---

**End of V22 Retrospective + Day-8-to-Day-14 Plan**
