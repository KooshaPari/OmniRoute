# Spine Promotion Plan: phenotype-org-audits

**Date:** 2026-07-05
**Owner:** root (manager)
**Target:** repos/phenotype-org-audits

---

## What "spine" means here

A spine repo is the top-level coordination point for a class of work across
the polyrepo. It is NOT a service, NOT a library, NOT a runtime. It is:

- An index of all related repos with their current state.
- A canonical home for cross-repo specs, decisions, and audits.
- The single source of truth for that class of work.
- The place every agent goes to orient, not to execute.

phenotype-org-audits is the spine for the org-wide audit class. It is
already mostly in that role (312-entry meta-repo, audit-30-pillar,
audits/, consolidation/, curation/, findings/, forge-runner-scripts/,
worklogs/). The promotion is mostly a clarification and a lock-in.

---

## What needs to change

1. **README first line:** currently a generic AI-DD-META banner. Replace
   with a one-line spine mission:
   > "phenotype-org-audits is the spine for org-wide audit work. Every
   > cross-repo audit, pillar, finding, and consolidation lands here."
2. **AGENTS.md:** add a "Spine conventions" section that says:
   - This repo does not host services.
   - Sub-repo refs here are pointers, not source.
   - Audit reports here MUST reference the source repo and the source FR.
   - The current pillar numbering is canonical across the org.
3. **docs/INDEX.md:** add (if missing). A single file listing every
   sub-repo with: name, role, last commit, FR coverage, audit status.
4. **CODEOWNERS:** ensure root is the default owner for spine-level
   changes; sub-repo owners for their own audit reports.
5. **Status banner in main README:** "SPINE -- ORG AUDITS" with
   progress bar showing audit pillar closure.

---

## What does NOT change

- The 312+ subdirectories stay. They are audit entry points.
- The Cargo workspace, package.json, and existing workflows stay.
- The .claude, .agileplus, .serena, .git internals stay.

---

## Definition of done (spine promotion)

- [ ] README first line is the spine mission
- [ ] AGENTS.md has the "Spine conventions" section
- [ ] docs/INDEX.md exists and lists all sub-repos
- [ ] CODEOWNERS has root as default owner
- [ ] Status banner says "SPINE"
- [ ] No source code moved, no CI broken
- [ ] Commit message: "docs: promote phenotype-org-audits to spine role"

---

## Risks

| Risk | Mitigation |
|------|------------|
| Auditors land in a sub-repo and miss the spine | Each sub-repo README gets a one-line "part of the phenotype-org-audits spine" note |
| Pillar numbering drifts across repos | Pillar IDs are owned by this spine; sub-repos must use them as-is |
| Spine becomes a dumping ground | Quarterly review: any directory that has not had meaningful activity in 90 days is consolidated or archived |
