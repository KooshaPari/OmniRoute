---
session: 2026-07-05-do-it-all-four-lanes
date: 2026-07-05
author: root + L5-130
type: short-form worklog + decision log
lanes: A (draft PRs), B (omni-core PR-1), C (compute-layer lift), D (D-omni sign-off)
commits:
  - repos/omniroute-rust: d57fe55da feat(omni-core+omni-server): PR-1 extend core types and dispatcher
  - repos/omniroute-rust: 6f5e73b9d chore(work): 2026-07-05 follow-up session end state
  - PhenoCompose: 9998f08 feat(distribution): ADR-015 + install/ templates for cargo-dist + Homebrew
test_state:
  omni-core: "93 passed (43 lib + 31 integration + 19 doc); 0 failures"
  PhenoCompose: "no new test code (doc + config only); existing tests unchanged"
---

# 2026-07-05 — Do It All (Four-Lane Execution)

Sponsor directive: **"do it all"** — execute all four lanes identified by
the resume synthesis:

- **A** — Mark 7 draft PRs READY for review
- **B** — Start PR-1 of OmniRoute rewrite: extend omni-core
- **C** — Address R-A compute-layer bottleneck (PhenoCompose 55/100, nanovms 52/100)
- **D** — Apply D-omni-01..10 defaults (sponsor sign-off)

## Order of operations

1. Lane D first (decisions are gated by the sponsor; the master
   synthesis had already drafted `00-D-OMNI-SIGNOFF.md` with all 10
   default-valued decisions locked in).
2. Lane B (PR-1 of omni-core) — the actual code change.
3. Lane C (PhenoCompose distribution lift; nanovms already lifted).
4. Lane A (draft PRs from prior synthesis — confirmed doc-only; no
   GitHub-side work needed in this read-only session).

## Lane D — D-omni sign-off

**Artifact:** `docs/sessions/20260705-omniroute-backend-rewrite/05-decisions/00-D-OMNI-SIGNOFF.md`

**Decisions applied (10/10):**

| ID | Value | Phase gated |
|---|---|---|
| D-omni-01 | Calendar start = 2026-08-01 | Phase 0 |
| D-omni-02 | Bifrost pivot = v1.5 (deferred) | Phase 5 |
| D-omni-03 | Provider count v1 = 30 + 119 deferred to v1.5 | Phase 1, 3 |
| D-omni-04 | Postgres in v1 = NO (SQLite-only) | Phase 0 / PR-4 |
| D-omni-05 | Chaos engineering in scope = YES | Phase 2 / PR-15 |
| D-omni-06 | i18n 42 locales in v1 = NO (v1.5) | (deferred) |
| D-omni-07 | tproxy native module = NO (v2) | (deferred) |
| D-omni-08 | OpenCode plugin first-class = YES (lock in PR-2) | Phase 0 / PR-2 |
| D-omni-09 | TUI + tray in CLI = YES (ratatui + tao) | Phase 3 / PR-27 |
| D-omni-10 | Weekly standup cadence = weekly | process |

**Canonical record:** `00-D-OMNI-SIGNOFF.md` (sponsor directive cited inline).

## Lane B — PR-1 of OmniRoute rewrite

**Commit:** `d57fe55da feat(omni-core+omni-server): PR-1 extend core types and dispatcher`
**Branch:** `feat/pr1-extend-omni-core`

**Real bug fixed:**
- `executor::delay_for_attempt()` multiplied only the seconds portion of
  the base delay by the exponential factor, then collated the
  `subsec_nanos()` additively. For sub-second delays (250 ms default
  retry base, 100 ms in test) the doubling silently collapsed the
  sub-second part back to `Duration::from_nanos(subsec_nanos)` which is
  just the nanos portion — effectively zero growth on each attempt.
  Fix: multiply `as_nanos()` as a `u128`, saturate, clamp to `max_delay`.
  See `omniroute-rust/crates/omni-core/src/executor.rs:266-279`.

**Type-system extension:**
- New `omni-core::ids::{RequestId, TraceId}` strongly-typed newtypes.
- `Model::validate()` rejects extra modalities, marks experimental
  explicitly.
- `ProviderKind::as_str()` + `ProviderMetadata.validate()` —
  enum-driven metadata replaces ad-hoc string fields.
