# Spine Promotion Plan: phenotype-apps

**Date:** 2026-07-05
**Owner:** root (manager)
**Target:** repos/phenotype-apps

---

## What "spine" means here

phenotype-apps is the spine for the Phenotype application portfolio. It is
already in that role de facto (312 entries, ARCH_DIAGRAM_HARVEST,
DAG_100, FLEET_DAG.db, etc.). The promotion is to:

- Lock in its role as the apps portfolio index.
- Stop it from being treated as a service.
- Make the empty placeholder subprojects (AtomsBot/GDK/KaskMan and similar)
  officially archived.
- Provide a clear convention for new subprojects being added.

---

## What needs to change

1. **README first line:** currently a generic AI-DD-META banner pointing
   to FocalPoint. Replace with a one-line spine mission:
   > "phenotype-apps is the spine for the Phenotype app portfolio. It
   > indexes every app subproject and routes work to the canonical repos."
2. **AGENTS.md first paragraph:** currently a long date-heavy changelog
   (v15/v14/v13/...). Keep the history but move it below a one-line spine
   mission paragraph.
3. **docs/INDEX.md:** add. Lists every sub-project with: name, role,
   state (active/archived/missing-source), canonical source repo URL,
   last commit, FR coverage.
4. **docs/ARCHIVE.md:** add. Lists every archived subproject (AtomsBot,
   AtomsBot-3rd/4th/5th, GDK, KaskMan, etc.) with: archive date, reason,
   README location.
5. **AtomsBot-2nd:** already has an archive banner (placed 2026-07-05).
   Note in ARCHIVE.md: "AtomsBot-2nd is the only AtomsBot variant with
   source content; the others were always empty placeholders."
6. **CODEOWNERS:** ensure root is default owner for spine-level changes;
   sub-project owners for their own work.
7. **Status banner:** "SPINE -- APP PORTFOLIO" with progress.

---

## Sub-project status map (initial)

| Sub-project          | Status                          | Action                                          |
| -------------------- | ------------------------------- | ----------------------------------------------- |
| AtomsBot             | empty                           | archive README (done 2026-07-05)                |
| AtomsBot-2nd         | active, Discord<->GitHub bridge | strict pause + archive banner (done 2026-07-05) |
| AtomsBot-3rd/4th/5th | empty                           | archive README (done 2026-07-05)                |
| GDK                  | empty                           | archive README (done 2026-07-05)                |
| KaskMan              | empty                           | archive README (done 2026-07-05)                |
| (other 300+)         | varies                          | leave as-is; classify in INDEX.md               |

---

## What does NOT change

- The 312 subdirectories stay; only their state changes (active vs
  archived).
- The Cargo workspace, go.mod, package.json, and existing workflows
  stay.
- The .agileplus, .claude, .serena internals stay.

---

## Definition of done

- [ ] README first line is the spine mission
- [ ] AGENTS.md spine mission paragraph
- [ ] docs/INDEX.md exists with state column
- [ ] docs/ARCHIVE.md exists with the 7+ archived subprojects
- [ ] All 7 empty/legacy subprojects have archive READMEs (done)
- [ ] Commit message: "docs: promote phenotype-apps to spine role;
      archive 7 legacy subprojects"

---

## Risks

| Risk                                                          | Mitigation                                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Sub-projects lose discoverability once archived               | ARCHIVE.md is the canonical list; INDEX.md cross-links                                    |
| A sub-project owner comes back asking "where did my repo go?" | The archive READMEs point at the polyrepo strategy session docs                           |
| The spine becomes too large to navigate                       | Subdivide into 4-6 logical groups (apps/agents/data/infra/observability/legacy) over time |
