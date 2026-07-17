# Phenotype Org Audits

This site is the redaction-safe public index for Phenotype organization audit
history. It summarizes what the audit repository contains without republishing
every raw finding into the website surface.

## What Lives Here

| Surface | Purpose |
| --- | --- |
| `inventory/` | Authoritative repo inventory and GitHub/local reconciliation notes |
| `audits/<date>/` | Timestamped audit snapshots and per-repo summaries |
| `worklogs/` | Operator notes and governance context, reviewed before publishing |
| `README.md` | Canonical repository overview and retention model |

## Public Contract

- Publish summaries and navigation, not sensitive raw operational details.
- Keep repo counts and governance status high-level unless a finding is already
  intentionally public.
- Link to raw Markdown in GitHub when a reviewer has confirmed it is safe.
- Do not publish secrets, local-only hostnames, private tokens, private issue
  links, or unredacted vulnerability details.

## Current Baseline

The current inventory tracks the Phenotype repository set across local and GitHub
surfaces, including active, local-only, GitHub-only, and archived repositories.
The detailed inventory remains in the source repository for review.
