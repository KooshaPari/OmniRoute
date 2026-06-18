# ADR-015: V2 10-column WORKLOG.md schema (canonical across all pheno-* repos)

**Status:** Accepted 2026-06-15
**Deciders:** Worklog-schema circle
**Supersedes:** V1 6-col schema (`task_id`, `date`, `title`, `commit`, `status`, `author`)

## Context

The V1 WORKLOG schema (6 columns) shipped in 2026-Q1. By 2026-06, it has accumulated two structural gaps:

1. No column for `pr_number` — worklogs cannot link to PRs without a free-form notes field.
2. No column for `repo` — multi-repo worklogs (the W2/W3/W4 fleet harvests) require a free-form prefix in `title`.

A 2026-05 audit found 41 worklogs using a non-canonical extension (a `pr_number` column added at position 7, breaking parsers). The V2 schema fixes both gaps with a fixed 10-column layout, validated by `pheno-worklog-schema` and enforced by a pre-commit hook.

## Decision

The V2 WORKLOG.md schema is the canonical layout. Every pheno-* repo, every focus repo, and every consumed lib uses it.

**Columns (10, in order):**
1. `task_id` — e.g. `L5-091`.
2. `date` — `YYYY-MM-DD`.
3. `repo` — short repo name (e.g. `pheno-tracing`).
4. `category` — `feat` | `fix` | `chore` | `docs` | `refactor` | `test` | `audit`.
5. `title` — single-line summary.
6. `commit_sha` — 7–40 hex chars.
7. `pr_number` — integer, or empty.
8. `status` — `pending` | `in_progress` | `done` | `cancelled`.
9. `author` — git author.
10. `notes` — free-form, ≤ 500 chars.

**Enforcement:**
- `pheno-worklog-schema` (`src/pheno_worklog_schema/schema.py`) validates every row; 14/14 tests pass.
- A pre-commit hook (`lefthook.yml`) runs the validator on every `WORKLOG.md` change.

## Consequences

**Positive**
- One parser, one validator, one set of CI gates across the fleet.
- The `pr_number` and `repo` columns are first-class — no more free-form workarounds.
- The pre-commit hook catches schema drift before it lands.

**Negative**
- 41 existing worklogs (V1 + extension) need a one-time cutover. A migration script in `pheno-worklog-schema/src/pheno_worklog_schema/migrate_v1_to_v2.py` handles the bulk reformat.
- The pre-commit hook adds ~0.3s to every commit that touches `WORKLOG.md`.

**Mitigation**
- The migration script is idempotent and dry-run-safe.
- The pre-commit hook is opt-in per repo; a fleet-wide rollout happens in W5.

## Alternatives considered

- **Stay on V1 + ad-hoc extensions.** Rejected: the 41-row extension is the smoking gun; divergence has already happened.
- **JSON worklog instead of Markdown.** Rejected: breaks `git diff` readability and the tooling that treats `WORKLOG.md` as the source of truth.
- **CSV worklog.** Rejected: same reason; Markdown is diff-friendly and human-readable.

## References

- `pheno-worklog-schema/src/pheno_worklog_schema/schema.py` — the V2 schema definition.
- `WORKLOG_SCHEMA_2026_06_10.md` — the schema spec doc.
- `pheno-worklog-schema/tests/` — 14/14 tests passing.
- `lefthook.yml` — pre-commit hook config.
