# ADR-042 — pheno-worklog-schema absorbed into phenotype-org-audits (2026-06-20)

**Status:** Accepted
**Deciders:** @KooshaPari (orchestrator)
**Date:** 2026-06-20

## Context

`pheno-worklog-schema` is a Python library for parsing, validating, emitting,
and migrating ADR-015 `WORKLOG.md` files. It is useful, but it is not a
standalone domain. The repository duplicates audit-substrate behavior already
tracked in this repo's worklog and governance surface.

`phenotype-org-audits` already owns:

- the fleet audit history,
- audit tooling subprojects under `audits/`,
- longitudinal worklog tracking,
- governance evidence around schema usage and repo inventory.

That makes this repository the correct long-term home for the package.

## Decision

Absorb `KooshaPari/pheno-worklog-schema` into
`phenotype-org-audits/audits/worklog-schema/` and treat the source repository as
delete-ready after merge.

## Consequences

- `pheno-worklog-schema` no longer needs to exist as a standalone repo.
- The canonical package code lives under `audits/worklog-schema/`.
- Future changes to the WORKLOG schema validator happen here, alongside the
  rest of the audit tooling.
- The schema itself is unchanged; only repository ownership changes.

## Related

- ADR-032 — Worklog Schema: Both Stay
- `audits/worklog-schema/README.md`
- `audits/worklog-schema/MANIFEST.md`