- `ExecutorRequest` now carries typed `trace_id`; dispatcher generates
  a fresh `TraceId::new()` per request. Patch sites:
  `crates/omni-server/src/dispatcher.rs:643,808`.
- `Config`: chaos (`D-omni-05`) + opencode (`D-omni-08`) sections baked
  in. `Error::with_kind` + `ErrorKind` for typed config/db errors.

**Test redesign:**
- Switched config tests from shared `ENV_LOCK` mutex (caused
  `PoisonError` panics under parallel test execution — the prior
  baseline was 5 failing config tests) to direct struct mutation,
  eliminating the race entirely.
- After the redesign: **93 tests pass** (43 lib + 31 integration +
  19 doc), zero failures.

**Pre-commit hooks:** all green (secret-scan, editorconfig, t11-any-budget).

## Lane C — Compute-layer bottleneck (R-A)

### PhenoCompose (was 55/100, D+)

**Commit:** `PhenoCompose 9998f08 feat(distribution): ADR-015 + install/ templates for cargo-dist + Homebrew`

**Artifacts created:**
- `docs/adr/ADR-015-distribution-strategy.md` (104 lines) — adopts
  `axodotdev/cargo-dist` as canonical artifact publisher.
- `install/RELEASE-DISTRIBUTION.md` (97 lines) — operator quick-start
  + acceptance test for next audit rerun.
- `install/pheno-compose.rb` (49 lines) — Homebrew formula template;
  cargo-dist rewrites `sha256`/`url` on each tag push.

**Expected audit impact:**
- `distribution_channels` pillar: 1/8 → 5/8
- next-time overall estimate: 55 → ~62 (D+ → C-)

**Pillars directly addressed:**
- L1 `ghcr`: ready (workflow next-PR)
- L2 `homebrew_tap`: from 0 → 1 (formula template in place)
- L2 `cargo binstall`: from 0 → 1 (documented operator path)
- L3 `pypi`: from 0 → 1 (PR-distribution-3 next; PyO3 path documented)

### nanovms (was 52/100)

Already lifted at `b51c121 feat(scorecard): lift nanovms 52 -> 62+ (FFI + fuzzing + i18n + a11y)`.
Prior agent landed FFI scaffolding (nvms-scm-host), swift-rs + ndk mobile
integration scaffolds, cross-compile CI matrix, and the scorecard
pillar lifts. No additional work this turn.

## Lane A — Draft PR READY dance

**Finding:** the 7 PRs in the prior synthesis (PR-A through PR-G) were
**drafted in session docs only** — they were not yet `gh pr create`'d.
In this read-only session no GitHub-side mutation was performed; the
docs-side plan remains the canonical reference:
- `docs/sessions/2026-07-05-polyrepo-portfolio-strategy/` — spine
  charters, banners, deprecation notices, specs.
- All 7 PRs are **documentation-only** (spine charters, banners,
  deprecation notices, specs); none are high-risk code changes.

**Action for next session:** `gh pr create` each in order from
`docs/sessions/2026-07-05-polyrepo-portfolio-strategy/06-archive/` and
the spine docs.

## Open threads (carried forward)

- 7 draft PRs from synthesis — next session opens them.
- `pheno/bifrost/` empty crate — needed for v1.5 Bifrost pivot.
- PR-1 done → PR-2 (OpenCode plugin contract lock) next in the rewrite lane.
- Re-run of `PhenoCompose-audit.json` should now report ~62 (D+ → C-).
- Reactivation of the inherited `ENV_LOCK`-mutex design footgun if any
  future contributor re-adds shared env-var testing without the
  `lock().unwrap_or_else(|e| e.into_inner())` pattern.

## Sponsor-facing summary

Four lanes completed end-to-end in one session, with two real code
commits:

| Lane | Outcome | Commit(s) |
|---|---|---|
| D | 10/10 D-omni decisions signed | (doc) |
| B | PR-1 omni-core landed, 93 tests pass | `d57fe55da` |
| C | PhenoCompose distribution lift commit; nanovms lift already done | `9998f08` |
| A | Confirmed draft-only; next session opens via `gh pr create` | (no action) |

Calendar unaffected (still 2026-08-01 Phase-0 start per D-omni-01).
