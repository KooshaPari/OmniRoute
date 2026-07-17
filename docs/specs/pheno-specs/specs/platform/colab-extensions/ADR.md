# Architecture Decision Records — phenotype-colab-extensions

---

## ADR-001 — Fork-and-Extend Strategy for Colab

**Date:** 2025-11-01
**Status:** Accepted

### Context
Phenotype required customisations to `blackboardsh/colab` (workflow specs, AgilePlus integration,
extension hooks) but needed to stay close to upstream to receive bug fixes and features.

### Decision
Fork `blackboardsh/colab` as `KooshaPari/colab`. Store all Phenotype-specific customisations in
`phenotype-colab-extensions` as a separate repo. Customisations are applied via a documented
sync process rather than direct commits to the fork's feature branches.

### Consequences
- Upstream merges are clean since Phenotype changes live outside the fork tree.
- `UPSTREAM_SYNC.md` tracks the sync cadence and known conflicts.
- AgilePlus specs and workflow integrations are versioned independently of colab releases.

---

## ADR-002 — Specs in src/specs/ Subdirectory

**Date:** 2025-11-05
**Status:** Accepted

### Context
Spec files (PRD, FR) for the colab integration needed a stable location that would not
conflict with potential upstream files or the root-level spec docs.

### Decision
Place colab-specific specs under `src/specs/` rather than the repository root. Root-level
`PRD.md` and `FUNCTIONAL_REQUIREMENTS.md` describe the extensions repo itself; `src/specs/`
contains specs for the colab integration layer.

### Consequences
- Clear separation between repo-level specs and integration-level specs.
- Upstream sync process does not risk overwriting `src/specs/` content.

---

## ADR-003 — Taskfile for Extension Automation

**Date:** 2025-11-10
**Status:** Accepted

### Context
Extension management tasks (sync upstream, apply patches, validate specs) needed a consistent
entry point usable both locally and in CI.

### Decision
Use `src/Taskfile.yml` (go-task) as the automation entry point. All extension management
commands are exposed as named tasks.

### Consequences
- Contributors run `task sync` to pull upstream changes and apply extension patches.
- CI uses the same `task` commands, ensuring local and CI parity.
- No Makefile; Taskfile is the single source of truth for automation.
