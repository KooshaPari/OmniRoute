# Phenodag Absorption — PR Status Audit

**Session:** 20260705-0135-execute-absorptions / L3 + L4
**Author:** root (manager)
**Date:** 2026-07-05 07:57Z
**Mode:** read-only audit; no PR comments; no merges (sponsor gate)

---

## Top bracket

```
[phenodag absorption 5/5 PRs OPEN | 3 MERGEABLE (F, H, L) | 2 CONFLICTING (G, E) |
 spec-008 58-line contract at AgilePlus/docs/specs/008-phenodag-absorption.md |
 7 FRs (AP-PHENO-001..007) | 6 phases (P1-P6) over 2-3 weeks |
 sponsor D3 = YES (thin redirector 1 release, then archive phenodag)]
```

## PR table (verified via `gh pr view` at 2026-07-05 07:57Z)

| # | PR | Title | State | Mergeable | Files | Add/Del | Spec-008 alignment | Risk |
|---|---|---|---|---|---|---|---|---|
| F | Tracera#723 | spec: spec 008 (Tracera) | OPEN | **MERGEABLE** | 1 (spec doc) | +62/-0 | writes `docs/specs/008-phenodag-absorption.md` (62 lines) | low (docs) |
| H | Tracera#725 | feat(spec-008-P1): port phenodag atomic claim + heartbeat + lifecycle | OPEN | **MERGEABLE** | 7 | +595/-0 | P1 implementation: claim.rs (140), heartbeat.rs (171), lifecycle.rs (231), migration SQL (31), main.rs (1), Cargo.toml (1), mod.rs (20) | medium (new SQLite migration) |
| L | Tracera#726 | feat(spec-008-P2): port phenodag dedup + sqlite + scanner + export + beads + status + init | OPEN | **MERGEABLE** | 8 | n/a | P2 implementation: dedup.rs (91), scanner.rs (66), export.rs (47), init.rs (60), status.rs (42), sqlite_init.rs (43), beads_compat.rs (43), mod.rs (+17/-11) | medium (depends on H) |
| G | AgilePlus#895 | spec: absorb phenodag PM/cockpit concerns (presets, dashboard, commits) into AgilePlus spec 008 | OPEN | **CONFLICTING** | 6 | +577/-42 | spec + cockpit wiring for AgilePlus (5 dashboard files + .gitignore) | medium (conflicts must resolve) |
| E | phenodag#29 | docs: thin redirector — phenodag absorbed into Tracera + AgilePlus | OPEN | **CONFLICTING** | 2 (CHANGELOG.md, README.md) | +10/-1 + +33/-133 | the redirector; 1 release then archive | low (docs only) |

## Spec-008 (the contract)

