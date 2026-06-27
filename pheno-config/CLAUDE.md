# CLAUDE.md — Claude-specific notes

This file supplements `AGENTS.md` with Claude-specific guidance. Read AGENTS.md
first.

## Read first

1. `AGENTS.md` — model-agnostic onboarding
2. `docs/adr/` — Architecture Decision Records for the project (especially
   the most recent ADR, which describes the current cycle)
3. The `findings/` directory in the monorepo root — recent audit results
4. The `plans/` directory — the current cycle plan and prior cycles

## Conventions specific to this crate

- One module per major concern; `lib.rs` is a directory of `pub mod` lines
  with crate-level docs only.
- Doc comments start with a single-sentence summary, then a paragraph of
  detail. Do not start with the function/variant name.
- Error variants follow the `AppError` pattern (per v23-T4): one human-
  readable sentence in `Display`, one stable code in `miette::Diagnostic`.

## What Claude should NOT do

- Do not introduce a new dependency without first checking ADR-016 (fork-
  only-not-rewrite policy) and asking the user.
- Do not touch files in `phenotype-ops/` or `phenotype-tooling/` without
  explicit user direction — those are managed by the release-engineering
  circle.
- Do not run `cargo publish` or `cargo release` without user approval.
- Do not commit to a branch named `main` or `master`; always use a
  feature branch per ADR-046.

## Model-specific output format

When asked to summarize progress, always include:

1. The current branch name and the SHA it points at.
2. The list of files changed (one line per file, line count delta).
3. The list of tests run and their pass/fail status.
4. The worklog entry ID (L5-NNN format) if one was created this session.
5. Any blockers that prevented further progress.

