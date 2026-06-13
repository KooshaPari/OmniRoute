# Research

## Repo Fit

AtomsBot is in scope for the sladge rollout because it documents
agent-invokable Discord command boundaries, webhook-driven state updates, and
safe Cursor, Claude, and Code LLM contribution paths.

## Local State

Canonical `AtomsBot` had unrelated local edits in `SPEC.md`, `docs/README.md`,
and `docs/worklogs/README.md`, plus untracked ADR, PRD, research, smoke test,
and worklog files. The badge change was prepared in an isolated worktree to
avoid mixing those changes.

## Decision

Treat this as a documentation/governance badge update only. Do not modify bot
runtime behavior, PM provider integration, slash commands, or webhook handling.
