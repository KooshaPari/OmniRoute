# OmniRoute Backend Rewrite Session

**Date:** 2026-07-05 · **Repo:** KooshaPari/OmniRoute (fork of diegosouzapw/OmniRoute, v3.8.43)
**Path:** /Users/kooshapari/CodeProjects/Phenotype/repos/OmniRoute-pr232-policyfix-20260703

## Goal

Decide the optimal target language + architecture for a clean, production-grade rewrite of OmniRoute's backend (HTTP API, CLI, SDK, MCP, mitm proxy, SSE, executors, domain, store). Keep the existing Next.js dashboard frontend intact. Target the v4 line as a separate workspace that re-uses the public OpenAPI contract and the SQLite migration history.

## Why now

- The current TS backend is 405 K+ LoC across 500+ files with 50+ files over the 1500-line mark; the AGENTS.md 500-line hard limit is systematically violated.
- The dashboard frontend is rich and stable; rewriting it would be wasted work.
- The TypeScript-side issues (slow cold start, large memory footprint, awkward binary distribution, fragile tproxy / cert install) are best solved with a systems language at the core.
- The 80 provider executors and 119 SQL migrations are the dominant rewrite cost; we want to amortize that into one careful port.

## Scope of session

1. Deep audit of the current backend surface (HTTP, CLI, SDK, MCP, mitm, SSE, executors, domain, store).
2. Language comparison: Rust / Go / Zig / Mojo for an LLM router/gateway workload in 2026.
3. SOTA research on existing LLM routers and the OpenAI-compatible API surface.
4. Dependency and risk analysis with rewrite-effort estimate.
5. Decision-complete plan + spec for the rewrite (target language, workspace layout, executor pattern, migration strategy, rollout).

## Out of scope

- The Next.js dashboard (, , ).
- Desktop/mobile UIs (Electron, Flutter, Tauri).
- Public marketing site / landing pages.

