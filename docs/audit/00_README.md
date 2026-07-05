# Backend Rewrite Audit, Research, and Plan

> **Owner**: Manager agent (root thread)
> **Date**: 2026-07-05
> **Scope**: OmniRoute fork non-frontend surface (backend, API, SDK, CLI, MCP server, A2A server, MITM proxy, executor runtime)
> **Repo**: `omniroute-upstream-work` (branch `feat/omni-foundation-2026-07-05`, upstream `diegosouzapw/OmniRoute` v3.8.42)
> **Parallel workspace**: `omniroute-rust/` (12-crate Rust attempt, ~10k LOC, 124 tests passing)

## Why this document exists

The user asked for an "optimal/mature/enterprise/prod grade" rewrite of the OmniRoute backend, candidate languages Rust / Go / Zig / Mojo, with a deep audit + plan + web research. The fork is already on a 2-tier architecture (ADR-031): Tier 1 = `maximhq/bifrost` Go sidecar, Tier 2 = OmniRoute TypeScript. A parallel `omniroute-rust/` workspace exists in the same branch as a complete-rewrite attempt.

This directory contains the deliverables that drive the decision and the staged migration:

| File                   | Purpose                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `00_README.md`         | This file. Decision summary, scope, how the three docs fit together.                                  |
| `01_BACKEND_AUDIT.md`  | Exhaustive audit of the current TS backend surface (LOC, modules, providers, contracts, risk).        |
| `02_STACK_RESEARCH.md` | Stack research: Rust, Go, Zig, Mojo for LLM-gateway workloads in 2026, with concrete recommendations. |
| `03_REWRITE_PLAN.md`   | Staged migration plan: phases, slices, acceptance criteria, milestones, ownership.                    |
| `04_COCKPIT.md`        | Live status dashboard (regenerated each turn by the manager).                                         |

## The decision in one paragraph

**Polyglot Tier-2, not a full rewrite.** Keep `maximhq/bifrost` (Go) as Tier 1. **Use Rust** to absorb the hot-path TS Tier 2 surfaces that don't belong in Next.js (MCP server, executor runtime, MITM proxy, A2A server, compression daemon). **Use Zig** for one or two leaf utilities (tokenizer fast-path, prompt-compression) where zero-alloc + cross-compile is decisive. **Defer Mojo** (not production-ready for this scale in 2026). The existing `omniroute-rust/` workspace is the foundation; redefine its scope from "complete rewrite" to "Rust Tier-2 surface" so the work already done is preserved.

## How to read this

- **Sponsor (Koosha)**: read the `Decision` section in `00_README.md`, then `03_REWRITE_PLAN.md` phases + acceptance criteria. Approve / reject / amend.
- **Implementer agent**: read `01_BACKEND_AUDIT.md` for the current surface, then `03_REWRITE_PLAN.md` for the slice you own. Match existing patterns from the listed reference crates.
- **Manager agent (root)**: read `04_COCKPIT.md` each turn. Surface only go/no-go and risk-changing decisions.
