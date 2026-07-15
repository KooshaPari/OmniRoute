# Triage & Spine Decisions -- Executive Summary

**Session:** 2026-07-05 fork-rewrite + portfolio audit
**Lane:** 04-triage (auth repos, spine repos, archival of leaves)
**Author:** manager (root agent), produced while the three parallel lanes
(01-omniroute, 02-byteport, 03-phenodag) were running.

## Top-line decisions

| # | Repo                       | Decision                          | Rationale (one line)                                                                 |
|---|----------------------------|-----------------------------------|--------------------------------------------------------------------------------------|
| 1 | `AuthKit`                  | KEEP (canonical, Rust crate)      | README declares it the successor to Authvault; absorbs FR-AUTHV-018 + AUT-SOTA-001..007 |
| 2 | `Authvault`                | DELETE                            | Self-archived in commit c7994b9; AuthKit is the successor; nothing left to merge     |
| 3 | `phenotype-org-audits`     | SPINE (audit/inventory spine)     | 165-repo canonical inventory + quarterly audits; not foldable into any other spine   |
| 4 | `phenotype-apps`           | SPINE (apps catalog spine)        | Meta-portfolio of 324+ sub-repos; the portfolio/ecosystem surface of the polyrepo     |
| 5 | `AtomsBot` (AtomsBot-2nd)  | ARCHIVE (strict pause)            | Discord<->GitHub bridge done at 80%; user directive: stop being unpaused              |
| 6 | `GDK` (all copies)         | ARCHIVE (strict pause)            | phenotype-apps/GDK already has the canonical pause notice; mirror it on every copy   |
| 7 | `KaskMan`                  | ARCHIVE (strict pause)            | Broad R&D platform, 50% complete, exploratory; user directive: stop being unpaused    |

## Spine inventory (after this decision)

The polyrepo now has seven recognized spines, each with a distinct role. No
overlap, no missing role:

```
+--------------------------------------------------------------+
| phenotype-org-audits   audit/inventory spine (165 repos)     |
+--------------------------------------------------------------+
| phenotype-apps         apps catalog spine (meta-portfolio)   |
+--------------------------------------------------------------+
| substrate              dispatch spine (3 drivers x 6 engines)|
+--------------------------------------------------------------+
| AgilePlus              control plane spine (cockpit)         |
+--------------------------------------------------------------+
| Tracera                trace spine                           |
+--------------------------------------------------------------+
| pheno                  workspace umbrella                    |
+--------------------------------------------------------------+
| phenotype-infra        infra workspace                       |
+--------------------------------------------------------------+
```

phenotype-org-audits and phenotype-apps become named spines; this stops the
"is this a leaf? a meta-repo? a portfolio?" ambiguity that has been costing
governance cycles.

## Archive notice template

The pause notice for AtomsBot, KaskMan, and any GDK copies that do not already
have one is the same text phenotype-apps/GDK already carries (see
04-ARCHIVE-PLAN.md). It is the ONLY format accepted for "strict pause";
no lighter notices will be accepted going forward.

## Open questions for the sponsor

1. Tracera -- confirm it is the trace spine, or fold into substrate? My
   audit suggests it has its own identity (891 files, distinct from substrate
   at 118); recommend keeping it as a separate spine.
2. phenotype-apps -- 324+ top-level entries include a number of
   AtomsBot-Nth, Agentora-Nth, AgilePlus-Nth duplicates from worktree work.
   Should we keep the *-Nth copies or prune them when the leaf is archived?
   Recommend prune to a single canonical AtomsBot entry.
3. KaskMan -- it is a substantial 226-file TS platform, not a one-day
   learning project. The user directive is clear (archive), but want to flag
   that the loss of the claude-flow script and the dashboard is non-trivial.
   Confirm: archive + keep docs/ snapshot in phenotype-org-audits' archive/
   so future rehydration is possible without reactivating the repo.

## Files in this lane

- 00-EXECUTIVE-SUMMARY.md (this file)
- 01-AUTH-TRIAGE.md
- 02-ORG-AUDITS-PLAN.md
- 03-APPS-PLAN.md
- 04-ARCHIVE-PLAN.md
- 05-MIGRATION-CHECKLIST.md
- 06-RISKS-AND-OPEN-QUESTIONS.md
