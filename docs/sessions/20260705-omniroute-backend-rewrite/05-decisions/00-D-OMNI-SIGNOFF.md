# D-omni Sign-off — OmniRoute Rust Rewrite Decisions

**Session:** 20260705-omniroute-backend-rewrite / 05-decisions
**Date:** 2026-07-05
**Sponsor:** user (directive: "do it all" — apply documented defaults)
**Mode:** Default-applied sign-off. Every decision below accepts the recommended default from the master synthesis and the 06-plan open-questions list.
**Author:** root agent (main thread, this session)

## Status

- **Decision package:** D-omni-01..10 (10 items)
- **Status:** SIGNED — all defaults applied per sponsor "do it all" directive (2026-07-05)
- **Canonical record:** this document. Subsequent PRs in the rewrite lane reference `D-omni-XX` by ID.
- **Re-open procedure:** any single decision may be re-opened with a sponsor directive of the form `D-omni-XX: <new-value>`. This document is amended in place; the prior value is struck through, not deleted (auditability).

## Sources of truth (cited)

- Master Synthesis — top-10 decisions table: `docs/sessions/20260705-omniroute-backend-rewrite/00-MASTER-SYNTHESIS.md:82-94`
- Plan — open questions for sponsor sign-off: `docs/sessions/20260705-omniroute-backend-rewrite/06-plan/00-PLAN.md:155-165`
- Plan — PR sequence affected by these decisions: `docs/sessions/20260705-omniroute-backend-rewrite/06-plan/00-PLAN.md:30-92`
- Plan — kill switch matrix: `docs/sessions/20260705-omniroute-backend-rewrite/06-plan/00-PLAN.md:120-127`
- Plan — risk gates: `docs/sessions/20260705-omniroute-backend-rewrite/06-plan/00-PLAN.md:107-117`
- Inventory: `docs/sessions/20260705-omniroute-backend-rewrite/01-inventory/00-INVENTORY.md`
- Language eval (D7 modification: pure-Rust): `docs/sessions/20260705-omniroute-backend-rewrite/02-language-eval/00-EVAL.md`
- Architecture survey: `docs/sessions/20260705-omniroute-backend-rewrite/03-architecture-research/00-SURVEY.md`
- Migration strategy (6 phases, 24 weeks): `docs/sessions/20260705-omniroute-backend-rewrite/04-migration-strategy/00-STRATEGY.md`
- Requirements (50+ FRs, 25+ NFRs): `docs/sessions/20260705-omniroute-backend-rewrite/05-requirements/00-REQUIREMENTS.md`

## Decisions (all 10)

| #         | Decision                                | Chosen value (default applied)          | Rationale                                                                                                                                                                                                                                                                                                                       | Affects                                                                                                      |
| --------- | --------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| D-omni-01 | Calendar start                          | **2026-08-01**                          | Default applied per master synthesis recommendation: lets the 3 background absorptions (authvault_cross_link_sweep, phenodag_absorption_spec_write, agent_phenodag) settle before Phase 0 begins. The earlier option (2026-07-15, immediate) was rejected.                                                                      | Calendar for PR-1..PR-31 (`06-plan/00-PLAN.md:30-92`); Phase 0 starts week of 2026-08-04 (calendar week 32). |
| D-omni-02 | Bifrost pivot in v1 or v1.5             | **v1.5**                                | Default applied. Bifrost pivot deferred; `omni-router` is the v1 placeholder. The `RouterPort` abstraction in `omni-core` (PR-1) decouples the v1/v1.5 swap per master synthesis risk R-omni-3. v1.5 work sequenced as B1-B9 in PLAN § 2.5; B1-B5 already in flight on the TS-fork lane.                                        | `omniroute-rust/crates/omni-router/` (placeholder), `pheno/bifrost/` (empty; separate session to scaffold).  |
| D-omni-03 | Provider count in v1                    | **30 (curated) + 119 deferred to v1.5** | Default applied. Curated set is the 5 core adapters in PR-9 (openai, anthropic, gemini, groq, mistral) plus 25 in PR-11..PR-13 (batches 1-3). The remaining 119 land in PR-23 (batch 6, weeks 13-16) per master synthesis:74. Risk R-omni-1 mitigated by parallelization across 4 agents.                                       | PR-9..PR-13 (v1 30), PR-23 (v1.5 remaining 119).                                                             |
| D-omni-04 | Postgres in v1                          | **no — SQLite-only**                    | Default applied. `sqlx` with SQLite for v1; matches the existing TS-fork SQLite foundation (`src/lib/db/core.ts`). Postgres deferred to v2. Eliminates the dual-DB migration risk during the strangler-fig window (R-omni-2).                                                                                                   | PR-4 (`omni-storage`); the 80 SQL migrations from `src/lib/db/*.sql` are ported 1:1.                         |
| D-omni-05 | Chaos engineering in scope              | **yes**                                 | Default applied. PR-15 (Phase 2, week 9) delivers chaos scripts (latency injection, error injection, kill provider) using `arbitrary` (new dep) and `proptest` (already there) per `06-plan/00-PLAN.md:137`. Chaos runs are bounded by the 0.5% divergence threshold — if a chaos run causes divergence > 0.5%, the run aborts. | PR-15 (`scripts/`, `omni-router/`); adds `arbitrary` to `omniroute-rust/Cargo.toml`.                         |
| D-omni-06 | i18n (42 locales) in v1                 | **no — v1.5**                           | Default applied. The 42-locale i18n surface (`src/i18n/messages/*.json`) is TS-fork scope; not in any v1 PR. i18n deferred to v1.5 once the Rust HTTP server surface stabilizes.                                                                                                                                                | No v1 PR. v1.5 deferred (no PR-N yet).                                                                       |
| D-omni-07 | tproxy native module in scope           | **no — v2**                             | Default applied. tproxy is the transparent-proxy native module; deferring eliminates a Linux-only FFI surface from the v1 critical path.                                                                                                                                                                                        | No v1 PR. v2 deferred.                                                                                       |
| D-omni-08 | OpenCode plugin as first-class consumer | **yes — lock contract in PR-2**         | Default applied. PR-2 (Phase 0, week 1) locks the `/v1/models` wire shape via a doc-only PR plus a TS plugin smoke test, BEFORE any provider work in PR-9+. Mitigates R-omni-4 (plugin break on model-shape change).                                                                                                            | PR-2 (doc-only) and downstream consumer tests in PR-28 (`omni-sdk`).                                         |
| D-omni-09 | TUI + tray in CLI                       | **yes — ratatui + tao**                 | Default applied. PR-27 (Phase 3, weeks 16-18) ports the 81 CLI subcommands + 32 api-commands with `ratatui` + `tao` + `tray-icon` (all new deps per `06-plan/00-PLAN.md:142`).                                                                                                                                                  | PR-27 (`omni-cli/`); adds 3 new deps to `omniroute-rust/Cargo.toml`.                                         |
| D-omni-10 | Weekly standup cadence                  | **weekly**                              | Default applied. Sponsor-facing weekly sync during the 24-week rewrite. Format: written status update at the start of each week plus a 30-min walkthrough if needed. Replaces ad-hoc check-ins.                                                                                                                                 | Process; not a code PR. Calendar: every Monday, week of 2026-08-03 onwards.                                  |

