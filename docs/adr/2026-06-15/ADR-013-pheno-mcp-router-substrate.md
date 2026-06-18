# ADR-013: `pheno-mcp-router` as the substrate for all pheno-mcp-* servers

**Status:** Accepted 2026-06-15
**Deciders:** MCP architecture circle
**Supersedes:** per-server boilerplate (allowlist + sanitize + size-limit + logging)

## Context

The pheno-mcp-* fleet (pheno-mcp-orchestrator, pheno-mcp-gitops, pheno-mcp-observability, pheno-mcp-registry, plus ad-hoc servers in cheap-llm-mcp and dispatch-mcp) has converged on a common shape:

1. A tool allowlist.
2. A request sanitiser (strip control chars, normalise paths, cap strings).
3. A response size limit (default 1 MiB).
4. A structured-logging wrapper around every tool call.
5. A JSON-RPC envelope.

Each server re-implements this boilerplate. The result is five near-identical `middleware.py` files with subtly different defaults. A 2026-05 incident showed that pheno-mcp-orchestrator's allowlist did not match pheno-mcp-gitops's path canonicalisation, allowing a request the orchestrator would have rejected to be served by gitops — a class of bug that should be structurally impossible.

## Decision

All pheno-mcp-* servers are built on `pheno-mcp-router`. The rules:

1. A new MCP server is a *tier* in an existing router, not a new router.
2. Per-tier config (allowlist, sanitiser, size limit) is declared in the router's tier registry, not in the tool handler.
3. The router owns the JSON-RPC envelope, the structured log, and the size limit.
4. A tool handler is a pure function `(ToolRequest) -> ToolResponse`; it sees no middleware.

## Consequences

**Positive**
- One sanitiser (1.0 battle-tested), one size limit, one log format across all pheno-mcp-* servers.
- New tiers are < 50 LoC; per-server boilerplate drops to zero.
- The 2026-05 allowlist/path-canonicalisation incident is structurally impossible (one code path).

**Negative**
- Tier config moves from per-server YAML to a shared router config; repos that shipped per-server YAML need a one-time cutover.
- A misconfiguration in the shared router affects all tiers; blast radius is wider. Mitigated by tier-level integration tests.

**Mitigation**
- Each tier carries an `IntegrationTest` exercising the allowlist, sanitiser, and size limit at the router boundary.
- The router exposes a `dry_run` mode for staging: tool calls are logged but not executed.

## Alternatives considered

- **Per-server boilerplate (status quo).** Rejected: 5× maintenance, known incident class.
- **A `pheno-mcp-base` library that each server imports.** Rejected: still 5× the import sites; the *router* model is the right abstraction because it owns the request envelope.
- **A `pheno-mcp` super-server that contains all tools.** Rejected: violates single-responsibility at the server level; auth and rate limits diverge per tool group.

## References

- `pheno-mcp-router/src/pheno_mcp_router/__init__.py` — the router entry point.
- `pheno-mcp-router/tests/` — 11/11 tests, covering 3 protocols, 3 ABCs, 6 adapters.
- `V4 §6` — L2/L3 MCP layer.
