# ADR-032 — Worklog Schema: Both Stay (2026-06-18)

**Status:** Accepted
**Deciders:** @KooshaPari (orchestrator)
**Date:** 2026-06-18
**Replaces:** T11 worklog-schema decision (open since 2026-06-17)

## Context

Two worklog schemas exist in the fleet:

1. **ADR-015 v2.0** (`phenotype-registry` + `pheno-worklog-schema`) — 10 columns: `req_id, date, scope, type, status, summary, files_touched, tests_run, risks, followups`
2. **AgilePlus schema** (AgilePlus-internal) — used by `Dino`, `PlayCua`, `BytePort`, `AgilePlus` itself, and 4 other focus-repos

The schemas **diverge in shape** (AgilePlus has sprint/velocity fields, ADR-015 has L5/L6 governance levels) and **converge in intent** (both track req_id, status, files_touched, followups).

Pre-ADR-032 options:

- **(A) Single canonical schema** — pick one, force the other to migrate
- **(B) Adapter/translator** — both stay, build a one-way converter
- **(C) Both stay** — document the boundary, let each ecosystem use its own

## Decision

**Option (C) — Both Stay.** This is the formal ADR-032.

### Why "both stay" is the right call

1. **No actual collision.** The two schemas track different metadata:
   - ADR-015 v2.0 is **fleet-level** (cross-repo, governance-stamped, used by 22+ pheno-* substrate repos)
   - AgilePlus schema is **team-sprint-level** (per-team velocity, used by 5 focus repos)

2. **The cost of forcing convergence is higher than the cost of divergence.**
   - Option (A) would require migrating 5 focus repos' data + updating 3+ downstream consumers + risking shadow-format splits
   - Option (B) is over-engineered for the actual user need (cross-schema queries are rare; L5 governance stamping already absorbs both)

3. **The boundary is clear and stable.**
   - ADR-015 v2.0 consumers: governance, audit, worklog-schema repos (all fleet substrate)
   - AgilePlus consumers: the 5 focus repos + their dashboards
   - Boundary marker: presence/absence of `bucket_change:` field (AgilePlus-only) vs. presence/absence of `L5-###` req_id prefix (ADR-015-only)

4. **Both schemas are upgradeable independently.** v2.1 of ADR-015 (the `device:` field bump, ADR-025) is a forward-compatible additive change. AgilePlus schema can ship velocity-tracking changes without affecting the substrate.

### What this ADR does NOT do

- Does not introduce a translator/converter (Option B rejected — over-engineered)
- Does not deprecate either schema (both stay = both supported)
- Does not require any code migration in any repo

### What this ADR DOES do

- Codifies the boundary in both schemas' canonical docs (this ADR + the README updates below)
- Establishes the `req_id` format as the join key (`L5-###` for ADR-015, `L#-#` for AgilePlus — never collide because prefixes are different)
- Lays the groundwork for **ADR-033 (planned)**: cross-schema audit query that uses `req_id` + repo as the natural join

## Consequences

### Positive

- No migration cost (0 PRs forced by this ADR)
- Both ecosystems can ship independently
- v2.1 (device: field) ships in ADR-015 without breaking AgilePlus consumers

### Negative

- Two schemas to document (already done in both repos)
- A cross-schema query tool is "future work" (not built yet)

### Neutral

- The substrate fleet (22 pheno-* repos) continues to use ADR-015 v2.0/v2.1
- The focus repos (AgilePlus, Civis, PhenoCompose, PlayCua, BytePort, nanovms) continue to use AgilePlus schema
- Both schemas reference each other in their respective READMEs for clarity

## Migration matrix (informational, not enforced)

| Repo | Schema | Notes |
|------|--------|-------|
| 22 pheno-* substrate repos | ADR-015 v2.0/v2.1 | Fleet substrate |
| phenotype-registry | ADR-015 v2.0/v2.1 | Schema SSOT for ADR-015 |
| pheno-worklog-schema | ADR-015 v2.0/v2.1 | Schema package substrate |
| AgilePlus | AgilePlus schema | Team-sprint (own internal format) |
| Dino, PlayCua, BytePort | AgilePlus schema | Focus repos |
| Phenotype-org-audits (this file) | ADR-015 | Governance + audit substrate |

## Related

- ADR-015 (Worklog Schema v2.0 canonical) — superseded by ADR-015 v2.1 via ADR-025 (adds `device:` field)
- ADR-025 (Worklog v2.1 schema bump, `device:` field)
- ADR-024 (71-pillar industry audit framework)
- `phenotype-registry/ECOSYSTEM_MAP.md` (canonical repo inventory)
- T11 v8 DAG track (2026-06-18 plan)

## PR list (this ADR's execution)

1. `phenotype-org-audits`: this file (new ADR)
2. `pheno-worklog-schema/README.md`: update with cross-reference to AgilePlus schema
3. `AgilePlus/README.md`: update with cross-reference to ADR-015

Total: 3 PRs. ~45 min orchestrator-only work.
