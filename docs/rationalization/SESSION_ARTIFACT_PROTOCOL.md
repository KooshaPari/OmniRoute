# Session Artifact Protocol

> Fleet standard for **resumable, zero-loop** agent and human sessions.  
> Dogfood: PhenoProc gap port (2026-06-17) — loops traced to missing pre-port DAG and boundary packet.

---

## When required

| Session type | Protocol |
|--------------|----------|
| Cross-repo absorption / gap port | **Required** |
| Boundary owner change or archive | **Required** |
| Multi-PR fleet work | **Required** |
| Single-repo bugfix <50 LOC | Optional (AgilePlus spec link still recommended) |
| Deferred schizo tier repos | **Forbidden** until fleet complete |

---

## Folder layout

```text
docs/sessions/YYYYMMDD-<slug>/
  00_SESSION_OVERVIEW.md      # goal, outcome, validation, links
  01_RESEARCH.md              # boundaries, owners, open PRs, prior art
  02_SPECIFICATIONS.md          # FR + acceptance criteria
  03_DAG_WBS.md                 # lanes, deps, blockers vs non-blockers
  04_IMPLEMENTATION_STRATEGY.md # copy vs redirect vs split-target
  05_KNOWN_ISSUES.md            # risks, deferred items
  06_TESTING_STRATEGY.md        # cargo check, smoke, CI expectations
  07_CROSS_PROJECT_SYNC.md      # sibling PRs, split targets, merge order
```

**Canonical examples:** `phenotype-tooling/docs/sessions/20260429-sladge-badge-rollout/`

---

## File contracts

### 00_SESSION_OVERVIEW.md

```markdown
# Session Overview
## Goal
## Outcome (fill on completion)
## Validation
## Links
- AgilePlus spec: <slug or URL>
- PRs: <list>
- Boundary doc: BOUNDARY_OWNERS.md §<section>
```

### 01_RESEARCH.md

Must answer before implementation:

1. Who is the **canonical boundary owner**?
2. Are there **split targets** (sibling repos)?
3. What open PRs overlap?
4. Is source **archived** and governed by DELETE gate?
5. What is **explicitly deferred** (non-blockers)?

### 02_SPECIFICATIONS.md

- Functional requirements (numbered)
- Acceptance criteria (testable, binary)
- Out of scope (prevents scope creep on “do all”)

### 03_DAG_WBS.md

- Work items with **dependency edges**
- Tag each item: `[G]` gate, `[P]` parallel, `[B]` blocked, `[NB]` non-blocker
- **Split-target PRs named before bulk copy**

### 07_CROSS_PROJECT_SYNC.md

| Field | Content |
|-------|---------|
| Primary PR | Main absorber |
| Sibling PRs | Split targets |
| Merge order | e.g. registry #76 → sidecars → Agentora #79 |
| Tracker doc path | e.g. `docs/absorption/PHENOPROC_GAP_PORT.md` |

---

## Agent entry packet (minimum)

Before any port or merge session, the agent MUST have:

```text
1. BOUNDARY_OWNERS.md (relevant sections)
2. ZERO_LOOP_ECOSYSTEM_PLAN.md or ECOSYSTEM_DAG.md lane assignment
3. Session folder 01 + 03 (research + DAG) — may be created in first 15 min
4. Absorption manifest if staging copies (ABSORPTION_MANIFEST.md pattern)
5. Open PR table for owner + sibling repos
```

---

## AgilePlus integration

| Step | Command / artifact |
|------|-------------------|
| Open spec | `agileplus specify --title "<slug>" --description "..."` |
| Link in PR | `AgilePlus: <spec-id>` in PR body |
| Validate | `agileplus validate --feature <slug>` before merge |
| Retro | `agileplus retrospective --feature <slug>` after merge |

Governance templates source: `phenokits-commons/governance/phenoproc-*` — not archived PhenoProc.

---

## Staging vs canonical (reminder)

Files copied into an **absorber** repo are **audit staging** until:

1. Consumer manifests repointed
2. Canonical owner named (may differ from absorber — e.g. agileplus → AgilePlus)
3. DELETE gate 5-check passes

See [ADR-004](../adr/ADR-004-absorption-staging-vs-canonical.md).

---

## Checklist (pre-commit)

- [ ] Boundary owner named in `01_RESEARCH.md`
- [ ] Split targets in `03_DAG_WBS.md` before robocopy
- [ ] `06_TESTING_STRATEGY.md` lists `cargo check` / test commands run
- [ ] `07_CROSS_PROJECT_SYNC.md` lists all PR URLs
- [ ] Tracker doc updated (coverage %, gate status)
- [ ] Non-blockers listed separately from merge blockers
