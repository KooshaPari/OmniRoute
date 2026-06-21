# ADR-037: `pheno-mcp-router` is the canonical MCP substrate

**Status:** ACCEPTED
**Date:** 2026-06-18
**Author:** orchestrator (claude opus 4.7)
**L8-003** (v8 track T22 supplement)
**Refs:**
- ADR-013 (pheno-mcp-router canonical, predecessor)
- ADR-029 (Dmouse92 dispatch-mcp → pheno-mcp-router migration, completed)
- `findings/2026-06-17-L5-104-dispatch-mcp-migration-plan.md`

---

## Context

`KooshaPari/pheno-mcp-router` is the canonical MCP substrate for the Phenotype fleet. Prior ADRs (013, 029) absorbed dispatch-mcp, LlamaAdapter, OpenAICompatAdapter from Dmouse92/dispatch-mcp (3 PRs merged into pheno-mcp-router).

This ADR formalizes the substrate's scope, ports, and consumers.

## Decision

**`pheno-mcp-router` owns the MCP Router pattern (Provider discovery, cost tracking, budget enforcement, audit logging). It exposes the `LlmPort` trait and consumes the `pheno-port-adapter` hexagonal L4 pattern (per ADR-038).**

### Substrate scope

| Responsibility | Module | Status |
|---|---|---|
| Provider discovery | `providers/discovery.rs` | Implemented (LlamaAdapter, OpenAICompatAdapter from L5-104) |
| Cost tracking | `cost/tracker.rs` | Implemented (L5-104) |
| Budget enforcement | `cost/budget.rs` | Implemented (L5-104) |
| Quota enforcement | `cost/quota.rs` | Implemented (L5-104) |
| Audit logging | `audit/logger.rs` | Implemented (L5-104) |
| Cost middleware | `cost/middleware.rs` | Implemented (L5-104) |
| Provider protocol | `LlmPort` trait | Implemented (ADR-038) |
| Multi-tier caching | `cache/tiered.rs` | Planned (T15 — pheno-flake refresh) |
| Registry sync | `registry/sync.rs` | Planned (T23 — registry refresh) |

### Consumer matrix

| Consumer | Substrate role | Integration |
|---|---|---|
| `dispatch-mcp` (KooshaPari) | MCP server | Uses `pheno-mcp-router` as LlmPort backend |
| `phenoMCP` (federated) | MCP server | Direct `pheno-mcp-router` |
| `phenotype-hub` (framework) | MCP framework | Direct `pheno-mcp-router` |
| `phenotype-python-sdk` | SDK | `pheno_mcp_router.LlmPort` binding |
| `phenotype-go-sdk` | SDK | `pheno_mcp_router.LlmPort` binding |
| `phenotype-ts-sdk` | SDK | `pheno-mcp-router` JS binding |

## Consequence

- 6 consumer repos standardize on `pheno-mcp-router`
- L5-104 migration closes the historical substrate gap (dispatch-mcp work absorbed)
- 71-pillar L46 (authn), L47 (authz), L56 (logging) scores improve across consumers
- `pheno-mcp-router` becomes a hard dependency for new MCP-related substrate (gated by ADR-023 Rule 3.1)

## Cross-references

- ADR-013 (predecessor)
- ADR-029 (L5-104 migration completed)
- ADR-038 (hexagonal Port/Adapter pattern)
- ADR-023 Rule 3.1 (substrate quality bar)
- `findings/2026-06-17-L5-104-dispatch-mcp-migration-plan.md`
