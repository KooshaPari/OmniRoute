# Prompts-to-Intent crosswalk (L7-003 reconciliation)

Date: 2026-06-18
Author: Forge-Mini scaffold, supervised by KooshaPari

This crosswalk reconciles two complementary taxonomies:

1. **Registry canonical set** (from `ECOSYSTEM_MAP.md` § 6): the 82 unique
   non-archived repos that the registry knows about — split by role
   (shared-lib, SDK, federated service, scaffold, etc.).

2. **L7-002 bound set** (from `_bindings.json`): the 108 repos that
   accumulated at least one curated prompt/plan/response during the
   headless sweep across `~/.claude/`, `~/.codex/`, `~/.cursor/`, etc.
   on Mac + Windows.

The two sets disagree on **27 + 53 = 80 entries**, but the disagreement is
**expected and explainable**: the two axes answer different questions.

| Axis | Question | Source-of-truth |
|------|----------|-----------------|
| Registry canonical | What repos exist (curated role taxonomy) | `ECOSYSTEM_MAP.md` + `BOUNDARY_OWNERS.md` |
| L7-002 bound       | What was said in agent sessions       | `_curated.jsonl` + `_bindings.json` |

---

## Repos bound in L7-002 but NOT in registry canon (53)

These are repos that **at least one prompt plan or agent session referenced** that
are not part of the registry's curated role taxonomy. Most fall into three buckets:

- **Worktree suffixes / duplicates** (`pheno-wtrees`, `*-wtrees/*`, `*-2nd`)
  — tooling-generated identifier permutations, not separate repos.
- **Process artifacts** (`worktrees`, `apps`, `spec-kitty-wtrees`, etc.) — directory
  names that agent sessions used as project contexts but aren't repositories in
  their own right.
- **Off-fleet repos** referenced by users but never registered
  (`OmniRouteWIP`, `Tracely-*`, `cheap-llm-mcp-deprecate`, `kwality-wtrees`).

Largest 25 by record count:

```text
phenotype-registry-curation-data     18,115   ← the meta-repo bucket (repos/* path)
phenotype-registry-intent-bundle         18   ← L7-001 worktree of this
phenotype-registry-wtrees               12
workflows                               72
worktrees                              138
spec-kitty-wtrees                       41
thegent-dispatch                        23
apps                                    69
cheap-llm-mcp-deprecate                  8
cheap-llm-mcp-t1-19                      3
tracely                                  7
tracera                                  5
omniRoute                                3
thegent                                   3
omniRoute-latest                          4
hexaKit                                  5
agileplus-spec-harmonizer-tool            3
dispatch-mcp                             11
dispatch-mcp-t1-0                         2
dispatch-mcp-t1-1                         4
dispatch-mcp-t1-2                         1
dispatch-mcp-t1-3                         8
dispatch-mcp-t1-4                         1
dispatch-mcp-t1-5                         2
kwality-wtrees                            2
diagnostics                              1
```

**Treatment decision (L7-003)**: these stay in `_bindings.json` as metadata
but do **not** get their own per-repo intent/boundary files (already
filtered out by `resolve-collision.py`'s `_ORPHAN_TOOLS` map). Anyone who
needs the raw prompts looks in `docs/curated-prompts/_orphan/`.

---

## Repos in registry canon but NOT in L7-002 (27)

These are repos the registry classifies as canonical that did not surface
in the prompt sweep. Three buckets:

- **Landing pages / docs-only repos with no agent activity.**
  (`phenotype-landing`, `phenodocs`, `phenotype-registry-wtrees` (=just
  this repo's worktrees), etc.)
- **Repos that had agent activity but the project path didn't include them.**
  E.g. `HexaKit` — the agent ran every new repo through HexaKit templates
  but the `cwd` in the rollout only showed the **target** repo, not HexaKit
  itself, so HexaKit doesn't get a project prefix in the session. We'd need
  a different binding strategy (template-prefix) to pick these up.
- **Newer repos (cut after 2025-02)** that pre-dated the registry
  canon update: `WorldSphereMod`, `eyetracker`, `substrate`,
  `phenoXddLib`-related, `helios-cli`.

**Treatment decision (L7-003)**: keep the gap visible.
L7-004 proposal: a **template-prefix binding mode** that maps `path-name`
strings to repos via HexaKit template ancestry. This would close most
of the gap mechanically.

---

## Taxonomy mismatch between the two views

| Aspect | Registry canon (ECOSYSTEM_MAP.md) | L7-002 bound set |
|--------|-----------------------------------|-------------------|
| Lowercase variants | Treated distinctly | Merged to PascalCase |
| Worktree suffixes | Treated as separate (e.g. `phenotype-tooling-wtrees`) | Merged to canonical |
| App substrate repos | Listed under "monorepo (multi-domain)" → 6 | Listed individually |
| Archived/Deprecated | Listed under "superseded / archived" → 40 | Dropped (per ADR-001/007/017) |
| SDK vs lib | Split between rows | Unified — phone home to registry |

The next-generation registry (`docs/registries.md`, this doc) references
**both** views and lets the agent decide which axis matters for the
question at hand.

---

## Where the conflict resolution happened (L7-003)

- `ECOSYSTEM_MAP.md` — both merge-conflict blocks resolved to **origin/main**
  (the post-4-repo-retirement state). Comments preserved inside the table
  rows for traceability (pending next rationalization sweep).
- `docs/registries.md` — added a new SSOT layer section pointing to
  `docs/intent/`, `docs/boundary/`, `ALIASES.md`, `PUSH-STATUS.md`.
- `_bindings.json` — left at 108 repos. No re-render needed (the L7-002
  resolution is correct from the curation-data side).

---

## Open question (L7-004+)

Whether to extend `scrape.py` with a `template-prefix` binding mode that
infers repo ownership from HexaKit template ancestry. This would
mechanically close the 27-repo gap. Estimated work: ~30 min + worklog
entry. Tracked in `worklogs/L7-003-ecosystem-reconciliation-2026-06-18.json`
under `next_steps`.
