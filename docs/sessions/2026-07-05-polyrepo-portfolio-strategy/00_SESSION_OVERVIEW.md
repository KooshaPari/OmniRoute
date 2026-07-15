# Polyrepo Portfolio Strategy -- Session 2026-07-05 (UPDATED)

**Date:** 2026-07-05 03:13 UTC
**Owner:** root (manager mode)
**Scope (CORRECTED):** Absorptions + spines + archives ONLY. NOT BytePort, NOT OmniRoute.

---

## Sponsor corrections (read this first)

> "both is part of an inherently robust internal sub ecosystem and the one
> around it; you do not own byteport nor omniroute, solely the absorptions."

**Implications:**
- I do not own BytePort or OmniRoute. They have their own owners / robust
  internal sub-ecosystems.
- My lane is **absorptions only**:
  - Phenodag -> Tracera / AgilePlus (spec-level absorption, then delete phenodag)
  - Authvault -> AuthKit (delete Authvault)
  - Spines: phenotype-org-audits, phenotype-apps
  - Archives: AtomsBot / GDK / Kaskman
- BytePort scope and OmniRoute rewrite are **downstream** -- they happen
  after the absorption work is done, and they are owned by whoever owns
  those repos, not by me.

---

## Sponsor decisions on D1-D6 (transcribed)

| # | Decision | Sponsor response |
|---|----------|------------------|
| 1 | D1 KEEP AuthKit, DELETE Authvault | **YES** |
| 2 | D5 Byteport scope: Surface only, or Surface + identity? | **BOTH** (Surface + identity) but AFTER absorption works done |
| 3 | D6 Phenodag deletion: hard-archive or thin redirector? | **YES to redirector** (thin redirector for 1 release, then archive) |
| 4 | D7 OmniRoute language split | same as #2 (BOTH but AFTER absorptions) |
| 5 | D8 Migration start | **YES** start P0-P3 today, **SKIP OmniRoute work** until after #6 (subagent quota) |
| 6 | D? Subagent quota (let all 3 finish, or interrupt?) | default: let all 3 finish |

---

## Lanes (UPDATED to corrected scope)

| # | Lane | Repo | Owner | Status |
|---|------|------|-------|--------|
| 1 | Authvault absorption (D1) | repos/Authvault -> repos/AuthKit | root | DONE this turn |
| 2 | Phenodag absorption (D3 yes-redirector) | repos/phenodag -> Tracera/AgilePlus | subagent (deep) | 80% done, FR map ready |
| 3 | phenotype-org-audits spine (D2) | repos/phenotype-org-audits | root | DONE this turn |
| 4 | phenotype-apps spine (D2) | repos/phenotype-apps | root | DONE this turn |
| 5 | AtomsBot / GDK / Kaskman archive (D4) | subdirs of phenotype-apps/ | root | DONE this turn (7 banners placed) |
| 6 | Subagent quota resolution | - | root | interrupt OmniRoute, free slot for research |

**Not in my lane (corrected):**
- BytePort (owned elsewhere; my interaction limited to using it as a Surface
  once it's expanded with identity post-absorptions)
- OmniRoute (owned elsewhere; no rewrite work from me, no migration planning
  for P4)

---

## What happens next (auto, no sponsor action needed)

1. Interrupt /root/omniroute_audit_plan -- I don't own OmniRoute, the audit
   is over budget, free the slot. (executing now)
2. Spawn /root/research_optimal_patterns_2 in the freed slot -- this is for
   absorption-related research (Phenodag patterns, AuthKit/Authvault
   cross-link sweep, spine index patterns), not BytePort/OmniRoute.
3. Update the master synthesis (00_MASTER_SYNTHESIS.md) to reflect
   corrected scope.
4. Execute P0 today:
   - 4 PRs total:
     - PR-A: promote phenotype-org-audits to spine (charter + INDEX.md)
     - PR-B: promote phenotype-apps to spine (charter + INDEX.md + ARCHIVE.md)
     - PR-C: set Authvault to GitHub Archived + deprecation banner in README
     - PR-D: cross-link sweep for Authvault -> AuthKit redirects
5. Coordinate with apps-extract branch (R-C) before PR-B lands.


---

## Process Safety Note (sponsor directive 2026-07-05 03:46 UTC)

> "Someone is killing Codex|Forge interactive processes for safety
> adding a note here that those procs in tandem with claude|ghostty
> should never be killed."

**Action taken:** Inserted a permanent `## Process Safety -- Codex|Forge +
Claude|Ghostty (NEVER KILL)` section into the root `AGENTS.md` (the
canonical contract for all agent behavior in this repo). The rule:

- Codex|Forge + Claude|Ghostty interactive processes are NOT to be killed
  by any automated safety/memory/cleanup system.
- The user may explicitly kill them. Sub-agents may close themselves when
  done. Root may interrupt sub-agents that are over budget / out of scope.
- Forbidden: auto-killers triggered by uptime, idle CPU, idle input, or
  pattern matching on the parent terminal.

See the AGENTS.md section for the full rule, scope, and recovery steps.

