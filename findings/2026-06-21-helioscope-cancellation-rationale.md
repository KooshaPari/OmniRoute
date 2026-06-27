---
id: v12-20
title: helioscope retirement closure — chose helios-cli as canonical
date: 2026-06-21
dag_task_id: v12-20
cancelled_task_id: task-05-10
retired_repo: KooshaPari/helioscope
canonical_repo: KooshaPari/helios-cli
status: closure-approved
references:
  - helios-cli/docs/rationalization/helioscope-absorption.md
  - helios-cli/docs/sessions/20260523-helios-audit/04_VALIDATION.md
  - phenotype-registry/RATIONALIZATION_PLAN.md (Step 2)
---

# helioscope retirement — closure rationale (v12-20)

**TL;DR:** `task-05-10` ("helioscope: add docs/SSOT.md") is **cancelled**.
We are **not** scaffolding `KooshaPari/helioscope` with a SPEC.md + AGENTS.md.
Instead, **helios-cli** is the canonical codex fork in the Phenotype fleet,
and **helioscope** is retired by archive + README redirect per the plan
already documented at `helios-cli/docs/rationalization/helioscope-absorption.md`
(2026-05-31). This document closes the loop in the DAG.

---

## 1. What was task-05-10?

From `FocalPoint/FLEET_DAG.db`:

```
task-05-10 | cancelled | helioscope: add docs/SSOT.md
v12-20     | ready     | chore: process cancelled task-05-10 helioscope —
                          either create helioscope repo skeleton or
                          document the cancellation reason
```

The original intent of `task-05-10` was to land `docs/SSOT.md` inside the
helioscope repository. That task was cancelled (state: `cancelled` in DAG)
before any work was committed. `v12-20` is the wrap-up: explicitly choose
between (a) scaffolding a helioscope skeleton or (b) writing this rationale.

**Decision: option (b).** helios-cli is canonical.

## 2. Why helios-cli is canonical, not helioscope

The full case is in
`helios-cli/docs/rationalization/helioscope-absorption.md`. Summary:

| Criterion                            | Result                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Same upstream (openai/codex)         | Yes — both are codex-monorepo forks                                                                                 |
| Canonical absorber                   | **helios-cli** (`main`) — active Phenotype fork with CVE/workspace fixes (#522–#527)                                |
| Retire candidate                     | **helioscope** (`master`) — legacy fork; README still references `heliosCLI`                                        |
| `git merge-base`                     | **None** — unrelated histories after divergent rebases                                                              |
| Unique commits on helioscope         | ~283 (mostly harness version bumps, deny.toml, fleet docs)                                                          |
| Unique commits on helios-cli         | ~4,169 ahead of helioscope tip                                                                                      |
| Full-tree `git subtree add --squash` | Mechanically succeeds but adds **~5,134 files / ~790k LOC** — duplicate codex monorepo, **not consolidation**       |

The 2026-05-23 helios audit validation matrix
(`helios-cli/docs/sessions/20260523-helios-audit/04_VALIDATION.md`) flagged
helioscope with three FAIL/UNKNOWN rows and explicitly recommended "remove
or restore `crates/thegent-router` entry" — helioscope never closed that gap.

## 3. Why we are NOT scaffolding a helioscope SPEC.md + AGENTS.md

Scaffolding would imply helioscope is a viable target for future work.
That contradicts the fleet state:

1. **helios-cli is strictly ahead** in both commit count (4,169 vs 283) and
   in Phenotype-specific security hardening (#522–#527).
2. **No merge-base** between the two forks — full code migration is impossible
   without a squash-subtree that adds ~5,134 duplicate files. The absorption
   assessment explicitly rejects this path (line 17).
3. **Phenotype-registry's RATIONALIZATION_PLAN.md** Step 2 lists
   helioscope's retirement as `gh repo archive` + husk README, not code merge.
4. **The 283 helioscope-only commits** are a mix of: harness version bumps
   (low signal), fleet docs (already mirrored in this monorepo's `findings/`
   + `docs/adr/`), and one symlink fix (`CONSTITUTION.yaml`) that is no longer
   relevant. A cherry-pick triage pass is the right next step, not a fresh
   repo skeleton.
5. **Issue #596 triage (2026-06-18)** re-asked for "migrate working CLI code
   from helioscope into helios-cli before archive." The absorption assessment
   rejected that direction (line 17) and the verdict is unchanged.

## 4. What happens to helioscope instead

Per the absorption assessment § "Recommended path (reversible, PR-only)":

1. **Archive** `KooshaPari/helioscope` with a husk README redirecting to
   `KooshaPari/helios-cli`. This is an org-admin `gh repo archive` operation
   and must be done from a privileged context — not from inside this meta-repo.
2. **Cherry-pick audit** — if any of the ~283 helioscope-only commits contain
   unique fixes not on helios-cli, open targeted cherry-pick PRs. Do not bulk
   subtree.
3. **Update `phenotype-registry` redirect table** with the `helioscope →
   helios-cli` pointer when the archive lands. That is a separate PR in
   `KooshaPari/phenotype-registry`.

## 5. DAG actions

1. ✅ `task-05-10` is already `cancelled` (no code change required).
2. ✅ This document closes `v12-20` with the rationale. `v12-20` will be
   marked `done` in the DAG with `assigned_agent=orch-v12-ci`.
3. **Follow-up (out of scope for v12-20, tracked separately):**
   - Open `phenotype-registry` PR adding `helioscope → helios-cli` redirect row.
   - Open helios-cli PR cherry-picking any of the 283 unique commits that
     contain net-new security/workspace fixes not already on `main`.
   - File org-admin archive request for `KooshaPari/helioscope` once the
     redirect lands (cannot be done from inside this repo).

## 6. References

- `helios-cli/docs/rationalization/helioscope-absorption.md` — 2026-05-31
  absorption assessment (canonical verdict, recommended path)
- `helios-cli/docs/sessions/20260523-helios-audit/04_VALIDATION.md` — helios
  audit validation matrix flagging helioscope FAIL/UNKNOWN
- `helios-cli/docs/sessions/20260429-helioscli-sladge-badge/01_RESEARCH.md` —
  background on the heliosCLI / helios-cli naming history
- `phenotype-registry/RATIONALIZATION_PLAN.md` — Step 2 lists helioscope
  retirement as `gh repo archive` + husk README
- Issue #596 triage (2026-06-18, in the absorption doc § "Issue #596 triage") —
  confirms verdict unchanged

---

**Closure:** v12-20 → done. task-05-10 → cancelled (no change). helios-cli
remains the canonical codex fork; helioscope retires by archive + redirect.
