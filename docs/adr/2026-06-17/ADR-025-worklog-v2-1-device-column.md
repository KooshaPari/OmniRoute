# ADR-025: Worklog schema v2.1 — add `device:` column (11th column)

**Status:** Accepted 2026-06-17 · **Deciders:** Worklog-schema circle
**Supersedes:** v2.0 10-column schema from ADR-015 (2026-06-15) for *new* worklogs only; v2.0 remains valid for historical entries.
**Effective:** 2026-06-17; deprecation cutover 2026-06-22 (5-day migration window).

## Context

ADR-015 (2026-06-15) defined the v2 10-column WORKLOG.md schema. ADR-023 (also 2026-06-15) introduced the **device-fit gate** (Rule 1): worklogs must record `device: macbook` vs `device: heavy-runner` because the MacBook is not a heavy-work device and the L6 health audit flags violations. Without a first-class column, the device signal lives in free-form `notes` and is parser-fragile.

The v2.1 bump adds **one** column at position 11: `device`. The other 10 columns are unchanged.

## Decision

**Worklog v2.1 = v2.0 + 11th column `device:`** (position 11, after `notes`).

| # | Column | Notes |
|---|---|---|
| 1–10 | (v2.0 columns, unchanged) | `task_id`, `date`, `repo`, `category`, `title`, `commit_sha`, `pr_number`, `status`, `author`, `notes` |
| **11** | **`device`** | `macbook` \| `heavy-runner` (literal string; no other values accepted) |

**Empty / unknown is a validator error.** The `pheno-worklog-schema` validator (Pydantic) rejects rows where `device` is missing, empty, or not in the allowed set. CI runs the validator on every `WORKLOG.md` change.

**Migration:**
- v2.0 worklogs (existing) remain valid; no retroactive edit required.
- New worklogs (created on or after 2026-06-17) MUST use v2.1.
- The cutover date (2026-06-22) is when the fleet-wide enforcement flips from "warn" to "fail" for the missing `device` column.

**Allowed values:**
- `macbook` — local development on the orchestrator MacBook (no heavy build/test runs).
- `heavy-runner` — work done on a self-hosted runner or dispatched subagent device (the L6 audit's signal for "MacBook-incompatible work").

## Consequences

*Positive:*
- The L6 health audit can now programmatically detect ADR-023 Rule 1 violations (macbook-flagged heavy work).
- The audit's L6 row gains a queryable "what device did this work happen on?" dimension.
- Zero schema breakage for historical worklogs; migration is forward-only.

*Negative:*
- The 41 worklogs in v1 (and the v2.0-extension set) are still v2.0 until a repo opts into v2.1.
- Pre-commit hook cost rises by ~0.05 s (Pydantic enum check on a new column).

*Mitigation:*
- The migration script in `pheno-worklog-schema` auto-fills `device: macbook` for rows created on the MacBook (the common case) and leaves the column blank for `heavy-runner` work.
- 5-day deprecation window (2026-06-17 → 2026-06-22) gives repos time to opt in.

## Alternatives considered

- **Free-form `notes` field, no new column.** Rejected: ADR-023 Rule 1 needs a queryable signal; free-form is parser-fragile.
- **Add a 12th column for `runner_id` instead.** Rejected: overkill; `device: heavy-runner` is the only signal the audit needs; runner id can go in `notes` if needed.
- **Bump to v3 instead of v2.1.** Rejected: 1-column additive change is a minor bump; v3 is reserved for breaking schema changes.

## References

- `pheno-worklog-schema/src/pheno_worklog_schema/schema.py` — v2.1 validator.
- `WORKLOG_SCHEMA_2026_06_10.md` — v2.0 spec (preserved).
- ADR-015 (v2.0 schema), ADR-023 (device-fit gate, Rule 1).
- L6 health audit delta: `L6_PHENO_REPOS_HEALTH_2026_06_15_DELTA.md` (cadence reference).
