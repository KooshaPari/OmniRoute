# Audit Map

## Inventory Sources

- `inventory/AUTHORITATIVE_REPO_INVENTORY.md` is the canonical repo inventory.
- `inventory/github_remote_inventory.md` stores GitHub API snapshot context.
- `inventory/deleted_traces.md` tracks archive salvage candidates.

## Audit Snapshots

Quarterly audits live under `audits/<YYYY-MM-DD>/`.

The 2026-04-24 snapshot includes:

- Audit index and status matrix.
- Governance adoption scan.
- Dependency and version-alignment matrices.
- Per-repo summaries for the audited repository set.
- Follow-up backlog and uplift reports.

## How To Use This Site

1. Start with the public overview to understand the audit repository shape.
2. Use this map to locate the source artifact class.
3. Review raw artifacts in GitHub only after confirming they do not expose
   private operational details.
4. Route systemic follow-up work into the appropriate project backlog rather
   than editing audit history in place.
