# ADR quality convention (L60)
# Date: 2026-06-22
# Pillar: L60 (Architecture — arch decision record quality, target 2.0 -> 2.5)
# Authority: v25 cycle-15 plan, Track T6. Companion to scripts/adr_lint.py.

## Required sections

Every ADR MUST include the four canonical sections (level-2 headings):
`## Status`, `## Context`, `## Decision`, `## Consequences`.
Inline bold form (`**Status:** ACCEPTED`) is tolerated as a soft variant
and shows up as `OK*` in the linter table; migrate to H2 form when next
touching the file.

## H1 + filename pattern

- Filename: `^ADR-\d{3,4}([A-Z]+)?-<kebab-slug>\.md$`
  (e.g. `ADR-094-no-process-termination.md`, `ADR-050B-router.md`).
- H1: `# ADR-<NNN>([A-Z]+)?<sep> <title>` — sep is `:`, `---`, or `-`.
  Canonical separator is `: ` (colon + space).

## Length guidance

Target <= 800 lines per ADR (matches `MAX_ADR_LINES` in the linter). If an
ADR genuinely needs more, add a `## Closure` section that links out to the
full worklog (`worklogs/...json`) rather than inlining it.

## Cross-ref format

Reference another ADR as `ADR-NNN` or `ADR-NNNA` (with suffix). Every
`ADR-NNN` mention in the body must resolve to a sibling file under
`docs/adr/`; the linter warns on dangling refs (forward references to
not-yet-authored ADRs are tolerated but flagged).

## Tone rules

The `## Decision` section must not contain `TODO` or `FIXME` markers.
These indicate unfinished thinking and belong in the worklog, not the
decision record. The linter emits a TONE warning when found.

## Date format

Include `**Date:** YYYY-MM-DD` (or `**Date**: YYYY-MM-DD`) somewhere in
the first 30 lines of the file. This anchors the ADR to the worklog schema
(ADR-015 v2.1) and makes the freshness check trivial.

## Running the linter

```
python3 scripts/adr_lint.py                  # lint every ADR
python3 scripts/adr_lint.py docs/adr/2026-06-22/   # one wave
python3 scripts/adr_lint.py --json            # machine-readable
python3 scripts/adr_lint.py --quiet           # summary line only
```

Exit code 0 = all pass, 1 = at least one critical (H1/filename) failure,
2 = bad CLI args. Warnings do not block CI; they are advisory.

## Migrating legacy ADRs

Three root-level ADRs (`ADR-006`, `ADR-007`, `ADR-008`) use Title-Case
slugs (e.g. `Circuit-Breaker`) that fail the kebab-case filename rule.
They are PAUSED assets; rename during their next pass.
