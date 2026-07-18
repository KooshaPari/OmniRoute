# OmniRoute Proc-2 WBS / PERT / DAG — 2026-07-17

**Extends:** `plans/2026-06-25-omni-evolve-dag.md`  
**Method:** AgilePlus enumerate → classify → prioritize → trace → verify  
**Legend:** `[ ]` pending · `[/]` active · `[x]` done · `[~]` blocked ·
`[!]` decision

## PERT phase map

```text
P0 Absorb stability ──► P1 Architecture truth ──► P3 Product/Rust work
       │                        │
       └──► P2 Hygiene ─────────┘
```

Critical path:

```text
P0-L1 → P0-L2 → P1-L1 → P1-L2 → P3-R1
```

## P0 — Absorb stability

| ID | Work | Dependency | State |
|---|---|---|---|
| P0-L1 | Classify PR #376 latency and DAST failures | — | `[x]` |
| P0-L2 | Merge PR #376 under documented RC waiver | P0-L1 | `[x]` |
| P0-L3 | Add Linux `cargo check --workspace` CI gate | P0-L2 | `[ ]` |
| P0-L4 | Repair root npm lock drift that blocks DAST | — | `[ ]` |
| P0-L5 | Baseline or repair REST latency workflow | — | `[ ]` |

## P1 — Architecture truth

| ID | Work | Dependency | State |
|---|---|---|---|
| P1-L1 | Decide whether v4 BFF/web removal was intentional | — | `[!]` |
| P1-L2 | Accept/revise ADR-107 for the topology decision | P1-L1 | `[~]` |
| P1-L3 | Refresh omni-evolve snapshot and add Rust stream | P1-L2 | `[~]` |
| P1-L4 | Retarget or restore #339, #340, and PR #375 | P1-L1 | `[~]` |

## P2 — Hygiene (parallel)

| ID | Work | Dependency | State |
|---|---|---|---|
| P2-L1 | Verify and close stale issue #320 | — | `[x]` |
| P2-L2 | Add blocked-by-ADR status to PR #375 | P1-L1 | `[~]` |
| P2-L3 | Smoke-test absorbed `extensions/argis` entrypoints | P0-L2 | `[ ]` |
| P2-L4 | Configure OmniRoute project/epic and GitHub sync in AgilePlus | — | `[ ]` |

## P3 — Ready backlog

| Stream | Issue / leaf | Effort | Dependency |
|---|---|---:|---|
| CI | #336 Bun download cache | 0.5 d | none |
| Tooling | #341 Oxc migration matrix | 2 d | none |
| Tooling | #319 TS7/Bun completion | 3 d | none |
| Release | #343 publication boundaries | 1 d | #322 partial |
| Docs | #366 Phenodocs readiness | 2 d | #322 identity |
| Product | #322 Phenotype readiness epic | ongoing | owner decisions |

## P4 — Rust workspace evolution

| ID | Work | Effort | Dependency |
|---|---|---:|---|
| P4-R1 | Implement provider repository CRUD | 1 d | ADR-107 |
| P4-R2 | Add API skeleton and health route | 1 d | P4-R1 |
| P4-R3 | Delegate router to core registry | 2 d | P4-R2 |
| P4-R4 | Implement CLI `serve` and `migrate` commands | 2 d | P4-R2 |
| P4-R5 | Add Linux Rust CI matrix | 0.5 d | P0-L2 |

## DAG

```mermaid
flowchart TD
  C376[P0-L1 classify #376 checks] --> M376[P0-L2 merge #376]
  M376 --> RCI[P0-L3 Rust CI]
  M376 --> ARG[P2-L3 Argis smoke]
  NPM[P0-L4 npm lock repair] --> DAST[DAST green]
  LAT[P0-L5 latency baseline] --> REST[Latency gate green]

  DEC{P1-L1 v4 removal intentional?}
  DEC --> ADR[P1-L2 ADR-107]
  ADR --> DAG[P1-L3 refresh omni-evolve]
  DEC --> BFF[P1-L4 retarget or restore BFF work]

  ADR --> CRUD[P4-R1 provider CRUD]
  RCI --> API[P4-R2 API skeleton]
  CRUD --> API
  API --> ROUTER[P4-R3 router]
  API --> CLI[P4-R4 CLI]

  CLOSE320[P2-L1 close #320]
  BFF --> NOTE375[P2-L2 update #375]
```

## Next-two queue

1. **P0-L3:** add a path-scoped Linux Rust workspace check.
2. **P1-L1:** obtain the topology decision; if unavailable, run P0-L4 and
   P2-L3 in parallel.

## Update rule

Every proc cycle must update node state, evidence links, dependencies, and
release criteria. New work is appended as a PR-sized leaf; existing IDs are
never repurposed.
