# ADR Index — 2026-06-15

This index lists the ADRs accepted on 2026-06-15 for the V5 SOTA-decision sweep
(`plans/2026-06-14-DAG-V5.md` handoff). All files live in this directory.

| #     | Title                                                                                                | Status   | File                                                 |
| :---- | :--------------------------------------------------------------------------------------------------- | :------- | :--------------------------------------------------- |
| 012   | `pheno-tracing` as the canonical tracing crate across all pheno-* repos                               | Accepted | `ADR-012-pheno-tracing-canonical.md`                 |
| 013   | `pheno-mcp-router` as the substrate for all pheno-mcp-* servers                                       | Accepted | `ADR-013-pheno-mcp-router-substrate.md`              |
| 014   | Hexagonal L4 ports pattern: `Port` trait + `Adapter` impl                                            | Accepted | `ADR-014-hexagonal-l4-ports.md`                      |
| 015   | V2 10-column WORKLOG.md schema (canonical across all pheno-* repos)                                   | Accepted | `ADR-015-v2-worklog-schema.md`                       |
| 016   | Fork-only-not-rewrite policy for SOTA libraries                                                      | Accepted | `ADR-016-fork-only-not-rewrite.md`                   |

## Scope

- **ADR-012..014** cover L3/L4 substrate decisions (tracing, MCP, hex ports).
- **ADR-015** covers the cross-repo worklog schema (a fleet-wide contract).
- **ADR-016** covers the policy for adopting upstream SOTA libraries (the
  "don't rewrite" rule that the 3 V3/V4 abandoned rewrites motivated).

## Note on ADR-007..011

The earlier ADRs (007..011) referenced by the V5 plan live in their respective
sub-repos (e.g. `Tokn/docs/adrs/`, `Parpoura/docs/adr/`) rather than in this
meta-repo. This directory is the meta-repo's own ADR set for V5 SOTA decisions
that span the fleet, not a duplicate of the per-repo ADR collections.