## What this means for each PR lane

| Phase                                      | Weeks | Calendar                | PRs            | Decisions that gate this phase                                                              |
| ------------------------------------------ | ----- | ----------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| Phase 0 — Foundation + Shadow              | 1-4   | 2026-08-03 → 2026-08-30 | PR-1..PR-7     | D-omni-01 (start), D-omni-04 (SQLite foundation in PR-4), D-omni-08 (contract lock in PR-2) |
| Phase 1 — Per-tenant canary + 30 providers | 5-8   | 2026-08-31 → 2026-09-27 | PR-8..PR-14    | D-omni-03 (curated 30 in PR-9..PR-13)                                                       |
| Phase 2 — Per-model + chaos + 50 more      | 9-12  | 2026-09-28 → 2026-10-25 | PR-15..PR-22   | D-omni-05 (chaos in PR-15)                                                                  |
| Phase 3 — Weighted cutover + final 70      | 13-18 | 2026-10-26 → 2026-12-06 | PR-23..PR-29   | D-omni-03 (final 119 in PR-23), D-omni-09 (ratatui/tao in PR-27)                            |
| Phase 4 — Full cutover + ops               | 19-22 | 2026-12-07 → 2027-01-03 | PR-30a..PR-30c | D-omni-10 (weekly cadence review each Monday)                                               |
| Phase 5 — Decommission                     | 23-24 | 2027-01-04 → 2027-01-17 | PR-31          | D-omni-06 / D-omni-07 confirmed not in v1 scope                                             |

Calendar is derived from D-omni-01 (start 2026-08-01) plus the 24-week schedule in `06-plan/00-PLAN.md:93-103`.

## Items explicitly OUT of v1 scope (deferred)

- **D-omni-02 (Bifrost pivot)** → v1.5, sequenced as B6-B9 of the v8.1 plan. `pheno/bifrost/` is empty on disk; coordinate with pheno owner on scaffold owner/date.
- **D-omni-03 (remaining 119 providers)** → v1.5, PR-23 (batch 6, weeks 13-16).
- **D-omni-06 (i18n 42 locales)** → v1.5, no PR-N assigned yet.
- **D-omni-07 (tproxy native module)** → v2.
- **D-omni-04 (Postgres)** → v2.

## Cross-project impact

- `pheno/bifrost/` — empty crate; scaffolding is **NOT** in root scope of this session. Master synthesis:131 flags this as a coordination gap. The v1.5 pivot (D-omni-02) is gated on the bifrost crate being ready.
- `pheno/crates/phenotype-*` — 67 crates already referenced in `omniroute-rust/Cargo.toml`. None of those crate interfaces change as a result of these decisions.
- TS fork (`src/`, `open-sse/`) — stays running through Phase 5 per master synthesis:119. No TS-side changes required by these decisions; the TS fork continues its own independent ops lane.
- Electron desktop + OpenCode plugin + raw HTTP clients — D-omni-08 means the OpenCode plugin contract is locked in PR-2; consumer integrations are unaffected at v1.

## Tracking

- This document IS the canonical sign-off record (per the non-negotiable "do not create files unless necessary" rule, no separate GitHub issue is opened in this read-only audit session).
- A tracking entry is propagated to the user-level session index by the parent orchestrator when the OmniRoute lane moves from audit to execution.
- Each future PR body in the rewrite worktree must reference the relevant `D-omni-XX` ID(s) in the "Decisions gated" section of the PR template.

## Re-open log

| Date | Decision | Old value | New value | Sponsor directive |
| ---- | -------- | --------- | --------- | ----------------- |
| —    | —        | —         | —         | (none yet)        |

## Sign-off record

- **Sponsor directive:** 2026-07-05 (this turn) — "do it all" (apply documented defaults).
- **Recorded by:** root agent, main thread, session `20260705-omniroute-backend-rewrite`.
- **Authority:** Sponsorship of the OmniRoute Rust rewrite lane, per master synthesis session header at `docs/sessions/20260705-omniroute-backend-rewrite/00-MASTER-SYNTHESIS.md:1-6`.
- **Audit posture:** read-only audit per master synthesis:33 (`0 code changes, 0 commits, 0 PRs opened`). This document is the gate-clearance artifact that unblocks PR-1.
