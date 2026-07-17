# AGENTS.md — pheno-worklog-schema

> Absorbed into `phenotype-org-audits/audits/worklog-schema/` on 2026-06-20.
> This directory is the canonical home of the package after source-repo deletion.

**Substrate:** Python library (`pheno-*-lib` per ADR-023).
**Bucket:** ACTIVE.
**Scope:** Parse, validate, emit, and migrate WORKLOG.md (ADR-015 v2.0/v2.1).
**Non-scope:** Generic Markdown parsing; non-WORKLOG tables; cross-format
conversion beyond v2.0 ↔ v2.1.

## What this repo IS

- Pure-Python parser/emitter for WORKLOG.md files in the ADR-015 schema.
- Supports both v2.0 (6 columns) and v2.1 (11 columns) — and migrates v2.0
  rows to v2.1 with `device="unknown"` default.
- Round-trips: `parse(text)` → `to_markdown(rows)` is idempotent for v2.1.
- JSONL emit for tooling (`to_jsonl`).
- CLI for `validate` and `migrate`.

## What this repo is NOT

- Not a generic Markdown parser (only the WORKLOG.md schema).
- Not a work-tracking system (no DB, no API).
- Not a duplicate of `AgilePlus` worklogs — those are JSONL, not Markdown.

## Device-fit (ADR-023 + ADR-030)

- **macbook:** all dev + tests.
- **heavy-runner:** N/A.
- **subagent:** suitable.
- **ci:** default lint+test matrix on PR.

## Rule 3.1 quality bar (ADR-023 / ADR-040 / ADR-042B)

- Spec: [SPEC.md](./SPEC.md)
- Docs: README, AGENTS, llms.txt, docs/governance.md.
- Test matrix: unit tests (parse, emit, migrate, JSONL).
- Coverage: 80% lib tier.
- CI: `.github/workflows/ci.yml` (ruff + pytest).
- Worklog: `WORKLOG.md` in v2.1 schema.
- Observability: N/A (no I/O).
