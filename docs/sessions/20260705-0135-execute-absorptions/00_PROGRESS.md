# Absorption Execution Progress -- 2026-07-05

Status: PROPOSALS WRITTEN, NOT YET APPLIED. The parent agent (or sponsor)
must apply each proposal in `proposals/` per the controlled step. No code
or README has been modified by this audit.

| Action | Repo / Path | Local change | Pushed | Archived (GH) | Notes |
|---|---|---|---|---|---|
| archive banner | `phenotype-apps/AtomsBot/README.md` | already present | n/a | pending gh auth | confirmed in 04-ARCHIVE-PLAN.md |
| archive banner | `phenotype-apps/AtomsBot-2nd..5th/README.md` | PROPOSED in `proposals/PROPOSED_BANNER_ATOMSBOT_NTH.md` | no | n/a | dirs currently empty; banner copy from canonical |
| archive banner | `KaskMan/README.md` | already present | n/a | pending gh auth | confirmed |
| archive banner | `phenotype-apps/GDK/README.md` | already present | n/a | pending gh auth | confirmed; has the full kill-switch body |
| spine charter | `phenotype-apps/README.md` | PROPOSED in `proposals/PROPOSED_CHARTER_phenotype_apps.md` | no | n/a | insert after AI-DD-META block |
| spine charter | `phenotype-org-audits/README.md` | PROPOSED in `proposals/PROPOSED_CHARTER_phenotype_org_audits.md` | no | n/a | insert after AI-DD-META block |
| Authvault final | `Authvault/CHANGELOG.md` | PROPOSED in `proposals/PROPOSED_AUTHVAULT_FINAL_TAG.md` | no | pending gh web-UI archive | tag `authvault-final` |
| AuthKit migration guide | `AuthKit/migrations/from-authvault.md` | not started | no | n/a | separate PR inside AuthKit |
| AtomsBot/GDK/KaskMan GH archive | KooshaPari/AtomsBot + GDK + KaskMan | n/a | n/a | BLOCKED -- no gh auth in this session | requires `gh` CLI auth + web UI |

## What's done (before this audit, by prior sessions)

- 6 root-level audit/plan docs: `01-AUTH-TRIAGE.md`, `02-ORG-AUDITS-PLAN.md`,
  `03-APPS-PLAN.md`, `04-ARCHIVE-PLAN.md`, `05-MIGRATION-CHECKLIST.md`,
  `06-RISKS-AND-OPEN-QUESTIONS.md`.
- 4 proposals (this session): banner for AtomsBot-Nth, charters for the two
  spines, Authvault final CHANGELOG.
- Local verification: confirmed GDK/KaskMan/AtomsBot banner text byte-exact
  matches the canonical 04-ARCHIVE-PLAN.md template.

## What's NOT done (and the precise blocker)

- GitHub archive flag: requires `gh auth status` to show authenticated;
  this session does not have a `gh` token. See `01_BLOCKERS.md`.
- Authvault tag push: requires the same.
- Phenotype-apps push of the spine-charter commit: requires the user to
  confirm the active branch (`apps-extract` per the audit; verify).
- Phase 3b prune of `*-Nth` duplicates: gated on apps-extract branch
  coordination. Defer per 06-RISKS-AND-OPEN-QUESTIONS.md R-6.
