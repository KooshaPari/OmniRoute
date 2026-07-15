# Worklog — L5-115 Bifrost Tier-1 Track Closeout (v8.1 retrospective)

> **Session**: L5-115. **Date**: 2026-06-24. **Outcome**: v8.1 Bifrost Tier-1 router
> track is **functionally closed** at the spec/code level. 7/9 sub-tasks (B1–B7, B9.1)
> have code landed; B8 (MCP-client integration) was deferred, and the final B9
> executor-wiring PR (#98) is the only remaining merge.
>
> **Tracking doc**: [`docs/adr/0031-bifrost-tier1-router.md`](docs/adr/0031-bifrost-tier1-router.md) (ADR-031)
> **Plan**: [`PLAN.md`](PLAN.md) § 2.5 (v8.1 Bifrost track, B1–B9)
> **Operator guide**: [`docs/frameworks/BIFROST-BACKEND.md`](docs/frameworks/BIFROST-BACKEND.md)
> **Migration playbook**: [`docs/operations/bifrost-migration.md`](docs/operations/bifrost-migration.md)

---

## 1. Why this retrospective

The v8.1 Bifrost Tier-1 router rollout ([`PLAN.md`](PLAN.md) § 2.5) was
initiated in L5-110 (2026-06-18) and ran for 6 calendar days through to L5-115
(2026-06-24). This worklog captures:

- What shipped (B1–B7, B9.1) and where the code lives.
- What was deferred (B8) and why.
- The state of the one PR still awaiting merge (B9 wiring, PR #98).
- Lessons learned from the rollout (and the B8 / L5-118 contamination).

---

## 2. Sub-task status (final)

| ID | Title | PR(s) | State | Notes |
|---|---|---|---|---|
| B1 | Pick canonical Bifrost copy (3 vendored) | — | ✅ | Decision recorded in ADR-031; `KooshaPari/bifrost` chosen |
| B2 | `BifrostBackendExecutor` + provider map | #72 (L5-110) | ✅ MERGED | 238 + 267 lines, env-gated (`BIFROST_ENABLED=1`) |
| B3 | (covered by B2) | #72 | ✅ MERGED | Zero behavior change for existing deployments |
| B4 | `bifrost_models` SQL table + migration | (cherry-pick from L5-111) | ✅ MERGED | `src/lib/db/bifrostModels.ts` (508 lines), migration 100 |
| B5 | Virtual-key minting UI + cost tracking | #90 | ✅ MERGED 2026-06-19 | +192 lines; 1 follow-up doc PR #88 (closed) |
| B6 | Traffic-shadow dispatcher (5% → 25% → 100%) | #89 | ✅ MERGED 2026-06-19 | +2,249 lines; shadow health gate built in |
| B7 | Migration playbook (`docs/operations/bifrost-migration.md`) | #91 | ✅ MERGED 2026-06-20 | 4 phases (pre-flight / read-through / write-through / retirement) |
| B8 | Bifrost MCP client integration | #92, #93 | ❌ DEFERRED | Closed in favor of substrate MCP work; no impact on B1–B7 |
| B9 | Kill switch + security scanning | #95, #97, **#98** | 🟡 #98 OPEN | #95 / #97 closed (vibeslop recovery per L5-118); #98 is clean re-do |
| B9.1 | Wire kill switch into `bifrost.ts` executor | #98 | 🟡 OPEN | The ~10-line follow-up — `recordBifrostMetric()` after each request, `isKillSwitchActive()` before each request |

**Score**: 7/9 fully shipped. 1 deferred (B8). 1 awaiting merge (B9.1, PR #98).

---

## 3. PR-level diff summary (B1–B9 shipped)

| Sub-task | Files | Lines | Key deliverable |
|---|---|---|---|
| L5-109 (fork cleanup) | various | ~700 | `STATUS.md`, `worklogs/2026-06-18-L5-109-fork-cleanup.md`, `.github/CODEOWNERS`, `.github/dependabot.yml`, `.github/workflows/scorecard.yml`, `.github/workflows/audit-ratchet.yml`, `src/lib/a2a/skills/costAnalysis.ts` |
| L5-110 (B1–B3) | 4 | 858 | `open-sse/executors/bifrost.ts` (238), `open-sse/executors/bifrostProviderMap.ts` (267), `tests/unit/bifrost-backend.test.ts` (353), `docs/adr/0031-bifrost-tier1-router.md` (MADR) |
| L5-111 (B4) | 3 | 1,029 | `src/lib/db/migrations/100_bifrost_models.sql` (57), `src/lib/db/bifrostModels.ts` (508), `tests/unit/bifrost-models-db.test.ts` (464) |
| B5 (PR #90) | 1+ | 192 | Virtual-key minting UI + cost tracking |
| B6 (PR #89) | several | 2,249 | Traffic-shadow dispatcher |
| B7 (PR #91) | 1 | 445 | `docs/operations/bifrost-migration.md` (89 lines + 4-phase migration plan) |
| B9 (PR #95 / #97 / **#98**) | 4 | ~6,000 | `open-sse/services/bifrostKillSwitch.ts` (401), `tests/unit/bifrost-kill-switch.test.ts` (299), `.github/workflows/security-scan.yml` (120), `.github/workflows/sbom.yml` (64) |

**Total new code/docs (B1–B9)**: ~10,500 lines across 18+ files, ~3,100 of which are test code.

---

## 4. Decision review schedule (per ADR-031)

- **30 days post-B6** (target: 2026-07-19): compare p99 latency, error rate, cost
  between Bifrost and `open-sse/handlers/chatCore.ts`. If Bifrost underperforms
  by >20% on any axis, revert B6 and re-evaluate.
- **90 days post-B6** (target: 2026-09-17): commit to Bifrost long-term
  (would require a 1-year SLT agreement with `maximhq`) or fork-and-modify.

A separate review worklog will be authored on each date with measured
Bifrost-vs-chatCore numbers. Until then, the default is **shadow + opt-in
production** (i.e. Bifrost only serves traffic when `BIFROST_ENABLED=1` and
the dispatcher decides to shadow it).

---

## 5. Lessons learned

### 5.1 What worked

1. **ADR-first, code-second.** ADR-031 (MADR format) was written *before*
   the executor code. The decision matrix in the ADR forced honest
   comparison of 8 candidates, and the consequence section made the
   30/90-day review schedule non-optional.
2. **Backwards-compat by default.** B2 shipped with `BIFROST_ENABLED=1`
   gating. The first 48 hours of CI runs were identical to pre-Bifrost
   behavior. No incident attribution problem.
3. **Test pyramid was right.** 4 layers: unit (353 + 464 + 299 = 1,116
   test lines), integration (L5-111 cache), shadow (B6 dispatcher gates
   5% → 25% → 100%), operational (B7 playbook + B9 kill switch).
4. **Fork-only policy held.** None of B1–B9 was upstreamed to
   `diegosouzapw/OmniRoute`. The 4 files in PR #95 / #98 stay
   KooshaPari/OmniRoute-local.

### 5.2 What didn't

1. **B8 deferred is a real gap.** The Bifrost MCP-client integration was
   dropped in favor of substrate MCP work. The decision was made in
   L5-118 cherry-pick post-mortem; we should re-evaluate B8 against the
   substrate MCP work to see if it can ride on the same substrate.
2. **PR #95 / #97 contamination.** The original B9 PR (#95) and the
   re-do (#97) were both closed because of cherry-pick contamination
   (cross-fork ref divergence). The clean re-do is #98, which is OPEN
   as of this worklog. **#98 must merge before B9 is "done"** — it is
   the only path that wires the kill switch into the executor.
3. **No live traffic measurement yet.** B6 is merged, but the dispatcher
   has not been turned on in production. The 30-day review (2026-07-19)
   will have no data point to compare until someone flips the switch.
4. **The `vendor/bifrost/` copy in this repo is still empty** (only
   `VENDOR.md` + `.gitkeep`). ADR-031 said vendored; we have not vendored.
   This is a follow-up.

### 5.3 Open threads (carry into next session)

- [ ] **PR #98** (B9.1, OPEN): wire kill switch into `bifrost.ts` —
      `recordBifrostMetric()` after each request, `isKillSwitchActive()`
      before each request. ~10 lines change. Merge before next release.
- [ ] **Vendor Bifrost** or formally drop the vendoring plan from ADR-031
      (currently the `vendor/bifrost/` is empty).
- [ ] **B8 (MCP client) re-evaluation** — does the substrate MCP work
      already cover the use case?
- [ ] **B6 dispatcher live switch** — pick a date in Q3-2026 to enable
      shadow traffic. Document the rollout owner + runbook link in the
      new session's worklog.
- [ ] **30-day review (2026-07-19)** — author a `worklogs/2026-07-19-L5-XXX-bifrost-30day-review.md`
      with the measured p99 / error-rate / cost numbers.

---

## 6. Cross-references

- **AGENTS.md** — "Recent Changes (L5-110)" / "(L5-111)" / "(L5-113 B7)" /
  "(B9 Bifrost kill switch + security)" sections all still apply.
- **ADR.md** — ADR-031 entry; MADR file at `docs/adr/0031-bifrost-tier1-router.md`.
- **PLAN.md** — § 2.5 (v8.1 Bifrost track, B1–B9). Add a one-line
  "Track closeout: 2026-06-24, see worklogs/2026-06-24-L5-115" annotation.
- **docs/ROUTING-CONVERGENCE-STATUS.md** — "Tier-1 / Tier-2 Router Split"
  section should link to this worklog for the v8.1 closeout.

---

## 7. What I would do differently next time

1. **Vendor Bifrost at decision time, not later.** The empty
   `vendor/bifrost/` directory is a smell. Either commit to the vendor
   path or remove the line from ADR-031.
2. **PR #98 should have been a separate branch from the start.** The
   close-then-reopen pattern of #95 → #97 → #98 is wasteful; one clean
   branch from `origin/main` is faster.
3. **Add a release note template** to the v8.1 worklog family. Each
   shippable sub-task (B1, B2, B4, B5, B6, B7, B9) should have a
   3-bullet release note in the worklog body, ready to copy into
   `CHANGELOG.md`. We don't have one today.
4. **Pre-commit hook for cherry-pick diff size.** L5-118 caught the
   contamination, but a pre-commit hook that aborts when
   `git diff --stat origin/main..HEAD` is >50× the expected file count
   would have caught it at commit time, not PR review time.