`AgilePlus/docs/specs/008-phenodag-absorption.md` (58 lines) is the PM/cockpit/portfolio
side. The Tracera spec-008 (the DAG/queue/atomic-claim/lease/dedup side) lives in
Tracera/docs/specs/008-phenodag-absorption.md (added in Tracera#723).

7 FRs split across the two repos:
- **AP-PHENO-001..007 → AgilePlus** (YAML preset loader, 4 corpora, fill, multi-project dashboard, conventional commits, branch hygiene, cross-repo fleet inventory)
- **DAG/queue/claim/lease/dedup → Tracera** (claim.rs, heartbeat.rs, lifecycle.rs in P1; dedup, scanner, export, init, status, sqlite_init, beads_compat in P2)

6 phases total over 2-3 weeks (5-8 PRs).

## Recommended merge order (lowest-risk first)

1. **Tracera#723** (the Tracera spec doc). MERGEABLE. Pure docs. Land first so the
   P1 PR has a spec reference.
2. **AgilePlus#895** (the AgilePlus spec + cockpit wiring). CONFLICTING. Resolve the
   conflict (likely a stale main after the recent merges like #893). The 5 dashboard
   files are real wiring; should not auto-merge without sponsor sign-off.
3. **Tracera#725** (P1 implementation). MERGEABLE. Depends on #723. 595 lines added
   across 7 files; new SQLite migration (0006_spec_008_phenodag_queue.sql) is the
   one risk — review the SQL before merging.
4. **Tracera#726** (P2 implementation). MERGEABLE. Depends on #725. 8 files in
   tracera-server/src/queue/; the new queue submodules are bounded (≤250 lines
   each, per AGENTS.md).
5. **phenodag#29** (the redirector). CONFLICTING. Resolve (docs only; likely a
   stale CHANGELOG). Land LAST so the redirector points at the merged spec-008
   in both Tracera and AgilePlus.

## Spec-008 compliance matrix

| FR | Target | PR covering it | Status |
|---|---|---|---|
| AP-PHENO-001 (YAML preset loader) | AgilePlus | #895 | spec only, not yet implemented |
| AP-PHENO-002 (4 corpora) | AgilePlus | #895 | spec only, not yet implemented |
| AP-PHENO-003 (fill) | AgilePlus | (gap) | spec only |
| AP-PHENO-004 (multi-project dashboard) | AgilePlus | #895 | spec + dashboard wiring, not yet the view |
| AP-PHENO-005 (conventional commits) | AgilePlus | (gap) | spec only |
| AP-PHENO-006 (branch hygiene) | AgilePlus | (gap) | spec only |
| AP-PHENO-007 (cross-repo fleet inventory) | AgilePlus | (gap) | spec only |
| DAG / queue / claim / heartbeat / lifecycle | Tracera | #725 | **implemented (P1)** |
| dedup / scanner / export / beads / status / init / sqlite | Tracera | #726 | **implemented (P2)** |

Coverage: Tracera side is fully implemented (P1 + P2 ready to merge).
AgilePlus side has the spec + cockpit wiring but the actual presets/fill/dashboard/commits
code is not yet written (the 5-8 PR roadmap from the spec doc).

## Risks

- **R-1** AgilePlus#895 conflict is on a 6-file PR with 577 additions. Rebase cost
  is non-trivial; expect 30-60 min of work to land cleanly.
- **R-2** Tracera#725 introduces a new SQLite migration (0006). The migration must
  be tested against an existing Tracera DB to confirm no conflicts with the
  existing migrations (0001-0005). Recommend a migration dry-run before merge.
- **R-3** phenodag#29 redirector must point at the MERGED spec-008 PRs in both
  Tracera and AgilePlus. Land it last, after F+H+L+G land.
- **R-4** The Tracera P2 PR (L) adds 8 new files. None is over 250 lines so AGENTS.md
  is satisfied, but the combined queue/ module is now substantial; future PRs
  should resist adding more.
- **R-5** The AgilePlus spec 008 lists AP-PHENO-005/006/007 as "new" work that
  didn't exist in phenodag. These are not absorptions; they are new features that
  the spec promises. Sponsor should confirm these are wanted before code lands.

## Open questions for sponsor

1. **AgilePlus#895 conflict resolution path.** Auto-rebase via the bot, or
   manual review? The PR has 5 dashboard files which is real wiring.
2. **Tracera#725 migration 0006.** Is the spec-008 queue table going to be
   added to fresh Tracera installs only, or is there a backfill plan for
   existing installs?
3. **AP-PHENO-005/006/007 (conventional commits, branch hygiene, cross-repo
   fleet inventory).** These are NEW features, not absorptions. Confirm they
   are wanted before any coding PRs land on the AgilePlus side.
4. **phenodag redirector timing.** Sponsor D3 = "thin redirector for 1 release,
   then archive". When is "1 release" — when Tracera#725 + #726 are merged?
   Or after a specific Phenotype release tag?
5. **DAG/queue/claim migration parity.** The Tracera#725 PR is `+595/-0`; this
   is a substantial behavioral port. Has the Tracera team reviewed the
   claim/heartbeat/lifecycle semantics against the original phenodag Go code?

## What I did NOT do

- I did not comment on any PR. Comments require sponsor sign-off per the
  migration checklist.
- I did not auto-merge anything. All 5 PRs are sponsor-gated.
- I did not run the new SQLite migration (0006) against a test DB.
- I did not resolve the 2 conflicts (AgilePlus#895, phenodag#29) — those
  require the PR author's intent to be preserved.

## Out of scope (deferred)

- The OmniRoute Rust rewrite (separate lane, NOT in this audit's scope).
- The 13 PRs from the polyrepo-portfolio-strategy session (already covered
  by the prior master synthesis at 20260705-fork-reqwrite-audit).
- The byteport absorption (L2 is DONE; see L2-byteport-absorption-SPEC.md).

---

**End of audit.** Awaiting sponsor decision on the 5 questions above
before any merge or rebase work proceeds.
