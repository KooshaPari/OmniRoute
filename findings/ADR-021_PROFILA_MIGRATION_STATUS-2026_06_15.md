# ADR-021 / Profila Migration Status

**Date:** 2026-06-15
**Status:** Discovered empty (no migration needed)
**ADR:** `docs/adr/2026-06-15/ADR-021-pheno-profiling-replaces-profila.md`

---

## Executive Summary

The V6 DAG identified a 12-PR plan to migrate `Profila` to `pheno-profiling-*`.
On inspection, **all `Profila/` directories in the monorepo are empty** —
they exist as git submodules or directory placeholders but contain no
source code, no README, no CHANGELOG, and no build artifacts.

This means the 12-PR plan is **moot in the traditional sense** (no
code to migrate), but the **canonical decision still needs to land**:
`pheno-profiling-*` is the profiler; `Profila` is the deprecated name;
`profila-replaced` is the deprecation shim.

---

## What Was Found

Search results for any non-empty `Profila` content in the monorepo:

| Location | Type | Content |
|---|---|---|
| `Pyron/Profila/` | Directory | **EMPTY** (no files) |
| `pheno/Profila/` | Directory | **EMPTY** (no files) |
| `phenotype-infrakit/Profila/` | Directory | **EMPTY** (no files) |

No `*.py`, `*.sh`, `*.toml`, `Cargo.toml`, `pyproject.toml`, or `README.md`
in any of the three locations. The `Profila/` directories are
git-submodule placeholders that were never populated (likely from an
`git submodule add` that was later abandoned, leaving the empty
directory behind).

---

## The Original 12-PR Plan (from V6 fan-out)

Per the V6 plan reference (not the v6-final report), the Profila
migration had 12 PRs:

1. **PR-1:** Identify all consumers of `profila` (Python package)
2. **PR-2:** Create `pheno-profiling-py` (Python replacement)
3. **PR-3:** Create `pheno-profiling-rs` (Rust replacement)
4. **PR-4:** Create `pheno-profiling-go` (Go replacement)
5. **PR-5:** Port the API surface to pheno-profiling (was never written in Profila)
6. **PR-6:** Update all consumers
7. **PR-7:** Add deprecation warning to `profila-replaced` shim
8. **PR-8:** Publish `profila-replaced` to PyPI
9. **PR-9:** Update CI/CD templates
10. **PR-10:** Update docs (ARCHITECTURE, STATUS, INDEX)
11. **PR-11:** Run L6 health audit to confirm no orphan refs
12. **PR-12:** Tag v0.1.0 release of pheno-profiling-{py,rs,go}

---

## Revised Plan (Profila is empty)

Since there is no Profila code to migrate, the 12 PRs collapse to:

| # | Original | Revised | Notes |
|---|---|---|---|
| 1 | Identify consumers | **MOOT** | No consumers if no code |
| 2 | `pheno-profiling-py` | **NEW** | Design + scaffold from scratch |
| 3 | `pheno-profiling-rs` | **NEW** | Design + scaffold from scratch |
| 4 | `pheno-profiling-go` | **NEW** | Design + scaffold from scratch |
| 5 | Port API | **NEW** | Author the canonical API |
| 6 | Update consumers | **MOOT** | No consumers to update |
| 7 | `profila-replaced` shim | **NEW** | Shim for the (empty) parent |
| 8 | Publish to PyPI | **NEW** | Push `pheno-profiling-py` |
| 9 | CI/CD templates | **NEW** | Templates for the 3 langs |
| 10 | Docs | **NEW** | ARCHITECTURE + STATUS update |
| 11 | L6 health audit | **NEW** | Verify no orphan `profila` refs |
| 12 | v0.1.0 release | **NEW** | Tag the 3 crates |

This is essentially a **greenfield project**, not a migration. The
work is much larger than the 6-8h the V6 plan estimated (more like
20-30h for greenfield 3-language profiler).

---

## Recommendation: Defer to a Dedicated Workstream

A cross-language profiler is a non-trivial design problem. Before
writing 3 lang versions, the API needs to be designed (call-graph
capture? sampling? instrumentation? in-process vs sidecar?). This
belongs in its own design doc + ADR, not a v6 follow-up.

**Recommendation:** Keep ADR-021 as **Accepted** but defer the
implementation to v7+. The empty `Profila/` directories can be
removed (submodule pointer + dir) as a small PR-0 in v6 finalization
so future contributors don't get confused by the empty stubs.

---

## What To Do Today (Quick Win)

A single PR (`Profila-empty-removal`) that:

1. `git rm` the 3 empty `Profila/` directories (Pyron, pheno, phenotype-infrakit)
2. Remove any `.gitmodules` entries for them
3. Commit on the appropriate submodule
4. Bump submodule pointers in parent

This is a 5-minute task and removes the phantom references. It does
not address the larger ADR-021 (canonical pheno-profiling-*) which
remains a v7+ greenfield effort.

---

## What Was Rejected

The V6 plan's 12-PR list assumed a non-empty Profila. Three options
were considered:

1. **Keep the empty placeholders** — REJECTED. They confuse future
   contributors and the `.gitmodules` entries may also be wrong.
2. **Migrate anyway (rewrite the 12-PR plan to greenfield)** —
   DEFERRED. Needs design + 20-30h work, not 6-8h.
3. **Remove the empty stubs (this plan)** — ACCEPTED for v6
   finalization. ADR-021 keeps its Accepted status for the
   architectural intent; implementation is v7+.

---

## Related Documents

- `docs/adr/2026-06-15/ADR-021-pheno-profiling-replaces-profila.md` — Decision
- `docs/adr/2026-06-15/INDEX.md` — Master ADR list
- `findings/2026-06-15-PROFILA_DECISION-v1.md` — Subagent plan
- `findings/2026-06-15-DAG-V6-FINAL-v1.md` — V6 fan-out

---

## Sign-off

ADR-021 is **Accepted** but the implementation is **Deferred to v7+**.
For v6 finalization, the recommended quick win is the empty-stub
removal (Profila-empty-removal PR). 12-PR plan retained as a
backlog reference.
