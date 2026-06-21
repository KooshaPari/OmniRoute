# Findings: v12 Stage 4 (Governance) — ADR cross-references + fleet-wide index

**Date:** 2026-06-20
**Task:** T12-J — ADR Governance (2 tracks, 4 tasks)
**Target:** 4 doc updates (PR-ready)

---

## Summary

Completed all 4 tasks in v12 Stage 4 Governance:

1. **BytePort ADR cross-references** — Added Fleet Cross-References section to
   `BytePort/ADR.md` mapping 7 fleet ADRs (ADR-007/008/040/046/050/051/052) to
   BytePort local decisions.

2. **phenotype-ops ADR creation** — Created `phenotype-ops/ADR.md` with 4 new
   repo-local ADRs (ADR-067..ADR-070) documenting the manifest CLI, code review
   surface, pillar framework, and absorbed policy federation.

3. **dispatch-mcp ADR creation** — Created `Tracera/dispatch-mcp/ADR.md` with 4
   new repo-local ADRs (ADR-071..ADR-074) documenting the MCP dispatch protocol,
   multi-provider routing, worker lifecycle, and observability/tracing.

4. **Fleet-wide ADR-001..074 index** — Rewrote `docs/adr/INDEX.md` from a 49-ADR
   partial index to a full 74-ADR fleet-wide index covering all 5 fleet waves,
   BytePort (14 ADRs), phenotype-ops (4 ADRs), and dispatch-mcp (4 ADRs).

---

## ADR-050 number collision

Detected a numbering collision: `docs/adr/2026-06-19/ADR-050-t12-monorepo-state-deletion-complete.md`
and `docs/adr/2026-06-20/ADR-050-router-rebuild.md` both use slot ADR-050. The
INDEX.md collision note clarifies that fleet-wide ADR-050 refers to the router
rebuild (ACTIVE); the 2026-06-19 version is a CLOSED task-closure ADR.

---

## File manifest

| # | Action | File |
|---|--------|------|
| 1 | **UPDATED** | `docs/adr/INDEX.md` — fleet-wide ADR-001..074 index |
| 2 | **UPDATED** | `BytePort/ADR.md` — fleet cross-references added |
| 3 | **CREATED** | `phenotype-ops/ADR.md` — 4 repo-local ADRs |
| 4 | **CREATED** | `Tracera/dispatch-mcp/ADR.md` — 4 repo-local ADRs |

---

## ADR assignments (ADR-053..ADR-074)

| Fleet slot | Repo | Subject |
|-----------|------|---------|
| ADR-053..ADR-066 | BytePort | 14 repo-local architecture decisions (ADR-001..ADR-014) |
| ADR-067 | phenotype-ops | Manifest Attestation CLI |
| ADR-068 | phenotype-ops | Unified Code Review Surface |
| ADR-069 | phenotype-ops | Pillar Check Framework |
| ADR-070 | phenotype-ops | Policy Federation (Absorbed) |
| ADR-071 | dispatch-mcp | MCP Dispatch Protocol |
| ADR-072 | dispatch-mcp | Multi-Provider Routing |
| ADR-073 | dispatch-mcp | Worker Lifecycle Management |
| ADR-074 | dispatch-mcp | Observability & Tracing |

## ADR-050/051/052 verification

The 3 ADRs from the earlier authoring session at
`docs/adr/2026-06-20/ADR-050-router-rebuild.md`,
`ADR-051-bifrost-as-library.md`, and `ADR-052-plugin-sdk-spec.md` are all
**present, valid, and well-formed.** No issues noted.
