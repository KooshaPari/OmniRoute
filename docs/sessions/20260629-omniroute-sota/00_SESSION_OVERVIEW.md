# OmniRoute Router-Eval Session Overview

## Goal

Build a router-eval foundation that lets OmniRoute compare routing configs with
offline replay data, gate regressions, and emit CI-friendly artifacts.

## Current State

- `src/lib/routerEval/index.ts` aggregates router observations by config,
  computes Pareto frontier entries, computes an AIQ-like score, and compares a
  candidate run against a baseline run.
- `scripts/router-eval/index.ts` exposes `eval:router` for JSONL replay,
  call-log DB replay, baseline comparison, regression failure, markdown output,
  and JSON artifact output.
- `package.json` includes `test:router-eval:bun`, using `./tests/...` paths so
  Bun treats the files as direct test targets instead of broad filters.

## Decisions

- Keep `eval:router` on Bun.
- Use `bun test ./tests/...` for the focused router-eval test gate.
- Avoid ESLint; use `oxlint` for this TS slice.
- Keep JSON artifacts payload-only. Request and response bodies stay out of the
  eval report path unless a later redacted export explicitly opts in.

## Remaining Work

- Add threshold configuration beyond the current regression boolean.
- Split the router-eval files into a clean commit boundary from the broad
  untracked workspace.
- Resume Tracera/Vercel/DesktopDeploy runtime proof after the OmniRoute slice is
  stable.
